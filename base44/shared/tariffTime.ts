// Shared tariff time helpers used by scheduled charging-rule functions.
// All comparisons are in the Europe/London timezone (UK energy market).

export const TARIFF_TIMEZONE = "Europe/London";

export function toMin(hhmm) {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function currentMinutes() {
  const s = new Intl.DateTimeFormat("en-GB", {
    timeZone: TARIFF_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date());
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

export function inWindow(cur, startStr, endStr) {
  const s = toMin(startStr), e = toMin(endStr);
  if (s === e) return false;
  if (s < e) return cur >= s && cur < e;
  return cur >= s || cur < e; // wraps midnight
}