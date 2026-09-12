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
                                / About (+ Compare, Weekly, Docs)
```

This matches the pipeline specified in the design handoff (`README.md`) exactly — `buildModel → analytics → insight engine → AI presentation → UI` — and was implemented as specified rather than reinterpreted.

## 2. Analytics & insight layer (`app/src/lib/`)

All 17 files suggested by the handoff's TypeScript split exist, each ported from the reference `logic/analytics.js` with types added and the function signatures preserved:

| Area | Files | Responsibility |
|---|---|---|
| Domain | `domain/model.ts`, `domain/dataQuality.ts` | `buildModel`, stage constants, the one data repair |
| Format | `format.ts` | INR/percent/date/number formatting shared by every screen |
| Analytics | `analytics/funnel.ts`, `aging.ts`, `targets.ts`, `reps.ts`, `deliveries.ts`, `trends.ts`, `context.ts`, `deviation.ts` | Funnel/leak math, aging buckets, target attainment, rep rows, delivery delay stats, monthly trend, `analyze()`, funnel deviation (extra beyond the handoff split) |
| Insights | `insights/priority.ts`, `anomalies.ts`, `recommendations.ts`, `forecast.ts`, `whatif.ts`, `riskLabel.ts` | Priority scoring (normalized against the strongest open case, not clamped), z-test anomaly detection, recommendation generation, pipeline forecasting, what-if scenarios, discrete risk labels — the last three are additions beyond the handoff's minimum split |
| AI (rule-based) | `ai/executiveBrief.ts`, `explanations.ts`, `questionRouter.ts`, `compare.ts` | Executive brief, why-explanations/branch/rep summaries, the deterministic question router, comparison narratives |
| AI (LLM, optional) | `ai/gemini/*`, `ai/aiService.ts` | See §3 |
| Export | `export/csv.ts`, `pdf.ts`, `xlsx.ts`, `report.ts` | CSV action export, PDF/XLSX reports built off a shared `buildExecutiveReport()` |
| RAG | `rag/corpus.ts`, `rag/retrieval.ts` | Real embedding-based (Gemini embeddings, cosine similarity) retrieval over three markdown docs, backing `/docs` |

The load-bearing analytics decisions documented in the handoff — matured-cohort conversion (`model.maturityDays`, not hardcoded; `kpi.conversion` is `null` below 10 matured leads, rendered as "—" never 0%), leaks ranked by `excessLoss` (leads lost) rather than percentage gap, target attainment always shown with rank and pace rather than as a raw percentage, priority scores normalized against the open book's strongest case rather than clamped, and `STALE_DAYS = 8` as a single constant interpolated everywhere — were preserved as specified, since they are judgment calls that change what the product asserts, not stylistic choices.

## 3. AI layer — three tiers, each degrading to the next

A deliberate design constraint: **no LLM is ever asked to compute a number.** All three tiers below read only outputs of the analytics/insight engine.

1. **In-process Gemini** (`lib/ai/gemini/{answer,config,schema,summarize,tools}.ts`, using `@google/genai`, model `gemini-2.5-flash`) — function-calling against tools that read the same `analyze()` context. This is the default path in production (see §5 — it's the only AI path actually wired into the Vercel deployment).
2. **Optional external agent service** (`ai-service/`, only reached if `AI_SERVICE_URL` is set) — a FastAPI service built on LangGraph's `create_agent` (ReAct pattern) with `ChatGoogleGenerativeAI`, `MemorySaver` for in-process (non-persisted) conversation memory, and `ToolStrategy` structured output. Critically, **this service has no data of its own** — its tools are HTTP calls back into the Next.js app's `POST /api/tools/execute`, which runs the exact same validated analytics functions as tier 1. It exposes `GET /health`, `GET /health/detail`, `POST /ask`, `POST /summarize`, `POST /feedback`, and includes guardrails for system-prompt-leak detection, turn-boundary-safe history trimming, and INR-currency enforcement.
3. **Deterministic rule engine** (`lib/ai/questionRouter.ts:askDealerPulse`) — the floor. Questions the router can't map return exactly `"I don't have enough data to answer that."`

`POST /api/ask` and `POST /api/summarize` (`app/src/app/api/ask/route.ts`, `api/summarize/route.ts`) try tier 2 first if `AI_SERVICE_URL` is configured, fall back to tier 1, then to tier 3. This fallback chain is exercised by `fault-tolerance.test.ts`, which deliberately sets `AI_SERVICE_URL=http://localhost:1` to force the failure path.

## 4. Routes (App Router)

All 7 screens named in the handoff exist and match its structure: `/` (Overview), `/branches`, `/branches/[branchId]`, `/reps` + `/reps/[repId]`, `/actions` (Action Center), `/funnel` (Funnel Diagnostics), `/about`. Each has its own `loading.tsx` (shimmer skeleton, not a spinner, per the handoff's stated preference).

Beyond the handoff's minimum: `/compare` (branch/rep comparison mode), `/weekly` (executive summary, PDF/XLSX export surface), `/docs` (RAG-backed documentation search), `/welcome`, and `/ai-health` (an unlinked internal observability page for the AI fallback chain).

API surface (`app/src/app/api/`): `ask`, `summarize`, `why`, `compare`, `lead`, `export/pdf`, `export/xlsx`, `tools/execute` (the tool endpoint the external `ai-service` calls back into), `feedback`, `ai/health`, `docs/summarize`, `search-index`.

## 5. Deployment

- **Next.js app**: deploys to Vercel with zero custom config — no `vercel.json` present, none needed. `app/.env.example` documents `GEMINI_API_KEY` / `GEMINI_MODEL` only.
- **`ai-service`**: has no deployment configuration anywhere (no Dockerfile, Procfile, railway.json, or fly.toml) and its own README documents it as run locally via `uvicorn`. `AI_SERVICE_URL` is **not** present in `app/.env.example`, so the production Vercel deployment runs on the in-process Gemini tier (tier 1) by design/default — the external agent service is a local-dev/demo capability, not a production dependency. This is a legitimate scope boundary: the product's minimum-requirement functionality never depends on a service that isn't deployed.

## 6. Testing

- **TypeScript (Vitest)**, `app/src/lib/__tests__/`: `analytics.test.ts` (59 assertions — the reference suite's 58 plus one new one), `anomaly-ranking.test.ts` (4), `forecast-whatif.test.ts` (10), `fault-tolerance.test.ts` (10, covers the three-tier AI fallback).
- **Python (pytest)**, `ai-service/tests/`: 8 files covering config, tools, main app, graph-level fallback, summarize fallback, multi-turn conversation persistence, agent cache reconfiguration, and a live-Gemini smoke test that skips without a real API key.

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
- No golden-dataset eval harness for AI answer quality — only guardrail/fallback tests and a handful of live-Gemini smoke tests.
- No formal screen-reader accessibility pass (keyboard traversal and contrast were addressed; screen-reader testing was not).
- `ai-service` has no production deployment path — it is a local/optional enhancement layer only, by design (§5).
