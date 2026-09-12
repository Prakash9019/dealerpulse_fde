"""'Summarize this view' phrasing layer — Gemini receives already-computed
facts and is explicitly told never to add a number that isn't present.
Mirrors app/src/lib/ai/gemini/summarize.ts's contract and fallback."""
import time

from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from config import GEMINI_MODEL, get_gemini_api_key
from observability import record_ai_call


def _deterministic_fallback(facts: dict) -> str:
    return " ".join(str(v) for v in facts.values() if v)


def summarize(facts: dict, screen_label: str, filter_label: str) -> dict:
    start = time.monotonic()
    fallback = _deterministic_fallback(facts)
    facts_chars = len(str(facts))

    def finish(summary: str, used_gemini: bool, reason: str | None = None) -> dict:
        record_ai_call(kind="summarize", model=GEMINI_MODEL, latency_ms=int((time.monotonic() - start) * 1000),
                        used_gemini=used_gemini, success=bool(summary), fallback_reason=None if used_gemini else (reason or "gemini_unavailable"),
                        prompt_chars=facts_chars, response_chars=len(summary))
        return {"summary": summary, "usedGemini": used_gemini}

    try:
        api_key = get_gemini_api_key()
    except RuntimeError:
        return finish(fallback, False, "not_configured")

    prompt = f"""You are rephrasing an already-computed analytics summary for the "{screen_label}" screen of DealerPulse (filters: {filter_label}) into one concise, executive-readable paragraph (3-5 sentences).

Rules:
- Use ONLY the facts given below. Do not add, estimate, or infer any number, name, or claim not already present.
- Do not repeat the field labels verbatim; write it as flowing prose.
- Keep it under 80 words.

Facts (JSON):
{facts}"""

    try:
        model = ChatGoogleGenerativeAI(model=GEMINI_MODEL, api_key=api_key, temperature=0.3)
        response = model.invoke([HumanMessage(content=prompt)])
        text = (response.content or "").strip() if isinstance(response.content, str) else ""
        if not text:
            return finish(fallback, False, "empty_response")
        return finish(text, True)
    except Exception:  # noqa: BLE001
        return finish(fallback, False, "error_or_timeout")
