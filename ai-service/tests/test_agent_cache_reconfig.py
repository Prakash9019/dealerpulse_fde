"""Regression test for a real bug found via live testing: _get_agent() used
to cache the compiled graph purely on `_agent is None`, so once built with a
real key, removing/rotating GEMINI_API_KEY had NO effect until process
restart — the stale client kept answering live. Fixed by re-validating
is_gemini_configured() on every call. This only runs with a live key, since
it needs a real agent to have been built first."""
import os

import pytest

from graph import _get_agent, ask  # noqa: E402 - import at module level so config's
# load_dotenv() has run by the time the skipif below reads os.environ.

requires_live_gemini = pytest.mark.skipif(
    not os.environ.get("GEMINI_API_KEY"),
    reason="GEMINI_API_KEY not set — skipping live Gemini eval",
)


@requires_live_gemini
def test_removing_key_after_agent_is_cached_still_fails_closed(monkeypatch):
    # Build (and cache) the agent once, with a real key.
    agent = _get_agent()
    assert agent is not None

    # Now simulate the key being removed/rotated at runtime.
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    result = ask("How many units were delivered network-wide, all time?")
    assert result["usedGemini"] is False
    assert result["answer"] == "I don't have enough data to answer that reliably."
