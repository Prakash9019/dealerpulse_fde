import { MONTH_LABEL, SOURCE_LABEL, STAGE_LABEL, STAGES, div, median, monthKey, sum } from '../domain/model';
import type { Filters, Lead, Model } from '../domain/types';
import { conversion } from './funnel';

const DAY = 86400000;

export interface MonthlyTrendRow {
  month: string;
  label: string;
  units: number;
  revenue: number;
  delayed: number;
  delayRate: number;
  medianDaysToDeliver: number | null;
  leadsCreated: number;
  ordersPlaced: number;
  ordersValue: number;
  targetUnits: number;
  cohortConversion: number | null;
  cohortMature: number;
}

export function monthlyTrend(model: Model, months: string[], scope: Pick<Filters, 'branchId' | 'repId'> = {}): MonthlyTrendRow[] {
  return months.map((m) => {
    const dels = model.deliveries.filter((d) =>
      monthKey(d.deliveryDate) === m &&
      (!scope.branchId || d.branchId === scope.branchId) &&
      (!scope.repId || d.repId === scope.repId));
    const created = model.leads.filter((l) =>
      monthKey(l.createdAt) === m &&
      (!scope.branchId || l.branchId === scope.branchId) &&
      (!scope.repId || l.repId === scope.repId));
    const tg = model.targets.filter((t) => t.month === m && (!scope.branchId || t.branchId === scope.branchId));
    const orders = model.leads.filter((l) => l.stageAt.order_placed &&
      monthKey(l.stageAt.order_placed) === m &&
      (!scope.branchId || l.branchId === scope.branchId) &&
      (!scope.repId || l.repId === scope.repId));
    const mature = created.filter((l) => (model.asOf.getTime() - l.createdAt.getTime()) / DAY >= model.maturityDays);
    return {
      month: m, label: MONTH_LABEL(m),
      units: dels.length, revenue: sum(dels.map((d) => d.revenue)),
      delayed: dels.filter((d) => d.delayed).length,
      delayRate: div(dels.filter((d) => d.delayed).length, dels.length),
      medianDaysToDeliver: median(dels.map((d) => d.daysToDeliver)),
      leadsCreated: created.length,
      ordersPlaced: orders.length, ordersValue: sum(orders.map((l) => l.dealValue)),
      targetUnits: sum(tg.map((t) => t.targetUnits)),
      cohortConversion: mature.length ? conversion(mature) : null,
      cohortMature: mature.length,
    };
  });
}

export interface SourcePerfRow {
  source: string;
  label: string;
  leads: number;
  delivered: number;
  conversion: number;
  /** Conversion among leads that were actually contacted — strips out the
      "never even worked" leads so a low headline number can be diagnosed as
      either a lead-quality problem (both numbers low) or a contact-process
      failure (headline low, adjusted much higher). */
  adjustedConversion: number;
  contacted: number;
  revenue: number;
  contactRate: number;
}

export function sourcePerf(leads: Lead[]): SourcePerfRow[] {
  const keys = [...new Set(leads.map((l) => l.source))];
  return keys.map((s) => {
    const ls = leads.filter((l) => l.source === s);
    const del = ls.filter((l) => l.status === 'delivered');
    const contacted = ls.filter((l) => 'contacted' in l.stageAt);
    return {
      source: s, label: SOURCE_LABEL[s] || s, leads: ls.length,
      delivered: del.length, conversion: div(del.length, ls.length),
      adjustedConversion: div(del.length, contacted.length),
      contacted: contacted.length,
      revenue: sum(del.map((l) => l.dealValue)),
      contactRate: div(contacted.length, ls.length),
    };
  }).sort((a, b) => b.conversion - a.conversion);
}

export interface LostReasonRow {
  reason: string;
  count: number;
  value: number;
}

export interface LostByStageRow {
  stage: string;
  label: string;
  count: number;
}

export interface LostReasons {
  total: number;
  value: number;
  rows: LostReasonRow[];
  byStage: LostByStageRow[];
}

export function lostReasons(leads: Lead[]): LostReasons {
  const lost = leads.filter((l) => l.status === 'lost');
  const m: Record<string, LostReasonRow> = {};
  lost.forEach((l) => {
    const k = l.lostReason || 'Not recorded';
    m[k] = m[k] || { reason: k, count: 0, value: 0 };
    m[k].count++; m[k].value += l.dealValue;
  });
  return {
    total: lost.length, value: sum(lost.map((l) => l.dealValue)),
    rows: Object.values(m).sort((a, b) => b.count - a.count),
    byStage: STAGES.slice(0, 5).map((s) => ({
      stage: s, label: STAGE_LABEL[s], count: lost.filter((l) => l.lostFrom === s).length,
    })),
  };
}
