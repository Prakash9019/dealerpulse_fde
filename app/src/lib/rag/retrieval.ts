/* Real vector retrieval over the tiny reference corpus, using Gemini's
   embedding model — not a keyword hack, but genuinely small-scale: a handful
   of markdown documents, embedded once per server process and cached
   in-memory (recomputed on cold start, which costs a few hundred ms for this
   corpus size — acceptable, and avoids adding a vector database for three
   documents). Server-only: never import this from client code. */
import { GoogleGenAI } from '@google/genai';
import { getGeminiApiKey } from '../ai/gemini/config';
import { getChunks, type DocChunk } from './corpus';

const EMBEDDING_MODEL = 'gemini-embedding-001';

interface EmbeddedChunk extends DocChunk {
  vector: number[];
}

let cache: EmbeddedChunk[] | null = null;
let cachePromise: Promise<EmbeddedChunk[]> | null = null;

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
}

async function embedChunks(client: GoogleGenAI): Promise<EmbeddedChunk[]> {
  const chunks = getChunks();
  const response = await client.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: chunks.map((c) => c.text),
  });
  const embeddings = response.embeddings || [];
  return chunks.map((c, i) => ({ ...c, vector: embeddings[i]?.values || [] }));
}

async function getEmbeddedCorpus(client: GoogleGenAI): Promise<EmbeddedChunk[]> {
  if (cache) return cache;
  if (!cachePromise) cachePromise = embedChunks(client).then((c) => { cache = c; return c; });
  return cachePromise;
}

export interface RetrievedChunk {
  document: string;
  section: string;
  text: string;
  score: number;
}

/** Top-k retrieval by cosine similarity. Returns [] (never throws) if Gemini
    is unavailable — callers treat that as "no relevant document found",
    never as a hard error. */
export async function searchKnowledgeBase(query: string, topK = 3): Promise<RetrievedChunk[]> {
  try {
    const client = new GoogleGenAI({ apiKey: getGeminiApiKey() });
    const corpus = await getEmbeddedCorpus(client);
    const queryEmbedding = await client.models.embedContent({ model: EMBEDDING_MODEL, contents: [query] });
    const queryVector = queryEmbedding.embeddings?.[0]?.values || [];
    if (!queryVector.length) return [];

    return corpus
      .map((c) => ({ document: c.document, section: c.section, text: c.text, score: cosineSimilarity(queryVector, c.vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  } catch (e) {
    // Logged server-side only (never surfaced to the user or the model) so a
    // silent embedding-API failure — e.g. a renamed/retired model id — is
    // diagnosable instead of just quietly looking like "no documents found".
    console.error('[rag] searchKnowledgeBase failed:', e instanceof Error ? e.message : e);
    return [];
  }
}
