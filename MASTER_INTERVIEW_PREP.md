# DealerPulse — Master Interview Prep (Verified Against Actual Code)
*Read this one last, right before the interview. It consolidates `INTERVIEW_DATA_ANALYSIS.md` (raw data patterns) and `GAP_ANALYSIS_VS_REFERENCE.md` (comparison with the other candidate's app), and adds everything needed to answer "how exactly does that work" follow-ups without hesitation.*

## 0. What this file is, and what changed

You pasted a ChatGPT-written interview-prep doc. I did not take it on faith — I opened the actual source files it referenced (`domain/model.ts`, `analytics/context.ts`, `insights/priority.ts`, `insights/riskLabel.ts`, `insights/recommendations.ts`, `analytics/reps.ts`, `analytics/targets.ts`, `analytics/trends.ts`, `insights/forecast.ts`, `domain/dataQuality.ts`) and checked every specific number and formula it claimed. **Verdict: it's accurate.** Every threshold, constant, and formula it cited matches the code exactly, including two I expected might be simplified or wrong:
- Branch status thresholds: `z ≤ -2.5 → critical`, `z ≤ -1.4 → watch`, `convVsNetwork > 3pts → healthy`, else `onTrack` — this is the **literal line of code** in `analytics/context.ts` (currently line 212 — line numbers here shift as the file changes; the condition itself is what to know cold, not the line number).
- Network-wide target sum = exactly **1,426 units** — I summed `target_units` across all 35 rows in the raw JSON myself and got 1,426, matching both the ChatGPT doc and the reference app's forecast page.

One nuance the ChatGPT doc blurred that you should keep separate in your head (Section 4 below explains why): **there are two different threshold systems**, not one — a branch-card status pill (`critical/watch/healthy/onTrack`) and a separate anomaly-detection severity system (`critical/risk/watch/opportunity`) that feeds the AI Insights list. They use different z-score cutoffs because they answer different questions. Don't conflate them if asked.

---

## 1. The one sentence to open with, and the one to fall back on if you blank

**Opening line:** *"Before I touched the UI, I treated this as a business-analysis problem — I profiled the lead lifecycle, the funnel, lead aging, delivery delays, branch/rep variation, lead sources, and target calibration, and only then designed screens around the decisions a CEO actually needs to make."*

**Fallback anchor, if you get flustered:** *"I didn't start from the charts; I started from the decisions the CEO needs to make. I profiled the lead lifecycle, identified cohort maturity, funnel leakage, stale pipeline, branch/rep deviation, target calibration, source quality, and delivery bottlenecks — then built deterministic analytics around those patterns and designed each screen to move from metric → evidence → insight → action."*

---

## 2. THE TABLE — Pattern → Business Problem → Calculation → Visualization → CEO Action

This is the exact five-column framework you asked for. Every row is a real, verified finding from `dealership_data.json`.

| # | Pattern found | Business problem it represents | How it's calculated (exact) | Why visualized this way | What the CEO actually does |
|---|---|---|---|---|---|
| 1 | Network funnel loses ~20–25% at every stage (510→391→300→235→198→160) | No single network bottleneck — the story is branch-specific, hidden by the average | `funnel()` in `analytics/funnel.ts`: counts leads that reached each stage at least once (`s in l.stageAt`), `convFromPrev = count[i]/count[i-1]` | Sequential stage bars, because the decision is "where does the sequence break," which needs order preserved, not a pie/bar-by-category | Don't chase a network-wide "fix the funnel" initiative — drill into branches first |
| 2 | Lakeside's New→Contacted is 58.2% vs 76.7–82.5% everywhere else | First-response failure, not a closing-skill problem — 42% of new leads never even get contacted | Same `funnel()` per branch, then `stageLeaks()` ranks by **excess leads lost** = `n × (networkRate − branchRate)`, not raw % gap | Branch bar + a network-baseline marker on the same chart, so "is 58% actually bad?" is answered visually instead of requiring mental math | Enforce a same-day contact SLA at Lakeside and re-route unworked new leads (literally the text `recommendations.ts` generates) |
| 3 | 91 leads reached Contacted but never Test Drive → **0 of them delivered** (verified: exactly 0/91) | Test drive is a hard gate, not a soft stage — leads that skip it have zero realistic chance of closing | `lib/insights/testDriveGate.ts`: leads with `contacted` in stage-set but not `test_drive`, filtered to `status === 'delivered'` for the "delivered despite the gate" count | **Now visualized as its own headline stat** — `TestDriveGateCard` on Funnel (per-branch ₹ breakdown) plus a `critical`/`risk` anomaly card on Overview once `neverTestDriven ≥ 15`. This was the single sharpest insight the reference app had that we didn't; closed in the gap-analysis follow-up pass (see Gap Analysis §3, now marked ✅). | Prioritize getting stalled-at-Contacted leads into a test drive over any other intervention — it's the actual gate, not negotiation skill |
| 4 | Target attainment tops out ~15% network-wide, uniform across all 5 branches (network target = 1,426 units; delivered = 160) | Not five branches failing independently — a calibration problem in how targets were set | `targetPerf()` sums `target_units` vs. delivered units in range; the `target-calibration` anomaly fires when `Math.max(...allAtt) < 0.35` across every branch | Attainment shown with **rank + pace**, never a bare %, specifically because a raw % would wrongly imply branches are underperforming an achievable bar | Don't use current targets for incentives/PIPs — re-baseline them first; use branch *rank* for relative performance conversations instead |
| 5 | Recent (Dec) leads show artificially low conversion because they haven't had time to close | Cohort immaturity, not a real performance drop | `maturityDays = median(time from created_at to delivered)` ≈ 38 days; `maturedConversion()` excludes leads younger than that window; UI shows `—` when `matured.n < 10` | A dash (`—`) with an explanatory note, not `0%` — because 0% asserts "we measured failure," while `—` correctly asserts "not enough mature data yet" | Don't panic-react to a bad December number; wait for the cohort to mature before judging it |
| 6 | 24–39 open leads idle 8+ days, several idle 176–195 days, mostly at Order Placed | Committed revenue (order already placed) sitting unmanaged — cancellation risk | `aging()` buckets by `idleDays` (0–3 / 4–7 / 8–14 / 15–30 / 30+, `STALE_DAYS=8` constant); `revenueAtRisk = sum(dealValue of stale leads)` | Turned into a priority-ranked **queue**, not a chart — because the decision is "which lead do I work next," which a bar chart can't answer | Work the Action Center queue top-down: assign an owner, confirm delivery date, log a touch today |
| 7 | Lead source conversion ranges 13.9% (social media) to 45.7% (walk-in), 3.3× gap on comparable volume (72 vs 140 leads) | Marketing spend is being allocated inefficiently across channels | `sourcePerf()` computes conversion/contact-rate/revenue per source; the `source-quality` anomaly requires both sources to have ≥25 leads and a ≥15-point conversion gap before firing | Side-by-side bars gated by a minimum-volume filter — deliberately **not** shown for tiny-sample sources, to avoid a lucky/unlucky small sample looking like a trend | Shift budget/qualification effort toward walk-in-like channels; don't eliminate a channel on revenue-per-lead alone (no CAC data exists to prove ROI) |
| 8 | 72 of 160 deliveries (45%) carry a delay reason; median 17–18 days, p90 ~28 days | Fulfilment/logistics problem, separate from sales performance | `deliveryPerf()` computes `delayRate`, `median`/`p90` of `days_to_deliver`, and a ranked list of `delay_reason` counts | **Median AND p90 shown together**, not just an average — because a handful of 35–40 day outliers would distort a mean, and the manager needs both "typical" and "worst realistic case" | Attack the single top recorded cause (e.g. "customer requested date change") with a named owner and a weekly clearance target |
| 9 | Rep conversion spans 4.5% (Venkat Mishra) to 57.1% (Priya Choudhury); the 5 worst-revenue reps are **all at Lakeside** | Distinguishes a branch-process problem from an individual-skill problem | `repRows()` ranks by `conversion` then `delivered` (network-wide and per-branch); anomaly requires `leads ≥ 10` and `z ≤ -2.6` vs. network baseline | Rep table shows **branch + branch-rank alongside network-rank**, so "5 worst reps, same branch" is visible without cross-referencing two screens | Don't put all 5 Lakeside reps on individual PIPs — fix the branch's lead-routing/first-response process first, then re-evaluate individuals |
| 10 | Priority scoring combines value × idle time × funnel stage × risk flags into one 1–100 score | A CEO doesn't want 5 separate signals to mentally combine — they want one ranked worklist | `priorityRaw = valueF × idleF × stageF × riskF` (log-scaled idle factor, stage weights 0.25→1.0 from New→Order Placed, risk multipliers for overdue/weak-branch/30+ days idle), then normalized 1–100 against the **strongest currently-open case** (`rawMax`), so scores stay stable under filtering | A single ranked table with tier badges (Critical ≥45 / Attention 22–44 / Watch <22 — `PRIORITY_TIERS` constants), not four separate charts | Work Critical tier first; each row has Contact/Assign/Escalate actions built in |
| 11 | Data quality: 100% field completeness except 14 lost leads with no `lost_reason` | Absence of data is itself meaningful and must not be hidden or defaulted away | `checkDataQuality()` explicitly checks 7 issue types (duplicate IDs, missing customer name, missing/invalid deal value, unknown branch, unknown rep, invalid stage, future-dated); severity computed as `flagged/total > 2% → significant` | Surfaced on the About screen as an explicit caveat, and threaded into the AI system prompt so the AI doesn't make overconfident claims over compromised rows | Treat unlabeled lost-reasons as their own "Not recorded" bucket in any breakdown — never silently drop them from a denominator |
| 12 | Pipeline forecast: 62 open leads (₹15.2 Cr) project to **+45.1 additional units** against a 1,426-unit target — a −1,220.9 unit gap | "Will we hit target based on what's already in the pipeline?" | `stageDeliveryRates()`: for each open stage, what fraction of **matured** leads that ever reached that stage were eventually delivered; `forecastPipeline()` sums each open lead's stage-specific historical odds (linearity of expectation — no simulation) | Presented as one forward-looking number tied to the target, not a probability distribution — because the CEO question is "will we hit target," a yes/no-adjacent number, not a distribution | Confirms the target-calibration finding (#4) independently — even optimistic pipeline conversion can't close a gap this large, so the target itself needs revisiting, not just pipeline hustle |

---

## 3. Exact constants and formulas (memorize these — they're what a sharp interviewer drills into)

| Constant / formula | Value | File |
|---|---|---|
| `STALE_DAYS` | 8 days | `domain/model.ts:33` |
| `PRIORITY_TIERS` | critical ≥ 45, attention 22–44, watch < 22 | `domain/model.ts:16` |
| `MAX_ANOMALIES` | 6 shown by default (rest in overflow, never hidden permanently) | `domain/model.ts:21` |
| `STAGE_WEIGHT` (priority stage factor) | new 0.25, contacted 0.35, test_drive 0.55, negotiation 0.8, order_placed 1.0 | `domain/model.ts:24` |
| Maturity window | ≈38 days = **median** time from `created_at` to `delivered` across all delivered leads — computed from data, never hardcoded | `domain/model.ts:168` |
| `MIN_RATED_LEADS` (added after the reference-app comparison pass) | 10 — the floor below which a branch/rep conversion rate renders as "Not rated"/"—" instead of a number a thin sample could swing by 10+ points; used in `BranchCard.tsx`, `RepLeaderboardTable.tsx`, the rep scorecard page, `explanations.ts`, and the rep-anomaly gate below | `domain/model.ts:40` |
| Matured-conversion display floor | needs `matured.n ≥ 10` (a separate literal `10`, not `MIN_RATED_LEADS` — this one gates the network/branch *KPI*, not a rep row) or shows `—` | `analytics/context.ts:225` |
| Branch status pill thresholds | `z ≤ -2.5` critical, `z ≤ -1.4` watch, `convVsNetwork > 0.03` healthy, else onTrack | `analytics/context.ts:212` |
| Branch/rep anomaly-card thresholds (different system — see §4) | branch: needs `maturedN ≥ 20` and `\|z\| ≥ 2` (then `z ≤ -3` = critical severity, else risk); rep: needs `leads ≥ MIN_RATED_LEADS` (10) and `z ≤ -2.6` | `insights/anomalies.ts` |
| `stageLeaks()` minimum sample | `n ≥ 8` before a stage-leak is ranked at all | `analytics/funnel.ts:54` |
| Source-quality anomaly gate | both sources need `leads ≥ 25`, gap must be `≥ 15 points` | `insights/anomalies.ts:187` |
| Delivery-delay anomaly gate | needs `count ≥ 15` deliveries and `delayRate ≥ 0.35` | `insights/anomalies.ts:165` |
| Target-calibration anomaly gate | fires when `max(all branch attainments) < 0.35` | `insights/anomalies.ts:209` |
| Test-drive gate anomaly | fires when `neverTestDriven ≥ 15`; severity `critical` if zero delivered despite the gate, else `risk` | `insights/anomalies.ts:66` |
| Risk label (per-lead) | new (<8d idle) → inactive (8–14d) → at-risk (15–30d) → stale (31–59d) → critical (60d+); `high-value-stale` overrides any idle≥8d bucket if deal value ≥ 75th percentile of the *current open book* | `insights/riskLabel.ts` |
| Priority formula | `raw = valueF × idleF × stageF × riskF`, then `score = round(raw / rawMax × 100)`, clamped 1–100, where `rawMax` = the strongest case in the *currently open* book (so scores are stable under filtering, no fixed ceiling) | `insights/priority.ts` |
| Network target sum | **1,426 units** (verified: `sum(target_units)` across all 35 branch-month rows) | raw JSON |
| Forecast method | `P(eventually delivered \| reached stage X)` computed only over matured leads, applied to each currently-open lead by its current stage, summed (linearity of expectation) — not a simulation, not an LLM guess | `insights/forecast.ts` |
| `zProportion` (the one stats formula everything else reuses) | two-proportion z-test: `(x/n − p0) / sqrt(p0(1−p0)/n)` — "statistically unusual vs. baseline," never causal | `domain/model.ts:71` |

---

## 4. The nuance to get right if asked "so what's the threshold for X being a problem?"

There are genuinely **two separate systems** computing "is this branch bad," and conflating them will make you sound like you memorized a script rather than understood the code:

1. **The status pill** on branch cards (`critical` / `watch` / `healthy` / `onTrack`) — a per-branch label always shown, computed purely from that branch's own z-score and conversion delta. This answers "how do I color-code this specific branch right now."
2. **The anomaly detector** (`detectAnomalies()`) — a separate, higher-bar system (needs `maturedN ≥ 20`, `|z| ≥ 2`) that decides whether a branch's deviation is worth generating a whole **explanatory card** for (with evidence, the specific weakest stage, and a CTA), capped at 6 shown by default. This answers "what's actually worth interrupting the CEO about."

**Why two systems, if asked:** a status pill needs to update for *every* branch on every view (cheap, always-on classification). An anomaly card is expensive to justify — it makes a specific, falsifiable claim with evidence, so it needs a higher, sample-size-gated bar before it's allowed to interrupt the executive brief. Using the same threshold for both would either make every branch look "critical" on the pill (too noisy) or would make the anomaly feed too sparse to be useful (too quiet).

---

## 5. Screen-by-screen: what's on each tab, and *why it's placed there* (not just what it shows)

### Overview (`/`)
**Why this screen exists:** the CEO's 10-second read. Design intent (from `DECISIONS.md`) is that the executive brief must be readable in ten seconds — this screen is deliberately *not* where every detail lives.
**What's on it, in order, and why that order:** AI Executive Brief (plain-English top line) → 4 KPI cards (units, revenue, conversion, revenue-at-risk) → Monthly trend chart → Network Health Matrix (5-branch grid) → Funnel overview → AI Insights list (anomaly cards, capped at 6). That's literally "what happened → is it healthy → where → what should I do about it" in reading order — the DATA→INSIGHT→ACTION philosophy expressed as vertical layout, not just a slogan.
**Why KPI conversion sometimes shows `—`:** see maturity-window logic above — it's not a bug, it's the matured-cohort floor (`n≥10`) protecting against a misleading number.

### Branches (`/branches`) → Branch Detail (`/branches/[branchId]`)
**Why it's the first drill-down level:** once the CEO sees "Lakeside is critical" on Overview, the next natural question is "why, specifically, is this branch different" — not yet "which person." Branch Detail shows: KPIs for that branch, performance vs. network baseline (bar + marker, not isolated bars), that branch's own funnel, its reps ranked *within* the branch, lost-reason breakdown, lead aging, and an AI summary.
**Why rank-within-branch matters:** it's what makes "all 5 worst-revenue reps are at Lakeside" visible without manually cross-referencing a flat network leaderboard — the branch-scoping is a deliberate information-hierarchy choice, not incidental.

### Reps (`/reps`) → Rep Scorecard (`/reps/[repId]`)
**Why this is the second drill-down level, not the first:** after "which branch," the question becomes "is this a people problem within that branch, or literally everyone." Rank is shown both network-wide and branch-relative for exactly that reason.
**Ranking key, exactly:** conversion rate first, total delivered units as tiebreaker (`analytics/reps.ts`, the `rows.sort()` call) — **this is a real, acknowledged gap** vs. the reference app, which ranks by revenue-per-lead instead (see `GAP_ANALYSIS_VS_REFERENCE.md` §2). If asked "why conversion rate and not revenue," the honest answer is: *"That's actually a real gap I found comparing against another submission — revenue-per-lead is a better primary sort because it accounts for deal-value differences between reps selling different models. Conversion rate treats a ₹5L Glanza sale and a ₹50L Fortuner sale as identical, which understates the value some reps are actually creating."* Saying this proactively is far stronger than being asked and not having noticed.

### Action Center (`/actions`)
**Why it's a workflow, not another chart:** the assignment explicitly requires "at least one actionable insight, not just another chart" — this screen is the direct answer. It's a priority-ranked queue (Critical/Attention/Watch tiers, `PRIORITY_TIERS`), each row has Contact/Assign/Escalate buttons (optimistic local UI state — deliberately not faking backend persistence, since there's no CRM write-back and pretending otherwise would be dishonest about what was built).
**Why filter by time/branch/rep here too:** so a branch manager can get *their own* worklist, not just the CEO's network-wide one — same screen, different scope, no separate "manager view" needed.

### Funnel Diagnostics (`/funnel`)
**Why it's a separate top-level tab and not folded into Overview:** the funnel is too central to the whole product's thesis (DATA→INSIGHT→ACTION starts with funnel structure) to be a secondary section. Overview gives the *high-level* funnel; this screen gives stage-by-stage conversion, network-baseline comparison, z-scores, median/p90 dwell times, lost-from-stage counts, source quality, delivery ops, and a what-if calculator.
**Why the what-if calculator specifically:** it answers a forward-looking question ("if we improve New→Contacted by 10 points, what's the revenue impact") using the *same* stage-delivery-rate math as the pipeline forecast — not a separate guess, so the number is internally consistent with the rest of the app.
**Why source quality and delivery ops are sub-sections here, not their own tabs:** this is actually the flip side of a real gap — the reference app gives Sources and Deliveries their own first-level tabs, which is arguably better information architecture for a manager who wants to jump straight to "how's fulfilment doing" without opening Funnel first (see Gap Analysis §5).

### Demand (`/models`) — added after comparing against a reference submission
**Why it exists:** the assignment dataset has a `model_interested` field nothing else screen-groups by. Ranking by leads alone misleads — a model can be a large share of the lead book and a small share of delivered revenue, or the reverse. The headline callout states the widest such gap explicitly (e.g. "Glanza is 25% of leads but 10% of delivered revenue"), gated on a minimum lead share so a one-lead model can't win the callout on a fluke.
**Why it's scoped by the range/branch/rep filters like everything else:** unlike Leads (below), this is a performance-analysis screen, not a browse-everything screen — it should answer "what's demand doing in this window," so it respects the same filters as Branches/Reps/Funnel.

### Leads (`/leads`) — added after comparing against a reference submission
**Why it exists:** Action Center is a priority-ranked *worklist* of open leads — deliberately not a place to browse a lost or delivered lead. This screen is the "show me everything" self-serve complement: all leads regardless of outcome, with cohort quick-filters (Never contacted / No test drive / Stuck orders / Cold 7+ days / Open / Lost / Delivered) and sortable Age/Idle columns.
**Why it ignores the time-range filter:** same reasoning as the aging/revenue-at-risk pipeline elsewhere in the product — a present-tense "which leads exist and what state are they in" view shouldn't let a manager accidentally hide a lead by picking a shorter window. It stays branch/rep-scoped, just not time-boxed.
**Why clicking a row opens the same `LeadDrawer` as Action Center:** consistency — one lead-detail surface for the whole app. The one adjustment: a delivered or lost lead gets a different headline than an open one (no priority score, since "how urgently should I work this" is meaningless for a closed lead) — see `leadExplanation()` in `lib/ai/explanations.ts`.

### Compare (`/compare`)
**Why it exists beyond the assignment minimum:** answers "is my branch/rep actually behind, or just different" side-by-side (branch vs branch, rep vs rep, either vs network, rep vs branch) — a genuinely distinct interaction from the ranked tables on Branches/Reps, and a direct implementation of the assignment's suggested "Comparative analytics" differentiator.

**Note on Weekly / Docs / About — removed in a later pass:** these three were cut as standalone nav tabs. None were requested by `ASSIGNMENT.md`, and a CEO dashboard whose whole premise is "understand everything at a glance" shouldn't itself take longer to navigate than the data does to read. Weekly mostly re-rendered Overview's own numbers in a forwardable shape; About and Docs were methodology/reference pages, not decisions a CEO acts on. The capabilities they were built on didn't disappear: `buildExecutiveReport()` still powers PDF/XLSX export from the Overview page's export buttons, and `lib/rag/corpus.ts` still backs Ask DealerPulse's retrieval for policy/process questions (e.g. "what's the escalation process for a stale order?") — deliberately *not* used for KPI questions, which route through the same `analyze()` context every screen uses, so a KPI answer is never a hallucinated number. If asked about this directly: *"I originally built Weekly/Docs/About as extra surface area, then cut them once I looked at the assignment again and realized none of them were requested and they were competing with the dashboard's own 'glance value' — a CEO shouldn't need nine tabs to understand five branches. The export and retrieval underneath them stayed; I just stopped giving each one its own permanent nav slot."*

---

## 6. Rapid-fire Q&A (say these, don't read them — they should sound like your own understanding)

**"What patterns did you observe?"**
"Cohort immaturity in recent months, a branch-specific first-contact failure at Lakeside rather than a closing-skill problem, network-wide target miscalibration rather than five independent failures, a meaningful stale/idle pipeline concentrated at Order Placed, a 3.3× lead-source efficiency gap, and a 45% delivery delay rate that's operationally separate from sales. I only compared entities — branches, reps, sources — once they cleared a minimum sample size, so small-sample noise never gets reported as a finding."

**"How did you find where the funnel breaks?"**
"Not by looking for the smallest percentage — that would let a tiny, noisy stage outrank a much larger real leak. I rank by *excess leads lost*: sample size at that stage times the gap between that entity's conversion and the network baseline. That's what correctly points at Lakeside's New→Contacted stage instead of a smaller, coincidentally-worse-looking stage elsewhere."

**"How do you handle missing or absent data?"**
"Two different cases, handled two different ways. First, absence of enough *time* — recent leads haven't matured — shown as `—`, never a misleading 0%, gated on at least 10 matured leads. Second, absence of a *field* — like 14 lost leads with no recorded reason — is surfaced as its own bucket by the data-quality checker and threaded into the AI's context so it never overclaims certainty over incomplete rows."

**"Why this chart type instead of another?"**
"I chose visualization by the decision it needs to support, not by what looked good. KPI cards for a single fast-scan number. A line chart for trend, because trend is inherently about direction over time. Bars-plus-baseline for branch comparison, because the real question isn't the raw value, it's 'relative to what.' A table for the Action Center, because the decision there is 'which of many individual records do I act on next,' which a chart can't represent. Horizontal bars for delay reasons, because the decision is ranking discrete causes."

**"Did you discover these patterns yourself, or did the framework do it?"**
"I profiled the supplied dataset directly, translated what I found into deterministic analytics functions, and validated those with a test suite before any screen was built — analytics came before UI specifically so no screen-level decision could hide a wrong number underneath it."

**"Why not let the AI compute the numbers?"**
"Because an LLM asked to do arithmetic will occasionally get it wrong, silently, with no way to catch it at test time. Every number on screen comes from a pure, tested function. The AI layer only explains or summarizes numbers that already exist — it can be wrong about phrasing, never about a metric."

**"What would you build next?"**
"Revenue-per-lead as the primary ranking metric on Branches/Reps/Sources, instead of conversion rate — it's the one gap from the reference-app comparison I deliberately held back rather than rushing (see `GAP_ANALYSIS_VS_REFERENCE.md` §8, item 1). The other gaps that comparison surfaced — the test-drive absolute-gate finding, a dedicated Demand page, and a raw filterable Leads table — are already closed, all computable from data already in the model with no new fields."

---

## 7. If they show you the other candidate's app (or ask "how does yours compare")

Don't get defensive — lead with what you found, since proactively naming your own gaps reads as stronger than being caught by them. One paragraph: *"I actually pulled up a comparable submission on the same dataset to stress-test my own choices. The biggest remaining difference is their default lens is rupees-per-lead everywhere, while mine leans on conversion percentage — theirs is a sharper CEO-facing number because it accounts for deal-value differences a percentage hides; that's the one gap I've deliberately held back rather than rushed, since re-ranking three screens by a new primary metric is a bigger call than the rest of the list. I did close the others I found: they had one killer finding I wasn't surfacing explicitly — zero of the 91 leads that got contacted but never test-driven ever delivered, test drive is a hard gate, not just another stage — so I added that as its own critical anomaly and a dedicated card on the Funnel page, plus a Demand page and a raw filterable Leads table they had that I didn't. On the other hand, my app has real coverage they don't: a side-by-side Compare mode and a full AI Q&A layer that's RAG-backed for policy questions and deterministic-analytics-backed for numbers, with a three-tier fallback — neither exists in their app. I also went back and cut three tabs I'd added — Weekly, Docs, About — once I re-read the assignment and realized they weren't asked for and were working against the 'CEO glance' premise; the PDF/XLSX export and the RAG retrieval those tabs were built on stayed, just folded back into Overview and Ask DealerPulse instead of getting their own permanent nav slot."* Full detail in `GAP_ANALYSIS_VS_REFERENCE.md`.

---

## 8. Last check before you walk in

You should be able to say, cold, without looking anything up:
- The maturity window (~38 days) and why raw December conversion is misleading without it.
- Lakeside's exact leak (58.2% New→Contacted vs. 76.7–82.5% elsewhere) and why the fix is a contact SLA, not sales coaching.
- Why funnel leaks are ranked by excess leads lost, not raw percentage gap (the "small sample, large percentage" trap).
- The difference between the branch status pill thresholds and the anomaly-card thresholds (§4) — don't blur these into one number if pressed.
- One thing you'd fix first if given another day: making revenue-per-lead the primary ranking metric on Branches/Reps/Sources — the one gap from the reference-app comparison deliberately held back rather than rushed (the test-drive absolute-gate insight, Demand page, and Leads table from that same comparison are already built).

If you can say those five things without hesitation, you can handle almost any follow-up they throw at you — the rest is detail you can look up in these three files together (`INTERVIEW_DATA_ANALYSIS.md`, `GAP_ANALYSIS_VS_REFERENCE.md`, this one) if genuinely asked something you don't remember cold. Saying *"let me think about that specifically"* and reasoning from the DATA→INSIGHT→ACTION framework out loud is a fine answer — it's more credible than a rehearsed line that doesn't quite fit the question.
