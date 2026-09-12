"""Persistent observability for this service (Phase 7) — backed by SQLite
(see db.py), so history survives a restart, unlike the earlier in-memory
version. No question/answer text or PII is stored — only counts, timings,
tool names, and retrieval source titles, safe to expose on /health/detail."""
import itertools
import json
import os
import time
from typing import Optional

from db import get_conn

_seq = itertools.count(1)


def record_ai_call(
    *,
    kind: str,
    model: str,
    latency_ms: int,
    used_gemini: bool,
    success: bool,
    tool_calls: Optional[list[str]] = None,
    retrieved_sources: Optional[list[str]] = None,
    guardrail_flag: Optional[str] = None,
    fallback_reason: Optional[str] = None,
    prompt_chars: int = 0,
    response_chars: int = 0,
    prompt_tokens: Optional[int] = None,
    response_tokens: Optional[int] = None,
    total_tokens: Optional[int] = None,
    client_ip: Optional[str] = None,
) -> str:
    request_id = f"{int(time.time() * 1000)}-{os.getpid()}-{next(_seq)}"
    try:
        conn = get_conn()
        conn.execute(
            """INSERT INTO ai_calls (
                request_id, timestamp, kind, model, latency_ms, used_gemini, success,
                fallback_reason, tool_calls, retrieved_sources, guardrail_flag,
                prompt_chars, response_chars, prompt_tokens, response_tokens, total_tokens, client_ip
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                request_id, int(time.time() * 1000), kind, model, latency_ms, int(used_gemini), int(success),
                fallback_reason, json.dumps(tool_calls or []), json.dumps(retrieved_sources or []), guardrail_flag,
                prompt_chars, response_chars, prompt_tokens, response_tokens, total_tokens, client_ip,
            ),
        )
        conn.commit()
    except Exception as e:  # noqa: BLE001 - observability must never break the request it's observing
        print(f"[observability] failed to persist ai_call: {e}")
    return request_id


def get_ai_health(limit: int = 500) -> dict:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM ai_calls ORDER BY timestamp DESC LIMIT ?", (limit,)).fetchall()
    logs = [dict(r) for r in rows]
    for l in logs:
        l["toolCalls"] = json.loads(l.pop("tool_calls") or "[]")
        l["retrievedSources"] = json.loads(l.pop("retrieved_sources") or "[]")
        l["usedGemini"] = bool(l.pop("used_gemini"))
        l["success"] = bool(l.pop("success"))
        l["latencyMs"] = l.pop("latency_ms")
        l["fallbackReason"] = l.pop("fallback_reason")
        l["guardrailFlag"] = l.pop("guardrail_flag")
        l["totalTokens"] = l.pop("total_tokens")
        l["id"] = l.pop("request_id")

    total = len(logs)
    successes = sum(1 for l in logs if l["success"])
    fallbacks = sum(1 for l in logs if not l["usedGemini"])
    latencies = sorted(l["latencyMs"] for l in logs)
    avg = (sum(latencies) / total) if total else None
    p90 = latencies[min(len(latencies) - 1, int(len(latencies) * 0.9))] if total else None
    total_tokens = sum(l.get("totalTokens") or 0 for l in logs)
    tool_counts: dict[str, int] = {}
    for l in logs:
        for t in l["toolCalls"]:
            tool_counts[t] = tool_counts.get(t, 0) + 1
    return {
        "totalRequests": total,
        "successRate": (successes / total) if total else None,
        "fallbackRate": (fallbacks / total) if total else None,
        "avgLatencyMs": avg,
        "p90LatencyMs": p90,
        "totalTokens": total_tokens,
        "toolCallCounts": tool_counts,
        "recent": logs[:25],
    }
