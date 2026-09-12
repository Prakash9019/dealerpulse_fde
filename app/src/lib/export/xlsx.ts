/* Real .xlsx workbook (multiple sheets, formatted headers) — used for both
   the Executive Report export and the Action Center's need for a richer
   export than CSV. Node-only (exceljs). */
import ExcelJS from 'exceljs';
import type { ExecutiveReport } from './report';
import type { ActionRow } from '../insights/priority';
import { STAGE_LABEL } from '../domain/model';
import { RISK_LABEL_TEXT } from '../insights/riskLabel';

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF211D19' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  });
}

export async function renderExecutiveXlsx(report: ExecutiveReport, actionRows?: ActionRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DealerPulse';
  wb.created = new Date();

  const summary = wb.addWorksheet('Summary');
  summary.columns = [{ width: 28 }, { width: 60 }];
  summary.addRow(['DealerPulse Executive Report']);
  summary.addRow([`${report.rangeLabel} · Data as of ${report.dataAsOf}`]);
  summary.addRow([]);
  summary.addRow(['Headline', report.headline]);
  summary.addRow(['Do next', report.doNext]);
  summary.addRow([]);
  const kpiHeader = summary.addRow(['KPI', 'Value']);
  styleHeader(kpiHeader);
  report.kpis.forEach((k) => summary.addRow([k.label, k.value]));

  const branches = wb.addWorksheet('Branch Comparison');
  const branchHeader = branches.addRow(['Branch', 'City', 'Conversion', 'Units', 'Revenue', 'Attainment', 'Status']);
  styleHeader(branchHeader);
  branches.columns = [{ width: 22 }, { width: 14 }, { width: 12 }, { width: 10 }, { width: 14 }, { width: 12 }, { width: 12 }];
  report.branches.forEach((b) => branches.addRow([b.name, b.city, b.conversion, b.units, b.revenue, b.attainment, b.status]));

  const risks = wb.addWorksheet('Risks & Opportunities');
  const riskHeader = risks.addRow(['Type', 'Title', 'Explanation', 'Impact']);
  styleHeader(riskHeader);
  risks.columns = [{ width: 12 }, { width: 32 }, { width: 60 }, { width: 40 }];
  report.topRisks.forEach((r) => risks.addRow(['Risk', r.title, r.explanation, r.impact]));
  report.topOpportunities.forEach((r) => risks.addRow(['Opportunity', r.title, r.explanation, r.impact]));

  const actions = wb.addWorksheet('Recommended Actions');
  const actionHeader = actions.addRow(['Horizon', 'Problem', 'Action']);
  styleHeader(actionHeader);
  actions.columns = [{ width: 14 }, { width: 60 }, { width: 60 }];
  report.recommendedActions.forEach((r) => actions.addRow([r.horizon, r.problem, r.action]));

  if (actionRows && actionRows.length) {
    const queue = wb.addWorksheet('Action Queue');
    const queueHeader = queue.addRow(['Lead ID', 'Customer', 'Model', 'Branch', 'Rep', 'Stage', 'Deal Value', 'Days Idle', 'Last Activity', 'Priority', 'Tier', 'Risk', 'Reason']);
    styleHeader(queueHeader);
    queue.columns = [{ width: 10 }, { width: 20 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 10 }, { width: 14 }, { width: 10 }, { width: 12 }, { width: 16 }, { width: 50 }];
    actionRows.forEach((r) => queue.addRow([
      r.id, r.customerName, r.model, r.branchName, r.repName, STAGE_LABEL[r.status],
      r.dealValue, r.idleDays, r.lastActivityAt.toISOString().slice(0, 10), r.score, r.tier, RISK_LABEL_TEXT[r.riskLabel], r.reason,
    ]));
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
