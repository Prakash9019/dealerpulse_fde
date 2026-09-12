import type { PipelineForecast } from "@/lib/insights/forecast";
import { fmtINR, fmtNum, fmtPct, fmtSigned } from "@/lib/format";
import { CountUp } from "./CountUp";

export function PipelineForecastCard({
  forecast,
  scopeLabel,
}: {
  forecast: PipelineForecast;
  scopeLabel: string;
}) {
  return (
    <section className="dp-in rounded-[10px] border border-line-hairline bg-bg-card p-4">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
        Pipeline Forecast
      </div>
      <p className="mt-2 text-[13px] leading-[1.6] text-ink-secondary">
        {fmtNum(forecast.openCount)} open leads worth {fmtINR(forecast.openValue)} are expected to
        yield <span className="font-mono text-ink-primary">~{forecast.expectedUnits.toFixed(1)}</span>{" "}
        more units (~{fmtINR(forecast.expectedRevenue)}) based on historical stage-to-delivery rates
        {forecast.targetUnits > 0 && (
          <>
            {" "}— putting {scopeLabel} on pace for{" "}
            <span className="font-mono text-ink-primary">{fmtPct(forecast.projectedAttainment, 0)}</span>{" "}
            of this period&rsquo;s target, up from {fmtPct(forecast.currentAttainment, 0)} delivered so
            far.
          </>
        )}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Actual (Delivered)" value={fmtNum(forecast.currentUnits)} />
        <Stat label="Expected from pipeline" value={`+${forecast.expectedUnits.toFixed(1)}`} />
        <Stat label="Forecast (projected)" value={forecast.projectedUnits.toFixed(1)} />
        <Stat label="Target" value={forecast.targetUnits ? fmtNum(forecast.targetUnits) : "—"} />
        <Stat
          label="Gap to target"
          value={forecast.targetUnits ? fmtSigned(forecast.projectedUnits - forecast.targetUnits, (v) => v.toFixed(1)) : "—"}
          tone={forecast.targetUnits ? (forecast.projectedUnits >= forecast.targetUnits ? "healthy" : "critical") : undefined}
        />
      </div>
    </section>
  );
}

/** Every value here is a CountUp — when the underlying forecast prop
    changes (a new branch/range/filter/scenario re-renders this component
    with different numbers), each stat re-tweens from its old value to the
    new one instead of jump-cutting. That transition is what communicates
    "the forecast was recalculated" — no artificial delay, no spinner, just
    the number itself moving. CountUp already no-ops under
    prefers-reduced-motion (see its own implementation). */
function Stat({ label, value, tone }: { label: string; value: string; tone?: "healthy" | "critical" }) {
  return (
    <div>
      <div className="text-[10.5px] text-ink-muted">{label}</div>
      <div className={`font-mono text-[14px] ${tone === "healthy" ? "text-healthy" : tone === "critical" ? "text-critical" : "text-ink-primary"}`}>
        <CountUp value={value} />
      </div>
    </div>
  );
}
