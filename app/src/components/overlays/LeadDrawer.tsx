"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fmtDate, fmtINR } from "@/lib/format";
import { useEscapeClose } from "@/lib/useEscapeClose";
import { CountUp } from "../ui/CountUp";

interface LeadDetail {
  id: string;
  customerName: string;
  phone: string;
  model: string;
  branchName: string;
  repName: string;
  branchId: string;
  repId: string;
  stageLabel: string;
  dealValue: number;
  idleDays: number;
  history: { status: string; at: string; note: string }[];
  explanation: {
    score: number;
    headline: string;
    drivers: { label: string; detail: string }[];
    risks: string[];
    businessImpact: string;
  };
}

export function LeadDrawer({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const [data, setData] = useState<LeadDetail | null>(null);
  useEscapeClose(onClose);

  useEffect(() => {
    let active = true;
    fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId }),
    })
      .then((r) => r.json())
      .then((d) => active && setData(d));
    return () => {
      active = false;
    };
  }, [leadId]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Lead detail"
      className="dp-scrim fixed inset-0 z-50 flex justify-end bg-bg-scrim"
      onClick={onClose}
    >
      <div
        className="dp-slide-in flex h-full w-full max-w-[460px] flex-col overflow-y-auto border-l border-line-hairline bg-bg-card p-5 shadow-[-20px_0_50px_oklch(0.08_0.006_75_/_0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        {!data && <div className="dp-shimmer h-40 rounded-lg bg-bg-recessed" aria-busy="true" />}
        {data && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[15px] font-semibold text-ink-primary">{data.customerName}</div>
                <div className="text-[11.5px] text-ink-muted">{data.id} · {data.model}</div>
              </div>
              <button onClick={onClose} className="rounded p-1 text-ink-muted transition-colors hover:bg-bg-hover hover:text-ink-primary" aria-label="Close">
                ✕
              </button>
            </div>

            <div className="dp-pop mt-4 rounded-lg border border-accent-tint-border bg-accent-tint-bg p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-accent">
                  AI Lead Explanation
                </span>
                <span className="font-mono text-[13.5px] text-accent">
                  P<CountUp value={String(data.explanation.score)} durationMs={500} />
                </span>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-[1.55] text-ink-secondary">
                {data.explanation.headline}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
              <Fact label="Stage" value={data.stageLabel} />
              <Fact label="Deal value" value={fmtINR(data.dealValue)} />
              <Fact label="Days idle" value={`${data.idleDays}d`} />
              <Fact label="Phone" value={data.phone} />
            </div>

            <div className="mt-4 space-y-2">
              {data.explanation.drivers.map((d, i) => (
                <div key={i} className="border-l-2 border-accent-tint-border pl-2.5">
                  <div className="text-[11px] font-semibold text-ink-muted">{d.label}</div>
                  <div className="text-[12px] text-ink-secondary">{d.detail}</div>
                </div>
              ))}
            </div>

            {data.explanation.businessImpact && (
              <p className="mt-3 text-[11.5px] leading-[1.6] text-ink-tertiary">
                <span className="font-semibold text-ink-muted">Business impact: </span>
                {data.explanation.businessImpact}
              </p>
            )}

            <div className="mt-4 flex gap-3 text-[12px]">
              <Link href={`/branches/${data.branchId}`} className="text-accent hover:underline">
                {data.branchName}
              </Link>
              <Link href={`/reps/${data.repId}`} className="text-accent hover:underline">
                {data.repName}
              </Link>
            </div>

            <div className="mt-4">
              <div className="mb-2 text-[11.5px] font-semibold text-ink-muted">Status history</div>
              <div className="space-y-2">
                {data.history.map((h, i) => (
                  <div key={i} className="text-[11.5px]">
                    <div className="flex justify-between">
                      <span className="text-ink-primary">{h.status}</span>
                      <span className="font-mono text-ink-muted">{fmtDate(h.at)}</span>
                    </div>
                    {h.note && <div className="text-ink-muted">{h.note}</div>}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-ink-muted">{label}</div>
      <div className="font-mono text-ink-primary">{value}</div>
    </div>
  );
}
