# DealerPulse — Feature → Exact UI Location Map

*Every open-ended assignment item and every data pattern we found, with the exact page, component,
and visible label where it's shown. Use this to point at the screen while explaining, not just
describe it verbally. All file paths are relative to `app/src/`.*

---

## Part 1 — The assignment's "Open-Ended Space" items

The assignment listed 8 optional differentiators. We implemented all 8.

| Assignment suggestion | Where it lives | What you'll actually see |
|---|---|---|
| **Lead aging & follow-up alerts** | Action Center (`/actions`) — `components/actions/QueueTable.tsx`; Branch Detail (`/branches/[id]`) — `components/branches/LeadAgingChart.tsx` | Idle-days column + age-bucket filter chips in the queue table; a bucketed aging chart (0–3 / 4–7 / 8–14 / 15–30 / 30+ days) on each branch page |
| **Conversion funnel visualization** | Funnel Diagnostics (`/funnel`) — `components/funnel/StageList.tsx`; Overview (`/`) — `components/overview/FunnelOverview.tsx` | Stage-by-stage bars with conversion %, median/p90 dwell time, and (new) ₹ value lost per stage |
| **Forecasting** | Overview (`/`) — `components/ui/PipelineForecastCard.tsx`; Funnel (`/funnel`) — `components/funnel/WhatIfCalculator.tsx` | "Pipeline Risk & Forecast" card projecting units against target from current open pipeline |
| **Comparative analytics** | Compare (`/compare`) — `components/compare/CompareView.tsx` | Branch-vs-branch, rep-vs-rep, either-vs-network, rep-vs-branch side-by-side picker |
| **Anomaly detection** | Overview (`/`) — `components/overview/InsightsList.tsx`, fed by `lib/insights/anomalies.ts` | Ranked cards (critical/risk/watch/opportunity), each with a two-proportion z-score shown in its evidence row |
| **What-if scenarios** | Funnel (`/funnel`) — `components/funnel/WhatIfCalculator.tsx` | "If we improve New→Contacted by 10pts, what's the revenue impact?" style slider/calculator |
| **AI-powered summaries** | Everywhere — `ExecutiveBrief`, `AiStartHere`/`Recommendations` (Action Center), `AISummaryCard` (Funnel/Branch/Rep), the floating **Ask DealerPulse** chat widget, and a **✨ Summarize** button in the header of every page | Anything with the ⬥ "AI" mark and accent-tinted background is AI-generated prose over already-computed numbers, never a number itself |
| **Export/sharing** | Overview (`/`) header — `components/ui/ExportButtons.tsx`, `PrintReportButton.tsx`, `CopyInsightButton.tsx` | CSV / PDF / XLSX export and one-click copy of the executive brief text |

---

## Part 2 — Data patterns we found, and exactly where the fix/finding is shown

### Originally identified (verified against actual code, not just claimed)

| # | Pattern / problem | Where it's shown | Visible label |
|---|---|---|---|
| 1 | Recent leads haven't matured | Overview (`/`) KPI card | "Lead → Delivery Conversion" shows **—** with a sub-note: "N of M leads in range are old enough to have closed" |
| 2 | Insufficient sample → don't fake a rate | **Network**: Overview KPI (as above). **Branch**: Branches (`/branches`) `BranchCard.tsx` — shows **—** / "Not enough matured leads" when `maturedN < 10`. **Rep**: Reps (`/reps`) table and Rep Scorecard (`/reps/[id]`) — shows **"Not rated"** when `leads < 10` | Tooltip: "Under 10 leads — not enough volume to rate" |
| 3 | Funnel % alone is misleading | Branches (`/branches`) `BranchCard.tsx` | "Biggest leak: {stage} · {branch %} vs network {network %}" — ranked by **excess leads lost**, not raw gap |
| 4 | Branch comparison needs a baseline | Branches (`/branches`) `BranchCard.tsx` — `BaselineBar` component | A bar with a marker line at the network average, so "above/below baseline" is visual, not mental math |
| 5 | Small deviations look like problems | Overview (`/`) `InsightsList.tsx` anomaly cards | Each card's evidence row shows the literal **"z-score vs baseline"** number — nothing is flagged without clearing `\|z\|≥2` and a minimum sample |
| 6 | Stale leads hard to prioritize | Action Center (`/actions`) `QueueTable.tsx` age-bucket filter; Branch Detail `LeadAgingChart.tsx` | Age buckets (0-7 / 8-14 / 15-30 / 30+ days) as both a filter and a chart |
| 7 | Revenue impact hidden behind counts | Overview (`/`) KPI card | "Revenue At Risk" — ₹ figure, with sub-note "N leads idle 8+ days" |
| 8 | Target % alone implies a fixable gap | Branches (`/branches`) `BranchCard.tsx` — "Target" stat | Shows attainment **%, plus "rank N · pacing X% last mo"** underneath — never a bare percentage |
| 9 | Too many charts, not enough action | Action Center (`/actions`) | A priority-ranked **table/queue** with Contact/Assign/Escalate buttons, not another chart |
| 10 | AI could hallucinate a number | Architecture guarantee, visible via the ⬥ AI mark | Every AI surface (Ask DealerPulse, Summarize, Executive Brief) is grounded in function-calling against the same deterministic analytics every screen reads — the AI never computes a metric itself |

### Added in this pass (previously missing, now implemented)

| # | Pattern / finding | Where it's shown | Visible label |
|---|---|---|---|
| 11 | Test drive is a hard gate, not a soft stage (0 of N contacted-but-never-test-driven leads ever deliver) | Funnel (`/funnel`) — new `components/funnel/TestDriveGateCard.tsx`; also auto-surfaces as a **critical** anomaly card on Overview `InsightsList` | Headline: "**N leads reached Contacted but never Test Drive — 0 of them ever delivered**", with a per-branch ₹ breakdown |
| 12 | Stranded/lost value at each funnel stage (not just a drop-off count) | Funnel (`/funnel`) — `StageList.tsx`, under each stage | "N did not progress · M marked lost · **₹X value lost**" |
| 13 | Dataset staleness ("how far behind live is this?") | Every page header — `Shell.tsx` "Data as of" badge; also baked into `model.asOfLabel`, so it flows into every exported report and the AI's context | "Data as of 31 Dec 2025 **· 9 months behind live**" (computed live off the real clock, not a hardcoded number) |
| 14 | Headline conversion hides whether the problem is lead quality or a contact-process failure | Funnel (`/funnel`) — `SourceQuality.tsx` (per source); Reps (`/reps`) table — tooltip on the Conversion cell | "13.9% **(20.4% adjusted)**" — adjusted = conversion among leads that were actually contacted |
| 15 | Top-revenue branch isn't necessarily the most dependable one | Funnel (`/funnel`) — `DeliveryOps.tsx` | "Reliability doesn't follow revenue: {branch A} earns the most (₹X) but delays Y% of deliveries — {branch B} is the most dependable at Z% despite ₹W in revenue." |
| 16 | Not all leads are worth the same (lead-volume share ≠ revenue share) | New **Demand** page (`/models`) — `ModelsTable.tsx` + headline callout | "**Glanza** is 25% of leads but 10% of delivered revenue" (verified against the actual dataset, matches the reference app's own finding) |
| 17 | Enquiry surge and delivery surge are offset by the sales cycle, not a slowdown | Overview (`/`), under the Monthly performance chart | "Enquiries peaked in {month} (N leads); deliveries peaked in {month} (N units) — a lag consistent with the ~38-day lead-to-delivery cycle" |
| 18 | No self-serve way to browse every lead regardless of outcome | New **Leads** page (`/leads`) — `LeadsTable.tsx` | Cohort quick-filter chips: Never contacted · No test drive · Stuck orders · Cold 7+ days · Lost · Delivered, each with a live count, sortable by Age/Idle. No "Open" chip — that population is Action Center's whole table already, scored; Leads links to it instead of restating it unscored. Reciprocal link back to Leads from Action Center's header. |

### Small UX fixes (not new insights, but worth mentioning under Design & UX)

| # | Problem | Fix | Where |
|---|---|---|---|
| 19 | Opening "Why?" on several KPI cards in a row left several popovers stacked on top of each other | Every `WhyButton` now opens through one shared `WhyPopoverProvider` instance — opening a new popover always replaces whatever was already open, rather than each button owning its own open/closed state | Every screen with a "Why?" pill (`components/ui/WhyPopoverProvider.tsx`) |
| 20 | The fixed floating "Ask DealerPulse" launcher could sit permanently on top of data on shorter screens | Replaced with an icon-only, vertically **draggable** `AskFab` (position remembered per-browser via `localStorage`) — the header's labeled "Ask DealerPulse…" entry point already spells out the text, so the floating button doesn't need to repeat it | Every screen (`components/layout/AskFab.tsx`) |
| 21 | Sidebar's static "DATASET · 5 branches · 30 reps" footer block was redundant with the top bar's own "Data as of" freshness chip and per-screen subtitle | Removed from `Sidebar.tsx`; the sidebar no longer takes a `datasetScope` prop as a result | Sidebar (`components/layout/Sidebar.tsx`) |

---

## Not implemented (by choice, not oversight)

- **Revenue-per-lead as the primary ranking metric** — deliberately held back this pass; conversion % stays primary on Branches/Reps/Sources. This was flagged in `GAP_ANALYSIS_VS_REFERENCE.md` as the reference app's sharpest differentiator, but is a bigger re-ranking decision than the rest of this list and was explicitly excluded from this round.
- Everything else on the original punch list in `GAP_ANALYSIS_VS_REFERENCE.md` is now closed out.
