"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { routeHref } from "@/lib/routes";
import { useEscapeClose } from "@/lib/useEscapeClose";
import type { Route } from "@/lib/domain/types";

interface WhyPoint {
  text: string;
  value: string;
}
interface WhyResult {
  title: string;
  points: WhyPoint[];
  cta: { label: string; route: Route };
}

const WhyPopoverContext = createContext<((kpiKey: string) => void) | null>(null);

/** Every WhyButton on a screen calls into this one instance instead of
 * keeping its own open/closed state — that's what used to let someone open
 * "Why?" on several KPI cards in a row and end up with several popovers
 * piled on top of each other. With a single shared popover, opening a new
 * one always replaces whatever was open. */
export function useWhyPopover() {
  const openWhy = useContext(WhyPopoverContext);
  if (!openWhy) throw new Error("useWhyPopover must be used within WhyPopoverProvider");
  return openWhy;
}

export function WhyPopoverProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WhyResult | null>(null);

  const close = useCallback(() => {
    setActiveKey(null);
    setResult(null);
  }, []);
  useEscapeClose(close);

  const openWhy = useCallback(
    async (kpiKey: string) => {
      setActiveKey(kpiKey);
      setLoading(true);
      setResult(null);
      try {
        const res = await fetch("/api/why", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: kpiKey,
            range: searchParams.get("range") || "all",
            branch: searchParams.get("branch") || undefined,
          }),
        });
        setResult(await res.json());
      } finally {
        setLoading(false);
      }
    },
    [searchParams],
  );

  return (
    <WhyPopoverContext.Provider value={openWhy}>
      {children}
      {activeKey && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Why explanation"
          className="dp-scrim fixed inset-0 z-50 flex items-center justify-center bg-bg-scrim px-4 backdrop-blur-[2px]"
          onClick={close}
        >
          <div
            className="dp-pop w-full max-w-[440px] overflow-hidden rounded-[16px] border border-line-hairline bg-bg-card shadow-[0_24px_60px_oklch(0.08_0.006_75_/_0.4)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dp-ai-surface flex items-center gap-2 border-b px-5 py-3.5">
              <span aria-hidden="true" className="inline-block h-3 w-3 shrink-0 rotate-45 rounded-[2px] bg-accent" />
              <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-accent">Why</span>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-bg-hover"
              >
                ✕
              </button>
            </div>
            <div className="p-5">
              {loading && <div className="dp-shimmer h-32 rounded-[10px] bg-bg-recessed" aria-busy="true" />}
              {!loading && result && (
                <>
                  <div className="mb-4 text-[16px] font-semibold leading-snug text-ink-primary">
                    {result.title}
                  </div>
                  <ul className="space-y-2.5 rounded-[10px] bg-bg-recessed p-3.5">
                    {result.points.map((p, i) => (
                      <li key={i} className="flex items-start justify-between gap-3 text-[12.5px]">
                        <span className="text-ink-secondary">{p.text}</span>
                        <span className="shrink-0 font-mono text-ink-primary">{p.value}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => {
                      router.push(routeHref(result.cta.route, searchParams.get("range")));
                      close();
                    }}
                    className="mt-4 w-full rounded-[9px] bg-accent px-3 py-2.5 text-[13px] font-semibold text-accent-fill-text transition-transform active:scale-[0.98]"
                  >
                    {result.cta.label}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </WhyPopoverContext.Provider>
  );
}
