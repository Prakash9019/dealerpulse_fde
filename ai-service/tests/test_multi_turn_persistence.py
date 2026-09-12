"""Phase 6 (original) / Phase 1 (reliability hardening): genuine multi-turn
conversation via LangGraph's checkpointer. A thread_id lets a short,
context-dependent follow-up ("Why?") be answered without re-sending full
history — the model must reason over what it already retrieved earlier in
the same thread rather than treating every turn as independent.

The GoogleInvalidRequestError ("function call turn comes immediately after a
user turn or after a function response turn") that used to make
test_short_followup_is_answered_from_thread_context flaky was root-caused,
not papered over: a direct agent.invoke() reproduction (bypassing ask()'s
try/except) captured the exact failing message sequence and showed the old
`_trim_history` pre_model_hook slicing `messages[-MAX_THREAD_MESSAGES:]` by
raw count could cut the window mid tool-call/tool-response pair, or start it
on an AIMessage/ToolMessage instead of a HumanMessage -- both of which
Gemini's API rejects outright. A single turn with several multi-tool-call
rounds easily exceeds MAX_THREAD_MESSAGES on its own, so this was never
about response_format or create_react_agent specifically. Fixed in graph.py
via `_trim_to_turn_boundary`, which only ever cuts at a HumanMessage
boundary. These tests are no longer xfail -- a regression here should fail
loudly, not be silently tolerated."""
import os

import pytest

from graph import ask
from schemas import NO_GROUNDED_ANSWER

requires_live_gemini = pytest.mark.skipif(
    not os.environ.get("GEMINI_API_KEY"),
    reason="GEMINI_API_KEY not set — skipping live Gemini eval",
)


@requires_live_gemini
def test_short_followup_is_answered_from_thread_context():
    thread_id = "pytest-multiturn-followup"
    first = ask("Why is Lakeside underperforming?", thread_id=thread_id)
    assert first["usedGemini"] is True
    assert first["answer"] != NO_GROUNDED_ANSWER

    followup = ask("Why?", thread_id=thread_id)
    assert followup["usedGemini"] is True
    # The old (broken) behavior — before the multi-turn system prompt rule —
    # was an outright refusal to a bare "Why?".
    assert followup["answer"] != NO_GROUNDED_ANSWER


@requires_live_gemini
def test_different_thread_ids_do_not_share_context():
    ask("Why is Lakeside underperforming?", thread_id="pytest-thread-isolation-a")
    # A fresh thread asked a context-dependent question with no prior turn
    # must never answer about Lakeside — that would mean state leaked across
    # threads. The model doesn't always use the exact canonical refusal
    # string for a bare "Why?" with nothing to explain (a separate, milder
    # prompt-compliance gap — the code-level guardrail only rewrites text for
    # a detected system-prompt leak, not every generic decline), so this
    # checks the actual guarantee — no cross-thread content — not the wording.
    result = ask("Why?", thread_id="pytest-thread-isolation-b")
    assert "lakeside" not in result["answer"].lower()
    assert result["evidence"] == []


@requires_live_gemini
def test_four_turn_lakeside_conversation_preserves_context_every_turn():
    """The exact deterministic regression scenario specified for Phase 1:
    a 4-turn conversation on a single thread, each turn a genuine follow-up
    that depends on context from earlier turns. No turn may fall back to the
    generic decline sentence — every turn must be a real, grounded, Gemini
    answer with the thread's context intact."""
    thread_id = "pytest-four-turn-lakeside"

    turn1 = ask("Why is Lakeside underperforming?", thread_id=thread_id)
    assert turn1["usedGemini"] is True, "turn 1 fell back to the deterministic/safe path"
    assert turn1["answer"] != NO_GROUNDED_ANSWER
    assert "lakeside" in turn1["answer"].lower()

    turn2 = ask("Why?", thread_id=thread_id)
    assert turn2["usedGemini"] is True, "turn 2 (bare follow-up) fell back — context was lost"
    assert turn2["answer"] != NO_GROUNDED_ANSWER

    turn3 = ask("Which reps are affected?", thread_id=thread_id)
    assert turn3["usedGemini"] is True, "turn 3 fell back — context was lost"
    assert turn3["answer"] != NO_GROUNDED_ANSWER

    turn4 = ask("What should I do?", thread_id=thread_id)
    assert turn4["usedGemini"] is True, "turn 4 fell back — context was lost"
    assert turn4["answer"] != NO_GROUNDED_ANSWER
    # A "what should I do" answer about a real problem branch should surface
    # a concrete next action, not just narrate the situation.
    assert turn4["recommendation"]
