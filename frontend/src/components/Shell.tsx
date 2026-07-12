import type { ReactNode } from "react";
import { useAuth } from "../lib/auth";
import { roleLabel } from "../lib/api";
import NotificationBell from "./NotificationBell";

export interface NavItem {
  key: string;
  label: string;
  roles: string[]; // roles that can see this item; empty = everyone
  section: "workspace" | "operations" | "admin";
}

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", roles: [], section: "workspace" },
  { key: "vehicles", label: "Vehicles", roles: ["ADMIN", "FLEET_MANAGER", "FINANCIAL_MANAGER"], section: "operations" },
  { key: "drivers", label: "Drivers", roles: ["ADMIN", "FLEET_MANAGER", "SAFETY_MANAGER"], section: "operations" },
  { key: "trips", label: "Trips", roles: ["ADMIN", "FLEET_MANAGER", "SAFETY_MANAGER", "FINANCIAL_MANAGER"], section: "operations" },
  { key: "my-trips", label: "My Trips", roles: ["DRIVER"], section: "operations" },
  { key: "maintenance", label: "Maintenance", roles: ["ADMIN", "FLEET_MANAGER"], section: "operations" },
  { key: "fuel-expenses", label: "Fuel & Expenses", roles: ["ADMIN", "FLEET_MANAGER", "FINANCIAL_MANAGER"], section: "operations" },
  { key: "activity", label: "Activity Log", roles: ["ADMIN"], section: "admin" },
  { key: "users", label: "Users", roles: ["ADMIN"], section: "admin" },
];

const SECTION_LABELS: Record<NavItem["section"], string | null> = {
  workspace: null,
  operations: "Operations",
  admin: "Admin",
};

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Fleet overview and key metrics" },
  vehicles: { title: "Vehicles", subtitle: "Manage your fleet vehicles" },
  drivers: { title: "Drivers", subtitle: "Driver profiles, licences and compliance" },
  trips: { title: "Trips", subtitle: "Plan, dispatch and track trips" },
  "my-trips": { title: "My Trips", subtitle: "Trips assigned to you" },
  maintenance: { title: "Maintenance", subtitle: "Service logs and vehicle upkeep" },
  "fuel-expenses": { title: "Fuel & Expenses", subtitle: "Fuel logs and operating costs" },
  activity: { title: "Activity Log", subtitle: "Audit trail of all actions" },
  users: { title: "Users", subtitle: "Manage team members and roles" },
};

function NavIcon({ page }: { page: string }) {
  const common = {
    className: "w-4 h-4 shrink-0",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    viewBox: "0 0 24 24",
  };
  switch (page) {
    case "dashboard":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      );
    case "vehicles":
      return (
        <svg {...common}>
          <path d="M1 8h11v8H1zM12 10h4l3 3v3h-7" /><circle cx="5.5" cy="17.5" r="1.8" /><circle cx="15.5" cy="17.5" r="1.8" />
        </svg>
      );
    case "drivers":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c.7-3 2.9-4.5 5.5-4.5s4.8 1.5 5.5 4.5" /><path d="M16 4.5a3.2 3.2 0 010 7M20.5 19c-.4-2-1.5-3.4-3-4.1" />
        </svg>
      );
    case "trips":
    case "my-trips":
      return (
        <svg {...common}>
          <circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M8 19h6.5a3.5 3.5 0 000-7h-5a3.5 3.5 0 010-7H16" />
        </svg>
      );
    case "maintenance":
      return (
        <svg {...common}>
          <path d="M14.7 6.3a4.5 4.5 0 00-6 5.6L3 17.6a2 2 0 102.8 2.8l5.7-5.7a4.5 4.5 0 005.6-6l-3 3-2.8-2.8 3-3z" />
        </svg>
      );
    case "fuel-expenses":
      return (
        <svg {...common}>
          <path d="M4 21V6a2 2 0 012-2h6a2 2 0 012 2v15M2 21h14M14 10h2a2 2 0 012 2v4.5a1.5 1.5 0 003 0V9l-3-3" /><path d="M7 8h4" />
        </svg>
      );
    case "activity":
      return (
        <svg {...common}>
          <path d="M22 12h-4l-3 8-6-16-3 8H2" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <circle cx="12" cy="7.5" r="3.5" /><path d="M5 20c.9-3.5 3.6-5.5 7-5.5s6.1 2 7 5.5" />
        </svg>
      );
    default:
      return null;
  }
}

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

  const sections: NavItem["section"][] = ["workspace", "operations", "admin"];
  const heading = PAGE_TITLES[page] ?? PAGE_TITLES.dashboard;
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-white border-r border-slate-200 flex flex-col fixed inset-y-0 left-0 z-40">
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-slate-100">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M5 17l4-12 3 8 3-5 4 9" />
            </svg>
          </div>
          <div className="font-semibold text-[15px] tracking-tight text-slate-900">TransitOps</div>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
          {sections.map((section) => {
            const items = visibleNav.filter((i) => i.section === section);
            if (items.length === 0) return null;
            return (
              <div key={section}>
                {SECTION_LABELS[section] && (
                  <div className="px-2 mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {SECTION_LABELS[section]}
                  </div>
                )}
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const active = page === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => onNavigate(item.key)}
                        className={`w-full flex items-center gap-2.5 text-left px-2.5 py-[7px] rounded-md text-[13px] font-medium transition cursor-pointer ${
                          active
                            ? "bg-indigo-50 text-indigo-700"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                      >
                        <span className={active ? "text-indigo-600" : "text-slate-400"}>
                          <NavIcon page={item.key} />
                        </span>
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* User block */}
        <div className="border-t border-slate-100 p-3">
          <div className="flex items-center gap-2.5 px-1.5 py-1.5 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[11px] font-semibold text-slate-600 shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-slate-900 truncate">{user.name}</div>
              <div className="text-[11px] text-slate-500 truncate">{roleLabel(user.role)}</div>
            </div>
            <button
              onClick={() => void logout()}
              title="Log out"
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M9 21H6a2 2 0 01-2-2V5a2 2 0 012-2h3M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 ml-60">
        <header className="h-14 bg-white/80 backdrop-blur border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30">
          <div className="flex items-baseline gap-3 min-w-0">
            <h1 className="text-[15px] font-semibold text-slate-900 tracking-tight">{heading.title}</h1>
            <span className="text-[13px] text-slate-400 truncate hidden sm:block">{heading.subtitle}</span>
          </div>
          <NotificationBell />
        </header>
        <main className="flex-1 px-6 py-6 overflow-auto">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
