import { getContext } from "@/lib/data";
import { branchSummary, funnelSummary } from "@/lib/ai/explanations";
import { executiveBrief } from "@/lib/ai/executiveBrief";
import { summarizeGrounded } from "@/lib/ai/gemini/summarize";
import { summarizeViaAiService } from "@/lib/ai/aiService";
import type { Filters } from "@/lib/domain/types";

/** Prefer the separate LangGraph ai-service/ when AI_SERVICE_URL is set,
    fall back to the in-process TS Gemini path, then its own deterministic
    fallback (summarizeGrounded already does the last step internally). */
async function summarizeWithFallback(facts: Record<string, string>, screenLabel: string, filterLabel: string) {
  const fromService = await summarizeViaAiService(facts, screenLabel, filterLabel);
  if (fromService?.usedGemini) return fromService;
  return summarizeGrounded(facts, screenLabel, filterLabel);
}

export async function POST(request: Request) {
  const body = await request.json();
  const screen: string = body.screen || "overview";
  const filters: Filters = {
    range: body.range || "all",
    branchId: body.branch || undefined,
    repId: body.rep || undefined,
  };

  const filterLabel = [filters.range, filters.branchId, filters.repId].filter(Boolean).join(" · ") || "all time, network-wide";

  if (screen === "branch" && body.branchId) {
    const ctx = getContext({ range: filters.range });
    const summary = branchSummary(ctx, body.branchId);
    if (!summary) return Response.json({ summary: "No leads assigned at this branch in the selected range.", usedGemini: false });
    const result = await summarizeWithFallback(
      { performance: summary.performance, problem: summary.problem, opportunity: summary.opportunity, action: summary.action },
      "Branch Detail",
      filterLabel,
    );
    return Response.json(result);
  }

  if (screen === "funnel") {
    const ctx = getContext(filters);
    const summary = funnelSummary(ctx);
    const result = await summarizeWithFallback(
      { whatHappened: summary.whatHappened, why: summary.why, impact: summary.impact, whatNext: summary.whatNext },
      "Funnel Diagnostics",
      filterLabel,
    );
    return Response.json(result);
  }

  if (screen === "actions") {
    const ctx = getContext({ range: filters.range });
    const top = ctx.recommendations[0];
    const facts: Record<string, string> = top
      ? { problem: top.problem, impact: top.impact, action: top.action, scope: `${ctx.actions.critical.length} critical, ${ctx.actions.attention.length} needing attention, ${ctx.actions.watch.length} on watch` }
      : { scope: "No high-priority leads in scope right now." };
    const result = await summarizeWithFallback(facts, "Action Center", filterLabel);
    return Response.json(result);
  }

  // default: overview
  const ctx = getContext(filters);
  const brief = executiveBrief(ctx);
  const result = await summarizeWithFallback(
    { headline: brief.headline, findings: brief.findings.map((f) => f.text).join(" "), action: brief.action },
    "Overview",
    filterLabel,
  );
  return Response.json(result);
}
