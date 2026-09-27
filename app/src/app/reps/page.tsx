import { getContext, getModel, parseFilters } from "@/lib/data";
import type { SearchParams } from "@/lib/data";
import { RANGE_PRESETS } from "@/lib/analytics/context";
import { monthlyTrend } from "@/lib/analytics/trends";
import { repSummary } from "@/lib/ai/explanations";
import { Shell } from "@/components/layout/Shell";
import { RepLeaderboardTable } from "@/components/reps/RepLeaderboardTable";

export default async function RepLeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const model = getModel();
  const ctx = getContext({ range: filters.range });

  const rows = ctx.reps.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role,
    branchId: r.branchId ?? "",
    branchName: r.branchName ?? "—",
    leads: r.leads,
    conversion: r.conversion,
    adjustedConversion: r.adjustedConversion,
    orders: r.orders,
    delivered: r.delivered,
    revenue: r.revenue,
    pipelineValue: r.pipelineValue,
    staleCount: r.staleCount,
    networkRank: r.networkRank,
  }));

  const sparklines: Record<string, number[]> = {};
  const blurbs: Record<string, string> = {};
  ctx.reps.forEach((r) => {
    sparklines[r.id] = monthlyTrend(model, ctx.months, { repId: r.id }).map((m) => m.units);
    blurbs[r.id] = repSummary(ctx, r.id)?.headline ?? "";
  });

  return (
    <Shell
      branches={model.branches}
      reps={model.reps.filter((r) => r.role === "sales_officer").map((r) => ({ id: r.id, name: r.name, branchId: r.branchId }))}
      asOfLabel={model.asOfLabel}
      scopeLabel="Rep Leaderboard"
      screenTitle="Rep Leaderboard"
      screenSubtitle={`${rows.length} reps ranked network-wide by conversion`}
      rangePresets={RANGE_PRESETS}
    >
      <RepLeaderboardTable rows={rows} branches={model.branches} sparklines={sparklines} blurbs={blurbs} />
    </Shell>
  );
}
