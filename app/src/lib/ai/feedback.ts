/* Persistent feedback store (Phase 8) — backed by SQLite (see db.ts), so
   feedback survives a server restart, unlike the earlier in-memory version.
   Each entry can be linked to the request_id of the AI call it's about
   (see observability.ts), so a "Report Incorrect" can later be joined back
   to exactly what was asked, what tools ran, and what the model said —
   without this module itself storing that answer text a second time.

   Feedback is a signal for review, not ground truth: a "Not Helpful" vote
   doesn't mean the answer was wrong (the user might be wrong, or asking an
   ambiguous question), and this module makes no attempt to auto-correct
   anything from it — it's surfaced for a human to look at, that's all. */
import { getDb } from './db';

export interface FeedbackEntry {
  id: string;
  timestamp: number;
  requestId?: string;
  context: string;
  question: string;
  verdict: 'helpful' | 'not_helpful' | 'incorrect';
  note?: string;
}

let seq = 0;
function nextId(): string {
  seq += 1;
  return `${Date.now()}-${process.pid}-${seq}`;
}

export function recordFeedback(entry: Omit<FeedbackEntry, 'id' | 'timestamp'>): FeedbackEntry {
  const full: FeedbackEntry = { id: nextId(), timestamp: Date.now(), ...entry };
  try {
    getDb().prepare(`
      INSERT INTO feedback (id, timestamp, request_id, context, question, verdict, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(full.id, full.timestamp, full.requestId ?? null, full.context, full.question, full.verdict, full.note ?? null);
  } catch (e) {
    console.error('[feedback] failed to persist:', e instanceof Error ? e.message : e);
  }
  return full;
}

interface FeedbackRow {
  id: string; timestamp: number; request_id: string | null; context: string; question: string; verdict: string; note: string | null;
}

export function listFeedback(limit = 200): FeedbackEntry[] {
  const rows = getDb().prepare('SELECT * FROM feedback ORDER BY timestamp DESC LIMIT ?').all(limit) as unknown as FeedbackRow[];
  return rows.map((r) => ({
    id: r.id, timestamp: r.timestamp, requestId: r.request_id ?? undefined,
    context: r.context, question: r.question, verdict: r.verdict as FeedbackEntry['verdict'], note: r.note ?? undefined,
  }));
}
