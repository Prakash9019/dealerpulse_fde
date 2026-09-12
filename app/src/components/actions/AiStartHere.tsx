import Link from "next/link";
import type { Recommendation } from "@/lib/insights/recommendations";
import { routeHref } from "@/lib/routes";

/** The single highest-impact recommendation, pulled out of the list and given its
    own distinct callout — "if you do nothing else today, do this." */
export function AiStartHere({ rec, range }: { rec: Recommendation; range: string }) {
  return (
    <section className="dp-in dp-card-hover dp-ai-surface rounded-xl border p-5">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
        <span aria-hidden="true" className="dp-ai-mark inline-block h-[11px] w-[11px] rotate-45 rounded-[2px] bg-accent" />
        AI — Start Here
      </div>
      <p className="mt-2 text-[17px] font-medium leading-[1.45] text-ink-primary">{rec.problem}</p>
      <p className="mt-1 text-[12.5px] text-ink-secondary">{rec.action}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {rec.evidence.map((ev, i) => (
          <div key={i} className="text-[11px]">
            <div className="text-ink-muted">{ev.label}</div>
            <div className="font-mono text-ink-primary">{ev.value}</div>
          </div>
        ))}
      </div>
      <Link
        href={routeHref(rec.cta.route, range)}
        className="mt-4 inline-block rounded-[7px] bg-accent px-4 py-2 text-[13px] font-semibold text-accent-fill-text"
      >
        {rec.cta.label}
      </Link>
    </section>
  );
}
