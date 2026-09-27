# DealerPulse — Architecture

> What was actually built. Read alongside `IMPLEMENTATION_PLAN.md` (what we planned, and why, before building) and `ASSIGNMENT.md` (the brief this answers). `app/DECISIONS.md` holds the product-tradeoff narrative; this document is the technical map.

---

## 1. System overview

DealerPulse is a Next.js (App Router, TypeScript) application that reads a static dataset, runs it through a pure-function analytics/insight pipeline, and renders seven screens for a CEO and branch managers. There is **no database** — the dataset is small enough (~510 leads) that server-side computation per request, memoized by filter key, is faster than a DB round-trip and simpler to reason about.

```
data/dealership_data.json
        │
        ▼
lib/domain/model.ts            buildModel() — typed model, dates parsed,
                                one data repair ("{}" → "a rival" in a note, display-only)
        │
        ▼
lib/analytics/*                funnel, aging, targets, reps, deliveries,
                                trends, sources, deviation
        │
        ▼
lib/analytics/context.ts       analyze(model, filters) — the single entry point
                                every screen reads from; memoized on filter key
        │
        ▼
lib/insights/*                 anomalies (two-proportion z-test), priority
                                scoring, recommendations, forecast, what-if,
                                risk labels
        │
        ▼
lib/ai/*                       executive brief, why-explanations, summaries,
                                question router — all rule-based, all reading
                                only already-computed analytics, never raw JSON
        │
        ▼
App Router Server Components    Overview / Branches / Branch Detail / Rep
+ Route Handlers                Scorecard / Action Center / Funnel Diagnostics
                                / Compare / Demand / Leads
```

(Weekly, Docs, and About were built beyond the handoff's minimum, then later removed as
standalone tabs — see §4 below and `DECISIONS.md` for why.)

This matches the pipeline specified in the design handoff (`README.md`) exactly — `buildModel → analytics → insight engine → AI presentation → UI` — and was implemented as specified rather than reinterpreted.

## 2. Analytics & insight layer (`app/src/lib/`)

All 17 files suggested by the handoff's TypeScript split exist, each ported from the reference `logic/analytics.js` with types added and the function signatures preserved:

| Area | Files | Responsibility |
|---|---|---|
| Domain | `domain/model.ts`, `domain/dataQuality.ts` | `buildModel`, stage constants, the one data repair |
| Format | `format.ts` | INR/percent/date/number formatting shared by every screen |
| Analytics | `analytics/funnel.ts`, `aging.ts`, `targets.ts`, `reps.ts`, `deliveries.ts`, `trends.ts`, `context.ts`, `deviation.ts`, `models.ts` | Funnel/leak math, aging buckets, target attainment, rep rows, delivery delay stats, monthly trend, `analyze()`, funnel deviation, per-model demand-vs-revenue rollup (`models.ts` — added after benchmarking against a reference submission, backs the `/models` Demand screen; see `DECISIONS.md`) |
| Insights | `insights/priority.ts`, `anomalies.ts`, `recommendations.ts`, `forecast.ts`, `whatif.ts`, `riskLabel.ts`, `testDriveGate.ts` | Priority scoring (normalized against the strongest open case, not clamped), z-test anomaly detection, recommendation generation, pipeline forecasting, what-if scenarios, discrete risk labels, the test-drive hard-gate finding (`testDriveGate.ts` — leads that reach Contacted but never Test Drive essentially never deliver; a structural fact computed from `status_history`, not a rate) |
| AI (rule-based) | `ai/executiveBrief.ts`, `explanations.ts`, `questionRouter.ts`, `compare.ts` | Executive brief, why-explanations/branch/rep summaries, the deterministic question router, comparison narratives |
| AI (LLM, optional) | `ai/gemini/*`, `ai/aiService.ts` | See §3 |
| Export | `export/csv.ts`, `pdf.ts`, `xlsx.ts`, `report.ts` | CSV action export, PDF/XLSX reports built off a shared `buildExecutiveReport()` |
| RAG | `rag/corpus.ts`, `rag/retrieval.ts` | Real embedding-based (Gemini embeddings, cosine similarity) retrieval over three markdown docs, backing Ask DealerPulse's answers to policy/process questions (previously also had a dedicated `/docs` browsing tab, since removed) |

The load-bearing analytics decisions documented in the handoff — matured-cohort conversion (`model.maturityDays`, not hardcoded; `kpi.conversion` is `null` below 10 matured leads, rendered as "—" never 0%), leaks ranked by `excessLoss` (leads lost) rather than percentage gap, target attainment always shown with rank and pace rather than as a raw percentage, priority scores normalized against the open book's strongest case rather than clamped, and `STALE_DAYS = 8` as a single constant interpolated everywhere — were preserved as specified, since they are judgment calls that change what the product asserts, not stylistic choices.

Two constants added after the handoff, following the same "one named constant, never a magic number" rule: `MIN_RATED_LEADS = 10` (`domain/model.ts`) — the floor below which a branch/rep conversion rate renders as "Not rated" rather than a number a small sample could swing by 10+ points — and `monthsBehindLive()` (`format.ts`), which turns `model.asOfLabel` into "Data as of 31 Dec 2025 · N months behind live", computed live off the real clock rather than hardcoded, so the label doesn't go stale as time passes after a demo/interview.

## 3. AI layer — three tiers, each degrading to the next

A deliberate design constraint: **no LLM is ever asked to compute a number.** All three tiers below read only outputs of the analytics/insight engine.

1. **In-process Gemini** (`lib/ai/gemini/{answer,config,schema,summarize,tools}.ts`, using `@google/genai`, model `gemini-2.5-flash`) — function-calling against tools that read the same `analyze()` context. This is the default path in production (see §5 — it's the only AI path actually wired into the Vercel deployment).
2. **Optional external agent service** (`ai-service/`, only reached if `AI_SERVICE_URL` is set) — a FastAPI service built on LangGraph's `create_agent` (ReAct pattern) with `ChatGoogleGenerativeAI`, `MemorySaver` for in-process (non-persisted) conversation memory, and `ToolStrategy` structured output. Critically, **this service has no data of its own** — its tools are HTTP calls back into the Next.js app's `POST /api/tools/execute`, which runs the exact same validated analytics functions as tier 1. It exposes `GET /health`, `GET /health/detail`, `POST /ask`, `POST /summarize`, `POST /feedback`, and includes guardrails for system-prompt-leak detection, turn-boundary-safe history trimming, and INR-currency enforcement.
3. **Deterministic rule engine** (`lib/ai/questionRouter.ts:askDealerPulse`) — the floor. Questions the router can't map return exactly `"I don't have enough data to answer that."`

`POST /api/ask` and `POST /api/summarize` (`app/src/app/api/ask/route.ts`, `api/summarize/route.ts`) try tier 2 first if `AI_SERVICE_URL` is configured, fall back to tier 1, then to tier 3. This fallback chain is exercised by `fault-tolerance.test.ts`, which deliberately sets `AI_SERVICE_URL=http://localhost:1` to force the failure path.

## 4. Routes (App Router)

6 of the 7 screens named in the handoff exist and match its structure: `/` (Overview), `/branches`, `/branches/[branchId]`, `/reps` + `/reps/[repId]`, `/actions` (Action Center), `/funnel` (Funnel Diagnostics). Each has its own `loading.tsx` (shimmer skeleton, not a spinner, per the handoff's stated preference). `/about` was built to match the handoff, then later removed as a standalone nav tab — see below.

Beyond the handoff's minimum: `/compare` (branch/rep comparison mode) is the one that stayed from the original build. `/weekly` (executive summary, PDF/XLSX export surface), `/docs` (RAG-backed documentation browsing), and `/about` were built, then removed as standalone nav tabs in a later cleanup pass — none were requested by the take-home assignment, and they diluted the "understand everything at a glance" premise the rest of the product is built around (see `DECISIONS.md` §3, "Cut Weekly, Docs, and About as standalone nav tabs"). The capabilities stayed: PDF/XLSX export still runs off `buildExecutiveReport()` from Overview's export buttons, and RAG retrieval still backs Ask DealerPulse. `/welcome` and `/ai-health` (an unlinked internal observability page for the AI fallback chain) remain.

`/models` (Demand) and `/leads` (Leads) were added in a later pass, after benchmarking the deployed app against another candidate's submission on the same assignment/dataset (see `GAP_ANALYSIS_VS_REFERENCE.md`, `MASTER_INTERVIEW_PREP.md` §5). `/models` ranks leads/test-drive-rate/conversion/revenue per vehicle model (`lib/analytics/models.ts`), surfacing the sharpest "lead volume share ≠ revenue share" mismatch; it's filter-scoped like Branches/Reps/Funnel because it answers "what's demand doing in this window." `/leads` is the self-serve "show me every lead regardless of outcome" table (`components/leads/LeadsTable.tsx`) with cohort quick-filter chips (Never contacted / No test drive / Stuck orders / Cold 7+ days / Lost / Delivered) — deliberately branch/rep-scoped but **not** time-range-filtered, for the same reason Revenue at Risk and lead aging aren't: a present-tense "which leads exist" view shouldn't let a manager hide a lead by picking a shorter window.

API surface (`app/src/app/api/`): `ask`, `summarize`, `why`, `compare`, `lead`, `export/pdf`, `export/xlsx`, `tools/execute` (the tool endpoint the external `ai-service` calls back into), `feedback`, `ai/health`, `search-index`. (`docs/summarize` was removed along with the `/docs` page it only served.)

## 5. Deployment

- **Next.js app**: deploys to Vercel with zero custom config — no `vercel.json` present, none needed. `app/.env.example` documents `GEMINI_API_KEY` / `GEMINI_MODEL` only.
- **`ai-service`**: has no deployment configuration anywhere (no Dockerfile, Procfile, railway.json, or fly.toml) and its own README documents it as run locally via `uvicorn`. `AI_SERVICE_URL` is **not** present in `app/.env.example`, so the production Vercel deployment runs on the in-process Gemini tier (tier 1) by design/default — the external agent service is a local-dev/demo capability, not a production dependency. This is a legitimate scope boundary: the product's minimum-requirement functionality never depends on a service that isn't deployed.

## 6. Testing

- **TypeScript (Vitest)**, `app/src/lib/__tests__/`: `analytics.test.ts` (58 assertions — the reference suite's own count), `anomaly-ranking.test.ts` (4), `forecast-whatif.test.ts` (10), `fault-tolerance.test.ts` (10, covers the three-tier AI fallback).
- **Python (pytest)**, `ai-service/tests/`: 8 files covering config, tools, main app, graph-level fallback, summarize fallback, multi-turn conversation persistence, agent cache reconfiguration, and a live-Gemini smoke test that skips without a real API key.
- **AI eval harness** (`app/evals/`, run via `npm run eval`): a deterministic, read-only runner (`run.ts`) over four fixture sets — `golden_questions.json` (16 grounded Q&A cases), `regression_cases.json` (9), `rag_cases.json` (5, checks retrieval actually returns the right doc/section, not just a keyword match), `security_cases.json` (11, prompt-injection/system-prompt-leak attempts). Any check that genuinely requires a live Gemini/embedding call is reported as **SKIPPED**, never a fabricated PASS, when `GEMINI_API_KEY` isn't configured — this is a golden-dataset eval harness for AI answer quality, not just the guardrail/fallback unit tests above.

## 7. Coverage against `ASSIGNMENT.md` minimum requirements

| Requirement | Status | Where |
|---|---|---|
| Overview dashboard | Met | `/` — AI brief, KPI row, monthly trend, branch table, funnel overview, AI insights |
| Drill-down (network → branch → rep) | Met | `/branches` → `/branches/[branchId]` → `/reps/[repId]` |
| ≥1 actionable insight | Met | Action Center priority queue (`/actions`) + per-screen "Why?" / recommendation CTAs, all routing rather than dead-ending |
| Filtering / time-range | Met | URL-persisted `range`/`branch`/`rep`, custom range picker (closed — was an open gap in the handoff) |
| Responsive (desktop + tablet) | Met | Tailwind `lg` breakpoint sidebar collapse (a deliberate deviation from the handoff's bespoke 1120px JS listener — documented in `app/DECISIONS.md`), `auto-fit` grid reflow, `overflow-x:auto` tables with sticky first column |

All three gaps the handoff itself flagged as open ("Known gaps": custom date range, global rep filter, 1024px tablet visual review) are closed per `app/DECISIONS.md`.

## 8. Known gaps / what's next

Carried over from `app/DECISIONS.md` for a single source of truth:

- AI observability and feedback are stored **in-memory only** — no persistence across restarts (both the Next.js side and `ai-service`).
- No formal screen-reader accessibility pass (keyboard traversal and contrast were addressed; screen-reader testing was not).
- `ai-service` has no production deployment path — it is a local/optional enhancement layer only, by design (§5).
