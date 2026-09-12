"use client";

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyTrendRow } from "@/lib/analytics/trends";
import { fmtINR } from "@/lib/format";

export function MonthlyChart({ trend }: { trend: MonthlyTrendRow[] }) {
  const data = trend.map((m) => ({
    label: m.label,
    units: m.units,
    revenueCr: m.revenue / 1e7,
    target: m.targetUnits,
  }));

  return (
    <div className="dp-in h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            {/* Gradient fills instead of flat color — bars taper to
                transparent at the base, and the revenue line gets a soft
                glow of fill beneath it, both reusing the existing tokens so
                this stays on-theme rather than introducing new colors. */}
            <linearGradient id="dpBarFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--bar-fill-emphasis)" stopOpacity={0.95} />
              <stop offset="100%" stopColor="var(--bar-fill-recessive)" stopOpacity={0.55} />
            </linearGradient>
            <linearGradient id="dpRevenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--line-row)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--ink-muted)", fontSize: 10.5 }}
            axisLine={{ stroke: "var(--line-hairline)" }}
            tickLine={false}
          />
          <YAxis
            yAxisId="units"
            tick={{ fill: "var(--ink-muted)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="revenue"
            orientation="right"
            tick={{ fill: "var(--ink-muted)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => v.toFixed(0) + "Cr"}
          />
          <Tooltip
            contentStyle={{
              background: "var(--bg-recessed)",
              border: "1px solid var(--line-hairline)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value, name) =>
              name === "revenueCr"
                ? [fmtINR(Number(value) * 1e7), "Revenue"]
                : [String(value), "Units"]
            }
          />
          {data.map((d, i) => (
            <ReferenceLine
              key={i}
              yAxisId="units"
              segment={[
                { x: d.label, y: d.target },
                { x: d.label, y: d.target },
              ]}
              stroke="var(--ink-faint)"
              strokeDasharray="3 3"
            />
          ))}
          <Bar
            yAxisId="units"
            dataKey="units"
            radius={[4, 4, 0, 0]}
            fill="url(#dpBarFill)"
          />
          <Area
            yAxisId="revenue"
            dataKey="revenueCr"
            stroke="none"
            fill="url(#dpRevenueFill)"
            legendType="none"
            tooltipType="none"
          />
          <Line
            yAxisId="revenue"
            dataKey="revenueCr"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--accent)" }}
            activeDot={{ r: 5, fill: "var(--accent)", stroke: "var(--bg-card)", strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
