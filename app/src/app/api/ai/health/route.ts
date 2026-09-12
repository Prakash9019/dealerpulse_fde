import { getAiHealth } from "@/lib/ai/observability";

export async function GET() {
  return Response.json(getAiHealth());
}
