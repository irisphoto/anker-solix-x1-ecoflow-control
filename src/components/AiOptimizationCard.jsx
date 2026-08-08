import React from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, BatteryCharging, Car, ArrowUpRight, Lightbulb } from "lucide-react";

function WindowRow({ icon, color, label, window, nightOk }) {
  if (!window || !window.start) return null;
  const crosses = window.end_hour < window.start_hour;
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-3">
      <div className={`mt-0.5 rounded-md p-2 ${color}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{label}</span>
          <Badge variant="secondary" className="font-mono text-xs">
            {window.start} → {window.end}{crosses ? " (next day)" : ""}
          </Badge>
        </div>
        {window.reason && (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{window.reason}</p>
        )}
      </div>
    </div>
  );
}

export default function AiOptimizationCard({ device }) {
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState(null);

  const ask = async () => {
    if (!device) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await base44.functions.invoke("getAiOptimization", { device_id: device.id });
      const body = res && res.data ? res.data : res;
      if (body && body.error) throw new Error(body.error);
      setData(body);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const rec = data && data.recommendation;

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> AI Energy Advisor
            </CardTitle>
            <CardDescription>Smart charging & export plan from your live battery, solar and tariff.</CardDescription>
          </div>
          <Button size="sm" onClick={ask} disabled={loading || !device}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Thinking…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" /> Get AI plan
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="text-sm rounded-lg p-3 bg-destructive/10 text-destructive">{error}</div>
        )}

        {rec && (
          <>
            {rec.summary && (
              <p className="text-sm leading-relaxed text-foreground/90">{rec.summary}</p>
            )}

            <div className="grid gap-3 sm:grid-cols-1">
              <WindowRow
                icon={<BatteryCharging className="w-4 h-4 text-primary" />}
                color="bg-primary/10"
                label="Best time to charge battery"
                window={rec.battery_charge_window}
              />
              <WindowRow
                icon={<Car className="w-4 h-4 text-grid" />}
                color="bg-grid/10"
                label="Best time to charge EV"
                window={rec.ev_charge_window}
              />
              <WindowRow
                icon={<ArrowUpRight className="w-4 h-4 text-chart-4" />}
                color="bg-chart-4/10"
                label="Sell excess back to grid"
                window={rec.export_window}
              />
            </div>

            {rec.estimated_daily_savings_p > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="default" className="bg-primary">
                  Est. {new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(rec.estimated_daily_savings_p / 100)}/day saving
                </Badge>
                <span className="text-muted-foreground">vs always importing at peak</span>
              </div>
            )}

            {rec.tips && rec.tips.length > 0 && (
              <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <Lightbulb className="w-3.5 h-3.5" /> Tips
                </div>
                <ul className="space-y-1.5">
                  {rec.tips.map((tip, i) => (
                    <li key={i} className="text-xs text-foreground/80 flex gap-2">
                      <span className="text-primary">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {!rec && !loading && !error && (
          <p className="text-sm text-muted-foreground">
            Tap “Get AI plan” and I’ll analyse your battery, solar, EV charger and tariff to recommend the cheapest charge times and the best moment to export excess.
          </p>
        )}
      </CardContent>
    </Card>
  );
}