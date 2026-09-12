import { recordFeedback } from "@/lib/ai/feedback";

export async function POST(request: Request) {
  const body = await request.json();
  const verdict: string = body.verdict;
  if (!["helpful", "not_helpful", "incorrect"].includes(verdict)) {
    return Response.json({ error: "invalid_verdict" }, { status: 400 });
  }
  const entry = recordFeedback({
    context: String(body.context || "").slice(0, 80),
    question: String(body.question || "").slice(0, 300),
    verdict: verdict as "helpful" | "not_helpful" | "incorrect",
    note: body.note ? String(body.note).slice(0, 500) : undefined,
    requestId: body.requestId ? String(body.requestId).slice(0, 100) : undefined,
  });
  return Response.json({ ok: true, id: entry.id });
}
