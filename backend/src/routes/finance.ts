import { Router } from "express";
import { prisma } from "../lib/db.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { createFuelLogSchema, createExpenseSchema } from "../validation/finance.js";
import { logActivity } from "../services/activity.js";
import type { ExpenseCategory } from "@prisma/client";

export const fuelRouter = Router();
export const expensesRouter = Router();

fuelRouter.use(requireAuth);
expensesRouter.use(requireAuth);

// ────────────────────────────────────────────────────────
//  FUEL LOGS
// ────────────────────────────────────────────────────────

const fuelSelect = {
  id: true,
  vehicleId: true,
  tripId: true,
  litres: true,
  cost: true,
  odometerKm: true,
  loggedAt: true,
  vehicle: { select: { id: true, registrationNumber: true, type: true } },
  trip: { select: { id: true, tripNumber: true } },
} as const;

// List fuel logs with optional filters
fuelRouter.get("/", requirePermission("fuel", "read"), async (req, res) => {
  const where: Record<string, unknown> = { organisationId: req.user!.orgId };

  if (req.query.vehicleId) where.vehicleId = req.query.vehicleId as string;
  if (req.query.tripId) where.tripId = req.query.tripId as string;

  const logs = await prisma.fuelLog.findMany({
    where,
    select: fuelSelect,
    orderBy: { loggedAt: "desc" },
  });

  res.json({ logs });
});

// Per-vehicle fuel efficiency (km/l)
fuelRouter.get("/efficiency", requirePermission("fuel", "read"), async (req, res) => {
  const vehicles = await prisma.vehicle.findMany({
    where: { organisationId: req.user!.orgId, status: { not: "RETIRED" } },
    select: { id: true, registrationNumber: true, type: true, odometerKm: true },
    orderBy: { registrationNumber: "asc" },
  });

  const result = [];
  for (const v of vehicles) {
    const agg = await prisma.fuelLog.aggregate({
      where: { vehicleId: v.id },
      _sum: { litres: true },
    });
    const totalLitres = Number(agg._sum.litres ?? 0);

    // Get distance: first and last odometer readings from fuel logs
    const first = await prisma.fuelLog.findFirst({
      where: { vehicleId: v.id },
      orderBy: { loggedAt: "asc" },
      select: { odometerKm: true },
    });
    const last = await prisma.fuelLog.findFirst({
      where: { vehicleId: v.id },
      orderBy: { loggedAt: "desc" },
      select: { odometerKm: true },
    });

    const distanceKm = first && last ? last.odometerKm - first.odometerKm : 0;
    const kmPerLitre = totalLitres > 0 && distanceKm > 0 ? +(distanceKm / totalLitres).toFixed(2) : null;

    result.push({
      vehicleId: v.id,
      registrationNumber: v.registrationNumber,
      type: v.type,
      totalLitres: +totalLitres.toFixed(2),
      distanceKm,
      kmPerLitre,
    });
  }

  res.json({ efficiency: result });
});

// Create fuel log
fuelRouter.post("/", requirePermission("fuel", "create"), async (req, res) => {
  const parsed = createFuelLogSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  // Verify vehicle belongs to org
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: parsed.data.vehicleId, organisationId: req.user!.orgId },
  });
  if (!vehicle) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }

  // Verify trip if provided
  if (parsed.data.tripId) {
    const trip = await prisma.trip.findFirst({
      where: { id: parsed.data.tripId, organisationId: req.user!.orgId },
    });
    if (!trip) {
      res.status(404).json({ error: "Trip not found" });
      return;
    }
  }

  const log = await prisma.fuelLog.create({
    data: { ...parsed.data, organisationId: req.user!.orgId },
    select: fuelSelect,
  });

  await logActivity(req.user!, "FuelLog", log.id, "created", {
    vehicleId: vehicle.id,
    litres: parsed.data.litres,
    cost: parsed.data.cost,
  });

  res.status(201).json({ log });
});

// ────────────────────────────────────────────────────────
//  EXPENSES
// ────────────────────────────────────────────────────────

const expenseSelect = {
  id: true,
  vehicleId: true,
  tripId: true,
  category: true,
  amount: true,
  notes: true,
  incurredAt: true,
  vehicle: { select: { id: true, registrationNumber: true, type: true } },
  trip: { select: { id: true, tripNumber: true } },
} as const;

// List expenses with optional filters
expensesRouter.get("/", requirePermission("expenses", "read"), async (req, res) => {
  const where: Record<string, unknown> = { organisationId: req.user!.orgId };

  if (req.query.vehicleId) where.vehicleId = req.query.vehicleId as string;
  if (req.query.tripId) where.tripId = req.query.tripId as string;
  if (req.query.category) where.category = req.query.category as ExpenseCategory;

  const expenses = await prisma.expense.findMany({
    where,
    select: expenseSelect,
    orderBy: { incurredAt: "desc" },
  });

  res.json({ expenses });
});

// Cost roll-ups per vehicle
expensesRouter.get("/vehicle-costs", requirePermission("expenses", "read"), async (req, res) => {
  const vehicles = await prisma.vehicle.findMany({
    where: { organisationId: req.user!.orgId },
    select: { id: true, registrationNumber: true, type: true },
    orderBy: { registrationNumber: "asc" },
  });

  const result = [];
  for (const v of vehicles) {
    const [maintenanceCost, fuelCost, expenseCost] = await Promise.all([
      prisma.maintenanceLog.aggregate({
        where: { vehicleId: v.id, status: "CLOSED" },
        _sum: { cost: true },
      }),
      prisma.fuelLog.aggregate({
        where: { vehicleId: v.id },
        _sum: { cost: true },
      }),
      prisma.expense.aggregate({
        where: { vehicleId: v.id },
        _sum: { amount: true },
      }),
    ]);

    result.push({
      vehicleId: v.id,
      registrationNumber: v.registrationNumber,
      type: v.type,
      maintenanceCost: Number(maintenanceCost._sum.cost ?? 0),
      fuelCost: Number(fuelCost._sum.cost ?? 0),
      expenseCost: Number(expenseCost._sum.amount ?? 0),
      totalCost:
        Number(maintenanceCost._sum.cost ?? 0) +
        Number(fuelCost._sum.cost ?? 0) +
        Number(expenseCost._sum.amount ?? 0),
    });
  }

  res.json({ costs: result });
});

// Cost roll-ups per trip
expensesRouter.get("/trip-costs", requirePermission("expenses", "read"), async (req, res) => {
  const trips = await prisma.trip.findMany({
    where: { organisationId: req.user!.orgId, status: { in: ["DISPATCHED", "COMPLETED"] } },
    select: { id: true, tripNumber: true, revenue: true, source: true, destination: true, status: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const result = [];
  for (const t of trips) {
    const [fuelCost, expenseCost] = await Promise.all([
      prisma.fuelLog.aggregate({
        where: { tripId: t.id },
        _sum: { cost: true },
      }),
      prisma.expense.aggregate({
        where: { tripId: t.id },
        _sum: { amount: true },
      }),
    ]);

    const totalCost = Number(fuelCost._sum.cost ?? 0) + Number(expenseCost._sum.amount ?? 0);
    result.push({
      tripId: t.id,
      tripNumber: t.tripNumber,
      source: t.source,
      destination: t.destination,
      status: t.status,
      revenue: Number(t.revenue),
      fuelCost: Number(fuelCost._sum.cost ?? 0),
      expenseCost: Number(expenseCost._sum.amount ?? 0),
      totalCost,
      profit: Number(t.revenue) - totalCost,
    });
  }

  res.json({ costs: result });
});

// Create expense
expensesRouter.post("/", requirePermission("expenses", "create"), async (req, res) => {
  const parsed = createExpenseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  // Verify vehicle if provided
  if (parsed.data.vehicleId) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: parsed.data.vehicleId, organisationId: req.user!.orgId },
    });
    if (!vehicle) {
      res.status(404).json({ error: "Vehicle not found" });
      return;
    }
  }

  // Verify trip if provided
  if (parsed.data.tripId) {
    const trip = await prisma.trip.findFirst({
      where: { id: parsed.data.tripId, organisationId: req.user!.orgId },
    });
    if (!trip) {
      res.status(404).json({ error: "Trip not found" });
      return;
    }
  }

  const { incurredAt, ...rest } = parsed.data;
  const expense = await prisma.expense.create({
    data: {
      ...rest,
      incurredAt: incurredAt ? new Date(incurredAt) : new Date(),
      organisationId: req.user!.orgId,
    },
    select: expenseSelect,
  });

  await logActivity(req.user!, "Expense", expense.id, "created", {
    category: parsed.data.category,
    amount: parsed.data.amount,
  });

  res.status(201).json({ expense });
});
