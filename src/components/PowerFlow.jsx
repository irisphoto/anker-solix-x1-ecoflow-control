import React from "react";
import { Sun, Home, Battery, Cable } from "lucide-react";

function FlowArrow({ from, to, power, color, active }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0 || power <= 0) return null;
  const ux = dx / len;
  const uy = dy / len;
  const sx = from.x + ux * 36;
  const sy = from.y + uy * 36;
  const ex = to.x - ux * 36;
  const ey = to.y - uy * 36;
  const width = Math.min(10, 2 + power / 250);
  return (
    <line
      x1={sx}
      y1={sy}
      x2={ex}
      y2={ey}
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeDasharray="6 6"
      opacity={active ? 0.9 : 0.3}
      style={{ animation: "dash 1s linear infinite" }}
    />
  );
}

export default function PowerFlow({ solar = 0, home = 0, battery = 0, grid = 0 }) {
  const solarPos = { x: 150, y: 40 };
  const batteryPos = { x: 40, y: 200 };
  const homePos = { x: 150, y: 200 };
  const gridPos = { x: 260, y: 200 };

  const batteryCharging = battery < 0;
  const batteryPower = Math.abs(battery);
  const gridImporting = grid > 0;
  const gridPower = Math.abs(grid);

  return (
    <div className="w-full flex justify-center">
      <svg viewBox="0 0 300 260" className="w-full max-w-sm">
        <defs>
          <marker id="arr" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
          </marker>
        </defs>
        <style>{`@keyframes dash { to { stroke-dashoffset: -12; } }`}</style>

        {/* Solar -> Home */}
        <FlowArrow from={solarPos} to={homePos} power={solar} color="hsl(38 92% 50%)" active={solar > 0} />
        {/* Home -> Battery (charging) or Battery -> Home (discharging) */}
        {batteryCharging ? (
          <FlowArrow from={homePos} to={batteryPos} power={batteryPower} color="hsl(152 62% 40%)" active={batteryPower > 0} />
        ) : (
          <FlowArrow from={batteryPos} to={homePos} power={batteryPower} color="hsl(152 62% 40%)" active={batteryPower > 0} />
        )}
        {/* Grid <-> Home */}
        {gridImporting ? (
          <FlowArrow from={gridPos} to={homePos} power={gridPower} color="hsl(217 91% 55%)" active={gridPower > 0} />
        ) : (
          <FlowArrow from={homePos} to={gridPos} power={gridPower} color="hsl(217 91% 55%)" active={gridPower > 0} />
        )}

        {/* Nodes */}
        <Node pos={solarPos} icon={Sun} label="Solar" value={`${Math.round(solar)} W`} color="hsl(38 92% 50%)" />
        <Node pos={batteryPos} icon={Battery} label="Battery" value={batteryCharging ? "charging" : "discharging"} color="hsl(152 62% 40%)" />
        <Node pos={homePos} icon={Home} label="Home" value={`${Math.round(home)} W`} color="hsl(var(--foreground))" />
        <Node pos={gridPos} icon={Cable} label="Grid" value={gridImporting ? "import" : "export"} color="hsl(217 91% 55%)" />
      </svg>
    </div>
  );
}

function Node({ pos, icon: Icon, label, value, color }) {
  return (
    <g>
      <circle cx={pos.x} cy={pos.y} r={30} fill="hsl(var(--card))" stroke={color} strokeWidth={2} />
      <foreignObject x={pos.x - 12} y={pos.y - 12} width={24} height={24}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100%", height: "100%" }}>
          <Icon style={{ width: 18, height: 18, color }} />
        </div>
      </foreignObject>
      <text x={pos.x} y={pos.y + 48} textAnchor="middle" className="fill-foreground" style={{ fontSize: 12, fontWeight: 600 }}>
        {label}
      </text>
      <text x={pos.x} y={pos.y + 62} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 10 }}>
        {value}
      </text>
    </g>
  );
}