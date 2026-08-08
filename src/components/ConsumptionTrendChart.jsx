import React from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export default function ConsumptionTrendChart({ data = [], height = 280 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="gTrend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(280 65% 55%)" stopOpacity={0.4} />
            <stop offset="95%" stopColor="hsl(280 65% 55%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} minTickGap={24} />
        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} unit="kWh" width={56} />
        <Tooltip
          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
          formatter={(v) => [`${Number(v).toFixed(2)} kWh`, "Import"]}
        />
        <Area type="monotone" dataKey="kwh" name="Import" stroke="hsl(280 65% 55%)" fill="url(#gTrend)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}