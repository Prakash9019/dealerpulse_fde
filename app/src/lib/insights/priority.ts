import { PRIORITY_TIERS, STAGE_LABEL, STAGE_WEIGHT, median } from '../domain/model';
import { fmtINR } from '../format';
import type { Lead, Model } from '../domain/types';
import type { BranchRow } from '../analytics/context';
import { type RiskLabel, highValueThreshold, leadRiskLabel } from './riskLabel';

export interface PriorityRefs {
  medianDealValue: number;
  weakBranches: string[];
  rawMax: number;
}

export interface PriorityRaw {
  raw: number;
  valueF: number;
  idleF: number;
  stageF: number;
  riskF: number;
  risks: string[];
}

export interface PriorityScored extends PriorityRaw {
  score: number;
}

export interface ActionRow extends Lead, PriorityScored {
  tier: 'critical' | 'attention' | 'watch';
  riskLabel: RiskLabel;
  reason: string;
  suggestedAction: string;
}

export interface ActionQueue {
  rows: ActionRow[];
  critical: ActionRow[];
  attention: ActionRow[];
  watch: ActionRow[];
  totalValue: number;
  criticalValue: number;
}

/** Raw business exposure: value x urgency x stage proximity to revenue x risk flags. */
export function priorityRaw(lead: Pick<Lead, 'dealValue' | 'idleDays' | 'status' | 'overdue' | 'overdueDays' | 'branchId'>, refs: PriorityRefs): PriorityRaw {
  const valueF = Math.min(2.4, Math.max(0.35, lead.dealValue / (refs.medianDealValue || 1)));
  const idleF = Math.min(5, Math.log2(1 + lead.idleDays / 3.5));
  const stageF = STAGE_WEIGHT[lead.status] || 0.3;
  let riskF = 1;
  const risks: string[] = [];
  if (lead.overdue) { riskF *= 1.25; risks.push('Past expected close date by ' + lead.overdueDays + ' days'); }
  if (refs.weakBranches && refs.weakBranches.includes(lead.branchId)) { riskF *= 1.12; risks.push('Branch converting below network baseline'); }
  if (lead.idleDays >= 30) { riskF *= 1.15; risks.push('Idle for over a month'); }
  return { raw: valueF * idleF * stageF * riskF, valueF, idleF, stageF, riskF, risks };
}

/** Shared reference set. rawMax normalises the score across the whole open book, so
    scores stay strictly ordered (no ceiling) and are stable under filtering. */
export function priorityRefs(model: Model, branchRows: BranchRow[] | undefined): PriorityRefs {
  const refs: PriorityRefs = {
    medianDealValue: median(model.leads.map((l) => l.dealValue)) || 1,
    weakBranches: (branchRows || []).filter((b) => b.z <= -2).map((b) => b.id),
    rawMax: 1,
  };
  const open = model.leads.filter((l) => l.open);
  refs.rawMax = Math.max(0.001, ...open.map((l) => priorityRaw(l, refs).raw));
  return refs;
}

/** Priority score, 1-100, normalised against the strongest case in the open book. */
export function priorityScore(lead: Pick<Lead, 'dealValue' | 'idleDays' | 'status' | 'overdue' | 'overdueDays' | 'branchId'>, refs: PriorityRefs): PriorityScored {
  const p = priorityRaw(lead, refs);
  const score = Math.max(1, Math.min(100, Math.round((p.raw / (refs.rawMax || 1)) * 100)));
  return { ...p, score };
}

/** AI lead explanation — assembled only from fields that exist on the lead. */
export function leadReason(lead: Lead): string {
  const parts: string[] = [];
  if (lead.status === 'order_placed') parts.push('Order placed ' + lead.idleDays + ' days ago with no recorded activity since');
  else parts.push(STAGE_LABEL[lead.status] + ' stage, no activity for ' + lead.idleDays + ' days');
  parts.push('deal value ' + fmtINR(lead.dealValue));
  if (lead.overdue) parts.push('expected close was ' + lead.overdueDays + ' days ago');
  return parts.join(' · ');
}

export function actionQueue(ctx: { model: Model; branchRows: BranchRow[]; openLeads: Lead[] }): ActionQueue {
  const model = ctx.model;
  const refs = priorityRefs(model, ctx.branchRows);
  const threshold = highValueThreshold(ctx.openLeads);
  const rows: ActionRow[] = ctx.openLeads.map((l) => {
    const p = priorityScore(l, refs);
    const tier: 'critical' | 'attention' | 'watch' = p.score >= PRIORITY_TIERS.critical ? 'critical' : p.score >= PRIORITY_TIERS.attention ? 'attention' : 'watch';
    return {
      ...l, ...p, tier,
      riskLabel: leadRiskLabel(l.idleDays, l.dealValue, threshold),
      reason: leadReason(l),
      suggestedAction: l.status === 'order_placed'
        ? (l.idleDays >= 30 ? 'Escalate to delivery ops' : 'Confirm delivery date')
        : l.status === 'negotiation' ? 'Close with a firm offer'
        : l.status === 'test_drive' ? 'Follow up post test-drive'
        : l.status === 'new' ? 'Make first contact' : 'Re-engage and qualify',
    };
  }).sort((a, b) => b.score - a.score);
  return {
    rows,
    critical: rows.filter((r) => r.tier === 'critical'),
    attention: rows.filter((r) => r.tier === 'attention'),
    watch: rows.filter((r) => r.tier === 'watch'),
    totalValue: rows.reduce((s, r) => s + r.dealValue, 0),
    criticalValue: rows.filter((r) => r.tier === 'critical').reduce((s, r) => s + r.dealValue, 0),
  };
}

