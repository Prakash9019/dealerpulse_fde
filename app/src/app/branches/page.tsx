import { getContext, getModel, parseFilters } from "@/lib/data";
import type { SearchParams } from "@/lib/data";
import { RANGE_PRESETS } from "@/lib/analytics/context";
import { stageLeaks } from "@/lib/analytics/funnel";
import { fmtINR, fmtNum, fmtPct } from "@/lib/format";
import { Shell } from "@/components/layout/Shell";
import { BranchCard } from "@/components/branches/BranchCard";
import { CountUp } from "@/components/ui/CountUp";

export default async function BranchesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const model = getModel();
  const ctx = getContext(filters);
  const ranked = [...ctx.branchRows].sort((a, b) => b.maturedConversion - a.maturedConversion);

  return (
    <Shell
      branches={model.branches}
      reps={model.reps.filter((r) => r.role === "sales_officer").map((r) => ({ id: r.id, name: r.name, branchId: r.branchId }))}
      asOfLabel={model.asOfLabel}
      scopeLabel={ctx.range.label}
      screenTitle="Branches"
      screenSubtitle={ctx.range.label}
      rangePresets={RANGE_PRESETS}
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <NetStat label="Conversion" value={fmtPct(ctx.netMaturedConversion)} delayMs={0} />
          <NetStat label="Units" value={fmtNum(ctx.kpi.units)} delayMs={60} />
          <NetStat label="Revenue" value={fmtINR(ctx.kpi.revenue)} delayMs={120} />
          <NetStat label="Revenue at risk" value={fmtINR(ctx.kpi.revenueAtRisk)} tone="warn" delayMs={180} />
        </div>

        <div className="flex flex-col gap-3">
          {ranked.map((b, i) => (
            <BranchCard
              key={b.id}
              b={b}
              rank={i + 1}
              netConversion={ctx.netMaturedConversion}
              leak={stageLeaks(b.funnel, ctx.netFunnel)[0]}
              delayMs={i * 50}
            />
          ))}
        </div>
      </div>
    </Shell>
  );
}

function NetStat({
  label,
  value,
  tone,
  delayMs,
}: {
  label: string;
  value: string;
  tone?: "warn";
  delayMs?: number;
}) {
  return (
    <div
      style={{ "--d": (delayMs ?? 0) + "ms" } as React.CSSProperties}
      className="dp-stagger rounded-[10px] border border-line-hairline bg-bg-card p-4"
    >
      <div className="text-[11.5px] font-medium text-ink-tertiary">{label}</div>
      <div className={`mt-1 font-mono text-[22px] ${tone === "warn" ? "text-warning" : "text-ink-primary"}`}>
        <CountUp value={value} />
      </div>
    </div>
  );
}
