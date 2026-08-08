import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getOctopusCreds } from "../../shared/userIntegration.ts";

const API_BASE = "https://api.octopus.energy/v1";

function authHeader(apiKey) {
  return "Basic " + Buffer.from(apiKey + ":").toString("base64");
}

async function octopusGet(path, apiKey) {
  const res = await fetch(API_BASE + path, { headers: { Authorization: authHeader(apiKey) } });
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

    let creds;
    try { creds = await getOctopusCreds(base44); }
    catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
    const { apiKey, accountNumber } = creds;

    // 1. Account → active import electricity meter point + current agreement
    const account = await octopusGet(`/accounts/${accountNumber}/`, apiKey);
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

    // 2. Parse product code + region from tariff code
    let productCode = null, region = null;
    const m = tariffCode.match(/^[A-Z]-1R-(.+)-([A-P])$/);
    if (m) { productCode = m[1]; region = m[2]; }

    let dayRate = null, nightRate = null, standingCharge = null;
    let hasOffPeak = false;
    let offPeakStart = "23:30";
    let offPeakEnd = "05:30";

    if (productCode) {
      try {
        const product = await octopusGet(`/products/${productCode}/`, apiKey);
        const single = product.single_register_electricity_tariffs || {};
        const dual = product.dual_register_electricity_tariffs || {};
        const regionKey = region ? `_${region}` : null;

        const dualRegion = (regionKey && dual[regionKey]) || dual;
        const dualBundle = dualRegion && (dualRegion.direct_debit_monthly || Object.values(dualRegion)[0]);
        if (dualBundle) {
          dayRate = currentValue((dualBundle.day_tariff && dualBundle.day_tariff.rates) || []);
          nightRate = currentValue((dualBundle.night_tariff && dualBundle.night_tariff.rates) || []);
          standingCharge = currentValue(dualBundle.standing_charges || []);
          hasOffPeak = nightRate != null;
        } else {
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

    // 3. Update the caller's active Tariff record (RLS-scoped to them)
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
    const existingTariffs = await base44.entities.Tariff.filter({ is_active: true });
    let tariffId;
    if (existingTariffs && existingTariffs.length) {
      await base44.entities.Tariff.update(existingTariffs[0].id, tariffData);
      tariffId = existingTariffs[0].id;
    } else {
      const t = await base44.entities.Tariff.create(tariffData);
      tariffId = t.id;
    }

    // 4. Half-hourly consumption — incremental backfill, scoped to the caller's device
    const devices = await base44.entities.Device.list("-last_sync", 1);
    const deviceId = devices && devices[0] && devices[0].id;
    let stored = 0;
    if (deviceId) {
      const latest = await base44.entities.EnergyReading.filter(
        { device_id: deviceId, source: "octopus" }, "-timestamp", 1
      );
      const lastTs = latest && latest[0] && latest[0].timestamp ? new Date(latest[0].timestamp).getTime() : null;
      const periodFrom = lastTs
        ? new Date(lastTs).toISOString()
        : new Date(Date.now() - 730 * 24 * 3600 * 1000).toISOString();

      let consumption = [];
      let nextPath = `/electricity-meter-points/${mpan}/meters/${serial}/consumption/?page_size=25000&order_by=period&period_from=${periodFrom}`;
      let guard = 0;
      while (nextPath && guard < 20) {
        const page = await octopusGet(nextPath, apiKey);
        consumption = consumption.concat(page.results || []);
        nextPath = page.next ? String(page.next).replace(API_BASE, "") : null;
        guard++;
      }
      consumption = consumption
        .filter(c => Number(c.consumption) > 0 && (!lastTs || new Date(c.interval_start).getTime() > lastTs))
        .sort((a, b) => new Date(a.interval_start) - new Date(b.interval_start));

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
      for (let i = 0; i < records.length; i += 500) {
        await base44.entities.EnergyReading.bulkCreate(records.slice(i, i + 500));
      }
      stored = records.length;
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