"use client";

import { useEffect, useRef, useState } from "react";

/** Animates a formatted numeric string from 0 to its target on mount/change.
    Parses the leading numeric run out of the formatted value (e.g. "₹38.9 Cr",
    "37.3%", "160") and tweens just that run, keeping prefix/suffix static so the
    unit never flickers mid-count. Falls back to rendering the value as-is for
    non-numeric strings ("—", etc). */
export function CountUp({ value, durationMs = 700 }: { value: string; durationMs?: number }) {
  const match = value.match(/^([^\d-]*)(-?[\d,]*\.?\d+)(.*)$/);
  const [display, setDisplay] = useState(value);
  const frame = useRef<number | null>(null);
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (!match || reduceMotion.current) {
      setDisplay(value);
      return;
    }
    const [, prefix, numStr, suffix] = match;
    const target = parseFloat(numStr.replace(/,/g, ""));
    const decimals = numStr.includes(".") ? numStr.split(".")[1].length : 0;
    const start = performance.now();

    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = target * eased;
      setDisplay(prefix + current.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    }
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{display}</>;
}
