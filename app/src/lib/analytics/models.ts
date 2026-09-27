import { div, sum } from '../domain/model';
import type { Lead } from '../domain/types';

export interface ModelPerfRow {
  model: string;
  leads: number;
  leadShare: number;
  testDriven: number;
  testDriveRate: number;
  delivered: number;
  conversion: number;
  revenue: number;
  revenueShare: number;
  avgDealValue: number;
}

/** Per-model (not per-branch/rep) rollup — not all leads are worth the same:
    a model that's a small share of leads but a large share of revenue (or the
    reverse) misleads a pure lead-count view of demand. */
export function modelPerf(leads: Lead[]): ModelPerfRow[] {
  const keys = [...new Set(leads.map((l) => l.model))];
  const totalLeads = leads.length;
  const totalRevenue = sum(leads.filter((l) => l.status === 'delivered').map((l) => l.dealValue));
  return keys.map((m) => {
    const ls = leads.filter((l) => l.model === m);
    const del = ls.filter((l) => l.status === 'delivered');
    const testDriven = ls.filter((l) => l.reached('test_drive'));
    const revenue = sum(del.map((l) => l.dealValue));
    return {
      model: m, leads: ls.length, leadShare: div(ls.length, totalLeads),
      testDriven: testDriven.length, testDriveRate: div(testDriven.length, ls.length),
      delivered: del.length, conversion: div(del.length, ls.length),
      revenue, revenueShare: div(revenue, totalRevenue),
      avgDealValue: del.length ? revenue / del.length : 0,
    };
  }).sort((a, b) => b.revenue - a.revenue);
}

export interface DemandMismatch {
  model: string;
  leadShare: number;
  revenueShare: number;
  gap: number;
}

/** The single sharpest "not all leads are equal" finding: the model with the
    widest gap between its share of lead volume and its share of delivered
    revenue, in either direction. Gated on a minimum lead share so a
    one-lead model with 100% revenue share can't win on a fluke. */
export function widestDemandMismatch(rows: ModelPerfRow[], minLeadShare = 0.05): DemandMismatch | null {
  const eligible = rows.filter((r) => r.leadShare >= minLeadShare);
  if (!eligible.length) return null;
  const widest = [...eligible].sort((a, b) => Math.abs(b.revenueShare - b.leadShare) - Math.abs(a.revenueShare - a.leadShare))[0];
  return { model: widest.model, leadShare: widest.leadShare, revenueShare: widest.revenueShare, gap: widest.revenueShare - widest.leadShare };
}
