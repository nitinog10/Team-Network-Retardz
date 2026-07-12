import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError, MAINTENANCE_STATUSES } from "../lib/api";
import type { MaintenanceLog, Vehicle } from "../lib/api";
import { useAuth } from "../lib/auth";

const statusColors: Record<string, string> = {
  OPEN: "bg-amber-100 text-amber-700",
  CLOSED: "bg-green-100 text-green-700",
};

function statusLabel(s: string) {
  return s.replace(/_/g, " ");
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

export default function Maintenance() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formVehicleId, setFormVehicleId] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // Close modal
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeCost, setCloseCost] = useState(0);
  const [closing, setClosing] = useState(false);

  const canWrite =
    user?.role === "ADMIN" || user?.role === "FLEET_MANAGER";

  const load = () => {
    const filters: Record<string, string> = {};
    if (filterStatus) filters.status = filterStatus;
    api
      .listMaintenance(filters)
      .then(({ logs }) => setLogs(logs))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load logs"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [filterStatus]);

  // Load vehicles for the create form
  const loadVehicles = async () => {
    try {
      const { vehicles } = await api.listVehicles();
      setVehicles(vehicles.filter((v) => v.status !== "RETIRED"));
    } catch {
      // ignore
    }
  };

  const openForm = async () => {
    await loadVehicles();
    setShowForm(true);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const { log } = await api.openMaintenance({
        vehicleId: formVehicleId,
        description: formDescription,
      });
      setLogs((prev) => [log, ...prev]);
      setShowForm(false);
      setFormVehicleId("");
      setFormDescription("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to open maintenance log");
    } finally {
      setCreating(false);
    }
  };

  const handleClose = async () => {
    if (!closingId) return;
    setError(null);
    setClosing(true);
    try {
      const { log } = await api.closeMaintenance(closingId, closeCost);
      setLogs((prev) => prev.map((l) => (l.id === closingId ? log : l)));
      setClosingId(null);
      setCloseCost(0);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to close maintenance log");
    } finally {
      setClosing(false);
    }
  };

  if (loading) return <p className="text-slate-500">Loading maintenance logs...</p>;

  return (
    <div className="space-y-6">
      {error && (
        <p className="alert-error">
          {error}
        </p>
      )}

      {/* Filters + Create */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="input"
        >
          <option value="">All Statuses</option>
          {MAINTENANCE_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {canWrite && (
          <button
            onClick={() => void openForm()}
            className="ml-auto btn-primary"
          >
            {showForm ? "Cancel" : "+ Open Log"}
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && canWrite && (
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Open Maintenance Log</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={formVehicleId}
              onChange={(e) => setFormVehicleId(e.target.value)}
              required
              className="input"
            >
              <option value="">Select Vehicle</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.registrationNumber} — {v.type} ({statusLabel(v.status)})
                </option>
              ))}
            </select>
            <input
              placeholder="Description of work"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              required
              className="input"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="btn-primary"
              >
                {creating ? "Opening..." : "Open Log"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn-ghost"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Close modal */}
      {closingId && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Close Maintenance Log</h3>
            <p className="text-sm text-slate-500 mb-4">Enter the final cost for this maintenance work.</p>
            <input
              type="number"
              placeholder="Cost (₹)"
              value={closeCost || ""}
              onChange={(e) => setCloseCost(Number(e.target.value))}
              min={0}
              required
              className="w-full input mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setClosingId(null); setCloseCost(0); }}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleClose()}
                disabled={closing}
                className="btn-success"
              >
                {closing ? "Closing..." : "Close & Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance list */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="thead-row">
                <th className="px-6 py-3 font-medium">Vehicle</th>
                <th className="px-6 py-3 font-medium">Description</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Cost</th>
                <th className="px-6 py-3 font-medium">Opened</th>
                <th className="px-6 py-3 font-medium">Closed</th>
                {canWrite && <th className="px-6 py-3 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td colSpan={canWrite ? 7 : 6} className="px-6 py-8 text-center text-slate-400">
                    No maintenance logs found
                  </td>
                </tr>
              )}
              {logs.map((l) => (
                <tr key={l.id} className="trow">
                  <td className="px-6 py-3 font-medium text-slate-800">
                    {l.vehicle.registrationNumber}
                    <div className="text-xs text-slate-400">{l.vehicle.type}</div>
                  </td>
                  <td className="px-6 py-3 text-slate-600">{l.description}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[l.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-slate-600">
                    {l.status === "CLOSED" ? `₹${Number(l.cost).toLocaleString()}` : "—"}
                  </td>
                  <td className="px-6 py-3 text-xs text-slate-500">{formatDate(l.openedAt)}</td>
                  <td className="px-6 py-3 text-xs text-slate-500">{formatDate(l.closedAt)}</td>
                  {canWrite && (
                    <td className="px-6 py-3">
                      {l.status === "OPEN" && (
                        <button
                          onClick={() => { setClosingId(l.id); setCloseCost(0); }}
                          className="btn-ghost text-xs px-3 py-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800"
                        >
                          Close
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
