"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useEscapeClose } from "@/lib/useEscapeClose";

interface Item {
  id: string;
  group: "Screens" | "Branches" | "Reps";
  label: string;
  sub?: string;
  href: string;
}

const SCREENS: Item[] = [
  { id: "s-ov", group: "Screens", label: "Overview", href: "/" },
  { id: "s-br", group: "Screens", label: "Branches", href: "/branches" },
  { id: "s-rp", group: "Screens", label: "Rep Leaderboard", href: "/reps" },
  { id: "s-ac", group: "Screens", label: "Action Center", href: "/actions" },
  { id: "s-fn", group: "Screens", label: "Funnel Diagnostics", href: "/funnel" },
  { id: "s-cp", group: "Screens", label: "Compare", href: "/compare" },
  { id: "s-ab", group: "Screens", label: "About", href: "/about" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [entities, setEntities] = useState<Item[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  function openPalette() {
    setOpen(true);
  }
  function closePalette() {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }
  useEscapeClose(closePalette);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) closePalette();
        else openPalette();
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("dp:open-command-palette", openPalette);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("dp:open-command-palette", openPalette);
    };
  }, [open]);

  useEffect(() => {
    if (!open || entities.length) return;
    fetch("/api/search-index")
      .then((r) => r.json())
      .then((d) => {
        const branches: Item[] = d.branches.map((b: { id: string; name: string; city: string }) => ({
          id: `b-${b.id}`,
          group: "Branches" as const,
          label: b.name,
          sub: b.city,
          href: `/branches/${b.id}`,
        }));
        const reps: Item[] = d.reps.map((r: { id: string; name: string; branchName: string; role: string }) => ({
          id: `r-${r.id}`,
          group: "Reps" as const,
          label: r.name,
          sub: `${r.role} · ${r.branchName}`,
          href: `/reps/${r.id}`,
        }));
        setEntities([...branches, ...reps]);
      });
  }, [open, entities.length]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  const results = useMemo(() => {
    const all = [...SCREENS, ...entities];
    const q = query.trim().toLowerCase();
    if (!q) return all.slice(0, 8);
    return all.filter((i) => i.label.toLowerCase().includes(q) || i.sub?.toLowerCase().includes(q)).slice(0, 20);
  }, [query, entities]);

  function go(item: Item) {
    router.push(item.href);
    closePalette();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && results[activeIndex]) {
      go(results[activeIndex]);
    }
  }

  if (!open) return null;

  let runningIndex = -1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="dp-scrim fixed inset-0 z-50 flex items-start justify-center bg-bg-scrim pt-24 px-4"
      onClick={closePalette}
    >
      <div
        className="dp-pop w-full max-w-[560px] overflow-hidden rounded-xl border border-line-hairline bg-bg-card shadow-[0_24px_60px_oklch(0.08_0.006_75_/_0.7)]"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Jump to a screen, branch, or rep…"
          aria-label="Search"
          className="w-full border-b border-line-hairline bg-transparent px-4 py-3 text-[14px] text-ink-primary outline-none placeholder:text-ink-muted"
        />
        <div className="max-h-[360px] overflow-y-auto py-1.5">
          {results.length === 0 && (
            <p className="px-4 py-3 text-[12.5px] text-ink-muted">No matches.</p>
          )}
          {(["Screens", "Branches", "Reps"] as const).map((group) => {
            const groupItems = results.filter((r) => r.group === group);
            if (!groupItems.length) return null;
            return (
              <div key={group}>
                <div className="px-4 pt-2 pb-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
                  {group}
                </div>
                {groupItems.map((item) => {
                  runningIndex++;
                  const idx = runningIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => go(item)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`flex w-full items-center gap-2 px-4 py-2 text-left text-[13px] ${
                        idx === activeIndex ? "bg-bg-hover text-ink-primary" : "text-ink-secondary"
                      }`}
                    >
                      <span>{item.label}</span>
                      {item.sub && <span className="text-[11px] text-ink-muted">{item.sub}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
