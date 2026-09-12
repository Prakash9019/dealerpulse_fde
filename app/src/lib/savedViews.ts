"use client";

/* Saved views: bookmark the current screen + filter query string under a name.
   Uses the same useSyncExternalStore-friendly module pattern as the sidebar
   collapse store, so reading localStorage during SSR never causes a hydration
   mismatch (server always sees an empty list; the real list appears right
   after hydration, no error, just a same-tick correction). */

export interface SavedView {
  id: string;
  name: string;
  path: string; // pathname + search, e.g. "/actions?tier=critical"
  screenLabel: string;
  createdAt: number;
}

const STORAGE_KEY = "dp-saved-views";
const listeners = new Set<() => void>();
let cache: SavedView[] | null = null;

function read(): SavedView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedView[]) : [];
  } catch {
    return [];
  }
}

export function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function getSnapshot(): SavedView[] {
  if (cache === null) cache = read();
  return cache;
}

// A single stable reference — useSyncExternalStore requires getServerSnapshot
// to return the same value (by ===) on every call, or React logs an infinite-
// loop warning even though this never actually loops.
const EMPTY: SavedView[] = [];
export function getServerSnapshot(): SavedView[] {
  return EMPTY;
}

function write(next: SavedView[]) {
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable — in-memory only for this session
  }
  listeners.forEach((l) => l());
}

export function saveView(name: string, path: string, screenLabel: string) {
  const view: SavedView = { id: `${Date.now()}`, name, path, screenLabel, createdAt: Date.now() };
  write([...getSnapshot(), view]);
}

export function deleteView(id: string) {
  write(getSnapshot().filter((v) => v.id !== id));
}
