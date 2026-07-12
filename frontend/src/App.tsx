import { useEffect, useRef, useState } from "react";
import { AuthProvider, useAuth } from "./lib/auth";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Vehicles from "./pages/Vehicles";
import Drivers from "./pages/Drivers";
import Trips from "./pages/Trips";
import Maintenance from "./pages/Maintenance";
import FuelExpenses from "./pages/FuelExpenses";
import ActivityLog from "./pages/ActivityLog";
import Shell from "./components/Shell";

/** Map each role to its default landing page after login */
const ROLE_LANDING_PAGE: Record<string, string> = {
  ADMIN: "dashboard",
  FLEET_MANAGER: "vehicles",
  SAFETY_MANAGER: "drivers",
  FINANCIAL_MANAGER: "fuel-expenses",
  DRIVER: "my-trips",
};

function AppContent() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState("dashboard");
  const prevUserRef = useRef<string | null>(null);

  /* When a user logs in, redirect to their role-specific landing page */
  useEffect(() => {
    if (user && prevUserRef.current !== user.id) {
      const landing = ROLE_LANDING_PAGE[user.role] ?? "dashboard";
      setPage(landing);
    }
    prevUserRef.current = user?.id ?? null;
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-indigo-600 animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  const renderPage = () => {
    switch (page) {
      case "users":
        return user.role === "ADMIN" ? <Users /> : <Dashboard />;
      case "vehicles":
        return <Vehicles />;
      case "drivers":
        return <Drivers />;
      case "trips":
        return <Trips />;
      case "my-trips":
        return <Trips driverOnly />;
      case "maintenance":
        return <Maintenance />;
      case "fuel-expenses":
        return <FuelExpenses />;
      case "activity":
        return user.role === "ADMIN" ? <ActivityLog /> : <Dashboard />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Shell page={page} onNavigate={setPage}>
      {renderPage()}
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
