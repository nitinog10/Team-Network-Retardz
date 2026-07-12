import { describe, it, expect } from "vitest";
import { can, PERMISSIONS } from "./rbac.js";

describe("RBAC permission map", () => {
  it("admin can manage users", () => {
    expect(can("ADMIN", "users", "read")).toBe(true);
    expect(can("ADMIN", "users", "create")).toBe(true);
    expect(can("ADMIN", "users", "update")).toBe(true);
  });

  it("non-admin roles cannot touch users", () => {
    for (const role of ["FLEET_MANAGER", "SAFETY_MANAGER", "FINANCIAL_MANAGER", "DRIVER"] as const) {
      expect(can(role, "users", "read")).toBe(false);
      expect(can(role, "users", "create")).toBe(false);
    }
  });

  it("fleet manager manages vehicles and trips but not expenses", () => {
    expect(can("FLEET_MANAGER", "vehicles", "create")).toBe(true);
    expect(can("FLEET_MANAGER", "trips", "update")).toBe(true);
    expect(can("FLEET_MANAGER", "expenses", "create")).toBe(false);
  });

  it("safety manager can update safety fields but not create drivers", () => {
    expect(can("SAFETY_MANAGER", "driverSafety", "update")).toBe(true);
    expect(can("SAFETY_MANAGER", "drivers", "create")).toBe(false);
    expect(can("SAFETY_MANAGER", "drivers", "read")).toBe(true);
  });

  it("financial manager owns expenses, reads vehicles", () => {
    expect(can("FINANCIAL_MANAGER", "expenses", "create")).toBe(true);
    expect(can("FINANCIAL_MANAGER", "vehicles", "read")).toBe(true);
    expect(can("FINANCIAL_MANAGER", "vehicles", "update")).toBe(false);
  });

  it("driver only has own-trips access", () => {
    expect(can("DRIVER", "ownTrips", "read")).toBe(true);
    expect(can("DRIVER", "ownTrips", "update")).toBe(true);
    expect(can("DRIVER", "trips", "read")).toBe(false);
    expect(can("DRIVER", "vehicles", "read")).toBe(false);
  });

  it("unknown resource/action combinations default to deny", () => {
    for (const role of Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]) {
      expect(can(role, "users", "delete")).toBe(role === "ADMIN");
    }
  });
});
