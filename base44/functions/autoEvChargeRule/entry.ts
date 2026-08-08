import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { serverForCountry, ankerAuthenticate, ankerRequest, ENDPOINTS } from "../../shared/ankerClient.ts";
import { getAnkerCreds } from "../../shared/userIntegration.ts";

import { toMin, currentMinutes, inWindow } from "../../shared/tariffTime.ts";

const TIMEZONE = "Europe/London";
// EV price-triggered charging rule, scoped to the calling user's own tariff,
// device and schedule (RLS-scoped user context).

function currentPrice(tariff) {
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

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    const tariffs = await base44.entities.Tariff.filter({ is_active: true });
    const tariff = tariffs && tariffs[0];
    if (!tariff) return Response.json({ error: "No active tariff configured." }, { status: 400 });

    const devices = await base44.entities.Device.list("-last_sync", 1);
    const device = devices && devices[0];
    if (!device) return Response.json({ error: "No device found." }, { status: 400 });

    const schedules = await base44.entities.Schedule.filter({ device_id: device.id });
    const schedule = schedules && schedules[0];

    const enabled = schedule ? !!schedule.ev_auto_charge_enabled : false;
    const threshold = schedule && schedule.ev_price_threshold_p != null ? Number(schedule.ev_price_threshold_p) : null;
    const { rate, band } = currentPrice(tariff);

    const summary = {
      now_local: new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(new Date()),
      tariff: tariff.name,
      current_rate_p: rate,
      band,
      threshold_p: threshold,
      enabled,
      ev_charger_power_w: device.ev_charger_power_w || 0,
    };

    if (!enabled || threshold == null) {
      return Response.json({ success: true, ...summary, action: "disabled", should_charge: false });
    }

    const shouldCharge = rate <= threshold;
    const desiredMode = shouldCharge ? "time_of_use" : "self_use";
    const lastAction = schedule ? schedule.ev_last_action : null;
    const modeUnchanged = desiredMode === lastAction;

    summary.should_charge = shouldCharge;
    summary.action = desiredMode;
    summary.previous_action = lastAction;
    summary.skipped = modeUnchanged;

    if (dryRun) return Response.json({ success: true, ...summary });

    let applied = false, remoteResult = null, remoteError = null;
    if (!modeUnchanged) {
      let creds;
      try { creds = await getAnkerCreds(base44); }
      catch (e) { return Response.json({ error: e.message, ...summary }, { status: 400 }); }
      const { email, password, country } = creds;

      const base = serverForCountry(country);
      let auth;
      try {
        auth = await ankerAuthenticate(base, email, password, country);
      } catch (e) {
        return Response.json({ error: "Anker authentication failed: " + e.message, ...summary }, { status: 502 });
      }
      try {
        remoteResult = await ankerRequest(base, ENDPOINTS.setDeviceParm, {
          site_id: device.site_id,
          param_type: 1,
          charging_type: desiredMode,
          backup_reserve: Number(device.backup_reserve || 20),
        }, auth, country);
        applied = true;
      } catch (e) {
        remoteError = e.message;
      }

      if (applied) {
        await base44.entities.Device.update(device.id, {
          charging_mode: desiredMode,
          last_sync: new Date().toISOString(),
        });
        await base44.entities.Schedule.update(schedule.id, {
          ev_last_action: desiredMode,
          ev_last_checked: new Date().toISOString(),
        });
      }
    } else {
      await base44.entities.Schedule.update(schedule.id, {
        ev_last_checked: new Date().toISOString(),
      }).catch(() => {});
    }

    return Response.json({ success: !remoteError, ...summary, applied, remote_result: remoteResult, remote_error: remoteError });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}