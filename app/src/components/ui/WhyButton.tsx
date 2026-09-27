"use client";

import { useWhyPopover } from "./WhyPopoverProvider";

export function WhyButton({ kpiKey }: { kpiKey: string }) {
  const openWhy = useWhyPopover();

  return (
    <button
      type="button"
      onClick={() => openWhy(kpiKey)}
      className="rounded-full border border-accent-tint-border bg-accent-tint-bg px-2 py-0.5 text-[10px] text-accent transition-transform hover:scale-105 active:scale-95"
    >
      Why?
    </button>
  );
}
