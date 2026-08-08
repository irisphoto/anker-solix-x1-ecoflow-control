import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Cloud, RefreshCw, AlertTriangle, CheckCircle2, LogOut, Zap, Save, Lock } from "lucide-react";

const COUNTRIES = [
  "AL","AM","AR","AT","AU","AZ","BA","BE","BG","BR","BY","CA","CH","CY","CZ","DE","DK","DZ","EE","EG","EL",
  "ES","FI","FR","GE","HK","HR","HU","IE","IL","IN","IS","IT","JO","JP","KR","LB","LI","LT","LU","LV","LY",
  "MA","MD","ME","MK","MT","MX","NG","NL","NO","NZ","PL","PS","PT","RO","RU","SE","SG","SI","SK","SY","TR",
  "TW","UA","UK","US","XK","ZA",
];

export default function Settings() {
  const [user, setUser] = React.useState(null);
  const [config, setConfig] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  const [ankerEmail, setAnkerEmail] = React.useState("");
  const [ankerPassword, setAnkerPassword] = React.useState("");
  const [ankerCountry, setAnkerCountry] = React.useState("UK");
  const [octoKey, setOctoKey] = React.useState("");
  const [octoAccount, setOctoAccount] = React.useState("");

  const [saving, setSaving] = React.useState(false);
  const [saveMsg, setSaveMsg] = React.useState(null);

  const [syncing, setSyncing] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const [octoSyncing, setOctoSyncing] = React.useState(false);
  const [octoMsg, setOctoMsg] = React.useState(null);

  React.useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        setUser(me);
        const list = await base44.entities.UserIntegration.list("-created_date", 1);
        const cfg = list && list[0] ? list[0] : null;
        setConfig(cfg);
        if (cfg) {
          setAnkerEmail(cfg.anker_email || "");
          setAnkerCountry(cfg.anker_country || "UK");
          setOctoAccount(cfg.octopus_account_number || "");
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const ankerConfigured = !!(config && config.anker_email && config.anker_password && config.anker_country);
  const octoConfigured = !!(config && config.octopus_api_key && config.octopus_account_number);
  const ankerReady = ankerConfigured || (!!ankerEmail.trim() && !!ankerPassword.trim());
  const octoReady = octoConfigured || (!!octoAccount.trim() && !!octoKey.trim());

  // Persist the current form to the user's own UserIntegration record (creates it on first save).
  const persist = async () => {
    const payload = {
      anker_email: ankerEmail.trim(),
      anker_country: ankerCountry,
      octopus_account_number: octoAccount.trim(),
    };
    if (ankerPassword.trim()) payload.anker_password = ankerPassword.trim();
    if (octoKey.trim()) payload.octopus_api_key = octoKey.trim();
    if (config && config.id) {
      await base44.entities.UserIntegration.update(config.id, payload);
    } else {
      await base44.entities.UserIntegration.create(payload);
    }
    const list = await base44.entities.UserIntegration.list("-created_date", 1);
    const cfg = list && list[0] ? list[0] : null;
    setConfig(cfg);
    setAnkerPassword("");
    setOctoKey("");
    return cfg;
  };

  const save = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      await persist();
      setSaveMsg({ ok: true, text: "Your details have been saved." });
    } catch (e) {
      setSaveMsg({ ok: false, text: e.message || "Could not save your details." });
    }
    setSaving(false);
  };

  const testConnection = async () => {
    setSyncing(true);
    setMsg(null);
    try {
      const cfg = await persist();
      if (!cfg || !cfg.anker_email || !cfg.anker_password) {
        setMsg({ ok: false, text: "Enter your Anker email and password first." });
        setSyncing(false);
        return;
      }
      const res = await base44.functions.invoke("syncAnkerData", {});
      if (res.data && res.data.success) {
        setMsg({ ok: true, text: `Connected as ${res.data.auth_user || "Anker user"}. Found ${res.data.site_count} site(s), synced ${res.data.devices_synced} device(s).` });
      } else {
        setMsg({ ok: false, text: res.data?.error || "Connection failed." });
      }
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    }
    setSyncing(false);
  };

  const syncOctopus = async () => {
    setOctoSyncing(true);
    setOctoMsg(null);
    try {
      const cfg = await persist();
      if (!cfg || !cfg.octopus_api_key || !cfg.octopus_account_number) {
        setOctoMsg({ ok: false, text: "Enter your Octopus API key and account number first." });
        setOctoSyncing(false);
        return;
      }
      const res = await base44.functions.invoke("syncOctopus", {});
      if (res.data && res.data.success) {
        setOctoMsg({
          ok: true,
          text: `Synced tariff: ${res.data.day_rate_p ?? 0}p peak / ${res.data.night_rate_p ?? 0}p off-peak (${res.data.off_peak_window}). Imported ${res.data.consumption_readings} half-hour readings from MPAN ${res.data.mpan}.`
        });
      } else {
        setOctoMsg({ ok: false, text: res.data?.error || "Octopus sync failed." });
      }
    } catch (e) {
      setOctoMsg({ ok: false, text: e.message });
    }
    setOctoSyncing(false);
  };

  const logout = () => base44.auth.logout();

  if (loading) return <div className="py-20 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Add your own Anker SOLIX and Octopus Energy details to use the app.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="w-4 h-4" /> Anker SOLIX Cloud
          </CardTitle>
          <CardDescription>
            Enter your own Anker account credentials. The app uses the unofficial cloud API to read and control your system on your behalf.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="anker-email">Anker email</Label>
              <Input id="anker-email" type="email" value={ankerEmail} onChange={(e) => setAnkerEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="anker-country">Country</Label>
              <Select value={ankerCountry} onValueChange={setAnkerCountry}>
                <SelectTrigger id="anker-country"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="anker-password">Anker password</Label>
              <Input id="anker-password" type="password" value={ankerPassword} onChange={(e) => setAnkerPassword(e.target.value)} placeholder={ankerConfigured ? "•••••• (leave blank to keep current)" : "Enter your Anker password"} autoComplete="new-password" />
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant={ankerConfigured ? "secondary" : "outline"} className="gap-1">
              {ankerConfigured ? <CheckCircle2 className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              {ankerConfigured ? "Anker connected" : "Anker not configured"}
            </Badge>
            <Button size="sm" onClick={testConnection} disabled={syncing || !ankerReady}>
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Testing…" : "Test & sync connection"}
            </Button>
          </div>
          {msg && (
            <div className={`text-sm rounded-lg p-3 ${msg.ok ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>{msg.text}</div>
          )}
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-200">
              The Anker cloud allows limited parallel sessions — signing in here may sign out the official SOLIX app, and the
              unofficial API can change without notice.
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4" /> Octopus Energy
          </CardTitle>
          <CardDescription>
            Enter your own Octopus API key and account number to pull your live tariff and half-hourly consumption.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="octo-account">Account number</Label>
              <Input id="octo-account" value={octoAccount} onChange={(e) => setOctoAccount(e.target.value)} placeholder="A-12345678" autoComplete="off" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="octo-key">API key</Label>
              <Input id="octo-key" type="password" value={octoKey} onChange={(e) => setOctoKey(e.target.value)} placeholder={octoConfigured ? "•••••• (leave blank to keep current)" : "sk_live_…"} autoComplete="off" />
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant={octoConfigured ? "secondary" : "outline"} className="gap-1">
              {octoConfigured ? <CheckCircle2 className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              {octoConfigured ? "Octopus connected" : "Octopus not configured"}
            </Badge>
            <Button size="sm" onClick={syncOctopus} disabled={octoSyncing || !octoReady}>
              <RefreshCw className={`w-4 h-4 mr-2 ${octoSyncing ? "animate-spin" : ""}`} />
              {octoSyncing ? "Syncing…" : "Sync Octopus tariff & consumption"}
            </Button>
          </div>
          {octoMsg && (
            <div className={`text-sm rounded-lg p-3 ${octoMsg.ok ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>{octoMsg.text}</div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving…" : "Save my details"}
        </Button>
        {saveMsg && (
          <span className={`text-sm ${saveMsg.ok ? "text-primary" : "text-destructive"}`}>{saveMsg.text}</span>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Account</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {user ? (
            <>
              <div className="text-sm text-foreground">{user.email}</div>
              <div className="text-xs text-muted-foreground capitalize">Role: {user.role}</div>
              <Button variant="outline" size="sm" onClick={logout}>
                <LogOut className="w-4 h-4 mr-2" /> Sign out
              </Button>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Loading account…</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}