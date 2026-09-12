import { getContext } from "@/lib/data";
import { askDealerPulse } from "@/lib/ai/questionRouter";
import { askGemini, type ChatTurn } from "@/lib/ai/gemini/answer";
import { isGeminiConfigured } from "@/lib/ai/gemini/config";
import { askViaAiService, isAiServiceConfigured } from "@/lib/ai/aiService";
import { recordAiCall } from "@/lib/ai/observability";
import type { Filters } from "@/lib/domain/types";

/** Minimal in-memory per-IP rate limit. Good enough for a single-instance
    deployment / this assignment's scope — not a substitute for a real
    multi-tenant rate limiter, which would need shared storage across
    instances. Bounds runaway Gemini cost, nothing more. */
const buckets = new Map<string, { count: number; resetAt: number }>();
const LIMIT = 20;
const WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now > b.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  b.count++;
  return b.count > LIMIT;
}

// A bare greeting has no business claim to ground, so it doesn't belong
// behind the "I don't have enough data to answer that reliably" guardrail —
// that response is for genuinely out-of-scope questions, not "hi". Handled
// deterministically (no model call) so it's instant and never inconsistent.
const GREETING_RE = /^\s*(hi+|hello+|hey+|yo|sup|howdy|greetings|good\s*(morning|afternoon|evening))\b[\s!.,?a-z]{0,20}$/i;

function greetingReply() {
  return {
    interpretation: "greeting",
    answer:
      "Hi — I'm DealerPulse's analytics copilot. Ask me about branch performance, sales reps, leads, revenue, funnel drop-offs, forecasts, or what-if scenarios, e.g. \"Why is Lakeside underperforming?\" or \"How much revenue is at risk?\"",
    evidence: [],
    impact: "",
    recommendation: "",
    citations: [],
    confidence: "high" as const,
    usedGemini: false,
  };
}

export async function POST(request: Request) {
  const body = await request.json();
  const question: string = body.question || "";
  if (GREETING_RE.test(question)) {
    return Response.json(greetingReply());
  }
  const history: ChatTurn[] = Array.isArray(body.history)
    ? body.history.filter((h: unknown): h is ChatTurn =>
        !!h && typeof h === "object" && (h as ChatTurn).role != null && typeof (h as ChatTurn).text === "string",
      ).slice(-8)
    : [];
  const filters: Filters = {
    range: body.range || "all",
    branchId: body.branch || undefined,
    repId: body.rep || undefined,
  };

  const ip = request.headers.get("x-forwarded-for") || "local";

  if (isGeminiConfigured() || isAiServiceConfigured()) {
    if (isRateLimited(ip)) {
      return Response.json(
        { interpretation: question, answer: "Too many questions in a short time — try again in a minute.", evidence: [], usedGemini: false },
        { status: 429 },
      );
    }

    // Prefer the separate LangGraph ai-service/ when configured (AI_SERVICE_URL);
    // fall back to the in-process TS Gemini integration, then the deterministic
    // engine. Neither external dependency being down breaks the dashboard.
    const fromService = await askViaAiService(question, history);
    const result = fromService?.usedGemini
      ? fromService
      : isGeminiConfigured() ? await askGemini(question, history, { clientIp: ip }) : fromService;

    if (result?.usedGemini) {
      return Response.json({
        interpretation: question,
        answer: result.answer,
        evidence: result.evidence.map((e) => ({ label: e.metric, value: e.value, note: e.context })),
        impact: result.impact,
        recommendation: result.recommendation,
        citations: result.citations,
        confidence: result.confidence,
        usedGemini: true,
        requestId: result.requestId,
        cta: result.cta ?? undefined,
      });
    }
    // Both paths failed outright (misconfigured, timeout, network) — fall back
    // to the deterministic path rather than showing an error. Dashboard keeps working.
  }

  const ctx = getContext(filters);
  const answer = askDealerPulse(ctx, question);
  const requestId = recordAiCall({
    kind: "ask",
    model: "deterministic-rule-based",
    latencyMs: 0,
    usedGemini: false,
    success: !answer.suggestions,
    fallbackReason: isGeminiConfigured() || isAiServiceConfigured() ? "gemini_failed" : "not_configured",
    promptChars: question.length,
    responseChars: answer.answer.length,
    clientIp: ip,
  });
  return Response.json({ ...answer, usedGemini: false, requestId });
}
