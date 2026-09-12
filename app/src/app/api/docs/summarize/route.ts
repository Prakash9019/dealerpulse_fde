import { getDocument } from "@/lib/rag/corpus";
import { summarizeDocument } from "@/lib/ai/gemini/summarize";

export async function POST(request: Request) {
  const body = await request.json();
  const docId: string = body.docId;
  const doc = getDocument(docId);
  if (!doc) return Response.json({ error: "not_found" }, { status: 404 });
  const result = await summarizeDocument(doc.title, doc.text);
  return Response.json(result);
}
