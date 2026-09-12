import { fmtINR } from "@/lib/format";
import { CountUp } from "../ui/CountUp";

const TIERS: { key: "critical" | "attention" | "watch"; label: string; hint: string }[] = [
  { key: "critical", label: "Critical", hint: "Priority ≥ 45" },
  { key: "attention", label: "Needs Attention", hint: "Priority 22–44" },
  { key: "watch", label: "Watch", hint: "Priority < 22" },
];

export function TierTiles({
  counts,
  values,
  active,
  onToggle,
}: {
  counts: Record<string, number>;
  values: Record<string, number>;
  active: Set<string>;
  onToggle: (tier: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {TIERS.map((t, i) => (
        <button
          key={t.key}
          type="button"
          aria-pressed={active.has(t.key)}
          onClick={() => onToggle(t.key)}
          style={{ "--d": i * 60 + "ms" } as React.CSSProperties}
          className={`dp-stagger relative overflow-hidden rounded-[10px] border p-4 text-left transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] ${
            active.has(t.key)
              ? "border-accent bg-accent-tint-bg shadow-[0_0_0_2px_var(--accent),0_8px_20px_oklch(0.79_0.10_200_/_0.25)]"
              : "border-line-hairline bg-bg-card hover:bg-bg-hover"
          }`}
        >
          {active.has(t.key) && (
            <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-accent" />
          )}
          <div className="flex items-center gap-1.5">
            <div
              className={`text-[11.5px] font-medium ${active.has(t.key) ? "text-accent" : "text-ink-tertiary"}`}
            >
              {t.label}
            </div>
            {active.has(t.key) && (
              <span aria-hidden="true" className="text-[11px] text-accent">✓</span>
            )}
          </div>
          <div className="mt-1 font-mono text-[27px] font-medium text-ink-primary">
            <CountUp value={String(counts[t.key] || 0)} durationMs={500} />
          </div>
          <div className="mt-1 text-[11px] text-ink-muted">
            {fmtINR(values[t.key] || 0)} · {t.hint}
          </div>
        </button>
      ))}
    </div>
  );
}
