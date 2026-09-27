# Anomaly Detection Methodology

## Why a statistical test, not a fixed threshold

DealerPulse flags branches, reps, and funnel stages as unusual using a
**two-proportion z-test** comparing an entity's observed conversion rate
against the network baseline, rather than a fixed rule like "flag anything
under 20% conversion." A fixed threshold would flag a small branch with only
a handful of leads on pure noise, and would fail to flag a large branch with
a real, statistically significant problem sitting just above the threshold.
The z-test accounts for sample size directly: the same percentage-point gap
is far more significant for a branch with 200 leads than for one with 15.

## Severity tiers

- **Critical**: z ≤ −2.5 (roughly the bottom 0.6% of outcomes if the entity
  were truly performing at the network baseline).
- **Risk**: z ≤ −2.0 but above the critical threshold.
- **Watch**: z ≤ −1.4.
- **Opportunity**: more than 3 percentage points above the network baseline —
  positive findings are surfaced with the same rigor as problems, not just
  buried in a KPI card.
- **Healthy**: everything else.

## Minimum sample size

An entity is only eligible for a conversion anomaly once it has at least 10
(rep-level) or 20 (branch-level, matured-cohort) leads in scope. Below that,
a single lucky or unlucky outcome could swing the rate by 10+ points, which
would make the z-test itself unreliable — so small-sample entities are
excluded from this specific check entirely rather than flagged on thin
evidence.

## Known sensitivity

At a z ≥ 2 gate, roughly 5% of branches will be flagged on pure statistical
noise even when nothing is actually wrong — this is the standard false
positive rate for a two-sided test at that significance level. Raising the
gate (e.g. to z ≥ 2.5) trades a lower false-positive rate for a higher chance
of missing a real, smaller problem. DealerPulse currently uses z ≤ −2.5 for
Critical specifically to keep the highest-severity tier conservative, while
using a looser z ≤ −1.4 for Watch to surface softer signals worth a human
look.

## Verifying the detector is not just reciting patterns

The test suite includes a check that reassigns every lead's branch on a
round-robin basis *within status* (so overall stage mix is preserved) and
asserts that zero branch-level anomalies result. This is what demonstrates
the detector is actually finding statistical patterns in the data, not
repeating a hardcoded list of "problem branches."

## The test-drive gate is a structural check, not a z-test

One anomaly type — the test-drive gate — is not statistical at all, and is
deliberately excluded from the z-test framework described above. It fires
whenever at least 15 leads have reached Contacted but never reached Test
Drive, and its severity is decided by a hard structural fact rather than a
sample-size-adjusted comparison: **critical** if literally zero of those
leads ever delivered (confirming the gate is absolute), **risk** if a small
number delivered anyway (the exception, not the rule). This is intentional
— a boundary condition this stark ("zero delivered without a test drive")
is a stronger, more falsifiable claim than any percentage a z-test could
produce, so it is reported as a fact, not a probability.

## Ranking and flood control

Anomalies are always sorted by severity tier first. Within a tier, they are
now additionally ranked by a magnitude specific to that anomaly type (for
example, |z-score| for a conversion anomaly, or excess leads lost for a
funnel-stage leak), and only the top few are shown by default — the rest
remain available via a disclosure rather than flooding the executive brief
with low-impact findings.
