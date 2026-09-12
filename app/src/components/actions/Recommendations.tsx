import Link from "next/link";
import type { Recommendation } from "@/lib/insights/recommendations";
import { routeHref } from "@/lib/routes";
import { CopyInsightButton } from "../ui/CopyInsightButton";

export function Recommendations({ recs, range }: { recs: Recommendation[]; range: string }) {
  return (
    <section className="dp-in dp-ai-surface rounded-xl border p-5">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
        <span aria-hidden="true" className="dp-ai-mark inline-block h-[11px] w-[11px] rotate-45 rounded-[2px] bg-accent" />
        AI Recommended Actions
      </div>
      <div className="mt-4 space-y-3">
        {recs.map((r, i) => (
          <div
            key={r.id}
            style={{ "--d": i * 60 + 100 + "ms" } as React.CSSProperties}
            className="dp-stagger dp-card-hover rounded-lg border border-line-hairline bg-bg-card/40 p-3.5"
          >
            <div className="mb-1.5 flex items-center gap-2">
              <span className="rounded-full border border-line-hairline px-2 py-0.5 text-[10px] text-ink-muted">
                {r.horizon}
              </span>
              <CopyInsightButton
                text={`${r.problem}\n\nImpact: ${r.impact}\n\n${r.action}`}
                className="ml-auto"
              />
            </div>
            <p className="text-[13px] font-medium text-ink-primary">{r.problem}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {r.evidence.map((ev, i) => (
                <div key={i} className="text-[11px]">
                  <div className="text-ink-muted">{ev.label}</div>
                  <div className="font-mono text-ink-secondary">{ev.value}</div>
                  {ev.note && <div className="text-[9.5px] text-ink-muted">{ev.note}</div>}
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11.5px] text-ink-tertiary">
              <span className="font-semibold text-ink-muted">Impact: </span>
              {r.impact}
            </p>
            <p className="mt-1 text-[12px] text-ink-secondary">{r.action}</p>
            <Link
              href={routeHref(r.cta.route, range)}
              className="mt-2 inline-block rounded-[7px] border border-line-hairline px-3 py-1.5 text-[12px] text-ink-secondary hover:bg-bg-hover"
            >
              {r.cta.label}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
