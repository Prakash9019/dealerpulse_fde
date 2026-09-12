"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { BranchRow } from "@/lib/analytics/context";
import { fmtPct } from "@/lib/format";
import { StatusPill } from "../ui/StatusPill";

interface Dimension {
  label: string;
  pct: number; // 0-1, already normalised for bar width
  tone: "good" | "bad";
  display: string;
}

export function NetworkHealthMatrix({
  rows,
  netConversion,
}: {
  rows: BranchRow[];
  netConversion: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const maxRevenue = Math.max(...rows.map((r) => r.revenue), 1);
  const maxPipeline = Math.max(...rows.map((r) => r.pipelineValue), 1);
  const maxRisk = Math.max(...rows.map((r) => r.revenueAtRisk), 1);

  function open(id: string) {
    const range = searchParams.get("range");
    router.push(`/branches/${id}${range ? `?range=${range}` : ""}`);
  }

  return (
    <section>
      <h2 className="mb-3 text-[13.5px] font-semibold text-ink-primary">Network Health</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {rows.map((b, i) => {
          const dims: Dimension[] = [
            { label: "Conversion", pct: Math.min(1, b.maturedConversion / 0.6), tone: b.maturedConversion >= netConversion ? "good" : "bad", display: fmtPct(b.maturedConversion) },
            { label: "Revenue", pct: b.revenue / maxRevenue, tone: "good", display: fmtPct(b.revenue / maxRevenue, 0) + " of top" },
            { label: "Pipeline", pct: b.pipelineValue / maxPipeline, tone: "good", display: fmtPct(b.pipelineValue / maxPipeline, 0) + " of top" },
            { label: "On-time delivery", pct: 1 - b.delayRate, tone: b.delayRate <= 0.35 ? "good" : "bad", display: fmtPct(1 - b.delayRate, 0) },
            { label: "Revenue at risk", pct: b.revenueAtRisk / maxRisk, tone: "bad", display: fmtPct(b.revenueAtRisk / maxRisk, 0) + " of worst" },
          ];
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => open(b.id)}
              style={{ "--d": i * 50 + "ms" } as React.CSSProperties}
              className="dp-stagger dp-card-hover flex flex-col gap-2.5 rounded-[10px] border border-line-hairline bg-bg-card p-3.5 text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[12.5px] font-medium text-ink-primary">{b.name}</span>
                <StatusPill status={b.status} />
              </div>
              {dims.map((d) => (
                <div key={d.label} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-[10px] text-ink-muted">{d.label}</span>
                  <div className="h-[5px] flex-1 rounded-full bg-bar-track">
                    <div
                      className={`h-full rounded-full ${d.tone === "good" ? "bg-healthy" : "bg-critical"}`}
                      style={{ width: `${Math.max(2, Math.min(100, d.pct * 100))}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right font-mono text-[9.5px] text-ink-muted">
                    {d.display}
                  </span>
                </div>
              ))}
            </button>
          );
        })}
      </div>
    </section>
  );
}
