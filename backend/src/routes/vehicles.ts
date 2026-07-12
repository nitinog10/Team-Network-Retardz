import { Router } from "express";
import { prisma } from "../lib/db.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { createVehicleSchema, updateVehicleSchema } from "../validation/vehicles.js";
import { logActivity } from "../services/activity.js";
import type { VehicleStatus } from "@prisma/client";

export const vehiclesRouter = Router();

vehiclesRouter.use(requireAuth);

const vehicleSelect = {
  id: true,
  registrationNumber: true,
  type: true,
  maxLoadKg: true,
  odometerKm: true,
  acquisitionCost: true,
  region: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

// List vehicles with optional filters
vehiclesRouter.get("/", requirePermission("vehicles", "read"), async (req, res) => {
  const where: Record<string, unknown> = { organisationId: req.user!.orgId };

  if (req.query.status) where.status = req.query.status as VehicleStatus;
  if (req.query.type) where.type = req.query.type as string;
  if (req.query.region) where.region = req.query.region as string;

  const vehicles = await prisma.vehicle.findMany({
    where,
    select: vehicleSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json({ vehicles });
});

// Available vehicles for trip dispatch picker
vehiclesRouter.get("/available", requirePermission("vehicles", "read"), async (req, res) => {
  const vehicles = await prisma.vehicle.findMany({
    where: { organisationId: req.user!.orgId, status: "AVAILABLE" },
    select: { id: true, registrationNumber: true, type: true, maxLoadKg: true, region: true, odometerKm: true },
    orderBy: { registrationNumber: "asc" },
  });
  res.json({ vehicles });
});

// Vehicle detail with related records
vehiclesRouter.get("/:id", requirePermission("vehicles", "read"), async (req, res) => {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: req.params.id, organisationId: req.user!.orgId },
    include: {
      maintenanceLogs: { orderBy: { openedAt: "desc" }, take: 20 },
      fuelLogs: { orderBy: { loggedAt: "desc" }, take: 20 },
      expenses: { orderBy: { incurredAt: "desc" }, take: 20 },
    },
  });
  if (!vehicle) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }
  res.json({ vehicle });
});

// Create vehicle
vehiclesRouter.post("/", requirePermission("vehicles", "create"), async (req, res) => {
  const parsed = createVehicleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const existing = await prisma.vehicle.findFirst({
    where: {
      organisationId: req.user!.orgId,
      registrationNumber: parsed.data.registrationNumber,
    },
  });
  if (existing) {
    res.status(409).json({ error: "A vehicle with this registration number already exists" });
    return;
  }

  const vehicle = await prisma.vehicle.create({
    data: { ...parsed.data, organisationId: req.user!.orgId },
    select: vehicleSelect,
  });

  await logActivity(req.user!, "Vehicle", vehicle.id, "created", {
    registrationNumber: vehicle.registrationNumber,
  });
  res.status(201).json({ vehicle });
});

// Update vehicle
vehiclesRouter.patch("/:id", requirePermission("vehicles", "update"), async (req, res) => {
  const parsed = updateVehicleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: req.params.id, organisationId: req.user!.orgId },
  });
  if (!vehicle) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }

  // If updating registration number, check uniqueness
  if (parsed.data.registrationNumber && parsed.data.registrationNumber !== vehicle.registrationNumber) {
    const dup = await prisma.vehicle.findFirst({
      where: {
        organisationId: req.user!.orgId,
        registrationNumber: parsed.data.registrationNumber,
        id: { not: vehicle.id },
      },
    });
    if (dup) {
      res.status(409).json({ error: "A vehicle with this registration number already exists" });
      return;
    }
  }

  const updated = await prisma.vehicle.update({
    where: { id: vehicle.id },
    data: parsed.data,
    select: vehicleSelect,
  });

  await logActivity(req.user!, "Vehicle", vehicle.id, "updated", parsed.data);
  res.json({ vehicle: updated });
});

// Retire vehicle
vehiclesRouter.post("/:id/retire", requirePermission("vehicles", "update"), async (req, res) => {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: req.params.id, organisationId: req.user!.orgId },
  });
  if (!vehicle) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }

  if (vehicle.status === "ON_TRIP") {
    res.status(400).json({ error: "Cannot retire a vehicle that is currently on a trip" });
    return;
  }

  if (vehicle.status === "IN_SHOP") {
    const openMaintenance = await prisma.maintenanceLog.findFirst({
      where: { vehicleId: vehicle.id, status: "OPEN" },
    });
    if (openMaintenance) {
      res.status(400).json({ error: "Cannot retire a vehicle with open maintenance work" });
      return;
    }
  }

  if (vehicle.status === "RETIRED") {
    res.status(400).json({ error: "Vehicle is already retired" });
    return;
  }

  const updated = await prisma.vehicle.update({
    where: { id: vehicle.id },
    data: { status: "RETIRED" },
    select: vehicleSelect,
  });

  await logActivity(req.user!, "Vehicle", vehicle.id, "retired", {
    registrationNumber: vehicle.registrationNumber,
  });
  res.json({ vehicle: updated });
});
