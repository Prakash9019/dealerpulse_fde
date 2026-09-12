"use client";

import { useState } from "react";

type Verdict = "helpful" | "not_helpful" | "incorrect";

export function FeedbackRow({ context, question, requestId }: { context: string; question: string; requestId?: string }) {
  const [sent, setSent] = useState<Verdict | null>(null);
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState("");

  async function send(verdict: Verdict, noteText?: string) {
    setSent(verdict);
    setReporting(false);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, question, verdict, note: noteText, requestId }),
      });
    } catch {
      // best-effort — feedback is a nice-to-have, never blocks the UI
    }
  }

  if (sent) {
    return (
      <p className="dp-in text-[10.5px] text-ink-faint">
        {sent === "helpful" ? "Thanks — marked helpful." : sent === "not_helpful" ? "Thanks — marked not helpful." : "Thanks — logged as incorrect for review."}
      </p>
    );
  }

  const tapBtn = "rounded border border-line-hairline px-1.5 py-0.5 transition-[background-color,transform] duration-150 active:scale-90";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-[10.5px] text-ink-faint">
        <span>Was this helpful?</span>
        <button type="button" onClick={() => send("helpful")} className={`${tapBtn} hover:bg-bg-hover`}>
          Helpful
        </button>
        <button type="button" onClick={() => send("not_helpful")} className={`${tapBtn} hover:bg-bg-hover`}>
          Not helpful
        </button>
        <button type="button" onClick={() => setReporting(true)} className={`${tapBtn} text-critical hover:bg-critical-bg`}>
          Report incorrect
        </button>
      </div>
      {reporting && (
        <div className="dp-in flex items-center gap-1.5">
          <input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What was wrong? (optional)"
            className="flex-1 rounded border border-line-hairline bg-bg-recessed px-2 py-1 text-[11px] text-ink-primary placeholder:text-ink-muted"
          />
          <button type="button" onClick={() => send("incorrect", note)} className={`${tapBtn} border-critical text-critical hover:bg-critical-bg`}>
            Send
          </button>
        </div>
      )}
    </div>
  );
}
