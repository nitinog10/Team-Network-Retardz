import { Router } from "express";
import { prisma } from "../lib/db.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { createMaintenanceSchema, closeMaintenanceSchema } from "../validation/maintenance.js";
import { logActivity } from "../services/activity.js";
import type { MaintenanceStatus } from "@prisma/client";

export const maintenanceRouter = Router();

maintenanceRouter.use(requireAuth);

const maintenanceSelect = {
  id: true,
  vehicleId: true,
  description: true,
  status: true,
  cost: true,
  openedAt: true,
  closedAt: true,
  vehicle: { select: { id: true, registrationNumber: true, type: true, status: true } },
} as const;

// List maintenance logs with optional filters
maintenanceRouter.get("/", requirePermission("maintenance", "read"), async (req, res) => {
  const where: Record<string, unknown> = { organisationId: req.user!.orgId };

  if (req.query.status) where.status = req.query.status as MaintenanceStatus;
  if (req.query.vehicleId) where.vehicleId = req.query.vehicleId as string;

  const logs = await prisma.maintenanceLog.findMany({
    where,
    select: maintenanceSelect,
    orderBy: { openedAt: "desc" },
  });
  res.json({ logs });
});

// Get single maintenance log
maintenanceRouter.get("/:id", requirePermission("maintenance", "read"), async (req, res) => {
  const log = await prisma.maintenanceLog.findFirst({
    where: { id: req.params.id, organisationId: req.user!.orgId },
    select: maintenanceSelect,
  });
  if (!log) {
    res.status(404).json({ error: "Maintenance log not found" });
    return;
  }
  res.json({ log });
});

// Open maintenance log — sets vehicle to IN_SHOP in a transaction
maintenanceRouter.post("/", requirePermission("maintenance", "create"), async (req, res) => {
  const parsed = createMaintenanceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: parsed.data.vehicleId, organisationId: req.user!.orgId },
  });
  if (!vehicle) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }

  if (vehicle.status === "ON_TRIP") {
    res.status(400).json({ error: "Cannot open maintenance for a vehicle currently on a trip" });
    return;
  }

  if (vehicle.status === "RETIRED") {
    res.status(400).json({ error: "Cannot open maintenance for a retired vehicle" });
    return;
  }

  // Transaction: create log + set vehicle IN_SHOP
  const log = await prisma.$transaction(async (tx) => {
    const created = await tx.maintenanceLog.create({
      data: {
        organisationId: req.user!.orgId,
        vehicleId: parsed.data.vehicleId,
        description: parsed.data.description,
        status: "OPEN",
      },
      select: maintenanceSelect,
    });

    await tx.vehicle.update({
      where: { id: parsed.data.vehicleId },
      data: { status: "IN_SHOP" },
    });

    return created;
  });

  await logActivity(req.user!, "MaintenanceLog", log.id, "opened", {
    vehicleId: vehicle.id,
    registrationNumber: vehicle.registrationNumber,
    description: parsed.data.description,
  });

  res.status(201).json({ log });
});

// Close maintenance log — sets vehicle back to AVAILABLE (unless RETIRED)
maintenanceRouter.post("/:id/close", requirePermission("maintenance", "update"), async (req, res) => {
  const parsed = closeMaintenanceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const log = await prisma.maintenanceLog.findFirst({
    where: { id: req.params.id, organisationId: req.user!.orgId },
    include: { vehicle: true },
  });
  if (!log) {
    res.status(404).json({ error: "Maintenance log not found" });
    return;
  }

  if (log.status === "CLOSED") {
    res.status(400).json({ error: "This maintenance log is already closed" });
    return;
  }

  const now = new Date();

  // Check if there are other open logs for this vehicle
  const otherOpen = await prisma.maintenanceLog.count({
    where: {
      vehicleId: log.vehicleId,
      status: "OPEN",
      id: { not: log.id },
    },
  });

  const updated = await prisma.$transaction(async (tx) => {
    const closed = await tx.maintenanceLog.update({
      where: { id: log.id },
      data: { status: "CLOSED", cost: parsed.data.cost, closedAt: now },
      select: maintenanceSelect,
    });

    // Only set vehicle AVAILABLE if no other open logs and vehicle isn't RETIRED
    if (otherOpen === 0 && log.vehicle.status !== "RETIRED") {
      await tx.vehicle.update({
        where: { id: log.vehicleId },
        data: { status: "AVAILABLE" },
      });
    }

    return closed;
  });

  await logActivity(req.user!, "MaintenanceLog", log.id, "closed", {
    cost: parsed.data.cost,
    vehicleId: log.vehicleId,
  });

  res.json({ log: updated });
});
