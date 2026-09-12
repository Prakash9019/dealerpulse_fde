import { getContext, getModel, parseFilters, type SearchParams } from "@/lib/data";
import { buildExecutiveReport } from "@/lib/export/report";
import { renderExecutivePdf } from "@/lib/export/pdf";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sp: SearchParams = Object.fromEntries(url.searchParams.entries());
  const filters = parseFilters(sp);
  const model = getModel();
  const ctx = getContext(filters);
  const report = buildExecutiveReport(model, ctx);
  const pdf = await renderExecutivePdf(report);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="dealerpulse-executive-report.pdf"',
    },
  });
}
