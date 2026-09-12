"""Server-only configuration for the LangGraph AI service. Mirrors the same
contract as app/src/lib/ai/gemini/config.ts: GEMINI_API_KEY is required,
GEMINI_MODEL is overridable, and nothing here ever logs or returns the key."""
import os

from dotenv import load_dotenv

load_dotenv()

GEMINI_MODEL = os.environ.get("GEMINI_MODEL") or "gemini-2.5-flash"
NEXT_APP_URL = os.environ.get("NEXT_APP_URL") or "http://localhost:3000"


def is_gemini_configured() -> bool:
    return bool(os.environ.get("GEMINI_API_KEY"))


def get_gemini_api_key() -> str:
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("Gemini API is not configured. Set GEMINI_API_KEY on the server.")
    return key
