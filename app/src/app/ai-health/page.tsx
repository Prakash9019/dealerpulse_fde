import { getAiHealth } from "@/lib/ai/observability";
import { isGeminiConfigured, GEMINI_MODEL } from "@/lib/ai/gemini/config";
import { fmtPct } from "@/lib/format";

// This reads live SQLite state on every request — without this, Next.js
// prerenders it once at build time and every visitor sees that frozen
// snapshot forever, defeating the whole point of persistent observability.
export const dynamic = "force-dynamic";

/** Internal-only diagnostics view — deliberately not linked from the main
    sidebar nav, since this is operational information for whoever runs the
    service, not for the CEO/branch-manager audience the rest of the product
    is built for. No question/answer text or other PII is recorded anywhere
    in the observability log, so nothing here needs to be redacted. Backed by
    SQLite (see lib/ai/db.ts) — persists across restarts, unlike the earlier
    in-memory version, though still local-disk only (see db.ts's note on
    serverless deployments). */
export default function AiHealthPage() {
  const health = getAiHealth();

  return (
    <div className="min-h-screen bg-bg-app p-6 text-ink-primary">
      <div className="mx-auto max-w-[900px] space-y-5">
        <div>
          <h1 className="text-[17px] font-semibold">AI Health (internal)</h1>
          <p className="text-[11.5px] text-ink-muted">
            Gemini: {isGeminiConfigured() ? `configured · ${GEMINI_MODEL}` : "not configured — running on rule-based fallback"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Requests (persisted)" value={String(health.totalRequests)} />
          <Tile label="Success rate" value={health.successRate != null ? fmtPct(health.successRate, 0) : "—"} />
          <Tile label="Fallback rate" value={health.fallbackRate != null ? fmtPct(health.fallbackRate, 0) : "—"} />
          <Tile label="Avg / p90 latency" value={health.avgLatencyMs != null ? `${Math.round(health.avgLatencyMs)}ms / ${health.p90LatencyMs}ms` : "—"} />
          <Tile label="Total tokens" value={health.totalTokens.toLocaleString()} />
          <Tile label="Est. cost (illustrative)" value={`$${health.estimatedCostUsd.toFixed(4)}`} />
        </div>

        <section className="rounded-[10px] border border-line-hairline bg-bg-card p-4">
          <h2 className="mb-3 text-[13px] font-semibold">Tool calls</h2>
          {Object.keys(health.toolCallCounts).length === 0 ? (
            <p className="text-[12px] text-ink-muted">No tool calls recorded yet.</p>
          ) : (
            <div className="space-y-1.5">
              {Object.entries(health.toolCallCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                <div key={name} className="flex items-center justify-between text-[12px]">
                  <span className="font-mono text-ink-secondary">{name}</span>
                  <span className="font-mono text-ink-muted">{count}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[10px] border border-line-hairline bg-bg-card p-4">
          <h2 className="mb-3 text-[13px] font-semibold">Recent calls</h2>
          {health.recent.length === 0 ? (
            <p className="text-[12px] text-ink-muted">No AI calls recorded this session yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-[11.5px]">
                <thead className="text-ink-muted">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Time</th>
                    <th className="px-2 py-1.5 text-left">Kind</th>
                    <th className="px-2 py-1.5 text-left">Path</th>
                    <th className="px-2 py-1.5 text-right">Latency</th>
                    <th className="px-2 py-1.5 text-left">Tools</th>
                    <th className="px-2 py-1.5 text-right">Tokens</th>
                    <th className="px-2 py-1.5 text-left">Guardrail</th>
                    <th className="px-2 py-1.5 text-left">Fallback reason</th>
                  </tr>
                </thead>
                <tbody>
                  {health.recent.map((l) => (
                    <tr key={l.id} className="border-t border-line-row">
                      <td className="px-2 py-1.5 font-mono text-ink-muted">{new Date(l.timestamp).toLocaleTimeString()}</td>
                      <td className="px-2 py-1.5">{l.kind}</td>
                      <td className="px-2 py-1.5">{l.usedGemini ? "gemini" : "rule-based fallback"}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{l.latencyMs}ms</td>
                      <td className="px-2 py-1.5 font-mono text-ink-muted">{(l.toolCalls || []).join(", ") || "—"}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-ink-muted">{l.totalTokens ?? "—"}</td>
                      <td className="px-2 py-1.5 text-warning">{l.guardrailFlag || "—"}</td>
                      <td className="px-2 py-1.5 text-ink-muted">{l.fallbackReason || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-line-hairline bg-bg-card p-3.5">
      <div className="text-[11px] text-ink-muted">{label}</div>
      <div className="mt-1 font-mono text-[19px]">{value}</div>
    </div>
  );
}
