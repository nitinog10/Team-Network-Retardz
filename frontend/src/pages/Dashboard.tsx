import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import type { DashboardStats, MonthlyData } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "#10b981",
  ON_TRIP: "#3b82f6",
  IN_SHOP: "#f59e0b",
  RETIRED: "#a1a1aa",
};

const TRIP_STATUS_COLORS: Record<string, string> = {
  DRAFT: "#a1a1aa",
  DISPATCHED: "#3b82f6",
  COMPLETED: "#10b981",
  CANCELLED: "#ef4444",
};

function formatCurrency(n: number) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return `${sign}₹${abs.toLocaleString()}`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [monthly, setMonthly] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.dashboardStats(),
      api.dashboardMonthly(),
    ])
      .then(([s, m]) => {
        setStats(s);
        setMonthly(m.months);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">Loading dashboard...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <p className="alert-error">
        {error ?? "Failed to load"}
      </p>
    );
  }

  const fleetPieData = Object.entries(stats.fleetStatus).map(([name, value]) => ({
    name: name.replace(/_/g, " "),
    value,
    color: STATUS_COLORS[name] ?? "#cbd5e1",
  }));

  const canExport = user?.role === "ADMIN" || user?.role === "FINANCIAL_MANAGER";

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Total Fleet" value={stats.totalVehicles} color="indigo" />
        <KpiCard label="Active Trips" value={stats.activeTrips} color="blue" />
        <KpiCard label="Utilisation" value={`${stats.utilisation}%`} color="teal" />
        <KpiCard label="Licence Alerts" value={stats.licenceAlerts} color={stats.licenceAlerts > 0 ? "red" : "green"} />
        <KpiCard label="Open Maintenance" value={stats.openMaintenance} color={stats.openMaintenance > 0 ? "amber" : "green"} />
        <KpiCard label="Month P&L" value={formatCurrency(stats.monthRevenue - stats.monthCost)} color={stats.monthRevenue - stats.monthCost >= 0 ? "green" : "red"} />
      </div>

      {/* Revenue / Cost cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="text-xs text-slate-500 uppercase tracking-wide">This Month Revenue</div>
          <div className="text-2xl font-bold text-green-700 mt-1">₹{stats.monthRevenue.toLocaleString()}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-slate-500 uppercase tracking-wide">This Month Costs</div>
          <div className="text-2xl font-bold text-red-600 mt-1">₹{stats.monthCost.toLocaleString()}</div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fleet Status Donut */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Fleet Status</h3>
          {fleetPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={fleetPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {fleetPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-400 text-center py-12">No vehicles</p>
          )}
        </div>

        {/* Monthly Cost vs Revenue */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Monthly Cost vs Revenue</h3>
          {monthly.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatCurrency(v as number)} />
                <Tooltip formatter={(v) => `₹${Number(v).toLocaleString()}`} />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cost" name="Cost" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-400 text-center py-12">No data</p>
          )}
        </div>
      </div>

      {/* CSV Export buttons */}
      {canExport && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Export Reports (CSV)</h3>
          <div className="flex flex-wrap gap-3">
            <a
              href="/api/dashboard/export/trips"
              className="btn-secondary"
            >
              ↓ Trips Report
            </a>
            <a
              href="/api/dashboard/export/vehicle-costs"
              className="btn-secondary"
            >
              ↓ Vehicle Costs
            </a>
            <a
              href="/api/dashboard/export/fuel-efficiency"
              className="btn-secondary"
            >
              ↓ Fuel Efficiency
            </a>
          </div>
        </div>
      )}

      {/* Recent Trips Table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">Recent Trips</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="thead-row">
                <th className="px-6 py-3 font-medium">Trip #</th>
                <th className="px-6 py-3 font-medium">Route</th>
                <th className="px-6 py-3 font-medium">Vehicle</th>
                <th className="px-6 py-3 font-medium">Driver</th>
                <th className="px-6 py-3 font-medium">Revenue</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentTrips.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">No trips yet</td>
                </tr>
              )}
              {stats.recentTrips.map((t) => (
                <tr key={t.id} className="trow">
                  <td className="px-6 py-3 font-mono text-xs font-medium">{t.tripNumber}</td>
                  <td className="px-6 py-3 text-slate-600 text-xs">{t.source} → {t.destination}</td>
                  <td className="px-6 py-3 text-slate-600 text-xs">{t.vehicle.registrationNumber}</td>
                  <td className="px-6 py-3 text-slate-600">{t.driver.name}</td>
                  <td className="px-6 py-3 text-slate-600">₹{Number(t.revenue).toLocaleString()}</td>
                  <td className="px-6 py-3">
                    <span
                      className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: (TRIP_STATUS_COLORS[t.status] ?? "#a1a1aa") + "20",
                        color: TRIP_STATUS_COLORS[t.status] ?? "#a1a1aa",
                      }}
                    >
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const dotMap: Record<string, string> = {
    indigo: "bg-indigo-500",
    blue: "bg-blue-500",
    teal: "bg-teal-500",
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
  };
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <span className={`w-1.5 h-1.5 rounded-full ${dotMap[color] ?? dotMap.indigo}`} />
        {label}
      </div>
      <div className="text-2xl font-semibold tracking-tight text-slate-900 mt-1.5">{value}</div>
    </div>
  );
}
