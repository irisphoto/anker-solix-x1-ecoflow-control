import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getUserIntegration } from "../../shared/userIntegration.ts";
import { currentMinutes, inWindow } from "../../shared/tariffTime.ts";

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
        { success: false, error: "Home Assistant webhook URL not configured. Add it in Settings → Home Assistant, then press Charge EV again." },
        { status: 200 }
      );
    }

    const url = String(cfg.ha_webhook_url).trim();
    const headers = { "Content-Type": "application/json" };
    const token = cfg.ha_webhook_token ? String(cfg.ha_webhook_token).trim() : "";
    if (token) headers["Authorization"] = "Bearer " + token;

    const reqBody = await req.json().catch(() => ({}));

    // Load sharing: when the off-peak battery rule uses "ev_half_share" and the
    // battery is currently grid-charging during off-peak, throttle the EV to
    // half the off-peak capacity so both can run at once. HA reads
    // max_charge_power_w to limit the charger's charge current; if the battery
    // isn't charging, the EV gets the full capacity.
    let maxChargePowerW = null;
    let batteryAlsoCharging = false;
    let loadBalance = "none";
    try {
      const [tariffs, devices, schedules] = await Promise.all([
        base44.entities.Tariff.filter({ is_active: true }),
        base44.entities.Device.list("-last_sync", 1),
        base44.entities.Schedule.filter({}),
      ]);
      const tariff = tariffs && tariffs[0];
      const dev = devices && devices[0];
      const sched = schedules && schedules[0];
      loadBalance = sched ? String(sched.off_peak_load_balance || "none") : "none";
      if (loadBalance === "ev_half_share" && tariff && dev && sched && sched.off_peak_charge_enabled) {
        const inOffPeak = tariff.has_off_peak && inWindow(currentMinutes(), tariff.off_peak_start, tariff.off_peak_end);
        const batteryLevel = Number(dev.battery_level || 0);
        const targetSoc = Number(sched.off_peak_target_soc || 100);
        if (inOffPeak && batteryLevel < targetSoc) {
          batteryAlsoCharging = true;
          const cap = Number(sched.off_peak_capacity_w || 7400);
          maxChargePowerW = Math.round(cap / 2);
        }
      }
    } catch { /* best effort — HA still gets the start command */ }

    const body = {
      action: "charge_ev",
      priority: "battery_first",
      device_id: reqBody.device_id || null,
      triggered_by: user.email,
      timestamp: new Date().toISOString(),
      load_balance: loadBalance,
      battery_also_charging: batteryAlsoCharging,
      max_charge_power_w: maxChargePowerW,
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