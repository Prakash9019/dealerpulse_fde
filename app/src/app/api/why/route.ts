import { getContext } from "@/lib/data";
import { whyExplanation } from "@/lib/ai/explanations";
import type { Filters } from "@/lib/domain/types";

export async function POST(request: Request) {
  const body = await request.json();
  const filters: Filters = {
    range: body.range || "all",
    branchId: body.branch || undefined,
    repId: body.rep || undefined,
  };
  const ctx = getContext(filters);
  const explanation = whyExplanation(ctx, body.key || "conversion");
  return Response.json(explanation);
}
