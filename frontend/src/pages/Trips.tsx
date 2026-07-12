import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError, TRIP_STATUSES } from "../lib/api";
import type { Trip, AvailableVehicle, AvailableDriver } from "../lib/api";
import { useAuth } from "../lib/auth";

const emptyForm = {
  source: "",
  destination: "",
  vehicleId: "",
  driverId: "",
  cargoWeightKg: 0,
  plannedDistanceKm: 0,
  revenue: 0,
};

const statusColors: Record<string, string> = {
  DRAFT: "bg-slate-200 text-slate-600",
  DISPATCHED: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

function statusLabel(s: string) {
  return s.replace(/_/g, " ");
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

interface TripsProps {
  driverOnly?: boolean;
}

export default function Trips({ driverOnly = false }: TripsProps) {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [availableVehicles, setAvailableVehicles] = useState<AvailableVehicle[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<AvailableDriver[]>([]);

  // Complete trip modal
  const [completingTripId, setCompletingTripId] = useState<string | null>(null);
  const [finalOdometer, setFinalOdometer] = useState(0);
  const [completing, setCompleting] = useState(false);

  const canCreate =
    !driverOnly && (user?.role === "ADMIN" || user?.role === "FLEET_MANAGER");
  const canManage =
    !driverOnly && (user?.role === "ADMIN" || user?.role === "FLEET_MANAGER");

  const load = () => {
    const filters: Record<string, string> = {};
    if (filterStatus) filters.status = filterStatus;
    api
      .listTrips(filters)
      .then(({ trips }) => setTrips(trips))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load trips"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [filterStatus]);

  const loadPickers = async () => {
    try {
      const [v, d] = await Promise.all([api.availableVehicles(), api.availableDrivers()]);
      setAvailableVehicles(v.vehicles);
      setAvailableDrivers(d.drivers);
    } catch {
      // pickers may fail for DRIVER role — that's fine
    }
  };

  const openCreate = async () => {
    setForm(emptyForm);
    await loadPickers();
    setShowForm(true);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const { trip } = await api.createTrip(form);
      setTrips((prev) => [trip, ...prev]);
      setShowForm(false);
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create trip");
    } finally {
      setCreating(false);
    }
  };

  const handleDispatch = async (id: string) => {
    setError(null);
    try {
      const { trip } = await api.dispatchTrip(id);
      setTrips((prev) => prev.map((t) => (t.id === id ? trip : t)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to dispatch trip");
    }
  };

  const handleComplete = async () => {
    if (!completingTripId) return;
    setError(null);
    setCompleting(true);
    try {
      const { trip } = await api.completeTrip(completingTripId, finalOdometer);
      setTrips((prev) => prev.map((t) => (t.id === completingTripId ? trip : t)));
      setCompletingTripId(null);
      setFinalOdometer(0);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to complete trip");
    } finally {
      setCompleting(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this trip?")) return;
    setError(null);
    try {
      const { trip } = await api.cancelTrip(id);
      setTrips((prev) => prev.map((t) => (t.id === id ? trip : t)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to cancel trip");
    }
  };

  if (loading) return <p className="text-slate-500">Loading trips...</p>;

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {/* Filters + Create */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Statuses</option>
          {TRIP_STATUSES.map((s) => (
            <option key={s} value={s}>{statusLabel(s)}</option>
          ))}
        </select>

        {canCreate && (
          <button
            onClick={() => void openCreate()}
            className="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition"
          >
            {showForm ? "Cancel" : "+ New Trip"}
          </button>
        )}
      </div>

      {/* Create trip form */}
      {showForm && canCreate && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Create Draft Trip</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <input
              placeholder="Source"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              required
              className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              placeholder="Destination"
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
              required
              className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={form.vehicleId}
              onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
              required
              className="rounded-lg border border-gray-300 px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select Vehicle</option>
              {availableVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.registrationNumber} — {v.type} ({v.maxLoadKg.toLocaleString()} kg)
                </option>
              ))}
            </select>
            <select
              value={form.driverId}
              onChange={(e) => setForm({ ...form, driverId: e.target.value })}
              required
              className="rounded-lg border border-gray-300 px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select Driver</option>
              {availableDrivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — {d.licenceCategory} ({d.licenceNumber})
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Cargo Weight (kg)"
              value={form.cargoWeightKg || ""}
              onChange={(e) => setForm({ ...form, cargoWeightKg: Number(e.target.value) })}
              required
              min={1}
              className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="number"
              placeholder="Planned Distance (km)"
              value={form.plannedDistanceKm || ""}
              onChange={(e) => setForm({ ...form, plannedDistanceKm: Number(e.target.value) })}
              required
              min={1}
              className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="number"
              placeholder="Revenue (₹)"
              value={form.revenue || ""}
              onChange={(e) => setForm({ ...form, revenue: Number(e.target.value) })}
              min={0}
              className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg px-5 py-2 font-medium transition"
              >
                {creating ? "Creating..." : "Create Draft"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-slate-600 hover:bg-slate-100 rounded-lg px-4 py-2 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Complete trip modal */}
      {completingTripId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="font-semibold text-slate-800 mb-4">Complete Trip</h3>
            <p className="text-sm text-slate-500 mb-4">Enter the final odometer reading to complete this trip.</p>
            <input
              type="number"
              placeholder="Final Odometer (km)"
              value={finalOdometer || ""}
              onChange={(e) => setFinalOdometer(Number(e.target.value))}
              min={1}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setCompletingTripId(null); setFinalOdometer(0); }}
                className="text-slate-600 hover:bg-slate-100 rounded-lg px-4 py-2 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleComplete()}
                disabled={completing || finalOdometer <= 0}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg px-5 py-2 font-medium transition"
              >
                {completing ? "Completing..." : "Complete Trip"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trip list */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
                <th className="px-5 py-3 font-medium">Trip #</th>
                <th className="px-5 py-3 font-medium">Route</th>
                <th className="px-5 py-3 font-medium">Vehicle</th>
                <th className="px-5 py-3 font-medium">Driver</th>
                <th className="px-5 py-3 font-medium">Cargo</th>
                <th className="px-5 py-3 font-medium">Distance</th>
                <th className="px-5 py-3 font-medium">Revenue</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {trips.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-8 text-center text-slate-400">
                    No trips found
                  </td>
                </tr>
              )}
              {trips.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition">
                  <td className="px-5 py-3 font-medium text-slate-800 font-mono text-xs">
                    {t.tripNumber}
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    <div>{t.source}</div>
                    <div className="text-xs text-slate-400">→ {t.destination}</div>
                  </td>
                  <td className="px-5 py-3 text-slate-600 text-xs">{t.vehicle.registrationNumber}</td>
                  <td className="px-5 py-3 text-slate-600">{t.driver.name}</td>
                  <td className="px-5 py-3 text-slate-600">{t.cargoWeightKg.toLocaleString()} kg</td>
                  <td className="px-5 py-3 text-slate-600">
                    {t.actualDistanceKm != null
                      ? `${t.actualDistanceKm.toLocaleString()} km`
                      : `${t.plannedDistanceKm.toLocaleString()} km (est.)`}
                  </td>
                  <td className="px-5 py-3 text-slate-600">₹{Number(t.revenue).toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[t.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {statusLabel(t.status)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500">
                    {t.completedAt
                      ? formatDate(t.completedAt)
                      : t.dispatchedAt
                        ? formatDate(t.dispatchedAt)
                        : formatDate(t.createdAt)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {/* Dispatch: from DRAFT, Fleet Manager / Admin */}
                      {t.status === "DRAFT" && canManage && (
                        <button
                          onClick={() => void handleDispatch(t.id)}
                          className="text-xs px-2.5 py-1 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition"
                        >
                          Dispatch
                        </button>
                      )}
                      {/* Complete: from DISPATCHED — Driver (own) or Fleet Manager / Admin */}
                      {t.status === "DISPATCHED" &&
                        (canManage || (driverOnly && t.driver.userId === user?.id)) && (
                          <button
                            onClick={() => {
                              setCompletingTripId(t.id);
                              setFinalOdometer(t.vehicle.odometerKm || 0);
                            }}
                            className="text-xs px-2.5 py-1 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 transition"
                          >
                            Complete
                          </button>
                        )}
                      {/* Cancel: DRAFT or DISPATCHED — Fleet Manager / Admin */}
                      {(t.status === "DRAFT" || t.status === "DISPATCHED") && canManage && (
                        <button
                          onClick={() => void handleCancel(t.id)}
                          className="text-xs px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
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
