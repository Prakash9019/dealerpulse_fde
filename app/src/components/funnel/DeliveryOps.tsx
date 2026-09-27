import type { DeliveryPerf } from "@/lib/analytics/deliveries";
import type { BranchRow } from "@/lib/analytics/context";
import { fmtDays, fmtINR, fmtNum, fmtPct } from "@/lib/format";

export function DeliveryOps({ delivery, branchRows }: { delivery: DeliveryPerf; branchRows?: BranchRow[] }) {
  const top = delivery.reasons[0]?.count || 1;
  const withUnits = (branchRows || []).filter((b) => b.units > 0);
  const topRevenue = withUnits.length > 1 ? [...withUnits].sort((a, b) => b.revenue - a.revenue)[0] : undefined;
  const mostReliable = withUnits.length > 1 ? [...withUnits].sort((a, b) => a.delayRate - b.delayRate)[0] : undefined;
  const decoupled = topRevenue && mostReliable && topRevenue.id !== mostReliable.id;

  return (
    <section className="dp-in rounded-[10px] border border-line-hairline bg-bg-card p-4">
      <h2 className="mb-3 text-[13.5px] font-semibold text-ink-primary">Delivery operations</h2>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Deliveries" value={fmtNum(delivery.count)} />
        <Stat label="Delayed" value={fmtNum(delivery.delayedCount)} />
        <Stat label="Delay rate" value={fmtPct(delivery.delayRate, 0)} />
        <Stat label="Median / p90" value={`${fmtDays(delivery.medianDays)} / ${fmtDays(delivery.p90Days)}`} />
      </div>

      {decoupled && topRevenue && mostReliable && (
        <p className="mb-3 rounded-[8px] border border-line-hairline bg-bg-recessed p-2.5 text-[11.5px] leading-[1.5] text-ink-secondary">
          <span className="font-semibold text-ink-muted">Reliability doesn&apos;t follow revenue: </span>
          {topRevenue.name} earns the most ({fmtINR(topRevenue.revenue)}) but delays {fmtPct(topRevenue.delayRate, 0)} of deliveries — {mostReliable.name} is the most dependable at {fmtPct(mostReliable.delayRate, 0)} despite {fmtINR(mostReliable.revenue)} in revenue. The top earner isn&apos;t automatically the one to trust with a delivery date.
        </p>
      )}

      <div className="space-y-2">
        {delivery.reasons.map((r) => (
          <div key={r.reason} className="flex items-center gap-3">
            <span className="w-52 shrink-0 truncate text-[12px] text-ink-tertiary">{r.reason}</span>
            <div className="h-[8px] flex-1 rounded-full bg-bar-track">
              <div className="h-full rounded-full bg-warning" style={{ width: `${Math.max(2, (r.count / top) * 100)}%` }} />
            </div>
            <span className="w-28 shrink-0 text-right font-mono text-[11px] text-ink-muted">
              {r.count} · {fmtPct(r.count / delivery.delayedCount, 0)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] text-ink-muted">{label}</div>
      <div className="font-mono text-[14px] text-ink-primary">{value}</div>
    </div>
  );
}
