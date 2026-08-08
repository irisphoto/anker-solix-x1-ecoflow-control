import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from "base44:runtime";
import { serverForCountry, ankerAuthenticate, ankerRequest, ENDPOINTS } from "../../shared/ankerClient.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { device_id, charging_mode, backup_reserve } = body;
    if (!device_id) return Response.json({ error: 'device_id is required' }, { status: 400 });

    const device = await base44.asServiceRole.entities.Device.get(device_id);
    if (!device) return Response.json({ error: 'Device not found' }, { status: 404 });

    const email = secrets.get("ANKER_EMAIL");
    const password = secrets.get("ANKER_PASSWORD");
    const country = secrets.get("ANKER_COUNTRY");
    const base = serverForCountry(country);

    let auth;
    try {
      auth = await ankerAuthenticate(base, email, password, country);
    } catch (e) {
      return Response.json({ error: 'Anker authentication failed: ' + e.message }, { status: 502 });
    }

    let remoteResult = null;
    let remoteError = null;
    try {
      // Param types observed: 1/2/3 for charging mode + backup reserve on Solarbank/X1
      const payload = {
        site_id: device.site_id,
        param_type: 1,
        charging_type: charging_mode || device.charging_mode,
        backup_reserve: backup_reserve != null ? Number(backup_reserve) : Number(device.backup_reserve),
      };
      remoteResult = await ankerRequest(base, ENDPOINTS.setDeviceParm, payload, auth, country);
    } catch (e) {
      remoteError = e.message;
    }

    // Persist locally regardless (the app's source of truth mirrors the requested state)
    const update = {};
    if (charging_mode) update.charging_mode = charging_mode;
    if (backup_reserve != null) update.backup_reserve = Number(backup_reserve);
    update.last_sync = new Date().toISOString();
    await base44.asServiceRole.entities.Device.update(device_id, update);

    return Response.json({ success: true, device_id, applied: update, remote_result: remoteResult, remote_error: remoteError });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}