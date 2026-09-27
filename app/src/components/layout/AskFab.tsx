"use client";

import { useEffect, useRef, useState } from "react";

// Vertical position (px from the bottom edge) persists across visits so a
// user who drags the button out of the way of some data doesn't have to
// redo it every session — it's a per-browser convenience, not shared state.
const STORAGE_KEY = "dp-ask-fab-bottom";
const DEFAULT_BOTTOM = 24;
const EDGE_MARGIN = 12;
const BUTTON_SIZE = 52;
const DRAG_THRESHOLD = 6;

function clampBottom(value: number) {
  if (typeof window === "undefined") return value;
  const max = Math.max(EDGE_MARGIN, window.innerHeight - BUTTON_SIZE - EDGE_MARGIN);
  return Math.min(Math.max(value, EDGE_MARGIN), max);
}

/** Icon-only launcher for the Ask DealerPulse panel. The header already has
 * a labeled "Ask DealerPulse…" entry point, so this one stays a plain
 * circular icon rather than repeating the same text — and since it floats
 * over whatever screen is behind it, it's vertically draggable so it never
 * has to permanently sit on top of data someone needs to read. */
export function AskFab({ onOpen }: { onOpen: () => void }) {
  const [bottom, setBottomState] = useState(DEFAULT_BOTTOM);
  const bottomRef = useRef(DEFAULT_BOTTOM);
  const dragRef = useRef<{ startY: number; startBottom: number; dragging: boolean } | null>(null);

  function setBottom(value: number) {
    bottomRef.current = value;
    setBottomState(value);
  }

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved != null) setBottom(clampBottom(parseFloat(saved)));
    } catch {
      // Private browsing / blocked storage — just keep the default position.
    }
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, startBottom: bottomRef.current, dragging: false };
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const delta = e.clientY - drag.startY;
    if (!drag.dragging && Math.abs(delta) < DRAG_THRESHOLD) return;
    drag.dragging = true;
    // Moving the pointer down should move the button down, hence the sign flip
    // against "bottom" (distance from the bottom edge).
    setBottom(clampBottom(drag.startBottom - delta));
  }

  function endDrag(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    if (drag.dragging) {
      try {
        window.localStorage.setItem(STORAGE_KEY, String(bottomRef.current));
      } catch {
        // Ignore — position just won't be remembered next visit.
      }
    } else {
      onOpen();
    }
  }

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      aria-label="Ask DealerPulse"
      title="Ask DealerPulse (drag to reposition)"
      style={{ bottom, touchAction: "none" }}
      className="dp-card-hover fixed right-4 z-50 flex h-[52px] w-[52px] cursor-grab items-center justify-center rounded-full border border-accent-tint-border bg-accent-tint-bg shadow-[0_12px_30px_oklch(0.08_0.006_75_/_0.5)] active:cursor-grabbing sm:right-6"
    >
      <span aria-hidden="true" className="dp-ai-mark inline-block h-3.5 w-3.5 rotate-45 rounded-[2px] bg-accent" />
    </button>
  );
}
