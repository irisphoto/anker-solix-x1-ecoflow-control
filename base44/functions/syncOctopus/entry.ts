import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from "base44:runtime";

const API_BASE = "https://api.octopus.energy/v1";

function authHeader() {
  const key = secrets.get("OCTOPUS_API_KEY");
  return "Basic " + Buffer.from(key + ":").toString("base64");
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

function fmtLondonHM(iso) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false
    }).formatToParts(new Date(iso));
    const hh = parts.find(p => p.type === "hour").value;
    const mm = parts.find(p => p.type === "minute").value;
    return `${hh === "24" ? "00" : hh}:${mm}`;
  } catch {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
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

    // 2. Parse product code + region from tariff code (e.g. E-1R-INTELLI-FIX-12M-26-06-13-H)
    let productCode = null, region = null;
    const m = tariffCode.match(/^[A-Z]-1R-(.+)-([A-P])$/);
    if (m) { productCode = m[1]; region = m[2]; }

    let dayRate = null, nightRate = null, standingCharge = null;
    let hasOffPeak = false;
    let offPeakStart = "23:30";
    let offPeakEnd = "05:30";

    if (productCode) {
      // Region keys in the product object are "_A".."_P"; payment method is direct_debit_monthly
      try {
        const product = await octopusGet(`/products/${productCode}/`);
        const single = product.single_register_electricity_tariffs || {};
        const dual = product.dual_register_electricity_tariffs || {};
        const regionKey = region ? `_${region}` : null;

        const dualRegion = (regionKey && dual[regionKey]) || dual;
        const dualBundle = dualRegion && (dualRegion.direct_debit_monthly || Object.values(dualRegion)[0]);
        if (dualBundle) {
          // Dual-register (Economy 7 style): day + night tariff rate arrays
          dayRate = currentValue((dualBundle.day_tariff && dualBundle.day_tariff.rates) || []);
          nightRate = currentValue((dualBundle.night_tariff && dualBundle.night_tariff.rates) || []);
          standingCharge = currentValue(dualBundle.standing_charges || []);
          hasOffPeak = nightRate != null;
        } else {
          // Single register (Intelligent Go etc.): flat standard unit rate + standing charge
          const singleRegion = (regionKey && single[regionKey]) || single;
          const bundle = singleRegion && (singleRegion.direct_debit_monthly || Object.values(singleRegion)[0]);
          if (bundle) {
            standingCharge = num(bundle.standing_charge_inc_vat);
            if (bundle.standard_unit_rate_inc_vat != null) dayRate = num(bundle.standard_unit_rate_inc_vat);
          }
          hasOffPeak = false;
        }
      } catch {}
    }

    // 3. Update active Tariff record (or create one)
    const tariffData = {
      name: "Octopus Intelligent Go",
      currency: "£",
      import_rate: dayRate ?? 0,
      export_rate: 15.0,
      off_peak_rate: nightRate ?? 0,
      has_off_peak: hasOffPeak,
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

    // 4. Half-hourly consumption — fetch newest ~7 days (data often lags a day or two)
    const devices = await base44.asServiceRole.entities.Device.list("-last_sync", 1);
    const deviceId = devices && devices[0] && devices[0].id;
    let stored = 0;
    if (deviceId) {
      let consumption = [];
      let nextPath = `/electricity-meter-points/${mpan}/meters/${serial}/consumption/?page_size=100&order_by=-period`;
      let guard = 0;
      while (nextPath && guard < 5) {
        const page = await octopusGet(nextPath);
        consumption = consumption.concat(page.results || []);
        if (!page.results || page.results.length < 100) break;
        nextPath = page.next ? String(page.next).replace(API_BASE, "") : null;
        guard++;
      }
      consumption = consumption
        .filter(c => Number(c.consumption) > 0)
        .sort((a, b) => new Date(a.interval_start) - new Date(b.interval_start));

      // Replace prior Octopus readings for this device to avoid duplicates
      await base44.asServiceRole.entities.EnergyReading.deleteMany({
        device_id: deviceId,
        source: "octopus"
      });

      const records = consumption.map(c => {
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
      day_rate_p: dayRate,
      night_rate_p: nightRate,
      standing_charge_p: standingCharge,
      has_off_peak: hasOffPeak,
      off_peak_window: `${offPeakStart}–${offPeakEnd}`,
      tariff_id: tariffId,
      consumption_readings: stored,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}