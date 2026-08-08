import React from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { TrendingDown, Loader2 } from "lucide-react";

const DAY_MS = 86400000;

function dayKey(d) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "2-digit", month: "short" }).format(d);
}

export default function SavingsChart() {
  const [view, setView] = React.useState("daily"); // daily | monthly
  const [dailyRows, setDailyRows] = React.useState([]);
  const [monthRows, setMonthRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [today, setToday] = React.useState(0);
  const [monthTotal, setMonthTotal] = React.useState(0);
  const [currency, setCurrency] = React.useState("£");

  React.useEffect(() => {
    (async () => {
      let tariff = null;
      try {
        const t = await base44.entities.Tariff.filter({ is_active: true }, "-created_date", 1);
        tariff = (t && t[0]) || null;
      } catch { /* ignore */ }
      const peakRate = tariff ? (tariff.has_peak ? Number(tariff.peak_rate) : Number(tariff.import_rate)) : 0;
      setCurrency((tariff && tariff.currency) || "£");

      // Collect ~30 days of hourly readings (each reading ≈ 1h of power → Wh)
      let readings = [];
      try {
        readings = await base44.entities.EnergyReading.list("-timestamp", 1000);
      } catch { readings = []; }

      const byDay = {}; // yyyy-mm-dd -> dischargeWh
      for (const r of readings || []) {
        if (!r.timestamp) continue;
        const ts = new Date(r.timestamp);
        const key = ts.toISOString().slice(0, 10);
        const discharge = Math.max(0, Number(r.battery_power_w) || 0);
        byDay[key] = (byDay[key] || 0) + discharge; // Wh
      }

      const now = Date.now();
      const daily = [];
      let monthSum = 0;
      const londonMonth = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", month: "long" }).format(new Date());

      for (let i = 13; i >= 0; i--) {
        const d = new Date(now - i * DAY_MS);
        const key = d.toISOString().slice(0, 10);
        const kwh = (byDay[key] || 0) / 1000;
        const gbp = +(kwh * peakRate / 100).toFixed(2);
        daily.push({ label: dayKey(d), savings: gbp });
        if (i < 30) monthSum += gbp;
      }

      // Full 30-day month total
      let mTotal = 0;
      for (let i = 0; i < 30; i++) {
        const d = new Date(now - i * DAY_MS);
        const key = d.toISOString().slice(0, 10);
        mTotal += ((byDay[key] || 0) / 1000) * peakRate / 100;
      }

      // Monthly buckets — last 6 months in chronological order, current month included
      const monthMap = {};
      for (let i = 179; i >= 0; i--) {
        const d = new Date(now - i * DAY_MS);
        const key = d.toISOString().slice(0, 10);
        const label = new Intl.DateTimeFormat("en-GB", { month: "short" }).format(d);
        const kwh = (byDay[key] || 0) / 1000;
        monthMap[label] = (monthMap[label] || 0) + kwh * peakRate / 100;
      }
      const monthRows = Object.entries(monthMap).map(([label, v]) => ({ label, savings: +v.toFixed(2) }));

      setDailyRows(daily);
      setMonthRows(monthRows);
      setToday(daily[daily.length - 1]?.savings || 0);
      setMonthTotal(+mTotal.toFixed(2));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = view === "daily" ? dailyRows : monthRows;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Savings Over Time</CardTitle>
          <div className="flex items-center gap-1">
            <Button size="sm" variant={view === "daily" ? "default" : "outline"} onClick={() => setView("daily")}>Daily</Button>
            <Button size="sm" variant={view === "monthly" ? "default" : "outline"} onClick={() => setView("monthly")}>Monthly</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
          <div className="shrink-0">
            <div className="text-xs text-muted-foreground whitespace-nowrap">Today</div>
            <div className="text-xl font-heading font-bold text-foreground whitespace-nowrap">{currency}{today.toFixed(2)}</div>
          </div>
          <div className="w-px h-8 bg-border shrink-0" />
          <div className="shrink-0">
            <div className="text-xs text-muted-foreground whitespace-nowrap">Last 30 days</div>
            <div className="text-xl font-heading font-bold text-primary whitespace-nowrap">{currency}{monthTotal.toFixed(2)}</div>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap sm:ml-auto">
            <TrendingDown className="w-3.5 h-3.5 text-primary shrink-0" /> peak-rate avoidance
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No battery usage history yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={rows} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${currency}${v}`} />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v) => [`${currency}${Number(v).toFixed(2)}`, "Saved"]}
              />
              <Bar dataKey="savings" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}