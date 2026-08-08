import React from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BatteryFull, RefreshCw } from "lucide-react";
import BatteryGauge from "@/components/BatteryGauge";
import DeviceComponents from "@/components/DeviceComponents";

const MODES = ["self_use", "time_of_use", "backup", "manual"];

export default function Devices() {
  const [devices, setDevices] = React.useState([]);
  const [busy, setBusy] = React.useState(null);

  const load = async () => {
    const list = await base44.entities.Device.list("-last_sync", 50).catch(() => []);
    setDevices(list || []);
  };

  React.useEffect(() => { load(); }, []);

  const setParam = async (device, field, value) => {
    setBusy(device.id);
    try {
      await base44.functions.invoke("setDeviceParam", { device_id: device.id, [field]: value });
      await load();
    } catch (e) {
      alert(e.message);
    }
    setBusy(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Devices</h1>
          <p className="text-sm text-muted-foreground">Control charging mode and backup reserve</p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
      </div>

      {devices.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <BatteryFull className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No devices connected. Sync from the Dashboard.</p>
        </CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {devices.map((d) => (
            <Card key={d.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{d.name}</CardTitle>
                  <Badge variant={d.status === "online" ? "default" : "secondary"}>{d.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">{d.model} · {d.site_id}</div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <BatteryGauge level={d.battery_level} size={100} capacityWh={d.battery_capacity_wh} />
                  <div className="flex-1 space-y-3">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Charging mode</div>
                      <div className="flex flex-wrap gap-1.5">
                        {MODES.map((m) => (
                          <Button
                            key={m}
                            size="sm"
                            variant={d.charging_mode === m ? "default" : "outline"}
                            disabled={busy === d.id}
                            onClick={() => setParam(d, "charging_mode", m)}
                          >
                            {m.replace("_", " ")}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Backup reserve: {d.backup_reserve}%</div>
                      <input
                        type="range" min={0} max={100} value={d.backup_reserve}
                        onChange={(e) => setParam(d, "backup_reserve", Number(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
                {d.last_sync && <div className="text-[11px] text-muted-foreground mt-3">Last sync: {new Date(d.last_sync).toLocaleString()}</div>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="pt-2 border-t border-border">
        <h2 className="text-xl font-heading font-bold text-foreground mt-6 mb-1">Components</h2>
        <p className="text-sm text-muted-foreground mb-4">All batteries, inverters and the EV charger on this site</p>
        <DeviceComponents />
      </div>
    </div>
  );
}