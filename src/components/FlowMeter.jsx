import React from "react";
import { Battery, Home } from "lucide-react";

// A "flow meter": an animated conduit showing power running from the battery to the house.
// Particle speed scales with power; a digital readout shows the current flow rate.
export default function FlowMeter({ power = 0, from = "Battery", to = "Home" }) {
  const w = Math.max(0, power);
  const active = w > 0;
  // higher power => faster particles. clamp duration between ~0.6s (heavy) and ~2.5s (trickle)
  const dur = active ? Math.max(0.6, 2.5 - (w / 4000) * 1.9) : 0;
  const particles = [0, 1, 2, 3, 4];

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-3">
        {/* Battery end */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className="w-11 h-11 rounded-full border-2 flex items-center justify-center" style={{ borderColor: "hsl(var(--battery))", background: "hsl(var(--battery) / 0.1)" }}>
            <Battery className="w-5 h-5" style={{ color: "hsl(var(--battery))" }} />
          </div>
          <span className="text-xs font-semibold text-foreground">{from}</span>
        </div>

        {/* Conduit */}
        <div className="relative flex-1 h-12 flex items-center">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-3 rounded-full bg-muted/60 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, (w / 4000) * 100)}%`,
                background: "hsl(var(--battery))",
                opacity: active ? 0.85 : 0.2,
              }}
            />
            {/* traveling particles */}
            {active &&
              particles.map((i) => (
                <span
                  key={i}
                  className="absolute top-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    left: "-6px",
                    width: 10,
                    height: 10,
                    background: "hsl(var(--battery))",
                    opacity: 0.9,
                    animation: `flowmove ${dur}s linear infinite`,
                    animationDelay: `${(dur / particles.length) * i}s`,
                  }}
                />
              ))}
          </div>
          <style>{`@keyframes flowmove { from { left: -6px; } to { left: calc(100% - 4px); } }`}</style>
        </div>

        {/* House end */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className="w-11 h-11 rounded-full border-2 flex items-center justify-center" style={{ borderColor: "hsl(var(--home))", background: "hsl(var(--home) / 0.1)" }}>
            <Home className="w-5 h-5" style={{ color: "hsl(var(--home))" }} />
          </div>
          <span className="text-xs font-semibold text-foreground">{to}</span>
        </div>
      </div>

      {/* Digital readout */}
      <div className="mt-3 flex items-center justify-center">
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 border"
          style={{
            borderColor: active ? "hsl(var(--battery))" : "hsl(var(--border))",
            background: active ? "hsl(var(--battery) / 0.08)" : "transparent",
          }}
        >
          <span className="text-xs text-muted-foreground">Flow</span>
          <span className="text-lg font-heading font-bold tabular-nums" style={{ color: active ? "hsl(var(--battery))" : "hsl(var(--muted-foreground))" }}>
            {Math.round(w)} W
          </span>
          <span className="text-xs text-muted-foreground">{active ? "→ supplying" : "idle"}</span>
        </div>
      </div>
    </div>
  );
}