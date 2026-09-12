/* Focused tests for the deterministic analytics layer.
   Assertions are computed two ways: once by the analytics module, once by a naive
   independent implementation over the raw JSON. If they disagree, the test fails. */

export function buildSuite(A, raw) {
  const model = A.buildModel(raw);
  const ctx = A.analyze(model, { range: 'all' });
  const t = [];
  const test = (group, name, fn) => t.push({ group, name, fn });
  const near = (a, b, eps) => Math.abs(a - b) <= (eps == null ? 1e-9 : eps);
  const DAY = 86400000;
  const asOf = new Date('2025-12-31T23:59:59Z');
  const reached = (l, s) => l.status_history.some((h) => h.status === s);
  const idle = (l) => Math.floor((asOf - new Date(l.last_activity_at)) / DAY);
  const openRaw = raw.leads.filter((l) => !['delivered', 'lost'].includes(l.status));

  /* ---- domain model ---- */
  test('model', 'every lead is normalised', () => {
    if (model.leads.length !== raw.leads.length) throw new Error(model.leads.length + ' != ' + raw.leads.length);
    return model.leads.length + ' leads';
  });
  test('model', 'status history is sorted ascending', () => {
    const bad = model.leads.find((l) => l.history.some((h, i) => i && h.at < l.history[i - 1].at));
    if (bad) throw new Error('unsorted history on ' + bad.id);
    return 'all histories ordered';
  });
  test('model', 'branch managers are resolved from rep roles', () => {
    const missing = model.branches.filter((b) => !b.managerName);
    if (missing.length) throw new Error('no manager for ' + missing.map((b) => b.id).join(','));
    return model.branches.length + ' managers';
  });
  test('model', 'deliveries join to their lead', () => {
    const orphan = model.deliveries.filter((d) => !d.lead);
    if (orphan.length) throw new Error(orphan.length + ' orphan deliveries');
    return model.deliveries.length + ' joined';
  });
  test('model', 'maturity window derives from observed lead→delivery time', () => {
    const days = raw.leads.filter((l) => reached(l, 'delivered'))
      .map((l) => (new Date(l.status_history.find((h) => h.status === 'delivered').timestamp) - new Date(l.created_at)) / DAY);
    const med = [...days].sort((a, b) => a - b)[Math.floor(days.length / 2)];
    if (Math.abs(model.maturityDays - med) > 1) throw new Error(model.maturityDays + ' vs ' + med.toFixed(1));
    return model.maturityDays + ' days';
  });

  /* ---- funnel ---- */
  test('funnel', 'stage counts match a naive pass over history', () => {
    const expect = A.STAGES.map((s) => raw.leads.filter((l) => reached(l, s)).length);
    const got = ctx.netFunnel.map((s) => s.count);
    if (expect.join(',') !== got.join(',')) throw new Error(got.join(',') + ' != ' + expect.join(','));
    return got.join(' → ');
  });
  test('funnel', 'counts decrease monotonically down the funnel', () => {
    const c = ctx.netFunnel.map((s) => s.count);
    for (let i = 1; i < c.length; i++) if (c[i] > c[i - 1]) throw new Error('stage ' + i + ' exceeds its parent');
    return 'monotonic';
  });
  test('funnel', 'stage conversion equals count ÷ previous count', () => {
    ctx.netFunnel.forEach((s, i) => {
      if (!i) return;
      const e = ctx.netFunnel[i - 1].count ? s.count / ctx.netFunnel[i - 1].count : 0;
      if (!near(s.convFromPrev, e)) throw new Error(s.stage + ': ' + s.convFromPrev + ' != ' + e);
    });
    return ctx.netFunnel.slice(1).map((s) => (s.convFromPrev * 100).toFixed(0) + '%').join(' ');
  });
  test('funnel', 'drop-off plus progression accounts for every entrant', () => {
    ctx.netFunnel.forEach((s, i) => {
      if (!i) return;
      if (s.count + s.dropOff !== s.n) throw new Error(s.stage + ': ' + s.count + '+' + s.dropOff + ' != ' + s.n);
    });
    return 'balanced at all 5 steps';
  });
  test('funnel', 'median stage duration is the true median', () => {
    const i = 4; // negotiation → order_placed
    const durs = raw.leads.filter((l) => reached(l, 'negotiation') && reached(l, 'order_placed')).map((l) =>
      (new Date(l.status_history.find((h) => h.status === 'order_placed').timestamp) -
        new Date(l.status_history.find((h) => h.status === 'negotiation').timestamp)) / DAY);
    const sorted = [...durs].sort((a, b) => a - b);
    const med = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    if (!near(ctx.netFunnel[i].medianDays, med, 1e-6)) throw new Error(ctx.netFunnel[i].medianDays + ' != ' + med);
    return 'Negotiation → Order ' + med.toFixed(1) + 'd';
  });

  /* ---- conversion ---- */
  test('conversion', 'raw conversion equals delivered ÷ total', () => {
    const e = raw.leads.filter((l) => l.status === 'delivered').length / raw.leads.length;
    if (!near(ctx.kpi.rawConversion, e)) throw new Error(ctx.kpi.rawConversion + ' != ' + e);
    return (e * 100).toFixed(1) + '%';
  });
  test('conversion', 'matured conversion excludes leads younger than the maturity window', () => {
    const mature = raw.leads.filter((l) => (asOf - new Date(l.created_at)) / DAY >= model.maturityDays);
    const e = mature.filter((l) => l.status === 'delivered').length / mature.length;
    if (!near(ctx.kpi.conversion, e)) throw new Error(ctx.kpi.conversion + ' != ' + e);
    if (ctx.kpi.conversionN !== mature.length) throw new Error('n ' + ctx.kpi.conversionN + ' != ' + mature.length);
    return (e * 100).toFixed(1) + '% on ' + mature.length + ' matured leads';
  });
  test('conversion', 'matured conversion is never below raw conversion', () => {
    if (ctx.kpi.conversion < ctx.kpi.rawConversion - 1e-9) throw new Error('matured below raw');
    return 'matured ' + (ctx.kpi.conversion * 100).toFixed(1) + '% ≥ raw ' + (ctx.kpi.rawConversion * 100).toFixed(1) + '%';
  });
  test('conversion', 'a window with no matured cohort reports null, not zero', () => {
    const c = A.analyze(model, { range: '30d' });
    if (c.kpi.conversion !== null) throw new Error('expected null, got ' + c.kpi.conversion);
    if (!c.kpi.conversionNote) throw new Error('missing explanatory note');
    return 'null + note returned for Last 30 days';
  });

  /* ---- aging & idle days ---- */
  test('aging', 'idle days count back from the dataset end, not today', () => {
    const l = model.leads.find((x) => x.open);
    const e = Math.floor((asOf - new Date(raw.leads.find((r) => r.id === l.id).last_activity_at)) / DAY);
    if (l.idleDays !== e) throw new Error(l.idleDays + ' != ' + e);
    return l.id + ' idle ' + e + 'd';
  });
  test('aging', 'buckets partition the open pipeline exactly once', () => {
    const total = ctx.aging.buckets.reduce((s, b) => s + b.count, 0);
    if (total !== openRaw.length) throw new Error(total + ' != ' + openRaw.length);
    const ids = new Set();
    ctx.aging.buckets.forEach((b) => b.leads.forEach((l) => {
      if (ids.has(l.id)) throw new Error('lead ' + l.id + ' in two buckets');
      ids.add(l.id);
    }));
    return total + ' open leads, no overlap';
  });
  test('aging', 'stale set reconciles with the bucket evidence', () => {
    const fromBuckets = ctx.aging.buckets.filter((b) => b.min >= A.STALE_DAYS).reduce((s, b) => s + b.count, 0);
    if (fromBuckets !== ctx.aging.staleCount) throw new Error('headline ' + ctx.aging.staleCount + ' != evidence ' + fromBuckets);
    return ctx.aging.staleCount + ' leads both ways';
  });
  test('aging', 'stale value equals the sum of stale deal values', () => {
    const e = openRaw.filter((l) => idle(l) >= A.STALE_DAYS).reduce((s, l) => s + l.deal_value, 0);
    if (!near(ctx.aging.staleValue, e, 1)) throw new Error(ctx.aging.staleValue + ' != ' + e);
    return A.fmtINR(e);
  });

  /* ---- revenue at risk ---- */
  test('risk', 'revenue at risk is the stale share of open pipeline', () => {
    if (ctx.kpi.revenueAtRisk !== ctx.aging.staleValue) throw new Error('kpi diverges from aging');
    if (ctx.kpi.revenueAtRisk > ctx.kpi.pipelineValue) throw new Error('risk exceeds pipeline');
    return A.fmtINR(ctx.kpi.revenueAtRisk) + ' of ' + A.fmtINR(ctx.kpi.pipelineValue);
  });
  test('risk', 'lost and delivered leads are never counted as at-risk', () => {
    const bad = ctx.aging.stale.filter((l) => !l.open);
    if (bad.length) throw new Error(bad.length + ' closed leads in the stale set');
    return 'open stages only';
  });

  /* ---- targets ---- */
  test('targets', 'attainment equals delivered units ÷ target units', () => {
    const tg = raw.targets.reduce((s, x) => s + x.target_units, 0);
    const units = raw.deliveries.length;
    if (!near(ctx.targets.attainment, units / tg, 1e-9)) throw new Error(ctx.targets.attainment + ' != ' + units / tg);
    return units + ' / ' + tg + ' = ' + (units / tg * 100).toFixed(1) + '%';
  });
  test('targets', 'branch target units sum to the network target', () => {
    const sum = ctx.branchRows.reduce((s, b) => s + b.targetUnits, 0);
    const e = raw.targets.reduce((s, x) => s + x.target_units, 0);
    if (sum !== e) throw new Error(sum + ' != ' + e);
    return A.fmtNum(e) + ' units';
  });
  test('targets', 'pace uses the most recent month, not the whole period', () => {
    const last = model.months[model.months.length - 1];
    const tg = raw.targets.filter((x) => x.month === last).reduce((s, x) => s + x.target_units, 0);
    const units = raw.deliveries.filter((d) => d.delivery_date.slice(0, 7) === last).length;
    if (!near(ctx.targets.pace, units / tg, 1e-9)) throw new Error(ctx.targets.pace + ' != ' + units / tg);
    return last + ' pace ' + (units / tg * 100).toFixed(0) + '%';
  });

  /* ---- branch comparison ---- */
  test('branches', 'branch leads and units sum to the network totals', () => {
    const leads = ctx.branchRows.reduce((s, b) => s + b.leads, 0);
    const units = ctx.branchRows.reduce((s, b) => s + b.units, 0);
    if (leads !== ctx.cohort.length) throw new Error('leads ' + leads + ' != ' + ctx.cohort.length);
    if (units !== ctx.kpi.units) throw new Error('units ' + units + ' != ' + ctx.kpi.units);
    return leads + ' leads · ' + units + ' units';
  });
  test('branches', 'conversion ranks are unique and complete', () => {
    const ranks = ctx.branchRows.map((b) => b.convRank).sort((a, b) => a - b);
    if (ranks.join(',') !== ctx.branchRows.map((_, i) => i + 1).join(',')) throw new Error(ranks.join(','));
    return 'ranks 1–' + ranks.length;
  });
  test('branches', 'status comes from the z-test, not a fixed threshold', () => {
    const bad = ctx.branchRows.find((b) => (b.z <= -2.5) !== (b.status === 'critical'));
    if (bad) throw new Error(bad.name + ' status ' + bad.status + ' at z ' + bad.z.toFixed(2));
    const crit = ctx.branchRows.filter((b) => b.status === 'critical');
    return crit.length + ' critical: ' + (crit.map((b) => b.name + ' z' + b.z.toFixed(1)).join(', ') || 'none');
  });
  test('branches', 'the weakest branch is discovered, not hardcoded', () => {
    const worst = [...ctx.branchRows].sort((a, b) => a.maturedConversion - b.maturedConversion)[0];
    const byZ = [...ctx.branchRows].sort((a, b) => a.z - b.z)[0];
    if (worst.id !== byZ.id) throw new Error('conversion and z disagree on the weakest branch');
    const shuffled = { ...raw, branches: [...raw.branches].reverse() };
    const alt = A.analyze(A.buildModel(shuffled), { range: 'all' });
    const altWorst = [...alt.branchRows].sort((a, b) => a.z - b.z)[0];
    if (altWorst.id !== worst.id) throw new Error('result depends on branch ordering');
    return worst.name + ' (order-independent)';
  });

  /* ---- stage leak ranking ---- */
  test('leaks', 'leaks are ranked by leads lost, not percentage gap', () => {
    const weak = [...ctx.branchRows].sort((a, b) => a.z - b.z)[0];
    const leaks = A.stageLeaks(weak.funnel, ctx.netFunnel);
    if (leaks.length < 2) throw new Error('not enough stages to rank');
    for (let i = 1; i < leaks.length; i++) if (leaks[i].excessLoss > leaks[i - 1].excessLoss + 1e-9) throw new Error('unsorted');
    const byGap = [...leaks].sort((a, b) => a.gap - b.gap)[0];
    return leaks[0].label + ' (~' + leaks[0].excessLoss.toFixed(1) + ' leads)' +
      (byGap.stage !== leaks[0].stage ? '; % gap would have picked ' + byGap.label : '');
  });
  test('leaks', 'excess loss equals entrants × baseline shortfall', () => {
    const weak = [...ctx.branchRows].sort((a, b) => a.z - b.z)[0];
    A.stageLeaks(weak.funnel, ctx.netFunnel).forEach((l) => {
      if (!near(l.excessLoss, l.n * (l.net - l.conv), 1e-9)) throw new Error(l.label);
    });
    return 'all steps consistent';
  });

  /* ---- reps ---- */
  test('reps', 'rep lead counts sum to the network cohort', () => {
    const sum = ctx.reps.reduce((s, r) => s + r.leads, 0);
    if (sum !== ctx.cohort.length) throw new Error(sum + ' != ' + ctx.cohort.length);
    return sum + ' leads across ' + ctx.reps.length + ' reps';
  });
  test('reps', 'branch ranks are contiguous within each branch', () => {
    model.branches.forEach((b) => {
      const inb = ctx.reps.filter((r) => r.branchId === b.id).map((r) => r.branchRank).sort((x, y) => x - y);
      if (inb.length && inb.join(',') !== inb.map((_, i) => i + 1).join(',')) throw new Error(b.name + ': ' + inb.join(','));
    });
    return 'contiguous in all ' + model.branches.length + ' branches';
  });
  test('reps', 'rep conversion equals delivered ÷ assigned', () => {
    const r = ctx.reps[0];
    const mine = raw.leads.filter((l) => l.assigned_to === r.id);
    const e = mine.filter((l) => l.status === 'delivered').length / mine.length;
    if (!near(r.conversion, e)) throw new Error(r.conversion + ' != ' + e);
    return r.name + ' ' + (e * 100).toFixed(1) + '%';
  });

  /* ---- priority scoring ---- */
  test('priority', 'scores are strictly ordered — no ceiling saturation', () => {
    const scores = ctx.actions.rows.map((r) => r.score);
    const ties = scores.filter((s) => s === scores[0]).length;
    if (ties > 1) throw new Error(ties + ' leads tie at the top score ' + scores[0]);
    for (let i = 1; i < scores.length; i++) if (scores[i] > scores[i - 1]) throw new Error('queue not sorted');
    return scores.length + ' leads, top ' + scores[0] + ', unique maximum';
  });
  test('priority', 'scores stay inside 1–100', () => {
    const bad = ctx.actions.rows.filter((r) => r.score < 1 || r.score > 100);
    if (bad.length) throw new Error(bad.length + ' out of range');
    return 'range ' + ctx.actions.rows[ctx.actions.rows.length - 1].score + '–' + ctx.actions.rows[0].score;
  });
  test('priority', 'higher value beats lower value when all else is equal', () => {
    const refs = A.priorityRefs(model, ctx.branchRows);
    const base = { status: 'negotiation', idleDays: 20, dealValue: 1500000, overdue: false, branchId: 'ZZ', overdueDays: 0 };
    const lo = A.priorityScore(base, refs).score;
    const hi = A.priorityScore({ ...base, dealValue: 5000000 }, refs).score;
    if (hi <= lo) throw new Error(hi + ' !> ' + lo);
    return '₹50 L scores ' + hi + ' vs ₹15 L at ' + lo;
  });
  test('priority', 'longer idle beats shorter idle when all else is equal', () => {
    const refs = A.priorityRefs(model, ctx.branchRows);
    const base = { status: 'negotiation', idleDays: 5, dealValue: 2000000, overdue: false, branchId: 'ZZ', overdueDays: 0 };
    const lo = A.priorityScore(base, refs).score;
    const hi = A.priorityScore({ ...base, idleDays: 60 }, refs).score;
    if (hi <= lo) throw new Error(hi + ' !> ' + lo);
    return '60d scores ' + hi + ' vs 5d at ' + lo;
  });
  test('priority', 'order-placed outranks an identical earlier-stage lead', () => {
    const refs = A.priorityRefs(model, ctx.branchRows);
    const base = { idleDays: 30, dealValue: 3000000, overdue: false, branchId: 'ZZ', overdueDays: 0 };
    const early = A.priorityScore({ ...base, status: 'contacted' }, refs).score;
    const late = A.priorityScore({ ...base, status: 'order_placed' }, refs).score;
    if (late <= early) throw new Error(late + ' !> ' + early);
    return 'Order Placed ' + late + ' vs Contacted ' + early;
  });
  test('priority', 'tiers partition the queue and follow the published cutoffs', () => {
    const q = ctx.actions;
    if (q.critical.length + q.attention.length + q.watch.length !== q.rows.length) throw new Error('tiers do not partition');
    if (q.critical.some((r) => r.score < A.PRIORITY_TIERS.critical)) throw new Error('critical below cutoff');
    if (q.attention.some((r) => r.score >= A.PRIORITY_TIERS.critical || r.score < A.PRIORITY_TIERS.attention)) throw new Error('attention outside band');
    return q.critical.length + ' critical / ' + q.attention.length + ' attention / ' + q.watch.length + ' watch';
  });
  test('priority', 'scores are stable under branch filtering', () => {
    const one = ctx.actions.rows[0];
    const filtered = A.analyze(model, { range: 'all', branchId: one.branchId });
    const same = filtered.actions.rows.find((r) => r.id === one.id);
    if (!same || same.score !== one.score) throw new Error('score changed from ' + one.score + ' to ' + (same && same.score));
    return one.id + ' scores ' + one.score + ' in both scopes';
  });

  /* ---- deliveries ---- */
  test('deliveries', 'delay rate equals deliveries carrying a reason', () => {
    const e = raw.deliveries.filter((d) => d.delay_reason).length / raw.deliveries.length;
    if (!near(ctx.delivery.delayRate, e)) throw new Error(ctx.delivery.delayRate + ' != ' + e);
    return (e * 100).toFixed(0) + '% of ' + raw.deliveries.length;
  });
  test('deliveries', 'reason counts sum to the delayed total', () => {
    const sum = ctx.delivery.reasons.reduce((s, r) => s + r.count, 0);
    if (sum !== ctx.delivery.delayedCount) throw new Error(sum + ' != ' + ctx.delivery.delayedCount);
    return ctx.delivery.reasons.length + ' reasons, ' + sum + ' deliveries';
  });
  test('deliveries', 'monthly units sum to the period total', () => {
    const sum = ctx.trend.reduce((s, m) => s + m.units, 0);
    if (sum !== ctx.kpi.units) throw new Error(sum + ' != ' + ctx.kpi.units);
    return sum + ' units across ' + ctx.trend.length + ' months';
  });

  /* ---- sources ---- */
  test('sources', 'source leads sum to the cohort and are sorted by conversion', () => {
    const sum = ctx.sources.reduce((s, x) => s + x.leads, 0);
    if (sum !== ctx.cohort.length) throw new Error(sum + ' != ' + ctx.cohort.length);
    for (let i = 1; i < ctx.sources.length; i++) if (ctx.sources[i].conversion > ctx.sources[i - 1].conversion) throw new Error('unsorted');
    return ctx.sources[0].label + ' ' + A.fmtPct(ctx.sources[0].conversion) + ' → ' + ctx.sources[ctx.sources.length - 1].label + ' ' + A.fmtPct(ctx.sources[ctx.sources.length - 1].conversion);
  });

  /* ---- lost reasons ---- */
  test('lost', 'lost totals and stage attribution reconcile', () => {
    const lost = raw.leads.filter((l) => l.status === 'lost');
    if (ctx.lost.total !== lost.length) throw new Error(ctx.lost.total + ' != ' + lost.length);
    const byReason = ctx.lost.rows.reduce((s, r) => s + r.count, 0);
    const byStage = ctx.lost.byStage.reduce((s, r) => s + r.count, 0);
    if (byReason !== lost.length) throw new Error('reasons sum ' + byReason);
    if (byStage !== lost.length) throw new Error('stage sum ' + byStage);
    return lost.length + ' lost, reconciled by reason and by stage';
  });

  /* ---- anomaly detection ---- */
  test('anomalies', 'anomalies are produced and ordered by severity', () => {
    if (!ctx.anomalies.length) throw new Error('no anomalies detected');
    const rank = { critical: 0, risk: 1, watch: 2, opportunity: 3 };
    for (let i = 1; i < ctx.anomalies.length; i++) {
      if (rank[ctx.anomalies[i].severity] < rank[ctx.anomalies[i - 1].severity]) throw new Error('unordered');
    }
    return ctx.anomalies.length + ' anomalies: ' + ctx.anomalies.map((a) => a.severity).join(', ');
  });
  test('anomalies', 'every anomaly carries evidence, impact and a CTA', () => {
    ctx.anomalies.forEach((a) => {
      if (!a.evidence || !a.evidence.length) throw new Error(a.id + ' has no evidence');
      if (!a.impact) throw new Error(a.id + ' has no impact');
      if (!a.cta || !a.cta.route || !a.cta.route.screen) throw new Error(a.id + ' has no routable CTA');
      if (!a.expected || !a.actual) throw new Error(a.id + ' missing baseline/actual');
    });
    return 'all ' + ctx.anomalies.length + ' complete';
  });
  test('anomalies', 'positive findings are surfaced, not only problems', () => {
    if (!ctx.anomalies.some((a) => a.severity === 'opportunity')) throw new Error('no opportunity detected');
    return ctx.anomalies.filter((a) => a.severity === 'opportunity').map((a) => a.title).join('; ');
  });
  test('anomalies', 'a flat synthetic network produces no branch anomaly', () => {
    // Reassign branches round-robin *within each status*, so every branch gets an
    // identical outcome mix. A detector that reports a gap here is inventing one.
    const flat = JSON.parse(JSON.stringify(raw));
    const byStatus = {};
    flat.leads.forEach((l) => { (byStatus[l.status] = byStatus[l.status] || []).push(l); });
    Object.values(byStatus).forEach((group) => {
      group.forEach((l, i) => { l.branch_id = raw.branches[i % raw.branches.length].id; });
    });
    const c = A.analyze(A.buildModel(flat), { range: 'all' });
    const branchAnoms = c.anomalies.filter((a) => a.type === 'Branch conversion');
    if (branchAnoms.length) throw new Error(branchAnoms.length + ' false positives: ' + branchAnoms.map((a) => a.title).join('; '));
    const spread = Math.max(...c.branchRows.map((b) => Math.abs(b.z)));
    return 'no false positives · max |z| ' + spread.toFixed(2) + ' across ' + c.branchRows.length + ' branches';
  });

  /* ---- insight generation ---- */
  test('insights', 'recommendations carry problem, evidence, impact, action and CTA', () => {
    if (!ctx.recommendations.length) throw new Error('none generated');
    ctx.recommendations.forEach((r) => {
      ['problem', 'impact', 'action', 'horizon'].forEach((k) => { if (!r[k]) throw new Error(r.id + ' missing ' + k); });
      if (!r.evidence.length) throw new Error(r.id + ' missing evidence');
      if (!r.cta.route.screen) throw new Error(r.id + ' CTA is not routable');
    });
    return ctx.recommendations.length + ' recommendations';
  });
  test('insights', 'executive brief quotes only computed figures', () => {
    const b = A.executiveBrief(ctx);
    if (!b.headline || b.findings.length < 3) throw new Error('brief incomplete');
    const weak = [...ctx.branchRows].sort((x, y) => x.z - y.z)[0];
    if (weak.z <= -2 && !b.headline.includes(weak.name)) throw new Error('brief omits the weakest branch');
    if (!b.headline.includes(A.fmtINR(ctx.aging.staleValue))) throw new Error('brief risk figure does not match analytics');
    return '3 findings, figures match the analytics layer';
  });
  test('insights', 'branch summary is generated for every branch', () => {
    model.branches.forEach((b) => {
      const s = A.branchSummary(ctx, b.id);
      if (!s || !s.performance || !s.problem || !s.opportunity || !s.action) throw new Error('incomplete for ' + b.name);
    });
    return 'all ' + model.branches.length + ' branches';
  });
  test('insights', 'why-explanations resolve for every KPI key', () => {
    ['units', 'revenue', 'conversion', 'risk', 'attainment', 'delay', 'pipeline'].forEach((k) => {
      const w = A.whyExplanation(ctx, k);
      if (!w.title || !w.points.length || !w.cta.route.screen) throw new Error(k + ' incomplete');
    });
    return '7 KPI explanations';
  });

  /* ---- ask engine ---- */
  test('ask', 'sample questions all resolve to an answer with evidence', () => {
    const fails = A.SAMPLE_QUESTIONS.filter((q) => {
      const r = A.askDealerPulse(ctx, q);
      return r.suggestions || !r.evidence.length || !r.cta;
    });
    if (fails.length) throw new Error('unanswered: ' + fails.join(' | '));
    return A.SAMPLE_QUESTIONS.length + ' questions answered';
  });
  test('ask', 'unanswerable questions decline instead of inventing', () => {
    ['what is the weather', 'who will win the election', 'tell me a joke'].forEach((q) => {
      const r = A.askDealerPulse(ctx, q);
      if (!r.suggestions) throw new Error('answered "' + q + '"');
      if (!/enough data/i.test(r.answer)) throw new Error('wrong fallback copy');
    });
    return '3 out-of-scope questions declined';
  });
  test('ask', 'branch diagnosis quotes the analytics conversion figure verbatim', () => {
    const weak = [...ctx.branchRows].sort((a, b) => a.z - b.z)[0];
    const r = A.askDealerPulse(ctx, 'why is ' + weak.name.replace(' Toyota', '') + ' underperforming?');
    if (!r.answer.includes(A.fmtPct(weak.maturedConversion))) throw new Error('answer figure differs from branchRows');
    if (!r.answer.includes(A.fmtPct(ctx.netMaturedConversion))) throw new Error('baseline figure differs');
    return weak.name + ': ' + A.fmtPct(weak.maturedConversion) + ' vs ' + A.fmtPct(ctx.netMaturedConversion);
  });

  /* ---- filters ---- */
  test('filters', 'branch filter narrows the cohort to that branch only', () => {
    const b = model.branches[2];
    const c = A.analyze(model, { range: 'all', branchId: b.id });
    if (c.cohort.some((l) => l.branchId !== b.id)) throw new Error('foreign leads in scope');
    const e = raw.leads.filter((l) => l.branch_id === b.id).length;
    if (c.cohort.length !== e) throw new Error(c.cohort.length + ' != ' + e);
    return b.name + ': ' + e + ' leads';
  });
  test('filters', 'date range narrows units without changing the open book', () => {
    const all = A.analyze(model, { range: 'all' });
    const q = A.analyze(model, { range: 'quarter' });
    if (q.kpi.units >= all.kpi.units) throw new Error('quarter not narrower');
    if (q.aging.openCount !== all.aging.openCount) throw new Error('open pipeline should be present-tense');
    return 'quarter ' + q.kpi.units + ' units vs ' + all.kpi.units + '; open book stable at ' + all.aging.openCount;
  });
  test('filters', 'CSV export emits one row per lead plus a header', () => {
    const csv = A.actionsCsv(ctx.actions.rows.slice(0, 5));
    const lines = csv.trim().split('\n');
    if (lines.length !== 6) throw new Error(lines.length + ' lines');
    if (lines[0].split(',').length !== 12) throw new Error('unexpected column count');
    return '12 columns, 5 rows + header';
  });

  return { model, ctx, tests: t };
}

export function runSuite(suite) {
  const results = suite.tests.map((t) => {
    try {
      const detail = t.fn();
      return { group: t.group, name: t.name, pass: true, detail: detail || '' };
    } catch (e) {
      return { group: t.group, name: t.name, pass: false, detail: (e && e.message) || String(e) };
    }
  });
  const groups = [];
  results.forEach((r) => {
    let g = groups.find((x) => x.name === r.group);
    if (!g) { g = { name: r.group, rows: [] }; groups.push(g); }
    g.rows.push(r);
  });
  groups.forEach((g) => {
    g.passed = g.rows.filter((r) => r.pass).length;
    g.failed = g.rows.length - g.passed;
  });
  return {
    groups,
    total: results.length,
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length
  };
}
