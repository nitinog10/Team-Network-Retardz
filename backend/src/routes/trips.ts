import { Router } from "express";
import { prisma } from "../lib/db.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { createTripSchema, completeTripSchema } from "../validation/trips.js";
import {
  createDraftTrip,
  dispatchTrip,
  completeTrip,
  cancelTrip,
  TripError,
} from "../services/trips.js";
import type { TripStatus } from "@prisma/client";

export const tripsRouter = Router();

tripsRouter.use(requireAuth);

const tripSelect = {
  id: true,
  tripNumber: true,
  source: true,
  destination: true,
  cargoWeightKg: true,
  plannedDistanceKm: true,
  actualDistanceKm: true,
  finalOdometerKm: true,
  revenue: true,
  status: true,
  dispatchedAt: true,
  completedAt: true,
  cancelledAt: true,
  createdAt: true,
  vehicle: { select: { id: true, registrationNumber: true, type: true, status: true, odometerKm: true } },
  driver: { select: { id: true, name: true, licenceNumber: true, status: true, userId: true } },
} as const;

/**
 * Determines if the current user can access trips — handles both
 * roles with `trips.read` and DRIVER with `ownTrips.read`.
 */
function canReadTrips(req: Express.Request): boolean {
  const role = req.user!.role;
  return ["ADMIN", "FLEET_MANAGER", "SAFETY_MANAGER", "FINANCIAL_MANAGER", "DRIVER"].includes(role);
}

// List trips — auto-scoped to driver's own trips for DRIVER role
tripsRouter.get("/", async (req, res) => {
  if (!canReadTrips(req)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const where: Record<string, unknown> = { organisationId: req.user!.orgId };

  if (req.query.status) where.status = req.query.status as TripStatus;

  // DRIVER role: only see trips where the driver's userId matches session userId
  if (req.user!.role === "DRIVER") {
    const driver = await prisma.driver.findFirst({
      where: { userId: req.user!.id, organisationId: req.user!.orgId },
    });
    if (!driver) {
      res.json({ trips: [] });
      return;
    }
    where.driverId = driver.id;
  }

  const trips = await prisma.trip.findMany({
    where,
    select: tripSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json({ trips });
});

// Trip detail
tripsRouter.get("/:id", async (req, res) => {
  if (!canReadTrips(req)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const trip = await prisma.trip.findFirst({
    where: { id: req.params.id, organisationId: req.user!.orgId },
    include: {
      vehicle: { select: { id: true, registrationNumber: true, type: true, status: true, odometerKm: true, maxLoadKg: true } },
      driver: { select: { id: true, name: true, licenceNumber: true, status: true, userId: true, verificationStatus: true } },
      fuelLogs: { orderBy: { loggedAt: "desc" }, take: 20 },
      expenses: { orderBy: { incurredAt: "desc" }, take: 20 },
    },
  });

  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  // DRIVER can only see own trips
  if (req.user!.role === "DRIVER") {
    if (!trip.driver.userId || trip.driver.userId !== req.user!.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  res.json({ trip });
});

// Create draft trip
tripsRouter.post("/", requirePermission("trips", "create"), async (req, res) => {
  const parsed = createTripSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  try {
    const trip = await createDraftTrip(req.user!, parsed.data);
    res.status(201).json({ trip });
  } catch (err) {
    if (err instanceof TripError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

// Dispatch trip
tripsRouter.post("/:id/dispatch", requirePermission("trips", "update"), async (req, res) => {
  try {
    const trip = await dispatchTrip(req.user!, req.params.id);
    res.json({ trip });
  } catch (err) {
    if (err instanceof TripError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

// Complete trip — DRIVER can complete own trip, FLEET_MANAGER/ADMIN can complete any
tripsRouter.post("/:id/complete", async (req, res) => {
  const user = req.user!;
  const canComplete =
    user.role === "ADMIN" ||
    user.role === "FLEET_MANAGER" ||
    user.role === "DRIVER";

  if (!canComplete) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = completeTripSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  try {
    const trip = await completeTrip(req.user!, req.params.id, parsed.data.finalOdometerKm);
    res.json({ trip });
  } catch (err) {
    if (err instanceof TripError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

// Cancel trip
tripsRouter.post("/:id/cancel", requirePermission("trips", "update"), async (req, res) => {
  try {
    const trip = await cancelTrip(req.user!, req.params.id);
    res.json({ trip });
  } catch (err) {
    if (err instanceof TripError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});
