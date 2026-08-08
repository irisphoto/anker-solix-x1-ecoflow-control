import React from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Leaf, Zap, Loader2 } from "lucide-react";

// Economy = time_of_use (cheap grid hours), Performance = self_use (max self-consumption)
const MODES = {
  economy: { key: "time_of_use", label: "Economy", icon: Leaf, blurb: "Prioritises cheap off-peak grid hours" },
  performance: { key: "self_use", label: "Performance", icon: Zap, blurb: "Maximum self-use of solar & battery" },
};

export default function QuickModeSwitch({ device, onApplied }) {
  const [busy, setBusy] = React.useState(null);
  const [msg, setMsg] = React.useState(null);

  const apply = async (mode) => {
    setBusy(mode);
    setMsg(null);
    try {
      const res = await base44.functions.invoke("setDeviceParam", {
        device_id: device.id,
        charging_mode: MODES[mode].key,
      });
      if (res.data && (res.data.success !== false)) {
        setMsg({ ok: true, text: `Switched to ${MODES[mode].label} mode.` });
        onApplied?.(res.data.applied);
      } else {
        setMsg({ ok: false, text: res.data?.error || res.data?.remote_error || "Couldn't switch mode." });
      }
    } catch (e) {
      setMsg({ ok: false, text: e.message || "Couldn't switch mode." });
    }
    setBusy(null);
  };

  const activeKey = MODES[device.charging_mode === "time_of_use" ? "economy" : "performance"]?.key;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Quick Mode</CardTitle>
      </CardHeader>
      <CardContent className="pt-1 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(MODES).map(([mode, m]) => {
            const Icon = m.icon;
            const isActive = device.charging_mode === m.key;
            const isBusy = busy === mode;
            return (
              <Button
                key={mode}
                variant={isActive ? "default" : "outline"}
                className="h-auto flex-col items-start gap-1 py-3"
                disabled={!!busy}
                onClick={() => apply(mode)}
              >
                <span className="flex items-center justify-between w-full gap-2">
                  <span className="flex items-center gap-2">
                    {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4 shrink-0" />}
                    <span className="font-heading font-semibold">{m.label}</span>
                  </span>
                  {isActive && <span className="text-[10px] font-semibold uppercase tracking-wide shrink-0">Active</span>}
                </span>
                <span className="text-[11px] font-normal text-left opacity-80 leading-snug">{m.blurb}</span>
              </Button>
            );
          })}
        </div>
        {msg && (
          <div className={`text-xs rounded-md p-2 ${msg.ok ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
            {msg.text}
          </div>
        )}
      </CardContent>
    </Card>
  );
}