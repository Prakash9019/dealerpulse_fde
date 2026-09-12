"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select } from "../ui/Select";

export function ScopeSelect({
  branches,
  reps,
  deviatingCount,
}: {
  branches: { id: string; name: string }[];
  reps: { id: string; name: string }[];
  deviatingCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scope = searchParams.get("scope") || "network";
  const scopeId = searchParams.get("scopeId") || "";

  function setScope(nextScope: string, nextId: string) {
    const qs = new URLSearchParams(searchParams.toString());
    qs.set("scope", nextScope);
    if (nextId) qs.set("scopeId", nextId);
    else qs.delete("scopeId");
    router.push(`${pathname}?${qs.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        ariaLabel="Comparison scope"
        value={scope}
        onChange={(v) => setScope(v, "")}
        options={[
          { key: "network", label: "Network baseline" },
          { key: "branch", label: "Branch…" },
          { key: "rep", label: "Rep…" },
        ]}
      />
      {scope === "branch" && (
        <Select
          ariaLabel="Branch"
          value={scopeId}
          onChange={(v) => setScope("branch", v)}
          options={[{ key: "", label: "Choose a branch" }, ...branches.map((b) => ({ key: b.id, label: b.name }))]}
        />
      )}
      {scope === "rep" && (
        <Select
          ariaLabel="Rep"
          value={scopeId}
          onChange={(v) => setScope("rep", v)}
          options={[{ key: "", label: "Choose a rep" }, ...reps.map((r) => ({ key: r.id, label: r.name }))]}
        />
      )}
      <span className="text-[11.5px] text-ink-muted">
        {deviatingCount} stage{deviatingCount === 1 ? "" : "s"} deviate beyond two standard errors
      </span>
    </div>
  );
}
