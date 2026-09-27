# DealerPulse — Runbook

Practical "how do I run this and check it works" doc. For *why* things are built this way, see `DECISIONS.md` and `ARCHITECTURE.md`. This file only covers: running the frontend, running the optional AI service, what's implemented, and how to manually test each piece.

---

## 1. Prerequisites

- Node.js 18+ and npm
- (Optional, only for the separate agent service) Python 3.10+
- (Optional) a Gemini API key — the product works without one, on a rule-based fallback

---

## 2. Running the frontend (the actual product)

```bash
cd app
npm install
npm run dev
```

Open **http://localhost:3000**. That's the whole product — dashboard, AI features, exports, everything except the optional standalone agent service in section 3.

Other useful scripts (run from `app/`):

| Command | What it does |
|---|---|
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest — analytics/insights/AI unit tests |
| `npm run eval` | Runs the AI eval suite (`evals/*.json`) against golden/regression/RAG/security cases |

### Enabling real AI (optional)

Without any setup, "Ask DealerPulse" and summaries run on a deterministic rule-based engine — the dashboard is fully functional either way. To turn on Gemini:

```bash
cd app
cp .env.example .env.local
# edit .env.local and set:
GEMINI_API_KEY=your-key-here
# optional, defaults to gemini-2.5-flash:
GEMINI_MODEL=
```

Restart `npm run dev` after editing `.env.local`.

---

## 3. Running the optional AI service (`ai-service/`)

This is a **separate, optional** FastAPI + LangGraph agent tier. It doesn't compute anything itself — every tool call it makes is an HTTP request back into the running Next.js app's `/api/tools/execute`. Skip this section entirely unless you specifically want to test/demo that alternate orchestration path; the core product does not require it.

```bash
cd ai-service
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # fill in GEMINI_API_KEY
uvicorn main:app --reload --port 8000
```

Requires the Next.js app already running on `http://localhost:3000` (configurable via `NEXT_APP_URL` in `ai-service/.env`) — this service has no data of its own.

To make the Next.js app actually route through it instead of its default in-process Gemini path, add to `app/.env.local`:

```
AI_SERVICE_URL=http://localhost:8000
```

`/api/ask` and `/api/summarize` then try this service first, falling back to the in-process Gemini path, then the rule-based engine, if it's unreachable.

### Checking the AI service is alive

```bash
curl http://localhost:8000/health
# -> { "ok": true, "geminiConfigured": true|false, "model": "..." }

curl http://localhost:8000/health/detail
# -> in-memory observability: request counts, latency, tool-call breakdown, fallback reasons
```

### AI service tests

```bash
cd ai-service
pip install pytest pytest-httpx
pytest
```

Tests requiring a live Gemini key are skipped automatically when `GEMINI_API_KEY` isn't set.

---

## 4. Checking the AI layer's health inside the frontend

Visit **http://localhost:3000/ai-health** (internal diagnostics page, intentionally not linked from the sidebar). Shows:

- Whether Gemini is configured and which model
- Total requests, success rate, fallback rate (persisted in SQLite, survives restarts)
- Avg/p90 latency, total tokens, illustrative estimated cost

No question/answer text is ever stored here — it's operational metrics only.

---

## 5. What's implemented

**Core idea:** DATA → INSIGHT → ACTION. A deterministic analytics engine computes every number; an AI layer explains/summarizes/answers questions on top of it but never computes a metric itself.

### Screens (`app/src/app/`)

| Screen | Route | Purpose |
|---|---|---|
| Overview | `/` | Network-wide KPIs, funnel, trends, executive brief |
| Branches | `/branches` | Cross-branch comparison table |
| Branch Detail | `/branches/[branchId]` | Single-branch drill-down |
| Rep Scorecard | `/reps/[repId]` | Single-rep performance |
| Action Center | `/actions` | Priority-ranked lead queue — the actionable-insight surface, not another chart |
| Funnel Diagnostics | `/funnel` | Stage-by-stage leak analysis |
| Compare | `/compare` | Branch-vs-network, rep-vs-branch comparison modes |
| Demand | `/models` | Per-model lead volume vs. revenue vs. test-drive rate — added after benchmarking against a reference submission (see `GAP_ANALYSIS_VS_REFERENCE.md`) |
| Leads | `/leads` | Every lead regardless of outcome, with cohort quick-filters (self-serve, not scored — Action Center is the scored worklist of open leads) |
| Welcome | `/welcome` | Marketing/landing page |
| AI Health (internal) | `/ai-health` | Ops diagnostics, see §4 |

`/weekly`, `/docs`, and `/about` were removed as standalone nav tabs in a later cleanup pass — none were requested by the assignment brief, and they diluted the "understand everything at a glance" premise (see `app/DECISIONS.md` §3). The capabilities stayed: PDF/XLSX export still runs off `buildExecutiveReport()` from Overview's export buttons, and RAG retrieval still backs Ask DealerPulse's answers to policy/process questions.

### Analytics/insight engine (`app/src/lib/analytics`, `app/src/lib/insights`)

Funnel, cohort-matured conversion, aging buckets, target attainment, rep performance, delivery delays, monthly trends, source performance, lost-reason breakdown, anomaly detection (two-proportion z-test), priority scoring, action-queue generation, forecasting, what-if scenarios. All pure functions, covered by tests (`npm test`).

### AI features

- **Executive brief** — auto-generated narrative summary on Overview
- **"Why?" explanations** — grounded, per-KPI explanations (`WhyButton`)
- **Ask DealerPulse** — natural-language Q&A, three-tier fallback: optional external agent service → in-process Gemini → deterministic rule-based router (`app/src/lib/ai/questionRouter.ts`). Out-of-scope questions always get exactly *"I don't have enough data to answer that."* — never a guessed answer.
- **RAG document search** — embedding-similarity retrieval over `app/content/docs/*.md` (escalation SOP, metrics glossary, anomaly methodology), backing Ask DealerPulse's answers to policy/process questions (there was previously a dedicated `/docs` browsing tab for this; it was removed, the retrieval itself stayed — see the screens table above)

### Exports (`app/src/lib/export`)

CSV, formatted PDF, and multi-sheet XLSX — all built from one shared report function, so an exported report can never drift from what's on screen.

### Observability & feedback

In-memory-then-SQLite AI call log (`/ai-health`) and a Helpful / Not Helpful / Report Incorrect control on AI-generated content.

### Deliberately not built (see `app/DECISIONS.md` §4)

No database, no auth, no real CRM writes (Contact/Assign/Escalate are local UI state only, don't survive a refresh), no production deploy of `ai-service`, no persistent-across-restarts feedback data beyond the SQLite call log.

---

## 6. Manual test checklist

Run `npm run dev` in `app/` first, then walk through this with the browser open at `http://localhost:3000`.

### Core dashboard (no AI needed — should all work with zero Gemini setup)

- [ ] `/` loads, shows KPIs, funnel chart, monthly trend — no console errors
- [ ] Change the date-range / branch / rep filters (top bar) — numbers update everywhere they appear, consistently
- [ ] December's conversion KPI shows **"—" with an explanatory note**, not a false 0% (matured-cohort rule — see `DECISIONS.md` §6)
- [ ] `/branches` — table sorts/filters correctly, click into a branch
- [ ] `/branches/[branchId]` — drill-down numbers match what `/branches` showed for that branch
- [ ] `/reps/[repId]` — rep scorecard renders, numbers plausible
- [ ] `/actions` (Action Center) — priority queue is sorted, filtering by branch/rep doesn't require a server round-trip (should feel instant), try Contact/Assign/Escalate on a lead — confirm it updates optimistically but **does not survive a page refresh** (expected, it's local state only, per §4)
- [ ] `/funnel` — stage leaks are ranked; for Lakeside Toyota specifically, the leak should show at **New → Contacted**, not test-drive/negotiation (a known data finding, see `DECISIONS.md` §6)
- [ ] `/compare` — branch-vs-network and rep-vs-branch modes both render
- [ ] `/models` (Demand) — model rows sort by revenue; the lead-share-vs-revenue-share callout only appears when a real mismatch exists
- [ ] `/leads` — cohort quick-filter chips (Never contacted / No test drive / Stuck orders / Cold 7+ days / Lost / Delivered) each show a live count and filter the table; changing the range picker does **not** change the row count (deliberately not time-boxed, see `ARCHITECTURE.md` §4)
- [ ] `/funnel` — the test-drive gate card appears above the stage list when any leads are stuck at Contacted, and states "0 of them ever delivered" (or the true count) rather than a percentage
- [ ] Export buttons (on Overview): download CSV, PDF, and XLSX — open each and confirm the numbers match what's on screen

### AI layer — without Gemini configured (`GEMINI_API_KEY` unset)

- [ ] `/ai-health` shows "not configured — running on rule-based fallback"
- [ ] Ask DealerPulse still answers grounded questions (rule-based router) — try one of the sample questions
- [ ] Ask something out of scope — response is **exactly** "I don't have enough data to answer that." (no hallucinated guess)
- [ ] Ask a bare greeting ("hi") — gets the canned greeting, instantly, no AI call

### AI layer — with Gemini configured

- [ ] Set `GEMINI_API_KEY` in `app/.env.local`, restart `npm run dev`
- [ ] `/ai-health` shows "configured · <model>"
- [ ] Ask a natural-language question referencing real numbers (e.g. "Why is Lakeside underperforming?") — answer should cite actual computed evidence, not vague text
- [ ] Ask several questions in a row — `/ai-health` request/success/latency counters increment
- [ ] Try the Helpful/Not Helpful/Report Incorrect control on an AI-generated card
- [ ] Stop the Gemini key temporarily (or use an invalid one) and re-ask — confirm it falls back to the rule-based engine instead of erroring the page

### RAG document search

- [ ] Ask DealerPulse a policy/process question sourced from one of `app/content/docs/escalation-sop.md`, `metrics-glossary.md`, or `anomaly-methodology.md` (e.g. "what's the escalation process for a stale order?") — the answer should retrieve and ground on the relevant doc/section, not just keyword-match or answer from general knowledge
- [ ] `npm run eval` — the `rag_cases.json` checks specifically verify retrieval returns the correct doc/section (requires `GEMINI_API_KEY`; otherwise reported SKIPPED, not a false pass)

### Optional external AI service (only if you started it per §3)

- [ ] `curl http://localhost:8000/health` returns `ok: true`
- [ ] Set `AI_SERVICE_URL=http://localhost:8000` in `app/.env.local`, restart the Next app
- [ ] Ask a question via Ask DealerPulse — `curl http://localhost:8000/health/detail` shows the request count increment (confirms it's actually routing through this service, not the in-process path)
- [ ] Stop the `uvicorn` process, ask another question — dashboard should **not** break; it falls back to the in-process Gemini path (or rule-based engine)

### Automated checks (fast, run before/after manual testing)

```bash
cd app
npm test          # analytics/insights/AI unit tests, 58+ analytics assertions among them
npm run eval       # golden questions, regression cases, RAG cases, security cases
npm run lint
```
