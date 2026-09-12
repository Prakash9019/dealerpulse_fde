"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useEscapeClose } from "@/lib/useEscapeClose";
import { CopyInsightButton } from "./CopyInsightButton";
import { FeedbackRow } from "./FeedbackRow";

export function SummarizeButton({ screen, branchId, repId }: { screen: "overview" | "branch" | "funnel" | "actions"; branchId?: string; repId?: string }) {
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  useEscapeClose(() => setOpen(false));

  async function run() {
    setOpen(true);
    setLoading(true);
    setSummary(null);
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          screen,
          branchId,
          repId,
          range: searchParams.get("range") || "all",
          branch: searchParams.get("branch") || undefined,
          rep: searchParams.get("rep") || undefined,
        }),
      });
      const data = await res.json();
      setSummary(data.summary || "AI insights are temporarily unavailable.");
    } catch {
      setSummary("AI insights are temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={run}
        className="dp-card-hover flex items-center gap-1.5 rounded-[7px] border border-accent-tint-border bg-accent-tint-bg px-2.5 py-1.5 text-[12px] text-accent"
      >
        ✨ Summarize
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Summary"
          className="dp-scrim fixed inset-0 z-50 flex items-center justify-center bg-bg-scrim px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="dp-pop w-full max-w-[480px] rounded-xl border border-line-hairline bg-bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
              <span aria-hidden="true" className="dp-ai-mark inline-block h-[11px] w-[11px] rotate-45 rounded-[2px] bg-accent" />
              Summary
              {summary && <CopyInsightButton text={summary} className="ml-auto normal-case tracking-normal" />}
            </div>
            {loading && <div className="dp-shimmer h-24 rounded-lg bg-bg-recessed" aria-busy="true" />}
            {!loading && summary && (
              <div className="dp-in space-y-3">
                <p className="text-[13.5px] leading-[1.6] text-ink-primary">{summary}</p>
                <FeedbackRow context={`summarize-${screen}`} question={summary} />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
