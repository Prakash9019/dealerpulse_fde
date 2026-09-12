"use client";

import { useEffect, useRef, useState } from "react";

export interface SelectOption {
  key: string;
  label: string;
}

/** Custom-styled listbox replacing the native <select> — native popups render at
    OS/browser-controlled font sizes we can't style, which looks broken on systems
    with accessibility text-size scaling turned up. This gives pixel-consistent sizing
    everywhere, at the cost of implementing keyboard nav ourselves. */
export function Select({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  ariaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.key === value) || options[0];

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openList() {
    setActiveIndex(Math.max(0, options.findIndex((o) => o.key === value)));
    setOpen(true);
  }

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openList();
    }
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onChange(options[activeIndex].key);
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className || ""}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onTriggerKeyDown}
        className="flex w-full items-center gap-1.5 rounded-[7px] border border-line-hairline bg-bg-card px-2 py-1.5 text-left text-[12px] text-ink-primary hover:bg-bg-hover"
      >
        <span className="truncate">{selected?.label}</span>
        <span aria-hidden="true" className="ml-auto text-ink-muted">▾</span>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          onKeyDown={onListKeyDown}
          ref={(el) => el?.focus()}
          className="absolute left-0 top-[calc(100%+4px)] z-40 max-h-64 min-w-full overflow-y-auto rounded-[7px] border border-line-hairline bg-bg-card py-1 text-[12px] shadow-[0_12px_30px_oklch(0.08_0.006_75_/_0.6)]"
        >
          {options.map((o, i) => (
            <li key={o.key} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={o.key === value}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => {
                  onChange(o.key);
                  setOpen(false);
                }}
                className={`block w-full whitespace-nowrap px-3 py-1.5 text-left ${
                  i === activeIndex ? "bg-bg-hover" : ""
                } ${o.key === value ? "text-accent" : "text-ink-primary"}`}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
