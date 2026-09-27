import type { FunnelStage } from "@/lib/analytics/funnel";
import { fmtDays, fmtINR, fmtNum, fmtPct } from "@/lib/format";

interface StageFlag {
  stage: string;
  z: number;
  flagged: boolean;
  above: boolean;
}

export function StageList({
  funnel,
  netFunnel,
  flags,
  compareToNetwork,
}: {
  funnel: FunnelStage[];
  netFunnel: FunnelStage[];
  flags: StageFlag[];
  compareToNetwork: boolean;
}) {
  const top = funnel[0]?.count || 1;
  // The single largest leak gets the one loud bar in the list — every other
  // stage recedes to the muted fill, so the eye lands on the one thing worth
  // acting on instead of every stage competing for attention equally.
  const worstStage = funnel.slice(1).reduce((a, b) => (a.dropOff >= b.dropOff ? a : b), funnel[1])?.stage;

  return (
    <section className="dp-in rounded-[10px] border border-line-hairline bg-bg-card p-4">
      <h2 className="mb-3 text-[13.5px] font-semibold text-ink-primary">Stages</h2>
      <div className="space-y-3.5">
        {funnel.map((s, i) => {
          const flag = flags.find((f) => f.stage === s.stage);
          const isEntrant = i === 0;
          const isWorst = s.stage === worstStage;
          return (
            // key includes the count so a filter/scope change (which swaps
            // in a genuinely new funnel array) remounts each row and replays
            // its staged reveal + bar-grow — a value-only change on the same
            // mounted row instead just recalculates the bar width smoothly
            // via the same CSS transition, no re-animation needed either way.
            <div
              key={s.stage}
              className="dp-stagger"
              style={{ "--d": `${i * 70}ms` } as React.CSSProperties}
            >
              <div className="mb-1 flex flex-wrap items-center gap-2 text-[12px]">
                <span className={isWorst ? "font-semibold text-ink-primary" : "text-ink-tertiary"}>{s.label}</span>
                {isWorst && !isEntrant && (
                  <span className="rounded px-1.5 py-0.5 font-mono text-[9.5px] bg-critical-bg text-critical-fg">
                    LARGEST LEAK
                  </span>
                )}
                {flag?.flagged && (
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[9.5px] ${flag.above ? "bg-healthy-bg text-healthy-fg" : "bg-critical-bg text-critical-fg"}`}
                  >
                    {flag.above ? "ABOVE BASELINE" : `BELOW BASELINE · z ${flag.z.toFixed(1)}`}
                  </span>
                )}
                <span className="ml-auto font-mono text-ink-muted">
                  {isEntrant
                    ? `Every lead enters here — ${fmtNum(s.count)} in all time`
                    : `${fmtPct(s.convFromPrev)} / network ${fmtPct(netFunnel[i].convFromPrev)} · ${fmtDays(s.medianDays)} · p90 ${fmtDays(s.p90Days)}`}
                </span>
              </div>
              <div className="h-[14px] rounded-full bg-bar-track">
                <div
                  className={`dp-bar-grow h-full rounded-full ${isWorst ? "bg-critical" : "bg-bar-fill-recessive"}`}
                  style={{ "--w": `${Math.max(2, (s.count / top) * 100)}%` } as React.CSSProperties}
                />
              </div>
              {compareToNetwork && !isEntrant && (
                <div className="mt-0.5 h-[4px] rounded-full bg-bar-track">
                  <div
                    className="dp-bar-grow h-full rounded-full bg-bar-fill-recessive"
                    style={{ "--w": `${Math.max(2, (netFunnel[i].count / (netFunnel[0]?.count || 1)) * 100)}%` } as React.CSSProperties}
                  />
                </div>
              )}
              {!isEntrant && (
                <p className="mt-1 text-[10.5px] text-ink-muted">
                  {s.dropOff} did not progress · {s.lostHere} marked lost from the previous stage
                  {s.lostHere > 0 && <> · <span className="text-ink-tertiary">{fmtINR(s.lostValue)} value lost</span></>}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
