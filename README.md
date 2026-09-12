# Handoff: DealerPulse — dealership performance intelligence

## Overview

DealerPulse is a real-time performance dashboard for a five-branch Toyota dealership network, built for two users: a CEO who needs to know whether the network is healthy and what to do about it, and a branch manager who needs the same answer at rep and lead level.

The product's organising principle is **DATA → INSIGHT → ACTION**. Every screen answers three questions in order: what is happening, why is it happening, what should I do next. No chart exists unless it changes a decision.

The dataset covers June–December 2025: 5 branches, 30 reps, 510 leads with full status histories, 160 deliveries with delay reasons, and 35 monthly branch targets. Every figure in the UI is computed from it. **The UI must display "Data as of 31 Dec 2025"** because that is the last event in the data, and all "days idle" arithmetic counts back from that date rather than from `Date.now()`.

---

## About the design files

Two categories of file in this bundle, and they are handed off differently.

### `design/` — design references, recreate them

`DealerPulse.dc.html` and `Analytics Tests.dc.html` are **prototypes written in HTML to show intended look and behaviour. They are not production code to copy.** Open them in a browser (serve the folder — they fetch `../data/dealership_data.json` relative to themselves) and use them as the visual and behavioural specification.

Your task is to **recreate these designs in the target environment** using its established patterns and libraries. The assignment brief names Next.js (App Router) + TypeScript + Tailwind + Recharts; if that is the target, build there. If a codebase already exists, follow its conventions over anything in these files — the HTML uses inline styles because of the tool that produced it, not as a recommendation.

### `logic/` — port this, don't redesign it

`analytics.js` is **not a prototype.** It is the domain model, analytics, insight engine and AI presentation layer as pure functions with no DOM dependency, and `analytics.test.js` holds 58 assertions that each recompute their expected value independently from the raw JSON. Port both to TypeScript largely as-is: add types, split the file along the boundaries marked below, keep the function signatures and the logic. Rewriting this from scratch means rediscovering the judgment calls documented in "Analytics decisions that matter" — and re-earning the bugs.

Run the test suite first. If it passes against your port, the port is correct.

## Fidelity

**High-fidelity.** Final colours, typography, spacing, density and interaction behaviour. Recreate the UI faithfully using the codebase's libraries. Exact token values are in "Design tokens" below.

---

## Architecture

```
data/dealership_data.json
  → buildModel()          typed domain model, dates parsed, joins resolved
  → analytics functions   funnel, aging, targets, reps, deliveries, trends, sources
  → insight engine        anomaly detection (z-tests), priority scoring, recommendations
  → AI presentation       executive brief, summaries, why-explanations, question router
  → UI
```

Suggested TypeScript split of `analytics.js` (section comments in the file mark each boundary):

| Target file | Exports from `analytics.js` |
|---|---|
| `lib/domain/model.ts` | `buildModel`, `STAGES`, `OPEN_STAGES`, `STAGE_LABEL`, `STAGE_WEIGHT`, `SOURCE_LABEL`, `STALE_DAYS`, `PRIORITY_TIERS` |
| `lib/format.ts` | `fmtINR`, `fmtCr`, `fmtPct`, `fmtNum`, `fmtDays`, `fmtDate`, `fmtSigned`, `plural` |
| `lib/analytics/funnel.ts` | `funnel`, `stageLeaks`, `conversion`, `maturedConversion` |
| `lib/analytics/aging.ts` | `aging`, `AGING_BUCKETS` |
| `lib/analytics/targets.ts` | `targetPerf` |
| `lib/analytics/reps.ts` | `repRows` |
| `lib/analytics/deliveries.ts` | `deliveryPerf` |
| `lib/analytics/trends.ts` | `monthlyTrend`, `sourcePerf`, `lostReasons` |
| `lib/analytics/context.ts` | `analyze`, `resolveRange`, `RANGE_PRESETS` |
| `lib/insights/priority.ts` | `priorityRaw`, `priorityRefs`, `priorityScore`, `actionQueue`, `leadReason` |
| `lib/insights/anomalies.ts` | `detectAnomalies`, `zProportion` |
| `lib/insights/recommendations.ts` | `buildRecommendations` |
| `lib/ai/executiveBrief.ts` | `executiveBrief` |
| `lib/ai/explanations.ts` | `whyExplanation`, `branchSummary`, `repSummary`, `leadExplanation` |
| `lib/ai/questionRouter.ts` | `askDealerPulse`, `SAMPLE_QUESTIONS` |
| `lib/export/csv.ts` | `actionsCsv` |

`analyze(model, filters)` is the single entry point every screen reads from. It returns one context object holding KPIs, funnel, aging, delivery, trend, targets, branch rows, rep rows, sources, lost reasons, stage durations, the action queue, anomalies and recommendations. Call it server-side, memoise on the filter key (`JSON.stringify(filters)`) — it costs a few ms on 510 leads, so no database is needed and none should be added.

### The AI layer is rules, not a model

No LLM is called anywhere. The brief, insights, recommendations, summaries, why-explanations and question answers are generated by rules over already-computed analytics. Keep it that way: an LLM must never be asked to do arithmetic, and if you later add one for phrasing, it must receive structured analytics results and never raw JSON. Questions the router cannot map return exactly `"I don't have enough data to answer that."` — do not replace that with a guess.

---

## Analytics decisions that matter

These are the load-bearing judgment calls. Preserve them or you will change what the product says.

**1. Conversion uses matured cohorts.** Leads take a median 38 days from first touch to delivery (`model.maturityDays`, computed, not hardcoded). December's raw cohort conversion is 1% purely because those leads are too young. The KPI therefore reports conversion over leads at least `maturityDays` old and states how many were excluded. When fewer than 10 matured leads exist in a window, `kpi.conversion` is `null` and `kpi.conversionNote` explains why — **render the null as "—" plus the note, never as 0%.**

**2. Stage leaks are ranked by leads lost, not percentage gap.** `stageLeaks()` sorts by `excessLoss = entrants × (baseline − actual)`. On the weakest branch the worst *percentage* gap is Test Drive → Negotiation (27 entrants) but the worst *business* leak is New → Contacted (~15 extra leads lost). Ranking by percentage picks the wrong problem.

**3. Target attainment is presented with rank and pace.** Targets total 1,426 units against 160 delivered — attainment tops out at 15% network-wide, so the targets are mis-calibrated, not the branches. Show attainment, but always beside its rank, the unit gap, and the most recent month's pace. An anomaly card states the calibration problem explicitly. Do not build incentives or forecasts on the raw number.

**4. Priority is normalised, not clamped.** `score = round(100 × raw / rawMax)` where `rawMax` is the strongest case in the whole open book. An earlier version clamped at 100 and 17 leads tied at the ceiling, making the queue unsortable exactly where it mattered. `rawMax` is computed over the unfiltered open book so a lead scores the same in a branch view as network-wide. Tiers: Critical ≥ 45, Needs Attention ≥ 22, Watch below.

**5. Stale means ≥ 8 days, and only 8.** `STALE_DAYS = 8` sits deliberately on the edge of the 8–14 aging bucket, so the headline count always equals the sum of the 8+, 15–30 and 30+ bucket rows. Every mention of the threshold in the UI interpolates the constant — there are no literal "8+ days" strings, because a hardcoded copy of a threshold is how the headline and its own evidence came to disagree twice during the build. **Keep the single source of truth.**

**6. Anomalies are discovered by z-test.** Branch, rep and stage flags come from a two-proportion z-test against the network baseline (`zProportion`). Nothing names a branch. A branch is Critical at z ≤ −2.5, Watch at ≤ −1.4, Healthy above +3 points of baseline. One test in the suite reassigns every lead's branch round-robin *within status* and asserts zero branch anomalies result — that is what proves the detector finds patterns rather than reciting them. Known sensitivity: a z ≥ 2 gate false-positives roughly 5% of the time per branch, so small branches will occasionally flag noise. Raising the gate or requiring a minimum sample trades that against missing real problems.

**7. Positive findings are surfaced too.** December's 73% delivery lift appears as an `opportunity` anomaly. The product tells both stories; the anomaly ordering is `critical → risk → watch → opportunity`.

**8. Two date semantics, deliberately.** Leads are filtered by `created_at` (cohort), revenue and units by `delivery_date` (recognition). Open pipeline is **not** date-filtered — it is present-tense, so narrowing the range never hides a stale lead. The About screen documents all three.

**9. One data repair.** Some `status_history` notes contain a broken template literal (`"comparing with {} competitor"`). `buildModel` replaces `{}` with `"a rival"` for display only. Do not mutate the source data.

---

## Screens

Layout shell for all screens: a fixed left sidebar (236px expanded / 62px collapsed, collapsing automatically under 1120px viewport width) beside a `flex:1` column containing a sticky top bar and a `max-width:1560px` main area with 24px padding. Cards sit in an 18px-gap vertical flex; card grids use `repeat(auto-fit, minmax(<min>px, 1fr))` so 4 columns become 2 then 1 without media queries.

### Sidebar
Brand mark (22px rounded square in accent, containing a 7px 45°-rotated square in the rail background colour) plus wordmark at 15px/600. Nav items: 2-letter monospace mark (16px column, 9.5px) + label at 13.5px/500, 9px×10px padding, 7px radius. Active item: background `oklch(0.265 0.012 200)`, label `oklch(0.96 0.004 85)`, mark in accent, `aria-current="page"`. Inactive label `oklch(0.70 0.008 80)`, hover background `oklch(0.245 0.008 75)`. Items: Overview, Branches, Action Center, Funnel, About. Footer block (11px, `oklch(0.58 0.008 80)`) lists dataset scope and active range under a 9.5px/0.08em monospace "DATASET" label. Collapse toggle at the bottom.

### Top bar
Sticky, `z-index:30`, background `oklch(0.178 0.006 75 / 0.92)` with `backdrop-filter: blur(8px)`, 1px bottom hairline, 12px×24px padding, wrapping flex. Contains: screen title (15px/600, −0.01em) with subtitle (11.5px, `oklch(0.62 0.008 80)`); the Ask trigger; range and branch `<select>`s (6px×8px, 7px radius, 12px, each with a 9.5px/0.06em monospace label); and a freshness chip — 6px green dot + "Data as of 31 Dec 2025" at 11.5px in a bordered pill.

**Ask trigger:** min-width 210px, accent-tinted border `oklch(0.34 0.03 200)` on background `oklch(0.215 0.012 200)`, holding a 12px 45°-rotated accent square, the text "Ask DealerPulse…", and a `/` keycap (9.5px monospace in a 4px-radius bordered box). Pressing `/` anywhere opens it; `Escape` closes it and any other overlay.

### 1. Overview (CEO screen)

Purpose: answer *are we healthy, what is wrong, where, how much does it matter, what do I do* within one screen. Order is deliberate — narrative before numbers.

**AI Executive Brief** (first element). Accent-bordered card, 12px radius, `linear-gradient(180deg, oklch(0.225 0.016 200), oklch(0.205 0.008 200))`, 20px×22px padding. Header row: 11px rotated accent square + "AI EXECUTIVE BRIEF" (10px/0.14em monospace, accent) + provenance line "· computed from the dataset, All time (Jun–Dec 2025)" (10.5px). Headline at 19px/500, 1.45 line-height, `max-width:78ch`, `text-wrap:pretty`. Then three clickable finding cards in an `auto-fit minmax(250px,1fr)` grid — each a 5px dot (green for momentum, amber for risk) + tag (MOMENTUM / RISK, 9.5px/0.08em monospace) + text at 12.5px/1.55, and each navigates to the screen that proves it. Footer above a 1px accent-tinted rule: "DO NEXT" label + recommended action, then a secondary "View problem" button and a primary "View actions" button (accent fill, `oklch(0.17 0.02 200)` text, 600 weight).

Live output: *"Dec '25 delivery momentum is strong, but Lakeside Toyota remains the largest performance gap and ₹8.07 Cr of pipeline has gone quiet."*

**KPI row.** Four cards, `auto-fit minmax(232px,1fr)`, 14px gap: Units Delivered, Revenue, Lead → Delivery Conversion, Revenue At Risk. Each: label 11.5px/500 `oklch(0.68 0.008 80)`; a "Why?" pill top-right (2px×7px, 20px radius, accent-tinted border, 10px); value in 27px/500 JetBrains Mono at −0.02em; a delta chip beside it (11.5px/600, `▲`/`▼`, green when the direction is good, red when not — inverted for delay-type metrics); and a sub-line at 11px/1.5 carrying the comparison or the caveat. Revenue At Risk renders its value in amber `oklch(0.86 0.11 78)`.

**Monthly performance.** Combo chart, 210px tall with 22px top padding. Units are CSS-height bars (4px top radius, last month highlighted `oklch(0.62 0.075 200)` against `oklch(0.44 0.045 200)`); revenue is an SVG polyline (`viewBox="0 0 1000 200"`, `preserveAspectRatio="none"`, 2px accent stroke, `vector-effect:non-scaling-stroke`) overlaid absolutely, with per-month 7px dots positioned by `bottom:%`; the monthly target is a 1px dashed horizontal rule per column. Legend uses a swatch, a line and a dashed line. Axis strip below the chart: units in 13px mono, month label at 10.5px, revenue at 9.5px mono. Each bar carries a `title` with units, revenue, target and delayed count. **In Recharts this is a `ComposedChart` — `Bar` for units on the left axis, `Line` for revenue on the right, `ReferenceLine` per month for target.**

**Branch performance.** Table, `min-width:940px` inside `overflow-x:auto`, with the branch column `position:sticky; left:0`. Columns: BRANCH (name 12.5px + "city · manager" 10.5px, preceded by a 3px status accent bar), LEADS, CONVERSION, UNITS, REVENUE, TARGET (attainment + rank in 10px), AT RISK, STATUS pill. Headers 10px/600 at 0.08em, `oklch(0.6 0.008 80)`, right-aligned except the first, each with a `title` explaining the metric. Rows are clickable and keyboard-focusable (`tabIndex="0"`, Enter activates) and hover to `oklch(0.245 0.008 75)`. The critical branch gets a tinted row background `oklch(0.222 0.014 27)` — a tint and a pill, not a red row. A sort `<select>` sits in the header; a footnote below the table explains the conversion exclusion and why attainment is shown with rank.

**Funnel overview.** Six labelled rows (New → Delivered), each a 9px bar whose width is share-of-top, with count and "conversion · median days" right-aligned in mono. The largest drop-off stage is filled amber and captioned "Largest drop-off: N leads did not progress". Below: a button into Funnel Diagnostics.

**AI Insights.** Collapsible cards, one per detected anomaly, sorted by severity. Each has a 2px left border in its severity colour, a severity chip (9px/0.08em monospace), the anomaly type, a `+`/`−` affordance with `aria-expanded`, and a title at 12.5px/500. Expanded: a 4-up evidence grid on a recessed `oklch(0.175 0.006 75)` panel (10px label, 12.5px mono value, 9.5px note), the explanation at 12px/1.6, an "IMPACT" line, and a routing CTA.

### 2. Branches (list)

Network baseline strip (4 cards: conversion, units, revenue, revenue at risk) above one large clickable card per branch, ranked by conversion. Each card: rank, name, city · manager, status pill, conversion at 17px mono, and the signed delta versus network. Below that a 10px comparison bar — the branch's conversion filled, with a 1px white vertical marker at the network baseline position (this marker pattern recurs throughout the product and is worth building as one component). Then a 7-metric stat row (leads, units, revenue, pipeline, stale, target, delay rate) and a "BIGGEST LEAK" line naming the stage and both rates.

### 3. Branch Detail — `/branches/[branchId]`

Header bar: back button, branch name at 17px/600, "city · Manager X · Conversion rank N of 5", status pill, active range.

Seven KPI cards (`minmax(205px,1fr)`, 23px mono values): Leads, Conversion, Units, Revenue, Target attainment, Pipeline value, Stale leads. Cards carrying a "Why?" pill are flagged by `hasWhy`.

**Performance vs network** — six metrics (conversion, new→contacted, test-drive progression, negotiation→order, delivery delay rate, median order→delivery) each as a bar plus white network marker, with a signed delta coloured by whether the direction is good. Delay-type metrics invert: lower is better.

**Branch funnel** — per stage, a 9px branch bar above a 3px network-shape bar. Stages where `excessLoss ≥ 3` and the gap is ≤ −8 points fill red and caption "Below baseline · ~N extra leads lost here". This highlighting is automatic.

**Rep performance** — sticky-first-column table (rep + role, leads, conversion, orders, delivered, pipeline, stale, rank), rows clickable through to the scorecard. Conversion is tinted red below 60% of the branch average and green above 120%.

**Lost reason analysis** — horizontal bars by reason with count and value, plus a "LOST FROM STAGE" summary row.

**Lead aging** — a 12px segmented bar of the whole open book, then five bucket rows (0–3, 4–7, 8–14, 15–30, 30+) with bars coloured by tone (blue / amber / red), counts and values.

**AI Branch Summary** — accent card with three panels (GOING WELL green label, WHAT IS WRONG amber, OPPORTUNITY accent) plus a "DO NEXT" footer and two routing CTAs.

Empty states: "No leads assigned at this branch in the selected range.", "No lost leads recorded in this range.", "No open leads at this branch — nothing ageing."

### 4. Rep Scorecard — `/reps/[repId]`

Header with back-to-branch, name, "role · branch · Joined 25 Sep 2024", plus buttons to that rep's action queue and funnel. Six KPIs (leads handled, lead → delivery, orders, delivered, pipeline value, stale leads); conversion tints red below 70% of branch average, green above 120%.

AI Rep Summary sits high on this screen (before the charts) with a 15px headline and STRENGTH / RISK / DO NEXT panels. It only states patterns the data supports — e.g. *"Conversion is 4.5%, below the 9.8% branch average; the widest gap is at Contacted → Test Drive (30.0% vs branch 58.7%); 12 of 22 assigned leads have no recorded contact event."*

**Funnel performance** — three stacked bars per stage: rep 9px, branch 3px, network 3px, with all three rates in the row header.
**Stage cycle time** — median days for the five transitions, bar plus white network marker, filled amber when the rep exceeds 1.35× the network median.
**Open pipeline** — table (customer, model, stage, deal value, days idle, priority), rows opening the lead drawer.

Managers carry no personal lead book in this dataset, so the empty state says so explicitly rather than showing zeros.

### 5. Action Center — the screen that turns analytics into work

Three clickable tier tiles (Critical / Needs Attention / Watch), each showing count at 27px mono, aggregate value, and the cutoff as its hint; clicking toggles that tier as a filter (`aria-pressed`).

**AI Recommended Actions** — accent card. A 16px headline naming the single highest-impact batch: *"Start with the 24 order-placed leads worth ₹5.54 Cr combined that have been inactive for more than 30 days — the revenue is already committed, only fulfilment is missing."* Then one card per recommendation with a horizon chip (Today / This week / This month / Next quarter), the problem, a 4-up evidence grid, an IMPACT line, the action, and a routing CTA.

**Queue table** — `min-width:1180px`, sticky customer column. Filter bar: branch, rep (dependent on branch), stage, age bucket, minimum deal value, plus a conditional "Clear filters" button, a sort select (priority / deal value / days idle) and Export CSV. A count line reads "Showing N of M open leads · ₹X Cr in scope".

Columns: CUSTOMER (name + lead id in 9.5px mono, preceded by a 3px tier accent bar), MODEL, BRANCH / REP, STAGE pill, DEAL VALUE, IDLE, PRIORITY (13.5px mono), REASON, ACTION. The reason cell carries the generated explanation plus an underlined "Why is this high priority?" link opening the drawer. The action cell holds Contact / Assign / Escalate buttons — Escalate is red-tinted — and shows a green "Assigned" / "Contacted" / "Escalated" pill once used.

Two distinct empty states: "No leads match these filters. Clear a filter to widen the queue." versus "No stale leads in this scope — nothing to chase."

CSV: 12 columns (Lead ID, Customer, Model, Branch, Rep, Stage, Deal Value, Days Idle, Priority, Tier, Reason, Suggested Action), quoted with doubled inner quotes, exported as `dealerpulse-actions.csv`.

### 6. Funnel Diagnostics

A scope `<select>` (Network baseline / any branch / any rep) with a live count of how many stages deviate beyond two standard errors.

**Stage list** — per stage: label, a flag chip when |z| ≥ 2 and n ≥ 10 ("BELOW BASELINE · z −4.4" red, "ABOVE BASELINE" green), count, "conversion / network net", "median · p90", a 14px bar, the network-shape bar when comparing, and a caption "N did not progress · M marked lost from the previous stage". The entrant stage suppresses these metrics and reads "Every lead enters here — 510 in all time" instead of a row of em dashes.

**AI Funnel Explanation** — accent card, 15.5px, naming the largest network leakage and how the selected entity compares.

**Stage bottlenecks** — the five transitions ranked by median duration, each with a bar and a sentence: *"Negotiation → Order Placed is taking 8.2d at the median, with 37 of 235 leads not progressing."*

**Lead source quality** — conversion bar per source, green at or above baseline, red below 60% of it, with leads → delivered, revenue and contact rate.

**Delivery operations** — headline stats (count, delayed, rate, median, p90) and a bar per recorded delay reason with count and share.

### 7. About

Not filler — it is the credibility screen. A definition list covering data-as-of, conversion, revenue, revenue at risk, priority score, status flags, target attainment and the AI layer, plus an architecture block and a link to the test suite. An evaluator reading this screen can check every claim the product makes.

---

## Interactions & behaviour

**Routing and URL-persisted filters.** Hash routing: `#/overview`, `#/branches`, `#/branches/B3`, `#/reps/SR16`, `#/actions`, `#/funnel`, `#/about`, with query params `range`, `branch`, `rep`, `a` (anchor), `tier`, `scope` — e.g. `#/branches/B3?range=quarter`. In Next.js App Router this becomes real routes plus `searchParams`: `/branches/B3?from=2025-10-01&to=2025-12-31&branch=B3`. Filters must survive reload and be shareable. `hashchange` is listened to so browser back/forward work.

Every CTA in the product carries a `route` object (`{screen, branchId, repId, tier, anchor}`) rather than a string, so navigation targets are data. A CTA landing on Action Center pre-applies its tier or branch filter. A CTA landing on Funnel Diagnostics pre-selects its scope. **No insight is a dead end.**

**Overlays.** Ask DealerPulse is a top-anchored modal (max-width 720px) over a `oklch(0.12 0.006 75 / 0.72)` scrim with `backdrop-filter: blur(3px)`: input row, then INTERPRETED AS → answer → evidence rows → CTA, then a chip row of nine sample questions. Why? is a centred 480px modal listing bulleted point/value pairs plus a CTA. The lead drawer slides from the right (max-width 460px, full height, scrollable, sticky header): AI explanation with priority score, a 2×2 fact grid, priority drivers as left-bordered blocks, full status history with dates and notes, and links to the rep and branch. All three are `role="dialog" aria-modal="true"` and close on `Escape`.

**Feedback.** Contact / Assign / Escalate write to local state and raise a bottom-centred toast (`role="status" aria-live="polite"`) that self-dismisses after 2.6s. The toast copy is honest about the prototype: "Assigned · L0022 logged. This is a prototype — no CRM write." Wire these to real mutations when a backend exists.

**States.** Loading is a shimmer skeleton matching the real layout (`@keyframes dpShim`, 1.4s ease-in-out, opacity .35→.7) with `aria-busy` and a status line — not a spinner. Error is a bordered red-tinted panel with the message and a Retry button. Empty and no-results states are written per context and always say what it means rather than "No data".

**Animation is restrained.** One entry transition (`@keyframes dpIn`, 0.28s ease-out, 6px rise + fade) on screen change, plus colour transitions on hover. Nothing loops, nothing bounces.

**Responsive.** Target 1440px desktop, support 1024px tablet. Sidebar auto-collapses to 62px under 1120px viewport width (JS resize listener rather than media queries, because the shell is inline-styled — use media queries or container queries in the real build). KPI grids reflow 4 → 2 → 1 via `auto-fit minmax()`. Every table is wrapped in `overflow-x:auto` with a sticky first column. Not mobile-first; must not break.

**Accessibility.** Semantic `<table>`/`<thead>`/`<th scope>`, `<nav aria-label>`, `<dl>` on About, `aria-current` on nav, `aria-expanded` on disclosures, `aria-pressed` on filter toggles, `aria-label` on every icon-only or select control, `title` tooltips on unfamiliar metric headers, and a visible focus ring (`:focus-visible`, 2px accent, 2px offset). Clickable table rows are keyboard-reachable and Enter-activated. All body text meets 4.5:1 on its background; `oklch(0.6 0.008 80)` on `oklch(0.212 0.006 75)` is the lightest pairing used and is reserved for secondary labels at 11px+.

---

## State management

| State | Purpose |
|---|---|
| `loading`, `error` | dataset fetch lifecycle |
| `route` | `{screen, branchId, repId, anchor}` — from the URL |
| `filters` | `{range, branchId, repId}` — from the URL, drives `analyze()` |
| `ask` | `{open, q, res}` — question, answer object |
| `why` | KPI key of the open explanation, or null |
| `lead` | lead id of the open drawer, or null |
| `toast` | transient message |
| `done` | `{leadId: 'Assigned'\|'Contacted'\|'Escalated'}` — optimistic action state |
| `openInsights` | expanded anomaly ids |
| `act` | Action Center filters + sort |
| `branchSort` | Overview table sort key |
| `funScope`, `funScopeId` | Funnel Diagnostics comparison target |
| `wide`, `railOpen` | sidebar collapse |

`route` and `filters` belong in the URL. Everything else is ephemeral UI state. In Next.js, `analyze()` runs server-side per request and the returned context is passed to client components; only the overlay and filter state needs to live client-side.

Data fetching: one static JSON read. Load it server-side, memoise the model and the analysis by filter key. No database.

---

## Design tokens

Colours are authored in `oklch()`; hex equivalents are approximate sRGB for token files that need them. The ground is a warm near-black (hue 75, chroma 0.006–0.008) — subtly warm rather than blue-grey, which keeps long reading sessions comfortable and lets the cyan accent read as the only cool element on screen.

### Surfaces
| Token | oklch | ≈ hex | Use |
|---|---|---|---|
| `bg/app` | `oklch(0.165 0.006 75)` | `#1a1714` | Page background |
| `bg/rail` | `oklch(0.192 0.006 75)` | `#211d19` | Sidebar, table headers |
| `bg/card` | `oklch(0.212 0.006 75)` | `#26221d` | Card surfaces |
| `bg/raised` | `oklch(0.235 0.006 75)` | `#2c2722` | Secondary buttons |
| `bg/recessed` | `oklch(0.175 0.006 75)` | `#1c1916` | Evidence panels inside cards |
| `bg/hover` | `oklch(0.245 0.008 75)` | `#2f2a24` | Row and nav hover |
| `bg/topbar` | `oklch(0.178 0.006 75 / 0.92)` | — | Sticky bar, with 8px blur |
| `bg/scrim` | `oklch(0.12 0.006 75 / 0.72)` | — | Modal backdrop, 3px blur |

### Lines & ink
| Token | oklch | ≈ hex |
|---|---|---|
| `line/hairline` | `oklch(0.285 0.008 75)` | `#3a342d` |
| `line/row` | `oklch(0.25 0.008 75)` | `#322d27` |
| `line/strong` | `oklch(0.38 0.008 75)` | `#4f4840` |
| `ink/primary` | `oklch(0.965 0.004 85)` | `#f6f3f0` |
| `ink/secondary` | `oklch(0.8 0.006 82)` | `#c8c2bb` |
| `ink/tertiary` | `oklch(0.68 0.008 80)` | `#a49d95` |
| `ink/muted` | `oklch(0.6 0.008 80)` | `#8b847c` |
| `ink/faint` | `oklch(0.54 0.008 80)` | `#786f68` |

### Semantic
| Token | oklch | ≈ hex | Meaning |
|---|---|---|---|
| `accent` | `oklch(0.79 0.10 200)` | `#4fc9dd` | Interactive, informational, AI |
| `accent/hover` | `oklch(0.88 0.08 200)` | `#87e0ef` | |
| `accent/fill-text` | `oklch(0.17 0.02 200)` | `#101d21` | Text on accent buttons |
| `accent/tint-bg` | `oklch(0.24 0.02 200)` | `#28312f` | AI card buttons |
| `accent/tint-border` | `oklch(0.34 0.03 200)` | `#3d4b4d` | AI card borders |
| `critical` | `oklch(0.66 0.17 27)` | `#e05c3d` | |
| `critical/bg` `critical/fg` | `oklch(0.30 0.06 27)` `oklch(0.88 0.09 27)` | `#4a2b23` `#ffb9a5` | Chips |
| `warning` | `oklch(0.80 0.13 78)` | `#e0a441` | |
| `warning/bg` `warning/fg` | `oklch(0.30 0.05 78)` `oklch(0.90 0.09 78)` | `#443421` `#f5cf8e` | |
| `healthy` | `oklch(0.75 0.13 152)` | `#4fc98c` | |
| `healthy/bg` `healthy/fg` | `oklch(0.28 0.05 152)` `oklch(0.86 0.10 152)` | `#1f3a2c` `#96e6bb` | |
| `neutral/bg` `neutral/fg` | `oklch(0.27 0.006 75)` `oklch(0.82 0.006 82)` | `#363029` `#cdc7c0` | Watch tier |
| `bar/track` | `oklch(0.25 0.008 75)` | `#322d27` | Bar backgrounds |
| `bar/fill` | `oklch(0.55 0.06 200)` | `#5a9aa8` | Default data bar |
| `bar/fill-emphasis` | `oklch(0.62 0.075 200)` | `#6bb3c4` | Latest period |
| `bar/fill-recessive` | `oklch(0.44 0.045 200)` | `#477785` | Prior periods |
| `bar/baseline-marker` | `oklch(0.85 0.006 82)` | `#d7d1ca` | 1px network marker |
| `row/critical-tint` | `oklch(0.222 0.014 27)` | `#2e211d` | Critical table row |

Red is used only for genuine risk — never for a whole row background, never as a page accent.

### Typography
Instrument Sans (400/500/600/700) for all UI text; JetBrains Mono (400/500/600) for every number, id, code label and letterspaced micro-label. `font-variant-numeric: tabular-nums` on `body` so columns align. Load from Google Fonts with `preconnect`; substitute the codebase's own faces if it has them.

| Role | Size / weight / tracking |
|---|---|
| Screen title | 15px / 600 / −0.01em |
| Detail page title | 17px / 600 / −0.01em |
| Brief headline | 19px / 500 / −0.01em / 1.45 |
| AI card headline | 15–16px / 500 / 1.5 |
| Section heading | 13.5px / 600 |
| KPI value (mono) | 27px / 500 / −0.02em |
| Secondary KPI value (mono) | 23px / 500 |
| Body | 12.5px / 400 / 1.55 |
| Table cell | 12.5px (mono for numerics) |
| Table header | 10px / 600 / 0.08em / uppercase |
| Micro-label (mono) | 9.5–10px / 0.08–0.14em / uppercase |
| Caption | 10.5–11px / 1.5 |

`text-wrap: pretty` on every prose block; `max-width` in `ch` (74–92ch) on long copy.

### Spacing, radius, shadow
Spacing steps 2 / 4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 22 / 24 / 32px. Radius: 4px chips, 6px small buttons, 7px controls, 8–9px inner cards, 10px cards, 11–13px AI cards, 20px pills, 50% dots, 3px bars. Shadows only on floating surfaces: `0 24px 60px oklch(0.08 0.006 75 / 0.7)` (modal), `-20px 0 50px oklch(0.08 0.006 75 / 0.6)` (drawer), `0 12px 30px oklch(0.08 0.006 75 / 0.6)` (toast). Cards use hairline borders, no shadow.

### Chart conventions
Bars are CSS divs with `%` widths/heights — only the revenue trend needs SVG. Baselines are always a 1px `bar/baseline-marker` vertical rule at the baseline's proportional position; comparison shapes are always a 3px bar beneath the 9px primary bar. Bars colour by meaning, never by index: default blue, amber for slow or warning, red for statistically below baseline, green for above.

---

## AI visual language

One recognisable mark: a 10–13px square rotated 45° with 2px radius, filled in `accent`. It appears beside every AI-generated block and nowhere else. Section labels are monospace, 9.5–10px, 0.14em tracking, uppercase, in `accent`: AI EXECUTIVE BRIEF, AI INSIGHTS, AI BRANCH SUMMARY, AI REP SUMMARY, AI RECOMMENDED ACTIONS, AI FUNNEL EXPLANATION, AI LEAD EXPLANATION. AI cards get the accent gradient and accent border; nothing else in the product does.

No sparkles, no glow, no animated typing, no chat bubbles. The AI reads as an embedded analyst, not a toy — and because it never states a figure the analytics layer didn't compute, it earns being trusted.

---

## Assets

None. No image files, no icon library, no illustrations. Every visual element is CSS or text: the brand mark and AI mark are rotated squares, indicators are dots and rules, charts are divs plus one SVG polyline. Nav uses 2-letter monospace marks (OV / BR / AC / FN / AB) rather than icons — **if the target codebase has an icon set, substitute real icons here.** The two fonts are the only external dependency.

---

## Files in this bundle

```
design_handoff_dealerpulse/
├── README.md                      this document
├── design/
│   ├── DealerPulse.dc.html        the full application prototype — design reference
│   └── Analytics Tests.dc.html    test runner UI, 58 assertions
├── logic/
│   ├── analytics.js               port this: model, analytics, insights, AI layer
│   └── analytics.test.js          port this: the assertions that prove the port
└── data/
    └── dealership_data.json       source dataset, unmodified
```

To view the prototypes, serve the folder over HTTP (the pages fetch `../data/dealership_data.json`) and open `design/DealerPulse.dc.html`. Opening from `file://` will fail on the fetch.

## Suggested build order

1. Port `analytics.js` to TypeScript with the file split above; port `analytics.test.js`; get 58/58 green. **Do this before any UI.**
2. Build the shell — sidebar, top bar, routing, URL-persisted filters, loading and error states.
3. Overview, in the documented order. Review information hierarchy before moving on: the brief should be readable in ten seconds.
4. Branch Detail, then Rep Scorecard (they share the bar-plus-baseline-marker and KPI-card components).
5. Action Center, including CSV and the filter set.
6. Funnel Diagnostics.
7. Overlays: Ask, Why, lead drawer, toast.
8. Responsive pass at 1440 and 1024. Accessibility pass: keyboard-only traversal of every screen, focus visibility, contrast.
9. About — write it last, from what the code actually does.

## Known gaps

- **Custom date range** — presets are All time / Last 30 days / Last quarter / December 2025. `resolveRange()` already accepts `{from, to}` for a custom window; only the picker UI is missing.
- **Global rep filter** — the top bar exposes range and branch. Rep filtering works on Action Center and via `?rep=SR16`, but is not in the global bar.
- **Search** — merged into Ask DealerPulse rather than a separate field. Split them if the target expects a distinct entity search.
- **Tablet at 1024px** — the layout is fluid and reflows by construction but has not been visually reviewed at that width.
