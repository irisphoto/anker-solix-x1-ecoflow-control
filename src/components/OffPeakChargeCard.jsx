import React from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { MoonStar, Loader2, Zap, BatteryCharging, Car, CheckCircle2 } from "lucide-react";

const TIMEZONE = "Europe/London";

function toMin(hhmm) {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function currentMinutes() {
  const s = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date());
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}
function inWindow(cur, startStr, endStr) {
  const s = toMin(startStr), e = toMin(endStr);
  if (s === e) return false;
  if (s < e) return cur >= s && cur < e;
  return cur >= s || cur < e;
}

export default function OffPeakChargeCard({ tariff, schedule, updateSchedule, ensureSchedule, device }) {
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [targetInput, setTargetInput] = React.useState(
    schedule && schedule.off_peak_target_soc != null ? String(schedule.off_peak_target_soc) : "100"
  );

  const storedTarget = schedule && schedule.off_peak_target_soc != null ? schedule.off_peak_target_soc : 100;
  React.useEffect(() => {
    setTargetInput(String(storedTarget));
  }, [storedTarget]);

  const [capInput, setCapInput] = React.useState(String(schedule?.off_peak_capacity_w ?? 7400));
  const [altInput, setAltInput] = React.useState(String(schedule?.off_peak_alternating_target_soc ?? 50));
  const storedCap = schedule?.off_peak_capacity_w ?? 7400;
  const storedAlt = schedule?.off_peak_alternating_target_soc ?? 50;
  React.useEffect(() => { setCapInput(String(storedCap)); }, [storedCap]);
  React.useEffect(() => { setAltInput(String(storedAlt)); }, [storedAlt]);

  const loadBalance = schedule?.off_peak_load_balance || "none";

  const onStrategy = async (v) => {
    const s = schedule || (await ensureSchedule());
    if (!s) return;
    await updateSchedule("off_peak_load_balance", v);
  };
  const onCapBlur = async () => {
    const s = schedule || (await ensureSchedule());
    if (!s) return;
    const val = Number(capInput);
    if (!isNaN(val) && val > 0) await updateSchedule("off_peak_capacity_w", val);
  };
  const onAltBlur = async () => {
    const s = schedule || (await ensureSchedule());
    if (!s) return;
    const val = Number(altInput);
    if (!isNaN(val) && val >= 10 && val <= 100) await updateSchedule("off_peak_alternating_target_soc", val);
  };

  const enabled = !!(schedule && schedule.off_peak_charge_enabled);
  const hasOffPeak = !!(tariff && tariff.has_off_peak);
  const inOffPeak = hasOffPeak && inWindow(currentMinutes(), tariff.off_peak_start, tariff.off_peak_end);
  const batteryLevel = Number(device?.battery_level || 0);
  const targetSoc = Number(storedTarget || 100);
  const belowTarget = batteryLevel < targetSoc;
  const wouldCharge = enabled && inOffPeak && belowTarget;

  const onToggle = async (v) => {
    const s = schedule || (await ensureSchedule());
    if (!s) return;
    await updateSchedule("off_peak_charge_enabled", v);
  };

  const onTargetBlur = async () => {
    const s = schedule || (await ensureSchedule());
    if (!s) return;
    const val = Number(targetInput);
    if (!isNaN(val) && val >= 10 && val <= 100) await updateSchedule("off_peak_target_soc", val);
  };

  const runNow = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke("autoOffPeakCharge", {});
      setResult(res.data);
    } catch (e) {
      setResult({ error: e.message });
    }
    setRunning(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <MoonStar className="w-4 h-4 text-grid" /> Off-Peak Battery Charging
            </CardTitle>
            <CardDescription>
              Tops up the battery from the grid during your off-peak tariff window, so "Charge EV now (battery-first)" runs on cheap stored energy.
            </CardDescription>
          </div>
          <Switch checked={enabled} onCheckedChange={onToggle} aria-label="Enable off-peak battery charging" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasOffPeak ? (
          <div className="text-sm rounded-lg p-3 bg-muted/40 text-muted-foreground">
            Enable an off-peak rate and set its window in the Electricity Tariff card below to use this rule.
          </div>
        ) : (
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Off-peak window</Label>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-semibold">{tariff.off_peak_start}–{tariff.off_peak_end}</span>
              </div>
              <Badge variant={inOffPeak ? "default" : "outline"} className="text-[10px]">
                {inOffPeak ? "Active now" : "Outside window"}
              </Badge>
            </div>
            <div className="space-y-1">
              <Label>Off-peak rate</Label>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-semibold">{Number(tariff.off_peak_rate ?? 0).toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">p/kWh</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Battery now</Label>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-semibold">{Math.round(batteryLevel)}%</span>
                <span className="text-xs text-muted-foreground">/ target {Math.round(targetSoc)}%</span>
              </div>
              <div className="text-[11px] text-muted-foreground">{belowTarget ? "below target — needs charge" : "at or above target"}</div>
            </div>
          </div>
        )}

        <div className="space-y-1">
          <Label>Target state-of-charge ({targetInput}%)</Label>
          <input
            type="range" min={10} max={100} step={5}
            value={targetInput}
            disabled={!schedule}
            onChange={(e) => setTargetInput(e.target.value)}
            onBlur={onTargetBlur}
            className="w-full accent-grid"
          />
          <p className="text-[11px] text-muted-foreground">Stop grid-charging once the battery reaches this level.</p>
        </div>

        <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-solar" />
            <span className="text-sm font-medium">Load balancing with EV charging</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "none", label: "Off (battery full)" },
              { value: "defer_battery", label: "Defer battery" },
              { value: "ev_half_share", label: "Split via HA" },
              { value: "alternating", label: "Alternating" },
            ].map((o) => (
              <Button
                key={o.value}
                size="sm"
                variant={loadBalance === o.value ? "default" : "outline"}
                onClick={() => onStrategy(o.value)}
              >
                {o.label}
              </Button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {loadBalance === "defer_battery" && "Pauses battery grid-charging while the EV is drawing power, then resumes once it stops."}
            {loadBalance === "ev_half_share" && "Keeps the battery charging and tells Home Assistant to cap the EV at half your off-peak capacity. Add HA-side current limiting that reads max_charge_power_w from the webhook."}
            {loadBalance === "alternating" && "Battery grid-charges to a lower target first, then stops so the EV gets full capacity for the rest of the window."}
            {loadBalance === "none" && "Battery charges at full rate; no coordination with EV charging."}
          </p>
          {(loadBalance === "ev_half_share" || loadBalance === "alternating") && (
            <div className="grid sm:grid-cols-2 gap-4">
              {loadBalance === "ev_half_share" && (
                <div className="space-y-1">
                  <Label>Off-peak capacity (W)</Label>
                  <Input
                    type="number" min="0" step="100" value={capInput}
                    disabled={!schedule}
                    onChange={(e) => setCapInput(e.target.value)}
                    onBlur={onCapBlur}
                  />
                  <p className="text-[11px] text-muted-foreground">EV is capped at half of this while the battery also charges.</p>
                </div>
              )}
              {loadBalance === "alternating" && (
                <div className="space-y-1">
                  <Label>Battery split target ({altInput}%)</Label>
                  <input
                    type="range" min={10} max={90} step={5}
                    value={altInput}
                    disabled={!schedule}
                    onChange={(e) => setAltInput(e.target.value)}
                    onBlur={onAltBlur}
                    className="w-full accent-solar"
                  />
                  <p className="text-[11px] text-muted-foreground">Battery charges to this, then the EV gets the rest of the window.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={runNow} disabled={running || !schedule || !hasOffPeak}>
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BatteryCharging className="w-4 h-4 mr-2" />}
            {running ? "Checking…" : "Run rule now"}
          </Button>
          {enabled ? (
            wouldCharge ? (
              <span className="flex items-center gap-1.5 text-sm text-primary font-medium">
                <Zap className="w-4 h-4" /> Charging the battery from the grid now
              </span>
            ) : inOffPeak ? (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4" /> Battery already at target
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Waiting for the off-peak window</span>
            )
          ) : (
            <span className="text-sm text-muted-foreground">Rule disabled</span>
          )}
          {schedule && schedule.off_peak_last_checked && (
            <span className="text-xs text-muted-foreground">
              Last checked {new Date(schedule.off_peak_last_checked).toLocaleString("en-GB", { timeZone: TIMEZONE })}
            </span>
          )}
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-muted/40 border p-3">
          <Car className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground">
            Pairs with <b>EV Price-Triggered Charging</b> above: this rule fills the battery cheaply overnight, then "Charge EV now (battery-first)" draws from that stored energy instead of peak-rate grid power. It runs automatically every 30 minutes via the <b>Auto Off-Peak Charge</b> workflow.
          </p>
        </div>

        {result && result.error && (
          <div className="text-sm rounded-lg p-3 bg-destructive/10 text-destructive">{result.error}</div>
        )}
        {result && result.success && (
          <div className="text-sm rounded-lg p-3 bg-primary/10 text-primary">
            {result.action === "disabled"
              ? "Rule is disabled — enable it to auto-charge."
              : result.applied
                ? `Applied: ${result.action === "time_of_use" ? "started grid-charging the battery" : "reverted to self-use"}${result.in_off_peak ? " during off-peak" : ""}. Battery ${Math.round(Number(result.battery_level))}% → target ${Math.round(Number(result.target_soc))}%.`
                : result.skipped
                  ? `No change — already ${result.action === "time_of_use" ? "charging" : "self-use"}${result.in_off_peak ? " in off-peak" : ""}.`
                  : `Off-peak ${result.in_off_peak ? "active" : "inactive"} — ${result.should_charge ? "would charge" : "would wait"}.`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}