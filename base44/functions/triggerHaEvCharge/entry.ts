import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getUserIntegration } from "../../shared/userIntegration.ts";

// Fire a webhook on the caller's own Home Assistant so their local control
// (Modbus for the X1 + the EV charger's start command) begins an EV charge
// that is powered from the home battery FIRST, only drawing from the grid if
// the battery is exhausted. The Anker cloud API exposes no "start charge"
// endpoint, so this app triggers the user's HA instead — same pattern as the
// "force export to grid" button.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const cfg = await getUserIntegration(base44);
    if (!cfg || !cfg.ha_webhook_url || !String(cfg.ha_webhook_url).trim()) {
      return Response.json(
        { error: "Home Assistant webhook URL not configured. Add it in Settings → Home Assistant." },
        { status: 400 }
      );
    }

    const url = String(cfg.ha_webhook_url).trim();
    const headers = { "Content-Type": "application/json" };
    const token = cfg.ha_webhook_token ? String(cfg.ha_webhook_token).trim() : "";
    if (token) headers["Authorization"] = "Bearer " + token;

    const reqBody = await req.json().catch(() => ({}));
    const body = {
      action: "charge_ev",
      priority: "battery_first",
      device_id: reqBody.device_id || null,
      triggered_by: user.email,
      timestamp: new Date().toISOString(),
    };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    let resp;
    try {
      resp = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      return Response.json(
        {
          error:
            "Could not reach Home Assistant: " + (e && e.name === "AbortError" ? "request timed out" : e.message) +
            ". Make sure HA is online and the webhook URL is reachable from the internet (Nabu Casa or a tunnel).",
        },
        { status: 502 }
      );
    }
    clearTimeout(timer);

    const respText = await resp.text().catch(() => "");
    return Response.json(
      { success: resp.ok, status: resp.status, response: respText.slice(0, 500) },
      { status: 200 }
    );
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}