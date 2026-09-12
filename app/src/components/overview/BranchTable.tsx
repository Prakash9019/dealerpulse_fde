"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { BranchRow } from "@/lib/analytics/context";
import { fmtINR, fmtNum, fmtPct } from "@/lib/format";
import { StatusPill } from "../ui/StatusPill";
import { Sparkline } from "../ui/Sparkline";
import { HoverBlurb } from "../ui/HoverBlurb";

export function BranchTable({
  rows,
  sparklines,
  blurbs,
}: {
  rows: BranchRow[];
  sparklines?: Record<string, number[]>;
  blurbs?: Record<string, string>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function open(id: string) {
    const range = searchParams.get("range");
    router.push(`/branches/${id}${range ? `?range=${range}` : ""}`);
  }

  return (
    <div className="dp-in overflow-x-auto rounded-[10px] border border-line-hairline">
      <table className="w-full min-w-[1040px] text-[12.5px]">
        <thead className="bg-bg-rail text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
          <tr>
            <th className="sticky left-0 bg-bg-rail px-3 py-2.5 text-left">Branch</th>
            <th className="px-3 py-2.5 text-right">Leads</th>
            <th className="px-3 py-2.5 text-right">Conversion</th>
            <th className="px-3 py-2.5 text-right">Units</th>
            <th className="px-3 py-2.5 text-right" title="Monthly units delivered, this period">Trend</th>
            <th className="px-3 py-2.5 text-right">Revenue</th>
            <th className="px-3 py-2.5 text-right">Target</th>
            <th className="px-3 py-2.5 text-right">At risk</th>
            <th className="px-3 py-2.5 text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr
              key={b.id}
              tabIndex={0}
              onClick={() => open(b.id)}
              onKeyDown={(e) => e.key === "Enter" && open(b.id)}
              className={`cursor-pointer border-t border-line-row hover:bg-bg-hover ${
                b.status === "critical" ? "bg-row-critical-tint" : ""
              }`}
            >
              <td className="sticky left-0 bg-inherit px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-4 w-[3px] rounded-full ${b.status === "critical" ? "bg-critical" : b.status === "healthy" ? "bg-healthy" : "bg-line-strong"}`}
                  />
                  <HoverBlurb text={blurbs?.[b.id] ?? ""}>
                    <div>
                      <div className="font-medium text-ink-primary">{b.name}</div>
                      <div className="text-[10.5px] text-ink-muted">
                        {b.city} · {b.managerName}
                      </div>
                    </div>
                  </HoverBlurb>
                </div>
              </td>
              <td className="px-3 py-2.5 text-right font-mono">{fmtNum(b.leads)}</td>
              <td className="px-3 py-2.5 text-right font-mono">{fmtPct(b.maturedConversion)}</td>
              <td className="px-3 py-2.5 text-right font-mono">{fmtNum(b.units)}</td>
              <td className="px-3 py-2.5 text-right">
                <div className="flex justify-end">
                  <Sparkline
                    values={sparklines?.[b.id] ?? []}
                    tone={b.status === "critical" ? "critical" : "default"}
                  />
                </div>
              </td>
              <td className="px-3 py-2.5 text-right font-mono">{fmtINR(b.revenue)}</td>
              <td className="px-3 py-2.5 text-right">
                <div className="font-mono">{fmtPct(b.attainment, 0)}</div>
                <div className="text-[10px] text-ink-muted">rank {b.attainmentRank}</div>
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-warning">
                {fmtINR(b.revenueAtRisk)}
              </td>
              <td className="px-3 py-2.5 text-right">
                <StatusPill status={b.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-line-hairline bg-bg-rail px-3 py-2 text-[10.5px] text-ink-muted">
        Conversion excludes leads younger than the maturity window (see About). Target attainment
        is shown with rank because targets are mis-calibrated network-wide.
      </p>
    </div>
  );
}
