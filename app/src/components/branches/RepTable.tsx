"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { RepRow } from "@/lib/analytics/reps";
import { fmtINR, fmtNum, fmtPct } from "@/lib/format";
import { Sparkline } from "../ui/Sparkline";
import { HoverBlurb } from "../ui/HoverBlurb";

export function RepTable({
  rows,
  branchAvgConversion,
  sparklines,
  blurbs,
}: {
  rows: RepRow[];
  branchAvgConversion: number;
  sparklines?: Record<string, number[]>;
  blurbs?: Record<string, string>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function open(id: string) {
    const range = searchParams.get("range");
    router.push(`/reps/${id}${range ? `?range=${range}` : ""}`);
  }

  return (
    <div className="dp-in overflow-x-auto rounded-[10px] border border-line-hairline">
      <table className="w-full min-w-[860px] text-[12.5px]">
        <thead className="bg-bg-rail text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
          <tr>
            <th className="sticky left-0 bg-bg-rail px-3 py-2.5 text-left">Rep</th>
            <th className="px-3 py-2.5 text-right">Leads</th>
            <th className="px-3 py-2.5 text-right">Conversion</th>
            <th className="px-3 py-2.5 text-right" title="Monthly units delivered, this period">Trend</th>
            <th className="px-3 py-2.5 text-right">Orders</th>
            <th className="px-3 py-2.5 text-right">Delivered</th>
            <th className="px-3 py-2.5 text-right">Pipeline</th>
            <th className="px-3 py-2.5 text-right">Stale</th>
            <th className="px-3 py-2.5 text-right">Rank</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const tone =
              r.conversion < branchAvgConversion * 0.6
                ? "text-critical"
                : r.conversion > branchAvgConversion * 1.2
                  ? "text-healthy"
                  : "text-ink-primary";
            return (
              <tr
                key={r.id}
                tabIndex={0}
                onClick={() => open(r.id)}
                onKeyDown={(e) => e.key === "Enter" && open(r.id)}
                className="cursor-pointer border-t border-line-row hover:bg-bg-hover"
              >
                <td className="sticky left-0 bg-bg-card px-3 py-2.5">
                  <HoverBlurb text={blurbs?.[r.id] ?? ""}>
                    <div>
                      <div className="font-medium text-ink-primary">{r.name}</div>
                      <div className="text-[10.5px] text-ink-muted">{r.role}</div>
                    </div>
                  </HoverBlurb>
                </td>
                <td className="px-3 py-2.5 text-right font-mono">{fmtNum(r.leads)}</td>
                <td className={`px-3 py-2.5 text-right font-mono ${tone}`}>{fmtPct(r.conversion)}</td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex justify-end">
                    <Sparkline values={sparklines?.[r.id] ?? []} />
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-mono">{fmtNum(r.orders)}</td>
                <td className="px-3 py-2.5 text-right font-mono">{fmtNum(r.delivered)}</td>
                <td className="px-3 py-2.5 text-right font-mono">{fmtINR(r.pipelineValue)}</td>
                <td className="px-3 py-2.5 text-right font-mono">{fmtNum(r.staleCount)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-ink-muted">
                  {r.branchRank}/{r.branchRepCount}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
