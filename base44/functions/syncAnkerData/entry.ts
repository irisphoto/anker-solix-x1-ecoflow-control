import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from "base44:runtime";
import { serverForCountry, ankerAuthenticate, ankerRequest, ENDPOINTS } from "../../shared/ankerClient.ts";

function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function wh(v, unit) {
  const n = num(v);
  const u = String(unit || "").toLowerCase();
  if (u === "kwh") return n * 1000;
  return n; // assume Wh
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const email = secrets.get("ANKER_EMAIL");
    const password = secrets.get("ANKER_PASSWORD");
    const country = secrets.get("ANKER_COUNTRY");
    if (!email || !password || !country) {
      return Response.json({ error: 'Anker credentials not configured.' }, { status: 400 });
    }

    const base = serverForCountry(country);
    let auth;
    try {
      auth = await ankerAuthenticate(base, email, password, country);
    } catch (e) {
      return Response.json({ error: 'Anker authentication failed: ' + e.message }, { status: 502 });
    }

    let sitesData;
    try {
      sitesData = await ankerRequest(base, ENDPOINTS.siteList, {}, auth, country);
    } catch (e) {
      return Response.json({ error: 'Failed to fetch site list: ' + e.message }, { status: 502 });
    }

    const siteList = (sitesData.data && sitesData.data.site_list) || [];
    let upserted = 0;
    const now = new Date().toISOString();
    const today = todayStr();
    let debugRaw = null;

    for (const s of siteList) {
      const siteId = s.site_id;
      if (!siteId) continue;

      // HES system running info (status, savings, generation, battery count, mode)
      let running = {};
      try {
        const r = await ankerRequest(base, ENDPOINTS.systemRunningInfo, { siteId }, auth, country);
        running = (r && r.data) || {};
        if (!debugRaw) debugRaw = { running };
      } catch (e) { if (!debugRaw) debugRaw = { runningError: e.message }; }

      // HES energy statistics per source for today (Wh)
      async function stats(source) {
        try {
          const r = await ankerRequest(base, ENDPOINTS.energyStatistics, { siteId, sourceType: source, dateType: "day", start: today, end: today }, auth, country);
          return (r && r.data) || {};
        } catch { return {}; }
      }
      const solar = await stats("solar");
      const home = await stats("home");
      const grid = await stats("grid");
      const hes = await stats("hes");
      if (debugRaw && !debugRaw.solar) debugRaw.solar = solar;

      const solarToday = wh(solar.solar_total || solar.charge_total, solar.power_unit || solar.charge_unit);
      const homeToday = wh(home.home_usage_total, home.power_unit);
      const gridImport = wh(grid.grid_imported_total, grid.power_unit);
      const gridExport = wh(grid.solar_to_grid_total, grid.power_unit);
      const battCharge = wh(hes.charge_total, hes.charge_unit || hes.power_unit);
      const battDischarge = wh(hes.discharge_total, hes.discharge_unit || hes.power_unit);

      const siteName = s.site_name || `Site ${siteId.slice(0, 8)}`;
      const connected = running.connected === true || running.connected === "true";
      const mode = num(running.mode);

      const record = {
        site_id: siteId,
        name: siteName,
        model: running.mainDeviceModel || "X1",
        status: connected ? "online" : "offline",
        battery_level: 0,
        battery_count: num(running.batCount),
        battery_capacity_wh: 0,
        solar_power_w: solarToday,
        home_usage_w: homeToday,
        battery_power_w: battDischarge - battCharge,
        grid_power_w: gridImport - gridExport,
        solar_today_wh: solarToday,
        home_today_wh: homeToday,
        grid_import_wh: gridImport,
        grid_export_wh: gridExport,
        battery_charge_wh: battCharge,
        battery_discharge_wh: battDischarge,
        savings_value: num(running.totalSystemSavings),
        savings_currency: running.systemSavingsPriceUnit || "",
        generation_kwh: num(running.totalSystemPowerGeneration),
        system_mode: mode,
        last_sync: now,
      };

      const existing = await base44.asServiceRole.entities.Device.filter({ site_id: siteId });
      let devId;
      if (existing && existing.length) {
        await base44.asServiceRole.entities.Device.update(existing[0].id, record);
        devId = existing[0].id;
      } else {
        const created = await base44.entities.Device.create(record);
        devId = created.id;
      }
      upserted++;

      try {
        await base44.entities.EnergyReading.create({
          device_id: devId,
          timestamp: now,
          solar_power_w: solarToday,
          home_usage_w: homeToday,
          battery_power_w: battDischarge - battCharge,
          grid_power_w: gridImport - gridExport,
          battery_level: 0,
          period: "hour",
        });
      } catch { /* ignore */ }
    }

    return Response.json({ success: true, auth_user: auth.nickname || auth.userId, site_count: siteList.length, devices_synced: upserted, debug: debugRaw });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}