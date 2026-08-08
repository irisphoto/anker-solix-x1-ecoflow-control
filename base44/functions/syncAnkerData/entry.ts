import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { serverForCountry, ankerAuthenticate, ankerRequest, ENDPOINTS } from "../../shared/ankerClient.ts";
import { getAnkerCreds } from "../../shared/userIntegration.ts";

function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function kwhToWh(v) { return num(v) * 1000; }      // kWh -> Wh
function kwToW(v) { return num(v) * 1000; }          // kW -> W
// Most recent real (non-placeholder) power reading from a stats `power[]` series, in W.
function liveW(statsObj) {
  const arr = statsObj && statsObj.power ? statsObj.power : [];
  let picked = null;
  for (const p of arr) {
    const pi = (p.powerInfos || [])[0];
    if (pi && !pi.isFix) picked = pi;
  }
  return picked ? kwToW(picked.value) : 0;
}
// Most recent real (non-placeholder) battery charge level (%).
function batteryPct(hesObj) {
  const arr = Array.isArray(hesObj && hesObj.chargeLevel) ? hesObj.chargeLevel : [];
  let picked = null;
  for (const c of arr) { if (!c.isFix) picked = c; }
  return picked ? num(picked.value) : 0;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let creds;
    try { creds = await getAnkerCreds(base44); }
    catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
    const { email, password, country } = creds;

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

    for (const s of siteList) {
      const siteId = s.site_id;
      if (!siteId) continue;

      let running = {};
      try {
        const r = await ankerRequest(base, ENDPOINTS.systemRunningInfo, { siteId }, auth, country);
        running = (r && r.data) || {};
      } catch (e) { running = {}; }

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

      const solarTodayWh = kwhToWh(solar.totalEnergy);
      const homeTodayWh = kwhToWh(home.totalEnergy);
      const gridImportWh = kwhToWh(grid.totalImportedEnergy);
      const gridExportWh = kwhToWh(grid.totalExportedEnergy);
      const battChargeWh = kwhToWh(hes.totalImportedEnergy);
      const battDischargeWh = kwhToWh(hes.totalExportedEnergy);

      const solarLiveW = liveW(solar);
      const homeLiveW = liveW(home);
      const gridLiveW = liveW(grid);
      const battLiveW = liveW(hes);
      const battLevel = batteryPct(hes);

      const siteName = s.site_name || `Site ${siteId.slice(0, 8)}`;
      const connected = running.connected === true || running.connected === "true";
      const mode = num(running.mode);

      const record = {
        site_id: siteId,
        name: siteName,
        model: running.mainDeviceModel || "X1",
        status: connected ? "online" : "offline",
        battery_level: battLevel,
        battery_count: num(running.batCount),
        battery_capacity_wh: num(running.batCount) * 5000, // each X1 battery module is 5 kWh
        solar_power_w: solarLiveW,
        home_usage_w: homeLiveW,
        battery_power_w: battLiveW,
        grid_power_w: gridLiveW,
        solar_today_wh: solarTodayWh,
        home_today_wh: homeTodayWh,
        grid_import_wh: gridImportWh,
        grid_export_wh: gridExportWh,
        battery_charge_wh: battChargeWh,
        battery_discharge_wh: battDischargeWh,
        savings_value: num(running.totalSystemSavings),
        savings_currency: running.systemSavingsPriceUnit || "",
        generation_kwh: num(running.totalSystemPowerGeneration),
        system_mode: mode,
        last_sync: now,
      };

      // User context (RLS-scoped to this caller) — only their own devices match.
      const existing = await base44.entities.Device.filter({ site_id: siteId });
      let devId;
      if (existing && existing.length) {
        await base44.entities.Device.update(existing[0].id, record);
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
          solar_power_w: solarLiveW,
          home_usage_w: homeLiveW,
          battery_power_w: battLiveW,
          grid_power_w: gridLiveW,
          battery_level: battLevel,
          period: "hour",
        });
      } catch { /* ignore */ }
    }

    return Response.json({ success: true, auth_user: auth.nickname || auth.userId, site_count: siteList.length, devices_synced: upserted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}