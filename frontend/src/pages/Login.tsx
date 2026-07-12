import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";

/* Demo credentials from seed.ts — every role uses the same password */
const DEMO_PASSWORD = "Demo@123";

interface DemoRole {
  label: string;
  email: string;
  icon: JSX.Element;
}

const DEMO_ROLES: DemoRole[] = [
  {
    label: "Fleet manager",
    email: "fleet@transitops.local",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M1 8h11v8H1zM12 10h4l3 3v3h-7" /><circle cx="5.5" cy="17.5" r="1.8" /><circle cx="15.5" cy="17.5" r="1.8" />
      </svg>
    ),
  },
  {
    label: "Driver",
    email: "driver@transitops.local",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 000 20M2 12h20" />
      </svg>
    ),
  },
  {
    label: "Safety officer",
    email: "safety@transitops.local",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    label: "Financial analyst",
    email: "finance@transitops.local",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
  },
];

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeRole, setActiveRole] = useState<string | null>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
    /* Clear the active role highlight when user edits manually */
    setActiveRole(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(form.email, form.password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong, try again");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleClick = async (role: DemoRole) => {
    setError(null);
    setActiveRole(role.email);
    setForm({ email: role.email, password: DEMO_PASSWORD });

    /* Auto-submit after filling credentials */
    setSubmitting(true);
    try {
      await login(role.email, DEMO_PASSWORD);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong, try again");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 px-4 relative overflow-hidden">
      {/* Subtle dot-grid backdrop */}
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage: "radial-gradient(circle, #d4d4d8 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(ellipse 60% 60% at 50% 40%, black, transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 60% 60% at 50% 40%, black, transparent)",
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/25 mb-4">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M5 17l4-12 3 8 3-5 4 9" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Sign in to TransitOps</h1>
          <p className="text-sm text-slate-500 mt-1">Your fleet, in one place.</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                name="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={handleChange}
                required
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Password</label>
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                required
                className="input w-full"
              />
            </div>

            {error && <p className="alert-error">{error}</p>}

            <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5">
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        {/* Role-based quick login */}
        <div className="mt-5">
          <div className="text-center mb-3">
            <span className="text-xs text-slate-400 font-medium tracking-wide uppercase">Quick demo access</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ROLES.map((role) => {
              const isActive = activeRole === role.email;
              return (
                <button
                  key={role.email}
                  type="button"
                  onClick={() => void handleRoleClick(role)}
                  disabled={submitting}
                  className={`
                    group flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border text-left text-[13px] font-medium
                    transition-all duration-150 cursor-pointer
                    ${isActive
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-100"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 hover:shadow-sm"
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  <span className={`shrink-0 transition-colors ${isActive ? "text-indigo-500" : "text-slate-400 group-hover:text-slate-500"}`}>
                    {role.icon}
                  </span>
                  <span className="truncate">{role.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 text-center">
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-1.5 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Password for all roles: Demo@123
          </span>
        </div>
      </div>
    </div>
  );
}
