import type { TestDriveGate } from "@/lib/insights/testDriveGate";
import { fmtINR, fmtNum } from "@/lib/format";

/** Test drive is a hard gate, not a soft funnel stage — leads that get contacted
    but never test-driven have essentially zero chance of closing, regardless of
    how long they sit open. This states that as an absolute (0 delivered), not a
    percentage, because a hard boundary is a stronger and more falsifiable claim
    than "conversion is low here". */
export function TestDriveGateCard({ gate }: { gate: TestDriveGate }) {
  if (gate.neverTestDriven === 0) return null;
  const maxBranch = Math.max(1, ...gate.byBranch.map((b) => b.value));

  return (
    <section id="test-drive-gate" className="dp-in rounded-xl border border-critical-bg bg-bg-card p-4">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-critical">
        <span aria-hidden="true" className="inline-block h-[9px] w-[9px] rotate-45 rounded-[2px] bg-critical" />
        The test drive gate
      </div>
      <p className="mt-2 text-[15px] font-medium leading-[1.45] text-ink-primary">
        {fmtNum(gate.neverTestDriven)} leads reached Contacted but never Test Drive — {fmtNum(gate.deliveredDespiteGate)} of them ever delivered
      </p>
      <p className="mt-1 text-[12.5px] text-ink-secondary">
        {gate.deliveredDespiteGate === 0
          ? "Zero. Test drive behaves as a hard gate, not just another stage with a low conversion rate — a lead that skips it has essentially no realistic path to closing."
          : `Only ${fmtNum(gate.deliveredDespiteGate)} of ${fmtNum(gate.neverTestDriven)} closed without one — treat those as the exception, not the rule.`}{" "}
        {fmtINR(gate.neverTestDrivenValue)} in deal value is sitting behind this gate right now.
      </p>

      {gate.byBranch.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {gate.byBranch.map((b) => (
            <div key={b.branchId} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-[11.5px] text-ink-tertiary">{b.branchName}</span>
              <div className="h-[7px] flex-1 rounded-full bg-bar-track">
                <div className="h-full rounded-full bg-critical" style={{ width: `${Math.max(2, (b.value / maxBranch) * 100)}%` }} />
              </div>
              <span className="w-32 shrink-0 text-right font-mono text-[11px] text-ink-muted">
                {fmtNum(b.count)} · {fmtINR(b.value)}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-[11px] text-ink-muted">
        Prioritise getting these leads into a test drive over any other intervention — it's the actual
        gate, not a negotiation-skill problem.
      </p>
    </section>
  );
}
