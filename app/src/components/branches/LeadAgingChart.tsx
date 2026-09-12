import type { Aging } from "@/lib/analytics/aging";
import { fmtINR, fmtNum } from "@/lib/format";

const TONE_BG: Record<string, string> = {
  ok: "bg-bar-fill",
  warn: "bg-warning",
  crit: "bg-critical",
};

export function LeadAgingChart({ aging }: { aging: Aging }) {
  if (!aging.openCount) {
    return (
      <section className="dp-in rounded-[10px] border border-line-hairline bg-bg-card p-4">
        <h2 className="mb-2 text-[13.5px] font-semibold text-ink-primary">Lead aging</h2>
        <p className="text-[12px] text-ink-muted">No open leads at this branch — nothing ageing.</p>
      </section>
    );
  }
  return (
    <section className="dp-in rounded-[10px] border border-line-hairline bg-bg-card p-4">
      <h2 className="mb-3 text-[13.5px] font-semibold text-ink-primary">Lead aging</h2>
      <div className="flex h-3 overflow-hidden rounded-full">
        {aging.buckets.map((b) => (
          <div
            key={b.key}
            className={TONE_BG[b.tone]}
            style={{ width: `${Math.max(0, (b.count / aging.openCount) * 100)}%` }}
            title={`${b.label}: ${b.count}`}
          />
        ))}
      </div>
      <div className="mt-3 space-y-2">
        {aging.buckets.map((b) => (
          <div key={b.key} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-[11.5px] text-ink-tertiary">{b.label}</span>
            <div className="h-[8px] flex-1 rounded-full bg-bar-track">
              <div
                className={`h-full rounded-full ${TONE_BG[b.tone]}`}
                style={{ width: `${Math.max(2, (b.count / aging.openCount) * 100)}%` }}
              />
            </div>
            <span className="w-32 shrink-0 text-right font-mono text-[11px] text-ink-muted">
              {fmtNum(b.count)} · {fmtINR(b.value)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
