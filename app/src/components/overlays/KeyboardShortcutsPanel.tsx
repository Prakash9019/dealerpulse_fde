"use client";

import { useEffect, useState } from "react";
import { useEscapeClose } from "@/lib/useEscapeClose";

const SHORTCUTS: { keys: string; description: string }[] = [
  { keys: "/", description: "Open Ask DealerPulse" },
  { keys: "⌘K / Ctrl K", description: "Open the command palette (jump to any screen, branch or rep)" },
  { keys: "?", description: "Show this shortcuts panel" },
  { keys: "Esc", description: "Close the open modal, drawer or panel" },
  { keys: "↑ / ↓", description: "Move through a list in the command palette or a dropdown" },
  { keys: "Enter", description: "Select the highlighted item, or activate a focused row" },
  { keys: "Tab", description: "Move focus to the next interactive element" },
];

export function KeyboardShortcutsPanel() {
  const [open, setOpen] = useState(false);
  useEscapeClose(() => setOpen(false));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA"].includes(target.tagName);
      if (e.key === "?" && !typing) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      className="dp-scrim fixed inset-0 z-50 flex items-center justify-center bg-bg-scrim px-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="dp-pop w-full max-w-[420px] rounded-xl border border-line-hairline bg-bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 text-[15px] font-medium text-ink-primary">Keyboard shortcuts</div>
        <ul className="space-y-2">
          {SHORTCUTS.map((s) => (
            <li key={s.keys} className="flex items-center justify-between gap-3 text-[12.5px]">
              <span className="text-ink-secondary">{s.description}</span>
              <span className="shrink-0 rounded border border-line-strong px-1.5 py-0.5 font-mono text-[10.5px] text-ink-muted">
                {s.keys}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
