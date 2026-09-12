import type { StageDuration } from "@/lib/analytics/context";
import { fmtDays, fmtNum } from "@/lib/format";

export function StageBottlenecks({ durations }: { durations: StageDuration[] }) {
  const ranked = [...durations].sort((a, b) => (b.medianDays || 0) - (a.medianDays || 0));
  const max = Math.max(1, ...ranked.map((d) => d.medianDays || 0));
  return (
    <section className="dp-in rounded-[10px] border border-line-hairline bg-bg-card p-4">
      <h2 className="mb-3 text-[13.5px] font-semibold text-ink-primary">Stage bottlenecks</h2>
      <div className="space-y-3">
        {ranked.map((d) => (
          <div key={d.label}>
            <div className="mb-1 flex items-center justify-between text-[12px] text-ink-tertiary">
              <span>{d.label}</span>
              <span className="font-mono text-ink-muted">
                {fmtDays(d.medianDays)}
                {d.p90Days != null && <span className="text-ink-faint"> · p90 {fmtDays(d.p90Days)}</span>}
              </span>
            </div>
            <div className="h-[9px] rounded-full bg-bar-track">
              <div
                className="h-full rounded-full bg-bar-fill"
                style={{ width: `${Math.max(2, ((d.medianDays || 0) / max) * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-[10.5px] text-ink-muted">
              {d.label} is taking {fmtDays(d.medianDays)} at the median, with {d.dropOff} of {fmtNum(d.n)} leads not
              progressing.
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
