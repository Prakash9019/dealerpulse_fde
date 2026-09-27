import { fmtINR, fmtNum, fmtPct } from "@/lib/format";
import type { ModelPerfRow } from "@/lib/analytics/models";

export function ModelsTable({ rows }: { rows: ModelPerfRow[] }) {
  return (
    <div className="dp-in overflow-x-auto rounded-[10px] border border-line-hairline">
      <table className="w-full min-w-[720px] text-[12.5px]">
        <thead className="bg-bg-rail text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
          <tr>
            <th className="sticky left-0 bg-bg-rail px-3 py-2.5 text-left">Model</th>
            <th className="px-3 py-2.5 text-right">Leads</th>
            <th className="px-3 py-2.5 text-right">Lead share</th>
            <th className="px-3 py-2.5 text-right">Test-drive rate</th>
            <th className="px-3 py-2.5 text-right">Delivered</th>
            <th className="px-3 py-2.5 text-right">Conversion</th>
            <th className="px-3 py-2.5 text-right">Revenue</th>
            <th className="px-3 py-2.5 text-right">Revenue share</th>
            <th className="px-3 py-2.5 text-right">Avg deal value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const mismatch = Math.abs(r.revenueShare - r.leadShare) >= 0.08;
            return (
              <tr key={r.model} className="border-t border-line-row hover:bg-bg-hover">
                <td className="sticky left-0 bg-bg-card px-3 py-2.5 font-medium text-ink-primary">{r.model}</td>
                <td className="px-3 py-2.5 text-right font-mono">{fmtNum(r.leads)}</td>
                <td className="px-3 py-2.5 text-right font-mono">{fmtPct(r.leadShare, 0)}</td>
                <td className="px-3 py-2.5 text-right font-mono">{fmtPct(r.testDriveRate, 0)}</td>
                <td className="px-3 py-2.5 text-right font-mono">{fmtNum(r.delivered)}</td>
                <td className="px-3 py-2.5 text-right font-mono">{fmtPct(r.conversion)}</td>
                <td className="px-3 py-2.5 text-right font-mono">{fmtINR(r.revenue)}</td>
                <td className={`px-3 py-2.5 text-right font-mono ${mismatch ? (r.revenueShare > r.leadShare ? "text-healthy" : "text-warning") : ""}`}>
                  {fmtPct(r.revenueShare, 0)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono">{fmtINR(r.avgDealValue)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
