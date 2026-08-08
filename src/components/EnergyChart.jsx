import React from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

export default function EnergyChart({ data = [], height = 280 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="gSolar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(38 92% 50%)" stopOpacity={0.4} />
            <stop offset="95%" stopColor="hsl(38 92% 50%)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gHome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--foreground))" stopOpacity={0.25} />
            <stop offset="95%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gGrid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(217 91% 55%)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="hsl(217 91% 55%)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gBatt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(152 62% 40%)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="hsl(152 62% 40%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(h) => `${h}:00`} />
        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} unit="W" />
        <Tooltip
          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
          labelFormatter={(h) => `${h}:00`}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="solar_power_w" name="Solar" stroke="hsl(38 92% 50%)" fill="url(#gSolar)" strokeWidth={2} />
        <Area type="monotone" dataKey="home_usage_w" name="Home" stroke="hsl(var(--foreground))" fill="url(#gHome)" strokeWidth={2} />
        <Area type="monotone" dataKey="battery_power_w" name="Battery" stroke="hsl(152 62% 40%)" fill="url(#gBatt)" strokeWidth={2} />
        <Area type="monotone" dataKey="grid_power_w" name="Grid" stroke="hsl(217 91% 55%)" fill="url(#gGrid)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}