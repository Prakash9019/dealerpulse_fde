/* Phase 10: fault tolerance. These tests verify the dashboard's actual
   guarantees under failure — bounded retries, a safe non-fabricated
   fallback, and no crash — by mocking the failure conditions directly
   rather than depending on flaky real network timeouts. Live equivalents
   (real Gemini timeouts/429s under load) are documented as a known gap:
   this suite proves the code paths are correct, not that a live Gemini
   outage has been observed and handled — see DECISIONS.md. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env.GEMINI_API_KEY = 'test-key-not-real';
  // These tests exercise the Gemini/tool/RAG failure paths, not persistence —
  // mocking this out avoids needing node:sqlite in the vitest/vite transform
  // pipeline (a config concern unrelated to the fault-tolerance logic itself).
  vi.doMock('../ai/observability', () => ({ recordAiCall: vi.fn(() => 'mock-request-id') }));
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
});

describe('tool failure', () => {
  it('executeTool never throws for malformed arguments — returns a typed error', async () => {
    const { executeTool } = await import('../ai/gemini/tools');
    const result = await executeTool('run_scenario', { stageIndex: 'not-a-number', improvementPts: 'also-bad' });
    expect(result).toMatchObject({ error: 'invalid_arguments' });
  });

  it('executeTool never throws for an unknown tool name', async () => {
    const { executeTool } = await import('../ai/gemini/tools');
    const result = await executeTool('drop_all_tables', {});
    expect(result).toMatchObject({ error: 'unknown_tool' });
  });

  it('a not-found branch id fails closed rather than throwing or returning unscoped data', async () => {
    const { executeTool } = await import('../ai/gemini/tools');
    const result = await executeTool('get_branch_performance', { branchId: 'NOT-REAL' });
    expect(result).toMatchObject({ error: 'not_found' });
  });
});

describe('RAG / embedding failure', () => {
  it('searchKnowledgeBase returns [] (never throws) when the embedding API errors', async () => {
    vi.doMock('@google/genai', () => ({
      GoogleGenAI: vi.fn().mockImplementation(() => ({
        models: { embedContent: vi.fn().mockRejectedValue(new Error('embedding model retired')) },
      })),
    }));
    const { searchKnowledgeBase } = await import('../rag/retrieval');
    const result = await searchKnowledgeBase('anything');
    expect(result).toEqual([]);
  });
});

describe('Gemini generation failure -> deterministic fallback', () => {
  it('askGemini falls back safely when every generateContent call throws (network failure)', async () => {
    vi.doMock('@google/genai', () => ({
      GoogleGenAI: vi.fn().mockImplementation(() => ({
        models: { generateContent: vi.fn().mockRejectedValue(new Error('network failure')) },
      })),
    }));
    const { askGemini } = await import('../ai/gemini/answer');
    const result = await askGemini('What is total network revenue?');
    expect(result.usedGemini).toBe(false);
    expect(result.answer).toBe("I don't have enough data to answer that reliably.");
  });

  it('askGemini retries once on schema-invalid (but syntactically valid JSON) output, then falls back if still invalid', async () => {
    const generateContent = vi.fn()
      // first call: no function calls, proceeds straight to structured-output request
      .mockResolvedValueOnce({ functionCalls: [], text: '{}' })
      // first structured-output attempt: valid JSON, but missing the required "answer" field
      .mockResolvedValueOnce({ text: '{"not_the_right_shape": true}' })
      // retry attempt: still schema-invalid
      .mockResolvedValueOnce({ text: '{"still_wrong": true}' });
    vi.doMock('@google/genai', () => ({
      GoogleGenAI: vi.fn().mockImplementation(() => ({ models: { generateContent } })),
    }));
    const { askGemini } = await import('../ai/gemini/answer');
    const result = await askGemini('What is total network revenue?');
    expect(result.usedGemini).toBe(true); // a response came back, it just didn't validate
    expect(result.answer).toBe("I don't have enough data to answer that reliably.");
    expect(generateContent).toHaveBeenCalledTimes(3); // initial call + 2 structured attempts, not unbounded
  });

  it('a syntactically invalid (non-JSON) response is also handled safely, not thrown to the caller', async () => {
    vi.doMock('@google/genai', () => ({
      GoogleGenAI: vi.fn().mockImplementation(() => ({
        models: { generateContent: vi.fn().mockResolvedValue({ functionCalls: [], text: 'not json at all' }) },
      })),
    }));
    const { askGemini } = await import('../ai/gemini/answer');
    const result = await askGemini('What is total network revenue?');
    expect(result.answer).toBe("I don't have enough data to answer that reliably.");
  });

  it('askGemini does not retry indefinitely on a persistent timeout — bounded to one retry', async () => {
    let callCount = 0;
    vi.doMock('@google/genai', () => ({
      GoogleGenAI: vi.fn().mockImplementation(() => ({
        models: {
          generateContent: vi.fn().mockImplementation(() => {
            callCount++;
            return new Promise(() => { /* never resolves — simulates a hung request */ });
          }),
        },
      })),
    }));
    const { askGemini } = await import('../ai/gemini/answer');
    const result = await askGemini('What is total network revenue?');
    expect(result.usedGemini).toBe(false);
    // withRetry: one initial attempt + one retry = 2, never more.
    expect(callCount).toBe(2);
  }, 30000);
});

describe('/api/ask route — dashboard stays functional when Gemini is down', () => {
  it('falls back to the deterministic engine and still returns a 200 with a real answer', async () => {
    vi.doMock('@google/genai', () => ({
      GoogleGenAI: vi.fn().mockImplementation(() => ({
        models: { generateContent: vi.fn().mockRejectedValue(new Error('503 service unavailable')) },
      })),
    }));
    const { POST } = await import('../../app/api/ask/route');
    const request = new Request('http://localhost/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'What is total network revenue?', range: 'all' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.usedGemini).toBe(false);
    expect(body.answer).toBeTruthy();
  });
});

describe('AI service (LangGraph) unreachable', () => {
  it('askViaAiService returns null (never throws) on a network failure, letting the caller fall through', async () => {
    process.env.AI_SERVICE_URL = 'http://localhost:1';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const { askViaAiService } = await import('../ai/aiService');
    const result = await askViaAiService('anything', []);
    expect(result).toBeNull();
  });
});
