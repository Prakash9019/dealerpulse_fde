# DealerPulse AI Service

An optional, separately-deployable FastAPI + LangGraph service that
orchestrates Ask DealerPulse and Summarize using Gemini function calling.

**It does not duplicate the analytics engine.** Every tool call is an HTTP
request back to the main Next.js app's `POST /api/tools/execute`, which runs
the same validated, read-only analytics functions the in-process TypeScript
Gemini integration (`app/src/lib/ai/gemini/`) already uses. This service is
purely an alternative orchestration layer — swap it in without touching
analytics, and swap it out (the TypeScript path keeps working) if it's down.

## Architecture

```
USER QUESTION
  -> FastAPI (/ask)
  -> LangGraph ReAct agent (Gemini via langchain-google-genai)
  -> tool call requested
  -> HTTP POST to the Next.js app's /api/tools/execute
  -> Next.js validates args, runs the analytics engine, returns JSON
  -> LangGraph feeds the result back to Gemini
  -> structured, schema-validated GroundedAnswer returned to the caller
```

## Setup

```bash
cd ai-service
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # fill in GEMINI_API_KEY
uvicorn main:app --reload --port 8000
```

The Next.js app must be running (`npm run dev` in `../app`) so `NEXT_APP_URL`
(default `http://localhost:3000`) resolves — this service has no data of its
own.

## Wiring it into the Next.js app (optional)

By default the Next.js app uses its own in-process TypeScript Gemini
integration. To route Ask DealerPulse / Summarize through this service
instead, set in `../app/.env.local`:

```
AI_SERVICE_URL=http://localhost:8000
```

`/api/ask` and `/api/summarize` will call this service first and fall back to
the in-process path (then the deterministic rule-based engine) if it's
unreachable — the dashboard never breaks because of this service being down.

## Endpoints

- `GET /health` — `{ ok, geminiConfigured, model }`, safe to expose.
- `GET /health/detail` — in-memory observability (request counts, latency,
  tool-call breakdown, fallback reasons). No question/answer text is stored.
- `POST /ask` — `{ question, history }` -> `GroundedAnswer` + `usedGemini`.
- `POST /summarize` — `{ facts, screenLabel, filterLabel }` -> `{ summary, usedGemini }`.

## Tests

```bash
pip install pytest pytest-httpx
pytest
```

Tests that require a live Gemini key are skipped automatically when
`GEMINI_API_KEY` isn't set — they never fabricate a passing result.
