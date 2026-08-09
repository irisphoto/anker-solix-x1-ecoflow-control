import React from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Cable, ChevronDown, ChevronRight, Info } from "lucide-react";

// "Force export to grid" fires a webhook on the user's own Home Assistant,
// which controls the Anker X1 over local Modbus to discharge the battery to
// the grid on demand. The X1 cloud API has no forced-export command, so this
// app delegates the actual device control to the user's local HA.
export default function ExportToGridCard({ device }) {
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const [showHelp, setShowHelp] = React.useState(false);

  const trigger = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await base44.functions.invoke("triggerHaExport", { device_id: device?.id });
      if (res.data && res.data.success) {
        setMsg({ ok: true, text: "Home Assistant webhook triggered — your X1 should start exporting to the grid shortly." });
      } else {
        setMsg({ ok: false, text: res.data?.error || "Webhook failed." });
      }
    } catch (e) {
      setMsg({ ok: false, text: e.message || "Webhook failed." });
    }
    setBusy(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Cable className="w-4 h-4" /> Force export to grid
        </CardTitle>
        <CardDescription>
          Trigger your Home Assistant to drive the X1 (via local Modbus) to discharge the battery to the grid on demand.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={trigger} disabled={busy}>
            <Cable className="w-4 h-4 mr-2" />
            {busy ? "Triggering…" : "Export to grid now"}
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/settings">Configure HA webhook</Link>
          </Button>
        </div>

        {msg && (
          <div className={`text-sm rounded-lg p-3 ${msg.ok ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
            {msg.text}
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {showHelp ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          How to set this up
        </button>

        {showHelp && (
          <div className="rounded-lg bg-muted/50 border p-3 space-y-2 text-xs text-muted-foreground">
            <div className="flex gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                The Anker X1 cloud API can't force battery-to-grid export, so this app fires a webhook on your
                <b> Home Assistant</b> instead, which controls the X1 over local Modbus — the approach X1 owners use to
                sell to the grid on high-price windows.
              </div>
            </div>
            <ol className="list-decimal ml-4 space-y-1">
              <li>Install the Anker Solix X1 Modbus integration in Home Assistant (local network, no Anker cloud needed).</li>
              <li>In HA, create an Automation with a <b>Webhook</b> trigger (webhook ID e.g. <code>anker-export</code>).</li>
              <li>In the automation's action, call the Modbus service to set the X1 to discharge / sell-to-grid, and a second automation (or timer) to stop it after your target window or state-of-charge.</li>
              <li>Expose HA to the internet (Nabu Casa, Cloudflare Tunnel, etc.) so this app can reach the webhook URL.</li>
              <li>Paste the webhook URL in <Link to="/settings" className="text-primary underline">Settings → Home Assistant</Link> and Save.</li>
            </ol>
            <div className="font-mono text-[11px] bg-background border rounded p-2 break-all">
              POST {`{ "action": "export_to_grid", "device_id": "…", "Authorization": "Bearer …" }`}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}