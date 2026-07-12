import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError, DRIVER_STATUSES, VERIFICATION_STATUSES } from "../lib/api";
import type { Driver } from "../lib/api";
import { useAuth } from "../lib/auth";

const emptyForm = {
  name: "",
  licenceNumber: "",
  licenceCategory: "HMV",
  licenceExpiry: "",
  safetyScore: 100,
  userId: "",
};

const LICENCE_CATEGORIES = ["HMV", "LMV", "HGMV", "MCWG"];

const statusColors: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-700",
  ON_TRIP: "bg-blue-100 text-blue-700",
  OFF_DUTY: "bg-amber-100 text-amber-700",
  SUSPENDED: "bg-red-100 text-red-700",
};

const verificationColors: Record<string, string> = {
  VERIFIED: "bg-green-100 text-green-700",
  UNVERIFIED: "bg-slate-200 text-slate-600",
  PENDING: "bg-amber-100 text-amber-700",
  FAILED: "bg-red-100 text-red-700",
};

function statusLabel(s: string) {
  return s.replace(/_/g, " ");
}

function isExpiringSoon(dateStr: string): "expired" | "warning" | "ok" {
  const expiry = new Date(dateStr);
  const now = new Date();
  if (expiry <= now) return "expired";
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  if (expiry.getTime() - now.getTime() <= thirtyDays) return "warning";
  return "ok";
}

export default function Drivers() {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterVerification, setFilterVerification] = useState("");

  const canWrite = user?.role === "ADMIN" || user?.role === "FLEET_MANAGER";
  const canSafety = user?.role === "ADMIN" || user?.role === "SAFETY_MANAGER";
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const load = () => {
    const filters: Record<string, string> = {};
    if (filterStatus) filters.status = filterStatus;
    if (filterVerification) filters.verificationStatus = filterVerification;
    api
      .listDrivers(filters)
      .then(({ drivers }) => setDrivers(drivers))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load drivers"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [filterStatus, filterVerification]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const payload = {
        ...form,
        licenceExpiry: new Date(form.licenceExpiry).toISOString(),
        userId: form.userId || undefined,
      };
      if (editingId) {
        const { userId, safetyScore, ...updatePayload } = payload;
        const { driver } = await api.updateDriver(editingId, updatePayload);
        setDrivers((prev) => prev.map((d) => (d.id === editingId ? driver : d)));
      } else {
        const { driver } = await api.createDriver(payload);
        setDrivers((prev) => [driver, ...prev]);
      }
      setForm(emptyForm);
      setShowForm(false);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save driver");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (d: Driver) => {
    setForm({
      name: d.name,
      licenceNumber: d.licenceNumber,
      licenceCategory: d.licenceCategory,
      licenceExpiry: new Date(d.licenceExpiry).toISOString().split("T")[0]!,
      safetyScore: d.safetyScore,
      userId: d.userId ?? "",
    });
    setEditingId(d.id);
    setShowForm(true);
  };

  const handleSafety = async (id: string, data: { safetyScore?: number; status?: string }) => {
    setError(null);
    try {
      const { driver } = await api.updateDriverSafety(id, data);
      setDrivers((prev) => prev.map((d) => (d.id === id ? driver : d)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update driver safety");
    }
  };

  const handleVerify = async (id: string) => {
    setError(null);
    setVerifyingId(id);
    try {
      const { driver: updated, verification } = await api.verifyDriver(id);
      setDrivers((prev) =>
        prev.map((d) =>
          d.id === id
            ? { ...d, verificationStatus: updated.verificationStatus, verifiedAt: updated.verifiedAt ?? d.verifiedAt }
            : d,
        ),
      );
      const icon = verification.status === "VERIFIED" ? "✅" : "❌";
      alert(`${icon} ${verification.details}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Verification failed");
    } finally {
      setVerifyingId(null);
    }
  };

  if (loading) return <p className="text-slate-500">Loading drivers...</p>;

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
          {DRIVER_STATUSES.map((s) => (
            <option key={s} value={s}>{statusLabel(s)}</option>
          ))}
        </select>
        <select
          value={filterVerification}
          onChange={(e) => setFilterVerification(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Verification</option>
          {VERIFICATION_STATUSES.map((s) => (
            <option key={s} value={s}>{statusLabel(s)}</option>
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
            {showForm ? "Cancel" : "+ Add Driver"}
          </button>
        )}
      </div>

      {/* Create / Edit form */}
      {showForm && canWrite && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4">
            {editingId ? "Edit Driver" : "Add Driver"}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <input
              placeholder="Full Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              placeholder="Licence Number"
              value={form.licenceNumber}
              onChange={(e) => setForm({ ...form, licenceNumber: e.target.value })}
              required
              className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={form.licenceCategory}
              onChange={(e) => setForm({ ...form, licenceCategory: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {LICENCE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="flex flex-col">
              <label className="text-xs text-slate-500 mb-1">Licence Expiry</label>
              <input
                type="date"
                value={form.licenceExpiry}
                onChange={(e) => setForm({ ...form, licenceExpiry: e.target.value })}
                required
                className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {!editingId && (
              <div className="flex flex-col">
                <label className="text-xs text-slate-500 mb-1">Safety Score</label>
                <input
                  type="number"
                  value={form.safetyScore}
                  onChange={(e) => setForm({ ...form, safetyScore: Number(e.target.value) })}
                  min={0}
                  max={100}
                  className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
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

      {/* Driver list */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Licence</th>
                <th className="px-6 py-3 font-medium">Category</th>
                <th className="px-6 py-3 font-medium">Expiry</th>
                <th className="px-6 py-3 font-medium">Safety</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Verification</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {drivers.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-400">
                    No drivers found
                  </td>
                </tr>
              )}
              {drivers.map((d) => {
                const expiry = isExpiringSoon(d.licenceExpiry);
                return (
                  <tr key={d.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition">
                    <td className="px-6 py-3 font-medium text-slate-800">
                      {d.name}
                      {d.user && (
                        <span className="ml-2 text-xs text-indigo-500">({d.user.email})</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-slate-600 font-mono text-xs">{d.licenceNumber}</td>
                    <td className="px-6 py-3 text-slate-600">{d.licenceCategory}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`text-sm ${
                          expiry === "expired"
                            ? "text-red-600 font-semibold"
                            : expiry === "warning"
                              ? "text-amber-600 font-medium"
                              : "text-slate-600"
                        }`}
                      >
                        {new Date(d.licenceExpiry).toLocaleDateString()}
                        {expiry === "expired" && " ⚠ Expired"}
                        {expiry === "warning" && " ⚠ Expiring soon"}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${d.safetyScore >= 70 ? "text-green-700" : d.safetyScore >= 40 ? "text-amber-600" : "text-red-600"}`}>
                          {d.safetyScore}
                        </span>
                        {canSafety && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => void handleSafety(d.id, { safetyScore: Math.min(100, d.safetyScore + 5) })}
                              className="text-xs px-1.5 py-0.5 rounded border border-green-200 text-green-600 hover:bg-green-50"
                              title="+5"
                            >
                              +
                            </button>
                            <button
                              onClick={() => void handleSafety(d.id, { safetyScore: Math.max(0, d.safetyScore - 5) })}
                              className="text-xs px-1.5 py-0.5 rounded border border-red-200 text-red-600 hover:bg-red-50"
                              title="-5"
                            >
                              −
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[d.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {statusLabel(d.status)}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${verificationColors[d.verificationStatus] ?? "bg-slate-100 text-slate-600"}`}>
                        {statusLabel(d.verificationStatus)}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-wrap gap-1">
                        {canWrite && (
                          <button
                            onClick={() => startEdit(d)}
                            className="text-xs px-2.5 py-1 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition"
                          >
                            Edit
                          </button>
                        )}
                        {canSafety && d.status !== "ON_TRIP" && (
                          <>
                            {d.status === "SUSPENDED" ? (
                              <button
                                onClick={() => void handleSafety(d.id, { status: "AVAILABLE" })}
                                className="text-xs px-2.5 py-1 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 transition"
                              >
                                Reinstate
                              </button>
                            ) : d.status === "AVAILABLE" ? (
                              <>
                                <button
                                  onClick={() => void handleSafety(d.id, { status: "SUSPENDED" })}
                                  className="text-xs px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition"
                                >
                                  Suspend
                                </button>
                                <button
                                  onClick={() => void handleSafety(d.id, { status: "OFF_DUTY" })}
                                  className="text-xs px-2.5 py-1 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 transition"
                                >
                                  Off Duty
                                </button>
                              </>
                            ) : d.status === "OFF_DUTY" ? (
                              <button
                                onClick={() => void handleSafety(d.id, { status: "AVAILABLE" })}
                                className="text-xs px-2.5 py-1 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 transition"
                              >
                                Set Available
                              </button>
                            ) : null}
                          </>
                        )}
                        {canSafety && d.verificationStatus !== "VERIFIED" && (
                          <button
                            onClick={() => void handleVerify(d.id)}
                            disabled={verifyingId === d.id}
                            className="text-xs px-2.5 py-1 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 transition"
                          >
                            {verifyingId === d.id ? "Verifying..." : "🔍 Verify (Mock)"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
