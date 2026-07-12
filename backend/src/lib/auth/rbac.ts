import type { Role } from "@prisma/client";

export type Resource =
  | "users"
  | "vehicles"
  | "drivers"
  | "driverSafety"
  | "trips"
  | "ownTrips"
  | "maintenance"
  | "fuel"
  | "expenses"
  | "reports"
  | "activity";

export type Action = "read" | "create" | "update" | "delete";

type PermissionMap = Record<Role, Partial<Record<Resource, Action[]>>>;

const ALL: Action[] = ["read", "create", "update", "delete"];
const READ: Action[] = ["read"];
const RW: Action[] = ["read", "create", "update"];

/**
 * Single source of truth for role → resource/action access.
 * Role is always taken from the verified session, never from the client.
 */
export const PERMISSIONS: PermissionMap = {
  ADMIN: {
    users: ALL,
    vehicles: ALL,
    drivers: ALL,
    driverSafety: RW,
    trips: ALL,
    maintenance: ALL,
    fuel: ALL,
    expenses: ALL,
    reports: READ,
    activity: READ,
  },
  FLEET_MANAGER: {
    vehicles: RW,
    drivers: RW,
    trips: RW,
    maintenance: RW,
    fuel: RW,
    reports: READ,
  },
  SAFETY_MANAGER: {
    drivers: READ,
    driverSafety: RW,
    trips: READ,
    reports: READ,
  },
  FINANCIAL_MANAGER: {
    vehicles: READ,
    trips: READ,
    fuel: RW,
    expenses: RW,
    reports: READ,
  },
  DRIVER: {
    ownTrips: RW,
  },
};

export function can(role: Role, resource: Resource, action: Action): boolean {
  return PERMISSIONS[role][resource]?.includes(action) ?? false;
}
