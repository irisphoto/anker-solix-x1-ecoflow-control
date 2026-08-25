import React from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BatteryCharging, Activity } from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";

// Convention (matches Dashboard StatCard): battery_power_w < 0 => charging,
// > 0 => discharging. We split the series into two positive bands plus a
// battery-level line on a secondary % axis for an at-a-glance flow view.

function fmtTime(ts) {
  const d = new Date(ts);
  if (isNaN(d)) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function BatteryFlowChart({ device }) {
  const [data, setData] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [range, setRange] = React.useState("24h");

  const load = React.useCallback(async () => {
    if (!device?.id) return;
    setLoading(true);
    try {
      const limit = range === "7d" ? 500 : 200;
      const list = await base44.entities.EnergyReading.filter(
        { device_id: device.id, period: "hour" },
        "-timestamp",
        limit
      );
      const rows = (list || [])
        .slice()
        .reverse()
        .map((r) => {
          const pw = Number(r.battery_power_w || 0);
          return {
            time: fmtTime(r.timestamp),
            ts: r.timestamp,
            charge: pw < 0 ? Math.abs(pw) : 0,   // power into battery (W)
            discharge: pw > 0 ? pw : 0,           // power out of battery (W)
            level: Math.max(0, Math.min(100, Number(r.battery_level || 0))),
          };
        });
      setData(rows);
    } catch {
      setData([]);
    }
    setLoading(false);
  }, [device?.id, range]);

  React.useEffect(() => { load(); }, [load]);

  const totalCharge = data.reduce((s, r) => s + r.charge, 0);
  const totalDischarge = data.reduce((s, r) => s + r.discharge, 0);
  const nowLevel = data.length ? data[data.length - 1].level : (device?.battery_level || 0);
  const active = data.some((r) => r.charge > 0 || r.discharge > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-battery" />
              Battery Charge &amp; Discharge
            </CardTitle>
            <CardDescription className="text-xs">Live battery flow over time — power in vs. out</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-border overflow-hidden text-xs">
              <button
                onClick={() => setRange("24h")}
                className={`px-2.5 py-1 ${range === "24h" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}
              >24h</button>
              <button
                onClick={() => setRange("7d")}
                className={`px-2.5 py-1 ${range === "7d" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}
              >7d</button>
            </div>
            <Badge variant={active ? "default" : "secondary"}>{active ? "Active" : "Idle"}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {loading ? (
          <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">Loading battery history…</div>
        ) : data.length === 0 ? (
          <div className="h-[260px] flex flex-col items-center justify-center text-center text-muted-foreground">
            <BatteryCharging className="w-8 h-8 mb-2" />
            <p className="text-sm">No battery readings yet.</p>
            <p className="text-xs">Press “Sync now” to start collecting flow data.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="rounded-lg border border-border/70 p-2.5">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <BatteryCharging className="w-3.5 h-3.5" style={{ color: "hsl(217 91% 55%)" }} /> Charging
                </div>
                <div className="text-lg font-heading font-semibold text-foreground">{Math.round(totalCharge / 1000 * 10) / 10} kWh</div>
                <div className="text-[10px] text-muted-foreground">into battery</div>
              </div>
              <div className="rounded-lg border border-border/70 p-2.5">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <BatteryCharging className="w-3.5 h-3.5" style={{ color: "hsl(152 62% 40%)" }} /> Discharging
                </div>
                <div className="text-lg font-heading font-semibold text-foreground">{Math.round(totalDischarge / 1000 * 10) / 10} kWh</div>
                <div className="text-[10px] text-muted-foreground">out of battery</div>
              </div>
              <div className="rounded-lg border border-border/70 p-2.5">
                <div className="text-[11px] text-muted-foreground">Current level</div>
                <div className="text-lg font-heading font-semibold text-foreground">{Math.round(nowLevel)}%</div>
                <div className="text-[10px] text-muted-foreground">state of charge</div>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gBattCharge" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(217 91% 55%)" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="hsl(217 91% 55%)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gBattDischarge" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(152 62% 40%)" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="hsl(152 62% 40%)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} minTickGap={24} />
                <YAxis yAxisId="w" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} unit="W" width={48} />
                <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} unit="%" width={40} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v, n) => (n === "Level" ? [`${v}%`, n] : [`${Math.round(v)} W`, n])}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine yAxisId="w" y={0} stroke="hsl(var(--border))" />
                <Area yAxisId="w" type="monotone" dataKey="charge" name="Charging" stroke="hsl(217 91% 55%)" fill="url(#gBattCharge)" strokeWidth={2} />
                <Area yAxisId="w" type="monotone" dataKey="discharge" name="Discharging" stroke="hsl(152 62% 40%)" fill="url(#gBattDischarge)" strokeWidth={2} />
                <Line yAxisId="pct" type="monotone" dataKey="level" name="Level" stroke="hsl(38 92% 50%)" dot={false} strokeWidth={2} strokeDasharray="4 3" />
              </ComposedChart>
            </ResponsiveContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}