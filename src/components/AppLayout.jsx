import React from "react";
import { Outlet, NavLink, Link } from "react-router-dom";
import { LayoutDashboard, Zap, LineChart, BatteryFull, Settings, Sun } from "lucide-react";
import { base44 } from "@/api/base44Client";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/optimization", label: "Optimization", icon: Zap },
  { to: "/history", label: "History", icon: LineChart },
  { to: "/devices", label: "Devices", icon: BatteryFull },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function AppLayout() {
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden md:flex w-60 flex-col border-r border-border bg-sidebar">
        <Link to="/" className="flex items-center gap-2 px-6 h-16 border-b border-border">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Sun className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-heading font-semibold text-foreground leading-tight">SolixX</div>
            <div className="text-[11px] text-muted-foreground leading-tight">Energy Companion</div>
          </div>
        </Link>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-primary text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        {user && (
          <div className="p-3 border-t border-border">
            <div className="px-3 py-2 rounded-lg bg-sidebar-accent">
              <div className="text-xs font-medium text-sidebar-accent-foreground truncate">{user.email}</div>
              <div className="text-[11px] text-muted-foreground capitalize">{user.role}</div>
            </div>
          </div>
        )}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-border bg-background sticky top-0 z-10">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sun className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-heading font-semibold">SolixX</span>
          </Link>
        </header>
        <nav className="md:hidden flex items-center gap-1 px-2 py-2 border-b border-border overflow-x-auto">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                }`
              }
            >
              <item.icon className="w-3.5 h-3.5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}