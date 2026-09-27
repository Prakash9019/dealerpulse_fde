import { notFound } from "next/navigation";
import Link from "next/link";
import { getContext, getModel, parseFilters } from "@/lib/data";
import type { SearchParams } from "@/lib/data";
import { RANGE_PRESETS } from "@/lib/analytics/context";
import { repSummary } from "@/lib/ai/explanations";
import { MIN_RATED_LEADS, STAGE_LABEL } from "@/lib/domain/model";
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/branches/${rep.branchId}`} className="no-print text-[12.5px] text-ink-muted hover:text-ink-primary">
            ← {rep.branchName}
          </Link>
          <div className="no-print flex items-center gap-2">
            <Link
              href={`/actions?rep=${rep.id}`}
              className="rounded-[7px] border border-line-hairline px-3 py-1 text-[12px] text-ink-secondary hover:bg-bg-hover"
            >
              Action queue
            </Link>
            <Link
              href={`/funnel?scope=rep&rep=${rep.id}`}
              className="rounded-[7px] border border-line-hairline px-3 py-1 text-[12px] text-ink-secondary hover:bg-bg-hover"
            >
              Funnel
            </Link>
            {summary && <PrintReportButton />}
          </div>
        </div>

        {isManager ? (
          <p className="rounded-[10px] border border-line-hairline bg-bg-card p-4 text-[12.5px] text-ink-muted">
            Managers carry no personal lead book in this dataset — there is nothing to score here.
          </p>
        ) : (
          <>
            {/* Five cards, not six: "Orders" was dropped as its own tile — it's the one
                intermediate funnel stage that isn't a terminal outcome (unlike Delivered)
                or a top-line volume/risk number, and the stage-by-stage funnel chart right
                below already shows every stage's conversion, orders included. */}
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
              <KpiCard index={0} label="Leads handled" value={fmtNum(row.leads)} />
              <KpiCard
                index={1}
                label="Lead → delivery"
                value={row.leads >= MIN_RATED_LEADS ? fmtPct(row.conversion) : "—"}
                sub={row.leads >= MIN_RATED_LEADS ? undefined : `Under ${MIN_RATED_LEADS} leads — not enough volume to rate`}
              />
              <KpiCard index={2} label="Delivered" value={fmtNum(row.delivered)} />
              <KpiCard index={3} label="Pipeline value" value={fmtINR(row.pipelineValue)} />
              <KpiCard index={4} label="Stale leads" value={fmtNum(row.staleCount)} valueClassName="text-warning" />
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
