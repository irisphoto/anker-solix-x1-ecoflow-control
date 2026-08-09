import React from "react";

export default function BatteryGauge({ level = 0, size = 140, capacityWh = 0 }) {
  const pct = Math.max(0, Math.min(100, level));
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const color = pct > 60 ? "hsl(152 62% 40%)" : pct > 25 ? "hsl(38 92% 50%)" : "hsl(0 72% 50%)";

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={12} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.8s ease", filter: `drop-shadow(0 0 6px ${color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-heading font-bold text-foreground">{Math.round(pct)}%</span>
          <span className="text-[11px] text-muted-foreground">charged</span>
        </div>
      </div>
      {capacityWh > 0 && (
        <div className="text-xs text-muted-foreground mt-1">
          ~{Math.round((pct / 100) * capacityWh)} / {Math.round(capacityWh)} Wh
        </div>
      )}
    </div>
  );
}