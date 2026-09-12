from graph import ask
from schemas import NO_GROUNDED_ANSWER


def test_ask_falls_back_safely_without_api_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    result = ask("Why is Lakeside underperforming?")
    assert result["usedGemini"] is False
    assert result["answer"] == NO_GROUNDED_ANSWER
    assert result["evidence"] == []
    assert result["confidence"] == "low"


def test_ask_never_raises_without_api_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    # Should not raise even with conversation history and an odd question.
    result = ask("", history=[{"role": "user", "text": "hi"}, {"role": "model", "text": "hello"}])
    assert isinstance(result, dict)
    assert "usedGemini" in result
