"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Select } from "../ui/Select";
import type { RANGE_PRESETS } from "@/lib/analytics/context";

const DATA_MIN = "2025-06-01";
const DATA_MAX = "2025-12-31";

export function RangeControl({ rangePresets }: { rangePresets: typeof RANGE_PRESETS }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const range = searchParams.get("range") || "all";
  const isCustom = range === "custom";
  const [from, setFrom] = useState(searchParams.get("from") || DATA_MIN);
  const [to, setTo] = useState(searchParams.get("to") || DATA_MAX);

  function applyPreset(value: string) {
    const qs = new URLSearchParams(searchParams.toString());
    if (value === "custom") {
      qs.set("range", "custom");
      qs.set("from", from);
      qs.set("to", to);
    } else {
      qs.set("range", value);
      qs.delete("from");
      qs.delete("to");
    }
    router.push(`${pathname}?${qs.toString()}`);
  }

  function applyCustom(nextFrom: string, nextTo: string) {
    if (!nextFrom || !nextTo) return;
    const qs = new URLSearchParams(searchParams.toString());
    qs.set("range", "custom");
    qs.set("from", nextFrom);
    qs.set("to", nextTo);
    router.push(`${pathname}?${qs.toString()}`);
  }

  return (
    <div className="flex items-center gap-1.5 text-[12px]">
      <span className="font-mono text-[9.5px] tracking-[0.06em] text-ink-muted">RANGE</span>
      <Select
        ariaLabel="Range"
        value={range}
        onChange={applyPreset}
        options={[...rangePresets.map((r) => ({ key: r.key, label: r.label })), { key: "custom", label: "Custom range…" }]}
      />
      {isCustom && (
        <>
          <label className="sr-only" htmlFor="range-from">
            From date
          </label>
          <input
            id="range-from"
            type="date"
            value={from}
            min={DATA_MIN}
            max={to}
            onChange={(e) => {
              setFrom(e.target.value);
              applyCustom(e.target.value, to);
            }}
            className="rounded-[7px] border border-line-hairline bg-bg-card px-2 py-1.5 text-[12px] text-ink-primary"
          />
          <span className="text-ink-muted">–</span>
          <label className="sr-only" htmlFor="range-to">
            To date
          </label>
          <input
            id="range-to"
            type="date"
            value={to}
            min={from}
            max={DATA_MAX}
            onChange={(e) => {
              setTo(e.target.value);
              applyCustom(from, e.target.value);
            }}
            className="rounded-[7px] border border-line-hairline bg-bg-card px-2 py-1.5 text-[12px] text-ink-primary"
          />
        </>
      )}
    </div>
  );
}
