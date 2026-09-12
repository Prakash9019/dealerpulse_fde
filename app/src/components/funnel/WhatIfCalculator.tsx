"use client";

import { useMemo, useState } from "react";
import type { FunnelStage } from "@/lib/analytics/funnel";
import { whatIfStageImprovement } from "@/lib/insights/whatif";
import { fmtINR, fmtPct } from "@/lib/format";
import { Select } from "../ui/Select";
import { CountUp } from "../ui/CountUp";
import { fmtSigned } from "@/lib/format";

export function WhatIfCalculator({
  funnel,
  avgDealValue,
}: {
  funnel: FunnelStage[];
  avgDealValue: number;
}) {
  const transitions = funnel.slice(1).map((s, i) => ({
    key: String(i + 1),
    label: `${funnel[i].label} → ${s.label}`,
  }));
  const [stageIndex, setStageIndex] = useState(1);
  const [pts, setPts] = useState(10);

  const result = useMemo(
    () => whatIfStageImprovement(funnel, avgDealValue, stageIndex, pts / 100),
    [funnel, avgDealValue, stageIndex, pts],
  );

  const positive = result.deltaUnits >= 0;

  return (
    <section className="dp-in rounded-[10px] border border-line-hairline bg-bg-card p-4">
      <h2 className="mb-1 text-[13.5px] font-semibold text-ink-primary">What-If Scenario</h2>
      <p className="mb-3 text-[11.5px] text-ink-muted">
        Simulate improving one funnel transition — every later stage keeps its own real
        conversion rate, applied to the larger (or smaller) count flowing into it.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          ariaLabel="Stage transition"
          value={String(stageIndex)}
          onChange={(v) => setStageIndex(Number(v))}
          options={transitions}
        />
        <label className="flex flex-1 min-w-[220px] items-center gap-3">
          <span className="text-[12px] text-ink-tertiary">Improve by</span>
          <input
            type="range"
            min={-30}
            max={30}
            step={1}
            value={pts}
            onChange={(e) => setPts(Number(e.target.value))}
            className="flex-1 accent-accent"
            aria-label="Improvement in percentage points"
          />
          <span className="w-14 shrink-0 text-right font-mono text-[13px] text-ink-primary">
            {pts > 0 ? "+" : ""}
            {pts}pt
          </span>
        </label>
      </div>

      {/* CURRENT → SCENARIO → IMPACT — every value is a CountUp, so moving
          the slider or changing the stage re-tweens each number to its new
          target instead of jump-cutting. That transition itself is the
          signal "the model recalculated," not a fake loading delay. */}
      <div className="mt-4 grid grid-cols-1 gap-3 rounded-lg bg-bg-recessed p-4 sm:grid-cols-3">
        <div className="text-center">
          <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-muted">Current</div>
          <div className="mt-1 font-mono text-[22px] font-medium text-ink-primary">
            <CountUp value={fmtPct(result.baselineConv)} />
          </div>
          <div className="text-[10.5px] text-ink-faint">{result.fromLabel} → {result.toLabel}</div>
        </div>
        <div className="text-center sm:border-x sm:border-line-hairline">
          <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-muted">
            Scenario ({pts > 0 ? "+" : ""}{pts}pt)
          </div>
          <div className="mt-1 font-mono text-[22px] font-medium text-accent">
            <CountUp value={fmtPct(result.improvedConv)} />
          </div>
          <div className="text-[10.5px] text-ink-faint">projected conversion</div>
        </div>
        <div className="text-center">
          <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-muted">Impact</div>
          <div className={`mt-1 font-mono text-[22px] font-medium ${positive ? "text-healthy" : "text-critical"}`}>
            <CountUp value={fmtSigned(result.deltaUnits, (v) => v.toFixed(1) + " units")} />
          </div>
          <div className="text-[10.5px] text-ink-faint">
            <CountUp value={fmtSigned(result.deltaRevenue, fmtINR)} /> revenue
          </div>
        </div>
      </div>
      <p className="mt-3 text-[11.5px] leading-[1.6] text-ink-tertiary">
        Projecting <span className="font-mono text-ink-primary">{result.projectedDelivered.toFixed(1)}</span> delivered
        units against {result.baselineDelivered.toFixed(1)} actual over this period.
      </p>
    </section>
  );
}
