/* Tiny, real reference corpus (content/docs/*.md — actual SOP, glossary, and
   methodology text, not filler) for retrieval-augmented answers to
   policy/process questions. This is deliberately NOT used for KPI/numeric
   questions — those go through the analytics tools instead, per the
   project's own guidance: "use RAG for documents, deterministic analytics
   for numbers." */
import fs from 'node:fs';
import path from 'node:path';

export interface DocChunk {
  id: string;
  document: string;
  title: string;
  section: string;
  text: string;
}

export interface RagDocument {
  id: string;
  title: string;
  path: string;
  text: string;
}

const DOCS_DIR = path.join(process.cwd(), 'content/docs');

const DOC_TITLES: Record<string, string> = {
  'escalation-sop.md': 'Lead Escalation & Delivery Recovery SOP',
  'metrics-glossary.md': 'DealerPulse Metrics Glossary',
  'anomaly-methodology.md': 'Anomaly Detection Methodology',
};

let cachedDocs: RagDocument[] | null = null;
let cachedChunks: DocChunk[] | null = null;

export function listDocuments(): RagDocument[] {
  if (cachedDocs) return cachedDocs;
  const files = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith('.md'));
  cachedDocs = files.map((f) => {
    const text = fs.readFileSync(path.join(DOCS_DIR, f), 'utf8');
    return { id: f.replace(/\.md$/, ''), title: DOC_TITLES[f] || f, path: `content/docs/${f}`, text };
  });
  return cachedDocs;
}

export function getDocument(id: string): RagDocument | undefined {
  return listDocuments().find((d) => d.id === id);
}

/** Chunk by markdown section (## headings) — small enough corpus that this
    simple, deterministic split beats any fancier sliding-window scheme, and
    it gives every chunk a meaningful, citable section title for free. */
export function getChunks(): DocChunk[] {
  if (cachedChunks) return cachedChunks;
  const chunks: DocChunk[] = [];
  listDocuments().forEach((doc) => {
    const sections = doc.text.split(/\n(?=## )/g);
    sections.forEach((section, i) => {
      const headingMatch = section.match(/^##\s+(.+)$/m);
      const title = headingMatch ? headingMatch[1].trim() : doc.title;
      const text = section.trim();
      if (!text) return;
      chunks.push({ id: `${doc.id}#${i}`, document: doc.title, title: doc.title, section: title, text });
    });
  });
  cachedChunks = chunks;
  return chunks;
}
