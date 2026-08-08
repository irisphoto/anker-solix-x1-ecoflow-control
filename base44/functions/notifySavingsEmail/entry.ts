import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const THRESHOLD_GBP = 1.0;
const TIMEZONE = "Europe/London";

function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }

function localNow() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE, weekday: "short", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date());
}

// Daily savings email. Runs on the calling user's own data (RLS-scoped user
// context) and is sent to that user's registered email address.
// (Scheduled workflows run as the app owner, so this covers the owner today;
// per-user scheduled automation is a planned enhancement.)

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "No user found." }, { status: 400 });

    const devices = await base44.entities.Device.list("-last_sync", 1);
    const device = devices && devices[0];
    if (!device) return Response.json({ error: "No device found." }, { status: 400 });

    const tariffs = await base44.entities.Tariff.filter({ is_active: true });
    const tariff = tariffs && tariffs[0];

    const dischargeKwh = num(device.battery_discharge_wh) / 1000;
    const peakRate = tariff ? num(tariff.peak_rate) : 0;
    const savingsGbp = +(dischargeKwh * peakRate / 100).toFixed(2);

    const recipient = user.email;

    const result = {
      device: device.name,
      battery_discharge_kwh: dischargeKwh,
      peak_rate_p: peakRate,
      savings_gbp: savingsGbp,
      threshold_gbp: THRESHOLD_GBP,
      triggered: false,
      notified: false,
      recipient,
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
        to: recipient,
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