import { getContext, getModel, parseFilters } from "@/lib/data";
import type { SearchParams } from "@/lib/data";
import { RANGE_PRESETS } from "@/lib/analytics/context";
import { zProportion } from "@/lib/domain/model";
import { fmtPct } from "@/lib/format";
import { funnelSummary } from "@/lib/ai/explanations";
import { AISummaryCard } from "@/components/ui/AISummaryCard";
import { SummarizeButton } from "@/components/ui/SummarizeButton";
import { Shell } from "@/components/layout/Shell";
import { ScopeSelect } from "@/components/funnel/ScopeSelect";
import { StageList } from "@/components/funnel/StageList";
import { TestDriveGateCard } from "@/components/funnel/TestDriveGateCard";
import { StageBottlenecks } from "@/components/funnel/StageBottlenecks";
import { SourceQuality } from "@/components/funnel/SourceQuality";
import { DeliveryOps } from "@/components/funnel/DeliveryOps";
import { WhatIfCalculator } from "@/components/funnel/WhatIfCalculator";

export default async function FunnelDiagnosticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const model = getModel();
  const scope = typeof sp.scope === "string" ? sp.scope : "network";
  const scopeId = typeof sp.scopeId === "string" ? sp.scopeId : undefined;

  const networkCtx = getContext({ range: filters.range });
  const scopedCtx = getContext({
    range: filters.range,
    branchId: scope === "branch" ? scopeId : undefined,
    repId: scope === "rep" ? scopeId : undefined,
  });

  const flags = scopedCtx.funnel.slice(1).map((s, i) => {
    const net = networkCtx.netFunnel[i + 1].convFromPrev;
    const z = zProportion(s.count, s.n, net || 0.0001);
    return { stage: s.stage, z, flagged: Math.abs(z) >= 2 && s.n >= 10, above: z > 0 };
  });

  const worst = networkCtx.netFunnel.slice(1).reduce((a, b) => (a.dropOff >= b.dropOff ? a : b));

  const scopeLabel =
    scope === "branch" && scopeId ? model.branchById[scopeId]?.name
      : scope === "rep" && scopeId ? model.repById[scopeId]?.name
      : "Network";

  const explanation = `The largest network leakage is ${worst.label} at ${fmtPct(worst.convFromPrev)} conversion, losing ${worst.dropOff} leads.${
    scope !== "network" && scopeLabel
      ? ` ${scopeLabel} converts ${fmtPct(scopedCtx.funnel[1]?.convFromPrev)} at New → Contacted against a network ${fmtPct(networkCtx.netFunnel[1].convFromPrev)}.`
      : ""
  }`;

  const summary = funnelSummary(networkCtx);
  const range = filters.range || "all";

  const reps = model.reps.filter((r) => r.role === "sales_officer");

  return (
    <Shell
      branches={model.branches}
      reps={reps}
      asOfLabel={model.asOfLabel}
      scopeLabel="Funnel Diagnostics"
      screenTitle="Funnel Diagnostics"
      screenSubtitle={scopeLabel}
      rangePresets={RANGE_PRESETS}
    >
      <div className="flex flex-col gap-5">
        <div className="no-print flex justify-end">
          <SummarizeButton screen="funnel" />
        </div>
        <ScopeSelect
          branches={model.branches}
          reps={reps}
          deviatingCount={flags.filter((f) => f.flagged).length}
        />

        <AISummaryCard
          label="AI Funnel Summary"
          headline={summary.whatHappened}
          panels={[
            { title: "Why", tone: "bad", text: summary.why },
            { title: "Impact", tone: "opportunity", text: summary.impact },
            ...(scope !== "network" && scopeLabel ? [{ title: "This scope", tone: "good" as const, text: explanation }] : []),
          ]}
          action={summary.whatNext}
          ctas={[summary.cta]}
          range={range}
        />

        <TestDriveGateCard gate={scopedCtx.testDriveGate} />

        <StageList
          funnel={scopedCtx.funnel}
          netFunnel={networkCtx.netFunnel}
          flags={flags}
          compareToNetwork={scope !== "network"}
        />

        <StageBottlenecks durations={scopedCtx.stageDurations} />

        <WhatIfCalculator funnel={scopedCtx.funnel} avgDealValue={scopedCtx.kpi.avgDealValue} />

        <SourceQuality sources={scopedCtx.sources} baseline={networkCtx.netMaturedConversion} />

        <DeliveryOps delivery={scopedCtx.delivery} branchRows={networkCtx.branchRows} />
      </div>
    </Shell>
  );
}
