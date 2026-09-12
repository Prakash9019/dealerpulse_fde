"use client";

import { useState } from "react";
import { fmtINR } from "@/lib/format";
import { LeadDrawer } from "../overlays/LeadDrawer";

export interface PipelineRow {
  id: string;
  customerName: string;
  model: string;
  status: string;
  dealValue: number;
  idleDays: number;
  score: number;
}

export function PipelineTable({ rows }: { rows: PipelineRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (!rows.length) {
    return <p className="text-[12px] text-ink-muted">No open leads for this rep — nothing to chase.</p>;
  }

  return (
    <>
      <div className="dp-in overflow-x-auto rounded-[10px] border border-line-hairline">
        <table className="w-full min-w-[560px] text-[12.5px]">
          <thead className="bg-bg-rail text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            <tr>
              <th className="px-3 py-2.5 text-left">Customer</th>
              <th className="px-3 py-2.5 text-left">Model</th>
              <th className="px-3 py-2.5 text-left">Stage</th>
              <th className="px-3 py-2.5 text-right">Deal value</th>
              <th className="px-3 py-2.5 text-right">Idle</th>
              <th className="px-3 py-2.5 text-right">Priority</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                tabIndex={0}
                onClick={() => setOpenId(r.id)}
                onKeyDown={(e) => e.key === "Enter" && setOpenId(r.id)}
                className="cursor-pointer border-t border-line-row hover:bg-bg-hover"
              >
                <td className="px-3 py-2.5 text-ink-primary">{r.customerName}</td>
                <td className="px-3 py-2.5 text-ink-tertiary">{r.model}</td>
                <td className="px-3 py-2.5 text-ink-tertiary">{r.status}</td>
                <td className="px-3 py-2.5 text-right font-mono">{fmtINR(r.dealValue)}</td>
                <td className="px-3 py-2.5 text-right font-mono">{r.idleDays}d</td>
                <td className="px-3 py-2.5 text-right font-mono text-accent">{r.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {openId && <LeadDrawer leadId={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
