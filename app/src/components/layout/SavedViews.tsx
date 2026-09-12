"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { deleteView, getServerSnapshot, getSnapshot, saveView, subscribe } from "@/lib/savedViews";

export function SavedViews({ screenLabel }: { screenLabel: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const views = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  const currentPath = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  function save() {
    const finalName = name.trim() || screenLabel;
    saveView(finalName, currentPath, screenLabel);
    setName("");
    setNaming(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-[7px] border border-line-hairline px-2.5 py-1.5 text-[12px] text-ink-muted hover:bg-bg-hover"
      >
        <span aria-hidden="true">☆</span>
        <span>Views</span>
        {views.length > 0 && (
          <span className="rounded-full bg-bg-hover px-1.5 text-[10px] text-ink-tertiary">{views.length}</span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+4px)] z-40 w-72 rounded-[8px] border border-line-hairline bg-bg-card py-1.5 text-[12px] shadow-[0_12px_30px_oklch(0.08_0.006_75_/_0.6)]">
            {views.length === 0 && (
              <p className="px-3 py-2 text-[11.5px] text-ink-muted">No saved views yet.</p>
            )}
            {views.map((v) => (
              <div key={v.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-bg-hover">
                <button
                  type="button"
                  onClick={() => {
                    router.push(v.path);
                    setOpen(false);
                  }}
                  className="min-w-0 flex-1 truncate text-left text-ink-primary"
                >
                  {v.name}
                  <span className="ml-1.5 text-[10px] text-ink-muted">{v.screenLabel}</span>
                </button>
                <button
                  type="button"
                  onClick={() => deleteView(v.id)}
                  aria-label={`Delete view ${v.name}`}
                  className="text-ink-muted hover:text-critical"
                >
                  ✕
                </button>
              </div>
            ))}

            <div className="mt-1 border-t border-line-hairline px-3 pt-2">
              {naming ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && save()}
                    placeholder={screenLabel}
                    className="w-full rounded border border-line-hairline bg-bg-recessed px-2 py-1 text-ink-primary outline-none"
                  />
                  <button type="button" onClick={save} className="text-accent">
                    Save
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setNaming(true)} className="text-accent hover:underline">
                  + Save current view
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
