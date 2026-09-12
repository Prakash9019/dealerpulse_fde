from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health_reports_not_configured_without_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["geminiConfigured"] is False


def test_ask_degrades_gracefully_without_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    resp = client.post("/ask", json={"question": "Why is Lakeside underperforming?", "history": []})
    assert resp.status_code == 200
    body = resp.json()
    assert body["usedGemini"] is False
    assert body["answer"]


def test_summarize_degrades_gracefully_without_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    resp = client.post("/summarize", json={"facts": {"a": "Something happened."}, "screenLabel": "Overview", "filterLabel": "all time"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["usedGemini"] is False
    assert "Something happened." in body["summary"]


def test_health_detail_never_leaks_question_text(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    client.post("/ask", json={"question": "a secret customer name lookup", "history": []})
    resp = client.get("/health/detail")
    assert resp.status_code == 200
    assert "a secret customer name lookup" not in resp.text
