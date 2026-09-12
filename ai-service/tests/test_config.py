import importlib

import config


def test_not_configured_when_key_missing(monkeypatch):
    # No importlib.reload here: config.py calls load_dotenv() at import time,
    # and reloading would re-read a real .env file (if one exists in this
    # environment) straight back into os.environ, undoing the monkeypatch.
    # is_gemini_configured() reads os.environ live, so no reload is needed.
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert config.is_gemini_configured() is False


def test_configured_when_key_present(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-real")
    importlib.reload(config)
    assert config.is_gemini_configured() is True
    assert config.get_gemini_api_key() == "test-key-not-real"


def test_default_model_when_unset(monkeypatch):
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    importlib.reload(config)
    assert config.GEMINI_MODEL == "gemini-2.5-flash"
