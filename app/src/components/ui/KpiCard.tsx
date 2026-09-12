import { WhyButton } from "./WhyButton";
import { CountUp } from "./CountUp";
import { Sparkline } from "./Sparkline";

export function KpiCard({
  label,
  value,
  valueClassName,
  delta,
  deltaGood,
  sub,
  whyKey,
  index = 0,
  trend,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  delta?: string;
  deltaGood?: boolean;
  sub?: string;
  whyKey?: string;
  index?: number;
  /** Real historical values for this metric (e.g. per-month units/revenue) —
      only passed when the underlying series genuinely exists; never
      fabricated just to fill the card. */
  trend?: number[];
}) {
  return (
    <div
      style={{ "--d": index * 60 + "ms" } as React.CSSProperties}
      className="dp-stagger dp-card-hover rounded-[10px] border border-line-hairline bg-bg-card p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11.5px] font-medium text-ink-tertiary">{label}</div>
        {whyKey && <WhyButton kpiKey={whyKey} />}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span
            className={`font-mono text-[27px] font-medium tracking-[-0.02em] ${valueClassName || "text-ink-primary"}`}
          >
            <CountUp value={value} />
          </span>
          {delta && (
            <span
              className={`text-[11.5px] font-semibold ${deltaGood ? "text-healthy" : "text-critical"}`}
            >
              {delta}
            </span>
          )}
        </div>
        {trend && trend.length >= 2 && (
          <Sparkline values={trend} width={48} height={18} tone={deltaGood == null ? "default" : deltaGood ? "healthy" : "critical"} />
        )}
      </div>
      {sub && <div className="mt-1 text-[11px] leading-normal text-ink-muted">{sub}</div>}
    </div>
  );
}
