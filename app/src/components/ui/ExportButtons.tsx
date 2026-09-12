"use client";

import { useSearchParams } from "next/navigation";

/** Downloads a real, formatted PDF/XLSX from the server (see
    lib/export/report.ts, pdf.ts, xlsx.ts) — never a screenshot. Respects
    the current range/branch/rep filters. */
export function ExportButtons() {
  const searchParams = useSearchParams();

  function hrefFor(kind: "pdf" | "xlsx") {
    const qs = new URLSearchParams();
    const range = searchParams.get("range");
    const branch = searchParams.get("branch");
    const rep = searchParams.get("rep");
    if (range) qs.set("range", range);
    if (branch) qs.set("branch", branch);
    if (rep) qs.set("rep", rep);
    return `/api/export/${kind}?${qs.toString()}`;
  }

  return (
    <div className="flex items-center gap-2">
      <a
        href={hrefFor("pdf")}
        className="rounded-[7px] border border-line-hairline bg-bg-raised px-2.5 py-1.5 text-[12px] text-ink-secondary transition-[background-color,transform] duration-150 hover:bg-bg-hover active:scale-[0.96]"
      >
        Download PDF
      </a>
      <a
        href={hrefFor("xlsx")}
        className="rounded-[7px] border border-line-hairline bg-bg-raised px-2.5 py-1.5 text-[12px] text-ink-secondary transition-[background-color,transform] duration-150 hover:bg-bg-hover active:scale-[0.96]"
      >
        Download XLSX
      </a>
    </div>
  );
}
