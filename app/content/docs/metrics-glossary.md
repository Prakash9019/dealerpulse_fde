# DealerPulse Metrics Glossary

This glossary documents exactly how each headline metric in DealerPulse is
computed, so that any number quoted by the AI layer can be checked against a
plain-English definition rather than taken on faith.

## Lead → Delivery Conversion

Measured over **matured cohorts only**: leads at least as old as the observed
median lead-to-delivery time (`maturityDays`, computed from the dataset, not
hardcoded — currently around 38 days). Leads younger than that are excluded
from the conversion calculation and the excluded count is always shown
alongside the rate. If fewer than 10 matured leads exist in a window, the
conversion metric is reported as unavailable rather than shown as 0%, because
a young cohort has not had time to close and a literal 0% would misstate the
network's health.

## Revenue

Recognised on **delivery date**, not order date or lead-creation date. A
delayed delivery therefore shifts revenue recognition into a later month,
which is why revenue and lead-volume metrics can move in different
directions in the same period.

## Revenue at Risk

The total deal value of **open** leads with no recorded activity for 8 or
more days (the "stale" threshold). Lost and delivered leads are never
counted. This metric is intentionally **not** narrowed by the active date
range filter, because open pipeline is present-tense — a stale lead should
never be hidden from view just because the user picked a shorter time
window.

## Priority Score

A 1–100 score computed as: deal value (relative to the network median) ×
idle time (log-scaled, so the marginal urgency of day 60 vs day 90 is smaller
than day 1 vs day 10) × stage proximity to revenue (an Order Placed lead
weighs more than a New lead) × risk multipliers (overdue past expected close,
assigned to a below-baseline branch, idle over 30 days). The raw score is
normalised against the single strongest case in the entire open book, so
scores are never clamped and never tie at a false ceiling.

## Anomaly Severity

Branch, rep, and stage-level anomalies are flagged using a **two-proportion
z-test** against the network baseline conversion rate, not a fixed
percentage threshold. Severity tiers: **Critical** at z ≤ −2.5, **Watch** at
z ≤ −1.4, and an entity performing more than 3 points above baseline is
flagged as an **Opportunity** rather than only ever reporting problems.

## Target Attainment

Monthly unit and revenue targets in this dataset sum to substantially more
than the network has ever delivered in a single month. Attainment is
therefore always shown alongside **rank** (how a branch compares to its
peers) and **pace** (recent-month trend), and is never presented as a
standalone percentage that would misleadingly imply a fixable, one-branch
performance gap.

## Stale Threshold

A lead is "stale" at **8 or more days** of no recorded activity. This
threshold is deliberately set at the boundary between the "4-7 day" and
"8-14 day" aging buckets, so the headline stale count always reconciles
exactly with the sum of the 8+, 15-30, and 30+ bucket rows.
