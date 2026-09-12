"use client";

import { useEffect, useState } from "react";

/** The recurring "value bar with a white network-baseline marker" component
    used across Branches, Branch Detail, Rep Scorecard and Funnel Diagnostics.
    Fills in from 0 on mount for a bit of life on data-dense comparison screens. */
export function BaselineBar({
  value,
  baseline,
  max = 1,
  tone = "default",
}: {
  value: number;
  baseline?: number;
  max?: number;
  tone?: "default" | "warn" | "critical";
}) {
  const target = Math.max(0, Math.min(100, (value / max) * 100));
  const basePct = baseline != null ? Math.max(0, Math.min(100, (baseline / max) * 100)) : null;
  const fill =
    tone === "critical" ? "bg-critical" : tone === "warn" ? "bg-warning" : "bg-bar-fill";
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setPct(target));
    return () => cancelAnimationFrame(id);
  }, [target]);

  return (
    <div className="relative h-[10px] w-full rounded-full bg-bar-track">
      <div
        className={`h-full rounded-full ${fill} transition-[width] duration-700 ease-out`}
        style={{ width: `${pct}%` }}
      />
      {basePct != null && (
        <div
          className="absolute top-0 h-full w-px bg-bar-baseline-marker"
          style={{ left: `${basePct}%` }}
        />
      )}
    </div>
  );
}
