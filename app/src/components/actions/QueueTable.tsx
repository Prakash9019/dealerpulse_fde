"use client";

import { useMemo, useState } from "react";
import { fmtINR } from "@/lib/format";
import { LeadDrawer } from "../overlays/LeadDrawer";
import { Select } from "../ui/Select";
import { TierTiles } from "./TierTiles";

export interface QueueRow {
  id: string;
  customerName: string;
  model: string;
  branchId: string;
  branchName: string;
  repId: string;
  repName: string;
  stage: string;
  stageLabel: string;
  dealValue: number;
  idleDays: number;
  lastActivity: string;
  score: number;
  tier: "critical" | "attention" | "watch";
  riskLabel: "new" | "inactive" | "at-risk" | "stale" | "critical" | "high-value-stale";
  riskLabelText: string;
  reason: string;
  suggestedAction: string;
}

const RISK_STYLE: Record<QueueRow["riskLabel"], string> = {
  new: "bg-neutral-bg text-neutral-fg",
  inactive: "bg-neutral-bg text-neutral-fg",
  "at-risk": "bg-warning-bg text-warning-fg",
  stale: "bg-warning-bg text-warning-fg",
  critical: "bg-critical-bg text-critical-fg",
  "high-value-stale": "bg-critical-bg text-critical-fg",
};

const AGE_BUCKETS = [
  { key: "", label: "Any age" },
  { key: "0-7", label: "0-7 days" },
  { key: "8-14", label: "8-14 days" },
  { key: "15-30", label: "15-30 days" },
  { key: "30+", label: "30+ days" },
];

function inAgeBucket(idleDays: number, bucket: string) {
  if (!bucket) return true;
  if (bucket === "0-7") return idleDays <= 7;
  if (bucket === "8-14") return idleDays >= 8 && idleDays <= 14;
  if (bucket === "15-30") return idleDays >= 15 && idleDays <= 30;
  return idleDays > 30;
}

function toCsv(rows: QueueRow[]): string {
  const head = ["Lead ID", "Customer", "Model", "Branch", "Rep", "Stage", "Deal Value (INR)", "Days Idle", "Last Activity", "Priority", "Tier", "Risk", "Reason", "Suggested Action"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [head.join(","), ...rows.map((r) => [
    r.id, r.customerName, r.model, r.branchName, r.repName, r.stageLabel,
    r.dealValue, r.idleDays, r.lastActivity, r.score, r.tier, r.riskLabelText, r.reason, r.suggestedAction,
  ].map(esc).join(","))].join("\n");
}

export function QueueTable({
  rows,
  branches,
  reps,
  initialTier,
}: {
  rows: QueueRow[];
  branches: { id: string; name: string }[];
  reps: { id: string; name: string; branchId: string }[];
  initialTier?: string;
}) {
  const [tiers, setTiers] = useState<Set<string>>(new Set(initialTier ? [initialTier] : []));
  const [branchId, setBranchId] = useState("");
  const [repId, setRepId] = useState("");
  const [stage, setStage] = useState("");
  const [age, setAge] = useState("");
  const [minValue, setMinValue] = useState("");
  const [sort, setSort] = useState<"priority" | "value" | "idle">("priority");
  const [openId, setOpenId] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const counts: Record<string, number> = { critical: 0, attention: 0, watch: 0 };
  const values: Record<string, number> = { critical: 0, attention: 0, watch: 0 };
  rows.forEach((r) => {
    counts[r.tier]++;
    values[r.tier] += r.dealValue;
  });

  const stages = useMemo(() => [...new Set(rows.map((r) => r.stage))], [rows]);
  const repsForBranch = branchId ? reps.filter((r) => r.branchId === branchId) : reps;

  const filtered = rows
    .filter((r) => tiers.size === 0 || tiers.has(r.tier))
    .filter((r) => !branchId || r.branchId === branchId)
    .filter((r) => !repId || r.repId === repId)
    .filter((r) => !stage || r.stage === stage)
    .filter((r) => inAgeBucket(r.idleDays, age))
    .filter((r) => !minValue || r.dealValue >= Number(minValue));

  const sorted = [...filtered].sort((a, b) =>
    sort === "value" ? b.dealValue - a.dealValue : sort === "idle" ? b.idleDays - a.idleDays : b.score - a.score,
  );

  const hasFilters = tiers.size > 0 || branchId || repId || stage || age || minValue;
  const scopeValue = filtered.reduce((s, r) => s + r.dealValue, 0);

  function toggleTier(t: string) {
    setTiers((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  function clearFilters() {
    setTiers(new Set());
    setBranchId("");
    setRepId("");
    setStage("");
    setAge("");
    setMinValue("");
  }

  function act(id: string, label: string) {
    setDone((prev) => ({ ...prev, [id]: label }));
    setToast(`${label} · ${id} logged. This is a prototype — no CRM write.`);
    setTimeout(() => setToast(null), 2600);
  }

  function actBulk(label: string) {
    const ids = [...selected];
    setDone((prev) => {
      const next = { ...prev };
      ids.forEach((id) => { next[id] = label; });
      return next;
    });
    setSelected(new Set());
    setToast(`${label} · ${ids.length} lead${ids.length === 1 ? "" : "s"} logged. This is a prototype — no CRM write.`);
    setTimeout(() => setToast(null), 2600);
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectableIds = sorted.filter((r) => !done[r.id]).map((r) => r.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(selectableIds));
  }

  function exportCsv() {
    const blob = new Blob([toCsv(sorted)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dealerpulse-actions.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      <TierTiles counts={counts} values={values} active={tiers} onToggle={toggleTier} />

      <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-line-hairline bg-bg-card p-3">
        <Select ariaLabel="Branch" value={branchId} onChange={setBranchId} options={[{ key: "", label: "All branches" }, ...branches.map((b) => ({ key: b.id, label: b.name }))]} />
        <Select ariaLabel="Rep" value={repId} onChange={setRepId} options={[{ key: "", label: "All reps" }, ...repsForBranch.map((r) => ({ key: r.id, label: r.name }))]} />
        <Select ariaLabel="Stage" value={stage} onChange={setStage} options={[{ key: "", label: "All stages" }, ...stages.map((s) => ({ key: s, label: s }))]} />
        <Select ariaLabel="Age bucket" value={age} onChange={setAge} options={AGE_BUCKETS.map((b) => ({ key: b.key, label: b.label }))} />
        <input
          value={minValue}
          onChange={(e) => setMinValue(e.target.value)}
          placeholder="Min deal value"
          type="number"
          className="w-32 rounded-[7px] border border-line-hairline bg-bg-recessed px-2 py-1.5 text-[12px] text-ink-primary placeholder:text-ink-muted"
        />
        <Select ariaLabel="Sort" value={sort} onChange={(v) => setSort(v as typeof sort)} options={[{ key: "priority", label: "Sort: priority" }, { key: "value", label: "Sort: deal value" }, { key: "idle", label: "Sort: days idle" }]} />
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="text-[12px] text-accent hover:underline">
            Clear filters
          </button>
        )}
        <button
          type="button"
          onClick={exportCsv}
          className="ml-auto rounded-[7px] border border-line-hairline px-3 py-1.5 text-[12px] text-ink-secondary hover:bg-bg-hover"
        >
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[11.5px] text-ink-muted">
          Showing {sorted.length} of {rows.length} open leads · {fmtINR(scopeValue)} in scope
        </p>
        {selected.size > 0 && (
          <div className="dp-in flex items-center gap-2 rounded-full border border-accent-tint-border bg-accent-tint-bg px-3 py-1.5">
            <span className="text-[11.5px] text-ink-secondary">{selected.size} selected</span>
            <button onClick={() => actBulk("Contacted")} className="rounded border border-line-hairline px-2 py-0.5 text-[10.5px] transition-transform hover:bg-bg-hover active:scale-90">
              Contact all
            </button>
            <button onClick={() => actBulk("Assigned")} className="rounded border border-line-hairline px-2 py-0.5 text-[10.5px] transition-transform hover:bg-bg-hover active:scale-90">
              Assign all
            </button>
            <button onClick={() => actBulk("Escalated")} className="rounded border border-critical px-2 py-0.5 text-[10.5px] text-critical transition-transform hover:bg-critical-bg active:scale-90">
              Escalate all
            </button>
            <button onClick={() => setSelected(new Set())} className="text-[10.5px] text-ink-muted hover:text-ink-primary">
              Clear
            </button>
          </div>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="text-[12px] text-ink-muted">
          {hasFilters
            ? "No leads match these filters. Clear a filter to widen the queue."
            : "No stale leads in this scope — nothing to chase."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-line-hairline">
          <table className="w-full min-w-[1180px] text-[12.5px]">
            <thead className="bg-bg-rail text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              <tr>
                <th className="px-3 py-2.5 text-left">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="accent-accent"
                  />
                </th>
                <th className="sticky left-0 bg-bg-rail px-3 py-2.5 text-left">Customer</th>
                <th className="px-3 py-2.5 text-left">Model</th>
                <th className="px-3 py-2.5 text-left">Branch / Rep</th>
                <th className="px-3 py-2.5 text-left">Stage</th>
                <th className="px-3 py-2.5 text-right">Deal value</th>
                <th className="px-3 py-2.5 text-right">Idle</th>
                <th className="px-3 py-2.5 text-right">Last activity</th>
                <th className="px-3 py-2.5 text-right">Priority</th>
                <th className="px-3 py-2.5 text-left">Risk</th>
                <th className="px-3 py-2.5 text-left">Reason</th>
                <th className="px-3 py-2.5 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="border-t border-line-row hover:bg-bg-hover">
                  <td className="px-3 py-2.5">
                    {!done[r.id] && (
                      <input
                        type="checkbox"
                        aria-label={`Select ${r.customerName}`}
                        checked={selected.has(r.id)}
                        onChange={() => toggleSelected(r.id)}
                        className="accent-accent"
                      />
                    )}
                  </td>
                  <td className="sticky left-0 bg-bg-card px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-4 w-[3px] rounded-full ${r.tier === "critical" ? "bg-critical" : r.tier === "attention" ? "bg-warning" : "bg-line-strong"}`}
                      />
                      <div>
                        <div className="text-ink-primary">{r.customerName}</div>
                        <div className="font-mono text-[9.5px] text-ink-muted">{r.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-ink-tertiary">{r.model}</td>
                  <td className="px-3 py-2.5 text-ink-tertiary">
                    {r.branchName} / {r.repName}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="rounded-[4px] bg-neutral-bg px-1.5 py-0.5 text-[10.5px] text-neutral-fg">
                      {r.stageLabel}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">{fmtINR(r.dealValue)}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{r.idleDays}d</td>
                  <td className="px-3 py-2.5 text-right font-mono text-ink-muted">{r.lastActivity}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-accent">{r.score}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-[4px] px-1.5 py-0.5 text-[10.5px] ${RISK_STYLE[r.riskLabel]}`}>
                      {r.riskLabelText}
                    </span>
                  </td>
                  <td className="max-w-[220px] px-3 py-2.5 text-[11.5px] text-ink-tertiary">
                    {r.reason}{" "}
                    <button
                      type="button"
                      onClick={() => setOpenId(r.id)}
                      className="underline decoration-dotted"
                    >
                      Why is this high priority?
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    {done[r.id] ? (
                      <span className="dp-pop inline-block rounded-full bg-healthy-bg px-2 py-0.5 text-[10.5px] text-healthy-fg">
                        {done[r.id]}
                      </span>
                    ) : (
                      <div className="flex gap-1.5">
                        <button onClick={() => act(r.id, "Contacted")} className="rounded border border-line-hairline px-1.5 py-0.5 text-[10.5px] transition-transform hover:bg-bg-hover active:scale-90">
                          Contact
                        </button>
                        <button onClick={() => act(r.id, "Assigned")} className="rounded border border-line-hairline px-1.5 py-0.5 text-[10.5px] transition-transform hover:bg-bg-hover active:scale-90">
                          Assign
                        </button>
                        <button onClick={() => act(r.id, "Escalated")} className="rounded border border-critical px-1.5 py-0.5 text-[10.5px] text-critical transition-transform hover:bg-critical-bg active:scale-90">
                          Escalate
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openId && <LeadDrawer leadId={openId} onClose={() => setOpenId(null)} />}
      {toast && (
        <div role="status" aria-live="polite" className="dp-toast fixed bottom-6 left-1/2 z-50 rounded-full border border-line-hairline bg-bg-raised px-4 py-2 text-[12.5px] text-ink-primary shadow-[0_12px_30px_oklch(0.08_0.006_75_/_0.6)]">
          {toast}
        </div>
      )}
    </div>
  );
}
