"use client";

import { useState } from "react";
import Link from "next/link";
import type { Anomaly, RankedAnomalies } from "@/lib/insights/anomalies";
import { routeHref } from "@/lib/routes";
import { CopyInsightButton } from "../ui/CopyInsightButton";

const SEVERITY_STYLE: Record<string, string> = {
  critical: "border-critical text-critical",
  risk: "border-warning text-warning",
  watch: "border-ink-faint text-ink-muted",
  opportunity: "border-healthy text-healthy",
};

// A distinct hue per anomaly TYPE (not severity — the left border already
// carries that) so the list reads as more than a wall of red/amber/gray.
// Purely categorical color, doesn't change meaning: severity still drives
// the border and label color above.
const TYPE_DOT: Record<string, string> = {
  "Branch conversion": "bg-critical",
  "Stage conversion": "bg-[oklch(0.72_0.14_320)]", // violet
  "Lead aging": "bg-[oklch(0.72_0.13_250)]", // blue
  "Delivery volume": "bg-accent",
  "Delivery delay": "bg-warning",
  "Source quality": "bg-[oklch(0.78_0.13_95)]", // gold
  "Target pace": "bg-[oklch(0.72_0.12_170)]", // teal-green
  "Rep conversion": "bg-[oklch(0.72_0.15_15)]", // rose
};

export function InsightsList({ anomalies, range }: { anomalies: RankedAnomalies; range: string }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const { shown, overflow } = anomalies;
  const visible = showAll ? [...shown, ...overflow] : shown;

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section>
      <h2 className="mb-3 text-[13.5px] font-semibold text-ink-primary">AI Insights</h2>
      <div className="space-y-2.5">
        {visible.map((a: Anomaly, i: number) => {
          const isOpen = open.has(a.id);
          return (
            <div
              key={a.id}
              style={{ "--d": i * 50 + "ms" } as React.CSSProperties}
              className={`dp-stagger dp-card-hover rounded-[9px] border-l-2 bg-bg-card p-3.5 ${SEVERITY_STYLE[a.severity]}`}
            >
              <button
                type="button"
                onClick={() => toggle(a.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-2.5 text-left"
              >
                <span
                  className={`font-mono text-[9px] font-semibold uppercase tracking-[0.08em] ${SEVERITY_STYLE[a.severity]}`}
                >
                  {a.severity}
                </span>
                <span className={`h-[6px] w-[6px] shrink-0 rounded-full ${TYPE_DOT[a.type] ?? "bg-ink-faint"}`} />
                <span className="text-[10.5px] text-ink-muted">{a.type}</span>
                <span className="ml-auto text-ink-muted">{isOpen ? "−" : "+"}</span>
              </button>
              <p className="mt-1.5 text-[12.5px] font-medium text-ink-primary">{a.title}</p>
              {isOpen && (
                <div className="dp-in mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2 rounded-[8px] bg-bg-recessed p-3 sm:grid-cols-4">
                    {a.evidence.map((ev, i) => (
                      <div key={i}>
                        <div className="text-[10px] text-ink-muted">{ev.label}</div>
                        <div className="font-mono text-[12.5px] text-ink-primary">{ev.value}</div>
                        {ev.note && <div className="text-[9.5px] text-ink-muted">{ev.note}</div>}
                      </div>
                    ))}
                  </div>
                  <p className="text-[12px] leading-[1.6] text-ink-secondary">{a.explanation}</p>
                  <p className="text-[11.5px] text-ink-tertiary">
                    <span className="font-semibold text-ink-muted">Impact: </span>
                    {a.impact}
                  </p>
                  <div className="flex items-center gap-2">
                    <Link
                      href={routeHref(a.cta.route, range)}
                      className="inline-block rounded-[7px] border border-line-hairline px-3 py-1.5 text-[12px] text-ink-secondary hover:bg-bg-hover"
                    >
                      {a.cta.label}
                    </Link>
                    <CopyInsightButton text={`${a.title}\n\n${a.explanation}\n\nImpact: ${a.impact}`} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!showAll && overflow.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-2.5 text-[11.5px] text-ink-muted underline decoration-dotted hover:text-ink-primary"
        >
          +{overflow.length} more (lower impact)
        </button>
      )}
    </section>
  );
}
