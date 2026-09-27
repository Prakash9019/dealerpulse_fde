import { getContext, getModel, parseFilters } from "@/lib/data";
import type { SearchParams } from "@/lib/data";
import { RANGE_PRESETS } from "@/lib/analytics/context";
import { modelPerf, widestDemandMismatch } from "@/lib/analytics/models";
import { fmtNum, fmtPct } from "@/lib/format";
import { Shell } from "@/components/layout/Shell";
import { ModelsTable } from "@/components/models/ModelsTable";

export default async function ModelsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const model = getModel();
  const ctx = getContext(filters);
  const rows = modelPerf(ctx.cohort);
  const mismatch = widestDemandMismatch(rows);

  return (
    <Shell
      branches={model.branches}
      reps={model.reps.filter((r) => r.role === "sales_officer").map((r) => ({ id: r.id, name: r.name, branchId: r.branchId }))}
      asOfLabel={model.asOfLabel}
      scopeLabel="Demand"
      screenTitle="Demand"
      screenSubtitle="Leads, conversion, and revenue by model"
      rangePresets={RANGE_PRESETS}
    >
      <div className="flex flex-col gap-5">
        {mismatch && (
          <section className="dp-in rounded-xl border border-accent-tint-border bg-accent-tint-bg p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
              Not all leads are worth the same
            </div>
            <p className="mt-2 text-[13px] leading-[1.5] text-ink-primary">
              <strong>{mismatch.model}</strong> is {fmtPct(mismatch.leadShare, 0)} of leads but{" "}
              {fmtPct(mismatch.revenueShare, 0)} of delivered revenue —{" "}
              {mismatch.gap > 0
                ? "punching above its lead-volume weight"
                : "a much larger share of the lead book than of the revenue it returns"}
              . A pure lead-count view of demand would misread this model's priority.
            </p>
          </section>
        )}

        <ModelsTable rows={rows} />

        <p className="text-[11px] text-ink-muted">
          {fmtNum(rows.reduce((s, r) => s + r.leads, 0))} leads across {rows.length} models in this range. Revenue is
          recognised on delivery, so a model's revenue share reflects delivered deals only, not open pipeline.
        </p>
      </div>
    </Shell>
  );
}
