import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const THRESHOLD_GBP = 1.0;
const RECIPIENT_EMAIL = "philsturdevant@icloud.com";
const TIMEZONE = "Europe/London";

function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }

function localNow() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE, weekday: "short", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date());
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    // Scheduled runs have no app user, but auth.me() returns the owner in this app's setup.
    const user = await base44.auth.me().catch(() => null);

    const devices = await base44.asServiceRole.entities.Device.list("-last_sync", 1);
    const device = devices && devices[0];
    if (!device) return Response.json({ error: "No device found." }, { status: 400 });

    const tariffs = await base44.asServiceRole.entities.Tariff.filter({ is_active: true });
    const tariff = tariffs && tariffs[0];

    // Daily battery savings = battery discharge (Wh) -> kWh * peak rate (p) -> GBP
    const dischargeKwh = num(device.battery_discharge_wh) / 1000;
    const peakRate = tariff ? num(tariff.peak_rate) : 0;
    const savingsGbp = +(dischargeKwh * peakRate / 100).toFixed(2);

    const result = {
      device: device.name,
      battery_discharge_kwh: dischargeKwh,
      peak_rate_p: peakRate,
      savings_gbp: savingsGbp,
      threshold_gbp: THRESHOLD_GBP,
      triggered: false,
      notified: false,
      recipient: RECIPIENT_EMAIL,
    };

    if (savingsGbp < THRESHOLD_GBP) {
      return Response.json({ success: true, ...result, reason: "below threshold" });
    }
    result.triggered = true;

    const subject = `🔋 Battery savings alert: £${savingsGbp.toFixed(2)} today`;
    const body = [
      `Hi,`,
      ``,
      `Your Anker SOLIX X1 saved £${savingsGbp.toFixed(2)} today (${localNow()}).`,
      ``,
      `• Battery discharged to home: ${dischargeKwh.toFixed(2)} kWh`,
      `• Peak import rate avoided: ${peakRate.toFixed(1)}p/kWh`,
      `• Threshold: £${THRESHOLD_GBP.toFixed(2)}`,
      ``,
      `Great performance — keep it up!`,
      `EcoFlow Control`,
    ].join("\n");

    try {
      await base44.integrations.Core.SendEmail({
        to: RECIPIENT_EMAIL,
        subject,
        body,
        from_name: "EcoFlow Control",
      });
      result.notified = true;
    } catch (e) {
      result.email_error = e.message;
    }

    return Response.json({ success: result.notified, ...result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}