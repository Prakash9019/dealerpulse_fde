"use client";

/** `CategoryRail` — catalogue category navigation.
    A sticky vertical list of small uppercase category labels, the active one
    marked with the same accent left-indicator convention as the app sidebar
    (`Sidebar.tsx`) — the only other place a persistent accent marks "current
    location". `orientation="horizontal"` renders the same items as a
    wrapping pill row for narrow viewports/mastheads. Same items, same
    semantics (a radiogroup of filters), two presentations. */

export interface CategoryRailItem {
  id: string;
  label: string;
  /** Result count for this category under the current other filters. */
  count?: number;
}

export function CategoryRail({
  items,
  activeId,
  onSelect,
  orientation = "vertical",
  label = "Categories",
  className,
}: {
  items: CategoryRailItem[];
  activeId: string;
  onSelect: (id: string) => void;
  orientation?: "vertical" | "horizontal";
  label?: string;
  className?: string;
}) {
  if (orientation === "horizontal") {
    return (
      <div role="group" aria-label={label} className={`flex flex-wrap items-center gap-1.5 ${className || ""}`}>
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(item.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "border-accent bg-accent text-accent-fill-text"
                  : "border-line-hairline bg-transparent text-ink-muted hover:border-line-strong hover:text-ink-primary"
              }`}
            >
              {item.label}
              {item.count !== undefined && (
                <span className={`tabular-nums text-[10px] ${active ? "text-accent-fill-text/70" : "text-ink-faint"}`}>
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <nav aria-label={label} className={`flex flex-col gap-0.5 ${className || ""}`}>
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(item.id)}
            className={`group flex items-center justify-between gap-3 rounded-[7px] px-2.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
              active ? "text-ink-primary" : "text-ink-muted hover:text-ink-primary"
            }`}
          >
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`h-3.5 w-0.5 rounded-full transition-colors ${
                  active ? "bg-accent" : "bg-transparent group-hover:bg-line-hairline"
                }`}
              />
              {item.label}
            </span>
            {item.count !== undefined && (
              <span className="tabular-nums text-[10px] font-medium normal-nums text-ink-faint">{item.count}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
