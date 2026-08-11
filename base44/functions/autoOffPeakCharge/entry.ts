import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createAnkerSession, ENDPOINTS } from "../../shared/ankerClient.ts";

import { toMin, currentMinutes, inWindow } from "../../shared/tariffTime.ts";

const TIMEZONE = "Europe/London";

// Off-peak battery charging rule, scoped to the calling user's own tariff,
// device and schedule (RLS-scoped user context).
//
// During the user's configured off-peak tariff window, force the Anker X1 into
// "time_of_use" (the mode that charges the battery from the cheap grid) until
// the battery reaches the target SoC. Outside the window (or once full), revert
// to "self_use" so the battery discharges to power the home / EV instead.
// This is especially useful ahead of EV charging: topping the battery up at
// off-peak rates means "Charge EV now (battery-first)" runs on stored cheap
// energy rather than peak-rate grid import.

function inOffPeakWindow(tariff) {
  if (!tariff || !tariff.has_off_peak) return false;
  return inWindow(currentMinutes(), tariff.off_peak_start, tariff.off_peak_end);
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
    if (!tariff) return Response.json({ error: "No active tariff configured. Sync your Octopus tariff first." }, { status: 400 });

    const devices = await base44.entities.Device.list("-last_sync", 1);
    const device = devices && devices[0];
    if (!device) return Response.json({ error: "No device found. Add your Anker details in Settings and sync." }, { status: 400 });

    const schedules = await base44.entities.Schedule.filter({ device_id: device.id });
    const schedule = schedules && schedules[0];

    const enabled = schedule ? !!schedule.off_peak_charge_enabled : false;
    const targetSoc = schedule && schedule.off_peak_target_soc != null ? Number(schedule.off_peak_target_soc) : 100;
    const batteryLevel = Number(device.battery_level || 0);
    const inOffPeak = inOffPeakWindow(tariff);
    const belowTarget = batteryLevel < targetSoc;

    // time_of_use = Anker cost-saving mode that charges the battery from grid
    // during the cheap window; self_use = solar/home priority, no forced grid charge.
    const shouldCharge = enabled && inOffPeak && belowTarget;
    const desiredMode = shouldCharge ? "time_of_use" : "self_use";
    const lastAction = schedule ? schedule.off_peak_last_action : null;
    const modeUnchanged = desiredMode === lastAction;

    const summary = {
      now_local: new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(new Date()),
      tariff: tariff.name,
      off_peak: `${tariff.off_peak_start}-${tariff.off_peak_end}`,
      off_peak_rate: tariff.off_peak_rate,
      in_off_peak: inOffPeak,
      battery_level: batteryLevel,
      target_soc: targetSoc,
      enabled,
      should_charge: shouldCharge,
      action: desiredMode,
      previous_action: lastAction,
      skipped: modeUnchanged,
      dry_run: dryRun,
    };

    if (!enabled) {
      return Response.json({ success: true, ...summary, action: "disabled", should_charge: false });
    }

    if (dryRun) return Response.json({ success: true, ...summary });

    let applied = false, remoteResult = null, remoteError = null;
    if (!modeUnchanged) {
      let anker;
      try { anker = await createAnkerSession(base44); }
      catch (e) {
        const status = e.code === "CREDENTIALS_MISSING" ? 400 : 502;
        return Response.json({ error: e.message, ...summary }, { status });
      }
      try {
        remoteResult = await anker.request(ENDPOINTS.setDeviceParm, {
          site_id: device.site_id,
          param_type: 1,
          charging_type: desiredMode,
          backup_reserve: Number(device.backup_reserve || 20),
        });
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
          off_peak_last_action: desiredMode,
          off_peak_last_checked: new Date().toISOString(),
        });
      }
    } else {
      await base44.entities.Schedule.update(schedule.id, {
        off_peak_last_checked: new Date().toISOString(),
      }).catch(() => {});
    }

    return Response.json({ success: !remoteError, ...summary, applied, remote_result: remoteResult, remote_error: remoteError });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}