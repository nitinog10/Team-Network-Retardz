import type { ReactNode } from "react";
import { useAuth } from "../lib/auth";
import { roleLabel } from "../lib/api";
import NotificationBell from "./NotificationBell";

export interface NavItem {
  key: string;
  label: string;
  roles: string[]; // roles that can see this item; empty = everyone
}

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", roles: [] },
  { key: "vehicles", label: "Vehicles", roles: ["ADMIN", "FLEET_MANAGER", "FINANCIAL_MANAGER"] },
  { key: "drivers", label: "Drivers", roles: ["ADMIN", "FLEET_MANAGER", "SAFETY_MANAGER"] },
  { key: "trips", label: "Trips", roles: ["ADMIN", "FLEET_MANAGER", "SAFETY_MANAGER", "FINANCIAL_MANAGER"] },
  { key: "my-trips", label: "My Trips", roles: ["DRIVER"] },
  { key: "maintenance", label: "Maintenance", roles: ["ADMIN", "FLEET_MANAGER"] },
  { key: "fuel-expenses", label: "Fuel & Expenses", roles: ["ADMIN", "FLEET_MANAGER", "FINANCIAL_MANAGER"] },
  { key: "activity", label: "Activity Log", roles: ["ADMIN"] },
  { key: "users", label: "Users", roles: ["ADMIN"] },
];

interface ShellProps {
  page: string;
  onNavigate: (page: string) => void;
  children: ReactNode;
}

export default function Shell({ page, onNavigate, children }: ShellProps) {
  const { user, logout } = useAuth();
  if (!user) return null;

  const visibleNav = NAV_ITEMS.filter(
    (item) => item.roles.length === 0 || item.roles.includes(user.role),
  );

  return (
    <div className="min-h-screen flex bg-slate-100">
      <aside className="w-56 shrink-0 bg-slate-900 text-slate-100 flex flex-col">
        <div className="px-5 py-5 text-xl font-bold tracking-tight border-b border-slate-800">
          TransitOps
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {visibleNav.map((item) => (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`w-full text-left px-3 py-2 rounded-lg transition ${
                page === item.key
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="px-5 py-4 text-xs text-slate-500 border-t border-slate-800">
          Odoo Hackathon 2026
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <div className="font-semibold text-slate-700 capitalize">{page.replace("-", " ")}</div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <div className="text-right">
              <div className="text-sm font-medium text-slate-800">{user.name}</div>
              <div className="text-xs text-slate-500">{roleLabel(user.role)}</div>
            </div>
            <button
              onClick={() => void logout()}
              className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition"
            >
              Logout
            </button>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
