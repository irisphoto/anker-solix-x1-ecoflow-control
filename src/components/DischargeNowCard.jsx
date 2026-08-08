import React from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Zap, RotateCcw, Info } from "lucide-react";

// "Discharge now" = lower the X1 backup-reserve floor so the battery drains to cover home load.
// The unofficial Anker cloud API has no confirmed forced-grid-export command for the X1,
// so this releases stored energy for your home, not a timed dump to the grid.
export default function DischargeNowCard({ device, onApplied }) {
  const [floor, setFloor] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const [previousReserve, setPreviousReserve] = React.useState(null);

  const discharging = previousReserve != null;

  const apply = async (reserve) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await base44.functions.invoke("setDeviceParam", {
        device_id: device.id,
        backup_reserve: reserve,
      });
      if (res.data && res.data.success) {
        setMsg({ ok: true, text: reserve === previousReserve ? "Restored previous reserve." : `Backup reserve set to ${reserve}%.` });
        onApplied?.({ backup_reserve: reserve, last_sync: res.data.applied?.last_sync });
        return true;
      }
      setMsg({ ok: false, text: res.data?.remote_error || res.data?.error || "Could not change reserve." });
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
    return false;
  };

  const discharge = async () => {
    const prev = Number(device.backup_reserve ?? 20);
    const ok = await apply(Number(floor));
    if (ok) setPreviousReserve(prev);
  };

  const restore = async () => {
    const ok = await apply(previousReserve);
    if (ok) setPreviousReserve(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="w-4 h-4" /> Discharge now
        </CardTitle>
        <CardDescription>
          Lower the backup-reserve floor so the battery drains to cover your home load down to {floor}%.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Label htmlFor="dn-floor" className="text-xs text-muted-foreground">Floor</Label>
            <input
              id="dn-floor" type="range" min={0} max={50} step={5}
              value={floor} onChange={(e) => setFloor(Number(e.target.value))}
              className="w-32 accent-primary"
            />
            <span className="text-sm font-medium w-8">{floor}%</span>
          </div>
          <div className="text-xs text-muted-foreground">Current reserve: {device.backup_reserve ?? 0}% · Battery: {Math.round(device.battery_level ?? 0)}%</div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {!discharging ? (
            <Button onClick={discharge} disabled={busy || !device?.id}>
              <Zap className="w-4 h-4 mr-2" />
              {busy ? "Applying…" : "Discharge now"}
            </Button>
          ) : (
            <Button variant="outline" onClick={restore} disabled={busy}>
              <RotateCcw className="w-4 h-4 mr-2" />
              {busy ? "Restoring…" : `Stop & restore to ${previousReserve}%`}
            </Button>
          )}
          {msg && (
            <span className={`text-sm ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.text}</span>
          )}
        </div>

        <div className="rounded-lg bg-muted/50 border p-3 flex gap-2">
          <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground">
            This releases stored energy for your home consumption. The X1 cloud API does not support a timed forced export to the grid, so it won't deliberately dump energy to the grid beyond surplus generation.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}