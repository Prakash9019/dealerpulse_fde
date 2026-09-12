# DECISIONS

## What was built

A Next.js (App Router) + TypeScript + Tailwind + Recharts implementation of the DealerPulse
design handoff: all 7 screens (Overview, Branches, Branch Detail, Rep Scorecard, Action Center,
Funnel Diagnostics, About), the full AI layer (Executive Brief, Why? explanations, branch/rep
summaries, recommendations, anomaly detection, Ask DealerPulse), and the interaction set
(lead drawer, toast feedback, CSV export, keyboard shortcuts, empty/loading states).

`logic/analytics.js` was ported to TypeScript first, before any UI, split into the 17 files the
handoff's README specified (`lib/domain`, `lib/analytics`, `lib/insights`, `lib/ai`,
`lib/export`), with the 58 ported assertions from `analytics.test.js` passing before a single
component was written. That ordering caught nothing — the port was correct on the first pass —
but it meant every screen built afterward was reading from analytics already proven right, so no
screen-level bug was ever actually an analytics bug in disguise.

## Key product decisions

- **Action Center reads the network-wide analytics context once and filters client-side.**
  The test suite proves priority scores are stable under branch/rep filtering (`analyze()` with
  a `branchId` produces the same score for a lead as the unfiltered network view). That
  invariant meant the branch/rep/stage/age/min-value filter bar and sort could all be plain
  client-side array operations on one server-fetched payload, instead of a server round-trip per
  filter change — simpler and faster, and correct only because the underlying scoring is provably
  filter-invariant.
- **KPI evidence (Why?) and Ask DealerPulse are server-computed, not shipped to the client.**
  Both are Route Handlers (`/api/why`, `/api/ask`) that call `analyze()` server-side and return
  the already-computed explanation. The alternative — bundling the whole analytics/insights/AI
  layer into client JS so the modal could compute locally — would have meant shipping ~500 leads
  of data and a non-trivial amount of logic to the browser for a feature that's really just "ask
  the server a question." The route handlers keep the client bundle to presentation only.
- **Contact / Assign / Escalate are optimistic local state, not a backend write**, matching the
  design handoff's own framing exactly ("This is a prototype — no CRM write"). The assignment
  says not to build a backend for this, so the honest choice was to say so in the UI rather than
  fake persistence.
- **The rep filter for Action Center only lists Sales Officers.** Branch Managers carry no
  personal lead book in this dataset (confirmed by the Rep Scorecard's own empty state), so
  including them in a "which rep should I assign this to" picker would be misleading.

## Trade-offs

- **Design tokens were translated from the handoff's exact `oklch()` values into Tailwind v4
  `@theme` variables**, but the handoff's inline-CSS shimmer/skeleton states were simplified to a
  single reusable `.dp-shimmer` class rather than a bespoke skeleton per screen — the loading
  states that exist (Why? modal, Ask DealerPulse, lead drawer) all share it.
- **The lead drawer, Why? modal, and Ask DealerPulse fetch on open rather than being
  pre-rendered**, which costs a network round-trip (visible as the shimmer) but keeps every page
  load fast — none of the three overlays' data is needed until a user opens them.
- **Funnel Diagnostics' scope selector (Network / Branch / Rep) is implemented as its own
  component with its own URL params (`scope`, `scopeId`)** rather than reusing the top bar's
  global branch selector, because the handoff explicitly separates "the branch I'm filtering the
  whole app to" from "the entity I'm comparing in this one diagnostic view."

## What I'd build next with more time

- A real accessibility pass with a screen reader, beyond the semantic table/dialog/aria-* markup
  already in place — I verified keyboard focus and `aria-pressed`/`aria-expanded` states visually
  but didn't test with actual assistive tech.
- A `/branches/[id]/reps/[id]` style breadcrumb instead of the current flat back-link, once there
  are more than two levels of drill-down to track.
- A dedicated, custom-styled `<input type="date">` for the range picker (currently the browser's
  native date input) to match the rest of the UI's pixel-level control styling.

All three "Known gaps" the handoff's README flagged are now closed: the custom date-range picker
(`?range=custom&from=...&to=...`, backed by `resolveRange()`'s existing `{from, to}` support), the
global rep filter in the top bar (scoped to the selected branch, sales officers only — managers
carry no personal lead book), and a visual review at 1024px across all 9 screens (no page-level
horizontal scroll anywhere; tables scroll internally via their own `overflow-x:auto` wrapper,
exactly as designed). One deliberate deviation from the handoff's literal spec: the sidebar
collapses on Tailwind's standard `lg` breakpoint (1024px) rather than a bespoke 1120px JS resize
listener — simpler, and the handoff itself says to prefer the target codebase's own conventions
over the prototype's inline-styled implementation details.

## Differentiation layer (open-ended space)

Built on top of the (unchanged) rule-based analytics engine rather than replacing it:

- **Lead/funnel/comparative/anomaly intelligence**: discrete lead risk labels + Last Activity
  column, a genuine cross-branch/cross-rep funnel-leak finder, three new Compare modes
  (branch/rep-vs-network, rep-vs-branch), and impact-ranked anomaly flood control.
- **Gemini, two ways**: a server-only, function-calling integration lives directly in the Next.js
  app (`lib/ai/gemini/`) *and*, separately, an optional FastAPI + LangGraph service
  (`ai-service/`) that never duplicates analytics — its tools are HTTP calls back into
  `/api/tools/execute`, which runs the exact same validated tool functions. The Next.js app tries
  `AI_SERVICE_URL` first if set, then its own in-process Gemini path, then the original
  deterministic `askDealerPulse` — any layer being down or unconfigured degrades to the next one
  rather than breaking the dashboard.
- **RAG, honestly scoped**: three real markdown reference documents (escalation SOP, metrics
  glossary, anomaly methodology) retrieved by actual Gemini-embedding cosine similarity — not
  keyword matching, and not applied to KPI questions, which stay on the tool-calling path per the
  "RAG for documents, deterministic analytics for numbers" principle.
- **Exports**: a real formatted PDF (pdfkit) and multi-sheet XLSX (exceljs) — not a dashboard
  screenshot — plus a `/weekly` executive summary screen, all built from one shared
  `buildExecutiveReport()` so the PDF, XLSX, and on-screen view can never drift from each other.
- **Guardrails and observability**: per-IP rate limiting, timeouts with one retry, schema-validated
  structured output with a fallback, an in-memory (session-scoped, no PII) call log surfaced at
  the unlinked `/ai-health` route, and a Helpful/Not Helpful/Report Incorrect feedback control on
  every AI answer.
- **What I'd build next here**: persistent (not in-memory) observability and feedback storage;
  a real eval harness with a golden dataset (today's Python tests only prove the guardrails/
  fallback logic, plus three live-Gemini checks that skip without a key — they don't yet measure
  answer quality against known-good answers); PII/prompt-injection red-teaming beyond the one
  informal check in `ai-service/tests/test_live_gemini.py`.

## Interesting patterns in the data

- **Conversion excluding immature cohorts is load-bearing, not cosmetic**: December's raw
  cohort conversion looks like a collapse (1%) purely because those leads haven't had time to
  close — the actual story (delivery momentum is strong) is invisible without the maturity
  window, and the two "opposite" findings sit right next to each other in the Executive Brief on
  purpose.
- **Lakeside Toyota's problem is upstream of anything a sales tactic can fix**: its New →
  Contacted rate (58%) is the leak, not test drive or negotiation — meaning the fix is a
  first-response SLA, not sales coaching, which is exactly the kind of thing a percentage-gap
  ranking (instead of leads-lost ranking) would have missed.
- **Target attainment tops out around 15% network-wide across every branch** — a uniform gap
  that size across an entire network is a calibration problem in how targets were set, not five
  independent performance problems, and the anomaly engine says so explicitly rather than
  quietly ranking branches against a target nobody could hit.
