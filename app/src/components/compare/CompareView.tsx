"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Select } from "../ui/Select";
import type { CompareResult } from "@/lib/ai/compare";

interface EntityOption {
  id: string;
  name: string;
  sub: string;
}

type CompareType = "branch" | "rep" | "branch-network" | "rep-network" | "rep-branch";

const MODES: { key: CompareType; label: string }[] = [
  { key: "branch", label: "Branch vs Branch" },
  { key: "branch-network", label: "Branch vs Network" },
  { key: "rep", label: "Rep vs Rep" },
  { key: "rep-network", label: "Rep vs Network" },
  { key: "rep-branch", label: "Rep vs Branch" },
];

/** Which entity list backs the A and B pickers for each mode — network modes
    need no B picker at all, and rep-branch draws A from reps, B from branches. */
function listFor(type: CompareType, side: "a" | "b", branches: EntityOption[], reps: EntityOption[]) {
  if (type === "branch" || type === "branch-network") return branches;
  if (type === "rep" || type === "rep-network") return reps;
  return side === "a" ? reps : branches;
}

export function CompareView({
  branches,
  reps,
}: {
  branches: EntityOption[];
  reps: EntityOption[];
}) {
  const searchParams = useSearchParams();
  const [type, setType] = useState<CompareType>("branch");
  const listA = listFor(type, "a", branches, reps);
  const listB = listFor(type, "b", branches, reps);
  const needsB = type === "branch" || type === "rep" || type === "rep-branch";
  const [idA, setIdA] = useState(listA[0]?.id ?? "");
  const [idB, setIdB] = useState(needsB ? (listB[1]?.id ?? listB[0]?.id ?? "") : "");
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(true);

  function fetchComparison(nextType: CompareType, a: string, b: string) {
    const nextNeedsB = nextType === "branch" || nextType === "rep" || nextType === "rep-branch";
    if (!a || (nextNeedsB && (!b || a === b))) return;
    return fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: nextType, idA: a, idB: nextNeedsB ? b : undefined, range: searchParams.get("range") || "all" }),
    })
      .then((r) => r.json())
      .then(setResult);
  }

  // Initial comparison on mount — `loading` already starts true, so no synchronous
  // setState is needed here; only the async chain below (inside .finally) touches state.
  useEffect(() => {
    const promise = fetchComparison(type, idA, idB);
    if (promise) promise.finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectType(nextType: CompareType) {
    const nextListA = listFor(nextType, "a", branches, reps);
    const nextListB = listFor(nextType, "b", branches, reps);
    const nextNeedsB = nextType === "branch" || nextType === "rep" || nextType === "rep-branch";
    const a = nextListA[0]?.id ?? "";
    const b = nextNeedsB ? (nextListB[1]?.id ?? nextListB[0]?.id ?? "") : "";
    setType(nextType);
    setIdA(a);
    setIdB(b);
    setLoading(true);
    fetchComparison(nextType, a, b)?.finally(() => setLoading(false));
  }

  function selectA(next: string) {
    setIdA(next);
    setLoading(true);
    fetchComparison(type, next, idB)?.finally(() => setLoading(false));
  }

  function selectB(next: string) {
    setIdB(next);
    setLoading(true);
    fetchComparison(type, idA, next)?.finally(() => setLoading(false));
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          ariaLabel="Compare type"
          value={type}
          onChange={(v) => selectType(v as CompareType)}
          options={MODES.map((m) => ({ key: m.key, label: m.label }))}
        />
        <Select ariaLabel="First" value={idA} onChange={selectA} options={listA.map((e) => ({ key: e.id, label: `${e.name} · ${e.sub}` }))} />
        {needsB ? (
          <>
            <span className="text-[12px] text-ink-muted">vs</span>
            <Select ariaLabel="Second" value={idB} onChange={selectB} options={listB.map((e) => ({ key: e.id, label: `${e.name} · ${e.sub}` }))} />
          </>
        ) : (
          <span className="text-[12px] text-ink-muted">vs Network</span>
        )}
      </div>

      {needsB && idA === idB && (
        <p className="text-[12px] text-ink-muted">Pick two different entities to compare.</p>
      )}

      {loading && <div className="dp-shimmer h-64 rounded-[10px] bg-bg-card" aria-busy="true" />}

      {!loading && result && idA !== idB && (
        <>
          <section className="dp-in dp-ai-surface rounded-xl border p-5">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
              <span aria-hidden="true" className="dp-ai-mark inline-block h-[11px] w-[11px] rotate-45 rounded-[2px] bg-accent" />
              AI Comparison
            </div>
            <p className="mt-2 text-[14.5px] leading-[1.6] text-ink-primary">{result.narrative}</p>
          </section>

          <div className="overflow-x-auto rounded-[10px] border border-line-hairline">
            <table className="w-full min-w-[520px] text-[12.5px]">
              <thead className="bg-bg-rail text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                <tr>
                  <th className="px-3 py-2.5 text-left">Metric</th>
                  <th className="px-3 py-2.5 text-right">{result.aLabel}</th>
                  <th className="px-3 py-2.5 text-right">{result.bLabel}</th>
                </tr>
              </thead>
              <tbody>
                {result.metrics.map((m) => (
                  <tr key={m.label} className="border-t border-line-row">
                    <td className="px-3 py-2.5 text-ink-tertiary">{m.label}</td>
                    <td className={`px-3 py-2.5 text-right font-mono ${m.winner === "a" ? "text-healthy" : "text-ink-primary"}`}>
                      {m.aValue}
                    </td>
                    <td className={`px-3 py-2.5 text-right font-mono ${m.winner === "b" ? "text-healthy" : "text-ink-primary"}`}>
                      {m.bValue}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
