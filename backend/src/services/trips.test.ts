import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient, Role, VehicleStatus, DriverStatus, VerificationStatus, TripStatus } from "@prisma/client";
import {
  createDraftTrip,
  dispatchTrip,
  completeTrip,
  cancelTrip,
  TripError,
} from "./trips.js";
import type { AuthedUser } from "../middleware/auth.js";

const prisma = new PrismaClient();

const ORG_ID = "test-org-trips";
const ACTOR: AuthedUser = {
  id: "test-user-trips",
  orgId: ORG_ID,
  role: "FLEET_MANAGER" as Role,
  email: "test@test.local",
  name: "Test Fleet",
};

const DRIVER_ACTOR: AuthedUser = {
  id: "test-driver-user",
  orgId: ORG_ID,
  role: "DRIVER" as Role,
  email: "driver@test.local",
  name: "Test Driver",
};

async function cleanup() {
  await prisma.activityLog.deleteMany({ where: { organisationId: ORG_ID } });
  await prisma.trip.deleteMany({ where: { organisationId: ORG_ID } });
  await prisma.driver.deleteMany({ where: { organisationId: ORG_ID } });
  await prisma.vehicle.deleteMany({ where: { organisationId: ORG_ID } });
  await prisma.user.deleteMany({ where: { organisationId: ORG_ID } });
  await prisma.organisation.deleteMany({ where: { id: ORG_ID } });
}

async function seedTestData() {
  await prisma.organisation.create({ data: { id: ORG_ID, name: "Test Org" } });

  await prisma.user.createMany({
    data: [
      { id: ACTOR.id, organisationId: ORG_ID, email: ACTOR.email, name: ACTOR.name, passwordHash: "x", role: ACTOR.role },
      { id: DRIVER_ACTOR.id, organisationId: ORG_ID, email: DRIVER_ACTOR.email, name: DRIVER_ACTOR.name, passwordHash: "x", role: DRIVER_ACTOR.role },
    ],
  });

  await prisma.vehicle.createMany({
    data: [
      { id: "v-available", organisationId: ORG_ID, registrationNumber: "TEST-V1", type: "Truck", maxLoadKg: 10000, odometerKm: 50000, region: "West", status: VehicleStatus.AVAILABLE },
      { id: "v-on-trip", organisationId: ORG_ID, registrationNumber: "TEST-V2", type: "Truck", maxLoadKg: 10000, odometerKm: 30000, region: "West", status: VehicleStatus.ON_TRIP },
      { id: "v-in-shop", organisationId: ORG_ID, registrationNumber: "TEST-V3", type: "Truck", maxLoadKg: 10000, odometerKm: 20000, region: "West", status: VehicleStatus.IN_SHOP },
      { id: "v-small", organisationId: ORG_ID, registrationNumber: "TEST-V4", type: "Van", maxLoadKg: 500, odometerKm: 10000, region: "West", status: VehicleStatus.AVAILABLE },
    ],
  });

  const year = new Date().getFullYear();
  await prisma.driver.createMany({
    data: [
      { id: "d-available", organisationId: ORG_ID, userId: DRIVER_ACTOR.id, name: "Available Verified", licenceNumber: "LIC-001", licenceCategory: "HMV", licenceExpiry: new Date(year + 2, 6, 1), status: DriverStatus.AVAILABLE, verificationStatus: VerificationStatus.VERIFIED, safetyScore: 90 },
      { id: "d-suspended", organisationId: ORG_ID, name: "Suspended Driver", licenceNumber: "LIC-002", licenceCategory: "HMV", licenceExpiry: new Date(year + 2, 6, 1), status: DriverStatus.SUSPENDED, verificationStatus: VerificationStatus.VERIFIED, safetyScore: 30 },
      { id: "d-expired-licence", organisationId: ORG_ID, name: "Expired Licence", licenceNumber: "LIC-003", licenceCategory: "HMV", licenceExpiry: new Date(year - 1, 0, 1), status: DriverStatus.AVAILABLE, verificationStatus: VerificationStatus.VERIFIED, safetyScore: 80 },
      { id: "d-unverified", organisationId: ORG_ID, name: "Unverified Driver", licenceNumber: "LIC-004", licenceCategory: "HMV", licenceExpiry: new Date(year + 2, 6, 1), status: DriverStatus.AVAILABLE, verificationStatus: VerificationStatus.UNVERIFIED, safetyScore: 95 },
      { id: "d-on-trip", organisationId: ORG_ID, name: "On Trip Driver", licenceNumber: "LIC-005", licenceCategory: "HMV", licenceExpiry: new Date(year + 2, 6, 1), status: DriverStatus.ON_TRIP, verificationStatus: VerificationStatus.VERIFIED, safetyScore: 85 },
    ],
  });
}

describe("Trip Service", () => {
  beforeAll(async () => {
    await cleanup();
    await seedTestData();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  // Reset vehicle/driver statuses between tests where needed
  beforeEach(async () => {
    await prisma.vehicle.update({ where: { id: "v-available" }, data: { status: VehicleStatus.AVAILABLE, odometerKm: 50000 } });
    await prisma.driver.update({ where: { id: "d-available" }, data: { status: DriverStatus.AVAILABLE } });
  });

  describe("createDraftTrip", () => {
    it("should create a DRAFT trip", async () => {
      const trip = await createDraftTrip(ACTOR, {
        source: "Mumbai",
        destination: "Pune",
        vehicleId: "v-available",
        driverId: "d-available",
        cargoWeightKg: 5000,
        plannedDistanceKm: 150,
        revenue: 45000,
      });
      expect(trip.status).toBe("DRAFT");
      expect(trip.tripNumber).toMatch(/^TRIP-/);
    });
  });

  describe("dispatchTrip", () => {
    it("should dispatch a valid DRAFT trip", async () => {
      const draft = await createDraftTrip(ACTOR, {
        source: "A",
        destination: "B",
        vehicleId: "v-available",
        driverId: "d-available",
        cargoWeightKg: 5000,
        plannedDistanceKm: 100,
        revenue: 10000,
      });
      const trip = await dispatchTrip(ACTOR, draft.id);
      expect(trip!.status).toBe("DISPATCHED");
      expect(trip!.vehicle.status).toBe("ON_TRIP");
      expect(trip!.driver.status).toBe("ON_TRIP");
    });

    it("should reject dispatch when vehicle is not AVAILABLE", async () => {
      const draft = await createDraftTrip(ACTOR, {
        source: "A",
        destination: "B",
        vehicleId: "v-on-trip",
        driverId: "d-available",
        cargoWeightKg: 5000,
        plannedDistanceKm: 100,
        revenue: 10000,
      });
      await expect(dispatchTrip(ACTOR, draft.id)).rejects.toThrow(TripError);
      await expect(dispatchTrip(ACTOR, draft.id)).rejects.toThrow(/not available/i);
    });

    it("should reject dispatch when driver is SUSPENDED", async () => {
      const draft = await createDraftTrip(ACTOR, {
        source: "A",
        destination: "B",
        vehicleId: "v-available",
        driverId: "d-suspended",
        cargoWeightKg: 5000,
        plannedDistanceKm: 100,
        revenue: 10000,
      });
      await expect(dispatchTrip(ACTOR, draft.id)).rejects.toThrow(/not available/i);
    });

    it("should reject dispatch when driver licence is expired", async () => {
      const draft = await createDraftTrip(ACTOR, {
        source: "A",
        destination: "B",
        vehicleId: "v-available",
        driverId: "d-expired-licence",
        cargoWeightKg: 5000,
        plannedDistanceKm: 100,
        revenue: 10000,
      });
      await expect(dispatchTrip(ACTOR, draft.id)).rejects.toThrow(/expired/i);
    });

    it("should reject dispatch when driver is not VERIFIED", async () => {
      const draft = await createDraftTrip(ACTOR, {
        source: "A",
        destination: "B",
        vehicleId: "v-available",
        driverId: "d-unverified",
        cargoWeightKg: 5000,
        plannedDistanceKm: 100,
        revenue: 10000,
      });
      await expect(dispatchTrip(ACTOR, draft.id)).rejects.toThrow(/not verified/i);
    });

    it("should reject dispatch when cargo exceeds vehicle capacity", async () => {
      const draft = await createDraftTrip(ACTOR, {
        source: "A",
        destination: "B",
        vehicleId: "v-small",
        driverId: "d-available",
        cargoWeightKg: 1000,
        plannedDistanceKm: 100,
        revenue: 10000,
      });
      await expect(dispatchTrip(ACTOR, draft.id)).rejects.toThrow(/exceeds/i);
    });

    it("should reject dispatching a non-DRAFT trip", async () => {
      const draft = await createDraftTrip(ACTOR, {
        source: "A",
        destination: "B",
        vehicleId: "v-available",
        driverId: "d-available",
        cargoWeightKg: 5000,
        plannedDistanceKm: 100,
        revenue: 10000,
      });
      await dispatchTrip(ACTOR, draft.id);
      // Try dispatching again — it's now DISPATCHED
      await expect(dispatchTrip(ACTOR, draft.id)).rejects.toThrow(/only draft/i);
    });
  });

  describe("completeTrip", () => {
    it("should complete a DISPATCHED trip and compute actualDistanceKm", async () => {
      const draft = await createDraftTrip(ACTOR, {
        source: "A",
        destination: "B",
        vehicleId: "v-available",
        driverId: "d-available",
        cargoWeightKg: 5000,
        plannedDistanceKm: 100,
        revenue: 10000,
      });
      await dispatchTrip(ACTOR, draft.id);
      const finalOdometer = 50150;
      const trip = await completeTrip(ACTOR, draft.id, finalOdometer);
      expect(trip!.status).toBe("COMPLETED");
      expect(trip!.vehicle.status).toBe("AVAILABLE");
      expect(trip!.driver.status).toBe("AVAILABLE");
      // actualDistanceKm = finalOdometer - original odometerKm (50000)
      expect(trip!.vehicle.odometerKm).toBe(finalOdometer);
    });

    it("should reject completing a DRAFT trip", async () => {
      const draft = await createDraftTrip(ACTOR, {
        source: "A",
        destination: "B",
        vehicleId: "v-available",
        driverId: "d-available",
        cargoWeightKg: 5000,
        plannedDistanceKm: 100,
        revenue: 10000,
      });
      await expect(completeTrip(ACTOR, draft.id, 55000)).rejects.toThrow(/only dispatched/i);
    });

    it("should reject when final odometer is less than current", async () => {
      const draft = await createDraftTrip(ACTOR, {
        source: "A",
        destination: "B",
        vehicleId: "v-available",
        driverId: "d-available",
        cargoWeightKg: 5000,
        plannedDistanceKm: 100,
        revenue: 10000,
      });
      await dispatchTrip(ACTOR, draft.id);
      await expect(completeTrip(ACTOR, draft.id, 100)).rejects.toThrow(/must be/i);
    });
  });

  describe("cancelTrip", () => {
    it("should cancel a DRAFT trip", async () => {
      const draft = await createDraftTrip(ACTOR, {
        source: "A",
        destination: "B",
        vehicleId: "v-available",
        driverId: "d-available",
        cargoWeightKg: 5000,
        plannedDistanceKm: 100,
        revenue: 10000,
      });
      const trip = await cancelTrip(ACTOR, draft.id);
      expect(trip!.status).toBe("CANCELLED");
    });

    it("should cancel a DISPATCHED trip and free resources", async () => {
      const draft = await createDraftTrip(ACTOR, {
        source: "A",
        destination: "B",
        vehicleId: "v-available",
        driverId: "d-available",
        cargoWeightKg: 5000,
        plannedDistanceKm: 100,
        revenue: 10000,
      });
      await dispatchTrip(ACTOR, draft.id);
      const trip = await cancelTrip(ACTOR, draft.id);
      expect(trip!.status).toBe("CANCELLED");
      expect(trip!.vehicle.status).toBe("AVAILABLE");
      expect(trip!.driver.status).toBe("AVAILABLE");
    });

    it("should reject cancelling a COMPLETED trip", async () => {
      const draft = await createDraftTrip(ACTOR, {
        source: "A",
        destination: "B",
        vehicleId: "v-available",
        driverId: "d-available",
        cargoWeightKg: 5000,
        plannedDistanceKm: 100,
        revenue: 10000,
      });
      await dispatchTrip(ACTOR, draft.id);
      await completeTrip(ACTOR, draft.id, 55000);
      await expect(cancelTrip(ACTOR, draft.id)).rejects.toThrow(/only draft or dispatched/i);
    });
  });
});
