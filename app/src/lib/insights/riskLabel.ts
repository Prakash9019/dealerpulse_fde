import { quantile } from '../domain/model';

/** Discrete follow-up risk classification, derived only from numbers already
    computed elsewhere (idle days, deal value) — never a new heuristic. */
export type RiskLabel = 'new' | 'inactive' | 'at-risk' | 'stale' | 'critical' | 'high-value-stale';

export const RISK_LABEL_TEXT: Record<RiskLabel, string> = {
  new: 'New',
  inactive: 'Inactive',
  'at-risk': 'At risk',
  stale: 'Stale',
  critical: 'Critical',
  'high-value-stale': 'High-value stale',
};

/** High-value cutoff is the 75th percentile of the *current* open book's deal
    value — never a hardcoded rupee figure, so it moves with the data/filters. */
export function highValueThreshold(openLeads: { dealValue: number }[]): number {
  return quantile(openLeads.map((l) => l.dealValue), 0.75) || 0;
}

export function leadRiskLabel(idleDays: number, dealValue: number, threshold: number): RiskLabel {
  const highValue = threshold > 0 && dealValue >= threshold;
  if (idleDays >= 8 && highValue) return 'high-value-stale';
  if (idleDays >= 60) return 'critical';
  if (idleDays >= 31) return 'stale';
  if (idleDays >= 15) return 'at-risk';
  if (idleDays >= 8) return 'inactive';
  return 'new';
}
