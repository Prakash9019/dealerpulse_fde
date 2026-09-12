import { getContext, getModel, parseFilters } from "@/lib/data";
import type { SearchParams } from "@/lib/data";
import { RANGE_PRESETS } from "@/lib/analytics/context";
import { buildExecutiveReport } from "@/lib/export/report";
import { Shell } from "@/components/layout/Shell";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { CopyInsightButton } from "@/components/ui/CopyInsightButton";

export default async function WeeklyPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const model = getModel();
  const ctx = getContext(filters);
  const report = buildExecutiveReport(model, ctx);

  const shareText = [
    "DEALERPULSE WEEKLY INTELLIGENCE",
    `${report.rangeLabel} · Data as of ${report.dataAsOf}`,
    "",
    "EXECUTIVE SUMMARY",
    report.headline,
    "",
    "TOP RISKS",
    ...report.topRisks.map((r) => `- ${r.title}`),
    "",
    "TOP OPPORTUNITIES",
    ...report.topOpportunities.map((r) => `- ${r.title}`),
    "",
    "FORECAST",
    report.forecast.text,
    "",
    "RECOMMENDED ACTIONS",
    ...report.recommendedActions.map((r) => `[${r.horizon}] ${r.problem} → ${r.action}`),
  ].join("\n");

  return (
    <Shell
      branches={model.branches}
      reps={model.reps.filter((r) => r.role === "sales_officer").map((r) => ({ id: r.id, name: r.name, branchId: r.branchId }))}
      asOfLabel={model.asOfLabel}
      scopeLabel="Weekly"
      screenTitle="Weekly Executive Summary"
      screenSubtitle={report.rangeLabel}
      rangePresets={RANGE_PRESETS}
    >
      <div className="mx-auto flex max-w-[820px] flex-col gap-5">
        <div className="no-print flex justify-end gap-2">
          <CopyInsightButton text={shareText} />
          <ExportButtons />
        </div>

        <section className="rounded-xl border border-accent-tint-border bg-gradient-to-b from-[oklch(0.225_0.016_200)] to-[oklch(0.205_0.008_200)] p-5">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
            <span aria-hidden="true" className="dp-ai-mark inline-block h-[11px] w-[11px] rotate-45 rounded-[2px] bg-accent" />
            Executive Summary
          </div>
          <p className="mt-2 text-[15px] leading-[1.55] text-ink-primary">{report.headline}</p>
          <p className="mt-3 text-[12.5px] text-ink-secondary">
            <span className="font-semibold text-ink-muted">Do next: </span>
            {report.doNext}
          </p>
        </section>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {report.kpis.map((k) => (
            <div key={k.label} className="rounded-[10px] border border-line-hairline bg-bg-card p-3.5">
              <div className="text-[11px] text-ink-muted">{k.label}</div>
              <div className="mt-1 font-mono text-[19px] text-ink-primary">{k.value}</div>
            </div>
          ))}
        </div>

        <section className="rounded-[10px] border border-line-hairline bg-bg-card p-4">
          <h2 className="mb-2 text-[13.5px] font-semibold text-ink-primary">Top Risks</h2>
          {report.topRisks.length === 0 ? (
            <p className="text-[12px] text-ink-muted">No high-severity risks flagged in this range.</p>
          ) : (
            <div className="space-y-2.5">
              {report.topRisks.map((r, i) => (
                <div key={i} className="border-l-2 border-critical pl-3">
                  <p className="text-[12.5px] font-medium text-ink-primary">{r.title}</p>
                  <p className="text-[11.5px] text-ink-tertiary">{r.explanation}</p>
                  <p className="text-[11px] text-ink-muted">Impact: {r.impact}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[10px] border border-line-hairline bg-bg-card p-4">
          <h2 className="mb-2 text-[13.5px] font-semibold text-ink-primary">Top Opportunities</h2>
          {report.topOpportunities.length === 0 ? (
            <p className="text-[12px] text-ink-muted">No opportunity findings in this range.</p>
          ) : (
            <div className="space-y-2.5">
              {report.topOpportunities.map((r, i) => (
                <div key={i} className="border-l-2 border-healthy pl-3">
                  <p className="text-[12.5px] font-medium text-ink-primary">{r.title}</p>
                  <p className="text-[11.5px] text-ink-tertiary">{r.explanation}</p>
                  <p className="text-[11px] text-ink-muted">Impact: {r.impact}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[10px] border border-line-hairline bg-bg-card p-4">
          <h2 className="mb-2 text-[13.5px] font-semibold text-ink-primary">Branch Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[12px]">
              <thead className="text-ink-muted">
                <tr>
                  <th className="px-2 py-1.5 text-left">Branch</th>
                  <th className="px-2 py-1.5 text-right">Conversion</th>
                  <th className="px-2 py-1.5 text-right">Units</th>
                  <th className="px-2 py-1.5 text-right">Revenue</th>
                  <th className="px-2 py-1.5 text-right">Attainment</th>
                  <th className="px-2 py-1.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {report.branches.map((b) => (
                  <tr key={b.name} className="border-t border-line-row">
                    <td className="px-2 py-1.5 text-ink-primary">{b.name}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{b.conversion}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{b.units}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{b.revenue}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{b.attainment}</td>
                    <td className="px-2 py-1.5">{b.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[10px] border border-line-hairline bg-bg-card p-4">
          <h2 className="mb-2 text-[13.5px] font-semibold text-ink-primary">Funnel</h2>
          <p className="text-[12.5px] text-ink-secondary">{report.funnelSummary}</p>
        </section>

        <section className="rounded-[10px] border border-line-hairline bg-bg-card p-4">
          <h2 className="mb-2 text-[13.5px] font-semibold text-ink-primary">Pipeline Risk & Forecast</h2>
          <p className="text-[12.5px] text-ink-secondary">{report.forecast.text}</p>
        </section>

        <section className="rounded-[10px] border border-line-hairline bg-bg-card p-4">
          <h2 className="mb-2 text-[13.5px] font-semibold text-ink-primary">Recommended Actions</h2>
          <div className="space-y-1.5">
            {report.recommendedActions.map((r, i) => (
              <p key={i} className="text-[12px] text-ink-secondary">
                <span className="font-mono text-[10px] text-accent">[{r.horizon}]</span> {r.problem} → {r.action}
              </p>
            ))}
          </div>
        </section>
      </div>
    </Shell>
  );
}
