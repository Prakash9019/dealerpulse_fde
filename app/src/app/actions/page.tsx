import { getContext, getModel, parseFilters } from "@/lib/data";
import type { SearchParams } from "@/lib/data";
import { RANGE_PRESETS } from "@/lib/analytics/context";
import { STAGE_LABEL } from "@/lib/domain/model";
import { RISK_LABEL_TEXT } from "@/lib/insights/riskLabel";
import { fmtDate } from "@/lib/format";
import { Shell } from "@/components/layout/Shell";
import { AiStartHere } from "@/components/actions/AiStartHere";
import { Recommendations } from "@/components/actions/Recommendations";
import { QueueTable } from "@/components/actions/QueueTable";
import { SummarizeButton } from "@/components/ui/SummarizeButton";

export default async function ActionCenterPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const model = getModel();
  // Action Center is a cross-branch work queue: analyze network-wide, filter client-side.
  // Priority scores are proven stable under branch/rep filtering, so this is equivalent
  // to (and faster than) re-querying the server per filter change.
  const ctx = getContext({ range: filters.range });
  const range = filters.range || "all";

  const rows = ctx.actions.rows.map((r) => ({
    id: r.id,
    customerName: r.customerName,
    model: r.model,
    branchId: r.branchId,
    branchName: r.branchName,
    repId: r.repId,
    repName: r.repName,
    stage: r.status,
    stageLabel: STAGE_LABEL[r.status],
    dealValue: r.dealValue,
    idleDays: r.idleDays,
    lastActivity: fmtDate(r.lastActivityAt),
    score: r.score,
    tier: r.tier,
    riskLabel: r.riskLabel,
    riskLabelText: RISK_LABEL_TEXT[r.riskLabel],
    reason: r.reason,
    suggestedAction: r.suggestedAction,
  }));

  const reps = model.reps
    .filter((r) => r.role === "sales_officer")
    .map((r) => ({ id: r.id, name: r.name, branchId: r.branchId }));

  const needsAttention = ctx.actions.critical.length + ctx.actions.attention.length;
  const topRec = ctx.recommendations[0];

  return (
    <Shell
      branches={model.branches}
      reps={reps}
      asOfLabel={model.asOfLabel}
      scopeLabel="Action Center"
      screenTitle="Action Center"
      screenSubtitle={`${needsAttention} ${needsAttention === 1 ? "action needs" : "actions need"} attention`}
      rangePresets={RANGE_PRESETS}
    >
      <div className="flex flex-col gap-5">
        <div className="no-print flex justify-end">
          <SummarizeButton screen="actions" />
        </div>
        {topRec && <AiStartHere rec={topRec} range={range} />}
        <Recommendations recs={ctx.recommendations} range={range} />
        <QueueTable
          rows={rows}
          branches={model.branches}
          reps={reps}
          initialTier={typeof sp.tier === "string" ? sp.tier : undefined}
        />
      </div>
    </Shell>
  );
}
