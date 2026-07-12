import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
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

        <div className="mt-4 text-center">
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-1.5 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Demo: admin@transitops.local / Demo@123
          </span>
        </div>
      </div>
    </div>
  );
}
