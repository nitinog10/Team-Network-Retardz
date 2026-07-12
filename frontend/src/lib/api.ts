export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  orgId?: string;
  active?: boolean;
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
  login: (email: string, password: string) =>
    request<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  me: () => request<{ user: User }>("/api/auth/me"),
  listUsers: () => request<{ users: User[] }>("/api/users"),
  createUser: (data: { email: string; name: string; password: string; role: string }) =>
    request<{ user: User }>("/api/users", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id: string, data: { role?: string; active?: boolean; name?: string }) =>
    request<{ user: User }>(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
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
