"""DealerPulse AI service — a separate, optional LangGraph-based orchestrator
for Ask DealerPulse and Summarize. It never touches the dataset or the
analytics engine directly; every fact comes back from the Next.js app's
/api/tools/execute endpoint (see tools.py). This exists as an alternative to
the in-process TypeScript Gemini integration in app/src/lib/ai/gemini/ —
either can run alone; the Next.js app calls this service only if AI_SERVICE_URL
is set, and falls back to its own deterministic Q&A if this service is down.

Run locally:
    cd ai-service
    python3 -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    cp .env.example .env   # fill in GEMINI_API_KEY
    uvicorn main:app --reload --port 8000
"""
from typing import Optional

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import GEMINI_MODEL, is_gemini_configured
from feedback import record_feedback
from graph import ask as run_ask
from observability import get_ai_health
from summarize import summarize as run_summarize

app = FastAPI(title="DealerPulse AI Service")

# Server-to-server only in intent, but CORS is left open for local dev
# convenience; a real deployment would restrict this to the Next.js origin
# and add a shared-secret header, matching the note in /api/tools/execute.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class ChatTurn(BaseModel):
    role: str
    text: str


class AskRequest(BaseModel):
    question: str
    history: list[ChatTurn] = []
    threadId: Optional[str] = None


class SummarizeRequest(BaseModel):
    facts: dict
    screenLabel: str
    filterLabel: str


class FeedbackRequest(BaseModel):
    context: str
    question: str
    verdict: str
    note: Optional[str] = None
    requestId: Optional[str] = None


@app.get("/health")
def health():
    return {"ok": True, "geminiConfigured": is_gemini_configured(), "model": GEMINI_MODEL}


@app.get("/health/detail")
def health_detail():
    return get_ai_health()


@app.post("/ask")
def ask(req: AskRequest, request: Request):
    client_ip = request.client.host if request.client else None
    return run_ask(req.question, [t.model_dump() for t in req.history], client_ip=client_ip, thread_id=req.threadId)


@app.post("/summarize")
def summarize(req: SummarizeRequest):
    return run_summarize(req.facts, req.screenLabel, req.filterLabel)


@app.post("/feedback")
def feedback(req: FeedbackRequest):
    if req.verdict not in ("helpful", "not_helpful", "incorrect"):
        return {"error": "invalid_verdict"}
    feedback_id = record_feedback(context=req.context, question=req.question, verdict=req.verdict, note=req.note, request_id=req.requestId)
    return {"ok": True, "id": feedback_id}
