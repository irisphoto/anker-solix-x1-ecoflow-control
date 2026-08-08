import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { serverForCountry, ankerAuthenticate, ankerRequest, ENDPOINTS } from "../../shared/ankerClient.ts";
import { getAnkerCreds } from "../../shared/userIntegration.ts";

import { toMin, currentMinutes, inWindow } from "../../shared/tariffTime.ts";

const TIMEZONE = "Europe/London";

// Cost-saving = Anker "time_of_use" (cycles battery to shave peak / charge off-peak)
// Backup     = Anker "backup" (holds charge as reserve)
function decideMode(tariff) {
  const cur = currentMinutes();
  if (tariff.has_peak && inWindow(cur, tariff.peak_start, tariff.peak_end)) {
    return { mode: "time_of_use", label: "cost-saving", reason: "peak window", cur };
  }
  if (tariff.has_off_peak && inWindow(cur, tariff.off_peak_start, tariff.off_peak_end)) {
    return { mode: "backup", label: "backup", reason: "off-peak window", cur };
  }
  return { mode: "time_of_use", label: "cost-saving", reason: "standard period", cur };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    // Caller's own tariff + device (RLS-scoped user context).
    const tariffs = await base44.entities.Tariff.filter({ is_active: true });
    const tariff = tariffs && tariffs[0];
    if (!tariff) return Response.json({ error: "No active tariff configured. Sync your Octopus tariff first." }, { status: 400 });

    const devices = await base44.entities.Device.list("-last_sync", 1);
    const device = devices && devices[0];
    if (!device) return Response.json({ error: "No device found. Add your Anker details in Settings and sync." }, { status: 400 });

    const decision = decideMode(tariff);
    const targetMode = decision.mode;
    const backupReserve = Number(device.backup_reserve || 20);

    const summary = {
      now_local: new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(new Date()),
      tariff: tariff.name,
      peak: `${tariff.peak_start}-${tariff.peak_end}`,
      off_peak: `${tariff.off_peak_start}-${tariff.off_peak_end}`,
      decided_mode: decision.label,
      anker_mode: targetMode,
      reason: decision.reason,
      previous_mode: device.charging_mode,
      backup_reserve: backupReserve,
      dry_run: dryRun,
    };

    if (dryRun) return Response.json({ success: true, ...summary });

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

    let remoteResult = null;
    let remoteError = null;
    try {
      remoteResult = await ankerRequest(base, ENDPOINTS.setDeviceParm, {
        site_id: device.site_id,
        param_type: 1,
        charging_type: targetMode,
        backup_reserve: backupReserve,
      }, auth, country);
    } catch (e) {
      remoteError = e.message;
    }

    if (!remoteError) {
      await base44.entities.Device.update(device.id, {
        charging_mode: targetMode,
        backup_reserve: backupReserve,
        last_sync: new Date().toISOString(),
      });
    }

    return Response.json({ success: !remoteError, ...summary, remote_result: remoteResult, remote_error: remoteError });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}