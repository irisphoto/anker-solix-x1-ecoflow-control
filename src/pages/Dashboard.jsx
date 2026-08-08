import React from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sun, Home, Battery, Cable, RefreshCw, Zap, ArrowDownRight, ArrowUpRight } from "lucide-react";
import PowerFlow from "@/components/PowerFlow";
import BatteryGauge from "@/components/BatteryGauge";
import SystemStatus from "@/components/SystemStatus";
import FlowMeter from "@/components/FlowMeter";
import SavingsCard from "@/components/SavingsCard";
import QuickModeSwitch from "@/components/QuickModeSwitch";
import SavingsChart from "@/components/SavingsChart";

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: color + "22" }}>
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-xl font-heading font-semibold text-foreground">{value}</div>
            <div className="text-[11px] text-muted-foreground">{sub}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [devices, setDevices] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [syncMsg, setSyncMsg] = React.useState(null);

  const load = async () => {
    try {
      const list = await base44.entities.Device.list("-last_sync", 50);
      setDevices(list || []);
    } catch {
      setDevices([]);
    }
    setLoading(false);
  };

  React.useEffect(() => { load(); }, []);

  const sync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await base44.functions.invoke("syncAnkerData", {});
      if (res.data && res.data.success) {
        setSyncMsg({ ok: true, text: `Synced ${res.data.devices_synced} device(s) from Anker cloud.` });
        await load();
      } else {
        setSyncMsg({ ok: false, text: res.data?.error || "Sync failed." });
      }
    } catch (e) {
      setSyncMsg({ ok: false, text: e.message || "Sync failed." });
    }
    setSyncing(false);
  };

  if (loading) return <div className="py-20 text-center text-muted-foreground">Loading…</div>;

  const device = devices[0];
  const empty = devices.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Live energy flow from your Anker SOLIX system</p>
        </div>
        <Button onClick={sync} disabled={syncing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync now"}
        </Button>
      </div>

      {syncMsg && (
        <div className={`text-sm rounded-lg p-3 ${syncMsg.ok ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
          {syncMsg.text}
        </div>
      )}

      {empty ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Zap className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-heading font-semibold text-foreground">No devices yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Connect your Anker SOLIX cloud account and sync to pull your system.
            </p>
            <Button onClick={sync}>Sync from Anker cloud</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <SystemStatus device={device} />

          <SavingsCard device={device} />

          <QuickModeSwitch device={device} onApplied={(a) => setDevices((prev) => a && a.charging_mode ? prev.map((d) => d.id === device.id ? { ...d, charging_mode: a.charging_mode, last_sync: a.last_sync } : d) : prev)} />

          <SavingsChart />

          <div className="grid md:grid-cols-3 gap-4">
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{device.name}</CardTitle>
                  <Badge variant={device.status === "online" ? "default" : "secondary"}>{device.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <PowerFlow
                  solar={device.solar_power_w}
                  home={device.home_usage_w}
                  battery={device.battery_power_w}
                  grid={device.grid_power_w}
                  evCharger={device.ev_charger_power_w || 0}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Battery</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center pt-2">
                <BatteryGauge level={device.battery_level} capacityWh={device.battery_capacity_wh} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Battery → Home Flow</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <FlowMeter power={device.battery_power_w < 0 ? 0 : Math.abs(device.battery_power_w)} />
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Sun} label="Solar" value={`${Math.round(device.solar_power_w)} W`} sub="generating" color="hsl(38 92% 50%)" />
            <StatCard icon={Home} label="Home" value={`${Math.round(device.home_usage_w)} W`} sub="consuming" color="hsl(var(--foreground))" />
            <StatCard
              icon={Battery}
              label="Battery"
              value={`${Math.abs(Math.round(device.battery_power_w))} W`}
              sub={device.battery_power_w < 0 ? "charging" : "discharging"}
              color="hsl(152 62% 40%)"
            />
            <StatCard
              icon={device.grid_power_w > 0 ? ArrowDownRight : ArrowUpRight}
              label="Grid"
              value={`${Math.abs(Math.round(device.grid_power_w))} W`}
              sub={device.grid_power_w > 0 ? "importing" : "exporting"}
              color="hsl(217 91% 55%)"
            />
          </div>

          {device.last_sync && (
            <div className="text-xs text-muted-foreground">
              Last sync: {new Date(device.last_sync).toLocaleString()} · Charging mode: <span className="capitalize">{device.charging_mode.replace("_", " ")}</span> · Backup reserve: {device.backup_reserve}%
            </div>
          )}
        </>
      )}
    </div>
  );
}