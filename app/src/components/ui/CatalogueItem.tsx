"use client";

/** `CatalogueItem` — the minimal discovery row of a browse-and-decide catalogue.
    Identity (icon + name), one line of what it does, and a single small
    uppercase action. Deliberately no KPIs/sparklines/metadata rows — a
    catalogue item's job is to be recognised and chosen among many siblings;
    anything richer belongs in the preview panel it opens.

    The whole surface is a button that *selects* (opens preview); the
    uppercase action is a second, smaller button that *commits*. The name
    uses the stretched-link trick (`after:absolute after:inset-0`) so the
    whole card selects without a nested-interactive violation. */

export function CatalogueItem({
  icon,
  name,
  description,
  badge,
  actionLabel,
  onAction,
  actionPending = false,
  onSelect,
  selected = false,
  loading = false,
  className,
}: {
  /** Identity icon — sized by this component. */
  icon: React.ReactNode;
  name: string;
  /** One sentence. Clamped to two lines to keep rows even. */
  description: string;
  /** Small trailing identity slot on the name row, e.g. a StatusPill. */
  badge?: React.ReactNode;
  /** The commit verb, rendered uppercase — "Deploy", "Enable", "Open". */
  actionLabel: string;
  /** Commit. Omit to render the item without a commit action. */
  onAction?: () => void;
  actionPending?: boolean;
  /** Select — open this item's preview/detail. The whole card triggers it. */
  onSelect?: () => void;
  /** Marks the item whose preview is currently open. */
  selected?: boolean;
  loading?: boolean;
  className?: string;
}) {
  if (loading) {
    return (
      <div className={`space-y-3 rounded-[10px] border border-line-hairline bg-bg-card p-4 ${className || ""}`}>
        <div className="flex items-center gap-3">
          <div className="dp-shimmer size-9 rounded-[7px] bg-bg-hover" />
          <div className="dp-shimmer h-4 w-32 rounded bg-bg-hover" />
        </div>
        <div className="dp-shimmer h-3 w-full rounded bg-bg-hover" />
        <div className="dp-shimmer h-3 w-24 rounded bg-bg-hover" />
      </div>
    );
  }

  return (
    <div
      className={`group relative flex flex-col gap-3 rounded-[10px] border bg-bg-card p-4 text-left transition-colors ${
        selected ? "border-line-strong ring-1 ring-accent-tint-border" : "border-line-hairline hover:border-line-strong"
      } ${className || ""}`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-[7px] border border-line-hairline bg-bg-recessed text-ink-primary [&_svg]:size-4"
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onSelect}
            className="text-sm font-semibold leading-snug text-ink-primary after:absolute after:inset-0 after:rounded-[10px]"
          >
            {name}
          </button>
          {badge && <span className="ml-2 inline-flex align-middle">{badge}</span>}
        </div>
      </div>
      <p className="line-clamp-2 min-h-8 text-xs leading-relaxed text-ink-muted">{description}</p>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          disabled={actionPending}
          className="relative z-10 mt-auto inline-flex w-fit items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted transition-colors hover:text-ink-primary disabled:opacity-60 group-hover:text-ink-primary"
        >
          {actionPending ? "Working…" : actionLabel}
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            fill="none"
            className="size-3 -translate-x-0.5 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100 motion-reduce:transition-none"
          >
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
