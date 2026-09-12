"use client";

import { useState } from "react";
import { FeedbackRow } from "../ui/FeedbackRow";

interface DocumentSummary {
  tldr: string;
  keyPoints: string[];
  risks: string[];
  requiredActions: string[];
  usedGemini: boolean;
}

export function DocSummaryCard({ docId, title, path, preview }: { docId: string; title: string; path: string; preview: string }) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<DocumentSummary | null>(null);

  async function summarize() {
    setLoading(true);
    try {
      const res = await fetch("/api/docs/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId }),
      });
      setSummary(await res.json());
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-[10px] border border-line-hairline bg-bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[13.5px] font-semibold text-ink-primary">{title}</h2>
          <p className="font-mono text-[10px] text-ink-muted">{path}</p>
        </div>
        {!summary && (
          <button
            type="button"
            onClick={summarize}
            disabled={loading}
            className="shrink-0 rounded-[7px] border border-accent-tint-border bg-accent-tint-bg px-2.5 py-1.5 text-[12px] text-accent disabled:opacity-60"
          >
            {loading ? "Summarizing…" : "✨ Summarize"}
          </button>
        )}
      </div>

      {!summary && <p className="mt-2 text-[12px] leading-[1.6] text-ink-tertiary">{preview}</p>}

      {loading && <div className="dp-shimmer mt-3 h-20 rounded-lg bg-bg-recessed" aria-busy="true" />}

      {summary && (
        <div className="dp-in mt-3 space-y-3">
          <div>
            <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-accent">TL;DR</div>
            <p className="mt-1 text-[13px] leading-[1.6] text-ink-primary">{summary.tldr}</p>
          </div>
          {summary.keyPoints.length > 0 && (
            <div>
              <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-muted">Key points</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12px] text-ink-secondary">
                {summary.keyPoints.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}
          {summary.risks.length > 0 && (
            <div>
              <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-warning">Risks</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12px] text-ink-secondary">
                {summary.risks.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}
          {summary.requiredActions.length > 0 && (
            <div>
              <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-healthy">Required actions</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12px] text-ink-secondary">
                {summary.requiredActions.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}
          <div className="text-[10.5px] text-ink-faint">Source: {path}</div>
          <FeedbackRow context={`doc-summary-${docId}`} question={summary.tldr} />
        </div>
      )}
    </section>
  );
}
