"use client";

/** `FeaturedHero` — the catalogue's one deliberately unequal item.
    A small slash-prefixed overline naming the zone, then a large split card:
    a visual panel that *shows* the item on one side, an identity panel
    (icon, name, copy, one primary action) on the other. One item, one CTA —
    everything else on the page is smaller than this on purpose. Uses the
    `rounded-[14px]` exception reserved for large docked/hero surfaces
    (matches the /welcome hero card and the Ask DealerPulse panel). */

export interface FeaturedHeroAction {
  label: string;
  onClick?: () => void;
  /** Pending state for async actions — disables and swaps the label. */
  pending?: boolean;
  pendingLabel?: string;
}

export function FeaturedHero({
  overline = "Featured",
  icon,
  title,
  description,
  meta,
  media,
  primaryAction,
  secondaryAction,
  mediaSide = "start",
  loading = false,
  className,
}: {
  /** Zone label rendered as "/OVERLINE" above the card. */
  overline?: string;
  /** Icon element for the identity panel — sized by this component. */
  icon?: React.ReactNode;
  title: string;
  description: string;
  /** Small status/metadata row rendered between icon and title, e.g. StatusPills. */
  meta?: React.ReactNode;
  /** The visual half: a preview that shows what the item does. */
  media?: React.ReactNode;
  primaryAction: FeaturedHeroAction;
  secondaryAction?: FeaturedHeroAction;
  /** Which side the media panel sits on at desktop widths. */
  mediaSide?: "start" | "end";
  loading?: boolean;
  className?: string;
}) {
  if (loading) {
    return (
      <section className={`space-y-2 ${className || ""}`}>
        <div className="dp-shimmer h-3 w-24 rounded bg-bg-hover" />
        <div className="dp-shimmer h-64 w-full rounded-[14px] bg-bg-hover" />
      </section>
    );
  }

  return (
    <section aria-label={`${overline}: ${title}`} className={`space-y-2 ${className || ""}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-tertiary">
        <span aria-hidden="true">/</span>
        {overline}
      </p>
      <div
        className={`grid overflow-hidden rounded-[14px] border border-line-hairline bg-bg-card md:grid-cols-2 ${
          mediaSide === "end" ? "md:[&>*:first-child]:order-2" : ""
        }`}
      >
        {/* Visual half — recessed panel with a faint grid so any media reads as "a preview". */}
        <div
          aria-hidden="true"
          className="relative hidden min-h-56 items-center justify-center overflow-hidden bg-bg-recessed p-8 md:flex [background-image:linear-gradient(to_right,var(--line-hairline)_1px,transparent_1px),linear-gradient(to_bottom,var(--line-hairline)_1px,transparent_1px)] [background-size:32px_32px]"
        >
          {media}
        </div>

        {/* Identity half. */}
        <div className="flex flex-col gap-4 p-6 md:p-8">
          {icon && (
            <span className="flex size-11 items-center justify-center rounded-[10px] border border-line-hairline bg-bg-recessed text-ink-primary [&_svg]:size-5">
              {icon}
            </span>
          )}
          {meta && <div className="flex flex-wrap items-center gap-2">{meta}</div>}
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight text-ink-primary md:text-2xl">{title}</h2>
            <p className="text-sm leading-relaxed text-ink-muted">{description}</p>
          </div>
          <div className="mt-auto flex flex-col gap-2 pt-2 sm:flex-row">
            <button
              type="button"
              onClick={primaryAction.onClick}
              disabled={primaryAction.pending}
              className="flex w-full items-center justify-between gap-2 rounded-[7px] bg-accent px-5 py-2.5 text-[14px] font-semibold text-accent-fill-text transition-transform active:scale-[0.97] disabled:opacity-60 sm:flex-1"
            >
              {primaryAction.pending ? (primaryAction.pendingLabel ?? primaryAction.label) : primaryAction.label}
              <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className="size-4">
                <path
                  d="M4 12L12 4M12 4H5M12 4V11"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {secondaryAction && (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                disabled={secondaryAction.pending}
                className="w-full rounded-[7px] border border-line-hairline bg-bg-raised px-5 py-2.5 text-[14px] font-semibold text-ink-secondary transition-[background-color,transform] duration-150 hover:bg-bg-hover active:scale-[0.96] disabled:opacity-60 sm:w-auto"
              >
                {secondaryAction.pending ? (secondaryAction.pendingLabel ?? secondaryAction.label) : secondaryAction.label}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
