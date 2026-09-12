from summarize import summarize


def test_summarize_falls_back_to_joined_facts_without_api_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    facts = {"whatHappened": "Units rose 20%.", "why": "December delivery surge."}
    result = summarize(facts, "Overview", "all time")
    assert result["usedGemini"] is False
    assert "Units rose 20%." in result["summary"]
    assert "December delivery surge." in result["summary"]


def test_summarize_never_fabricates_a_number_not_in_facts(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    facts = {"onlyFact": "Revenue is flat."}
    result = summarize(facts, "Overview", "all time")
    assert result["summary"] == "Revenue is flat."
