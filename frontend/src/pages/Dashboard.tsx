import { useAuth } from "../lib/auth";
import { roleLabel } from "../lib/api";

export default function Dashboard() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-2xl font-bold text-slate-800">
          Welcome, {user.name}
        </h2>
        <p className="text-slate-500 mt-1">
          You are signed in as <span className="font-medium">{roleLabel(user.role)}</span>.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {["Fleet Status", "Active Trips", "Open Maintenance", "Licence Alerts"].map((title) => (
          <div
            key={title}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5"
          >
            <div className="text-sm text-slate-500">{title}</div>
            <div className="text-2xl font-bold text-slate-300 mt-2">—</div>
            <div className="text-xs text-slate-400 mt-1">Coming in a later phase</div>
          </div>
        ))}
      </div>
    </div>
  );
}
