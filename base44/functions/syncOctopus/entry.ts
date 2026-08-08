import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from "base44:runtime";

const API_BASE = "https://api.octopus.energy/v1";

function authHeader() {
  const key = secrets.get("OCTOPUS_API_KEY");
  return "Basic " + btoa(key + ":");
}

async function octopusGet(path) {
  const res = await fetch(API_BASE + path, { headers: { Authorization: authHeader() } });
  if (!res.ok) {
    let detail = "";
    try { detail = await res.text(); } catch {}
    throw new Error(`Octopus API ${res.status}: ${detail.slice(0, 200)}`);
  }
  return res.json();
}

function num(v) { const n = Number(v); return isNaN(n) ? null : n; }

function currentValue(arr) {
  if (!arr || !arr.length) return null;
  const now = Date.now();
  const r = arr.find(x => (!x.valid_from || new Date(x.valid_from).getTime() <= now) && (!x.valid_to || new Date(x.valid_to).getTime() > now));
  const chosen = r || arr[arr.length - 1];
  return num(chosen.value_inc_vat);
}

function pickBundle(tariffsObj, region) {
  if (!tariffsObj) return null;
  if (region && tariffsObj[region] && tariffsObj[region].direct_debit_monthly) return tariffsObj[region].direct_debit_monthly;
  if (tariffsObj.direct_debit_monthly) return tariffsObj.direct_debit_monthly;
  const keys = Object.keys(tariffsObj);
  if (keys.length && tariffsObj[keys[0]] && tariffsObj[keys[0]].direct_debit_monthly) return tariffsObj[keys[0]].direct_debit_monthly;
  return Object.values(tariffsObj)[0];
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = secrets.get("OCTOPUS_API_KEY");
    const accountNumber = secrets.get("OCTOPUS_ACCOUNT_NUMBER");
    if (!apiKey || !accountNumber) {
      return Response.json({ error: 'Octopus credentials not configured.' }, { status: 400 });
    }

    // 1. Account → active import electricity meter point + current agreement
    const account = await octopusGet(`/accounts/${accountNumber}/`);
    let mpan = null, serial = null, tariffCode = null;
    for (const prop of account.properties || []) {
      for (const emp of prop.electricity_meter_points || []) {
        if (emp.is_export) continue;
        const activeAgreement = (emp.agreements || [])
          .filter(a => !a.valid_to || new Date(a.valid_to) > new Date())
          .sort((a, b) => new Date(b.valid_from) - new Date(a.valid_from))[0];
        if (activeAgreement && emp.mpan && emp.meters && emp.meters.length) {
          mpan = emp.mpan;
          serial = (emp.meters.find(m => !m.is_export) || emp.meters[0]).serial_number;
          tariffCode = activeAgreement.tariff_code;
          break;
        }
      }
      if (mpan) break;
    }
    if (!mpan) return Response.json({ error: 'No active electricity import meter point found on this account.' }, { status: 400 });

    // 2. Parse product code + region from tariff code (e.g. E-1R-IGOE-23-04-01-J)
    let productCode = null, region = null;
    const m = tariffCode.match(/^[A-Z]-1R-(.+)-([A-P])$/);
    if (m) { productCode = m[1]; region = m[2]; }

    let dayRate = null, nightRate = null, standingCharge = null, dual = false;
    if (productCode) {
      const product = await octopusGet(`/products/${productCode}/`);
      const dualBundle = pickBundle(product.dual_register_electricity_tariffs, region);
      if (dualBundle) {
        dual = true;
        dayRate = currentValue(dualBundle.day_tariff && dualBundle.day_tariff.rates);
        nightRate = currentValue(dualBundle.night_tariff && dualBundle.night_tariff.rates);
        standingCharge = currentValue(dualBundle.standing_charges);
      }
      if (dayRate == null) {
        const singleBundle = pickBundle(product.single_register_electricity_tariffs, region);
        if (singleBundle) {
          dayRate = currentValue(singleBundle.rates);
          standingCharge = standingCharge == null ? currentValue(singleBundle.standing_charges) : standingCharge;
        }
      }
    }

    // Intelligent Go advertised off-peak window
    const offPeakStart = "23:30";
    const offPeakEnd = "05:30";

    // 3. Update active Tariff record (or create one)
    const tariffData = {
      name: "Octopus Intelligent Go",
      currency: "£",
      import_rate: dayRate ?? 0,
      off_peak_rate: nightRate ?? 0,
      has_off_peak: nightRate != null,
      off_peak_start: offPeakStart,
      off_peak_end: offPeakEnd,
      has_peak: false,
      is_active: true,
    };
    const existingTariffs = await base44.asServiceRole.entities.Tariff.filter({ is_active: true });
    let tariffId;
    if (existingTariffs && existingTariffs.length) {
      await base44.asServiceRole.entities.Tariff.update(existingTariffs[0].id, tariffData);
      tariffId = existingTariffs[0].id;
    } else {
      const t = await base44.entities.Tariff.create(tariffData);
      tariffId = t.id;
    }

    // 4. Half-hourly consumption for the last 48h
    const devices = await base44.asServiceRole.entities.Device.list("-last_sync", 1);
    const deviceId = devices && devices[0] && devices[0].id;
    let stored = 0;
    if (deviceId) {
      const periodTo = new Date();
      const periodFrom = new Date(periodTo.getTime() - 48 * 30 * 60 * 1000);
      const periodFromIso = periodFrom.toISOString();
      let consumption = [];
      let nextPath = `/electricity-meter-points/${mpan}/meters/${serial}/consumption/?page_size=100&period_from=${periodFromIso}&period_to=${periodTo.toISOString()}&order_by=period`;
      let guard = 0;
      while (nextPath && guard < 5) {
        const page = await octopusGet(nextPath);
        consumption = consumption.concat(page.results || []);
        nextPath = page.next ? String(page.next).replace(API_BASE, "") : null;
        guard++;
      }

      // Replace prior Octopus readings in this window to avoid duplicates
      await base44.asServiceRole.entities.EnergyReading.deleteMany({
        device_id: deviceId,
        source: "octopus",
        timestamp: { $gte: periodFromIso }
      });

      const records = consumption
        .filter(c => Number(c.consumption) > 0)
        .map(c => {
          const kwh = Number(c.consumption || 0);
          const avgW = Math.round(kwh * 1000 / 0.5);
          return {
            device_id: deviceId,
            timestamp: new Date(c.interval_start).toISOString(),
            solar_power_w: 0,
            home_usage_w: avgW,
            battery_power_w: 0,
            grid_power_w: avgW,
            battery_level: 0,
            period: "hour",
            source: "octopus",
          };
        });
      if (records.length) {
        await base44.entities.EnergyReading.bulkCreate(records);
        stored = records.length;
      }
    }

    return Response.json({
      success: true,
      account_number: accountNumber,
      mpan,
      serial,
      tariff_code: tariffCode,
      product_code: productCode,
      region,
      dual_register: dual,
      day_rate_p: dayRate,
      night_rate_p: nightRate,
      standing_charge_p: standingCharge,
      off_peak_window: `${offPeakStart}–${offPeakEnd}`,
      tariff_id: tariffId,
      consumption_readings: stored,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}