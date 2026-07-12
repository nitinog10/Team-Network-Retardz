import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import type { DashboardStats, MonthlyData } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "#22c55e",
  ON_TRIP: "#3b82f6",
  IN_SHOP: "#f59e0b",
  RETIRED: "#94a3b8",
};

const TRIP_STATUS_COLORS: Record<string, string> = {
  DRAFT: "#94a3b8",
  DISPATCHED: "#3b82f6",
  COMPLETED: "#22c55e",
  CANCELLED: "#ef4444",
};

function formatCurrency(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString()}`;
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
      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
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
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <div className="text-xs text-slate-500 uppercase tracking-wide">This Month Revenue</div>
          <div className="text-2xl font-bold text-green-700 mt-1">₹{stats.monthRevenue.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <div className="text-xs text-slate-500 uppercase tracking-wide">This Month Costs</div>
          <div className="text-2xl font-bold text-red-600 mt-1">₹{stats.monthCost.toLocaleString()}</div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fleet Status Donut */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-700 mb-4">Fleet Status</h3>
          {fleetPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={fleetPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {fleetPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-400 text-center py-12">No vehicles</p>
          )}
        </div>

        {/* Monthly Cost vs Revenue */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-700 mb-4">Monthly Cost vs Revenue</h3>
          {monthly.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatCurrency(v as number)} />
                <Tooltip formatter={(v) => `₹${Number(v).toLocaleString()}`} />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
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
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-700 mb-3">Export Reports (CSV)</h3>
          <div className="flex flex-wrap gap-3">
            <a
              href="/api/dashboard/export/trips"
              className="inline-flex items-center px-4 py-2 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-sm font-medium transition"
            >
              ↓ Trips Report
            </a>
            <a
              href="/api/dashboard/export/vehicle-costs"
              className="inline-flex items-center px-4 py-2 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-sm font-medium transition"
            >
              ↓ Vehicle Costs
            </a>
            <a
              href="/api/dashboard/export/fuel-efficiency"
              className="inline-flex items-center px-4 py-2 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-sm font-medium transition"
            >
              ↓ Fuel Efficiency
            </a>
          </div>
        </div>
      )}

      {/* Recent Trips Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-700">Recent Trips</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
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
                <tr key={t.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition">
                  <td className="px-6 py-3 font-mono text-xs font-medium">{t.tripNumber}</td>
                  <td className="px-6 py-3 text-slate-600 text-xs">{t.source} → {t.destination}</td>
                  <td className="px-6 py-3 text-slate-600 text-xs">{t.vehicle.registrationNumber}</td>
                  <td className="px-6 py-3 text-slate-600">{t.driver.name}</td>
                  <td className="px-6 py-3 text-slate-600">₹{Number(t.revenue).toLocaleString()}</td>
                  <td className="px-6 py-3">
                    <span
                      className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: (TRIP_STATUS_COLORS[t.status] ?? "#94a3b8") + "20",
                        color: TRIP_STATUS_COLORS[t.status] ?? "#94a3b8",
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
  const colorMap: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    teal: "bg-teal-50 text-teal-700 border-teal-200",
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <div className={`rounded-2xl border p-4 ${colorMap[color] ?? colorMap.indigo}`}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
