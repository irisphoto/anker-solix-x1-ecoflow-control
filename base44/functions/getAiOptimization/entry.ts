import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// AI energy advisor.
// Feeds the LLM the live battery state, EV charger draw, active tariff windows and
// today's generation/usage, and asks for the best windows to:
//   - charge the home battery (cheapest grid import)
//   - charge the EV (off-peak / solar surplus)
//   - export excess back to the grid (highest export price)
// Returns a structured recommendation the UI can render as a plan.

function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }
function fmtTime(hh) {
  if (hh == null || isNaN(hh)) return "";
  const h = Math.floor(hh);
  const m = Math.round((hh - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m === 60 ? 0 : m).padStart(2, "0")}`;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "One or two sentence plain-English summary of the recommended plan." },
    battery_charge_window: {
      type: "object",
      properties: {
        start_hour: { type: "number", description: "Decimal hour 0-24 to start charging the battery" },
        end_hour: { type: "number", description: "Decimal hour 0-24 to stop charging the battery" },
        reason: { type: "string" }
      }
    },
    ev_charge_window: {
      type: "object",
      properties: {
        start_hour: { type: "number", description: "Decimal hour 0-24 to start charging the EV" },
        end_hour: { type: "number", description: "Decimal hour 0-24 to stop charging the EV" },
        reason: { type: "string" }
      }
    },
    export_window: {
      type: "object",
      properties: {
        start_hour: { type: "number", description: "Decimal hour 0-24 to start exporting excess to grid" },
        end_hour: { type: "number", description: "Decimal hour 0-24 to stop exporting excess to grid" },
        reason: { type: "string" }
      }
    },
    estimated_daily_savings_p: { type: "number", description: "Estimated saving in pence per day vs always importing at peak" },
    tips: { type: "array", items: { type: "string" } }
  },
  required: ["summary", "battery_charge_window", "ev_charge_window", "export_window"]
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { device_id } = body;

    const devices = device_id
      ? [await base44.asServiceRole.entities.Device.get(device_id)]
      : await base44.asServiceRole.entities.Device.list();
    const device = (devices && devices[0]) || null;
    if (!device) return Response.json({ error: 'No device found' }, { status: 404 });

    const tariffs = await base44.asServiceRole.entities.Tariff.filter({ is_active: true });
    const tariff = (tariffs && tariffs[0]) || null;

    // Recent readings for today's shape (optional context)
    let readings = [];
    try {
      readings = await base44.asServiceRole.entities.EnergyReading.filter({ device_id: device.id }, '-timestamp', 24);
    } catch { readings = []; }

    const ctx = {
      device_name: device.name,
      battery_level_pct: num(device.battery_level),
      battery_capacity_wh: num(device.battery_capacity_wh) || 5120,
      battery_power_w: num(device.battery_power_w), // +ve discharging to home
      solar_power_w: num(device.solar_power_w),
      home_usage_w: num(device.home_usage_w),
      grid_power_w: num(device.grid_power_w), // +ve importing
      ev_charger_power_w: num(device.ev_charger_power_w),
      solar_today_wh: num(device.solar_today_wh),
      home_today_wh: num(device.home_today_wh),
      grid_import_wh: num(device.grid_import_wh),
      grid_export_wh: num(device.grid_export_wh),
      battery_charge_wh: num(device.battery_charge_wh),
      battery_discharge_wh: num(device.battery_discharge_wh),
      system_mode: num(device.system_mode),
      charging_mode: device.charging_mode,
      backup_reserve: num(device.backup_reserve),
    };

    const t = tariff || {};
    const tariffCtx = {
      name: t.name,
      import_rate_p_kwh: num(t.import_rate),
      export_rate_p_kwh: num(t.export_rate),
      has_off_peak: !!t.has_off_peak,
      off_peak_rate_p_kwh: num(t.off_peak_rate),
      off_peak_start: t.off_peak_start,
      off_peak_end: t.off_peak_end,
      has_peak: !!t.has_peak,
      peak_rate_p_kwh: num(t.peak_rate),
      peak_start: t.peak_start,
      peak_end: t.peak_end,
    };

    const now = new Date();
    const localTime = now.toLocaleString("en-GB", { timeZone: "Europe/London" });

    const prompt = `You are an expert home-energy optimisation advisor for a UK household with an Anker SOLIX X1 battery system, solar panels and an EV charger on a time-of-use electricity tariff.

Current local time: ${localTime}.

LIVE SYSTEM STATE:
${JSON.stringify(ctx, null, 2)}

ACTIVE TARIFF (pence per kWh):
${JSON.stringify(tariffCtx, null, 2)}

RECENT ENERGY READINGS (last 24, most recent first):
${JSON.stringify((readings || []).slice(0, 24).map(r => ({ time: r.timestamp, solar_w: r.solar_power_w, home_w: r.home_usage_w, battery_w: r.battery_power_w, grid_w: r.grid_power_w, soc: r.battery_level })), null, 2)}

Produce a recommendation plan for the rest of today that maximises savings. Consider:
- Charging the home battery when grid power is cheapest (off-peak), up to full capacity.
- Charging the EV during off-peak hours and/or solar surplus, avoiding peak import.
- Exporting excess solar/battery back to the grid when the export rate is most valuable (often peak hours).
- Keeping a backup reserve so the battery never fully drains.
Return only valid JSON matching the schema. Use decimal hours (0-24) for window boundaries. Be concrete with times and explain each choice briefly.`;

    const llm = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: RESPONSE_SCHEMA,
      add_context_from_internet: false,
    });

    // InvokeLLM with response_json_schema returns a dict already.
    let rec = llm && llm.data ? llm.data : llm;
    if (!rec || typeof rec !== "object") rec = { summary: "No recommendation returned.", tips: [] };

    // Normalize window times for the UI.
    function win(w) {
      if (!w) return null;
      return {
        start_hour: num(w.start_hour),
        end_hour: num(w.end_hour),
        start: fmtTime(w.start_hour),
        end: fmtTime(w.end_hour),
        reason: w.reason || "",
      };
    }

    return Response.json({
      success: true,
      generated_at: now.toISOString(),
      device: { id: device.id, name: device.name, battery_level_pct: ctx.battery_level_pct },
      recommendation: {
        summary: rec.summary || "",
        battery_charge_window: win(rec.battery_charge_window),
        ev_charge_window: win(rec.ev_charge_window),
        export_window: win(rec.export_window),
        estimated_daily_savings_p: num(rec.estimated_daily_savings_p),
        tips: Array.isArray(rec.tips) ? rec.tips : [],
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}