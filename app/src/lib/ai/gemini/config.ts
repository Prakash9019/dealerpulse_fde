/** Server-only Gemini configuration. Never import this module from a client
    component — it reads process.env.GEMINI_API_KEY, which must never reach
    the browser bundle. The key itself is never returned by any function here. */

export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/** Single source of truth for the model name — never hardcode it elsewhere. */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

export function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('Gemini API is not configured. Set GEMINI_API_KEY on the server.');
  }
  return key;
}
