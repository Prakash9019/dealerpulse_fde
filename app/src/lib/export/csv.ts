import { STAGE_LABEL } from '../domain/model';
import type { ActionRow } from '../insights/priority';

export function actionsCsv(rows: ActionRow[]): string {
  const head = ['Lead ID', 'Customer', 'Model', 'Branch', 'Rep', 'Stage', 'Deal Value (INR)', 'Days Idle', 'Priority', 'Tier', 'Reason', 'Suggested Action'];
  const esc = (v: unknown) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  return [head.join(','), ...rows.map((r) => [
    r.id, r.customerName, r.model, r.branchName, r.repName, STAGE_LABEL[r.status],
    r.dealValue, r.idleDays, r.score, r.tier, r.reason, r.suggestedAction,
  ].map(esc).join(','))].join('\n');
}
