"use client";

import { useMemo, useState } from "react";
import { STALE_DAYS, STAGE_LABEL } from "@/lib/domain/model";
import { fmtINR, fmtNum } from "@/lib/format";
import { LeadDrawer } from "../overlays/LeadDrawer";
import { Select } from "../ui/Select";

export interface LeadRow {
  id: string;
  customerName: string;
  model: string;
  branchId: string;
  branchName: string;
  repName: string;
  sourceLabel: string;
  status: string;
  dealValue: number;
  ageDays: number;
  idleDays: number;
  open: boolean;
  reachedContacted: boolean;
  reachedTestDrive: boolean;
}

type CohortKey = "" | "never_contacted" | "no_test_drive" | "stuck_orders" | "cold_7" | "lost" | "delivered";

// No "Open" chip here on purpose: that exact population — every open lead — is already
// Action Center's whole table, scored and ready to work. Duplicating it here as an
// unscored, action-less list would be the same lead queue shown twice with no reason to
// prefer one over the other. The chips below are cohorts Action Center doesn't answer:
// self-serve reporting slices (including leads that are already closed out) rather than
// a second work queue.
const COHORTS: { key: CohortKey; label: string }[] = [
  { key: "", label: "All leads" },
  { key: "never_contacted", label: "Never contacted" },
  { key: "no_test_drive", label: "No test drive" },
  { key: "stuck_orders", label: "Stuck orders" },
  { key: "cold_7", label: "Cold 7+ days" },
  { key: "lost", label: "Lost" },
  { key: "delivered", label: "Delivered" },
];

function matchesCohort(r: LeadRow, cohort: CohortKey): boolean {
  switch (cohort) {
    case "never_contacted": return !r.reachedContacted;
    case "no_test_drive": return !r.reachedTestDrive;
    case "stuck_orders": return r.status === "order_placed" && r.idleDays >= STALE_DAYS;
    case "cold_7": return r.open && r.idleDays >= 7;
    case "lost": return r.status === "lost";
    case "delivered": return r.status === "delivered";
    default: return true;
  }
}

export function LeadsTable({ rows, branches }: { rows: LeadRow[]; branches: { id: string; name: string }[] }) {
  const [cohort, setCohort] = useState<CohortKey>("");
  const [branchId, setBranchId] = useState("");
  const [sort, setSort] = useState<"age" | "idle" | "value">("idle");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<CohortKey, number> = { "": rows.length, never_contacted: 0, no_test_drive: 0, stuck_orders: 0, cold_7: 0, lost: 0, delivered: 0 };
    rows.forEach((r) => {
      COHORTS.forEach(({ key }) => { if (key && matchesCohort(r, key)) c[key]++; });
    });
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const list = rows
      .filter((r) => matchesCohort(r, cohort))
      .filter((r) => !branchId || r.branchId === branchId);
    const sorted = [...list].sort((a, b) => {
      const av = sort === "age" ? a.ageDays : sort === "idle" ? a.idleDays : a.dealValue;
      const bv = sort === "age" ? b.ageDays : sort === "idle" ? b.idleDays : b.dealValue;
      return dir === "desc" ? bv - av : av - bv;
    });
    return sorted;
  }, [rows, cohort, branchId, sort, dir]);

  function toggleSort(key: "age" | "idle" | "value") {
    if (sort === key) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSort(key); setDir("desc"); }
  }

  function sortIndicator(key: "age" | "idle" | "value") {
    if (sort !== key) return "";
    return dir === "desc" ? " ↓" : " ↑";
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {COHORTS.map((c) => (
          <button
            key={c.key || "all"}
            type="button"
            onClick={() => setCohort(c.key)}
            className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
              cohort === c.key
                ? "border-accent-tint-border bg-accent-tint-bg text-ink-primary"
                : "border-line-hairline text-ink-tertiary hover:bg-bg-hover"
            }`}
          >
            {c.label} <span className="font-mono text-[10.5px] text-ink-muted">{fmtNum(counts[c.key])}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          ariaLabel="Branch"
          value={branchId}
          onChange={setBranchId}
          options={[{ key: "", label: "All branches" }, ...branches.map((b) => ({ key: b.id, label: b.name }))]}
        />
        <span className="text-[11.5px] text-ink-muted">
          Showing {fmtNum(filtered.length)} of {fmtNum(rows.length)} leads
        </span>
      </div>

      <div className="overflow-x-auto rounded-[10px] border border-line-hairline">
        <table className="w-full min-w-[900px] text-[12.5px]">
          <thead className="bg-bg-rail text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            <tr>
              <th className="sticky left-0 bg-bg-rail px-3 py-2.5 text-left">Customer</th>
              <th className="px-3 py-2.5 text-left">Model</th>
              <th className="px-3 py-2.5 text-left">Branch / Rep</th>
              <th className="px-3 py-2.5 text-left">Source</th>
              <th className="px-3 py-2.5 text-left">Stage</th>
              <th className="px-3 py-2.5 text-right">Deal value</th>
              <th className="cursor-pointer px-3 py-2.5 text-right" onClick={() => toggleSort("age")}>
                Age{sortIndicator("age")}
              </th>
              <th className="cursor-pointer px-3 py-2.5 text-right" onClick={() => toggleSort("idle")}>
                Idle{sortIndicator("idle")}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-[12px] text-ink-muted">
                  No leads match this filter.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr
                  key={r.id}
                  tabIndex={0}
                  onClick={() => setOpenId(r.id)}
                  onKeyDown={(e) => e.key === "Enter" && setOpenId(r.id)}
                  className="cursor-pointer border-t border-line-row hover:bg-bg-hover"
                >
                  <td className="sticky left-0 bg-bg-card px-3 py-2.5">
                    <div className="text-ink-primary">{r.customerName}</div>
                    <div className="font-mono text-[9.5px] text-ink-muted">{r.id}</div>
                  </td>
                  <td className="px-3 py-2.5 text-ink-tertiary">{r.model}</td>
                  <td className="px-3 py-2.5 text-ink-tertiary">{r.branchName} / {r.repName}</td>
                  <td className="px-3 py-2.5 text-ink-tertiary">{r.sourceLabel}</td>
                  <td className="px-3 py-2.5">
                    <span className="rounded-[4px] bg-neutral-bg px-1.5 py-0.5 text-[10.5px] text-neutral-fg">
                      {STAGE_LABEL[r.status] || r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">{fmtINR(r.dealValue)}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{r.ageDays}d</td>
                  <td className="px-3 py-2.5 text-right font-mono">{r.open ? `${r.idleDays}d` : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {openId && <LeadDrawer leadId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
