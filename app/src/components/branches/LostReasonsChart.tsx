import type { LostReasons } from "@/lib/analytics/trends";
import { fmtINR, fmtNum } from "@/lib/format";

export function LostReasonsChart({ lost }: { lost: LostReasons }) {
  if (!lost.total) {
    return (
      <section className="dp-in rounded-[10px] border border-line-hairline bg-bg-card p-4">
        <h2 className="mb-2 text-[13.5px] font-semibold text-ink-primary">Lost reason analysis</h2>
        <p className="text-[12px] text-ink-muted">No lost leads recorded in this range.</p>
      </section>
    );
  }
  const top = lost.rows[0]?.count || 1;
  return (
    <section className="dp-in rounded-[10px] border border-line-hairline bg-bg-card p-4">
      <h2 className="mb-3 text-[13.5px] font-semibold text-ink-primary">Lost reason analysis</h2>
      <div className="space-y-2.5">
        {lost.rows.map((r) => (
          <div key={r.reason} className="flex items-center gap-3">
            <span className="w-40 shrink-0 truncate text-[12px] text-ink-tertiary">{r.reason}</span>
            <div className="h-[9px] flex-1 rounded-full bg-bar-track">
              <div
                className="h-full rounded-full bg-critical"
                style={{ width: `${Math.max(2, (r.count / top) * 100)}%` }}
              />
            </div>
            <span className="w-32 shrink-0 text-right font-mono text-[11.5px] text-ink-muted">
              {fmtNum(r.count)} · {fmtINR(r.value)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-ink-muted">
        Lost from stage:{" "}
        {lost.byStage.filter((s) => s.count).map((s) => `${s.label} (${s.count})`).join(" · ")}
      </p>
    </section>
  );
}
