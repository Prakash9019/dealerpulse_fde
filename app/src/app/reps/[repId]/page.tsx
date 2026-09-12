import { notFound } from "next/navigation";
import Link from "next/link";
import { getContext, getModel, parseFilters } from "@/lib/data";
import type { SearchParams } from "@/lib/data";
import { RANGE_PRESETS } from "@/lib/analytics/context";
import { repSummary } from "@/lib/ai/explanations";
import { STAGE_LABEL } from "@/lib/domain/model";
import { fmtDate, fmtINR, fmtNum, fmtPct } from "@/lib/format";
import { Shell } from "@/components/layout/Shell";
import { KpiCard } from "@/components/ui/KpiCard";
import { AISummaryCard } from "@/components/ui/AISummaryCard";
import { RepFunnelChart } from "@/components/reps/RepFunnelChart";
import { StageCycleTime } from "@/components/reps/StageCycleTime";
import { PipelineTable } from "@/components/reps/PipelineTable";
import { PrintReportButton } from "@/components/ui/PrintReportButton";

export default async function RepScorecardPage({
  params,
  searchParams,
}: {
  params: Promise<{ repId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { repId } = await params;
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const model = getModel();
  const rep = model.repById[repId];
  if (!rep) notFound();

  const ctx = getContext({ range: filters.range }); // network-wide
  const row = ctx.reps.find((r) => r.id === repId);
  if (!row) notFound();

  const repCtx = getContext({ range: filters.range, repId });
  const branchCtx = getContext({ range: filters.range, branchId: rep.branchId });
  const summary = repSummary(ctx, repId);
  const range = filters.range || "all";
  const isManager = rep.role === "branch_manager";

  const reportText = summary
    ? [
        `${rep.name.toUpperCase()} — REP SCORECARD`,
        `${rep.roleLabel} · ${rep.branchName} · Joined ${fmtDate(rep.joined)}`,
        `${ctx.range.label} · Data as of ${model.asOfLabel}`,
        ``,
        `KPIs`,
        `Leads handled: ${fmtNum(row.leads)}`,
        `Lead → delivery: ${fmtPct(row.conversion)}`,
        `Orders: ${fmtNum(row.orders)}`,
        `Delivered: ${fmtNum(row.delivered)}`,
        `Pipeline value: ${fmtINR(row.pipelineValue)}`,
        `Stale leads: ${fmtNum(row.staleCount)}`,
        ``,
        `AI REP SUMMARY`,
        summary.headline,
        `Strength: ${summary.strength}`,
        `Risk: ${summary.risk}`,
        `Do next: ${summary.action}`,
      ].join("\n")
    : "";

  return (
    <Shell
      branches={model.branches}
      reps={model.reps.filter((r) => r.role === "sales_officer").map((r) => ({ id: r.id, name: r.name, branchId: r.branchId }))}
      asOfLabel={model.asOfLabel}
      scopeLabel={rep.name}
      screenTitle={rep.name}
      screenSubtitle={`${rep.roleLabel} · ${rep.branchName} · Joined ${fmtDate(rep.joined)}`}
      rangePresets={RANGE_PRESETS}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/branches/${rep.branchId}`} className="no-print text-[12.5px] text-ink-muted hover:text-ink-primary">
            ← {rep.branchName}
          </Link>
          <Link
            href={`/actions?rep=${rep.id}`}
            className="no-print rounded-[7px] border border-line-hairline px-3 py-1 text-[12px] text-ink-secondary hover:bg-bg-hover"
          >
            Action queue
          </Link>
          <Link
            href={`/funnel?scope=rep&rep=${rep.id}`}
            className="no-print rounded-[7px] border border-line-hairline px-3 py-1 text-[12px] text-ink-secondary hover:bg-bg-hover"
          >
            Funnel
          </Link>
          {reportText && (
            <PrintReportButton
              textContent={reportText}
              filename={`dealerpulse-${rep.name.toLowerCase().replace(/\s+/g, "-")}-scorecard`}
            />
          )}
        </div>

        {isManager ? (
          <p className="rounded-[10px] border border-line-hairline bg-bg-card p-4 text-[12.5px] text-ink-muted">
            Managers carry no personal lead book in this dataset — there is nothing to score here.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
              <KpiCard index={0} label="Leads handled" value={fmtNum(row.leads)} />
              <KpiCard index={1} label="Lead → delivery" value={fmtPct(row.conversion)} />
              <KpiCard index={2} label="Orders" value={fmtNum(row.orders)} />
              <KpiCard index={3} label="Delivered" value={fmtNum(row.delivered)} />
              <KpiCard index={4} label="Pipeline value" value={fmtINR(row.pipelineValue)} />
              <KpiCard index={5} label="Stale leads" value={fmtNum(row.staleCount)} valueClassName="text-warning" />
            </div>

            {summary && (
              <AISummaryCard
                label="AI Rep Summary"
                headline={summary.headline}
                panels={[
                  { title: "Strength", tone: "good", text: summary.strength },
                  { title: "Risk", tone: "bad", text: summary.risk },
                ]}
                action={summary.action}
                ctas={[{ label: "Open action queue", route: { screen: "actions", repId } }]}
                range={range}
              />
            )}

            <RepFunnelChart
              repFunnel={repCtx.funnel}
              branchFunnel={branchCtx.funnel}
              netFunnel={ctx.netFunnel}
            />

            <StageCycleTime repDurations={repCtx.stageDurations} netDurations={ctx.stageDurations} />

            <section>
              <h2 className="mb-3 text-[13.5px] font-semibold text-ink-primary">Open pipeline</h2>
              <PipelineTable
                rows={repCtx.actions.rows.map((r) => ({
                  id: r.id,
                  customerName: r.customerName,
                  model: r.model,
                  status: STAGE_LABEL[r.status],
                  dealValue: r.dealValue,
                  idleDays: r.idleDays,
                  score: r.score,
                }))}
              />
            </section>
          </>
        )}
      </div>
    </Shell>
  );
}
