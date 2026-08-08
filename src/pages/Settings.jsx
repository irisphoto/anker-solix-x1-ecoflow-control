import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { Cloud, RefreshCw, AlertTriangle, CheckCircle2, LogOut, Zap } from "lucide-react";

export default function Settings() {
  const [user, setUser] = React.useState(null);
  const [syncing, setSyncing] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const [octoSyncing, setOctoSyncing] = React.useState(false);
  const [octoMsg, setOctoMsg] = React.useState(null);

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const testConnection = async () => {
    setSyncing(true);
    setMsg(null);
    try {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Anker cloud connection and account</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="w-4 h-4" /> Anker SOLIX Cloud
          </CardTitle>
          <CardDescription>
            Connects with the Anker Power cloud using your account credentials. This uses the unofficial cloud API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="w-3 h-3" /> Credentials configured
            </Badge>
            <span className="text-xs text-muted-foreground">ANKER_EMAIL · ANKER_PASSWORD · ANKER_COUNTRY</span>
          </div>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-200">
              The Anker cloud allows limited parallel sessions. Signing in here may sign out the official SOLIX app, and the
              unofficial API can change without notice.
            </div>
          </div>
          <Button onClick={testConnection} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Testing…" : "Test & sync connection"}
          </Button>
          {msg && (
            <div className={`text-sm rounded-lg p-3 ${msg.ok ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
              {msg.text}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4" /> Octopus Energy
          </CardTitle>
          <CardDescription>
            Links your Octopus Intelligent Go account to pull your live tariff and half-hourly consumption.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="w-3 h-3" /> Credentials configured
            </Badge>
            <span className="text-xs text-muted-foreground">OCTOPUS_API_KEY · OCTOPUS_ACCOUNT_NUMBER</span>
          </div>
          <Button onClick={syncOctopus} disabled={octoSyncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${octoSyncing ? "animate-spin" : ""}`} />
            {octoSyncing ? "Syncing…" : "Sync Octopus tariff & consumption"}
          </Button>
          {octoMsg && (
            <div className={`text-sm rounded-lg p-3 ${octoMsg.ok ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
              {octoMsg.text}
            </div>
          )}
        </CardContent>
      </Card>

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