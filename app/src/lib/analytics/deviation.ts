import { funnel, stageLeaks, type FunnelStage, type StageLeak } from './funnel';
import type { BranchRow } from './context';
import type { RepRow } from './reps';
import type { Lead } from '../domain/types';

export interface FunnelDeviation {
  entityType: 'branch' | 'rep';
  entityId: string;
  entityName: string;
  leak: StageLeak;
}

/** Scans every branch's and every rep's funnel against the network baseline and
    returns the single worst leak by leads lost. Composes the existing
    stageLeaks() primitive — no new statistic is invented here, and stageLeaks'
    own minN=8 filter already excludes low-sample entities. */
export function largestFunnelDeviation(
  branchRows: BranchRow[],
  repRows: RepRow[],
  leads: Lead[],
  netFunnel: FunnelStage[],
): FunnelDeviation | null {
  const candidates: FunnelDeviation[] = [];

  branchRows.forEach((b) => {
    const leak = stageLeaks(b.funnel, netFunnel)[0];
    if (leak) candidates.push({ entityType: 'branch', entityId: b.id, entityName: b.name, leak });
  });

  repRows.forEach((r) => {
    const repFunnel = funnel(leads.filter((l) => l.repId === r.id));
    const leak = stageLeaks(repFunnel, netFunnel)[0];
    if (leak) candidates.push({ entityType: 'rep', entityId: r.id, entityName: r.name, leak });
  });

  if (!candidates.length) return null;
  return candidates.reduce((max, c) => (c.leak.excessLoss > max.leak.excessLoss ? c : max));
}
