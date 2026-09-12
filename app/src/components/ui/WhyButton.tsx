"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { routeHref } from "@/lib/routes";
import { useEscapeClose } from "@/lib/useEscapeClose";
import type { Route } from "@/lib/domain/types";

interface WhyPoint {
  text: string;
  value: string;
}
interface WhyResult {
  title: string;
  points: WhyPoint[];
  cta: { label: string; route: Route };
}

export function WhyButton({ kpiKey }: { kpiKey: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WhyResult | null>(null);
  useEscapeClose(() => setOpen(false));

  async function openWhy() {
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch("/api/why", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: kpiKey,
          range: searchParams.get("range") || "all",
          branch: searchParams.get("branch") || undefined,
        }),
      });
      setResult(await res.json());
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openWhy}
        className="rounded-full border border-accent-tint-border bg-accent-tint-bg px-2 py-0.5 text-[10px] text-accent transition-transform hover:scale-105 active:scale-95"
      >
        Why?
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Why explanation"
          className="dp-scrim fixed inset-0 z-50 flex items-center justify-center bg-bg-scrim px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="dp-pop w-full max-w-[480px] rounded-xl border border-line-hairline bg-bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {loading && <div className="dp-shimmer h-32 rounded-lg bg-bg-recessed" aria-busy="true" />}
            {!loading && result && (
              <>
                <div className="mb-3 text-[15px] font-medium text-ink-primary">{result.title}</div>
                <ul className="space-y-2">
                  {result.points.map((p, i) => (
                    <li key={i} className="flex items-start justify-between gap-3 text-[12.5px]">
                      <span className="text-ink-secondary">{p.text}</span>
                      <span className="shrink-0 font-mono text-ink-primary">{p.value}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => {
                    router.push(routeHref(result.cta.route, searchParams.get("range")));
                    setOpen(false);
                  }}
                  className="mt-4 rounded-[7px] bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-accent-fill-text"
                >
                  {result.cta.label}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
