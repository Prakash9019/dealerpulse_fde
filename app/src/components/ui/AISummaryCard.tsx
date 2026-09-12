import Link from "next/link";
import type { Route } from "@/lib/domain/types";
import { routeHref } from "@/lib/routes";
import { CopyInsightButton } from "./CopyInsightButton";

export function AISummaryCard({
  label,
  headline,
  panels,
  action,
  ctas,
  range,
}: {
  label: string;
  headline?: string;
  panels: { title: string; tone: "good" | "bad" | "opportunity"; text: string }[];
  action: string;
  ctas: { label: string; route: Route }[];
  range: string;
}) {
  const TONE_LABEL: Record<string, string> = {
    good: "text-healthy",
    bad: "text-warning",
    opportunity: "text-accent",
  };
  const shareText = [headline, ...panels.map((p) => `${p.title}: ${p.text}`), `Do next: ${action}`]
    .filter(Boolean)
    .join("\n\n");
  return (
    <section className="dp-in dp-ai-surface rounded-xl border p-5">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
        <span aria-hidden="true" className="dp-ai-mark inline-block h-[11px] w-[11px] rotate-45 rounded-[2px] bg-accent" />
        {label}
        <CopyInsightButton text={shareText} className="ml-auto normal-case tracking-normal" />
      </div>
      {headline && (
        <p className="mt-3 text-[15px] font-medium leading-[1.5] text-ink-primary">{headline}</p>
      )}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {panels.map((p, i) => (
          <div key={i}>
            <div
              className={`font-mono text-[9.5px] font-semibold uppercase tracking-[0.08em] ${TONE_LABEL[p.tone]}`}
            >
              {p.title}
            </div>
            <p className="mt-1 text-[12px] leading-[1.55] text-ink-secondary">{p.text}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-accent-tint-border pt-4">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-accent">
            Do next
          </div>
          <p className="text-[12.5px] text-ink-secondary">{action}</p>
        </div>
        {ctas.map((c, i) => (
          <Link
            key={i}
            href={routeHref(c.route, range)}
            className={`rounded-[7px] px-3 py-1.5 text-[12.5px] ${
              i === ctas.length - 1
                ? "bg-accent font-semibold text-accent-fill-text"
                : "border border-line-hairline bg-bg-raised text-ink-secondary hover:bg-bg-hover"
            }`}
          >
            {c.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
