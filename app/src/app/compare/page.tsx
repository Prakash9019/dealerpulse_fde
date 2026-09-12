import { getModel, parseFilters } from "@/lib/data";
import type { SearchParams } from "@/lib/data";
import { RANGE_PRESETS } from "@/lib/analytics/context";
import { Shell } from "@/components/layout/Shell";
import { CompareView } from "@/components/compare/CompareView";

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  parseFilters(sp);
  const model = getModel();

  return (
    <Shell
      branches={model.branches}
      reps={model.reps.filter((r) => r.role === "sales_officer").map((r) => ({ id: r.id, name: r.name, branchId: r.branchId }))}
      asOfLabel={model.asOfLabel}
      scopeLabel="Compare"
      screenTitle="Compare"
      screenSubtitle="Side-by-side branch or rep comparison"
      rangePresets={RANGE_PRESETS}
    >
      <CompareView
        branches={model.branches.map((b) => ({ id: b.id, name: b.name, sub: b.city }))}
        reps={model.reps
          .filter((r) => r.role === "sales_officer")
          .map((r) => ({ id: r.id, name: r.name, sub: r.branchName }))}
      />
    </Shell>
  );
}
