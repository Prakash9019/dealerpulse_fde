/* Generates a real, formatted PDF document (headings, sections, a table) —
   not a screenshot of the dashboard. Node-only (pdfkit), so any route that
   imports this must run on the Node runtime (the App Router default). */
import PDFDocument from 'pdfkit';
import type { ExecutiveReport } from './report';

const ACCENT = '#4fc9dd';
const INK = '#1a1714';
const MUTED = '#6b6459';

/** pdfkit's built-in Helvetica only supports WinAnsi-encoded glyphs — the
    Rupee sign (₹) and the funnel arrow (→) used throughout the app's
    formatted strings are outside that set and render as garbage without
    embedding a custom Unicode font. Substituting ASCII-safe equivalents is
    simpler and more portable than bundling a font file for a one-off export. */
function pdfSafe(s: string): string {
  return s.replace(/₹/g, 'Rs. ').replace(/→/g, '->');
}

function sanitizeReport(report: ExecutiveReport): ExecutiveReport {
  return JSON.parse(pdfSafe(JSON.stringify(report)));
}

export function renderExecutivePdf(rawReport: ExecutiveReport): Promise<Buffer> {
  const report = sanitizeReport(rawReport);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fillColor(ACCENT).fontSize(20).font('Helvetica-Bold').text('DealerPulse Executive Report');
    doc.fillColor(MUTED).fontSize(10).font('Helvetica').text(`${report.rangeLabel} · Data as of ${report.dataAsOf} · Generated ${new Date(report.generatedAt).toLocaleString()}`);
    doc.moveDown(1);

    section(doc, 'Executive Brief');
    doc.fillColor(INK).fontSize(12).font('Helvetica').text(report.headline, { lineGap: 3 });
    doc.moveDown(0.5);
    report.findings.forEach((f) => {
      doc.fillColor(f.tone === 'positive' ? '#2f8f5b' : '#b5502f').fontSize(9).font('Helvetica-Bold').text(f.tone.toUpperCase(), { continued: true });
      doc.fillColor(INK).font('Helvetica').text('  ' + f.text);
    });
    doc.moveDown(0.3);
    doc.fillColor(MUTED).fontSize(10).font('Helvetica-Bold').text('Do next: ', { continued: true }).font('Helvetica').fillColor(INK).text(report.doNext);
    doc.moveDown(1);

    section(doc, 'Network Health · KPIs');
    report.kpis.forEach((k) => {
      doc.fontSize(11).font('Helvetica').fillColor(MUTED).text(k.label + ': ', { continued: true }).font('Helvetica-Bold').fillColor(INK).text(k.value);
    });
    doc.moveDown(1);

    section(doc, 'Top Risks');
    if (!report.topRisks.length) doc.fontSize(10).fillColor(MUTED).text('No high-severity risks flagged in this range.');
    report.topRisks.forEach((r) => bulletBlock(doc, r.title, r.explanation, r.impact));
    doc.moveDown(0.5);

    section(doc, 'Top Opportunities');
    if (!report.topOpportunities.length) doc.fontSize(10).fillColor(MUTED).text('No opportunity findings in this range.');
    report.topOpportunities.forEach((r) => bulletBlock(doc, r.title, r.explanation, r.impact));
    doc.moveDown(0.5);

    section(doc, 'Forecast');
    doc.fontSize(10).fillColor(INK).text(report.forecast.text, { lineGap: 3 });
    doc.moveDown(1);

    section(doc, 'Branch Comparison');
    table(doc, ['Branch', 'City', 'Conversion', 'Units', 'Revenue', 'Attainment', 'Status'],
      report.branches.map((b) => [b.name, b.city, b.conversion, String(b.units), b.revenue, b.attainment, b.status]));
    doc.moveDown(1);

    section(doc, 'Funnel');
    doc.fontSize(10).fillColor(INK).text(report.funnelSummary, { lineGap: 3 });
    doc.moveDown(1);

    section(doc, 'Recommended Actions');
    report.recommendedActions.forEach((r) => {
      doc.fontSize(9).font('Helvetica-Bold').fillColor(ACCENT).text(`[${r.horizon}] `, { continued: true });
      doc.font('Helvetica').fillColor(INK).text(`${r.problem} -> ${r.action}`);
      doc.moveDown(0.2);
    });

    doc.end();
  });
}

function section(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.3);
  doc.fillColor(ACCENT).fontSize(13).font('Helvetica-Bold').text(title);
  doc.moveDown(0.3);
}

function bulletBlock(doc: PDFKit.PDFDocument, title: string, explanation: string, impact: string) {
  doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#1a1714').text('• ' + title);
  doc.fontSize(9.5).font('Helvetica').fillColor('#3a342d').text(explanation, { indent: 12, lineGap: 2 });
  doc.fontSize(9).font('Helvetica-Oblique').fillColor('#6b6459').text('Impact: ' + impact, { indent: 12 });
  doc.moveDown(0.4);
}

function table(doc: PDFKit.PDFDocument, headers: string[], rows: string[][]) {
  const colWidths = [110, 70, 65, 45, 70, 65, 60];
  const startX = doc.x;
  let y = doc.y;

  doc.fontSize(8).font('Helvetica-Bold').fillColor('#6b6459');
  let x = startX;
  headers.forEach((h, i) => { doc.text(h, x, y, { width: colWidths[i] }); x += colWidths[i]; });
  y += 14;

  doc.font('Helvetica').fillColor('#1a1714');
  rows.forEach((row) => {
    if (y > 760) { doc.addPage(); y = doc.y; }
    x = startX;
    row.forEach((cell, i) => { doc.fontSize(8.5).text(cell, x, y, { width: colWidths[i] }); x += colWidths[i]; });
    y += 13;
  });
  doc.y = y;
}
