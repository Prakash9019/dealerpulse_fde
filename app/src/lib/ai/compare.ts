/* Compare mode: pick two branches or two reps and get a narrated side-by-side.
   Grounded in the same computed rows every other screen reads from — no new
   analytics, just a diff and a sentence naming the widest funnel-stage gap. */
import type { BranchRow, Context } from '../analytics/context';
import type { RepRow } from '../analytics/reps';
import { div } from '../domain/model';
import { fmtINR, fmtNum, fmtPct, fmtSigned } from '../format';

export interface CompareMetric {
  label: string;
  aValue: string;
  bValue: string;
  winner: 'a' | 'b' | 'tie';
}

export interface CompareResult {
  aLabel: string;
  bLabel: string;
  metrics: CompareMetric[];
  narrative: string;
}

function metric(
  label: string,
  a: number,
  b: number,
  fmt: (v: number) => string,
  higherIsBetter = true,
): CompareMetric {
  const winner: 'a' | 'b' | 'tie' = a === b ? 'tie' : (a > b) === higherIsBetter ? 'a' : 'b';
  return { label, aValue: fmt(a), bValue: fmt(b), winner };
}

export function compareBranches(a: BranchRow, b: BranchRow): CompareResult {
  const metrics: CompareMetric[] = [
    metric('Conversion', a.maturedConversion, b.maturedConversion, fmtPct),
    metric('Units delivered', a.units, b.units, fmtNum),
    metric('Revenue', a.revenue, b.revenue, fmtINR),
    metric('Pipeline value', a.pipelineValue, b.pipelineValue, fmtINR),
    metric('Stale leads', a.staleCount, b.staleCount, fmtNum, false),
    metric('Delivery delay rate', a.delayRate, b.delayRate, (v) => fmtPct(v, 0), false),
    metric('Target attainment', a.attainment, b.attainment, (v) => fmtPct(v, 0)),
  ];

  const stageGaps = a.funnel.slice(1).map((s, i) => ({
    label: `${a.funnel[i].label} → ${s.label}`,
    gap: s.convFromPrev - b.funnel[i + 1].convFromPrev,
  }));
  const widest = stageGaps.reduce((max, s) => (Math.abs(s.gap) > Math.abs(max.gap) ? s : max));
  const leader = widest.gap >= 0 ? a : b;
  const trailer = widest.gap >= 0 ? b : a;

  const convGap = a.maturedConversion - b.maturedConversion;
  const narrative =
    `${a.name} converts ${fmtPct(a.maturedConversion)} against ${b.name}'s ${fmtPct(b.maturedConversion)} ` +
    `(${fmtSigned(convGap * 100, (v) => v.toFixed(1) + ' pts')}). The widest gap between them is ${widest.label}, ` +
    `where ${leader.name} outperforms ${trailer.name} by ${Math.abs(widest.gap * 100).toFixed(1)} points.`;

  return { aLabel: a.name, bLabel: b.name, metrics, narrative };
}

/** Synthetic "Network" side for the two -network comparison modes, built only
    from aggregate fields the Context already computes — no new analytics. */
function networkAsBranchRow(ctx: Context): BranchRow {
  return {
    id: 'network', name: 'Network', city: '', managerName: null,
    leads: ctx.allScoped.length, conversion: ctx.netMaturedConversion, maturedConversion: ctx.netMaturedConversion,
    maturedN: 0, contactRate: ctx.netFunnel[1].convFromPrev,
    units: ctx.kpi.units, revenue: ctx.kpi.revenue,
    attainment: ctx.targets.attainment, pace: ctx.targets.pace, gapUnits: ctx.targets.gapUnits,
    targetUnits: ctx.targets.targetUnits, targetRevenue: ctx.targets.targetRevenue,
    revenueAttainment: ctx.targets.revenueAttainment, paceMonth: ctx.targets.paceMonth,
    paceUnits: ctx.targets.paceUnits, paceTarget: 0, paceTrend: 0,
    pipelineValue: ctx.kpi.pipelineValue, revenueAtRisk: ctx.kpi.revenueAtRisk,
    staleCount: ctx.kpi.staleCount, openCount: ctx.openLeads.length,
    delayRate: ctx.kpi.delayRate, medianDaysToDeliver: ctx.kpi.medianDaysToDeliver,
    funnel: ctx.netFunnel, repCount: ctx.reps.length,
    convVsNetwork: 0, z: 0, convRank: 0, attainmentRank: 0, status: 'onTrack',
  };
}

function networkAsRepRow(ctx: Context): RepRow {
  return {
    id: 'network', name: 'Network', branchId: undefined, branchName: undefined, role: 'Network',
    leads: ctx.allScoped.length,
    contacted: ctx.allScoped.filter((l) => l.reached('contacted')).length,
    contactRate: ctx.netFunnel[1].convFromPrev,
    orders: ctx.allScoped.filter((l) => l.reached('order_placed')).length,
    delivered: ctx.kpi.units,
    conversion: ctx.netMaturedConversion,
    adjustedConversion: div(ctx.kpi.units, ctx.allScoped.filter((l) => l.reached('contacted')).length),
    pipelineValue: ctx.kpi.pipelineValue,
    revenue: ctx.kpi.revenue,
    openCount: ctx.openLeads.length,
    staleCount: ctx.kpi.staleCount, staleValue: ctx.aging.staleValue,
    lost: ctx.allScoped.filter((l) => l.status === 'lost').length,
    networkRank: 0, branchRank: 0, branchRepCount: 0, networkRankOf: 0,
  };
}

export function compareBranchToNetwork(a: BranchRow, ctx: Context): CompareResult {
  const result = compareBranches(a, networkAsBranchRow(ctx));
  return { ...result, bLabel: 'Network' };
}

export function compareRepToNetwork(a: RepRow, ctx: Context): CompareResult {
  const result = compareReps(a, networkAsRepRow(ctx));
  return { ...result, bLabel: 'Network' };
}

export function compareRepToBranch(a: RepRow, b: BranchRow): CompareResult {
  const branchOrders = b.funnel.find((s) => s.stage === 'order_placed')?.count ?? 0;
  const metrics: CompareMetric[] = [
    metric('Conversion', a.conversion, b.maturedConversion, fmtPct),
    metric('Leads handled', a.leads, b.leads, fmtNum),
    metric('Orders placed', a.orders, branchOrders, fmtNum),
    metric('Delivered', a.delivered, b.units, fmtNum),
    metric('Pipeline value', a.pipelineValue, b.pipelineValue, fmtINR),
    metric('Stale leads', a.staleCount, b.staleCount, fmtNum, false),
    metric('Contact rate', a.contactRate, b.contactRate, (v) => fmtPct(v, 0)),
  ];
  const convGap = a.conversion - b.maturedConversion;
  const narrative =
    `${a.name} converts ${fmtPct(a.conversion)} on ${fmtNum(a.leads)} leads against ${b.name}'s branch-wide ${fmtPct(b.maturedConversion)} ` +
    `(${fmtSigned(convGap * 100, (v) => v.toFixed(1) + ' pts')}).`;
  return { aLabel: a.name, bLabel: b.name, metrics, narrative };
}

export function compareReps(a: RepRow, b: RepRow): CompareResult {
  const metrics: CompareMetric[] = [
    metric('Conversion', a.conversion, b.conversion, fmtPct),
    metric('Leads handled', a.leads, b.leads, fmtNum),
    metric('Orders placed', a.orders, b.orders, fmtNum),
    metric('Delivered', a.delivered, b.delivered, fmtNum),
    metric('Pipeline value', a.pipelineValue, b.pipelineValue, fmtINR),
    metric('Stale leads', a.staleCount, b.staleCount, fmtNum, false),
    metric('Contact rate', a.contactRate, b.contactRate, (v) => fmtPct(v, 0)),
  ];

  const convGap = a.conversion - b.conversion;
  const better = convGap >= 0 ? a : b;
  const worse = convGap >= 0 ? b : a;
  const narrative =
    `${a.name} converts ${fmtPct(a.conversion)} on ${fmtNum(a.leads)} leads against ${b.name}'s ${fmtPct(b.conversion)} ` +
    `on ${fmtNum(b.leads)} (${fmtSigned(convGap * 100, (v) => v.toFixed(1) + ' pts')}). ${better.name} has contacted ` +
    `${fmtPct(better.contactRate, 0)} of assigned leads versus ${fmtPct(worse.contactRate, 0)} for ${worse.name}.`;

  return { aLabel: a.name, bLabel: b.name, metrics, narrative };
}
