/** Tiny inline trend line — momentum at a glance in a table row, without opening
    the detail page. Pure SVG, no charting library needed for something this small. */
export function Sparkline({
  values,
  width = 64,
  height = 20,
  tone = "default",
}: {
  values: number[];
  width?: number;
  height?: number;
  tone?: "default" | "critical" | "healthy";
}) {
  if (values.length < 2) return <div style={{ width, height }} />;
  const max = Math.max(...values, 0.0001);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(" ");
  const stroke =
    tone === "critical" ? "var(--critical)" : tone === "healthy" ? "var(--healthy)" : "var(--accent)";
  const last = values[values.length - 1];
  const lastY = height - ((last - min) / range) * height;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={width} cy={lastY} r={2} fill={stroke} />
    </svg>
  );
}
