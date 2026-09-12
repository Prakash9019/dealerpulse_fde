import type { SourcePerfRow } from "@/lib/analytics/trends";
import { fmtINR, fmtNum, fmtPct } from "@/lib/format";

export function SourceQuality({ sources, baseline }: { sources: SourcePerfRow[]; baseline: number }) {
  const max = Math.max(0.01, ...sources.map((s) => s.conversion));
  return (
    <section className="dp-in rounded-[10px] border border-line-hairline bg-bg-card p-4">
      <h2 className="mb-3 text-[13.5px] font-semibold text-ink-primary">Lead source quality</h2>
      <div className="space-y-3">
        {sources.map((s) => {
          const tone = s.conversion >= baseline ? "bg-healthy" : s.conversion < baseline * 0.6 ? "bg-critical" : "bg-bar-fill";
          return (
            <div key={s.source}>
              <div className="mb-1 flex items-center justify-between text-[12px] text-ink-tertiary">
                <span>{s.label}</span>
                <span className="font-mono text-ink-muted">
                  {fmtPct(s.conversion)} · {fmtNum(s.leads)} leads → {fmtNum(s.delivered)} delivered ·{" "}
                  {fmtINR(s.revenue)} · contact {fmtPct(s.contactRate, 0)}
                </span>
              </div>
              <div className="h-[9px] rounded-full bg-bar-track">
                <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(2, (s.conversion / max) * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
