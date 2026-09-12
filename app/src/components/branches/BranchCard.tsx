"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { BranchRow } from "@/lib/analytics/context";
import type { StageLeak } from "@/lib/analytics/funnel";
import { fmtINR, fmtNum, fmtPct, fmtSigned } from "@/lib/format";
import { BaselineBar } from "../ui/BaselineBar";
import { StatusPill } from "../ui/StatusPill";

export function BranchCard({
  b,
  rank,
  netConversion,
  leak,
  delayMs,
}: {
  b: BranchRow;
  rank: number;
  netConversion: number;
  leak: StageLeak | undefined;
  delayMs?: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function open() {
    const range = searchParams.get("range");
    router.push(`/branches/${b.id}${range ? `?range=${range}` : ""}`);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => e.key === "Enter" && open()}
      style={{ "--d": (delayMs ?? 0) + "ms" } as React.CSSProperties}
      className={`dp-stagger dp-card-hover cursor-pointer rounded-[10px] border border-line-hairline bg-bg-card p-4 ${
        b.status === "critical" ? "bg-row-critical-tint" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-[12px] text-ink-muted">#{rank}</span>
        <div>
          <div className="text-[15px] font-semibold text-ink-primary">{b.name}</div>
          <div className="text-[11px] text-ink-muted">
            {b.city} · {b.managerName}
          </div>
        </div>
        <StatusPill status={b.status} />
        <div className="ml-auto text-right">
          <div className="font-mono text-[17px] text-ink-primary">{fmtPct(b.maturedConversion)}</div>
          <div className={`text-[11px] ${b.convVsNetwork >= 0 ? "text-healthy" : "text-critical"}`}>
            {fmtSigned(b.convVsNetwork * 100, (v) => `${v.toFixed(1)} pts`)} vs network
          </div>
        </div>
      </div>

      <div className="mt-3">
        <BaselineBar
          value={b.maturedConversion}
          baseline={netConversion}
          max={Math.max(0.6, netConversion * 1.5)}
          tone={b.status === "critical" ? "critical" : "default"}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11.5px] sm:grid-cols-4 lg:grid-cols-7">
        <Stat label="Leads" value={fmtNum(b.leads)} />
        <Stat label="Units" value={fmtNum(b.units)} />
        <Stat label="Revenue" value={fmtINR(b.revenue)} />
        <Stat label="Pipeline" value={fmtINR(b.pipelineValue)} />
        <Stat label="Stale" value={fmtNum(b.staleCount)} />
        <Stat label="Target" value={fmtPct(b.attainment, 0)} />
        <Stat label="Delay rate" value={fmtPct(b.delayRate, 0)} />
      </div>

      {leak && (
        <p className="mt-2 text-[11.5px] text-ink-tertiary">
          <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
            Biggest leak{" "}
          </span>
          {leak.label} · {fmtPct(leak.conv)} vs network {fmtPct(leak.net)}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-ink-muted">{label}</div>
      <div className="font-mono text-ink-primary">{value}</div>
    </div>
  );
}
