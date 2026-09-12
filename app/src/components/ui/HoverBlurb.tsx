/** Pure-CSS hover card — no JS state needed. Wraps a trigger element; on hover/focus
    reveals a one-line AI-generated take without navigating to the detail page. */
export function HoverBlurb({ text, children }: { text: string; children: React.ReactNode }) {
  if (!text) return <>{children}</>;
  return (
    <span className="group/blurb relative inline-block">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-20 mt-1.5 w-64 max-w-[70vw] rounded-[8px] border border-accent-tint-border bg-bg-raised p-2.5 text-[11.5px] leading-[1.5] text-ink-secondary opacity-0 shadow-[0_12px_30px_oklch(0.08_0.006_75_/_0.6)] transition-opacity delay-150 duration-150 group-hover/blurb:opacity-100 group-focus-within/blurb:opacity-100"
      >
        <span className="mb-1 flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-accent">
          <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rotate-45 rounded-[1px] bg-accent" />
          AI take
        </span>
        {text}
      </span>
    </span>
  );
}
