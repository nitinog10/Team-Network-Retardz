export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  orgId?: string;
  active?: boolean;
}

export interface Vehicle {
  id: string;
  registrationNumber: string;
  type: string;
  maxLoadKg: number;
  odometerKm: number;
  acquisitionCost: number;
  region: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Driver {
  id: string;
  name: string;
  licenceNumber: string;
  licenceCategory: string;
  licenceExpiry: string;
  safetyScore: number;
  status: string;
  verificationStatus: string;
  verifiedAt: string | null;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; email: string; name: string } | null;
}

export interface Trip {
  id: string;
  tripNumber: string;
  source: string;
  destination: string;
  cargoWeightKg: number;
  plannedDistanceKm: number;
  actualDistanceKm: number | null;
  finalOdometerKm: number | null;
  revenue: number;
  status: string;
  dispatchedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  vehicle: { id: string; registrationNumber: string; type: string; status: string; odometerKm: number };
  driver: { id: string; name: string; licenceNumber?: string; status: string; userId?: string | null };
}

export interface AvailableVehicle {
  id: string;
  registrationNumber: string;
  type: string;
  maxLoadKg: number;
  region: string;
  odometerKm: number;
}

export interface AvailableDriver {
  id: string;
  name: string;
  licenceNumber: string;
  licenceCategory: string;
  licenceExpiry: string;
}

export interface MaintenanceLog {
  id: string;
  vehicleId: string;
  description: string;
  status: string;
  cost: number;
  openedAt: string;
  closedAt: string | null;
  vehicle: { id: string; registrationNumber: string; type: string; status: string };
}

export interface FuelLog {
  id: string;
  vehicleId: string;
  tripId: string | null;
  litres: number;
  cost: number;
  odometerKm: number;
  loggedAt: string;
  vehicle: { id: string; registrationNumber: string; type: string };
  trip: { id: string; tripNumber: string } | null;
}

export interface Expense {
  id: string;
  vehicleId: string | null;
  tripId: string | null;
  category: string;
  amount: number;
  notes: string | null;
  incurredAt: string;
  vehicle: { id: string; registrationNumber: string; type: string } | null;
  trip: { id: string; tripNumber: string } | null;
}

export interface FuelEfficiency {
  vehicleId: string;
  registrationNumber: string;
  type: string;
  totalLitres: number;
  distanceKm: number;
  kmPerLitre: number | null;
}

export interface VehicleCost {
  vehicleId: string;
  registrationNumber: string;
  type: string;
  maintenanceCost: number;
  fuelCost: number;
  expenseCost: number;
  totalCost: number;
}

export interface TripCost {
  tripId: string;
  tripNumber: string;
  source: string;
  destination: string;
  status: string;
  revenue: number;
  fuelCost: number;
  expenseCost: number;
  totalCost: number;
  profit: number;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, (body as { error?: string }).error ?? "Request failed");
  }
  return body as T;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  me: () => request<{ user: User }>("/api/auth/me"),

  // Users
  listUsers: () => request<{ users: User[] }>("/api/users"),
  createUser: (data: { email: string; name: string; password: string; role: string }) =>
    request<{ user: User }>("/api/users", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id: string, data: { role?: string; active?: boolean; name?: string }) =>
    request<{ user: User }>(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  // Vehicles
  listVehicles: (filters?: { status?: string; type?: string; region?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.type) params.set("type", filters.type);
    if (filters?.region) params.set("region", filters.region);
    const qs = params.toString();
    return request<{ vehicles: Vehicle[] }>(`/api/vehicles${qs ? `?${qs}` : ""}`);
  },
  getVehicle: (id: string) => request<{ vehicle: Vehicle }>(`/api/vehicles/${id}`),
  createVehicle: (data: {
    registrationNumber: string;
    type: string;
    maxLoadKg: number;
    odometerKm?: number;
    acquisitionCost?: number;
    region: string;
  }) => request<{ vehicle: Vehicle }>("/api/vehicles", { method: "POST", body: JSON.stringify(data) }),
  updateVehicle: (id: string, data: Partial<{
    registrationNumber: string;
    type: string;
    maxLoadKg: number;
    odometerKm: number;
    acquisitionCost: number;
    region: string;
  }>) => request<{ vehicle: Vehicle }>(`/api/vehicles/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  retireVehicle: (id: string) =>
    request<{ vehicle: Vehicle }>(`/api/vehicles/${id}/retire`, { method: "POST" }),
  availableVehicles: () => request<{ vehicles: AvailableVehicle[] }>("/api/vehicles/available"),

  // Drivers
  listDrivers: (filters?: { status?: string; verificationStatus?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.verificationStatus) params.set("verificationStatus", filters.verificationStatus);
    const qs = params.toString();
    return request<{ drivers: Driver[] }>(`/api/drivers${qs ? `?${qs}` : ""}`);
  },
  getDriver: (id: string) => request<{ driver: Driver }>(`/api/drivers/${id}`),
  createDriver: (data: {
    name: string;
    licenceNumber: string;
    licenceCategory: string;
    licenceExpiry: string;
    safetyScore?: number;
    userId?: string;
  }) => request<{ driver: Driver }>("/api/drivers", { method: "POST", body: JSON.stringify(data) }),
  updateDriver: (id: string, data: Partial<{
    name: string;
    licenceNumber: string;
    licenceCategory: string;
    licenceExpiry: string;
    userId: string | null;
  }>) => request<{ driver: Driver }>(`/api/drivers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  updateDriverSafety: (id: string, data: { safetyScore?: number; status?: string }) =>
    request<{ driver: Driver }>(`/api/drivers/${id}/safety`, { method: "PATCH", body: JSON.stringify(data) }),
  availableDrivers: () => request<{ drivers: AvailableDriver[] }>("/api/drivers/available"),

  // Trips
  listTrips: (filters?: { status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    const qs = params.toString();
    return request<{ trips: Trip[] }>(`/api/trips${qs ? `?${qs}` : ""}`);
  },
  getTrip: (id: string) => request<{ trip: Trip }>(`/api/trips/${id}`),
  createTrip: (data: {
    source: string;
    destination: string;
    vehicleId: string;
    driverId: string;
    cargoWeightKg: number;
    plannedDistanceKm: number;
    revenue: number;
  }) => request<{ trip: Trip }>("/api/trips", { method: "POST", body: JSON.stringify(data) }),
  dispatchTrip: (id: string) =>
    request<{ trip: Trip }>(`/api/trips/${id}/dispatch`, { method: "POST" }),
  completeTrip: (id: string, finalOdometerKm: number) =>
    request<{ trip: Trip }>(`/api/trips/${id}/complete`, {
      method: "POST",
      body: JSON.stringify({ finalOdometerKm }),
    }),
  cancelTrip: (id: string) =>
    request<{ trip: Trip }>(`/api/trips/${id}/cancel`, { method: "POST" }),

  // Maintenance
  listMaintenance: (filters?: { status?: string; vehicleId?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.vehicleId) params.set("vehicleId", filters.vehicleId);
    const qs = params.toString();
    return request<{ logs: MaintenanceLog[] }>(`/api/maintenance${qs ? `?${qs}` : ""}`);
  },
  openMaintenance: (data: { vehicleId: string; description: string }) =>
    request<{ log: MaintenanceLog }>("/api/maintenance", { method: "POST", body: JSON.stringify(data) }),
  closeMaintenance: (id: string, cost: number) =>
    request<{ log: MaintenanceLog }>(`/api/maintenance/${id}/close`, {
      method: "POST",
      body: JSON.stringify({ cost }),
    }),

  // Fuel
  listFuel: (filters?: { vehicleId?: string; tripId?: string }) => {
    const params = new URLSearchParams();
    if (filters?.vehicleId) params.set("vehicleId", filters.vehicleId);
    if (filters?.tripId) params.set("tripId", filters.tripId);
    const qs = params.toString();
    return request<{ logs: FuelLog[] }>(`/api/fuel${qs ? `?${qs}` : ""}`);
  },
  createFuel: (data: {
    vehicleId: string;
    tripId?: string;
    litres: number;
    cost: number;
    odometerKm: number;
  }) => request<{ log: FuelLog }>("/api/fuel", { method: "POST", body: JSON.stringify(data) }),
  fuelEfficiency: () => request<{ efficiency: FuelEfficiency[] }>("/api/fuel/efficiency"),

  // Expenses
  listExpenses: (filters?: { vehicleId?: string; tripId?: string; category?: string }) => {
    const params = new URLSearchParams();
    if (filters?.vehicleId) params.set("vehicleId", filters.vehicleId);
    if (filters?.tripId) params.set("tripId", filters.tripId);
    if (filters?.category) params.set("category", filters.category);
    const qs = params.toString();
    return request<{ expenses: Expense[] }>(`/api/expenses${qs ? `?${qs}` : ""}`);
  },
  createExpense: (data: {
    vehicleId?: string;
    tripId?: string;
    category: string;
    amount: number;
    notes?: string;
    incurredAt?: string;
  }) => request<{ expense: Expense }>("/api/expenses", { method: "POST", body: JSON.stringify(data) }),
  vehicleCosts: () => request<{ costs: VehicleCost[] }>("/api/expenses/vehicle-costs"),
  tripCosts: () => request<{ costs: TripCost[] }>("/api/expenses/trip-costs"),
};

export const ROLES = [
  "ADMIN",
  "FLEET_MANAGER",
  "SAFETY_MANAGER",
  "FINANCIAL_MANAGER",
  "DRIVER",
] as const;

export function roleLabel(role: string): string {
  return role
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const VEHICLE_STATUSES = ["AVAILABLE", "ON_TRIP", "IN_SHOP", "RETIRED"] as const;
export const DRIVER_STATUSES = ["AVAILABLE", "ON_TRIP", "OFF_DUTY", "SUSPENDED"] as const;
export const VERIFICATION_STATUSES = ["UNVERIFIED", "PENDING", "VERIFIED", "FAILED"] as const;
export const TRIP_STATUSES = ["DRAFT", "DISPATCHED", "COMPLETED", "CANCELLED"] as const;
export const MAINTENANCE_STATUSES = ["OPEN", "CLOSED"] as const;
export const EXPENSE_CATEGORIES = ["FUEL", "TOLL", "REPAIR", "PERMIT", "OTHER"] as const;
