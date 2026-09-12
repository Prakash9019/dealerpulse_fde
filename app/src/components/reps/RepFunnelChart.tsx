import type { FunnelStage } from "@/lib/analytics/funnel";
import { fmtPct } from "@/lib/format";

export function RepFunnelChart({
  repFunnel,
  branchFunnel,
  netFunnel,
}: {
  repFunnel: FunnelStage[];
  branchFunnel: FunnelStage[];
  netFunnel: FunnelStage[];
}) {
  const top = repFunnel[0]?.count || 1;
  const branchTop = branchFunnel[0]?.count || 1;
  const netTop = netFunnel[0]?.count || 1;

  return (
    <section className="dp-in rounded-[10px] border border-line-hairline bg-bg-card p-4">
      <h2 className="mb-3 text-[13.5px] font-semibold text-ink-primary">Funnel performance</h2>
      <div className="space-y-4">
        {repFunnel.map((s, i) => (
          <div key={s.stage}>
            <div className="mb-1 flex items-center justify-between text-[12px] text-ink-tertiary">
              <span>{s.label}</span>
              <span className="font-mono text-ink-muted">
                {fmtPct(s.convFromPrev)} · branch {fmtPct(branchFunnel[i].convFromPrev)} · network{" "}
                {fmtPct(netFunnel[i].convFromPrev)}
              </span>
            </div>
            <div className="h-[9px] rounded-full bg-bar-track">
              <div
                className="h-full rounded-full bg-bar-fill"
                style={{ width: `${Math.max(2, (s.count / top) * 100)}%` }}
              />
            </div>
            <div className="mt-0.5 h-[3px] rounded-full bg-bar-track">
              <div
                className="h-full rounded-full bg-bar-fill-emphasis"
                style={{ width: `${Math.max(2, (branchFunnel[i].count / branchTop) * 100)}%` }}
              />
            </div>
            <div className="mt-0.5 h-[3px] rounded-full bg-bar-track">
              <div
                className="h-full rounded-full bg-bar-fill-recessive"
                style={{ width: `${Math.max(2, (netFunnel[i].count / netTop) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
