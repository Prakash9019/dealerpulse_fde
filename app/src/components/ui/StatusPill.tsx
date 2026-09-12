const STYLES: Record<string, string> = {
  critical: "bg-critical-bg text-critical-fg",
  watch: "bg-warning-bg text-warning-fg",
  healthy: "bg-healthy-bg text-healthy-fg",
  onTrack: "bg-neutral-bg text-neutral-fg",
  attention: "bg-warning-bg text-warning-fg",
};

const LABELS: Record<string, string> = {
  critical: "Critical",
  watch: "Watch",
  healthy: "Healthy",
  onTrack: "On track",
  attention: "Needs attention",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-[4px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] ${STYLES[status] || STYLES.onTrack}`}
    >
      {LABELS[status] || status}
    </span>
  );
}
