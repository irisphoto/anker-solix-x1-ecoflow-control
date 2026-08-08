import React from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Zap, Play, CheckCircle2, TrendingUp } from "lucide-react";
import EnergyChart from "@/components/EnergyChart";
import AiOptimizationCard from "@/components/AiOptimizationCard";

const MODES = [
  { value: "self_use", label: "Self-use" },
  { value: "time_of_use", label: "Time-of-use" },
  { value: "peak_shaving", label: "Peak shaving" },
  { value: "off_peak_charge", label: "Off-peak charge" },
  { value: "backup", label: "Backup reserve" },
];

export default function Optimization() {
  const [devices, setDevices] = React.useState([]);
  const [tariff, setTariff] = React.useState(null);
  const [schedules, setSchedules] = React.useState([]);
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [saving, setSaving] = React.useState(false);

  const load = async () => {
    const [d, t, s] = await Promise.all([
      base44.entities.Device.list().catch(() => []),
      base44.entities.Tariff.list().catch(() => []),
      base44.entities.Schedule.list().catch(() => []),
    ]);
    setDevices(d || []);
    setTariff((t && t[0]) || null);
    setSchedules(s || []);
  };

  React.useEffect(() => { load(); }, []);

  const device = devices[0];
  const schedule = schedules.find((s) => s.device_id === (device && device.id)) || schedules[0];

  const updateTariff = async (field, value) => {
    const next = { ...tariff, [field]: value };
    setTariff(next);
    if (tariff && tariff.id) await base44.entities.Tariff.update(tariff.id, next);
  };

  const ensureSchedule = async () => {
    if (!device) return null;
    if (schedule) return schedule;
    const created = await base44.entities.Schedule.create({
      device_id: device.id,
      name: "Smart schedule",
      mode: "time_of_use",
      backup_reserve_percent: 20,
      min_soc: 10,
      max_soc: 100,
      charge_from_grid_off_peak: true,
      discharge_during_peak: true,
    });
    setSchedules([created]);
    return created;
  };

  const updateSchedule = async (field, value) => {
    const s = schedule || (await ensureSchedule());
    if (!s) return;
    const next = { ...s, [field]: value };
    setSchedules([next, ...schedules.filter((x) => x.id !== s.id)]);
    await base44.entities.Schedule.update(s.id, { [field]: value });
  };

  const run = async (apply) => {
    if (!device) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke("runOptimization", { device_id: device.id, apply });
      setResult(res.data);
    } catch (e) {
      setResult({ error: e.message });
    }
    setRunning(false);
    if (apply) await load();
  };

  if (!device) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Zap className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Add a device first, then optimize its schedule.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Smart Optimization</h1>
        <p className="text-sm text-muted-foreground">Tariff-aware charging to maximize savings on {device.name}</p>
      </div>

      <AiOptimizationCard device={device} />

      {tariff ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Electricity Tariff</CardTitle>
            <CardDescription>Used to compute off-peak charging and peak-shaving savings.</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Import rate (p/kWh)</Label>
              <Input type="number" value={tariff.import_rate} onChange={(e) => updateTariff("import_rate", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Export rate (p/kWh)</Label>
              <Input type="number" value={tariff.export_rate} onChange={(e) => updateTariff("export_rate", Number(e.target.value))} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Off-peak rate</Label>
              <Switch checked={tariff.has_off_peak} onCheckedChange={(v) => updateTariff("has_off_peak", v)} />
            </div>
            {tariff.has_off_peak && (
              <>
                <div className="space-y-1">
                  <Label>Off-peak rate (p/kWh)</Label>
                  <Input type="number" value={tariff.off_peak_rate} onChange={(e) => updateTariff("off_peak_rate", Number(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <Label>Off-peak start</Label>
                  <Input type="time" value={tariff.off_peak_start} onChange={(e) => updateTariff("off_peak_start", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Off-peak end</Label>
                  <Input type="time" value={tariff.off_peak_end} onChange={(e) => updateTariff("off_peak_end", e.target.value)} />
                </div>
              </>
            )}
            <div className="flex items-center justify-between">
              <Label>Peak rate</Label>
              <Switch checked={tariff.has_peak} onCheckedChange={(v) => updateTariff("has_peak", v)} />
            </div>
            {tariff.has_peak && (
              <>
                <div className="space-y-1">
                  <Label>Peak rate (p/kWh)</Label>
                  <Input type="number" value={tariff.peak_rate} onChange={(e) => updateTariff("peak_rate", Number(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <Label>Peak start</Label>
                  <Input type="time" value={tariff.peak_start} onChange={(e) => updateTariff("peak_start", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Peak end</Label>
                  <Input type="time" value={tariff.peak_end} onChange={(e) => updateTariff("peak_end", e.target.value)} />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="text-sm text-muted-foreground">Loading tariff…</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Charging Strategy</CardTitle>
          <CardDescription>How the battery should behave across the day.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Mode</Label>
            <div className="flex flex-wrap gap-2">
              {MODES.map((m) => (
                <Button
                  key={m.value}
                  variant={(schedule && schedule.mode) === m.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateSchedule("mode", m.value)}
                >
                  {m.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Backup reserve ({schedule ? schedule.backup_reserve_percent : 20}%)</Label>
              <Input
                type="range" min={0} max={100}
                value={schedule ? schedule.backup_reserve_percent : 20}
                onChange={(e) => updateSchedule("backup_reserve_percent", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label>Max charge ({schedule ? schedule.max_soc : 100}%)</Label>
              <Input
                type="range" min={50} max={100}
                value={schedule ? schedule.max_soc : 100}
                onChange={(e) => updateSchedule("max_soc", Number(e.target.value))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Charge from grid off-peak</Label>
              <Switch checked={schedule ? schedule.charge_from_grid_off_peak : true} onCheckedChange={(v) => updateSchedule("charge_from_grid_off_peak", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Discharge during peak</Label>
              <Switch checked={schedule ? schedule.discharge_during_peak : true} onCheckedChange={(v) => updateSchedule("discharge_during_peak", v)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 flex-wrap">
        <Button onClick={() => run(false)} disabled={running}>
          <Play className="w-4 h-4 mr-2" />
          {running ? "Computing…" : "Run optimization"}
        </Button>
        <Button variant="secondary" onClick={() => run(true)} disabled={running || !result}>
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Apply to device
        </Button>
      </div>

      {result && result.error && (
        <div className="text-sm rounded-lg p-3 bg-destructive/10 text-destructive">{result.error}</div>
      )}

      {result && result.success && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Optimized 24-hour plan
            </CardTitle>
            <CardDescription>
              Estimated savings: <span className="font-semibold text-primary">£{(result.estimated_monthly_savings_p / 100).toFixed(2)}/month</span> ({(result.estimated_daily_savings_p / 100).toFixed(2)} £/day) · Mode: {result.mode_label}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EnergyChart data={result.plan.map((p) => ({
              hour: p.hour,
              solar_power_w: p.action === "self_use" ? Math.max(0, Math.sin(((p.hour - 6) / 14) * Math.PI) * 3000) : 0,
              home_usage_w: p.home_load_wh,
              battery_power_w: p.action === "discharge" ? -p.home_load_wh : (p.action === "charge_grid" ? p.home_load_wh : 0),
              grid_power_w: p.grid_import_wh - p.grid_export_wh,
            }))} />
            <div className="flex flex-wrap gap-2 mt-4">
              {result.plan.map((p) => (
                <Badge key={p.hour} variant="outline" className="text-[10px]">
                  {p.hour}:00 · {p.band}
                </Badge>
              ))}
            </div>
            {result.applied && <div className="text-sm text-primary mt-3 font-medium">Applied to device successfully.</div>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}