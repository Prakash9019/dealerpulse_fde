"""Persistent storage for this service's AI observability and feedback
(Phase 7/8), using Python's built-in sqlite3 — no new dependency. Mirrors
app/src/lib/ai/db.ts's schema so both services' data has the same shape.
The database file lives under data/ (gitignored) and survives restarts."""
import os
import sqlite3
import threading

_DB_DIR = os.path.join(os.path.dirname(__file__), "data")
_DB_PATH = os.path.join(_DB_DIR, "dealerpulse-ai.db")
_lock = threading.Lock()
_conn: sqlite3.Connection | None = None


def get_conn() -> sqlite3.Connection:
    global _conn
    if _conn is not None:
        return _conn
    with _lock:
        if _conn is not None:
            return _conn
        os.makedirs(_DB_DIR, exist_ok=True)
        conn = sqlite3.connect(_DB_PATH, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.executescript("""
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
        """)
        conn.commit()
        _conn = conn
        return _conn
