import { Router } from "express";
import { prisma } from "../lib/db.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import {
  createDriverSchema,
  updateDriverSchema,
  updateDriverSafetySchema,
} from "../validation/drivers.js";
import { logActivity } from "../services/activity.js";
import type { DriverStatus, VerificationStatus } from "@prisma/client";

export const driversRouter = Router();

driversRouter.use(requireAuth);

const driverSelect = {
  id: true,
  name: true,
  licenceNumber: true,
  licenceCategory: true,
  licenceExpiry: true,
  safetyScore: true,
  status: true,
  verificationStatus: true,
  verifiedAt: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
} as const;

// List drivers with optional filters
driversRouter.get("/", requirePermission("drivers", "read"), async (req, res) => {
  const where: Record<string, unknown> = { organisationId: req.user!.orgId };

  if (req.query.status) where.status = req.query.status as DriverStatus;
  if (req.query.verificationStatus)
    where.verificationStatus = req.query.verificationStatus as VerificationStatus;

  const drivers = await prisma.driver.findMany({
    where,
    select: {
      ...driverSelect,
      user: { select: { id: true, email: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ drivers });
});

// Available drivers for trip dispatch picker
driversRouter.get("/available", requirePermission("drivers", "read"), async (req, res) => {
  const now = new Date();
  const drivers = await prisma.driver.findMany({
    where: {
      organisationId: req.user!.orgId,
      status: "AVAILABLE",
      verificationStatus: "VERIFIED",
      licenceExpiry: { gt: now },
    },
    select: { id: true, name: true, licenceNumber: true, licenceCategory: true, licenceExpiry: true },
    orderBy: { name: "asc" },
  });
  res.json({ drivers });
});

// Driver detail
driversRouter.get("/:id", requirePermission("drivers", "read"), async (req, res) => {
  const driver = await prisma.driver.findFirst({
    where: { id: req.params.id, organisationId: req.user!.orgId },
    include: {
      user: { select: { id: true, email: true, name: true } },
      trips: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          tripNumber: true,
          source: true,
          destination: true,
          status: true,
          dispatchedAt: true,
          completedAt: true,
        },
      },
    },
  });
  if (!driver) {
    res.status(404).json({ error: "Driver not found" });
    return;
  }
  res.json({ driver });
});

// Create driver
driversRouter.post("/", requirePermission("drivers", "create"), async (req, res) => {
  const parsed = createDriverSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { userId, licenceExpiry, ...rest } = parsed.data;

  // If linking to a user, check that user exists, belongs to org, has DRIVER role, and is not already linked
  if (userId) {
    const user = await prisma.user.findFirst({
      where: { id: userId, organisationId: req.user!.orgId, role: "DRIVER" },
    });
    if (!user) {
      res.status(400).json({ error: "User not found or is not a Driver-role user in this organisation" });
      return;
    }
    const existing = await prisma.driver.findFirst({ where: { userId } });
    if (existing) {
      res.status(409).json({ error: "This user account is already linked to another driver" });
      return;
    }
  }

  const driver = await prisma.driver.create({
    data: {
      ...rest,
      licenceExpiry: new Date(licenceExpiry),
      userId: userId || undefined,
      organisationId: req.user!.orgId,
    },
    select: driverSelect,
  });

  await logActivity(req.user!, "Driver", driver.id, "created", { name: driver.name });
  res.status(201).json({ driver });
});

// Update driver
driversRouter.patch("/:id", requirePermission("drivers", "update"), async (req, res) => {
  const parsed = updateDriverSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const driver = await prisma.driver.findFirst({
    where: { id: req.params.id, organisationId: req.user!.orgId },
  });
  if (!driver) {
    res.status(404).json({ error: "Driver not found" });
    return;
  }

  const { licenceExpiry, userId, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };

  if (licenceExpiry !== undefined) {
    updateData.licenceExpiry = new Date(licenceExpiry);
  }
  if (userId !== undefined) {
    if (userId === null) {
      updateData.userId = null;
    } else {
      const user = await prisma.user.findFirst({
        where: { id: userId, organisationId: req.user!.orgId, role: "DRIVER" },
      });
      if (!user) {
        res.status(400).json({ error: "User not found or is not a Driver-role user" });
        return;
      }
      const existing = await prisma.driver.findFirst({ where: { userId, id: { not: driver.id } } });
      if (existing) {
        res.status(409).json({ error: "This user account is already linked to another driver" });
        return;
      }
      updateData.userId = userId;
    }
  }

  const updated = await prisma.driver.update({
    where: { id: driver.id },
    data: updateData,
    select: driverSelect,
  });

  await logActivity(req.user!, "Driver", driver.id, "updated", parsed.data);
  res.json({ driver: updated });
});

// Safety Manager actions: update safety score and status
driversRouter.patch("/:id/safety", requirePermission("driverSafety", "update"), async (req, res) => {
  const parsed = updateDriverSafetySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const driver = await prisma.driver.findFirst({
    where: { id: req.params.id, organisationId: req.user!.orgId },
  });
  if (!driver) {
    res.status(404).json({ error: "Driver not found" });
    return;
  }

  // Cannot change status of a driver currently ON_TRIP
  if (parsed.data.status && driver.status === "ON_TRIP") {
    res.status(400).json({ error: "Cannot change status of a driver who is currently on a trip" });
    return;
  }

  const updated = await prisma.driver.update({
    where: { id: driver.id },
    data: parsed.data,
    select: driverSelect,
  });

  await logActivity(req.user!, "Driver", driver.id, "safety_updated", parsed.data);
  res.json({ driver: updated });
});
