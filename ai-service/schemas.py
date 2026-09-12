"""Structured output contract — mirrors app/src/lib/ai/gemini/schema.ts
exactly, so the Next.js API route can normalize a response from either
orchestration path (in-process TS, or this LangGraph service) the same way."""
from typing import Literal, Optional

from pydantic import BaseModel, Field

NO_GROUNDED_ANSWER = "I don't have enough data to answer that reliably."


class EvidenceItem(BaseModel):
    metric: str
    value: str
    context: str = ""


class CtaRoute(BaseModel):
    screen: Literal["overview", "branches", "branch", "reps", "rep", "actions", "funnel", "compare"]
    branchId: Optional[str] = None
    repId: Optional[str] = None
    tier: Optional[str] = None


class Cta(BaseModel):
    label: str
    route: CtaRoute


class GroundedAnswer(BaseModel):
    answer: str = Field(description="Direct answer to the user's question, grounded only in tool results.")
    evidence: list[EvidenceItem] = Field(default_factory=list, description="The specific tool-returned figures the answer cites.")
    impact: str = Field(default="", description="The business consequence of the fact stated in 'answer' (e.g. revenue/units at risk) — empty only if there is no clear business impact to state.")
    recommendation: str = Field(
        default="",
        description=(
            "A concrete, specific next action the user should take. REQUIRED (must not be empty) whenever the "
            "question asks what to do, how to fix something, or what the user should act on next (e.g. 'What "
            "should I do?', 'How do I fix this?') — never leave this blank for an action-seeking question just "
            "because the answer text already narrates the situation. Optional/empty only for purely descriptive "
            "questions (e.g. 'How many units were delivered?') with no actionable next step."
        ),
    )
    citations: list[str] = Field(default_factory=list)
    confidence: Literal["high", "medium", "low"] = "medium"
    cta: Optional[Cta] = None


def safe_fallback(reason: Optional[str] = None) -> GroundedAnswer:
    return GroundedAnswer(answer=NO_GROUNDED_ANSWER, confidence="low")
