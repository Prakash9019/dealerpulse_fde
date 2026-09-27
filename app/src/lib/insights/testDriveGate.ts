import { sum } from '../domain/model';
import type { Lead } from '../domain/types';

export interface TestDriveGateBranch {
  branchId: string;
  branchName: string;
  count: number;
  value: number;
}

export interface TestDriveGate {
  /** Leads that reached Contacted but never reached Test Drive — the hard gate. */
  neverTestDriven: number;
  neverTestDrivenValue: number;
  /** Of those, how many were ever delivered anyway (should be ~0 — the whole point). */
  deliveredDespiteGate: number;
  byBranch: TestDriveGateBranch[];
}

/** Test drive is a hard gate, not a soft stage: leads that reach Contacted but never
    reach Test Drive have essentially never delivered, regardless of how long they sit
    open. This is a structural fact about the funnel, not a rate — computed directly
    from status_history, never estimated. */
export function testDriveGate(leads: Lead[]): TestDriveGate {
  const stalled = leads.filter((l) => l.reached('contacted') && !l.reached('test_drive'));
  const byBranchMap = new Map<string, TestDriveGateBranch>();
  stalled.forEach((l) => {
    const row = byBranchMap.get(l.branchId) || { branchId: l.branchId, branchName: l.branchName, count: 0, value: 0 };
    row.count++;
    row.value += l.dealValue;
    byBranchMap.set(l.branchId, row);
  });
  return {
    neverTestDriven: stalled.length,
    neverTestDrivenValue: sum(stalled.map((l) => l.dealValue)),
    deliveredDespiteGate: stalled.filter((l) => l.status === 'delivered').length,
    byBranch: [...byBranchMap.values()].sort((a, b) => b.value - a.value),
  };
}
