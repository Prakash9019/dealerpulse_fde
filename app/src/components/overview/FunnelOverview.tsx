import Link from "next/link";
import type { FunnelStage } from "@/lib/analytics/funnel";
import { fmtDays, fmtNum, fmtPct } from "@/lib/format";
import { routeHref } from "@/lib/routes";

export function FunnelOverview({ funnel, range }: { funnel: FunnelStage[]; range: string }) {
  const top = funnel[0]?.count || 1;
  const worst = funnel.slice(1).reduce((a, b) => (a.dropOff >= b.dropOff ? a : b), funnel[1]);

  return (
    <section className="dp-in rounded-[10px] border border-line-hairline bg-bg-card p-4">
      <h2 className="mb-3 text-[13.5px] font-semibold text-ink-primary">Funnel overview</h2>
      <div className="space-y-2.5">
        {funnel.map((s, i) => {
          const isWorst = s.stage === worst?.stage;
          return (
            <div
              key={s.stage}
              className="dp-stagger flex items-center gap-3"
              style={{ "--d": `${i * 60}ms` } as React.CSSProperties}
            >
              <span className={`w-24 shrink-0 text-[12px] ${isWorst ? "font-medium text-ink-primary" : "text-ink-tertiary"}`}>{s.label}</span>
              <div className="h-[9px] flex-1 rounded-full bg-bar-track">
                <div
                  className={`dp-bar-grow h-full rounded-full ${isWorst ? "bg-warning" : "bg-bar-fill-recessive"}`}
                  style={{ "--w": `${Math.max(2, (s.count / top) * 100)}%` } as React.CSSProperties}
                />
              </div>
              <span className="w-48 shrink-0 text-right font-mono text-[11.5px] text-ink-muted">
                {fmtNum(s.count)} · {fmtPct(s.convFromPrev)}
                {s.medianDays != null ? ` · ${fmtDays(s.medianDays)}` : ""}
                {s.p90Days != null ? ` · p90 ${fmtDays(s.p90Days)}` : ""}
              </span>
            </div>
          );
        })}
      </div>
      {worst && (
        <p className="mt-3 text-[11.5px] text-warning">
          Largest drop-off: {worst.dropOff} leads did not progress past {worst.label}.
        </p>
      )}
      <Link
        href={routeHref({ screen: "funnel" }, range)}
        className="mt-3 inline-block rounded-[7px] border border-line-hairline px-3 py-1.5 text-[12px] text-ink-secondary hover:bg-bg-hover"
      >
        Open Funnel Diagnostics
      </Link>
    </section>
  );
}
