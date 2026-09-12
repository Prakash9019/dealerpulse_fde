import { getContext, getModel, parseFilters } from "@/lib/data";
import type { SearchParams } from "@/lib/data";
import { RANGE_PRESETS } from "@/lib/analytics/context";
import { executiveBrief } from "@/lib/ai/executiveBrief";
import { branchSummary } from "@/lib/ai/explanations";
import { monthlyTrend } from "@/lib/analytics/trends";
import { forecastPipeline, stageDeliveryRates } from "@/lib/insights/forecast";
import { rankAnomalies } from "@/lib/insights/anomalies";
import { fmtINR, fmtNum, fmtPct, fmtSigned } from "@/lib/format";
import { Shell } from "@/components/layout/Shell";
import { ExecutiveBrief } from "@/components/overview/ExecutiveBrief";
import { KpiCard } from "@/components/ui/KpiCard";
import { MonthlyChart } from "@/components/overview/MonthlyChart";
import { BranchTable } from "@/components/overview/BranchTable";
import { NetworkHealthMatrix } from "@/components/overview/NetworkHealthMatrix";
import { FunnelOverview } from "@/components/overview/FunnelOverview";
import { InsightsList } from "@/components/overview/InsightsList";
import { PipelineForecastCard } from "@/components/ui/PipelineForecastCard";
import { PrintReportButton } from "@/components/ui/PrintReportButton";
import { SummarizeButton } from "@/components/ui/SummarizeButton";
import { ExportButtons } from "@/components/ui/ExportButtons";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const model = getModel();
  const ctx = getContext(filters);
  const brief = executiveBrief(ctx);
  const range = filters.range || "all";

  const unitsDelta = ctx.kpi.units - ctx.kpi.prevUnits;
  const revenueDelta = ctx.kpi.revenue - ctx.kpi.prevRevenue;
  const branchesRanked = [...ctx.branchRows].sort((a, b) => b.maturedConversion - a.maturedConversion);
  const forecast = forecastPipeline(ctx.openLeads, stageDeliveryRates(model), ctx.kpi.units, ctx.targets.targetUnits);

  const sparklines: Record<string, number[]> = {};
  const blurbs: Record<string, string> = {};
  branchesRanked.forEach((b) => {
    sparklines[b.id] = monthlyTrend(model, ctx.months, { branchId: b.id }).map((m) => m.units);
    blurbs[b.id] = branchSummary(ctx, b.id)?.performance ?? "";
  });

  const reportText = [
    `DEALERPULSE EXECUTIVE REPORT`,
    `${ctx.range.label} · Data as of ${model.asOfLabel}`,
    ``,
    brief.headline,
    ``,
    ...brief.findings.map((f) => `- ${f.text}`),
    ``,
    `DO NEXT: ${brief.action}`,
    ``,
    `KPIs`,
    `Units delivered: ${fmtNum(ctx.kpi.units)}`,
    `Revenue: ${fmtINR(ctx.kpi.revenue)}`,
    `Lead → delivery conversion: ${ctx.kpi.conversion != null ? fmtPct(ctx.kpi.conversion) : "—"}`,
    `Revenue at risk: ${fmtINR(ctx.kpi.revenueAtRisk)}`,
    ``,
    `Branch performance (ranked by conversion)`,
    ...branchesRanked.map(
      (b) => `${b.convRank}. ${b.name} — ${fmtPct(b.maturedConversion)} conversion, ${fmtNum(b.units)} units, ${fmtINR(b.revenue)}, ${b.status}`,
    ),
    ``,
    `Top recommendations`,
    ...ctx.recommendations.slice(0, 5).map((r) => `- [${r.horizon}] ${r.problem} → ${r.action}`),
  ].join("\n");

  return (
    <Shell
      branches={model.branches}
      reps={model.reps.filter((r) => r.role === "sales_officer").map((r) => ({ id: r.id, name: r.name, branchId: r.branchId }))}
      asOfLabel={model.asOfLabel}
      scopeLabel={ctx.range.label}
      screenTitle="Overview"
      screenSubtitle={ctx.range.label}
      rangePresets={RANGE_PRESETS}
    >
      <div className="flex flex-col gap-5">
        <div className="no-print flex justify-end gap-2">
          <SummarizeButton screen="overview" />
          <PrintReportButton textContent={reportText} filename="dealerpulse-executive-report" />
          <ExportButtons />
        </div>

        <ExecutiveBrief brief={brief} range={range} />

        {/* Grouped into WHAT NEEDS ATTENTION (KPIs, trend, network health,
            risks/opportunities) and WHAT TO DO (forecast, branch ranking,
            funnel) — same cards as before, no new ones, just spacing and an
            eyebrow label giving the page three legible chunks instead of one
            flat list at uniform gap-5. */}
        <div className="mt-1 flex flex-col gap-5">
        <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-muted">
          Network KPIs
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            index={0}
            label="Units Delivered"
            value={fmtNum(ctx.kpi.units)}
            delta={ctx.kpi.prevUnits ? fmtSigned(unitsDelta, (v) => `${v}`) : undefined}
            deltaGood={unitsDelta >= 0}
            sub={ctx.kpi.prevUnits ? `${fmtNum(ctx.kpi.prevUnits)} in prior period` : "No prior period in this range"}
            whyKey="units"
            trend={ctx.trend.map((m) => m.units)}
          />
          <KpiCard
            index={1}
            label="Revenue"
            value={fmtINR(ctx.kpi.revenue)}
            delta={ctx.kpi.prevRevenue ? fmtSigned(revenueDelta, fmtINR) : undefined}
            deltaGood={revenueDelta >= 0}
            sub={ctx.kpi.prevRevenue ? `${fmtINR(ctx.kpi.prevRevenue)} in prior period` : "No prior period in this range"}
            whyKey="revenue"
            trend={ctx.trend.map((m) => m.revenue)}
          />
          <KpiCard
            index={2}
            label="Lead → Delivery Conversion"
            value={ctx.kpi.conversion != null ? fmtPct(ctx.kpi.conversion) : "—"}
            sub={ctx.kpi.conversionNote}
            whyKey="conversion"
          />
          <KpiCard
            index={3}
            label="Revenue At Risk"
            value={fmtINR(ctx.kpi.revenueAtRisk)}
            valueClassName="text-warning"
            sub={`${fmtNum(ctx.kpi.staleCount)} leads idle 8+ days`}
            whyKey="risk"
          />
        </div>

        <section className="rounded-[10px] border border-line-hairline bg-bg-card p-4">
          <h2 className="mb-2 text-[13.5px] font-semibold text-ink-primary">
            Monthly performance
          </h2>
          <MonthlyChart trend={ctx.trend} />
        </section>

        <NetworkHealthMatrix rows={branchesRanked} netConversion={ctx.netMaturedConversion} />

        <InsightsList anomalies={rankAnomalies(ctx.anomalies)} range={range} />
        </div>

        <div className="mt-1 flex flex-col gap-5">
        <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-muted">
          What to do
        </div>

        <PipelineForecastCard forecast={forecast} scopeLabel="the network" />

        <section>
          <h2 className="mb-3 text-[13.5px] font-semibold text-ink-primary">
            Branch performance
          </h2>
          <BranchTable rows={branchesRanked} sparklines={sparklines} blurbs={blurbs} />
        </section>

        <FunnelOverview funnel={ctx.funnel} range={range} />
        </div>
      </div>
    </Shell>
  );
}
