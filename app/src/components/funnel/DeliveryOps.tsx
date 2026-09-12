import type { DeliveryPerf } from "@/lib/analytics/deliveries";
import { fmtDays, fmtNum, fmtPct } from "@/lib/format";

export function DeliveryOps({ delivery }: { delivery: DeliveryPerf }) {
  const top = delivery.reasons[0]?.count || 1;
  return (
    <section className="dp-in rounded-[10px] border border-line-hairline bg-bg-card p-4">
      <h2 className="mb-3 text-[13.5px] font-semibold text-ink-primary">Delivery operations</h2>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Deliveries" value={fmtNum(delivery.count)} />
        <Stat label="Delayed" value={fmtNum(delivery.delayedCount)} />
        <Stat label="Delay rate" value={fmtPct(delivery.delayRate, 0)} />
        <Stat label="Median / p90" value={`${fmtDays(delivery.medianDays)} / ${fmtDays(delivery.p90Days)}`} />
      </div>
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
