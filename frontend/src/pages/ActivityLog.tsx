import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import type { ActivityLogEntry } from "../lib/api";

const ENTITY_TYPES = ["User", "Vehicle", "Driver", "Trip", "MaintenanceLog", "FuelLog", "Expense"];

const actionColors: Record<string, string> = {
  created: "bg-green-100 text-green-700",
  updated: "bg-blue-100 text-blue-700",
  deleted: "bg-red-100 text-red-700",
  dispatched: "bg-indigo-100 text-indigo-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
  opened: "bg-amber-100 text-amber-700",
  closed: "bg-green-100 text-green-700",
  retired: "bg-slate-200 text-slate-600",
  verification_verified: "bg-green-100 text-green-700",
  verification_failed: "bg-red-100 text-red-700",
  safety_updated: "bg-purple-100 text-purple-700",
};

function formatDate(d: string) {
  return new Date(d).toLocaleString();
}

export default function ActivityLog() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("");

  useEffect(() => {
    const filters: Record<string, string> = {};
    if (filterType) filters.entityType = filterType;
    api
      .listActivity(filters)
      .then(({ logs }) => setLogs(logs))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [filterType]);

  if (loading) return <p className="text-slate-500">Loading activity...</p>;

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Entities</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <span className="text-sm text-slate-500">{logs.length} entries</span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
                <th className="px-5 py-3 font-medium">Time</th>
                <th className="px-5 py-3 font-medium">Actor</th>
                <th className="px-5 py-3 font-medium">Entity</th>
                <th className="px-5 py-3 font-medium">Action</th>
                <th className="px-5 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">No activity</td></tr>
              )}
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition">
                  <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(l.createdAt)}</td>
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-800 text-xs">{l.actor.name}</div>
                    <div className="text-xs text-slate-400">{l.actor.role.replace(/_/g, " ")}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded">{l.entityType}</span>
                    <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[120px]" title={l.entityId}>{l.entityId.slice(0, 8)}…</div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${actionColors[l.action] ?? "bg-slate-100 text-slate-600"}`}>
                      {l.action}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500 max-w-xs">
                    {l.metadata && Object.keys(l.metadata).length > 0 ? (
                      <details className="cursor-pointer">
                        <summary className="text-indigo-600 hover:underline">View</summary>
                        <pre className="mt-1 text-xs bg-slate-50 p-2 rounded overflow-auto max-h-32">
                          {JSON.stringify(l.metadata, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      "—"
                    )}
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
