import React from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { PiggyBank, TrendingDown } from "lucide-react";

export default function SavingsCard({ device }) {
  const [tariff, setTariff] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.Tariff.filter({ is_active: true }, "-created_date", 1);
        setTariff((list && list[0]) || null);
      } catch { setTariff(null); }
      setLoading(false);
    })();
  }, []);

  if (!device) return null;

  const dischargeWh = Math.max(0, Number(device.battery_discharge_wh) || 0);
  const batteryKwh = dischargeWh / 1000;

  const peakRate = tariff
    ? (tariff.has_peak ? Number(tariff.peak_rate) : Number(tariff.import_rate))
    : 0;
  const saved = (batteryKwh * peakRate) / 100; // p/kWh → £
  const currency = (tariff && tariff.currency) || "£";
  const peakWindow = tariff && tariff.has_peak ? `${tariff.peak_start}–${tariff.peak_end}` : null;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <PiggyBank className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-muted-foreground">Saved today with battery</div>
            <div className="text-3xl font-heading font-bold text-foreground">
              {currency}
              {loading ? "—" : saved.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {batteryKwh.toFixed(2)} kWh from battery avoided{" "}
              <span className="font-medium text-foreground">{peakRate.toFixed(1)}p/kWh</span>{" "}
              peak grid import{peakWindow ? ` (${peakWindow})` : ""}
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-primary text-xs font-medium shrink-0">
            <TrendingDown className="w-4 h-4" />
            peak shaving
          </div>
        </div>
      </CardContent>
    </Card>
  );
}