import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { serverForCountry, ankerAuthenticate, ankerRequest, ENDPOINTS } from "../../shared/ankerClient.ts";
import { getAnkerCreds } from "../../shared/userIntegration.ts";

// Update a device's charging mode / backup reserve.
// Uses the *calling user's* own Anker credentials and only acts on a device
// they own (verified through RLS-scoped user context).

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { device_id, charging_mode, backup_reserve } = body;
    if (!device_id) return Response.json({ error: "device_id is required" }, { status: 400 });

    // Ownership check: user context (RLS) returns null if the device isn't theirs.
    const device = await base44.entities.Device.get(device_id).catch(() => null);
    if (!device) return Response.json({ error: "Device not found" }, { status: 404 });

    let creds;
    try { creds = await getAnkerCreds(base44); }
    catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
    const { email, password, country } = creds;

    const base = serverForCountry(country);
    let auth;
    try {
      auth = await ankerAuthenticate(base, email, password, country);
    } catch (e) {
      return Response.json({ error: "Anker authentication failed: " + e.message }, { status: 502 });
    }

    const targetMode = charging_mode || device.charging_mode;
    const targetReserve = backup_reserve != null ? Number(backup_reserve) : Number(device.backup_reserve || 20);

    let remoteResult = null;
    let remoteError = null;
    try {
      remoteResult = await ankerRequest(base, ENDPOINTS.setDeviceParm, {
        site_id: device.site_id,
        param_type: 1,
        charging_type: targetMode,
        backup_reserve: targetReserve,
      }, auth, country);
    } catch (e) {
      remoteError = e.message;
    }

    const update = { last_sync: new Date().toISOString() };
    if (charging_mode) update.charging_mode = charging_mode;
    if (backup_reserve != null) update.backup_reserve = Number(backup_reserve);
    await base44.entities.Device.update(device_id, update);

    return Response.json({ success: true, device_id, applied: update, remote_result: remoteResult, remote_error: remoteError });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}