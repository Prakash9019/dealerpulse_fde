"use client";

import { useState } from "react";

/** Copies a plain-text version of an AI card to the clipboard, for pasting into
    Slack/email. Every AI card already has a fully-formed sentence — this just
    exposes it. */
export function CopyInsightButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard API unavailable (e.g. insecure context) — fail silently, no crash
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`inline-flex items-center gap-1 rounded-full border border-line-hairline px-2 py-0.5 text-[10.5px] text-ink-muted transition-[background-color,color,transform] duration-150 hover:bg-bg-hover hover:text-ink-primary active:scale-90 ${className || ""}`}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
