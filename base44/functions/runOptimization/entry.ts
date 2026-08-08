import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Smart tariff-aware optimization engine.
// Builds a 24h plan for a battery system using the active Tariff + Schedule.
// Strategy:
//  - Off-peak hours + charge_from_grid_off_peak: charge from grid up to max_soc
//  - Peak hours + discharge_during_peak: discharge battery to cover home load (peak shaving)
//  - All other hours: self-use (solar -> home -> battery -> grid)
//  - Never drop below backup_reserve_percent / min_soc
// Estimates daily savings vs a "always import" baseline.

const MODE_LABELS = {
  self_use: "Self-use",
  time_of_use: "Time-of-use",
  backup: "Backup reserve",
  peak_shaving: "Peak shaving",
  off_peak_charge: "Off-peak charge",
};

function parseHM(s) {
  const [h, m] = String(s || "00:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function rateForHour(hour, tariff) {
  const mins = hour * 60;
  let rate = tariff.import_rate;
  let band = "import";
  if (tariff.has_off_peak) {
    const s = parseHM(tariff.off_peak_start);
    const e = parseHM(tariff.off_peak_end);
    const inRange = s < e ? (mins >= s && mins < e) : (mins >= s || mins < e);
    if (inRange) { rate = tariff.off_peak_rate; band = "off_peak"; }
  }
  if (tariff.has_peak) {
    const s = parseHM(tariff.peak_start);
    const e = parseHM(tariff.peak_end);
    const inRange = s < e ? (mins >= s && mins < e) : (mins >= s || mins < e);
    if (inRange) { rate = tariff.peak_rate; band = "peak"; }
  }
  return { rate, band };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { device_id, apply } = body;
    if (!device_id) return Response.json({ error: 'device_id is required' }, { status: 400 });

    const device = await base44.asServiceRole.entities.Device.get(device_id);
    if (!device) return Response.json({ error: 'Device not found' }, { status: 404 });

    const tariffs = await base44.asServiceRole.entities.Tariff.filter({ is_active: true });
    const tariff = tariffs && tariffs[0] ? tariffs[0] : null;
    const schedules = await base44.asServiceRole.entities.Schedule.filter({ device_id });
    const schedule = schedules && schedules[0] ? schedules[0] : null;

    const mode = (schedule && schedule.mode) || "self_use";
    const minSoc = (schedule && schedule.backup_reserve_percent) || device.backup_reserve || 20;
    const maxSoc = (schedule && schedule.max_soc) || 100;
    const chargeOffPeak = schedule ? schedule.charge_from_grid_off_peak : true;
    const dischargePeak = schedule ? schedule.discharge_during_peak : true;

    // Typical home load profile (W) by hour - a representative UK domestic curve
    const loadProfile = [350,300,280,270,300,400,600,800,700,550,450,420,480,500,520,560,700,1100,1600,1800,1500,1100,800,500];

    const plan = [];
    let soc = device.battery_level || minSoc;
    let savingsP = 0; // pence
    let baselineP = 0; // pence
    const capacityWh = device.battery_capacity_wh || 5120;

    for (let hour = 0; hour < 24; hour++) {
      const { rate, band } = tariff ? rateForHour(hour, tariff) : { rate: 27, band: "import" };
      const homeLoadWh = loadProfile[hour];
      const homeLoadKwh = homeLoadWh / 1000;
      baselineP += homeLoadKwh * rate;

      let action = "self_use";
      let gridImportWh = 0;
      let gridExportWh = 0;
      let batteryDeltaSoc = 0;

      if (band === "off_peak" && chargeOffPeak && soc < maxSoc) {
        action = "charge_grid";
        const neededSoc = maxSoc - soc;
        const neededWh = (neededSoc / 100) * capacityWh;
        // assume 1.5kW charge rate
        const chargeWh = Math.min(neededWh, 1500);
        batteryDeltaSoc = (chargeWh / capacityWh) * 100;
        soc = Math.min(maxSoc, soc + batteryDeltaSoc);
        gridImportWh = chargeWh + homeLoadWh;
      } else if (band === "peak" && dischargePeak && soc > minSoc) {
        action = "discharge";
        const coverWh = Math.min(homeLoadWh, ((soc - minSoc) / 100) * capacityWh, 2500);
        batteryDeltaSoc = -(coverWh / capacityWh) * 100;
        soc = Math.max(minSoc, soc + batteryDeltaSoc);
        gridImportWh = homeLoadWh - coverWh;
        savingsP += (coverWh / 1000) * (tariff.peak_rate - (tariff.has_off_peak ? tariff.off_peak_rate : tariff.import_rate));
      } else {
        action = "self_use";
        const solarEstimate = hour >= 6 && hour <= 20 ? Math.max(0, Math.sin(((hour - 6) / 14) * Math.PI) * 3000) : 0;
        const net = solarEstimate - homeLoadWh;
        if (net >= 0) {
          const chargeWh = Math.min(net, ((maxSoc - soc) / 100) * capacityWh);
          batteryDeltaSoc = (chargeWh / capacityWh) * 100;
          soc = Math.min(maxSoc, soc + batteryDeltaSoc);
          gridExportWh = net - chargeWh;
          savingsP += (gridExportWh / 1000) * (tariff ? tariff.export_rate : 15);
        } else {
          const drawFromBattery = Math.min(-net, ((soc - minSoc) / 100) * capacityWh);
          batteryDeltaSoc = -(drawFromBattery / capacityWh) * 100;
          soc = Math.max(minSoc, soc + batteryDeltaSoc);
          gridImportWh = -net - drawFromBattery;
        }
      }

      plan.push({
        hour,
        band,
        rate,
        action,
        home_load_wh: Math.round(homeLoadWh),
        soc: Math.round(soc),
        grid_import_wh: Math.round(gridImportWh),
        grid_export_wh: Math.round(gridExportWh),
      });
    }

    const optimizedCostP = plan.reduce((acc, h) => acc + (h.grid_import_wh / 1000) * h.rate - (h.grid_export_wh / 1000) * (tariff ? tariff.export_rate : 15), 0);
    const dailySavingsP = baselineP - optimizedCostP + savingsP;

    let applied = false;
    if (apply) {
      await base44.asServiceRole.entities.Schedule.updateMany({ device_id }, { $set: { applied: true } }).catch(() => {});
      const update = {
        charging_mode: mode === "backup" ? "backup" : (chargeOffPeak && dischargePeak ? "time_of_use" : "self_use"),
        backup_reserve: minSoc,
        last_sync: new Date().toISOString(),
      };
      await base44.asServiceRole.entities.Device.update(device_id, update);
      applied = true;
    }

    return Response.json({
      success: true,
      device_id,
      mode,
      mode_label: MODE_LABELS[mode] || mode,
      tariff: tariff ? tariff.name : "Default",
      plan,
      estimated_daily_savings_p: Math.round(dailySavingsP),
      estimated_monthly_savings_p: Math.round(dailySavingsP * 30),
      applied,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}