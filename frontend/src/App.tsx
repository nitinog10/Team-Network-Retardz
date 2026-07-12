import { useState } from "react";
import { AuthProvider, useAuth } from "./lib/auth";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Vehicles from "./pages/Vehicles";
import Drivers from "./pages/Drivers";
import Trips from "./pages/Trips";
import Maintenance from "./pages/Maintenance";
import FuelExpenses from "./pages/FuelExpenses";
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
