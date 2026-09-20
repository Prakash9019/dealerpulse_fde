"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "dp-theme";
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "light";
  } catch {
    return false;
  }
}

// The server has no localStorage, so it always renders "dark"; the real
// value is applied via useSyncExternalStore right after hydration — same
// pattern as Sidebar's collapsed state, for the same reason (an
// effect-based setState here would throw a hydration-mismatch error).
function getServerSnapshot() {
  return false;
}

function setLight(next: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, next ? "light" : "dark");
  } catch {
    // localStorage unavailable — toggle still works for this render, just not persisted
  }
  document.documentElement.setAttribute("data-theme", next ? "light" : "dark");
  listeners.forEach((l) => l());
}

/** Manual light/dark switch. Dark is the product's designed default (see
    the dealerpulse-design-system skill); light is the same token set with
    lightness inverted (globals.css, `:root[data-theme="light"]`), not a
    second visual identity. The inline script in layout.tsx applies the
    stored choice before paint, so there's no flash of the wrong theme. */
export function ThemeToggle({ collapsed }: { collapsed: boolean }) {
  const isLight = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <button
      type="button"
      onClick={() => setLight(!isLight)}
      aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
      aria-pressed={isLight}
      className="flex items-center gap-2.5 rounded-[7px] px-[9px] py-[10px] text-[13.5px] font-medium text-ink-tertiary transition-[background-color,color,transform] duration-150 hover:bg-bg-hover active:scale-[0.97]"
    >
      <span aria-hidden="true" className="w-4 shrink-0 font-mono text-[9.5px]">
        {isLight ? "LT" : "DK"}
      </span>
      <span className={`truncate ${collapsed ? "sr-only" : "sr-only lg:not-sr-only lg:inline"}`}>
        {isLight ? "Light theme" : "Dark theme"}
      </span>
    </button>
  );
}
