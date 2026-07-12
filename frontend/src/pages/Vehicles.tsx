import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError, VEHICLE_STATUSES } from "../lib/api";
import type { Vehicle } from "../lib/api";
import { useAuth } from "../lib/auth";

const emptyForm = {
  registrationNumber: "",
  type: "Truck",
  maxLoadKg: 0,
  odometerKm: 0,
  acquisitionCost: 0,
  region: "",
};

const VEHICLE_TYPES = ["Truck", "Mini Truck", "Van", "Trailer"];
const REGIONS = ["North", "South", "East", "West"];

const statusColors: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-700",
  ON_TRIP: "bg-blue-100 text-blue-700",
  IN_SHOP: "bg-amber-100 text-amber-700",
  RETIRED: "bg-slate-200 text-slate-500",
};

function statusLabel(s: string) {
  return s.replace(/_/g, " ");
}

export default function Vehicles() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterRegion, setFilterRegion] = useState("");

  const canWrite =
    user?.role === "ADMIN" || user?.role === "FLEET_MANAGER";

  const load = () => {
    const filters: Record<string, string> = {};
    if (filterStatus) filters.status = filterStatus;
    if (filterType) filters.type = filterType;
    if (filterRegion) filters.region = filterRegion;
    api
      .listVehicles(filters)
      .then(({ vehicles }) => setVehicles(vehicles))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load vehicles"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [filterStatus, filterType, filterRegion]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      if (editingId) {
        const { vehicle } = await api.updateVehicle(editingId, form);
        setVehicles((prev) => prev.map((v) => (v.id === editingId ? vehicle : v)));
      } else {
        const { vehicle } = await api.createVehicle(form);
        setVehicles((prev) => [vehicle, ...prev]);
      }
      setForm(emptyForm);
      setShowForm(false);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save vehicle");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (v: Vehicle) => {
    setForm({
      registrationNumber: v.registrationNumber,
      type: v.type,
      maxLoadKg: v.maxLoadKg,
      odometerKm: v.odometerKm,
      acquisitionCost: Number(v.acquisitionCost),
      region: v.region,
    });
    setEditingId(v.id);
    setShowForm(true);
  };

  const handleRetire = async (id: string) => {
    if (!confirm("Are you sure you want to retire this vehicle?")) return;
    setError(null);
    try {
      const { vehicle } = await api.retireVehicle(id);
      setVehicles((prev) => prev.map((v) => (v.id === id ? vehicle : v)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to retire vehicle");
    }
  };

  if (loading) return <p className="text-slate-500">Loading vehicles...</p>;

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Statuses</option>
          {VEHICLE_STATUSES.map((s) => (
            <option key={s} value={s}>{statusLabel(s)}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Types</option>
          {VEHICLE_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={filterRegion}
          onChange={(e) => setFilterRegion(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Regions</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        {canWrite && (
          <button
            onClick={() => {
              setForm(emptyForm);
              setEditingId(null);
              setShowForm(!showForm);
            }}
            className="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition"
          >
            {showForm ? "Cancel" : "+ Add Vehicle"}
          </button>
        )}
      </div>

      {/* Create / Edit form */}
      {showForm && canWrite && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4">
            {editingId ? "Edit Vehicle" : "Add Vehicle"}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <input
              placeholder="Registration Number"
              value={form.registrationNumber}
              onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
              required
              className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {VEHICLE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Max Load (kg)"
              value={form.maxLoadKg || ""}
              onChange={(e) => setForm({ ...form, maxLoadKg: Number(e.target.value) })}
              required
              min={1}
              className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="number"
              placeholder="Odometer (km)"
              value={form.odometerKm || ""}
              onChange={(e) => setForm({ ...form, odometerKm: Number(e.target.value) })}
              min={0}
              className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="number"
              placeholder="Acquisition Cost (₹)"
              value={form.acquisitionCost || ""}
              onChange={(e) => setForm({ ...form, acquisitionCost: Number(e.target.value) })}
              min={0}
              className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
              required
              className="rounded-lg border border-gray-300 px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select Region</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg px-5 py-2 font-medium transition"
              >
                {creating ? "Saving..." : editingId ? "Update" : "Add"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(false); }}
                  className="text-slate-600 hover:bg-slate-100 rounded-lg px-4 py-2 transition"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Vehicle list */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-3 font-medium">Reg. Number</th>
                <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium">Region</th>
                <th className="px-6 py-3 font-medium">Max Load</th>
                <th className="px-6 py-3 font-medium">Odometer</th>
                <th className="px-6 py-3 font-medium">Status</th>
                {canWrite && <th className="px-6 py-3 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {vehicles.length === 0 && (
                <tr>
                  <td colSpan={canWrite ? 7 : 6} className="px-6 py-8 text-center text-slate-400">
                    No vehicles found
                  </td>
                </tr>
              )}
              {vehicles.map((v) => (
                <tr key={v.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition">
                  <td className="px-6 py-3 font-medium text-slate-800">{v.registrationNumber}</td>
                  <td className="px-6 py-3 text-slate-600">{v.type}</td>
                  <td className="px-6 py-3 text-slate-600">{v.region}</td>
                  <td className="px-6 py-3 text-slate-600">{v.maxLoadKg.toLocaleString()} kg</td>
                  <td className="px-6 py-3 text-slate-600">{v.odometerKm.toLocaleString()} km</td>
                  <td className="px-6 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[v.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {statusLabel(v.status)}
                    </span>
                  </td>
                  {canWrite && (
                    <td className="px-6 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(v)}
                          disabled={v.status === "RETIRED"}
                          className="text-sm px-3 py-1 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition"
                        >
                          Edit
                        </button>
                        {v.status !== "RETIRED" && (
                          <button
                            onClick={() => void handleRetire(v.id)}
                            disabled={v.status === "ON_TRIP"}
                            className="text-sm px-3 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 transition"
                          >
                            Retire
                          </button>
                        )}
                      </div>
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
