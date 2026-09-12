/* Optional call-out to the separate ai-service/ (FastAPI + LangGraph) process.
   Purely additive: if AI_SERVICE_URL isn't set, or the service is unreachable
   or slow, callers fall through to the in-process TypeScript Gemini path and
   then the deterministic rule-based engine — this dashboard never depends on
   an external process being up. */
import type { GroundedAnswer } from './gemini/schema';
import type { ChatTurn } from './gemini/answer';

const TIMEOUT_MS = 12000;

export function isAiServiceConfigured(): boolean {
  return !!process.env.AI_SERVICE_URL;
}

export async function askViaAiService(question: string, history: ChatTurn[]): Promise<(GroundedAnswer & { usedGemini: boolean; requestId?: string }) | null> {
  const base = process.env.AI_SERVICE_URL;
  if (!base) return null;
  try {
    const res = await fetch(`${base}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, history }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data?.answer !== 'string') return null;
    return data;
  } catch {
    return null;
  }
}

export async function summarizeViaAiService(facts: Record<string, string>, screenLabel: string, filterLabel: string): Promise<{ summary: string; usedGemini: boolean } | null> {
  const base = process.env.AI_SERVICE_URL;
  if (!base) return null;
  try {
    const res = await fetch(`${base}/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facts, screenLabel, filterLabel }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data?.summary !== 'string') return null;
    return data;
  } catch {
    return null;
  }
}
