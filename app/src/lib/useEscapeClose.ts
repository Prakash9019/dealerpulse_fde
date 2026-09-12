"use client";

import { useEffect } from "react";

/** Closes an overlay on Escape. All modals/drawers in the product close this way. */
export function useEscapeClose(onClose: () => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}
