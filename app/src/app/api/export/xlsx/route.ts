import { getContext, getModel, parseFilters, type SearchParams } from "@/lib/data";
import { buildExecutiveReport } from "@/lib/export/report";
import { renderExecutiveXlsx } from "@/lib/export/xlsx";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sp: SearchParams = Object.fromEntries(url.searchParams.entries());
  const filters = parseFilters(sp);
  const model = getModel();
  const ctx = getContext(filters);
  const report = buildExecutiveReport(model, ctx);
  const xlsx = await renderExecutiveXlsx(report, ctx.actions.rows);

  return new Response(new Uint8Array(xlsx), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="dealerpulse-executive-report.xlsx"',
    },
  });
}
