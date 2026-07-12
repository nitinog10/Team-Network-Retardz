import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError, ROLES, roleLabel } from "../lib/api";
import type { User } from "../lib/api";
import { useAuth } from "../lib/auth";

const emptyForm = { name: "", email: "", password: "", role: "FLEET_MANAGER" };

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);

  const load = () => {
    api
      .listUsers()
      .then(({ users }) => setUsers(users))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load users"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const { user } = await api.createUser(form);
      setUsers((prev) => [...prev, user]);
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const patchUser = async (id: string, data: { role?: string; active?: boolean }) => {
    setError(null);
    try {
      const { user } = await api.updateUser(id, data);
      setUsers((prev) => prev.map((u) => (u.id === id ? user : u)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update user");
    }
  };

  if (loading) return <p className="text-slate-500">Loading users...</p>;

  return (
    <div className="space-y-6">
      {error && (
        <p className="alert-error">
          {error}
        </p>
      )}

      <div className="card p-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Add user</h3>
        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className="input"
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            className="input"
          />
          <input
            type="password"
            placeholder="Password (min 8)"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={8}
            className="input"
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="input bg-white"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={creating}
            className="btn-primary"
          >
            {creating ? "Adding..." : "Add"}
          </button>
        </form>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="thead-row">
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Email</th>
                <th className="px-6 py-3 font-medium">Role</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-6 py-3 font-medium text-slate-800">
                    {u.name}
                    {u.id === me?.id && <span className="ml-2 text-xs text-indigo-500">(you)</span>}
                  </td>
                  <td className="px-6 py-3 text-slate-600">{u.email}</td>
                  <td className="px-6 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => void patchUser(u.id, { role: e.target.value })}
                      className="input px-2 py-1"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {roleLabel(r)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        u.active
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {u.active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <button
                      onClick={() => void patchUser(u.id, { active: !u.active })}
                      disabled={u.id === me?.id}
                      className="btn-ghost"
                    >
                      {u.active ? "Disable" : "Enable"}
                    </button>
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
