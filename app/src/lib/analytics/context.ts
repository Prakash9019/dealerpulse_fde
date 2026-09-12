import { STALE_DAYS, div, mean, median, sum, zProportion } from '../domain/model';
import type { Delivery, Filters, Lead, Model } from '../domain/types';
import { type Aging, aging } from './aging';
import { type DeliveryPerf, deliveryPerf } from './deliveries';
import { type FunnelStage, conversion, funnel, maturedConversion } from './funnel';
import { type RepRow, repRows } from './reps';
import { type TargetPerf, targetPerf } from './targets';
import { type LostReasons, type MonthlyTrendRow, type SourcePerfRow, lostReasons, monthlyTrend, sourcePerf } from './trends';
import { type ActionQueue, actionQueue } from '../insights/priority';
import { type Anomaly, detectAnomalies } from '../insights/anomalies';
import { type Recommendation, buildRecommendations } from '../insights/recommendations';

const DAY = 86400000;

export const RANGE_PRESETS = [
  { key: 'all', label: 'All time' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'quarter', label: 'Last quarter' },
  { key: 'month', label: 'December 2025' },
];

export interface ResolvedRange {
  from: Date;
  to: Date;
  key: string;
  label: string;
}

export function resolveRange(model: Model, key: string | undefined, custom?: { from?: string; to?: string }): ResolvedRange {
  const end = model.asOf;
  if (key === 'custom' && custom?.from && custom?.to) {
    return { from: new Date(custom.from + 'T00:00:00Z'), to: new Date(custom.to + 'T23:59:59Z'), key, label: 'Custom' };
  }
  if (key === '30d') return { from: new Date(end.getTime() - 30 * DAY), to: end, key, label: 'Last 30 days' };
  if (key === 'quarter') return { from: new Date(Date.UTC(2025, 9, 1)), to: end, key, label: 'Last quarter (Oct–Dec)' };
  if (key === 'month') return { from: new Date(Date.UTC(2025, 11, 1)), to: end, key, label: 'December 2025' };
  return { from: model.dataStart, to: end, key: 'all', label: 'All time (Jun–Dec 2025)' };
}

export interface BranchRow {
  id: string;
  name: string;
  city: string;
  managerName: string | null;
  leads: number;
  conversion: number;
  maturedConversion: number;
  maturedN: number;
  contactRate: number;
  units: number;
  revenue: number;
  attainment: number;
  pace: number;
  gapUnits: number;
  targetUnits: number;
  targetRevenue: number;
  revenueAttainment: number;
  paceMonth: string | undefined;
  paceUnits: number;
  paceTarget: number;
  paceTrend: number;
  pipelineValue: number;
  revenueAtRisk: number;
  staleCount: number;
  openCount: number;
  delayRate: number;
  medianDaysToDeliver: number | null;
  funnel: FunnelStage[];
  repCount: number;
  convVsNetwork: number;
  z: number;
  convRank: number;
  attainmentRank: number;
  status: 'critical' | 'watch' | 'healthy' | 'onTrack';
}

export interface Kpi {
  units: number;
  prevUnits: number;
  revenue: number;
  prevRevenue: number;
  conversion: number | null;
  prevConversion: number | null;
  conversionN: number;
  conversionExcluded: number;
  conversionNote: string;
  rawConversion: number;
  leads: number;
  prevLeads: number;
  revenueAtRisk: number;
  staleCount: number;
  pipelineValue: number;
  openCount: number;
  delayRate: number;
  prevDelayRate: number;
  medianDaysToDeliver: number | null;
  avgDealValue: number;
}

export interface StageDuration {
  from: string;
  to: string;
  label: string;
  medianDays: number | null;
  p90Days: number | null;
  conversion: number;
  n: number;
  dropOff: number;
}

export interface Context {
  model: Model;
  filters: Filters;
  range: ResolvedRange;
  months: string[];
  scopeLabel: string;
  cohort: Lead[];
  allScoped: Lead[];
  openLeads: Lead[];
  dels: Delivery[];
  kpi: Kpi;
  funnel: FunnelStage[];
  netFunnel: FunnelStage[];
  netMaturedConversion: number;
  aging: Aging;
  delivery: DeliveryPerf;
  trend: MonthlyTrendRow[];
  targets: TargetPerf;
  branchRows: BranchRow[];
  reps: RepRow[];
  sources: SourcePerfRow[];
  netSources: SourcePerfRow[];
  lost: LostReasons;
  stageDurations: StageDuration[];
  actions: ActionQueue;
  anomalies: Anomaly[];
  recommendations: Recommendation[];
}

/** The single analytics context every screen reads from. */
export function analyze(model: Model, filters: Filters = {}): Context {
  const range = resolveRange(model, filters.range || 'all', filters.custom);
  const inRange = (d: Date) => d >= range.from && d <= range.to;
  const months = model.months.filter((m) => {
    const s = new Date(m + '-01T00:00:00Z');
    const e = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 0, 23, 59, 59));
    return e >= range.from && s <= range.to;
  });
  const scopeMatch = (x: { branchId?: string; repId?: string }) =>
    (!filters.branchId || x.branchId === filters.branchId) && (!filters.repId || x.repId === filters.repId);

  const cohort = model.leads.filter((l) => inRange(l.createdAt) && scopeMatch(l));
  const allScoped = model.leads.filter(scopeMatch);
  const openLeads = allScoped.filter((l) => l.open);
  const dels = model.deliveries.filter((d) => inRange(new Date(d.deliveryDate + 'T12:00:00Z')) && scopeMatch(d));

  // previous equal-length window, for deltas
  const span = range.to.getTime() - range.from.getTime();
  const pFrom = new Date(range.from.getTime() - span - DAY), pTo = new Date(range.from.getTime() - DAY);
  const prevDels = model.deliveries.filter((d) => {
    const dd = new Date(d.deliveryDate + 'T12:00:00Z');
    return dd >= pFrom && dd <= pTo && scopeMatch(d);
  });
  const prevCohort = model.leads.filter((l) => l.createdAt >= pFrom && l.createdAt <= pTo && scopeMatch(l));

  const f = funnel(cohort);
  const netFunnel = funnel(model.leads.filter((l) => inRange(l.createdAt)));
  const matured = maturedConversion(cohort, model.asOf, model.maturityDays);
  const prevMatured = maturedConversion(prevCohort, model.asOf, model.maturityDays);
  const age = aging(openLeads);
  const deliv = deliveryPerf(dels);
  const prevDeliv = deliveryPerf(prevDels);
  const trend = monthlyTrend(model, months, filters);
  const tg = targetPerf(model, filters.branchId, months);

  const branchRows: BranchRow[] = model.branches.map((b) => {
    const ls = model.leads.filter((l) => l.branchId === b.id && inRange(l.createdAt));
    const bOpen = model.leads.filter((l) => l.branchId === b.id && l.open);
    const bStale = bOpen.filter((l) => l.idleDays >= STALE_DAYS);
    const bd = model.deliveries.filter((d) => d.branchId === b.id && inRange(new Date(d.deliveryDate + 'T12:00:00Z')));
    const bt = targetPerf(model, b.id, months);
    const bf = funnel(ls);
    const bm = maturedConversion(ls, model.asOf, model.maturityDays);
    return {
      id: b.id, name: b.name, city: b.city, managerName: b.managerName,
      leads: ls.length, conversion: conversion(ls), maturedConversion: bm.rate, maturedN: bm.n,
      contactRate: bf[1].convFromPrev,
      units: bd.length, revenue: sum(bd.map((d) => d.revenue)),
      attainment: bt.attainment, pace: bt.pace, gapUnits: bt.gapUnits,
      targetUnits: bt.targetUnits, targetRevenue: bt.targetRevenue, revenueAttainment: bt.revenueAttainment,
      paceMonth: bt.paceMonth, paceUnits: bt.paceUnits, paceTarget: bt.paceTarget, paceTrend: bt.paceTrend,
      pipelineValue: sum(bOpen.map((l) => l.dealValue)),
      revenueAtRisk: sum(bStale.map((l) => l.dealValue)),
      staleCount: bStale.length, openCount: bOpen.length,
      delayRate: div(bd.filter((d) => d.delayed).length, bd.length),
      medianDaysToDeliver: median(bd.map((d) => d.daysToDeliver)),
      funnel: bf, repCount: b.repIds.length,
    } as BranchRow;
  });

  const netMatured = maturedConversion(model.leads.filter((l) => inRange(l.createdAt)), model.asOf, model.maturityDays);
  branchRows.forEach((r) => {
    r.convVsNetwork = r.maturedConversion - netMatured.rate;
    r.z = zProportion(Math.round(r.maturedConversion * r.maturedN), r.maturedN, netMatured.rate || 0.0001);
  });
  const ranked = [...branchRows].sort((a, b) => b.maturedConversion - a.maturedConversion);
  ranked.forEach((r, i) => { r.convRank = i + 1; });
  [...branchRows].sort((a, b) => b.attainment - a.attainment).forEach((r, i) => { r.attainmentRank = i + 1; });
  branchRows.forEach((r) => {
    r.status = r.z <= -2.5 ? 'critical' : r.z <= -1.4 ? 'watch' : r.convVsNetwork > 0.03 ? 'healthy' : 'onTrack';
  });

  const reps = repRows(model, allScoped.filter((l) => inRange(l.createdAt)), dels);

  const ctx = {
    model, filters, range, months,
    scopeLabel: filters.repId ? model.repById[filters.repId]?.name
      : filters.branchId ? model.branchById[filters.branchId]?.name : 'Network',
    cohort, allScoped, openLeads, dels,
    kpi: {
      units: dels.length, prevUnits: prevDels.length,
      revenue: deliv.revenue, prevRevenue: prevDeliv.revenue,
      conversion: matured.n >= 10 ? matured.rate : null,
      prevConversion: prevMatured.n >= 10 ? prevMatured.rate : null,
      conversionN: matured.n, conversionExcluded: matured.excluded,
      conversionNote: matured.n >= 10
        ? matured.n + ' of ' + cohort.length + ' leads in range are old enough to have closed (median lead→delivery is ' + model.maturityDays + ' days)'
        : 'Too few matured leads in this window to state a conversion rate — leads need about ' + model.maturityDays + ' days to close.',
      rawConversion: conversion(cohort),
      leads: cohort.length, prevLeads: prevCohort.length,
      revenueAtRisk: age.staleValue, staleCount: age.staleCount,
      pipelineValue: age.openValue, openCount: age.openCount,
      delayRate: deliv.delayRate, prevDelayRate: prevDeliv.delayRate,
      medianDaysToDeliver: deliv.medianDays,
      avgDealValue: mean(cohort.map((l) => l.dealValue)),
    },
    funnel: f, netFunnel, netMaturedConversion: netMatured.rate,
    aging: age, delivery: deliv, trend, targets: tg,
    branchRows, reps,
    sources: sourcePerf(cohort), netSources: sourcePerf(model.leads.filter((l) => inRange(l.createdAt))),
    lost: lostReasons(cohort),
    stageDurations: f.slice(1).map((s, i) => ({
      from: f[i].stage, to: s.stage, label: f[i].label + ' → ' + s.label,
      medianDays: s.medianDays, p90Days: s.p90Days, conversion: s.convFromPrev, n: s.n, dropOff: s.dropOff,
    })),
  } as Context;
  ctx.actions = actionQueue(ctx);
  ctx.anomalies = detectAnomalies(ctx);
  ctx.recommendations = buildRecommendations(ctx);
  return ctx;
}
