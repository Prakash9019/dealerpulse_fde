/* Persistent storage for AI observability and feedback (Phase 7/8), using
   Node's built-in SQLite module — no new dependency, no native compilation.
   The database file lives under data/ (gitignored specifically, unlike
   dealership_data.json which stays tracked) and survives server restarts —
   the property the previous in-memory implementation explicitly lacked.

   Note on serverless deployments (e.g. Vercel): the local filesystem is
   ephemeral there, so this file won't survive across deployments or scale
   past a single instance. That's an honest limitation for this project's
   scope; a production deployment needing durability across instances would
   swap this module for a hosted database, without touching any call site
   (recordAiCall/getAiHealth/recordFeedback/listFeedback keep their shape). */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'dealerpulse-ai.db');

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;
  fs.mkdirSync(DB_DIR, { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_calls (
      request_id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      kind TEXT NOT NULL,
      model TEXT NOT NULL,
      latency_ms INTEGER NOT NULL,
      used_gemini INTEGER NOT NULL,
      success INTEGER NOT NULL,
      fallback_reason TEXT,
      tool_calls TEXT,
      retrieved_sources TEXT,
      guardrail_flag TEXT,
      prompt_chars INTEGER NOT NULL,
      response_chars INTEGER NOT NULL,
      prompt_tokens INTEGER,
      response_tokens INTEGER,
      total_tokens INTEGER,
      client_ip TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_ai_calls_timestamp ON ai_calls(timestamp);

    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      request_id TEXT,
      context TEXT NOT NULL,
      question TEXT NOT NULL,
      verdict TEXT NOT NULL,
      note TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_feedback_request_id ON feedback(request_id);
  `);
  return db;
}
