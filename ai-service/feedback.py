"""Persistent feedback store (Phase 8) — backed by SQLite (see db.py). Same
"signal, not ground truth" stance as the TypeScript version: stored for
human review, never used to auto-correct anything."""
import itertools
import os
import time
from typing import Optional

from db import get_conn

_seq = itertools.count(1)


def record_feedback(*, context: str, question: str, verdict: str, note: Optional[str] = None, request_id: Optional[str] = None) -> str:
    feedback_id = f"{int(time.time() * 1000)}-{os.getpid()}-{next(_seq)}"
    conn = get_conn()
    conn.execute(
        "INSERT INTO feedback (id, timestamp, request_id, context, question, verdict, note) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (feedback_id, int(time.time() * 1000), request_id, context, question, verdict, note),
    )
    conn.commit()
    return feedback_id


def list_feedback(limit: int = 200) -> list[dict]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM feedback ORDER BY timestamp DESC LIMIT ?", (limit,)).fetchall()
    return [dict(r) for r in rows]
