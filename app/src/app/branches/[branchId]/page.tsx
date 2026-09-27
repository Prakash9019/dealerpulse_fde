import { notFound } from "next/navigation";
import Link from "next/link";
import { getContext, getModel, parseFilters } from "@/lib/data";
import type { SearchParams } from "@/lib/data";
import { RANGE_PRESETS } from "@/lib/analytics/context";
import { stageLeaks } from "@/lib/analytics/funnel";
import { branchSummary, repSummary } from "@/lib/ai/explanations";
import { monthlyTrend } from "@/lib/analytics/trends";
import { forecastPipeline, stageDeliveryRates } from "@/lib/insights/forecast";
import { fmtDays, fmtINR, fmtNum, fmtPct } from "@/lib/format";
import { Shell } from "@/components/layout/Shell";
import { KpiCard } from "@/components/ui/KpiCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { PerfVsNetwork } from "@/components/branches/PerfVsNetwork";
import { BranchFunnelChart } from "@/components/branches/BranchFunnelChart";
import { RepTable } from "@/components/branches/RepTable";
import { LostReasonsChart } from "@/components/branches/LostReasonsChart";
import { LeadAgingChart } from "@/components/branches/LeadAgingChart";
import { AISummaryCard } from "@/components/ui/AISummaryCard";
import { PipelineForecastCard } from "@/components/ui/PipelineForecastCard";
import { PrintReportButton } from "@/components/ui/PrintReportButton";
import { SummarizeButton } from "@/components/ui/SummarizeButton";

export default async function BranchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ branchId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { branchId } = await params;
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const model = getModel();

  const ctx = getContext({ range: filters.range }); // network-wide, for baselines + comparisons
  const b = ctx.branchRows.find((x) => x.id === branchId);
  if (!b) notFound();

  const branchCtx = getContext({ range: filters.range, branchId }); // scoped to this branch
  const reps = ctx.reps.filter((r) => r.branchId === branchId);
  const leaks = stageLeaks(b.funnel, ctx.netFunnel);
  const summary = branchSummary(ctx, branchId);
  const range = filters.range || "all";
  const branchAvgConversion = b.maturedConversion || 0.01;
  const forecast = forecastPipeline(branchCtx.openLeads, stageDeliveryRates(model), b.units, b.targetUnits);

  const repSparklines: Record<string, number[]> = {};
  const repBlurbs: Record<string, string> = {};
  reps.forEach((r) => {
    repSparklines[r.id] = monthlyTrend(model, ctx.months, { repId: r.id }).map((m) => m.units);
    repBlurbs[r.id] = repSummary(ctx, r.id)?.headline ?? "";
  });

  return (
    <Shell
      branches={model.branches}
      reps={model.reps.filter((r) => r.role === "sales_officer").map((r) => ({ id: r.id, name: r.name, branchId: r.branchId }))}
      asOfLabel={model.asOfLabel}
      scopeLabel={b.name}
      screenTitle={b.name}
      screenSubtitle={`${b.city} · ${b.managerName} · conversion rank ${b.convRank} of ${ctx.branchRows.length}`}
      rangePresets={RANGE_PRESETS}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/branches" className="no-print text-[12.5px] text-ink-muted hover:text-ink-primary">
              ← Branches
            </Link>
            <StatusPill status={b.status} />
          </div>
          <div className="no-print flex items-center gap-2">
            <SummarizeButton screen="branch" branchId={b.id} />
            {summary && <PrintReportButton />}
          </div>
        </div>

        {/* Five cards, not seven: Target attainment and Pipeline value were dropped as
            standalone tiles because both numbers are restated seconds later — attainment
            in the Pipeline Forecast Card's "on pace for X%, up from Y% delivered so far"
            line, pipeline value as that same card's "N open leads worth ₹X" line. Keeping
            them here too was the exact kind of two-places-one-number risk this app's own
            analytics layer was built to avoid. Attainment rank still surfaces, folded into
            the Revenue card's sub-line instead of owning a whole tile for one number. */}
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard index={0} label="Leads" value={fmtNum(b.leads)} />
          <KpiCard index={1} label="Conversion" value={fmtPct(b.maturedConversion)} whyKey="conversion" />
          <KpiCard index={2} label="Units" value={fmtNum(b.units)} />
          <KpiCard
            index={3}
            label="Revenue"
            value={fmtINR(b.revenue)}
            sub={`${fmtPct(b.attainment, 0)} of target · rank ${b.attainmentRank}`}
          />
          <KpiCard index={4} label="Stale leads" value={fmtNum(b.staleCount)} valueClassName="text-warning" whyKey="risk" />
        </div>

        {summary && (
          <AISummaryCard
            label="AI Branch Summary"
            panels={[
              { title: "Going well", tone: "good", text: summary.performance },
              { title: "What is wrong", tone: "bad", text: summary.problem },
              { title: "Opportunity", tone: "opportunity", text: summary.opportunity },
            ]}
            action={summary.action}
            ctas={summary.ctas}
            range={range}
          />
        )}

        <PerfVsNetwork
          metrics={[
            {
              label: "Conversion",
              value: b.maturedConversion,
              baseline: ctx.netMaturedConversion,
              max: 0.6,
              fmt: (v) => fmtPct(v),
              deltaFmt: (v) => (v * 100).toFixed(1) + " pts",
              higherIsBetter: true,
            },
            {
              label: "New → Contacted",
              value: b.funnel[1].convFromPrev,
              baseline: ctx.netFunnel[1].convFromPrev,
              max: 1,
              fmt: (v) => fmtPct(v),
              deltaFmt: (v) => (v * 100).toFixed(1) + " pts",
              higherIsBetter: true,
            },
            {
              label: "Contacted → Test Drive",
              value: b.funnel[2].convFromPrev,
              baseline: ctx.netFunnel[2].convFromPrev,
              max: 1,
              fmt: (v) => fmtPct(v),
              deltaFmt: (v) => (v * 100).toFixed(1) + " pts",
              higherIsBetter: true,
            },
            {
              label: "Negotiation → Order",
              value: b.funnel[4].convFromPrev,
              baseline: ctx.netFunnel[4].convFromPrev,
              max: 1,
              fmt: (v) => fmtPct(v),
              deltaFmt: (v) => (v * 100).toFixed(1) + " pts",
              higherIsBetter: true,
            },
            {
              label: "Delivery delay rate",
              value: b.delayRate,
              baseline: ctx.delivery.delayRate,
              max: 1,
              fmt: (v) => fmtPct(v, 0),
              deltaFmt: (v) => (v * 100).toFixed(0) + " pts",
              higherIsBetter: false,
            },
            {
              label: "Median order → delivery",
              value: b.medianDaysToDeliver ?? 0,
              baseline: ctx.delivery.medianDays ?? 0,
              max: Math.max(30, (b.medianDaysToDeliver ?? 0) * 1.4),
              fmt: (v) => fmtDays(v),
              deltaFmt: (v) => fmtDays(v),
              higherIsBetter: false,
            },
          ]}
        />

        <PipelineForecastCard forecast={forecast} scopeLabel={b.name} />

        <BranchFunnelChart branchFunnel={b.funnel} netFunnel={ctx.netFunnel} leaks={leaks} />

        <section>
          <h2 className="mb-3 text-[13.5px] font-semibold text-ink-primary">Rep performance</h2>
          {reps.length ? (
            <RepTable
              rows={reps}
              branchAvgConversion={branchAvgConversion}
              sparklines={repSparklines}
              blurbs={repBlurbs}
            />
          ) : (
            <p className="text-[12px] text-ink-muted">
              No leads assigned at this branch in the selected range.
            </p>
          )}
        </section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <LostReasonsChart lost={branchCtx.lost} />
          <LeadAgingChart aging={branchCtx.aging} />
        </div>
      </div>
    </Shell>
  );
}
