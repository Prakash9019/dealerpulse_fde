/** `CapsuleMeter` — a chunky, segmented capsule progress meter.
    Renders progress as a row of thick rounded blocks rather than a thin
    continuous bar, so it reads at a glance as a headline fact (adoption,
    rollout, quota) rather than a form control. The value is always also
    words — the blocks never carry the number alone. */

export type CapsuleMeterTone = "default" | "accent" | "healthy" | "warning";

const FILLED_TONE: Record<CapsuleMeterTone, string> = {
  default: "bg-bar-fill",
  accent: "bg-accent",
  healthy: "bg-healthy",
  warning: "bg-warning",
};

export function CapsuleMeter({
  label,
  value,
  max = 100,
  valueLabel,
  segments = 6,
  tone = "default",
  size = "default",
  remainder = "muted",
  hideHeader = false,
  loading = false,
  className,
}: {
  /** What is being measured — "Rollout", "Adoption", "Data transfer". */
  label: string;
  value: number;
  max?: number;
  /** The headline reading, e.g. "780 / 1,000" or "62%". Derived from value/max when omitted. */
  valueLabel?: string;
  /** Number of blocks. Default 6. */
  segments?: number;
  tone?: CapsuleMeterTone;
  /** `sm` for inline strips, `default` for tiles. */
  size?: "sm" | "default";
  /** How unreached blocks render: `muted` fills them, `dashed` outlines them (reads as headroom). */
  remainder?: "muted" | "dashed";
  /** Drop the label/reading line — for callers that already print both above the track. */
  hideHeader?: boolean;
  loading?: boolean;
  className?: string;
}) {
  const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  const filled = Math.round(ratio * segments);
  const reading = valueLabel ?? `${Math.round(ratio * 100)}%`;
  const blockHeight = size === "sm" ? "h-4" : "h-7";

  if (loading) {
    return (
      <div className={`space-y-1.5 ${className || ""}`}>
        <div className="dp-shimmer h-3 w-20 rounded bg-bg-hover" />
        <div className={`dp-shimmer ${blockHeight} w-36 rounded-full bg-bg-hover`} />
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className || ""}`}>
      {!hideHeader && (
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">{label}</span>
          <span
            className={`font-mono font-semibold tabular-nums text-ink-primary ${size === "sm" ? "text-xs" : "text-sm"}`}
          >
            {reading}
          </span>
        </div>
      )}
      <div
        role="meter"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuetext={reading}
        className="flex gap-1"
      >
        {Array.from({ length: segments }).map((_, index) => (
          <span
            key={index}
            aria-hidden="true"
            className={`flex-1 rounded-full transition-colors ${blockHeight} ${
              index < filled
                ? FILLED_TONE[tone]
                : remainder === "dashed"
                  ? "border border-dashed border-line-strong bg-transparent"
                  : "bg-bar-track"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
