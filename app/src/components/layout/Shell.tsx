"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { RangeControl } from "./RangeControl";
import { AskDealerPulse } from "../overlays/AskDealerPulse";
import { AskFab } from "./AskFab";
import { WhyPopoverProvider } from "../ui/WhyPopoverProvider";
import { CommandPalette } from "../overlays/CommandPalette";
import { KeyboardShortcutsPanel } from "../overlays/KeyboardShortcutsPanel";
import { SavedViews } from "./SavedViews";
import { Select } from "../ui/Select";
import type { RANGE_PRESETS } from "@/lib/analytics/context";

export interface ShellBranch {
  id: string;
  name: string;
}

export interface ShellRep {
  id: string;
  name: string;
  branchId: string;
}

export function Shell({
  children,
  branches,
  reps,
  asOfLabel,
  scopeLabel,
  screenTitle,
  screenSubtitle,
  rangePresets,
}: {
  children: React.ReactNode;
  branches: ShellBranch[];
  reps?: ShellRep[];
  asOfLabel: string;
  scopeLabel: string;
  screenTitle: string;
  screenSubtitle?: string;
  rangePresets: typeof RANGE_PRESETS;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [askOpen, setAskOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        setAskOpen(true);
      } else if (e.key === "Escape") {
        setAskOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function setParam(key: string, value: string) {
    const qs = new URLSearchParams(searchParams.toString());
    if (value) qs.set(key, value);
    else qs.delete(key);
    router.push(`${pathname}?${qs.toString()}`);
  }

  const selectedBranch = searchParams.get("branch") || "";
  const repsInScope = (reps ?? []).filter((r) => !selectedBranch || r.branchId === selectedBranch);

  function setBranch(value: string) {
    const qs = new URLSearchParams(searchParams.toString());
    if (value) qs.set("branch", value);
    else qs.delete("branch");
    const currentRep = searchParams.get("rep");
    if (currentRep && value && !(reps ?? []).some((r) => r.id === currentRep && r.branchId === value)) {
      qs.delete("rep");
    }
    router.push(`${pathname}?${qs.toString()}`);
  }

  return (
    <WhyPopoverProvider>
    <div className="flex min-h-screen bg-bg-app">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <header className="no-print sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-line-hairline bg-bg-topbar px-4 py-3 backdrop-blur-sm">
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold tracking-tight text-ink-primary truncate">
              {screenTitle}
            </h1>
            {screenSubtitle && (
              <div className="text-[11.5px] text-ink-muted truncate">{screenSubtitle}</div>
            )}
          </div>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("dp:open-command-palette"))}
            aria-label="Open command palette"
            className="dp-card-hover ml-auto flex items-center gap-1.5 rounded-[7px] border border-line-hairline px-2.5 py-1.5 text-[12px] text-ink-muted"
          >
            <span>Search</span>
            <span className="rounded border border-line-strong px-1 font-mono text-[9.5px]">⌘K</span>
          </button>

          <button
            type="button"
            onClick={() => setAskOpen(true)}
            className="dp-card-hover flex min-w-[210px] items-center gap-2 rounded-[7px] border border-accent-tint-border bg-accent-tint-bg px-3 py-1.5 text-left"
          >
            <span aria-hidden="true" className="dp-ai-mark inline-block h-3 w-3 rotate-45 rounded-[2px] bg-accent shrink-0" />
            <span className="text-[13px] text-ink-secondary">Ask DealerPulse…</span>
            <span className="ml-auto rounded border border-line-strong px-1 font-mono text-[9.5px] text-ink-muted">
              /
            </span>
          </button>

          <RangeControl rangePresets={rangePresets} />

          <div className="flex items-center gap-1.5 text-[12px]">
            <span className="font-mono text-[9.5px] tracking-[0.06em] text-ink-muted">
              BRANCH
            </span>
            <Select
              ariaLabel="Branch"
              value={selectedBranch}
              onChange={setBranch}
              options={[{ key: "", label: "All branches" }, ...branches.map((b) => ({ key: b.id, label: b.name }))]}
            />
          </div>

          {reps && reps.length > 0 && (
            <div className="flex items-center gap-1.5 text-[12px]">
              <span className="font-mono text-[9.5px] tracking-[0.06em] text-ink-muted">REP</span>
              <Select
                ariaLabel="Rep"
                value={searchParams.get("rep") || ""}
                onChange={(v) => setParam("rep", v)}
                options={[{ key: "", label: "All reps" }, ...repsInScope.map((r) => ({ key: r.id, label: r.name }))]}
              />
            </div>
          )}

          <SavedViews screenLabel={screenTitle} />

          <button
            type="button"
            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }))}
            aria-label="Show keyboard shortcuts"
            title="Keyboard shortcuts"
            className="flex items-center justify-center rounded-[7px] border border-line-hairline px-2 py-1.5 text-[12px] text-ink-muted hover:bg-bg-hover"
          >
            ?
          </button>

          <div className="flex items-center gap-1.5 rounded-full border border-line-hairline px-2.5 py-1 text-[11.5px] text-ink-tertiary">
            <span className="h-1.5 w-1.5 rounded-full bg-healthy" />
            Data as of {asOfLabel}
          </div>
        </header>

        {/* dp-in fades/rises the whole page in on mount — each route mounts
            a fresh Shell, so this fires on every navigation, replacing what
            was previously a hard jump-cut between screens. Keyed on
            pathname so React treats a route change as a fresh mount and
            re-triggers the animation instead of reusing the same DOM node. */}
        <main key={pathname} className="dp-in mx-auto w-full max-w-[2000px] flex-1 px-4 py-6 lg:px-6">
          {children}
        </main>
      </div>

      {askOpen ? (
        <AskDealerPulse onClose={() => setAskOpen(false)} />
      ) : (
        // Floating launcher, docked to the right edge — the trigger itself
        // lives where the chat panel opens, not just up in the header. It's
        // icon-only (the header pill already spells out "Ask DealerPulse…")
        // and vertically draggable so it can be moved out of the way of
        // whatever it's covering.
        <AskFab onOpen={() => setAskOpen(true)} />
      )}
      <CommandPalette />
      <KeyboardShortcutsPanel />
    </div>
    </WhyPopoverProvider>
  );
}
