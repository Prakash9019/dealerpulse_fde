import type { FunnelStage, StageLeak } from "@/lib/analytics/funnel";
import { fmtNum, fmtPct } from "@/lib/format";

export function BranchFunnelChart({
  branchFunnel,
  netFunnel,
  leaks,
}: {
  branchFunnel: FunnelStage[];
  netFunnel: FunnelStage[];
  leaks: StageLeak[];
}) {
  const top = branchFunnel[0]?.count || 1;
  const netTop = netFunnel[0]?.count || 1;
  const leakByStage = new Map(leaks.map((l) => [l.stage, l]));

  return (
    <section className="dp-in rounded-[10px] border border-line-hairline bg-bg-card p-4">
      <h2 className="mb-3 text-[13.5px] font-semibold text-ink-primary">Branch funnel</h2>
      <div className="space-y-3.5">
        {branchFunnel.map((s, i) => {
          const leak = leakByStage.get(s.stage);
          const below = !!leak && leak.excessLoss >= 3 && leak.gap <= -0.08;
          return (
            <div key={s.stage}>
              <div className="mb-1 flex items-center justify-between text-[12px]">
                <span className="text-ink-tertiary">{s.label}</span>
                <span className="font-mono text-ink-muted">
                  {fmtNum(s.count)} · {fmtPct(s.convFromPrev)}
                  {i > 0 ? ` (network ${fmtPct(netFunnel[i].convFromPrev)})` : ""}
                </span>
              </div>
              <div className="h-[9px] rounded-full bg-bar-track">
                <div
                  className={`h-full rounded-full ${below ? "bg-critical" : "bg-bar-fill"}`}
                  style={{ width: `${Math.max(2, (s.count / top) * 100)}%` }}
                />
              </div>
              <div className="mt-0.5 h-[3px] rounded-full bg-bar-track">
                <div
                  className="h-full rounded-full bg-bar-fill-recessive"
                  style={{ width: `${Math.max(2, (netFunnel[i].count / netTop) * 100)}%` }}
                />
              </div>
              {below && leak && (
                <p className="mt-1 text-[10.5px] text-critical">
                  Below baseline · ~{Math.round(leak.excessLoss)} extra leads lost here
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
