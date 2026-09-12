import { executeTool, TOOLS } from "@/lib/ai/gemini/tools";

/** Internal tool-execution endpoint. Exists so an out-of-process orchestrator
    (e.g. the ai-service/ LangGraph service) can call the exact same
    validated, read-only analytics tools the in-process Gemini integration
    uses — one implementation of "what a tool does," reused from two
    orchestration paths, rather than re-implementing analytics in Python.
    This is not authenticated because nothing else in this assignment is
    (see ASSIGNMENT.md — auth is explicitly out of scope); in a real
    deployment this route would sit behind a service-to-service secret. */
export async function POST(request: Request) {
  const body = await request.json();
  const name: string = body.name;
  const args: unknown = body.args;
  if (!name) return Response.json({ error: "missing_name" }, { status: 400 });
  const result = await executeTool(name, args);
  return Response.json({ result });
}

export async function GET() {
  return Response.json({
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: t.parametersJsonSchema })),
  });
}
