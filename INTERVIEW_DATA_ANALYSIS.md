# DealerPulse — Complete Data Analysis & Dashboard Walkthrough
*(Interview prep notes — written to be read start to finish: first the raw data, then the patterns found in it, then how the CEO dashboard represents each one.)*

> **Update:** every number and mechanism in this file has since been directly verified against the actual source code (`domain/model.ts`, `analytics/context.ts`, `insights/priority.ts`, `insights/riskLabel.ts`, `insights/recommendations.ts`, `analytics/reps.ts`, `analytics/targets.ts`, `domain/dataQuality.ts`) — nothing here is inferred from the UI alone. For the exact formulas, thresholds, and constants behind every metric (so you can answer a "how exactly is that calculated" follow-up), plus a consolidated pattern → problem → calculation → visualization → action table and a full screen-by-screen "why is this here" walkthrough, see **`MASTER_INTERVIEW_PREP.md`** — read that one last, right before the interview.

---

## PART 1 — Understanding the Dataset (`app/data/dealership_data.json`)

### 1.1 What it physically is
A single JSON file, ~20,600 lines, with 5 top-level sections:

| Section | Count | What it represents |
|---|---|---|
| `metadata` | 1 object | Generation info — synthetic data, date range June–Dec 2025 |
| `branches` | 5 | Toyota dealership branches across 4 cities |
| `sales_reps` | 30 | 5 branch managers + 25 sales officers |
| `leads` | 510 | Every customer inquiry, with a full stage-by-stage `status_history` |
| `targets` | 35 | Monthly unit + revenue target per branch (5 branches × 7 months) |
| `deliveries` | 160 | One row per lead that actually reached "delivered", with order date, delivery date, delay reason |

### 1.2 The branches
| Branch | City |
|---|---|
| Downtown Toyota | Chennai |
| Highway Toyota | Chennai |
| Lakeside Toyota | Bangalore |
| Central Toyota | Hyderabad |
| Eastside Toyota | Mumbai |

### 1.3 The funnel every lead moves through
`new → contacted → test_drive → negotiation → order_placed → delivered`
...or it exits early as `lost` (with a `lost_reason`) at any point. The `status_history` array is the ground truth — it's a timestamped log of every stage transition, so nothing about a lead's journey has to be guessed; it's reconstructed from real transition events.

### 1.4 How I actually analyzed it
Not by eyeballing the JSON — I wrote small Node scripts that loaded the file and computed real aggregates directly from the raw records (counts, ratios, medians, distributions), then cross-checked those numbers against what the app's analytics code (`app/src/lib/analytics/*`, `app/src/lib/insights/*`) computes, to confirm the dashboard's math matches the raw data rather than being a plausible-looking guess. Every number below came out of that process — nothing here is an assumption.

---

## PART 2 — Patterns Found in the Raw Data (with real examples)

### Pattern 1 — Overall funnel health
Reached-stage counts, network-wide:
```
new: 510 → contacted: 391 (77%) → test_drive: 300 (77%) → negotiation: 235 (78%) → order_placed: 198 (84%) → delivered: 160 (81%)
```
Every stage loses roughly 20–25% of leads. **No single network-wide bottleneck** — each stage bleeds a similar amount. That itself is a finding: the story isn't "the funnel is broken," it's "something branch-specific is broken; the network average is hiding it."

### Pattern 2 — Branch performance is NOT uniform (this is the headline finding)

| Branch | Total leads | Delivered | Conversion | Revenue delivered (₹) |
|---|---|---|---|---|
| **Eastside Toyota** (Mumbai) | 127 | 47 | **37.0%** | **₹11.43 Cr** — highest revenue |
| Downtown Toyota (Chennai) | 97 | 40 | **41.2%** — highest conversion rate | ₹10.23 Cr |
| Highway Toyota (Chennai) | 109 | 36 | 33.0% | ₹8.68 Cr |
| Central Toyota (Hyderabad) | 98 | 31 | 31.6% | ₹7.47 Cr |
| **Lakeside Toyota** (Bangalore) | 79 | 6 | **7.6%** — lowest by far | **₹1.07 Cr** — lowest by far |

Downtown has the best *rate*; Eastside has the most *volume and revenue* (it also has the most leads, 127, so it has more chances to convert). Lakeside is the clear outlier on every axis at once — 4 branches cluster between 31–41% conversion, and Lakeside sits at 7.6%. That's not "one branch slightly behind," that's "one branch fundamentally broken."

### Pattern 3 — WHY Lakeside is broken (the specific example an interviewer will want)
Reached-stage funnel for Lakeside only:
```
new: 79 → contacted: 46 (58.2%) → test_drive: 27 (58.7%) → negotiation: 14 (51.9%) → order_placed: 10 (71.4%) → delivered: 6 (60%)
```
Compare New→Contacted at other branches: 82–91%. Lakeside is 58.2%. **42% of Lakeside's leads never even get a first contact.** That's the single biggest leak in the entire dataset, and it happens at the very top of the funnel — before a customer ever sets foot in a showroom. A second, smaller leak also exists at Test Drive→Negotiation (51.9% vs ~75–78% elsewhere).

**Why this matters for the diagnosis:** if you only looked at "conversion rate," you'd conclude Lakeside's sales team is bad at closing deals. But the leak is upstream — leads aren't being contacted. That means the fix isn't sales coaching or negotiation training, it's a **first-response SLA** (e.g., "every new lead must be contacted within 24 hours") — a completely different, cheaper, faster fix than retraining a sales team.

### Pattern 4 — It's a branch problem, not an individual-rep problem
The 5 sales reps with the *lowest revenue delivered* are:
| Rep | Branch | Units delivered | Revenue |
|---|---|---|---|
| Sanjay Rao | Lakeside | 2 | ₹64.2L |
| Kavitha Joshi | Lakeside | 1 | ₹12.4L |
| Vikram Patel | Lakeside | 1 | ₹11.6L |
| Venkat Mishra | Lakeside | 1 | ₹10.1L |
| Revathi Pandey | Lakeside | 1 | ₹8.4L |

**All five worst performers work at the same branch.** If this were an individual coaching problem, you'd expect bad reps scattered across branches. Every single one being at Lakeside is strong evidence the problem is the branch's process (lead routing, response workflow, management), not the people in it.

### Pattern 5 — Best individual performers (the other end of the spectrum)
By conversion rate (min. 10 leads handled, to rule out small-sample luck):
| Rep | Branch | Leads | Conversion |
|---|---|---|---|
| **Priya Choudhury** | Downtown | 14 | **57.1%** |
| Suresh Nair | (varies) | 22 | 50.0% |
| Sanjay Kulkarni | Eastside | 25 | 48.0% |

By total revenue delivered (volume, not just rate):
| Rep | Branch | Units | Revenue |
|---|---|---|---|
| **Sanjay Kulkarni** | Eastside | 12 | **₹2.98 Cr — highest of anyone** |
| Priya Choudhury | Downtown | 8 | ₹2.83 Cr |
| Manoj Choudhury | Eastside | 10 | ₹2.65 Cr |

Notice the two "best rep" lists disagree slightly — Priya has the best *rate*, Sanjay Kulkarni delivers the most *money*. That's a real product decision the dashboard has to make: rank reps by rate (fair to reps with few leads) or by volume (fair to the business)? DealerPulse's Rep Scorecard shows **both**, rather than picking one and hiding the other.

### Pattern 6 — Lead source quality varies 3.3×
| Source | Leads | Contact rate | Conversion |
|---|---|---|---|
| **Walk-in** | 140 | 85.7% | **45.7% — best** |
| Auto expo | 43 | 76.7% | 30.2% |
| Referral | 83 | 74.7% | 30.1% |
| Website | 100 | 74.0% | 28.0% |
| Phone enquiry | 72 | 73.6% | 27.8% |
| **Social media** | 72 | 68.1% | **13.9% — worst** |

Walk-in customers convert more than 3× better than social-media leads, on comparable volume. That's a marketing-spend reallocation insight sitting directly in the raw data — money spent driving social-media leads is producing far fewer sales per lead than the same spend would if it drove walk-ins or referrals.

### Pattern 7 — Delivery operations has its own, separate problem
- 160 total deliveries; **72 of them (45%) carried a recorded delay reason.**
- Top causes: "customer requested date change" (18), "vehicle allocation delayed from factory" (11), "logistics delay in transit" (11), "finance disbursement pending" (9), "accessory fitment backlog" (10), "RTO registration delay" (7), "PDI rework required" (6).
- Median order-to-delivery: 18 days. Range: 7–39 days.

This is an **operations/logistics** story, not a sales story — it happens *after* a deal is already won, so it can't be fixed by better selling. It needs its own diagnosis surface, separate from the sales funnel.

### Pattern 8 — The single sharpest "hidden" finding: stuck orders
38 leads are sitting at status `order_placed` with **zero matching row in the `deliveries` table** — meaning the customer said yes, put down an order, and then... nothing recorded since. Several of these have had **no activity for 176–195 days** (roughly 6 months).

Why this is the best example to bring up in an interview: a naive dashboard that only shows "% converted" or a funnel bar chart would never surface this, because these leads are neither "lost" nor "delivered" — they're just quietly sitting in limbo, and a percentage-based chart has no bucket for "committed revenue that stalled." You only find it by asking "which open leads have gone the longest without a delivery record," which is exactly what lead-aging analysis is for.

### Pattern 9 — Target-setting itself looks broken, network-wide
Average target attainment across all branch-months: only **10.8%**. Even the best branch-month never got close to 100%. This is not "5 branches all underperforming" — a shortfall this uniform and this large, present in *every single branch every single month*, is a signature of **targets being set from the wrong baseline number**, not five separate teams failing independently. (Lakeside is still worse than the rest at 2.3% avg — its funnel problem stacks on top of the calibration problem.)

### Pattern 10 — Absence of data is itself meaningful, and needs care
- 14 of 288 `lost` leads have no `lost_reason` filled in. Everything else in the dataset (deal value, phone, dates) is 100% complete — this is the one real gap, and it should show up as its own "Unspecified" bucket in any lost-reason chart, not get silently dropped from the denominator.
- December's raw conversion rate looks like a collapse — but leads take a median of ~38 days to go from first contact to delivery, so December's leads simply haven't had time to close yet. Reporting a hard 0–2% for December would be *technically correct and substantively wrong*. The right move is to exclude cohorts too young to have plausibly closed, and show "—" instead of a misleading low number.
- The 38 stuck `order_placed` leads (Pattern 8) aren't a data error to clean up — the "missing" delivery record IS the finding.

### Pattern 11 — Model demand vs. what's actually selling
| Model | Leads interested | Delivered | Delivered/Interested |
|---|---|---|---|
| Glanza | 130 | 44 | 33.8% |
| Fortuner | 94 | 30 | 31.9% |
| Urban Cruiser Hyryder | 104 | 27 | 26.0% |
| Innova Hycross | 83 | 28 | 33.7% |
| Innova Crysta | 53 | 17 | 32.1% |
| Camry | 35 | 10 | 28.6% — lowest |
| Hilux | 11 | 4 | small sample |

Glanza has the highest raw demand *and* the most units delivered — the volume driver of the whole business. Camry has the lowest sell-through rate of the higher-volume models, worth a look at pricing/financing friction for that model specifically.

### Pattern 12 — Rep workload spread
Leads assigned per rep range from **11 (min)** to **33 (max)**, average 20.4. Nobody is drastically overloaded or idle — workload distribution itself isn't a red flag in this dataset, which is worth noting explicitly (not every axis produces a finding, and saying so is more credible than forcing one).

---

## PART 3 — Where Exactly the Funnel Breaks, and What To Do About It Immediately

**The single most important sentence for a CEO:** *the network isn't struggling to close deals — one branch (Lakeside) is failing to make first contact with over 4 in 10 of its leads, and that one leak is dragging down network averages enough to look like a broader problem.*

Immediate action items, in priority order:
1. **Lakeside Toyota — enforce a first-response SLA today.** 42% of new leads never get contacted. This is a process/management fix (e.g., auto-escalate any lead untouched after 24 hours), not a training fix — fixable in days, not months.
2. **Escalate the 38 stuck `order_placed` leads network-wide**, especially the ones idle 30+ days — that's committed revenue with fulfilment silently stalled. Someone needs to manually check what happened to each one.
3. **Re-baseline monthly targets.** A 10.8% average attainment across every branch, every month, means the targets are not usable for performance management as they stand — using them to judge managers right now is measuring against a broken ruler.
4. **Shift some marketing spend away from social media toward walk-in-driving activity/referrals** — 3.3× conversion gap on comparable volume is a fast, low-risk reallocation.
5. **Investigate delivery ops** (45% delay rate) as a separate workstream from sales — factory allocation delay and accessory fitment backlog are the top two controllable causes.

---

## PART 4 — The CEO Dashboard: Complete Architecture & Flow

### 4.1 Directory structure (what's actually in the repo)
```
app/
├── data/dealership_data.json          ← the raw dataset (Part 1)
└── src/
    ├── lib/
    │   ├── domain/          model.ts (buildModel — parses JSON into a typed model), dataQuality.ts
    │   ├── format.ts        shared INR / % / date / number formatting
    │   ├── analytics/       funnel.ts, aging.ts, targets.ts, reps.ts, deliveries.ts,
    │   │                    trends.ts, context.ts (analyze() — single entry point), deviation.ts,
    │   │                    models.ts (per-model demand vs. revenue, added post-benchmark)
    │   ├── insights/        anomalies.ts, priority.ts, recommendations.ts,
    │   │                    forecast.ts, whatif.ts, riskLabel.ts,
    │   │                    testDriveGate.ts (added post-benchmark)
    │   ├── ai/               executiveBrief.ts, explanations.ts, questionRouter.ts,
    │   │                    gemini/ (LLM tier), aiService.ts
    │   ├── export/          csv.ts, pdf.ts, xlsx.ts, report.ts
    │   └── rag/             corpus.ts, retrieval.ts (docs search)
    ├── app/                 Next.js App Router — one folder per screen
    │   ├── /                Overview
    │   ├── /branches, /branches/[branchId]
    │   ├── /reps, /reps/[repId]
    │   ├── /actions          Action Center
    │   ├── /funnel            Funnel Diagnostics
    │   ├── /models            Demand (added post-benchmark)
    │   ├── /leads             Leads (added post-benchmark)
    │   ├── /compare, /welcome, /ai-health
    │   └── /api/             ask, summarize, why, compare, lead, export/*, tools/execute, feedback
    └── components/
        ├── overview/         ExecutiveBrief, FunnelOverview, InsightsList,
        │                    MonthlyChart, NetworkHealthMatrix
        ├── funnel/           StageList, StageBottlenecks, DeliveryOps, SourceQuality,
        │                    WhatIfCalculator, TestDriveGateCard (added post-benchmark)
        ├── actions/          QueueTable, TierTiles, Recommendations, AiStartHere
        ├── models/           ModelsTable (added post-benchmark)
        ├── leads/            LeadsTable (added post-benchmark)
        ├── branches/, reps/, compare/, overlays/, ui/ (incl. WhyPopoverProvider — a single
        │                    shared "Why?" popover instance instead of one per KPI card)
        ├── layout/           Shell, Sidebar, AskFab (draggable floating Ask launcher)
```

**Post-review update:** the `/weekly`, `/docs`, and `/about` tabs (and the `overview/BranchTable`
component) were removed in a later cleanup pass — see the note at the top of
`GAP_ANALYSIS_VS_REFERENCE.md` and `MASTER_INTERVIEW_PREP.md` §5 for why and what changed.
The underlying `export/report.ts` (PDF/XLSX) and `rag/corpus.ts` (Ask DealerPulse's retrieval)
libraries stayed — only the standalone pages built on top of them were cut.

### 4.2 The data flow, end to end
```
dealership_data.json
   │
   ▼  buildModel()
typed, date-parsed model  (domain/model.ts)
   │
   ▼
analytics/*  → funnel %, aging buckets, target attainment, rep rows, delivery delay stats, monthly trend
   │
   ▼  analyze(model, filters)  — the ONE function every screen calls
insights/*   → anomaly detection (z-test), priority scoring, recommendations, forecast, what-if
   │
   ▼
ai/*   → executive brief text, "why" explanations — reads only the numbers above, never raw JSON,
         never invents a metric
   │
   ▼
Screens (Overview → Branches → Branch Detail → Rep Scorecard → Action Center → Funnel Diagnostics)
```
**Why this matters as a design decision:** every screen reads from the same `analyze()` output. If each screen recomputed its own version of "conversion," two screens could show two different numbers for what should be the same metric — which is the fastest way to make a CEO stop trusting the dashboard. One computation path, many views of it.

### 4.3 Screen-by-screen: how each pattern from Part 2 is actually represented

| Data pattern (Part 2) | Dashboard screen / component | How it's shown |
|---|---|---|
| Branch performance not uniform (Pattern 2) | **Overview → `NetworkHealthMatrix`** | 5-branch grid, each with normalized bars for conversion / revenue / pipeline-at-risk, colored good/bad relative to network baseline — click any branch to drill in |
| Lakeside's specific leak (Pattern 3) | **Branch Detail** (`/branches/[branchId]`) + **`detectAnomalies()`** | A "branch converts materially below baseline" anomaly card names the *exact* weakest stage, its conversion %, the network's %, and how many extra leads were lost there vs. baseline — not just a bar chart |
| It's a branch problem not a rep problem (Pattern 4) | **Rep Scorecard** (`/reps/[repId]`) | Shows each rep's branch and rank *within* that branch, so five low-revenue reps all being Lakeside is visible at a glance rather than buried in a flat leaderboard |
| Best performers, rate vs. volume (Pattern 5) | **Rep Scorecard / `/reps`** | Both a conversion-rate ranking and a revenue/units ranking are shown — deliberately not collapsed into one "best rep" number |
| Source quality gap (Pattern 6) | **Funnel Diagnostics → `SourceQuality.tsx`** | Per-source conversion, contact rate, and revenue side by side; a `source-quality` anomaly auto-fires when the gap between best/worst source ≥15 points |
| Delivery delay rate (Pattern 7) | **Funnel Diagnostics → `DeliveryOps.tsx`** | Delay-reason breakdown, median/p90 order-to-delivery days; a `delivery-delay` anomaly fires when delay rate ≥35% |
| Stuck `order_placed` leads (Pattern 8) | **Action Center → `QueueTable`** | Every open lead gets an idle-days counter and a risk label (`stale`, `critical`, `high-value-stale`); a lead idle 30+ days at `order_placed` is called out explicitly as "revenue committed, fulfilment missing" |
| Target miscalibration (Pattern 9) | **Branches / `targets.ts`** + `target-calibration` anomaly | Attainment is shown with rank and pace, never as a bare percentage; when every branch is under ~35%, the anomaly explicitly reframes it as "read as relative rank, not absolute score" instead of red-flagging 5 branches at once |
| Missing lost-reason / cohort immaturity (Pattern 10) | **`maturedConversion()`** in `analytics/funnel.ts` | Immature cohorts are excluded and rendered as "—", never a misleading 0–2%; lost-reason breakdowns should bucket the unspecified 14 separately (worth double-checking this exact chart in code) |
| Model demand vs. delivered (Pattern 11) | **Demand** (`/models`) — `analytics/models.ts` + `ModelsTable.tsx` | Per-model lead share vs. revenue share, test-drive rate, and a headline callout naming the widest lead-share/revenue-share mismatch (e.g. a model that's a large share of leads but a small share of delivered revenue, or the reverse) |
| Priority queue across all of the above | **Action Center** | A single ranked "what to do next" list — priority score combines idle days, deal value, and risk label into one queue a manager can actually work through, rather than making them mentally combine five different charts |

### 4.4 Personas — who sees what, and how "who's winning / who's losing" is shown
The product doesn't have separate logins (assignment explicitly says skip auth), but the **information hierarchy** mirrors three personas through drill-down depth:

1. **CEO / network view** (`/`, Overview) — top-line KPIs, network health matrix, executive brief in plain English, the ranked anomaly list (critical → risk → watch → opportunity). Answers "what's on fire right now, network-wide."
2. **Branch manager view** (`/branches/[branchId]`) — one branch's funnel, its rank vs. the other 4, its specific weakest stage, its reps ranked within the branch. Answers "is my branch actually behind, or just different, and where exactly."
3. **Rep-level / individual view** (`/reps/[repId]`) — one rep's conversion, contact rate, lead list, rank within their branch. Answers "is this specific person underperforming, and on what."

The **Action Center** cuts across all three personas — it's not a KPI screen, it's a worklist: every open lead, prioritized, regardless of which branch or rep owns it, so a CEO or ops person can act directly instead of navigating down to find the problem first.

### 4.5 How "highest" and "lowest" are decided (the judgment call underneath the numbers)
A few deliberate rules the code enforces, worth stating explicitly if asked "how do you know who's best":
- **Minimum sample size gates every ranking.** Reps need ≥10 leads before being flagged as an anomaly, branches need ≥20 matured leads — this stops a rep who closed 2 of 3 leads from looking like the network's best performer by luck.
- **Leaks are ranked by leads lost (volume-weighted), not raw percentage gap** — otherwise a stage with only 5 leads through it could out-rank the stage that's actually losing 30.
- **Conversion is only computed on "matured" cohorts** (old enough to have plausibly closed) — recent leads aren't unfairly counted as failures just because they haven't had time to close yet.
- **Anomalies use a two-proportion z-test** against the network baseline (z ≥ 2 for branches, z ≤ -2.6 for reps) rather than an arbitrary percentage threshold — so "materially different" means statistically different, not just visually different on a bar chart.

---

## PART 5 — Quick Answers to the Interview Questions Directly

**"Did you observe data patterns?"** Yes — 12 distinct patterns (Part 2), the headline one being that Lakeside Toyota's problem is a first-contact leak (58% vs 82–91% elsewhere), not a closing problem, and that it's a branch-wide issue (all 5 worst reps by revenue are at that one branch) rather than five bad individuals.

**"How did you display absence of data?"** Immature cohorts render as "—" instead of a misleading low percentage; leads without a lost-reason should be their own labeled bucket, not dropped; leads with no delivery record are surfaced as a stale/stuck-order alert rather than silently uncounted.

**"Where is the funnel breaking, and how did you represent that?"** Not network-wide — branch-specific. Represented via `stageLeaks()`, which ranks stages by leads lost in excess of the network baseline (volume-weighted), surfaced per-branch on the Branch Detail screen and as an auto-generated anomaly card with the exact stage, the gap, and the estimated extra leads lost — not just a funnel bar chart a reader has to interpret themselves.

**"What's the best way to represent this, and how did you actually represent it?"** A raw percentage-only view would have misdiagnosed Lakeside as a closing problem and would have shown December as a near-total collapse. The fix in both cases was the same principle: **compute the number correctly for what it actually means** (matured cohorts, volume-weighted leaks, statistical significance) before choosing a chart type — the visualization choice was secondary to getting the underlying metric honest first.
