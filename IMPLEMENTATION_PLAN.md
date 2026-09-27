# DealerPulse — Implementation Plan

> Written to precede the build. Read alongside `ASSIGNMENT.md` (the brief) and `ARCHITECTURE.md` (what shipped). This document exists to make the story explicit for an interview: **research → plan → execute**, in that order, not implementation-first.

---

## 1. Read the brief, then read the data before deciding anything

`ASSIGNMENT.md` sets one non-negotiable frame: *"You're a forward deployed engineer... build a working product, not a toy demo."* Two users are implied even though only one is named — a CEO who needs network health at a glance, and (via the "drill-down" requirement) a branch manager who needs the same question answered at rep level. Everything downstream — screen list, information hierarchy, what counts as an "insight" — is derived from that, not invented afterward.

Before writing any code, the plan was to actually look at `dealership_data.json`: 5 branches, 30 reps, ~510 leads with full `status_history`, 160 deliveries, monthly targets. Two things fall out of a first pass over the data that shape everything else:

- Leads take a **median of ~38 days** from first touch to delivery. Any KPI that ignores this (e.g. "December conversion rate") will report a number that is technically correct and substantively misleading — recent cohorts look artificially terrible because they haven't had time to mature.
- Monthly targets sum to **1,426 units** against **160 delivered over 7 months network-wide** — attainment tops out around 15%. That is a calibration problem with the targets, not a performance problem with the branches, and the product needs to say so rather than paint every branch red.

These two findings are why "port the analytics before building any UI" became rule #1 of the plan, not just a nice-to-have — the judgment calls about *what a metric means* have to be settled and tested before they're wrapped in a chart, or the UI will bake in a wrong number.

## 2. Decide what NOT to build

Given the assignment explicitly says auth doesn't matter and either backend-or-client-JSON is fine, the early decisions were:

- **No backend database.** ~510 leads is small enough that a pure in-memory analytics pass over the JSON, computed server-side and memoized per filter key, is faster and simpler than standing up Postgres for a take-home. This is stated as a design decision, not a shortcut.
- **The AI layer computes nothing.** An LLM must never be asked to do arithmetic on this dataset — priority scores, z-test anomalies, and revenue-at-risk are pure functions over the analytics engine. AI is reserved for **language**: turning already-computed numbers into an executive brief, a why-explanation, a natural-language Q&A surface. This single decision protects every other number in the product from hallucination.
- **Authentication, multi-tenant, real CRM writes** — explicitly out of scope per the brief. Contact/Assign/Escalate actions were planned as honestly-labeled optimistic local state ("this is a prototype, no CRM write"), not stubbed-but-silent fakes.

## 3. Plan the pipeline before the pixels

The architecture was designed top-down as a single directed pipeline, so that every screen is a *read* off one source of truth and never computes its own numbers:

```
dealership_data.json
  → buildModel()            typed domain model, dates parsed, joins resolved
  → analytics functions      funnel, aging, targets, reps, deliveries, trends, sources
  → insight engine           anomaly detection (z-test), priority scoring, recommendations
  → AI presentation layer    executive brief, summaries, why-explanations, question router
  → UI (Server Components)
```

`analyze(model, filters)` was planned as the single entry point every screen reads from — one context object holding KPIs, funnel, aging, delivery, trend, targets, branch rows, rep rows, sources, lost reasons, the action queue, and anomalies. This was the single most important interface decision: get it wrong and every screen re-derives its own version of "conversion," which is exactly how the two disagreeing headline numbers problem happens.

## 4. Build order (and why this order)

1. **Port the analytics engine to TypeScript first, with tests green before any UI exists.** The reference `analytics.js` (pure functions, no DOM) and its 58-assertion test suite were treated as the domain-model spec, not a prototype to redesign. Splitting it into `lib/domain`, `lib/analytics/*`, `lib/insights/*`, `lib/ai/*` was planned up front so each concern (model, math, anomaly detection, language generation) stays independently testable. **Gate: 58/58 tests passing before touching a component.** Building UI against unverified analytics would mean debugging two layers of uncertainty at once.
2. **Build the shell** — sidebar, top bar, routing, URL-persisted filters (range/branch/rep), loading and error states. Filters live in the URL so views are shareable and survive reload; everything else (modal open/closed, toasts, sort state) is ephemeral client state.
3. **Overview screen, in a deliberate order**: AI brief → KPI row → monthly trend → branch table → funnel overview → AI insights. Narrative before numbers — the brief should be readable and directionally correct in ten seconds, because that is the CEO's actual attention budget.
4. **Branch Detail, then Rep Scorecard** — planned second because they share components (bar + baseline-marker comparison, KPI cards) with Overview, so building them together avoids duplicating that work.
5. **Action Center** — the screen that turns analytics into work: priority-scored queue, filters, CSV export. This was prioritized ahead of Funnel Diagnostics because "at least one actionable insight" is a minimum requirement in the brief, and a queue a manager can actually act on is the clearest way to satisfy it.
6. **Funnel Diagnostics** — deeper diagnostic view (stage-by-stage z-test comparison, bottleneck durations, lead-source quality) for users who want to go one level past the Overview's funnel summary.
7. **Overlays** — Ask DealerPulse, Why? explanations, the lead drawer, toasts. These were sequenced after the primary screens exist because every overlay's CTA routes into one of them (no insight is a dead end).
8. **Responsive + accessibility pass** — reflow at 1024px/1440px, keyboard traversal, focus visibility, contrast — done as an explicit pass rather than assumed to fall out of the component work, because the brief scores "Design & UX" at 25%.
9. **About screen written last**, once the code exists to describe accurately — it's the credibility screen; every claim on it has to be checkable against the actual analytics.

## 5. Plan for the AI layer as an addition, not a dependency

Because the core product (KPIs, drill-down, action queue) works with zero LLM calls, AI was planned as a **layered, optional enhancement** with a graceful degradation path: a fully deterministic rule-based question router as the floor, an in-process Gemini call as a richer middle tier, and an optional separate agent service as the top tier for a more open-ended natural-language experience — each falling back to the one below it if unavailable. The plan was explicit that no tier should ever be allowed to compute a number the analytics engine didn't already produce.

## 6. Mapping the plan to the brief's evaluation criteria

| Criteria (weight) | How the plan addresses it |
|---|---|
| Product Thinking (30%) | Data explored before build; matured-cohort conversion and target-calibration findings drove KPI design; Action Center exists specifically to satisfy "actionable insight" |
| Design & UX (25%) | Explicit responsive + accessibility pass as its own build step; narrative-first Overview ordering; honest empty/loading/error states planned per screen, not generic |
| Technical Quality (25%) | Analytics ported and test-gated before UI; single `analyze()` entry point prevents metric drift; no DB needed at this data scale, stated as a decision |
| Insight & Storytelling (20%) | AI executive brief and why-explanations planned as the first thing a CEO sees, in plain language, always traceable back to a computed number |

## 7. What was deliberately deferred (see `ARCHITECTURE.md` and `app/DECISIONS.md`)

Persistent (non-in-memory) storage for AI observability/feedback, a full screen-reader accessibility pass, and a production deployment path for the optional `ai-service` were all explicitly named as "next" rather than silently dropped — see `app/DECISIONS.md` for the as-shipped version of this list. (A golden-dataset eval harness for AI answer quality was originally deferred too, then built in a later pass — `app/evals/` — see §8 below.)
