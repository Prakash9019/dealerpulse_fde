/* Persistent AI observability (Phase 7) — backed by SQLite (see db.ts), so
   history survives a server restart, unlike the earlier in-memory version.
   No question/answer text or other PII is stored — only counts, timings,
   tool names, and retrieval source titles, so this is safe to expose on an
   internal health view. client_ip is stored only because the /api/ask route
   already uses it for rate limiting; it's the closest thing to a "tenant
   identifier" this single-tenant, unauthenticated app has (see
   ASSIGNMENT.md — auth is explicitly out of scope). */
import { getDb } from './db';

export interface AiCallLog {
  id: string;
  timestamp: number;
  kind: 'ask' | 'summarize' | 'document-summary';
  model: string;
  latencyMs: number;
  usedGemini: boolean;
  success: boolean;
  fallbackReason?: string;
  toolCalls?: string[];
  retrievedSources?: string[];
  guardrailFlag?: string;
  promptChars: number;
  responseChars: number;
  promptTokens?: number;
  responseTokens?: number;
  totalTokens?: number;
  clientIp?: string;
}

let seq = 0;
function nextId(): string {
  seq += 1;
  return `${Date.now()}-${process.pid}-${seq}`;
}

export function recordAiCall(entry: Omit<AiCallLog, 'id' | 'timestamp'>): string {
  const id = nextId();
  const timestamp = Date.now();
  try {
    getDb().prepare(`
      INSERT INTO ai_calls (
        request_id, timestamp, kind, model, latency_ms, used_gemini, success,
        fallback_reason, tool_calls, retrieved_sources, guardrail_flag,
        prompt_chars, response_chars, prompt_tokens, response_tokens, total_tokens, client_ip
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, timestamp, entry.kind, entry.model, entry.latencyMs, entry.usedGemini ? 1 : 0, entry.success ? 1 : 0,
      entry.fallbackReason ?? null, JSON.stringify(entry.toolCalls ?? []), JSON.stringify(entry.retrievedSources ?? []),
      entry.guardrailFlag ?? null, entry.promptChars, entry.responseChars,
      entry.promptTokens ?? null, entry.responseTokens ?? null, entry.totalTokens ?? null, entry.clientIp ?? null,
    );
  } catch (e) {
    // Observability must never break the request it's observing.
    console.error('[observability] failed to persist ai_call:', e instanceof Error ? e.message : e);
  }
  return id;
}

interface AiCallRow {
  request_id: string; timestamp: number; kind: string; model: string; latency_ms: number;
  used_gemini: number; success: number; fallback_reason: string | null; tool_calls: string;
  retrieved_sources: string; guardrail_flag: string | null; prompt_chars: number; response_chars: number;
  prompt_tokens: number | null; response_tokens: number | null; total_tokens: number | null; client_ip: string | null;
}

function rowToLog(r: AiCallRow): AiCallLog {
  return {
    id: r.request_id, timestamp: r.timestamp, kind: r.kind as AiCallLog['kind'], model: r.model,
    latencyMs: r.latency_ms, usedGemini: !!r.used_gemini, success: !!r.success,
    fallbackReason: r.fallback_reason ?? undefined, toolCalls: JSON.parse(r.tool_calls || '[]'),
    retrievedSources: JSON.parse(r.retrieved_sources || '[]'), guardrailFlag: r.guardrail_flag ?? undefined,
    promptChars: r.prompt_chars, responseChars: r.response_chars,
    promptTokens: r.prompt_tokens ?? undefined, responseTokens: r.response_tokens ?? undefined,
    totalTokens: r.total_tokens ?? undefined, clientIp: r.client_ip ?? undefined,
  };
}

export interface AiHealth {
  totalRequests: number;
  successRate: number | null;
  fallbackRate: number | null;
  avgLatencyMs: number | null;
  p90LatencyMs: number | null;
  totalTokens: number;
  estimatedCostUsd: number;
  toolCallCounts: Record<string, number>;
  recent: AiCallLog[];
}

/** Illustrative only — Gemini Flash-tier pricing ballpark, per 1K tokens.
    Not wired to a live pricing API; treat as an order-of-magnitude estimate
    for the internal health view, never shown to end users as a real bill. */
const EST_USD_PER_1K_TOKENS = 0.0003;

export function getAiHealth(limit = 500): AiHealth {
  const rows = getDb().prepare('SELECT * FROM ai_calls ORDER BY timestamp DESC LIMIT ?').all(limit) as unknown as AiCallRow[];
  const logs = rows.map(rowToLog);
  const total = logs.length;
  const successes = logs.filter((l) => l.success).length;
  const fallbacks = logs.filter((l) => !l.usedGemini).length;
  const latencies = logs.map((l) => l.latencyMs).sort((a, b) => a - b);
  const avg = total ? latencies.reduce((s, v) => s + v, 0) / total : null;
  const p90 = total ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.9))] : null;
  const totalTokens = logs.reduce((s, l) => s + (l.totalTokens || 0), 0);
  const toolCallCounts: Record<string, number> = {};
  logs.forEach((l) => (l.toolCalls || []).forEach((t) => { toolCallCounts[t] = (toolCallCounts[t] || 0) + 1; }));
  return {
    totalRequests: total,
    successRate: total ? successes / total : null,
    fallbackRate: total ? fallbacks / total : null,
    avgLatencyMs: avg,
    p90LatencyMs: p90 ?? null,
    totalTokens,
    estimatedCostUsd: (totalTokens / 1000) * EST_USD_PER_1K_TOKENS,
    toolCallCounts,
    recent: logs.slice(0, 25),
  };
}
