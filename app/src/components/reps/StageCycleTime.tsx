import { BaselineBar } from "../ui/BaselineBar";
import { fmtDays } from "@/lib/format";
import type { StageDuration } from "@/lib/analytics/context";

export function StageCycleTime({
  repDurations,
  netDurations,
}: {
  repDurations: StageDuration[];
  netDurations: StageDuration[];
}) {
  const max = Math.max(1, ...repDurations.map((d) => d.medianDays || 0), ...netDurations.map((d) => d.medianDays || 0));
  return (
    <section className="dp-in rounded-[10px] border border-line-hairline bg-bg-card p-4">
      <h2 className="mb-3 text-[13.5px] font-semibold text-ink-primary">Stage cycle time</h2>
      <div className="space-y-3">
        {repDurations.map((d, i) => {
          const net = netDurations[i]?.medianDays || 0;
          const slow = net > 0 && (d.medianDays || 0) > net * 1.35;
          return (
            <div key={d.label} className="flex items-center gap-3">
              <span className="w-44 shrink-0 text-[12px] text-ink-tertiary">{d.label}</span>
              <div className="flex-1">
                <BaselineBar value={d.medianDays || 0} baseline={net} max={max} tone={slow ? "warn" : "default"} />
              </div>
              <span className="w-16 shrink-0 text-right font-mono text-[12px] text-ink-primary">
                {fmtDays(d.medianDays)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
