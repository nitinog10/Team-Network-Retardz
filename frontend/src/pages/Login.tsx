// src/pages/Login.jsx

import { useState } from "react";

export default function Login() {
  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log(form);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-blue-100 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">
            Welcome Back 👋
          </h1>
          <p className="text-gray-500 mt-2">
            Sign in to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Email
            </label>

            <input
              type="email"
              name="email"
              placeholder="Enter your email"
              value={form.email}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            />
          </div>

          {/* Password */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-gray-700 font-medium">
                Password
              </label>

              <button
                type="button"
                className="text-sm text-indigo-600 hover:underline"
              >
                Forgot Password?
              </button>
            </div>

            <input
              type="password"
              name="password"
              placeholder="Enter your password"
              value={form.password}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            />
          </div>

          {/* Remember Me */}
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="accent-indigo-600"
              />
              Remember me
            </label>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-semibold transition duration-300"
          >
            Login
          </button>
        </form>

        <div className="mt-6 text-center text-gray-500">
          Don't have an account?{" "}
          <button className="text-indigo-600 font-medium hover:underline">
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
}