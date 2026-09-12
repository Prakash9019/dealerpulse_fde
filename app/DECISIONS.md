# DealerPulse — Decisions

## 1. Executive Summary

DealerPulse is organized around one idea: **DATA → INSIGHT → ACTION**. Raw lead and delivery records are turned into business numbers by a deterministic analytics engine, those numbers are turned into plain-language explanations and recommendations, and the product's job is to get a manager to a decision faster — not to be a bigger dashboard.

The line between those layers is deliberate. Business numbers (conversion, funnel leaks, target attainment, priority scores) are computed by pure functions and covered by tests, so they are stable and checkable. AI sits on top of that — explaining, summarizing, answering natural-language questions — but it never computes a metric. That split is what makes the AI layer safe to add without putting the numbers at risk.

## 2. What We Built

A Next.js (App Router) + TypeScript + Tailwind + Recharts app with seven core screens — Overview, Branches, Branch Detail, Rep Scorecard, Action Center, Funnel Diagnostics, and About — plus Compare, Weekly (executive report), and Docs (RAG search).

On top of the core screens:

- **Analytics/insight engine** (`lib/analytics`, `lib/insights`) — funnel, aging, targets, rep performance, delivery delays, trends, anomaly detection, priority scoring, forecasting, what-if.
- **Action Center** — a priority-ranked lead queue, not another chart.
- **AI layer** — an executive brief, "Why?" explanations, and a natural-language Q&A surface (Ask DealerPulse), backed by three fallback tiers.
- **RAG document search** — retrieval over reference markdown docs (escalation SOP, metrics glossary, anomaly methodology).
- **Exports** — CSV, formatted PDF, and multi-sheet XLSX, all built off one shared report function.
- **Observability** — an in-memory AI call log and a Helpful/Not Helpful/Report Incorrect feedback control.
- **Optional FastAPI/LangGraph service** (`ai-service/`) — a separate agent tier, not required for the core product.

The technical architecture — file layout, pipeline, routes, deployment — is documented in `ARCHITECTURE.md`; this document explains why it looks the way it does.

## 3. Key Decisions

### Decision: Analytics before UI

**Why:** The reference `analytics.js` and its 58-assertion test suite encode judgment calls about what each metric actually means (maturity windows, leak ranking, target pacing). Those calls have to be right before they're wrapped in a chart.

**Trade-off:** Slower first week — no screen existed until the analytics were ported and green.

**Result:** Every screen built afterward read from analytics already proven correct, so no screen-level bug was ever an analytics bug in disguise.

### Decision: One `analyze()` entry point for every screen

**Why:** If each screen recomputed its own version of "conversion" or "funnel leak," the product risks showing two different numbers for the same thing — the fastest way to lose a CEO's trust in a dashboard.

**Trade-off:** Screens can't take shortcuts with bespoke, screen-local calculations, even when that would be less code for one specific view.

**Result:** One source of truth for every KPI on every screen, and a single place to fix or extend the math.

### Decision: Deterministic analytics, not LLM arithmetic

**Why:** An LLM asked to compute conversion rates or revenue-at-risk will occasionally get the arithmetic wrong, and there's no way to catch that at test time. Priority scores, anomaly detection (two-proportion z-test), and revenue-at-risk are pure functions over the analytics engine instead.

**Trade-off:** The AI layer is more constrained — it can explain a number but never invent one.

**Result:** Every number on screen is testable and reproducible; AI is confined to language, where hallucination is visible and low-stakes rather than silently wrong.

### Decision: RAG for documents, tools for KPIs

**Why:** RAG (embedding similarity over reference markdown) is well-suited to unstructured reference material — an escalation SOP, a metrics glossary — but poorly suited to precise numeric answers. KPI questions are routed to the same analytics functions every screen uses, not to retrieved text.

**Trade-off:** Two separate answering paths to maintain instead of one.

**Result:** A KPI question always gets the same answer the dashboard would show; a policy/definition question gets grounded retrieval instead of a guess.

### Decision: No database

**Why:** ~510 leads is small enough that reading the JSON, building a typed model, and computing analytics server-side per request (memoized by filter key) is both faster and simpler to reason about than standing up and migrating a database for this dataset size.

**Trade-off:** This doesn't scale to a real multi-thousand-lead, multi-tenant dataset as-is.

**Result:** No schema, no migrations, no ORM — one less layer that could disagree with the source data.

### Decision: Action Center as a workflow, not another dashboard

**Why:** The assignment asks for at least one actionable insight — not one more chart. Action Center is a priority-ranked queue a manager can actually work through: filter, sort, and act on individual leads.

**Trade-off:** It reads the network-wide analytics context once and filters client-side rather than round-tripping to the server per filter change — only safe because the test suite proves priority scores are stable under branch/rep filtering.

**Result:** Filtering feels instant, and the simplification is backed by a proven invariant rather than an assumption.

### Decision: Layered AI with graceful fallback

**Why:** AI features should degrade, not break the dashboard, if a provider is slow, unconfigured, or down.

**Trade-off:** Three tiers to maintain — an optional external agent service, an in-process Gemini path, and a deterministic rule-based router as the floor — each falling back to the one below it.

**Result:** The core product (KPIs, drill-down, action queue) works with zero LLM calls; AI is additive, never a dependency the dashboard could be broken by.

### Decision: Honest prototype boundaries for Contact / Assign / Escalate

**Why:** The assignment explicitly doesn't require a backend, and pretending these actions persist to a CRM would misrepresent what was built.

**Trade-off:** These actions are optimistic local state only — they don't survive a refresh and don't write anywhere.

**Result:** The UI says what it is instead of faking persistence a reviewer would eventually notice was missing.

## 4. What We Deliberately Did Not Build

- **No database** — the dataset is small enough that in-memory, server-side computation is simpler and faster than a DB round-trip; see Decision above.
- **No authentication** — out of scope per the assignment brief, which explicitly says not to build it.
- **No real CRM writes** — Contact/Assign/Escalate are local UI state, not backend persistence, because building fake persistence would be more dishonest than useful.
- **No production deployment for `ai-service`** — it's an optional local/demo agent tier with no Dockerfile or deploy config; the production app runs on the in-process Gemini tier by default, so the shipped product's minimum requirements never depend on an undeployed service.
- **No persistent AI observability/feedback** — the call log and feedback control are in-memory only, scoped to a single running process.

## 5. Differentiation / Open-Ended Work

Beyond the assignment's minimum, a few additions make this closer to a tool a manager would actually keep using:

- **Lead risk labels and cross-branch/cross-rep funnel-leak analysis** turn "here's a chart" into "here's where the leak is and how it compares to the rest of the network."
- **Comparison modes** (branch/rep vs. network, rep vs. branch) let a manager ask "is my branch actually behind, or just different?" instead of eyeballing a bar chart.
- **Anomaly detection** (two-proportion z-test) flags statistically real deviations instead of relying on a human to notice a bar that looks off.
- **Gemini function calling and real embedding-based RAG** make the natural-language surface answer against actual computed data and real reference documents, not keyword matching or a canned response.
- **PDF/XLSX executive reporting**, built from the same report function as the on-screen view, means the report a CEO forwards can never drift from what the dashboard shows.
- **AI guardrails and fallbacks** (rate limiting, timeouts with retry, schema-validated output, three-tier degradation) make the AI layer something that fails safely instead of just failing.
- **Feedback and observability** (Helpful/Not Helpful/Report Incorrect, an internal AI call log) start building the evaluation habit a real deployment would need, even though today it's in-memory only.

## 6. Interesting Data Findings

### Matured cohort conversion

December's raw conversion rate looks like a collapse — leads simply haven't had time to close yet. Leads take a median of ~38 days from first touch to delivery, so any KPI that ignores lead age will report a technically correct but substantively misleading number for recent cohorts. The fix is a maturity window: conversion is computed only over cohorts old enough to have plausibly closed, and shown as "—" rather than a false 0% or 1% when a cohort isn't mature enough yet.

### Lakeside Toyota

The branch's real problem is upstream: its New → Contacted rate is the leak (58%), not test drive or negotiation conversion. Ranking leaks by percentage gap instead of leads lost would have pointed at the wrong stage. Because the leak sits at first contact, the right operational fix is a first-response SLA, not generic sales coaching — a different kind of intervention than a dashboard that only shows funnel percentages would suggest.

### Target calibration

Target attainment tops out around 15% network-wide, and that gap is roughly uniform across every branch. A uniform shortfall of that size across an entire network reads as a target-calibration problem — the targets themselves were likely set too high — rather than five branches independently underperforming. The product treats this as a calibration finding rather than ranking branches against a target nobody could actually hit.

## 7. What I'd Build Next

1. **Persistent AI observability and feedback** — today's call log and feedback control are in-memory only; without persistence, there's no way to look back at how the AI layer performed last week.
2. **A golden evaluation dataset for AI answer quality** — current tests cover guardrail/fallback logic, not whether answers are actually correct against known-good references.
3. **More rigorous PII and prompt-injection testing** — beyond the one informal live-Gemini check that exists today, this needs deliberate red-teaming before it's trusted with real customer data.
4. **Production hardening of the optional agent service** — if the external `ai-service` tier becomes something users actually rely on, it needs a real deployment path, not just a local `uvicorn` run.
5. **Real CRM/action integration** — Contact/Assign/Escalate would need to write somewhere real if this moved past prototype, so actions taken in the dashboard actually change downstream state.
6. **Full accessibility/screen-reader validation** — keyboard traversal and ARIA states were checked visually, but a real assistive-technology pass hasn't been done.
