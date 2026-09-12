import Link from "next/link";
import type { ExecutiveBrief as Brief } from "@/lib/ai/executiveBrief";
import { routeHref } from "@/lib/routes";
import { CopyInsightButton } from "../ui/CopyInsightButton";

export function ExecutiveBrief({ brief, range }: { brief: Brief; range: string }) {
  const shareText = [brief.headline, ...brief.findings.map((f) => f.text), `Do next: ${brief.action}`].join("\n\n");
  return (
    <section className="dp-in dp-ai-surface rounded-xl border p-5">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
        <span aria-hidden="true" className="dp-ai-mark inline-block h-[11px] w-[11px] rotate-45 rounded-[2px] bg-accent" />
        AI Executive Brief
        <CopyInsightButton text={shareText} className="ml-auto normal-case tracking-normal" />
      </div>

      <p className="mt-3 max-w-[78ch] text-[19px] font-medium leading-[1.45] text-ink-primary">
        {brief.headline}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {brief.findings.map((f, i) => (
          <Link
            key={i}
            href={routeHref(f.route, range)}
            style={{ "--d": i * 60 + 80 + "ms" } as React.CSSProperties}
            className="dp-stagger dp-card-hover rounded-lg border border-line-hairline bg-bg-card/40 p-3"
          >
            <div className="flex items-center gap-1.5">
              <span
                className={`h-[5px] w-[5px] rounded-full ${f.tone === "positive" ? "bg-healthy" : "bg-warning"}`}
              />
              <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                {f.tone === "positive" ? "Momentum" : "Risk"}
              </span>
            </div>
            <p className="mt-1.5 text-[12.5px] leading-[1.55] text-ink-secondary">{f.text}</p>
          </Link>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-accent-tint-border pt-4">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-accent">
            Do next
          </div>
          <p className="text-[12.5px] text-ink-secondary">{brief.action}</p>
        </div>
        <Link
          href={routeHref(brief.problemCta.route, range)}
          className="rounded-[7px] border border-line-hairline bg-bg-raised px-3 py-1.5 text-[12.5px] text-ink-secondary hover:bg-bg-hover"
        >
          {brief.problemCta.label}
        </Link>
        <Link
          href={routeHref(brief.actionCta.route, range)}
          className="rounded-[7px] bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-accent-fill-text"
        >
          {brief.actionCta.label}
        </Link>
      </div>
    </section>
  );
}
