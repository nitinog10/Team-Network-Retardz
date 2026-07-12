import { useState } from "react";
import { AuthProvider, useAuth } from "./lib/auth";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Shell from "./components/Shell";

function AppContent() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState("dashboard");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <Shell page={page} onNavigate={setPage}>
      {page === "users" && user.role === "ADMIN" ? <Users /> : <Dashboard />}
    </Shell>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
