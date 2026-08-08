import React from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Battery, Zap, Car, Cpu, RefreshCw } from "lucide-react";

// Groups the physical components returned by the Anker site detail API.
function categorize(dev) {
  const name = (dev.name || "").toLowerCase();
  if (name.includes("ev charger") || dev.type === 9) return "ev";
  if (name.includes("battery") || dev.model === "A5220") return "battery";
  if (name.includes("x1-h") || dev.model === "A5102") return "inverter";
  return "other";
}

const GROUPS = [
  { key: "battery", label: "Batteries", icon: Battery, color: "hsl(var(--battery))" },
  { key: "inverter", label: "Inverters", icon: Zap, color: "hsl(var(--solar))" },
  { key: "ev", label: "EV Charger", icon: Car, color: "hsl(var(--grid))" },
  { key: "other", label: "Accessories", icon: Cpu, color: "hsl(var(--muted-foreground))" },
];

function ComponentCard({ dev }) {
  const online = dev.status === 1;
  return (
    <Card className="overflow-hidden">
      <div className="aspect-[4/3] bg-muted/40 flex items-center justify-center p-4">
        {dev.img ? (
          <img src={dev.img} alt={dev.name} className="max-h-full max-w-full object-contain" />
        ) : (
          <Cpu className="w-10 h-10 text-muted-foreground" />
        )}
      </div>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-heading font-semibold text-foreground truncate">{dev.name}</div>
            <div className="text-[11px] text-muted-foreground">Model {dev.model}</div>
          </div>
          <Badge variant={online ? "default" : "secondary"} className="shrink-0">
            {online ? "online" : "offline"}
          </Badge>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground font-mono truncate">{dev.sn}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DeviceComponents() {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("getDeviceComponents", {});
      setData(res.data || res);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  React.useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error) {
    return <div className="text-sm text-destructive">Couldn't load components: {error}</div>;
  }
  if (!data || !data.sites || !data.sites.length) {
    return <div className="text-sm text-muted-foreground">No components found.</div>;
  }

  return (
    <div className="space-y-6">
      {data.sites.map((site) => {
        const grouped = {};
        for (const d of site.devices) {
          const k = categorize(d);
          (grouped[k] ||= []).push(d);
        }
        return (
          <div key={site.site_id} className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-heading font-semibold text-foreground">{site.site_name}</h3>
              <Badge variant="secondary">{site.devices.length} components</Badge>
            </div>
            {GROUPS.filter((g) => grouped[g.key] && grouped[g.key].length).map((g) => {
              const Icon = g.icon;
              return (
                <div key={g.key}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4" style={{ color: g.color }} />
                    <span className="text-sm font-heading font-semibold text-foreground">{g.label}</span>
                    <span className="text-xs text-muted-foreground">· {grouped[g.key].length}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {grouped[g.key].map((d) => (
                      <ComponentCard key={d.sn} dev={d} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}