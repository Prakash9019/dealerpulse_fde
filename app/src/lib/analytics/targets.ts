import { div, monthKey, sum } from '../domain/model';
import type { Model } from '../domain/types';

export interface TargetPerf {
  targetUnits: number;
  units: number;
  attainment: number;
  gapUnits: number;
  targetRevenue: number;
  revenue: number;
  revenueAttainment: number;
  pace: number;
  paceMonth: string | undefined;
  paceUnits: number;
  paceTarget: number;
  paceTrend: number;
  prevMonth: string | undefined;
}

export function targetPerf(model: Model, branchId: string | undefined, months: string[]): TargetPerf {
  const rows = model.targets.filter((t) => (!branchId || t.branchId === branchId) && months.includes(t.month));
  const targetUnits = sum(rows.map((r) => r.targetUnits));
  const targetRevenue = sum(rows.map((r) => r.targetRevenue));
  const dels = model.deliveries.filter((d) => (!branchId || d.branchId === branchId) && months.includes(monthKey(d.deliveryDate)));
  const units = dels.length, revenue = sum(dels.map((d) => d.revenue));
  const last = months[months.length - 1];
  const lastTarget = sum(model.targets.filter((t) => (!branchId || t.branchId === branchId) && t.month === last).map((r) => r.targetUnits));
  const lastUnits = model.deliveries.filter((d) => (!branchId || d.branchId === branchId) && monthKey(d.deliveryDate) === last).length;
  const prev = months[months.length - 2];
  const prevTarget = prev ? sum(model.targets.filter((t) => (!branchId || t.branchId === branchId) && t.month === prev).map((r) => r.targetUnits)) : 0;
  const prevUnits = prev ? model.deliveries.filter((d) => (!branchId || d.branchId === branchId) && monthKey(d.deliveryDate) === prev).length : 0;
  return {
    targetUnits, units, attainment: div(units, targetUnits), gapUnits: targetUnits - units,
    targetRevenue, revenue, revenueAttainment: div(revenue, targetRevenue),
    pace: div(lastUnits, lastTarget), paceMonth: last, paceUnits: lastUnits, paceTarget: lastTarget,
    paceTrend: div(lastUnits, lastTarget) - div(prevUnits, prevTarget), prevMonth: prev,
  };
}
