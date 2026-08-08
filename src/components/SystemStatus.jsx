import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Sun, Cable, Zap } from "lucide-react";

export default function SystemStatus({ device }) {
  const solar = device?.solar_today_wh ?? 0;
  const grid = device?.grid_import_wh ?? 0;

  let mode;
  if (solar > grid && solar > 0) mode = "solar";
  else if (grid > solar && grid > 0) mode = "grid";
  else if (solar > 0 || grid > 0) mode = "mixed";
  else mode = "idle";

  const config = {
    solar: {
      icon: Sun,
      title: "Charging from solar",
      desc: `Generating ${solar.toLocaleString()} Wh today, ${grid.toLocaleString()} Wh from grid.`,
      color: "hsl(var(--solar))",
      bg: "hsl(var(--solar) / 0.12)",
    },
    grid: {
      icon: Cable,
      title: "Drawing from grid",
      desc: `${grid.toLocaleString()} Wh imported today, ${solar.toLocaleString()} Wh solar.`,
      color: "hsl(var(--grid))",
      bg: "hsl(var(--grid) / 0.12)",
    },
    mixed: {
      icon: Zap,
      title: "Solar + grid",
      desc: `${solar.toLocaleString()} Wh solar, ${grid.toLocaleString()} Wh grid today.`,
      color: "hsl(var(--primary))",
      bg: "hsl(var(--primary) / 0.12)",
    },
    idle: {
      icon: Zap,
      title: "No activity",
      desc: "No solar or grid energy recorded today yet.",
      color: "hsl(var(--muted-foreground))",
      bg: "hsl(var(--muted) / 0.5)",
    },
  }[mode];

  const Icon = config.icon;

  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: config.bg, color: config.color }}
        >
          <Icon className="w-6 h-6" />
        </div>
        <div className="min-w-0">
          <div className="text-base font-heading font-semibold text-foreground">{config.title}</div>
          <div className="text-sm text-muted-foreground">{config.desc}</div>
        </div>
      </CardContent>
    </Card>
  );
}