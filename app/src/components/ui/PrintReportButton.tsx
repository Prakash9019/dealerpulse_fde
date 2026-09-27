"use client";

/** Browser print, which every browser's print dialog can also "Save as PDF" from —
    no PDF library needed. A plain-text download used to sit next to this button but
    was cut: a second, lower-value way to get the same report out of the screen,
    sitting at equal visual weight with this one for no real reason. */
export function PrintReportButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-[7px] border border-line-hairline px-3 py-1.5 text-[12px] text-ink-secondary transition-[background-color,transform] duration-150 hover:bg-bg-hover active:scale-[0.96]"
    >
      Print / Save as PDF
    </button>
  );
}
