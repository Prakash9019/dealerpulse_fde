/* Data quality checks run once against the raw dataset. The AI/analytics
   layer never silently summarizes bad data — if these checks find anything,
   the About screen shows it explicitly and the caveat is threaded into the
   Gemini system prompt so it doesn't state confident claims over compromised
   rows. Detection only: nothing here mutates the source data (the one
   sanctioned repair — the "{}" template bug — happens in buildModel, for
   display only, and is unaffected by this file). */
import { STAGES } from './model';
import type { Model } from './types';

export interface DataQualityIssue {
  type: string;
  count: number;
  examples: string[];
}

export interface DataQualityReport {
  issues: DataQualityIssue[];
  severity: 'clean' | 'minor' | 'significant';
}

export function checkDataQuality(model: Model): DataQualityReport {
  const issues: DataQualityIssue[] = [];
  const stageSet = new Set<string>([...STAGES, 'lost']);
  const seenIds = new Set<string>();
  const dupes: string[] = [];
  const missingCustomer: string[] = [];
  const missingDealValue: string[] = [];
  const invalidBranch: string[] = [];
  const invalidRep: string[] = [];
  const invalidStage: string[] = [];
  const futureDated: string[] = [];

  model.leads.forEach((l) => {
    if (seenIds.has(l.id)) dupes.push(l.id);
    seenIds.add(l.id);
    if (!l.customerName || !l.customerName.trim()) missingCustomer.push(l.id);
    if (l.dealValue == null || Number.isNaN(l.dealValue) || l.dealValue < 0) missingDealValue.push(l.id);
    if (!model.branchById[l.branchId]) invalidBranch.push(l.id);
    if (!model.repById[l.repId]) invalidRep.push(l.id);
    if (!stageSet.has(l.status)) invalidStage.push(l.id);
    if (l.createdAt.getTime() > model.asOf.getTime()) futureDated.push(l.id);
  });

  const push = (type: string, ids: string[]) => {
    if (ids.length) issues.push({ type, count: ids.length, examples: ids.slice(0, 5) });
  };

  push('Duplicate lead IDs', dupes);
  push('Missing customer name', missingCustomer);
  push('Missing or invalid deal value', missingDealValue);
  push('References an unknown branch', invalidBranch);
  push('References an unknown rep', invalidRep);
  push('Unrecognised lead stage', invalidStage);
  push('Created after the data-as-of date', futureDated);

  const totalFlagged = issues.reduce((s, i) => s + i.count, 0);
  const severity: DataQualityReport['severity'] =
    totalFlagged === 0 ? 'clean' : totalFlagged / model.leads.length > 0.02 ? 'significant' : 'minor';

  return { issues, severity };
}
