import { Router } from "express";
import { prisma } from "../lib/db.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

// Dashboard KPI stats — role-aware
dashboardRouter.get("/stats", async (req, res) => {
  const orgId = req.user!.orgId;
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    vehicleStatusCounts,
    activeTrips,
    totalVehicles,
    licenceAlerts,
    openMaintenance,
    monthRevenue,
    monthFuelCost,
    monthExpenseCost,
    monthMaintenanceCost,
    recentTrips,
  ] = await Promise.all([
    // Fleet status breakdown
    prisma.vehicle.groupBy({
      by: ["status"],
      where: { organisationId: orgId },
      _count: true,
    }),
    // Active trips count
    prisma.trip.count({
      where: { organisationId: orgId, status: "DISPATCHED" },
    }),
    // Total vehicles (non-retired)
    prisma.vehicle.count({
      where: { organisationId: orgId, status: { not: "RETIRED" } },
    }),
    // Licence expiry alerts (≤30 days)
    prisma.driver.count({
      where: {
        organisationId: orgId,
        licenceExpiry: { lte: thirtyDaysFromNow },
        status: { not: "SUSPENDED" },
      },
    }),
    // Open maintenance
    prisma.maintenanceLog.count({
      where: { organisationId: orgId, status: "OPEN" },
    }),
    // Month revenue (completed trips)
    prisma.trip.aggregate({
      where: {
        organisationId: orgId,
        status: "COMPLETED",
        completedAt: { gte: startOfMonth },
      },
      _sum: { revenue: true },
    }),
    // Month fuel cost
    prisma.fuelLog.aggregate({
      where: { organisationId: orgId, loggedAt: { gte: startOfMonth } },
      _sum: { cost: true },
    }),
    // Month expense cost
    prisma.expense.aggregate({
      where: { organisationId: orgId, incurredAt: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    // Month maintenance cost
    prisma.maintenanceLog.aggregate({
      where: {
        organisationId: orgId,
        status: "CLOSED",
        closedAt: { gte: startOfMonth },
      },
      _sum: { cost: true },
    }),
    // Recent trips
    prisma.trip.findMany({
      where: { organisationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        tripNumber: true,
        source: true,
        destination: true,
        status: true,
        revenue: true,
        createdAt: true,
        vehicle: { select: { registrationNumber: true } },
        driver: { select: { name: true } },
      },
    }),
  ]);

  const fleetStatus: Record<string, number> = {};
  for (const v of vehicleStatusCounts) {
    fleetStatus[v.status] = v._count;
  }

  const monthCost =
    Number(monthFuelCost._sum.cost ?? 0) +
    Number(monthExpenseCost._sum.amount ?? 0) +
    Number(monthMaintenanceCost._sum.cost ?? 0);

  const utilisation = totalVehicles > 0
    ? +((((fleetStatus["ON_TRIP"] ?? 0) / totalVehicles) * 100).toFixed(1))
    : 0;

  res.json({
    fleetStatus,
    activeTrips,
    totalVehicles,
    utilisation,
    licenceAlerts,
    openMaintenance,
    monthRevenue: Number(monthRevenue._sum.revenue ?? 0),
    monthCost,
    recentTrips,
  });
});

// Monthly cost vs revenue data for charts (last 6 months)
dashboardRouter.get("/monthly", async (req, res) => {
  const orgId = req.user!.orgId;
  const now = new Date();
  const months = [];

  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const label = start.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

    const [revenue, fuelCost, expenseCost, maintenanceCost] = await Promise.all([
      prisma.trip.aggregate({
        where: { organisationId: orgId, status: "COMPLETED", completedAt: { gte: start, lt: end } },
        _sum: { revenue: true },
      }),
      prisma.fuelLog.aggregate({
        where: { organisationId: orgId, loggedAt: { gte: start, lt: end } },
        _sum: { cost: true },
      }),
      prisma.expense.aggregate({
        where: { organisationId: orgId, incurredAt: { gte: start, lt: end } },
        _sum: { amount: true },
      }),
      prisma.maintenanceLog.aggregate({
        where: { organisationId: orgId, status: "CLOSED", closedAt: { gte: start, lt: end } },
        _sum: { cost: true },
      }),
    ]);

    months.push({
      month: label,
      revenue: Number(revenue._sum.revenue ?? 0),
      cost:
        Number(fuelCost._sum.cost ?? 0) +
        Number(expenseCost._sum.amount ?? 0) +
        Number(maintenanceCost._sum.cost ?? 0),
    });
  }

  res.json({ months });
});

// CSV export — trips report
dashboardRouter.get("/export/trips", requirePermission("reports", "read"), async (req, res) => {
  const orgId = req.user!.orgId;
  const trips = await prisma.trip.findMany({
    where: { organisationId: orgId },
    include: {
      vehicle: { select: { registrationNumber: true, type: true } },
      driver: { select: { name: true, licenceNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const header = "Trip#,Source,Destination,Vehicle,Driver,Cargo(kg),PlannedDist(km),ActualDist(km),Revenue,Status,Dispatched,Completed\n";
  const rows = trips.map((t) =>
    [
      t.tripNumber,
      t.source,
      t.destination,
      t.vehicle.registrationNumber,
      t.driver.name,
      t.cargoWeightKg,
      t.plannedDistanceKm,
      t.actualDistanceKm ?? "",
      t.revenue,
      t.status,
      t.dispatchedAt?.toISOString() ?? "",
      t.completedAt?.toISOString() ?? "",
    ].join(","),
  );

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=trips-report.csv");
  res.send(header + rows.join("\n"));
});

// CSV export — vehicle costs
dashboardRouter.get("/export/vehicle-costs", requirePermission("reports", "read"), async (req, res) => {
  const orgId = req.user!.orgId;
  const vehicles = await prisma.vehicle.findMany({
    where: { organisationId: orgId },
    select: { id: true, registrationNumber: true, type: true, acquisitionCost: true },
    orderBy: { registrationNumber: "asc" },
  });

  const header = "Vehicle,Type,AcquisitionCost,MaintenanceCost,FuelCost,ExpenseCost,TotalOpCost\n";
  const rows = [];

  for (const v of vehicles) {
    const [mc, fc, ec] = await Promise.all([
      prisma.maintenanceLog.aggregate({ where: { vehicleId: v.id, status: "CLOSED" }, _sum: { cost: true } }),
      prisma.fuelLog.aggregate({ where: { vehicleId: v.id }, _sum: { cost: true } }),
      prisma.expense.aggregate({ where: { vehicleId: v.id }, _sum: { amount: true } }),
    ]);
    const total = Number(mc._sum.cost ?? 0) + Number(fc._sum.cost ?? 0) + Number(ec._sum.amount ?? 0);
    rows.push([v.registrationNumber, v.type, v.acquisitionCost, Number(mc._sum.cost ?? 0), Number(fc._sum.cost ?? 0), Number(ec._sum.amount ?? 0), total].join(","));
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=vehicle-costs-report.csv");
  res.send(header + rows.join("\n"));
});

// CSV export — fuel efficiency
dashboardRouter.get("/export/fuel-efficiency", requirePermission("reports", "read"), async (req, res) => {
  const orgId = req.user!.orgId;
  const vehicles = await prisma.vehicle.findMany({
    where: { organisationId: orgId, status: { not: "RETIRED" } },
    select: { id: true, registrationNumber: true, type: true },
  });

  const header = "Vehicle,Type,TotalLitres,DistanceKm,KmPerLitre\n";
  const rows = [];

  for (const v of vehicles) {
    const agg = await prisma.fuelLog.aggregate({ where: { vehicleId: v.id }, _sum: { litres: true } });
    const first = await prisma.fuelLog.findFirst({ where: { vehicleId: v.id }, orderBy: { loggedAt: "asc" }, select: { odometerKm: true } });
    const last = await prisma.fuelLog.findFirst({ where: { vehicleId: v.id }, orderBy: { loggedAt: "desc" }, select: { odometerKm: true } });
    const totalLitres = Number(agg._sum.litres ?? 0);
    const dist = first && last ? last.odometerKm - first.odometerKm : 0;
    const kml = totalLitres > 0 && dist > 0 ? (dist / totalLitres).toFixed(2) : "";
    rows.push([v.registrationNumber, v.type, totalLitres.toFixed(2), dist, kml].join(","));
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=fuel-efficiency-report.csv");
  res.send(header + rows.join("\n"));
});
