import Link from "next/link";
import { getContext, getModel, parseFilters } from "@/lib/data";
import type { SearchParams } from "@/lib/data";
import { RANGE_PRESETS } from "@/lib/analytics/context";
import { Shell } from "@/components/layout/Shell";
import { LeadsTable, type LeadRow } from "@/components/leads/LeadsTable";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const model = getModel();
  // Present-tense, like the aging/action-center pipeline: branch/rep-scoped but
  // never narrowed by the time-range filter, so a lead can't be hidden from
  // this "show me everything" view by picking a shorter window.
  const ctx = getContext({ branchId: filters.branchId, repId: filters.repId });

  const rows: LeadRow[] = ctx.allScoped.map((l) => ({
    id: l.id,
    customerName: l.customerName,
    model: l.model,
    branchId: l.branchId,
    branchName: l.branchName,
    repName: l.repName,
    sourceLabel: l.sourceLabel,
    status: l.status,
    dealValue: l.dealValue,
    ageDays: l.ageDays,
    idleDays: l.idleDays,
    open: l.open,
    reachedContacted: l.reached("contacted"),
    reachedTestDrive: l.reached("test_drive"),
  }));

  return (
    <Shell
      branches={model.branches}
      reps={model.reps.filter((r) => r.role === "sales_officer").map((r) => ({ id: r.id, name: r.name, branchId: r.branchId }))}
      asOfLabel={model.asOfLabel}
      scopeLabel="Leads"
      screenTitle="Leads"
      screenSubtitle={`${rows.length} leads · every stage, every outcome`}
      rangePresets={RANGE_PRESETS}
    >
      <div className="flex flex-col gap-4">
        <p className="text-[12px] text-ink-muted">
          The full record — every lead, including lost and delivered, for reporting and audit. For a
          scored, prioritized queue of what to work right now,{" "}
          <Link href="/actions" className="text-accent hover:underline">
            open the Action Center
          </Link>
          .
        </p>
        <LeadsTable rows={rows} branches={model.branches} />
      </div>
    </Shell>
  );
}
