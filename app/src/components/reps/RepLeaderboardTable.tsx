"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fmtINR, fmtNum, fmtPct } from "@/lib/format";
import { Sparkline } from "../ui/Sparkline";
import { HoverBlurb } from "../ui/HoverBlurb";
import { Select } from "../ui/Select";

export interface LeaderboardRow {
  id: string;
  name: string;
  role: string;
  branchId: string;
  branchName: string;
  leads: number;
  conversion: number;
  orders: number;
  delivered: number;
  revenue: number;
  pipelineValue: number;
  staleCount: number;
  networkRank: number;
}

export function RepLeaderboardTable({
  rows,
  branches,
  sparklines,
  blurbs,
}: {
  rows: LeaderboardRow[];
  branches: { id: string; name: string }[];
  sparklines: Record<string, number[]>;
  blurbs: Record<string, string>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [branchFilter, setBranchFilter] = useState("");
  const [sort, setSort] = useState<"conversion" | "revenue" | "delivered">("conversion");

  function open(id: string) {
    const range = searchParams.get("range");
    router.push(`/reps/${id}${range ? `?range=${range}` : ""}`);
  }

  const filtered = useMemo(() => {
    const list = branchFilter ? rows.filter((r) => r.branchId === branchFilter) : rows;
    return [...list].sort((a, b) =>
      sort === "revenue" ? b.revenue - a.revenue : sort === "delivered" ? b.delivered - a.delivered : b.conversion - a.conversion,
    );
  }, [rows, branchFilter, sort]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          ariaLabel="Branch"
          value={branchFilter}
          onChange={setBranchFilter}
          options={[{ key: "", label: "All branches" }, ...branches.map((b) => ({ key: b.id, label: b.name }))]}
        />
        <Select
          ariaLabel="Sort"
          value={sort}
          onChange={(v) => setSort(v as typeof sort)}
          options={[
            { key: "conversion", label: "Sort: conversion" },
            { key: "revenue", label: "Sort: revenue" },
            { key: "delivered", label: "Sort: delivered" },
          ]}
        />
        <span className="text-[11.5px] text-ink-muted">{filtered.length} reps</span>
      </div>

      <div className="dp-in overflow-x-auto rounded-[10px] border border-line-hairline">
        <table className="w-full min-w-[920px] text-[12.5px]">
          <thead className="bg-bg-rail text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            <tr>
              <th className="sticky left-0 bg-bg-rail px-3 py-2.5 text-left">Rank</th>
              <th className="px-3 py-2.5 text-left">Rep</th>
              <th className="px-3 py-2.5 text-left">Branch</th>
              <th className="px-3 py-2.5 text-right">Leads</th>
              <th className="px-3 py-2.5 text-right">Conversion</th>
              <th className="px-3 py-2.5 text-right" title="Monthly units delivered, this period">Trend</th>
              <th className="px-3 py-2.5 text-right">Orders</th>
              <th className="px-3 py-2.5 text-right">Delivered</th>
              <th className="px-3 py-2.5 text-right">Revenue</th>
              <th className="px-3 py-2.5 text-right">Stale</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr
                key={r.id}
                tabIndex={0}
                onClick={() => open(r.id)}
                onKeyDown={(e) => e.key === "Enter" && open(r.id)}
                className="cursor-pointer border-t border-line-row hover:bg-bg-hover"
              >
                <td className="sticky left-0 bg-bg-card px-3 py-2.5 font-mono text-ink-muted">
                  {sort === "conversion" ? r.networkRank : i + 1}
                </td>
                <td className="px-3 py-2.5">
                  <HoverBlurb text={blurbs[r.id] ?? ""}>
                    <div>
                      <div className="font-medium text-ink-primary">{r.name}</div>
                      <div className="text-[10.5px] text-ink-muted">{r.role}</div>
                    </div>
                  </HoverBlurb>
                </td>
                <td className="px-3 py-2.5 text-ink-tertiary">{r.branchName}</td>
                <td className="px-3 py-2.5 text-right font-mono">{fmtNum(r.leads)}</td>
                <td className="px-3 py-2.5 text-right font-mono">{fmtPct(r.conversion)}</td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex justify-end">
                    <Sparkline values={sparklines[r.id] ?? []} />
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-mono">{fmtNum(r.orders)}</td>
                <td className="px-3 py-2.5 text-right font-mono">{fmtNum(r.delivered)}</td>
                <td className="px-3 py-2.5 text-right font-mono">{fmtINR(r.revenue)}</td>
                <td className="px-3 py-2.5 text-right font-mono">{fmtNum(r.staleCount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
