import React from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { LineChart as ChartIcon, Zap } from "lucide-react";
import EnergyChart from "@/components/EnergyChart";

export default function History() {
  const [devices, setDevices] = React.useState([]);
  const [readings, setReadings] = React.useState([]);

  const load = async () => {
    const d = await base44.entities.Device.list("-last_sync", 50).catch(() => []);
    setDevices(d || []);
    if (d && d[0]) {
      const r = await base44.entities.EnergyReading.filter({ device_id: d[0].id }, "-timestamp", 96).catch(() => []);
      setReadings(r || []);
    }
  };

  React.useEffect(() => { load(); }, []);

  const device = devices[0];
  const anker = readings.filter((r) => r.source !== "octopus");
  const octo = readings.filter((r) => r.source === "octopus");

  const chartData = anker.map((r) => ({
    hour: new Date(r.timestamp).getHours(),
    solar_power_w: r.solar_power_w,
    home_usage_w: r.home_usage_w,
    battery_power_w: r.battery_power_w,
    grid_power_w: r.grid_power_w,
  }));

  const totals = anker.reduce(
    (acc, r) => {
      acc.solar += r.solar_power_w;
      acc.home += r.home_usage_w;
      acc.grid += r.grid_power_w;
      return acc;
    },
    { solar: 0, home: 0, grid: 0 }
  );

  const octoKwh = octo.reduce((s, r) => s + ((Number(r.grid_power_w) || 0) * 0.5 / 1000), 0);
  const octoChart = [...octo]
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map((r) => ({
      hour: new Date(r.timestamp).getHours(),
      consumption_w: Number(r.grid_power_w) || 0,
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Energy History</h1>
        <p className="text-sm text-muted-foreground">{device ? device.name : "No device"}</p>
      </div>

      {readings.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ChartIcon className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No readings yet. Sync your device to start collecting history.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Solar (Wh)</div><div className="text-xl font-heading font-semibold text-foreground">{Math.round(totals.solar)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Home (Wh)</div><div className="text-xl font-heading font-semibold text-foreground">{Math.round(totals.home)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Grid net (Wh)</div><div className="text-xl font-heading font-semibold text-foreground">{Math.round(totals.grid)}</div></CardContent></Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-[hsl(280_65%_55%)]" />
                <div>
                  <div className="text-xs text-muted-foreground">Octopus import</div>
                  <div className="text-xl font-heading font-semibold text-foreground">{octoKwh.toFixed(1)} kWh</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Power flow over time</CardTitle></CardHeader>
            <CardContent><EnergyChart data={chartData} height={320} /></CardContent>
          </Card>

          {octo.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Octopus grid import</CardTitle></CardHeader>
              <CardContent><EnergyChart data={octoChart} height={260} /></CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}