"use client";

/** Two export actions for a report screen: browser print (which every browser's
    print dialog can also "Save as PDF" from — no PDF library needed) and a
    plain-text download for pasting into an email or doc. */
export function PrintReportButton({
  textContent,
  filename,
}: {
  textContent: string;
  filename: string;
}) {
  function downloadText() {
    const blob = new Blob([textContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="no-print flex items-center gap-2">
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-[7px] border border-line-hairline px-3 py-1.5 text-[12px] text-ink-secondary transition-[background-color,transform] duration-150 hover:bg-bg-hover active:scale-[0.96]"
      >
        Print / Save as PDF
      </button>
      <button
        type="button"
        onClick={downloadText}
        className="rounded-[7px] border border-line-hairline px-3 py-1.5 text-[12px] text-ink-secondary transition-[background-color,transform] duration-150 hover:bg-bg-hover active:scale-[0.96]"
      >
        Download as text
      </button>
    </div>
  );
}
