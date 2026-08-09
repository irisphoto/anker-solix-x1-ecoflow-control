import React from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Car, Loader2, Zap, TrendingDown, ArrowDownToLine, BatteryCharging } from "lucide-react";

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
// Live applicable import price (p/kWh) from the active tariff + London time band.
function currentPrice(tariff) {
  if (!tariff) return { rate: null, band: null };
  const cur = currentMinutes();
  let rate = tariff.import_rate ?? 0;
  let band = "import";
  if (tariff.has_peak && inWindow(cur, tariff.peak_start, tariff.peak_end)) {
    rate = tariff.peak_rate ?? rate; band = "peak";
  } else if (tariff.has_off_peak && inWindow(cur, tariff.off_peak_start, tariff.off_peak_end)) {
    rate = tariff.off_peak_rate ?? rate; band = "off_peak";
  }
  return { rate, band };
}

const BAND_LABEL = { off_peak: "Off-peak", peak: "Peak", import: "Standard" };

export default function EvChargeRuleCard({ tariff, schedule, updateSchedule, ensureSchedule }) {
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [thresholdInput, setThresholdInput] = React.useState(
    schedule && schedule.ev_price_threshold_p != null ? String(schedule.ev_price_threshold_p) : "10"
  );

  const storedThreshold = schedule && schedule.ev_price_threshold_p != null ? schedule.ev_price_threshold_p : null;
  React.useEffect(() => {
    setThresholdInput(storedThreshold != null ? String(storedThreshold) : "10");
  }, [storedThreshold]);

  const enabled = !!(schedule && schedule.ev_auto_charge_enabled);
  const { rate, band } = currentPrice(tariff);
  const threshold = storedThreshold != null ? Number(storedThreshold) : null;
  const wouldCharge = enabled && threshold != null && rate != null && rate <= threshold;

  const onToggle = async (v) => {
    const s = schedule || (await ensureSchedule());
    if (!s) return;
    await updateSchedule("ev_auto_charge_enabled", v);
  };

  const onThresholdBlur = async () => {
    const s = schedule || (await ensureSchedule());
    if (!s) return;
    const val = Number(thresholdInput);
    if (!isNaN(val) && val >= 0) await updateSchedule("ev_price_threshold_p", val);
  };

  const runNow = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke("autoEvChargeRule", {});
      setResult(res.data);
    } catch (e) {
      setResult({ error: e.message });
    }
    setRunning(false);
  };

  const [charging, setCharging] = React.useState(false);
  const [chargeMsg, setChargeMsg] = React.useState(null);

  // Force the system into charging now, ignoring the price threshold.
  const chargeNow = async () => {
    if (!schedule || !schedule.device_id) {
      setChargeMsg({ ok: false, text: "No device linked to this schedule." });
      return;
    }
    setCharging(true);
    setChargeMsg(null);
    try {
      const res = await base44.functions.invoke("setDeviceParam", {
        device_id: schedule.device_id,
        charging_mode: "time_of_use",
      });
      if (res.data && res.data.success) {
        setChargeMsg({ ok: true, text: "Charging now — system forced to time-of-use." });
      } else {
        setChargeMsg({ ok: false, text: res.data?.remote_error || res.data?.error || "Could not start charging." });
      }
    } catch (e) {
      setChargeMsg({ ok: false, text: e.message });
    }
    setCharging(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Car className="w-4 h-4 text-primary" /> EV Price-Triggered Charging
            </CardTitle>
            <CardDescription>Auto-starts charging only when the live import price is at or below your threshold.</CardDescription>
          </div>
          <Switch checked={enabled} onCheckedChange={onToggle} aria-label="Enable EV price-triggered charging" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>Live import price</Label>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold">{rate != null ? rate.toFixed(1) : "—"}</span>
              <span className="text-xs text-muted-foreground">p/kWh</span>
            </div>
            <Badge variant="outline" className="text-[10px]">{BAND_LABEL[band] || band}</Badge>
          </div>
          <div className="space-y-1">
            <Label>Charge threshold</Label>
            <Input
              type="number" step="0.1" min="0" value={thresholdInput}
              disabled={!schedule}
              onChange={(e) => setThresholdInput(e.target.value)}
              onBlur={onThresholdBlur}
            />
            <p className="text-[11px] text-muted-foreground">Charge when price ≤ this (p/kWh)</p>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            {enabled ? (
              wouldCharge ? (
                <div className="flex items-center gap-2 text-primary font-medium">
                  <Zap className="w-4 h-4" /> Charging window
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <TrendingDown className="w-4 h-4" /> Waiting for cheaper price
                </div>
              )
            ) : (
              <div className="text-muted-foreground text-sm">Rule disabled</div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={runNow} disabled={running || !schedule}>
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowDownToLine className="w-4 h-4 mr-2" />}
            {running ? "Checking…" : "Run rule now"}
          </Button>
          <Button size="sm" variant="secondary" onClick={chargeNow} disabled={charging || !schedule || !schedule.device_id}>
            {charging ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BatteryCharging className="w-4 h-4 mr-2" />}
            {charging ? "Starting…" : "Charge EV now"}
          </Button>
          {schedule && schedule.ev_last_checked && (
            <span className="text-xs text-muted-foreground">
              Last checked {new Date(schedule.ev_last_checked).toLocaleString("en-GB", { timeZone: TIMEZONE })}
            </span>
          )}
        </div>

        {chargeMsg && (
          <div className={`text-sm rounded-lg p-3 ${chargeMsg.ok ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
            {chargeMsg.text}
          </div>
        )}

        {result && result.error && (
          <div className="text-sm rounded-lg p-3 bg-destructive/10 text-destructive">{result.error}</div>
        )}
        {result && result.success && (
          <div className="text-sm rounded-lg p-3 bg-primary/10 text-primary">
            {result.action === "disabled"
              ? "Rule is disabled — enable it to auto-charge."
              : result.applied
                ? `Applied: ${result.action === "time_of_use" ? "started charging" : "stopped grid charging"} at ${Number(result.current_rate_p).toFixed(1)}p/kWh.`
                : result.skipped
                  ? `No change — already ${result.action === "time_of_use" ? "charging" : "idle"}. Price now ${Number(result.current_rate_p).toFixed(1)}p/kWh.`
                  : `Price ${Number(result.current_rate_p).toFixed(1)}p/kWh vs threshold ${Number(result.threshold_p).toFixed(1)}p — ${result.should_charge ? "charge" : "wait"}.`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}