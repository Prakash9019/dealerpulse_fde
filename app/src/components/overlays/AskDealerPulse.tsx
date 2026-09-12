"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { routeHref } from "@/lib/routes";
import type { EvidenceItem, Route } from "@/lib/domain/types";
import { FeedbackRow } from "../ui/FeedbackRow";

const SAMPLE_QUESTIONS = [
  "Why is Lakeside underperforming?",
  "Which branch has the highest conversion?",
  "Which leads should we call today?",
  "How much revenue is at risk?",
  "Which sales rep is performing best?",
  "What caused December's improvement?",
  "What are the biggest delivery delays?",
  "Which lead source converts best?",
  "Where is the biggest bottleneck?",
];

interface AskAnswer {
  interpretation: string;
  answer: string;
  evidence: EvidenceItem[];
  cta?: { label: string; route: Route };
  suggestions?: boolean;
  impact?: string;
  recommendation?: string;
  citations?: string[];
  confidence?: "high" | "medium" | "low";
  usedGemini?: boolean;
  requestId?: string;
}

interface Turn {
  question: string;
  answer: AskAnswer;
}

/** Parses a leading "N%" out of a formatted string, e.g. "58.2%" -> 0.582. */
function parsePct(s?: string): number | null {
  if (!s) return null;
  const m = s.match(/(-?\d+(?:\.\d+)?)%/);
  return m ? parseFloat(m[1]) / 100 : null;
}

function EvidenceCell({ ev }: { ev: EvidenceItem }) {
  const value = parsePct(ev.value);
  const baseline = parsePct(ev.baseline);
  // When both the value and its baseline are percentages, show a comparison bar —
  // a claim next to a number next to a visual, not text alone.
  if (value != null && baseline != null) {
    const max = Math.max(value, baseline, 0.01) * 1.15;
    return (
      <div className="text-[11.5px]">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-ink-muted">{ev.label}</span>
          <span className={`font-mono text-[11.5px] ${ev.bad ? "text-critical" : "text-ink-primary"}`}>
            {ev.value}
          </span>
        </div>
        <div className="h-[5px] rounded-full bg-bar-track">
          <div
            className={`dp-bar-grow h-full rounded-full ${ev.bad ? "bg-critical" : "bg-accent"}`}
            style={{ "--w": `${Math.min(100, (value / max) * 100)}%` } as React.CSSProperties}
          />
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[9.5px] text-ink-muted">baseline</span>
          <span className="font-mono text-[10px] text-ink-muted">{ev.baseline}</span>
        </div>
        <div className="h-[3px] rounded-full bg-bar-track">
          <div
            className="dp-bar-grow h-full rounded-full bg-bar-fill-recessive"
            style={{ "--w": `${Math.min(100, (baseline / max) * 100)}%` } as React.CSSProperties}
          />
        </div>
      </div>
    );
  }
  return (
    <div className="text-[11.5px]">
      <div className="text-ink-muted">{ev.label}</div>
      <div className={`font-mono text-[12.5px] ${ev.bad ? "text-critical" : "text-ink-primary"}`}>
        {ev.value}
      </div>
      {ev.baseline && <div className="text-[10px] text-ink-muted">{ev.baseline}</div>}
    </div>
  );
}

export function AskDealerPulse({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  // The just-sent question, shown immediately in the transcript with a
  // "thinking" placeholder — previously the question only appeared once the
  // full answer came back (it just sat, greyed out, in the now-disabled
  // input box in the meantime), so sending a question looked like it did
  // nothing until the answer eventually popped in.
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  const last = turns[turns.length - 1];
  const asked = last?.question ?? "";

  async function ask(q: string) {
    setLoading(true);
    setPendingQuestion(q);
    setQuestion("");
    try {
      // Short-term conversation memory only — the last few turns, sent fresh
      // each request. No persistent long-term memory is stored anywhere.
      const history = turns.flatMap((t) => [
        { role: "user" as const, text: t.question },
        { role: "model" as const, text: t.answer.answer },
      ]).slice(-8);
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          history,
          range: searchParams.get("range") || "all",
          branch: searchParams.get("branch") || undefined,
        }),
      });
      const answer: AskAnswer = await res.json();
      setTurns((prev) => [...prev, { question: q, answer }]);
    } finally {
      setLoading(false);
      setPendingQuestion(null);
    }
  }

  const followUps = SAMPLE_QUESTIONS.filter((q) => q !== asked).slice(0, 3);

  return (
    // Docked bottom-right like a persistent chat widget, not a center-screen
    // modal — and no full-page overlay div behind it either: an earlier
    // version kept a page-covering (even invisible) click-catcher, which
    // still blocked every click on the dashboard, so it acted like a modal
    // no matter how it looked. This is just the panel itself, fixed in the
    // corner; the rest of the page stays fully interactive while it's open.
    // Closing is via Esc or the close button only, not a click elsewhere.
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Ask DealerPulse"
      className="dp-pop fixed bottom-4 right-4 z-50 flex max-h-[75vh] w-full max-w-[420px] flex-col rounded-xl border border-line-hairline bg-bg-card shadow-[0_24px_60px_oklch(0.08_0.006_75_/_0.7)] sm:bottom-6 sm:right-6"
    >
        {/* Header: minimal title + close, not the input — the composer now
            lives at the very bottom, like a normal chat app. */}
        <div className="flex items-center gap-2 border-b border-line-hairline px-5 py-3">
          <span aria-hidden="true" className="dp-ai-mark inline-block h-3 w-3 rotate-45 rounded-[2px] bg-accent shrink-0" />
          <span className="text-[13px] font-semibold text-ink-primary">Ask DealerPulse</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded px-2 py-1 text-ink-muted hover:bg-bg-hover"
          >
            Esc
          </button>
        </div>

        {/* Scrollable transcript — grows upward, oldest turn first, just
            like any chat history. */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {turns.length === 0 && !loading && (
            <p className="text-[11.5px] text-ink-muted">
              Ask about performance, pipeline, risk or opportunity.
            </p>
          )}
          {turns.map((t, ti) => (
            <div key={ti} className="dp-in space-y-3 border-b border-line-hairline pb-4 last:border-0 last:pb-0">
              <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-accent">
                Question
              </div>
              <div className="text-[13px] text-ink-secondary">{t.question}</div>

              {/* Staged reveal: Answer, then Evidence, Impact, Recommendation,
                  Sources, CTA cascade in over ~350ms rather than popping in
                  together — the motion itself is what communicates "the
                  model finished reasoning through this," without a fake
                  typing effect. dp-stagger only animates on mount, so this
                  plays once per turn, not on every re-render. */}
              <div className="dp-stagger" style={{ "--d": "0ms" } as React.CSSProperties}>
                <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-accent">
                  Answer
                </div>
                <div className="mt-1.5 text-[14px] leading-relaxed text-ink-primary">{t.answer.answer}</div>
              </div>

              {t.answer.evidence.length > 0 && (
                <div className="dp-stagger space-y-3" style={{ "--d": "80ms" } as React.CSSProperties}>
                  <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-muted">
                    Evidence
                  </div>
                  <div className="grid grid-cols-2 gap-3 rounded-lg bg-bg-recessed p-3">
                    {t.answer.evidence.slice(0, 8).map((ev, i) => (
                      <EvidenceCell key={i} ev={ev} />
                    ))}
                  </div>
                </div>
              )}

              {t.answer.impact && (
                <p className="dp-stagger text-[12px] text-ink-tertiary" style={{ "--d": "160ms" } as React.CSSProperties}>
                  <span className="font-semibold text-ink-muted">Impact: </span>
                  {t.answer.impact}
                </p>
              )}

              {t.answer.recommendation && (
                <p className="dp-stagger text-[12px] text-ink-tertiary" style={{ "--d": "220ms" } as React.CSSProperties}>
                  <span className="font-semibold text-ink-muted">Recommendation: </span>
                  {t.answer.recommendation}
                </p>
              )}

              {t.answer.citations && t.answer.citations.length > 0 && (
                <div className="dp-stagger text-[10.5px] text-ink-faint" style={{ "--d": "260ms" } as React.CSSProperties}>
                  Sources: {t.answer.citations.join(", ")}
                </div>
              )}

              <FeedbackRow context="ask-dealerpulse" question={t.question} requestId={t.answer.requestId} />

              {t.answer.cta && (
                <button
                  type="button"
                  onClick={() => {
                    router.push(routeHref(t.answer.cta!.route, searchParams.get("range")));
                    onClose();
                  }}
                  style={{ "--d": "300ms" } as React.CSSProperties}
                  className="dp-stagger rounded-[7px] bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-accent-fill-text"
                >
                  {t.answer.cta.label}
                </button>
              )}
            </div>
          ))}
          {pendingQuestion && (
            <div className="dp-in space-y-3">
              <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-accent">
                Question
              </div>
              <div className="text-[13px] text-ink-secondary">{pendingQuestion}</div>
              <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-accent">
                Answer
              </div>
              <div className="dp-shimmer h-16 rounded-lg bg-bg-recessed" aria-busy="true" aria-label="Thinking…" />
            </div>
          )}
        </div>

        {/* Suggestions row — sits directly above the composer, at the
            bottom of the panel, not scattered inside the transcript. Shows
            the sample starter questions before any turn, and contextual
            follow-ups once a conversation is going. Hidden as soon as the
            user starts typing their own question — previously it stayed
            pinned there permanently, which in a small fixed-height panel
            meant it ate the exact space you'd want for reading the
            conversation or typing, whether or not you wanted a suggestion. */}
        {!loading && !question.trim() && (turns.length === 0 ? SAMPLE_QUESTIONS.length > 0 : followUps.length > 0) && (
          <div className="border-t border-line-hairline px-5 pt-3">
            <div className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-muted">
              {turns.length === 0 ? "Try asking" : "You may also want to know"}
            </div>
            <div className="flex flex-wrap gap-2 pb-1">
              {(turns.length === 0 ? SAMPLE_QUESTIONS : followUps).map((q, i) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => ask(q)}
                  style={turns.length === 0 ? ({ "--d": i * 30 + "ms" } as React.CSSProperties) : undefined}
                  className={`${turns.length === 0 ? "dp-stagger" : ""} rounded-full border border-line-hairline px-3 py-1.5 text-[11.5px] text-ink-secondary transition-transform hover:scale-[1.03] hover:bg-bg-hover active:scale-[0.97]`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Composer — pinned at the very bottom of the panel. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            // Guards against a resubmit firing (e.g. pressing Enter again)
            // while the previous answer is still in flight — nothing else
            // blocked that, so the exact same question could get asked and
            // answered twice in a row.
            if (question.trim() && !loading) ask(question);
          }}
          className="flex items-center gap-2 border-t border-line-hairline px-5 py-3"
        >
          <input
            autoFocus
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={loading}
            placeholder={loading ? "Thinking…" : "Ask anything about your dealership…"}
            className="flex-1 bg-transparent text-[14px] text-ink-primary outline-none placeholder:text-ink-muted disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            aria-label="Send"
            className="rounded-[7px] bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-accent-fill-text disabled:opacity-40"
          >
            Send
          </button>
        </form>
    </div>
  );
}
