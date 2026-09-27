# DealerPulse — Gap Analysis vs. Reference Submission
*Comparing our deployed app (`dealerpulse-fde-one.vercel.app`) against another candidate's submission (`industrialiq-two.vercel.app`) for the same assignment/dataset — the one that reportedly got positive interview feedback. Purpose: find every place our storytelling is thinner, and turn it into a prioritized fix list.*

> **Update — confirmed against the actual code, not just the deployed UI:** Section 2's claim that "we rank by conversion %, they rank by revenue-per-lead" is now verified directly in `analytics/reps.ts` (`rows.sort()`, currently line 57) — `rows.sort((a, b) => b.conversion - a.conversion || b.delivered - a.delivered)` — conversion rate is the literal, exact sort key, with total delivered units as the tiebreaker; there is no revenue-per-lead field anywhere in the analytics layer today. That closes the loop: this gap is real and precisely as described, not a misreading of the UI. See `MASTER_INTERVIEW_PREP.md` for the fully verified mechanics of everything else in our own app (exact thresholds, formulas, constants) so you can speak to our code with the same precision you'd use to critique theirs.
>
> **Second update — after a UI-cleanup pass:** `/weekly`, `/docs`, and `/about` were removed as standalone tabs. None of them were requested by `ASSIGNMENT.md`, and next to the reference app's tighter nav (8 tabs, no meta/reference pages) they read as clutter diluting the "CEO glance" value prop, not as coverage. The underlying capabilities didn't disappear: `buildExecutiveReport()` (PDF/XLSX export) still backs the export buttons on Overview, and `lib/rag/corpus.ts` still backs Ask DealerPulse's retrieval for policy/process questions — only the dedicated pages built around them were cut. Section 1's table and §7 below are updated accordingly; treat any other mention of Weekly/Docs/About in this file or in `MASTER_INTERVIEW_PREP.md` as describing a prior state, not the current app.
>
> **Third update — punch list items 2–10 closed out** (item 1, revenue-per-lead as the primary rank, was explicitly held back this pass). Test-drive gate, value-lost-per-stage, staleness framing, adjusted conversion, delivery reliability decoupling, the `/models` Demand page, the `/leads` raw table, and the seasonality read are all live. See `FEATURE_TO_UI_MAP.md` in the repo root for the exact page/component each one lives in — that file exists specifically so you can point at the screen while explaining this, rather than describe it from memory.

Both apps run on the **exact same dataset** (same 510 leads, same 5 branches, same numbers), so every difference below is a **presentation/analysis choice**, not a data difference. That's actually the clean way to read the interviewer's original complaint — "the data isn't to the point" almost certainly means *the way the numbers are framed*, not that data is missing.

---

## 1. Tab-by-tab inventory

| Our tabs (`dealerpulse-fde-one`) | Reference tabs (`industrialiq-two`) |
|---|---|
| Overview (`/`) | Overview (`/`) |
| Branches (`/branches`) | Branches (`/branches`) |
| Reps (`/reps`) | Reps (`/reps`) |
| Action Center (`/actions`) | *(folded into alerts, no separate tab)* |
| Funnel (`/funnel`) — includes source quality + delivery ops as sub-sections | Funnel (`/funnel`) |
| Compare (`/compare`) | *(none — not present)* |
| ~~Weekly (`/weekly`)~~ — removed, not in assignment, duplicated Overview | *(none — not present)* |
| ~~Docs (`/docs`)~~ — removed as a nav tab; RAG retrieval still backs Ask DealerPulse | *(none — not present)* |
| ~~About (`/about`)~~ — removed as a nav tab | *(none — not present)* |
| Demand (`/models`) — added | **Demand / Models** (`/models`) |
| Leads (`/leads`) — added, cohort quick-filters | **Leads** (`/leads`) |
| — | **Sources** (`/sources`) — dedicated page, ours is still a Funnel sub-section |
| — | **Deliveries** (`/deliveries`) — dedicated page, ours is still a Funnel sub-section |

**Read on this honestly:** after trimming Weekly/Docs/About, our surface area is closer to theirs —
Overview, Branches, Reps, Action Center, Funnel, Compare vs. their Overview, Funnel, Demand, Sources,
Branches, Reps, Deliveries, Leads. Neither side "built more"; each made different information-architecture
bets. Ours keeps Action Center as its own tab (a workflow queue, not just an alert list) and adds Compare
(side-by-side); theirs breaks Sources/Deliveries/Demand/Leads out of our Funnel/Branches sub-sections into
first-class pages. **The gap that actually matters isn't tab count — it's that every page they built tells
a sharper, money-denominated story** (see §2 below), which is a framing fix, not a page-count fix.

---

## 2. The core difference: their default lens is ₹, ours is %

This is the single biggest, highest-leverage gap. Walk through it with real numbers pulled from both apps:

| Question | Our answer | Their answer |
|---|---|---|
| Who's the best branch? | Downtown, 45.9% conversion | Downtown, ₹10.54L revenue **per lead** |
| Who's the best rep? | Priya Choudhury, 57.1% conversion | Ranked by ₹ revenue-per-lead; Sanjay Kulkarni ₹11.92L/lead vs. Venkat Mishra ₹45,909/lead — **26× gap**, stated in money, not points |
| Who's the best lead source? | Walk-in, 45.7% conversion | Walk-in, ₹11.44L revenue **per lead supplied** — a 3.3× efficiency gap to social media, in rupees |
| How bad is the funnel leak? | "119 leads did not progress past Contacted" | "₹28.61 Cr sitting in 119 never-contacted leads" |

Conversion % answers "how many." Revenue-per-lead answers "how much money did that decision cost us" — which is the number a CEO actually budgets against. **Our analytics layer already has every raw number needed to compute revenue-per-lead** (deal_value is on every lead) — this is a formatting/derived-metric gap, not a data-modeling gap.

**Fix:** add a `revenuePerLead` (and `revenuePerLeadSupplied` distinct from `revenuePerLeadContacted`) derived stat in `lib/analytics/{reps,targets,funnel}.ts` or a new `lib/analytics/efficiency.ts`, and make it the **primary sort key** on Branches, Reps, and the Funnel source-quality section — with conversion % kept as a secondary column, not removed.

---

## 3. The single sharpest insight we're missing entirely: the test-drive "gate"

Their Funnel page states, as a headline finding: **"0 of 91 contacted-but-never-test-driven leads were ever delivered."** I verified this directly against our own dataset — it's exactly true:

- 91 leads reached `contacted` but never reached `test_drive` → **0 of them delivered.**
- Zoomed out further: **210 leads (41% of all 510) never reached test_drive at all**, representing **₹52.16 Cr** of pipeline value.
- Broken out per branch, this "stranded pre-test-drive" value is: Highway ₹12.46 Cr, Lakeside ₹12.41 Cr, Eastside ₹10.40 Cr, Central ₹9.70 Cr, Downtown ₹7.18 Cr.

This is a **stronger claim than a percentage**, because it's a hard boundary condition (0%, not "low conversion"), it's falsifiable, and it reframes the whole funnel around one gate instead of five roughly-equal-looking drop-offs. Our own `funnel.ts` already computes everything needed to derive this (`stageAt`, per-lead history) — it's a ~10-line addition to state the absolute-zero fact explicitly, not a new analytics build.

**Fix:** add this as its own anomaly/insight in `insights/anomalies.ts` (a new `test-drive-gate` type) and surface it prominently on the Overview executive brief and the Funnel page — it's a one-sentence, high-impact addition.

---

## 4. Missing "value lost / stranded revenue" framing at every level

Their pattern, repeated consistently across Branches / Reps / Sources / Models / Funnel pages: **every leak is priced.**
- "₹52.16 Cr in pipeline... never progressed to test-drive... classified as irretrievable"
- "Fortuner alone accounts for ₹16.53 Cr from 38 untested leads"
- "Highway Chennai represents ₹12.46 Cr in potential lost revenue" (value lost before test drive, per branch)
- Every Action Center-style alert leads with "₹X Cr at stake," not a percentage

We do this in a few places (revenue-at-risk on stale leads, `impact:` field in `anomalies.ts`) but not **consistently as the lead number on every page**. Right now our Branches page leads with conversion-rate rank; theirs leads with revenue-per-lead rank and "value lost before test drive" as a named column.

**Fix:** audit every card/table on Branches, Reps, Funnel, and Overview — make sure each one's *first* number is a ₹ figure, with the % as supporting context, not the reverse.

---

## 5. Missing pages / cohort views

- **No dedicated Models/Demand page.** We have model data (`model_interested`) but no screen ranking models by lead volume vs. revenue vs. test-drive rate. Their page surfaces a genuinely sharp insight we don't have anywhere: *"Fortuner is 18% of leads but 32% of revenue; Glanza is 25% of leads for only 10% of revenue"* — i.e., not all leads are worth the same, and a pure lead-count view misleads. Also their seasonality read — Nov enquiry peak (95 leads) → Dec delivery peak (52 units) given the 38-day cycle, meaning "the festive surge is an Oct-Nov event being fulfilled in December" — is a genuinely new temporal insight we don't currently surface at all.
- **No raw, filterable Leads table.** Their `/leads` page has cohort quick-filters (Never contacted / No test drive / Stuck orders / Cold 7+ days / Open / Lost / Delivered) plus sortable columns including Age and Idle days. Our Action Center covers *open* leads with a priority queue, but there's no single place to browse **all 510 leads including lost and delivered ones** with the same cohort filters. This is a legitimate gap for a manager who wants to self-serve ("show me every lost lead from Lakeside in November") rather than only seeing what the algorithm decided is a priority.
- **Delivery promise-reliability, decoupled from revenue.** Their Deliveries page makes the point that "reliability does not follow revenue" — Eastside (highest revenue) has a 64% missed-delivery-date rate (worst), Central (mid-revenue) is most reliable at 39%. We report delay rate and reasons, but I don't see us explicitly stating this decoupling as its own insight (top earner ≠ most dependable) — it's a one-line addition once delay rate is already computed per branch.
- **"Quality with neglect stripped out."** Their Sources page distinguishes *headline* conversion (includes never-contacted leads, which unfairly drags down the number) from *adjusted* conversion (conversion rate among leads that were actually contacted). Social media: 13.9% headline vs 20.4% adjusted — meaningfully different diagnosis (still weak, but the two numbers tell you whether the problem is lead quality or contact-process failure). Worth adding as a second column next to conversion wherever we currently show only one blended rate.

---

## 6. Epistemic honesty / trust-building details worth copying

These cost almost nothing to add and are exactly the kind of thing that reads as "mature product thinking" to an interviewer:
- They repeat **"Data as of 31 Dec 2025 · 9 months behind live"** on every page. We show "Data as of {date}" but not the staleness framing — worth adding since it pre-empts the obvious "why does December look empty" question.
- They visibly print **"not rated"** in the UI for any branch/rep under the sample-size floor, rather than silently omitting them. We already gate on sample size in code (`stageLeaks` minN=8, rep anomalies n≥10, branch anomalies n≥20) — but confirm the **UI itself** shows "not rated" rather than just leaving a blank cell, so the floor is visible to the viewer, not just baked into logic they can't see.
- They explicitly caveat weak evidence: *"lost reasons are self-reported and inconsistent — the stage a lead died at is the reliable signal, not the stated reason"* and *"no acquisition-cost data exists, so revenue-per-lead measures returns, not ROI."* We have similar honest caveats in a few places (matured-cohort conversion, target-calibration reframing) but it's worth an explicit pass to add one-line caveats anywhere we show a number that could be over-trusted.

---

## 7. Where we're already ahead (don't lose these in the rewrite)

To be clear-eyed and not overcorrect: we should **keep**, not cut:
- Compare (side-by-side branch/rep/network) and AI Q&A (Ask DealerPulse, RAG-backed for policy questions,
  deterministic-analytics-backed for numbers) — neither exists in the reference app. PDF/XLSX export
  (via `buildExecutiveReport()`) also still exists on Overview, guaranteeing the exported report can't
  drift from what the screen shows — we just stopped giving that export its own dedicated `/weekly` tab.
- Statistical rigor: our anomalies use a two-proportion z-test against the network baseline, not just an eyeballed threshold — more defensible than their "below 70% floor" fixed cutoffs.
- Matured-cohort conversion (excluding too-young leads rather than showing a misleading low %) — I didn't see the reference app do this; naive December numbers could mislead in their version too.
- Priority-scored Action Center as an actual workflow queue (Contact/Assign/Escalate), not just a read-only alert list.

---

## 8. Prioritized punch list (what to actually do with limited time)

**Do first (high impact, low effort — all derivable from data already in the model):**
1. ⏸ **Held back on purpose** — `revenuePerLead` as the primary ranking/sort key on Branches, Reps, and Sources. Not implemented this pass; conversion % remains primary everywhere.
2. ✅ Test-drive "absolute gate" finding — `lib/insights/testDriveGate.ts`, surfaced as a critical anomaly on Overview and as `TestDriveGateCard` on Funnel.
3. ✅ "Value lost / stranded revenue" — `FunnelStage.lostValue`, shown per stage in `StageList.tsx`.
4. ✅ "N months behind live" staleness framing — computed live in `monthsBehindLive()`, baked into `model.asOfLabel` so it appears on every "Data as of" badge and in every exported report.

**Do next (moderate effort, real gap in coverage):**
5. ✅ `/models` (Demand) page — `lib/analytics/models.ts` + `ModelsTable.tsx`, including the lead-share-vs-revenue-share mismatch callout (verified: Glanza is 25% of leads but 10% of revenue in our own data, matching the reference app's finding).
6. ✅ `/leads` raw table — `LeadsTable.tsx`, cohort quick-filters (Never contacted, No test drive, Stuck orders, Cold 7+ days, Open, Lost, Delivered), sortable Age/Idle columns.
7. ✅ Delivery reliability-vs-revenue decoupling insight — added to `DeliveryOps.tsx`.
8. ✅ Adjusted/"neglect-stripped" conversion — `SourcePerfRow.adjustedConversion` (shown inline on Sources) and `RepRow.adjustedConversion` (shown as a tooltip on the Reps table to avoid re-widening it).

**Nice to have if time remains:**
9. ✅ "Not rated" / "—" confirmed visible in the UI for branch/rep conversion under the sample-size floor (`MIN_RATED_LEADS`), not just gated in logic.
10. ✅ November-enquiry → December-delivery seasonality read — added under the Monthly performance chart on Overview.

Every number above was computed straight from `dealership_data.json`, the same file already powering the app — no new data, no architecture rebuild. See `FEATURE_TO_UI_MAP.md` for the exact UI location of each one.
