/* Ported from logic/analytics.test.js — same 58 assertions, computed two ways
   (once by the analytics module, once by a naive independent pass over the raw JSON). */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as A from '../index';
import type { RawData } from '../domain/types';

const raw: RawData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../../data/dealership_data.json'), 'utf8'),
);

const model = A.buildModel(raw);
const ctx = A.analyze(model, { range: 'all' });

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;
const DAY = 86400000;
const asOf = new Date('2025-12-31T23:59:59Z');
const reached = (l: RawData['leads'][number], s: string) => l.status_history.some((h) => h.status === s);
const idle = (l: RawData['leads'][number]) => Math.floor((asOf.getTime() - new Date(l.last_activity_at).getTime()) / DAY);
const openRaw = raw.leads.filter((l) => !['delivered', 'lost'].includes(l.status));

describe('model', () => {
  it('every lead is normalised', () => {
    expect(model.leads.length).toBe(raw.leads.length);
  });
  it('status history is sorted ascending', () => {
    const bad = model.leads.find((l) => l.history.some((h, i) => i && h.at < l.history[i - 1].at));
    expect(bad).toBeUndefined();
  });
  it('branch managers are resolved from rep roles', () => {
    const missing = model.branches.filter((b) => !b.managerName);
    expect(missing).toHaveLength(0);
  });
  it('deliveries join to their lead', () => {
    const orphan = model.deliveries.filter((d) => !d.lead);
    expect(orphan).toHaveLength(0);
  });
  it('maturity window derives from observed lead→delivery time', () => {
    const days = raw.leads.filter((l) => reached(l, 'delivered'))
      .map((l) => (new Date(l.status_history.find((h) => h.status === 'delivered')!.timestamp).getTime() - new Date(l.created_at).getTime()) / DAY);
    const med = [...days].sort((a, b) => a - b)[Math.floor(days.length / 2)];
    expect(Math.abs(model.maturityDays - med)).toBeLessThanOrEqual(1);
  });
});

describe('funnel', () => {
  it('stage counts match a naive pass over history', () => {
    const expected = A.STAGES.map((s) => raw.leads.filter((l) => reached(l, s)).length);
    const got = ctx.netFunnel.map((s) => s.count);
    expect(got).toEqual(expected);
  });
  it('counts decrease monotonically down the funnel', () => {
    const c = ctx.netFunnel.map((s) => s.count);
    for (let i = 1; i < c.length; i++) expect(c[i]).toBeLessThanOrEqual(c[i - 1]);
  });
  it('stage conversion equals count ÷ previous count', () => {
    ctx.netFunnel.forEach((s, i) => {
      if (!i) return;
      const e = ctx.netFunnel[i - 1].count ? s.count / ctx.netFunnel[i - 1].count : 0;
      expect(near(s.convFromPrev, e)).toBe(true);
    });
  });
  it('drop-off plus progression accounts for every entrant', () => {
    ctx.netFunnel.forEach((s, i) => {
      if (!i) return;
      expect(s.count + s.dropOff).toBe(s.n);
    });
  });
  it('median stage duration is the true median', () => {
    const i = 4; // negotiation → order_placed
    const durs = raw.leads.filter((l) => reached(l, 'negotiation') && reached(l, 'order_placed')).map((l) =>
      (new Date(l.status_history.find((h) => h.status === 'order_placed')!.timestamp).getTime() -
        new Date(l.status_history.find((h) => h.status === 'negotiation')!.timestamp).getTime()) / DAY);
    const sorted = [...durs].sort((a, b) => a - b);
    const med = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    expect(near(ctx.netFunnel[i].medianDays!, med, 1e-6)).toBe(true);
  });
});

describe('conversion', () => {
  it('raw conversion equals delivered ÷ total', () => {
    const e = raw.leads.filter((l) => l.status === 'delivered').length / raw.leads.length;
    expect(near(ctx.kpi.rawConversion, e)).toBe(true);
  });
  it('matured conversion excludes leads younger than the maturity window', () => {
    const mature = raw.leads.filter((l) => (asOf.getTime() - new Date(l.created_at).getTime()) / DAY >= model.maturityDays);
    const e = mature.filter((l) => l.status === 'delivered').length / mature.length;
    expect(near(ctx.kpi.conversion!, e)).toBe(true);
    expect(ctx.kpi.conversionN).toBe(mature.length);
  });
  it('matured conversion is never below raw conversion', () => {
    expect(ctx.kpi.conversion!).toBeGreaterThanOrEqual(ctx.kpi.rawConversion - 1e-9);
  });
  it('a window with no matured cohort reports null, not zero', () => {
    const c = A.analyze(model, { range: '30d' });
    expect(c.kpi.conversion).toBeNull();
    expect(c.kpi.conversionNote).toBeTruthy();
  });
});

describe('aging', () => {
  it('idle days count back from the dataset end, not today', () => {
    const l = model.leads.find((x) => x.open)!;
    const raw2 = raw.leads.find((r) => r.id === l.id)!;
    const e = Math.floor((asOf.getTime() - new Date(raw2.last_activity_at).getTime()) / DAY);
    expect(l.idleDays).toBe(e);
  });
  it('buckets partition the open pipeline exactly once', () => {
    const total = ctx.aging.buckets.reduce((s, b) => s + b.count, 0);
    expect(total).toBe(openRaw.length);
    const ids = new Set<string>();
    ctx.aging.buckets.forEach((b) => b.leads.forEach((l) => {
      expect(ids.has(l.id)).toBe(false);
      ids.add(l.id);
    }));
  });
  it('stale set reconciles with the bucket evidence', () => {
    const fromBuckets = ctx.aging.buckets.filter((b) => b.min >= A.STALE_DAYS).reduce((s, b) => s + b.count, 0);
    expect(fromBuckets).toBe(ctx.aging.staleCount);
  });
  it('stale value equals the sum of stale deal values', () => {
    const e = openRaw.filter((l) => idle(l) >= A.STALE_DAYS).reduce((s, l) => s + l.deal_value, 0);
    expect(near(ctx.aging.staleValue, e, 1)).toBe(true);
  });
});

describe('risk', () => {
  it('revenue at risk is the stale share of open pipeline', () => {
    expect(ctx.kpi.revenueAtRisk).toBe(ctx.aging.staleValue);
    expect(ctx.kpi.revenueAtRisk).toBeLessThanOrEqual(ctx.kpi.pipelineValue);
  });
  it('lost and delivered leads are never counted as at-risk', () => {
    const bad = ctx.aging.stale.filter((l) => !l.open);
    expect(bad).toHaveLength(0);
  });
});

describe('targets', () => {
  it('attainment equals delivered units ÷ target units', () => {
    const tg = raw.targets.reduce((s, x) => s + x.target_units, 0);
    const units = raw.deliveries.length;
    expect(near(ctx.targets.attainment, units / tg, 1e-9)).toBe(true);
  });
  it('branch target units sum to the network target', () => {
    const sumV = ctx.branchRows.reduce((s, b) => s + b.targetUnits, 0);
    const e = raw.targets.reduce((s, x) => s + x.target_units, 0);
    expect(sumV).toBe(e);
  });
  it('pace uses the most recent month, not the whole period', () => {
    const last = model.months[model.months.length - 1];
    const tg = raw.targets.filter((x) => x.month === last).reduce((s, x) => s + x.target_units, 0);
    const units = raw.deliveries.filter((d) => d.delivery_date.slice(0, 7) === last).length;
    expect(near(ctx.targets.pace, units / tg, 1e-9)).toBe(true);
  });
});

describe('branches', () => {
  it('branch leads and units sum to the network totals', () => {
    const leads = ctx.branchRows.reduce((s, b) => s + b.leads, 0);
    const units = ctx.branchRows.reduce((s, b) => s + b.units, 0);
    expect(leads).toBe(ctx.cohort.length);
    expect(units).toBe(ctx.kpi.units);
  });
  it('conversion ranks are unique and complete', () => {
    const ranks = ctx.branchRows.map((b) => b.convRank).sort((a, b) => a - b);
    expect(ranks).toEqual(ctx.branchRows.map((_, i) => i + 1));
  });
  it('status comes from the z-test, not a fixed threshold', () => {
    const bad = ctx.branchRows.find((b) => (b.z <= -2.5) !== (b.status === 'critical'));
    expect(bad).toBeUndefined();
  });
  it('the weakest branch is discovered, not hardcoded', () => {
    const worst = [...ctx.branchRows].sort((a, b) => a.maturedConversion - b.maturedConversion)[0];
    const byZ = [...ctx.branchRows].sort((a, b) => a.z - b.z)[0];
    expect(worst.id).toBe(byZ.id);
    const shuffled = { ...raw, branches: [...raw.branches].reverse() };
    const alt = A.analyze(A.buildModel(shuffled), { range: 'all' });
    const altWorst = [...alt.branchRows].sort((a, b) => a.z - b.z)[0];
    expect(altWorst.id).toBe(worst.id);
  });
});

describe('leaks', () => {
  it('leaks are ranked by leads lost, not percentage gap', () => {
    const weak = [...ctx.branchRows].sort((a, b) => a.z - b.z)[0];
    const leaks = A.stageLeaks(weak.funnel, ctx.netFunnel);
    expect(leaks.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < leaks.length; i++) expect(leaks[i].excessLoss).toBeLessThanOrEqual(leaks[i - 1].excessLoss + 1e-9);
  });
  it('excess loss equals entrants × baseline shortfall', () => {
    const weak = [...ctx.branchRows].sort((a, b) => a.z - b.z)[0];
    A.stageLeaks(weak.funnel, ctx.netFunnel).forEach((l) => {
      expect(near(l.excessLoss, l.n * (l.net - l.conv), 1e-9)).toBe(true);
    });
  });
});

describe('reps', () => {
  it('rep lead counts sum to the network cohort', () => {
    const sumV = ctx.reps.reduce((s, r) => s + r.leads, 0);
    expect(sumV).toBe(ctx.cohort.length);
  });
  it('branch ranks are contiguous within each branch', () => {
    model.branches.forEach((b) => {
      const inb = ctx.reps.filter((r) => r.branchId === b.id).map((r) => r.branchRank).sort((x, y) => x - y);
      if (inb.length) expect(inb).toEqual(inb.map((_, i) => i + 1));
    });
  });
  it('rep conversion equals delivered ÷ assigned', () => {
    const r = ctx.reps[0];
    const mine = raw.leads.filter((l) => l.assigned_to === r.id);
    const e = mine.filter((l) => l.status === 'delivered').length / mine.length;
    expect(near(r.conversion, e)).toBe(true);
  });
});

describe('priority', () => {
  it('scores are strictly ordered — no ceiling saturation', () => {
    const scores = ctx.actions.rows.map((r) => r.score);
    const ties = scores.filter((s) => s === scores[0]).length;
    expect(ties).toBeLessThanOrEqual(1);
    for (let i = 1; i < scores.length; i++) expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
  });
  it('scores stay inside 1–100', () => {
    const bad = ctx.actions.rows.filter((r) => r.score < 1 || r.score > 100);
    expect(bad).toHaveLength(0);
  });
  it('higher value beats lower value when all else is equal', () => {
    const refs = A.priorityRefs(model, ctx.branchRows);
    const base = { status: 'negotiation' as const, idleDays: 20, dealValue: 1500000, overdue: false, branchId: 'ZZ', overdueDays: 0 };
    const lo = A.priorityScore(base, refs).score;
    const hi = A.priorityScore({ ...base, dealValue: 5000000 }, refs).score;
    expect(hi).toBeGreaterThan(lo);
  });
  it('longer idle beats shorter idle when all else is equal', () => {
    const refs = A.priorityRefs(model, ctx.branchRows);
    const base = { status: 'negotiation' as const, idleDays: 5, dealValue: 2000000, overdue: false, branchId: 'ZZ', overdueDays: 0 };
    const lo = A.priorityScore(base, refs).score;
    const hi = A.priorityScore({ ...base, idleDays: 60 }, refs).score;
    expect(hi).toBeGreaterThan(lo);
  });
  it('order-placed outranks an identical earlier-stage lead', () => {
    const refs = A.priorityRefs(model, ctx.branchRows);
    const base = { idleDays: 30, dealValue: 3000000, overdue: false, branchId: 'ZZ', overdueDays: 0 };
    const early = A.priorityScore({ ...base, status: 'contacted' as const }, refs).score;
    const late = A.priorityScore({ ...base, status: 'order_placed' as const }, refs).score;
    expect(late).toBeGreaterThan(early);
  });
  it('tiers partition the queue and follow the published cutoffs', () => {
    const q = ctx.actions;
    expect(q.critical.length + q.attention.length + q.watch.length).toBe(q.rows.length);
    expect(q.critical.some((r) => r.score < A.PRIORITY_TIERS.critical)).toBe(false);
    expect(q.attention.some((r) => r.score >= A.PRIORITY_TIERS.critical || r.score < A.PRIORITY_TIERS.attention)).toBe(false);
  });
  it('scores are stable under branch filtering', () => {
    const one = ctx.actions.rows[0];
    const filtered = A.analyze(model, { range: 'all', branchId: one.branchId });
    const same = filtered.actions.rows.find((r) => r.id === one.id);
    expect(same?.score).toBe(one.score);
  });
});

describe('deliveries', () => {
  it('delay rate equals deliveries carrying a reason', () => {
    const e = raw.deliveries.filter((d) => d.delay_reason).length / raw.deliveries.length;
    expect(near(ctx.delivery.delayRate, e)).toBe(true);
  });
  it('reason counts sum to the delayed total', () => {
    const sumV = ctx.delivery.reasons.reduce((s, r) => s + r.count, 0);
    expect(sumV).toBe(ctx.delivery.delayedCount);
  });
  it('monthly units sum to the period total', () => {
    const sumV = ctx.trend.reduce((s, m) => s + m.units, 0);
    expect(sumV).toBe(ctx.kpi.units);
  });
});

describe('sources', () => {
  it('source leads sum to the cohort and are sorted by conversion', () => {
    const sumV = ctx.sources.reduce((s, x) => s + x.leads, 0);
    expect(sumV).toBe(ctx.cohort.length);
    for (let i = 1; i < ctx.sources.length; i++) expect(ctx.sources[i].conversion).toBeLessThanOrEqual(ctx.sources[i - 1].conversion);
  });
});

describe('lost', () => {
  it('lost totals and stage attribution reconcile', () => {
    const lost = raw.leads.filter((l) => l.status === 'lost');
    expect(ctx.lost.total).toBe(lost.length);
    const byReason = ctx.lost.rows.reduce((s, r) => s + r.count, 0);
    const byStage = ctx.lost.byStage.reduce((s, r) => s + r.count, 0);
    expect(byReason).toBe(lost.length);
    expect(byStage).toBe(lost.length);
  });
});

describe('anomalies', () => {
  it('anomalies are produced and ordered by severity', () => {
    expect(ctx.anomalies.length).toBeGreaterThan(0);
    const rank: Record<string, number> = { critical: 0, risk: 1, watch: 2, opportunity: 3 };
    for (let i = 1; i < ctx.anomalies.length; i++) {
      expect(rank[ctx.anomalies[i].severity]).toBeGreaterThanOrEqual(rank[ctx.anomalies[i - 1].severity]);
    }
  });
  it('every anomaly carries evidence, impact and a CTA', () => {
    ctx.anomalies.forEach((a) => {
      expect(a.evidence.length).toBeGreaterThan(0);
      expect(a.impact).toBeTruthy();
      expect(a.cta?.route?.screen).toBeTruthy();
      expect(a.expected).toBeTruthy();
      expect(a.actual).toBeTruthy();
    });
  });
  it('positive findings are surfaced, not only problems', () => {
    expect(ctx.anomalies.some((a) => a.severity === 'opportunity')).toBe(true);
  });
  it('a flat synthetic network produces no branch anomaly', () => {
    const flat = JSON.parse(JSON.stringify(raw)) as RawData;
    const byStatus: Record<string, RawData['leads']> = {};
    flat.leads.forEach((l) => { (byStatus[l.status] = byStatus[l.status] || []).push(l); });
    Object.values(byStatus).forEach((group) => {
      group.forEach((l, i) => { l.branch_id = raw.branches[i % raw.branches.length].id; });
    });
    const c = A.analyze(A.buildModel(flat), { range: 'all' });
    const branchAnoms = c.anomalies.filter((a) => a.type === 'Branch conversion');
    expect(branchAnoms).toHaveLength(0);
  });
});

describe('insights', () => {
  it('recommendations carry problem, evidence, impact, action and CTA', () => {
    expect(ctx.recommendations.length).toBeGreaterThan(0);
    ctx.recommendations.forEach((r) => {
      expect(r.problem).toBeTruthy();
      expect(r.impact).toBeTruthy();
      expect(r.action).toBeTruthy();
      expect(r.horizon).toBeTruthy();
      expect(r.evidence.length).toBeGreaterThan(0);
      expect(r.cta.route.screen).toBeTruthy();
    });
  });
  it('executive brief quotes only computed figures', () => {
    const b = A.executiveBrief(ctx);
    expect(b.headline).toBeTruthy();
    expect(b.findings.length).toBeGreaterThanOrEqual(3);
    const weak = [...ctx.branchRows].sort((x, y) => x.z - y.z)[0];
    if (weak.z <= -2) expect(b.headline).toContain(weak.name);
    expect(b.headline).toContain(A.fmtINR(ctx.aging.staleValue));
  });
  it('branch summary is generated for every branch', () => {
    model.branches.forEach((b) => {
      const s = A.branchSummary(ctx, b.id);
      expect(s?.performance).toBeTruthy();
      expect(s?.problem).toBeTruthy();
      expect(s?.opportunity).toBeTruthy();
      expect(s?.action).toBeTruthy();
    });
  });
  it('why-explanations resolve for every KPI key', () => {
    (['units', 'revenue', 'conversion', 'risk', 'attainment', 'delay', 'pipeline'] as const).forEach((k) => {
      const w = A.whyExplanation(ctx, k);
      expect(w.title).toBeTruthy();
      expect(w.points.length).toBeGreaterThan(0);
      expect(w.cta.route.screen).toBeTruthy();
    });
  });
});

describe('ask', () => {
  it('sample questions all resolve to an answer with evidence', () => {
    const fails = A.SAMPLE_QUESTIONS.filter((q) => {
      const r = A.askDealerPulse(ctx, q);
      return r.suggestions || !r.evidence.length || !r.cta;
    });
    expect(fails).toHaveLength(0);
  });
  it('unanswerable questions decline instead of inventing', () => {
    ['what is the weather', 'who will win the election', 'tell me a joke'].forEach((q) => {
      const r = A.askDealerPulse(ctx, q);
      expect(r.suggestions).toBe(true);
      expect(/enough data/i.test(r.answer)).toBe(true);
    });
  });
  it('branch diagnosis quotes the analytics conversion figure verbatim', () => {
    const weak = [...ctx.branchRows].sort((a, b) => a.z - b.z)[0];
    const r = A.askDealerPulse(ctx, 'why is ' + weak.name.replace(' Toyota', '') + ' underperforming?');
    expect(r.answer).toContain(A.fmtPct(weak.maturedConversion));
    expect(r.answer).toContain(A.fmtPct(ctx.netMaturedConversion));
  });
});

describe('filters', () => {
  it('branch filter narrows the cohort to that branch only', () => {
    const b = model.branches[2];
    const c = A.analyze(model, { range: 'all', branchId: b.id });
    expect(c.cohort.some((l) => l.branchId !== b.id)).toBe(false);
    const e = raw.leads.filter((l) => l.branch_id === b.id).length;
    expect(c.cohort.length).toBe(e);
  });
  it('date range narrows units without changing the open book', () => {
    const all = A.analyze(model, { range: 'all' });
    const q = A.analyze(model, { range: 'quarter' });
    expect(q.kpi.units).toBeLessThan(all.kpi.units);
    expect(q.aging.openCount).toBe(all.aging.openCount);
  });
  it('CSV export emits one row per lead plus a header', () => {
    const csv = A.actionsCsv(ctx.actions.rows.slice(0, 5));
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(6);
    expect(lines[0].split(',')).toHaveLength(12);
  });
});
