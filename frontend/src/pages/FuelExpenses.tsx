import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError, EXPENSE_CATEGORIES } from "../lib/api";
import type { FuelLog, Expense, Vehicle, FuelEfficiency, VehicleCost, TripCost } from "../lib/api";
import { useAuth } from "../lib/auth";

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

const categoryColors: Record<string, string> = {
  FUEL: "bg-blue-100 text-blue-700",
  TOLL: "bg-purple-100 text-purple-700",
  REPAIR: "bg-amber-100 text-amber-700",
  PERMIT: "bg-teal-100 text-teal-700",
  OTHER: "bg-slate-200 text-slate-600",
};

type Tab = "fuel" | "expenses" | "efficiency" | "vehicle-costs" | "trip-costs";

export default function FuelExpenses() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("fuel");

  const canFuel = user?.role === "ADMIN" || user?.role === "FLEET_MANAGER" || user?.role === "FINANCIAL_MANAGER";
  const canExpense = user?.role === "ADMIN" || user?.role === "FINANCIAL_MANAGER";

  const tabs: { key: Tab; label: string }[] = [
    { key: "fuel", label: "Fuel Logs" },
    { key: "expenses", label: "Expenses" },
    { key: "efficiency", label: "Fuel Efficiency" },
    { key: "vehicle-costs", label: "Vehicle Costs" },
    { key: "trip-costs", label: "Trip Profitability" },
  ];

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-slate-200 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.key
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "fuel" && <FuelTab canWrite={canFuel} />}
      {tab === "expenses" && <ExpenseTab canWrite={canExpense} />}
      {tab === "efficiency" && <EfficiencyTab />}
      {tab === "vehicle-costs" && <VehicleCostsTab />}
      {tab === "trip-costs" && <TripCostsTab />}
    </div>
  );
}

// ────────────────────────────────────────────────────────
//  FUEL TAB
// ────────────────────────────────────────────────────────

function FuelTab({ canWrite }: { canWrite: boolean }) {
  const [logs, setLogs] = useState<FuelLog[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    vehicleId: "",
    tripId: "",
    litres: 0,
    cost: 0,
    odometerKm: 0,
  });

  useEffect(() => {
    api
      .listFuel()
      .then(({ logs }) => setLogs(logs))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const openForm = async () => {
    try {
      const { vehicles } = await api.listVehicles();
      setVehicles(vehicles.filter((v) => v.status !== "RETIRED"));
    } catch { /* ignore */ }
    setShowForm(true);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const { log } = await api.createFuel({
        ...form,
        tripId: form.tripId || undefined,
      });
      setLogs((prev) => [log, ...prev]);
      setShowForm(false);
      setForm({ vehicleId: "", tripId: "", litres: 0, cost: 0, odometerKm: 0 });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <p className="text-slate-500">Loading...</p>;

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
      )}

      {canWrite && (
        <div className="flex justify-end">
          <button
            onClick={() => void openForm()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition"
          >
            {showForm ? "Cancel" : "+ Add Fuel Log"}
          </button>
        </div>
      )}

      {showForm && canWrite && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Add Fuel Log</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <select
              value={form.vehicleId}
              onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
              required
              className="rounded-lg border border-gray-300 px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Vehicle</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.registrationNumber}</option>
              ))}
            </select>
            <input type="number" placeholder="Litres" value={form.litres || ""} onChange={(e) => setForm({ ...form, litres: Number(e.target.value) })} required min={0.1} step="0.01" className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" />
            <input type="number" placeholder="Cost (₹)" value={form.cost || ""} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} required min={0} className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" />
            <input type="number" placeholder="Odometer (km)" value={form.odometerKm || ""} onChange={(e) => setForm({ ...form, odometerKm: Number(e.target.value) })} required min={0} className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" />
            <button type="submit" disabled={creating} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg px-4 py-2 font-medium transition">
              {creating ? "Adding..." : "Add"}
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-3 font-medium">Vehicle</th>
                <th className="px-6 py-3 font-medium">Trip</th>
                <th className="px-6 py-3 font-medium">Litres</th>
                <th className="px-6 py-3 font-medium">Cost</th>
                <th className="px-6 py-3 font-medium">Odometer</th>
                <th className="px-6 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">No fuel logs</td></tr>
              )}
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition">
                  <td className="px-6 py-3 font-medium text-slate-800">{l.vehicle.registrationNumber}</td>
                  <td className="px-6 py-3 text-slate-600 text-xs">{l.trip?.tripNumber ?? "—"}</td>
                  <td className="px-6 py-3 text-slate-600">{Number(l.litres).toFixed(1)} L</td>
                  <td className="px-6 py-3 text-slate-600">₹{Number(l.cost).toLocaleString()}</td>
                  <td className="px-6 py-3 text-slate-600">{l.odometerKm.toLocaleString()} km</td>
                  <td className="px-6 py-3 text-xs text-slate-500">{formatDate(l.loggedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
//  EXPENSES TAB
// ────────────────────────────────────────────────────────

function ExpenseTab({ canWrite }: { canWrite: boolean }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [filterCategory, setFilterCategory] = useState("");
  const [form, setForm] = useState({
    vehicleId: "",
    tripId: "",
    category: "TOLL" as string,
    amount: 0,
    notes: "",
  });

  const load = () => {
    const filters: Record<string, string> = {};
    if (filterCategory) filters.category = filterCategory;
    api
      .listExpenses(filters)
      .then(({ expenses }) => setExpenses(expenses))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [filterCategory]);

  const openForm = async () => {
    try {
      const { vehicles } = await api.listVehicles();
      setVehicles(vehicles);
    } catch { /* ignore */ }
    setShowForm(true);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const { expense } = await api.createExpense({
        ...form,
        vehicleId: form.vehicleId || undefined,
        tripId: form.tripId || undefined,
        notes: form.notes || undefined,
      });
      setExpenses((prev) => [expense, ...prev]);
      setShowForm(false);
      setForm({ vehicleId: "", tripId: "", category: "TOLL", amount: 0, notes: "" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <p className="text-slate-500">Loading...</p>;

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Categories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {canWrite && (
          <button
            onClick={() => void openForm()}
            className="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition"
          >
            {showForm ? "Cancel" : "+ Add Expense"}
          </button>
        )}
      </div>

      {showForm && canWrite && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Add Expense</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-indigo-500">
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input type="number" placeholder="Amount (₹)" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} required min={0.01} step="0.01" className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" />
            <select value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Vehicle (optional)</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.registrationNumber}</option>
              ))}
            </select>
            <input placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" />
            <button type="submit" disabled={creating} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg px-4 py-2 font-medium transition">
              {creating ? "Adding..." : "Add"}
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-3 font-medium">Category</th>
                <th className="px-6 py-3 font-medium">Amount</th>
                <th className="px-6 py-3 font-medium">Vehicle</th>
                <th className="px-6 py-3 font-medium">Trip</th>
                <th className="px-6 py-3 font-medium">Notes</th>
                <th className="px-6 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">No expenses</td></tr>
              )}
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition">
                  <td className="px-6 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryColors[e.category] ?? "bg-slate-100 text-slate-600"}`}>
                      {e.category}
                    </span>
                  </td>
                  <td className="px-6 py-3 font-medium text-slate-800">₹{Number(e.amount).toLocaleString()}</td>
                  <td className="px-6 py-3 text-slate-600 text-xs">{e.vehicle?.registrationNumber ?? "—"}</td>
                  <td className="px-6 py-3 text-slate-600 text-xs">{e.trip?.tripNumber ?? "—"}</td>
                  <td className="px-6 py-3 text-slate-500 text-xs">{e.notes ?? "—"}</td>
                  <td className="px-6 py-3 text-xs text-slate-500">{formatDate(e.incurredAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
//  FUEL EFFICIENCY TAB
// ────────────────────────────────────────────────────────

function EfficiencyTab() {
  const [data, setData] = useState<FuelEfficiency[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.fuelEfficiency()
      .then(({ efficiency }) => setData(efficiency))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-500">Loading...</p>;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
              <th className="px-6 py-3 font-medium">Vehicle</th>
              <th className="px-6 py-3 font-medium">Type</th>
              <th className="px-6 py-3 font-medium">Total Litres</th>
              <th className="px-6 py-3 font-medium">Distance</th>
              <th className="px-6 py-3 font-medium">km/L</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">No data</td></tr>
            )}
            {data.map((d) => (
              <tr key={d.vehicleId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition">
                <td className="px-6 py-3 font-medium text-slate-800">{d.registrationNumber}</td>
                <td className="px-6 py-3 text-slate-600">{d.type}</td>
                <td className="px-6 py-3 text-slate-600">{d.totalLitres.toLocaleString()} L</td>
                <td className="px-6 py-3 text-slate-600">{d.distanceKm.toLocaleString()} km</td>
                <td className="px-6 py-3">
                  {d.kmPerLitre != null ? (
                    <span className={`font-semibold ${d.kmPerLitre >= 5 ? "text-green-700" : d.kmPerLitre >= 3 ? "text-amber-600" : "text-red-600"}`}>
                      {d.kmPerLitre} km/L
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
//  VEHICLE COSTS TAB
// ────────────────────────────────────────────────────────

function VehicleCostsTab() {
  const [data, setData] = useState<VehicleCost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.vehicleCosts()
      .then(({ costs }) => setData(costs))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-500">Loading...</p>;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
              <th className="px-6 py-3 font-medium">Vehicle</th>
              <th className="px-6 py-3 font-medium">Type</th>
              <th className="px-6 py-3 font-medium">Maintenance</th>
              <th className="px-6 py-3 font-medium">Fuel</th>
              <th className="px-6 py-3 font-medium">Expenses</th>
              <th className="px-6 py-3 font-medium">Total Cost</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">No data</td></tr>
            )}
            {data.map((d) => (
              <tr key={d.vehicleId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition">
                <td className="px-6 py-3 font-medium text-slate-800">{d.registrationNumber}</td>
                <td className="px-6 py-3 text-slate-600">{d.type}</td>
                <td className="px-6 py-3 text-slate-600">₹{d.maintenanceCost.toLocaleString()}</td>
                <td className="px-6 py-3 text-slate-600">₹{d.fuelCost.toLocaleString()}</td>
                <td className="px-6 py-3 text-slate-600">₹{d.expenseCost.toLocaleString()}</td>
                <td className="px-6 py-3 font-semibold text-slate-800">₹{d.totalCost.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
//  TRIP PROFITABILITY TAB
// ────────────────────────────────────────────────────────

function TripCostsTab() {
  const [data, setData] = useState<TripCost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.tripCosts()
      .then(({ costs }) => setData(costs))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-500">Loading...</p>;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
              <th className="px-5 py-3 font-medium">Trip</th>
              <th className="px-5 py-3 font-medium">Route</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Revenue</th>
              <th className="px-5 py-3 font-medium">Fuel Cost</th>
              <th className="px-5 py-3 font-medium">Other Costs</th>
              <th className="px-5 py-3 font-medium">Total Cost</th>
              <th className="px-5 py-3 font-medium">Profit</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-400">No data</td></tr>
            )}
            {data.map((d) => (
              <tr key={d.tripId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition">
                <td className="px-5 py-3 font-mono text-xs font-medium text-slate-800">{d.tripNumber}</td>
                <td className="px-5 py-3 text-slate-600 text-xs">{d.source} → {d.destination}</td>
                <td className="px-5 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${d.status === "COMPLETED" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                    {d.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-600">₹{d.revenue.toLocaleString()}</td>
                <td className="px-5 py-3 text-slate-600">₹{d.fuelCost.toLocaleString()}</td>
                <td className="px-5 py-3 text-slate-600">₹{d.expenseCost.toLocaleString()}</td>
                <td className="px-5 py-3 text-slate-600">₹{d.totalCost.toLocaleString()}</td>
                <td className="px-5 py-3">
                  <span className={`font-semibold ${d.profit >= 0 ? "text-green-700" : "text-red-600"}`}>
                    {d.profit >= 0 ? "+" : ""}₹{d.profit.toLocaleString()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
