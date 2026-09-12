import { getModel, parseFilters } from "@/lib/data";
import type { SearchParams } from "@/lib/data";
import { RANGE_PRESETS } from "@/lib/analytics/context";
import { listDocuments } from "@/lib/rag/corpus";
import { Shell } from "@/components/layout/Shell";
import { DocSummaryCard } from "@/components/docs/DocSummaryCard";

export default async function DocsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  parseFilters(sp);
  const model = getModel();
  const docs = listDocuments();

  return (
    <Shell
      branches={model.branches}
      reps={model.reps.filter((r) => r.role === "sales_officer").map((r) => ({ id: r.id, name: r.name, branchId: r.branchId }))}
      asOfLabel={model.asOfLabel}
      scopeLabel="Docs"
      screenTitle="Reference Documents"
      screenSubtitle="Internal SOPs, glossary, and methodology — searchable by Ask DealerPulse"
      rangePresets={RANGE_PRESETS}
    >
      <div className="mx-auto flex max-w-[760px] flex-col gap-4">
        <p className="text-[12.5px] leading-[1.6] text-ink-secondary">
          These are the real reference documents Ask DealerPulse searches (via retrieval, not
          keyword matching) when you ask a policy or process question — e.g. &ldquo;What&apos;s the
          escalation process for a stale order?&rdquo;. Numeric questions still go through the
          analytics engine, never through these documents.
        </p>
        {docs.map((doc) => (
          <DocSummaryCard
            key={doc.id}
            docId={doc.id}
            title={doc.title}
            path={doc.path}
            preview={doc.text.split("\n\n").find((p) => !p.startsWith("#"))?.slice(0, 220) || ""}
          />
        ))}
      </div>
    </Shell>
  );
}
