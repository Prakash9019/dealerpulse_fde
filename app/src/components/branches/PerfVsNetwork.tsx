import { BaselineBar } from "../ui/BaselineBar";
import { fmtSigned } from "@/lib/format";

interface Metric {
  label: string;
  value: number;
  baseline: number;
  max: number;
  fmt: (v: number) => string;
  deltaFmt: (v: number) => string;
  higherIsBetter: boolean;
}

export function PerfVsNetwork({ metrics }: { metrics: Metric[] }) {
  return (
    <section className="dp-in rounded-[10px] border border-line-hairline bg-bg-card p-4">
      <h2 className="mb-3 text-[13.5px] font-semibold text-ink-primary">Performance vs network</h2>
      <div className="space-y-3">
        {metrics.map((m) => {
          const delta = m.value - m.baseline;
          const good = m.higherIsBetter ? delta >= 0 : delta <= 0;
          return (
            <div key={m.label} className="flex items-center gap-3">
              <span className="w-44 shrink-0 text-[12px] text-ink-tertiary">{m.label}</span>
              <div className="flex-1">
                <BaselineBar value={m.value} baseline={m.baseline} max={m.max} />
              </div>
              <span className="w-28 shrink-0 text-right font-mono text-[12px] text-ink-primary">
                {m.fmt(m.value)}
              </span>
              <span
                className={`w-20 shrink-0 text-right text-[11px] font-semibold ${good ? "text-healthy" : "text-critical"}`}
              >
                {fmtSigned(delta, m.deltaFmt)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
