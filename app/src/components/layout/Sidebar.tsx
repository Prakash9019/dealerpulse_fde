"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

const NAV = [
  { href: "/", mark: "OV", label: "Overview" },
  { href: "/branches", mark: "BR", label: "Branches" },
  { href: "/reps", mark: "RP", label: "Reps" },
  { href: "/actions", mark: "AC", label: "Action Center" },
  { href: "/funnel", mark: "FN", label: "Funnel" },
  { href: "/compare", mark: "CP", label: "Compare" },
  { href: "/weekly", mark: "WK", label: "Weekly" },
  { href: "/docs", mark: "DC", label: "Docs" },
  { href: "/about", mark: "AB", label: "About" },
];

const STORAGE_KEY = "dp-sidebar-collapsed";
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

// The server has no localStorage, so it always renders expanded; the real
// value is applied via useSyncExternalStore right after hydration, which is
// the pattern React itself endorses for this exact server/client divergence
// (unlike an effect-based setState, this cannot throw a hydration-mismatch error).
function getServerSnapshot() {
  return false;
}

function setCollapsed(next: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    // localStorage unavailable — toggle still works for this render, just not persisted
  }
  listeners.forEach((l) => l());
}

export function Sidebar({ datasetScope }: { datasetScope: string }) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    setCollapsed(!collapsed);
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const expandedClass = collapsed ? "" : "lg:w-[236px] lg:px-3";

  return (
    <nav
      aria-label="Main"
      className={`no-print hidden md:flex w-[62px] ${expandedClass} shrink-0 flex-col overflow-hidden bg-bg-rail border-r border-line-hairline px-2 py-4 gap-1 transition-[width] duration-200 ease-out`}
    >
      <div className="flex items-center gap-2 px-1 mb-4">
        <span aria-hidden="true" className="relative inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-accent">
          <span className="h-[7px] w-[7px] rotate-45 rounded-[1px] bg-bg-rail" />
        </span>
        <span
          className={`text-[15px] font-semibold text-ink-primary tracking-tight transition-opacity duration-150 ${
            collapsed ? "hidden opacity-0" : "hidden lg:inline lg:opacity-100"
          }`}
        >
          DealerPulse
        </span>
      </div>

      {NAV.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex items-center gap-2.5 rounded-[7px] px-[9px] py-[10px] text-[13.5px] font-medium transition-[background-color,color,transform] duration-150 active:scale-[0.97] ${
              active
                ? "bg-[oklch(0.265_0.012_200)] text-ink-primary"
                : "text-ink-tertiary hover:translate-x-0.5 hover:bg-bg-hover"
            }`}
          >
            {/* Colored active-tab indicator — the sidebar was otherwise
                monochrome except for the mark text, so the current section
                had no color signal of its own. */}
            {active && (
              <span aria-hidden="true" className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-accent" />
            )}
            <span
              aria-hidden="true"
              className={`w-4 shrink-0 font-mono text-[9.5px] transition-colors duration-150 ${active ? "text-accent" : ""}`}
            >
              {item.mark}
            </span>
            <span
              className={`truncate transition-opacity duration-150 ${
                collapsed ? "sr-only" : "sr-only lg:not-sr-only lg:inline"
              }`}
            >
              {item.label}
            </span>
          </Link>
        );
      })}

      <div
        className={`mt-auto pt-4 border-t border-line-hairline text-[11px] leading-relaxed text-ink-muted ${
          collapsed ? "hidden" : "hidden lg:block"
        }`}
      >
        <div className="mb-1 font-mono text-[9.5px] tracking-[0.08em] text-ink-muted">
          DATASET
        </div>
        <div>5 branches · 30 reps</div>
        <div>{datasetScope}</div>
      </div>

      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={`mt-2 flex items-center justify-center rounded-[7px] py-1.5 text-ink-muted hover:bg-bg-hover hover:text-ink-primary ${collapsed ? "" : "hidden lg:flex"}`}
      >
        <span aria-hidden="true" className="font-mono text-[11px]">
          {collapsed ? "»" : "«"}
        </span>
      </button>
    </nav>
  );
}
