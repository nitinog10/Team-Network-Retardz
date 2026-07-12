import { PrismaClient, Role, VehicleStatus, DriverStatus, VerificationStatus, TripStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Demo@123";

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const org = await prisma.organisation.upsert({
    where: { id: "org-demo" },
    update: {},
    create: { id: "org-demo", name: "TransitOps Demo Logistics" },
  });

  const usersData: { email: string; name: string; role: Role }[] = [
    { email: "admin@transitops.local", name: "Aarav Admin", role: Role.ADMIN },
    { email: "fleet@transitops.local", name: "Fiona Fleet", role: Role.FLEET_MANAGER },
    { email: "safety@transitops.local", name: "Sam Safety", role: Role.SAFETY_MANAGER },
    { email: "finance@transitops.local", name: "Farah Finance", role: Role.FINANCIAL_MANAGER },
    { email: "driver@transitops.local", name: "Devi Driver", role: Role.DRIVER },
  ];

  const users: Record<string, { id: string }> = {};
  for (const u of usersData) {
    users[u.email] = await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash, role: u.role, active: true },
      create: { ...u, passwordHash, organisationId: org.id },
    });
  }

  // Vehicles across statuses
  const vehiclesData = [
    { registrationNumber: "MH12AB1001", type: "Truck", maxLoadKg: 9000, odometerKm: 42000, acquisitionCost: 2500000, region: "West", status: VehicleStatus.AVAILABLE },
    { registrationNumber: "MH12AB1002", type: "Truck", maxLoadKg: 12000, odometerKm: 88000, acquisitionCost: 3200000, region: "West", status: VehicleStatus.ON_TRIP },
    { registrationNumber: "DL01CD2001", type: "Mini Truck", maxLoadKg: 3500, odometerKm: 15500, acquisitionCost: 900000, region: "North", status: VehicleStatus.AVAILABLE },
    { registrationNumber: "DL01CD2002", type: "Mini Truck", maxLoadKg: 3500, odometerKm: 61000, acquisitionCost: 850000, region: "North", status: VehicleStatus.IN_SHOP },
    { registrationNumber: "KA05EF3001", type: "Van", maxLoadKg: 1500, odometerKm: 30500, acquisitionCost: 700000, region: "South", status: VehicleStatus.AVAILABLE },
    { registrationNumber: "KA05EF3002", type: "Van", maxLoadKg: 1500, odometerKm: 120000, acquisitionCost: 650000, region: "South", status: VehicleStatus.RETIRED },
    { registrationNumber: "WB20GH4001", type: "Truck", maxLoadKg: 10000, odometerKm: 54000, acquisitionCost: 2800000, region: "East", status: VehicleStatus.AVAILABLE },
    { registrationNumber: "WB20GH4002", type: "Trailer", maxLoadKg: 20000, odometerKm: 99000, acquisitionCost: 4500000, region: "East", status: VehicleStatus.AVAILABLE },
  ];

  const vehicles = [];
  for (const v of vehiclesData) {
    vehicles.push(
      await prisma.vehicle.upsert({
        where: { organisationId_registrationNumber: { organisationId: org.id, registrationNumber: v.registrationNumber } },
        update: { status: v.status, odometerKm: v.odometerKm },
        create: { ...v, organisationId: org.id },
      }),
    );
  }

  // Drivers: one expired licence, one suspended, most VERIFIED
  const year = new Date().getFullYear();
  const driversData = [
    { name: "Devi Driver", licenceNumber: "DL-1420110012345", licenceCategory: "HMV", licenceExpiry: new Date(year + 2, 5, 30), status: DriverStatus.AVAILABLE, verificationStatus: VerificationStatus.VERIFIED, safetyScore: 92, userEmail: "driver@transitops.local" },
    { name: "Ravi Kumar", licenceNumber: "MH-0920150054321", licenceCategory: "HMV", licenceExpiry: new Date(year + 1, 10, 15), status: DriverStatus.ON_TRIP, verificationStatus: VerificationStatus.VERIFIED, safetyScore: 85 },
    { name: "Sunil Yadav", licenceNumber: "DL-0520120067893", licenceCategory: "LMV", licenceExpiry: new Date(year - 1, 2, 10), status: DriverStatus.AVAILABLE, verificationStatus: VerificationStatus.VERIFIED, safetyScore: 78 },
    { name: "Prakash Singh", licenceNumber: "KA-4120180011111", licenceCategory: "HMV", licenceExpiry: new Date(year + 3, 0, 20), status: DriverStatus.SUSPENDED, verificationStatus: VerificationStatus.VERIFIED, safetyScore: 40 },
    { name: "Meena Joshi", licenceNumber: "WB-2020190022222", licenceCategory: "LMV", licenceExpiry: new Date(year + 2, 8, 5), status: DriverStatus.AVAILABLE, verificationStatus: VerificationStatus.UNVERIFIED, safetyScore: 95 },
    { name: "Imran Sheikh", licenceNumber: "MH-1220160033334", licenceCategory: "HMV", licenceExpiry: new Date(year + 1, 3, 12), status: DriverStatus.OFF_DUTY, verificationStatus: VerificationStatus.VERIFIED, safetyScore: 88 },
  ];

  const drivers = [];
  for (const d of driversData) {
    const { userEmail, ...data } = d;
    const existing = await prisma.driver.findFirst({
      where: { organisationId: org.id, licenceNumber: d.licenceNumber },
    });
    const userId = userEmail ? users[userEmail]?.id : undefined;
    drivers.push(
      existing
        ? await prisma.driver.update({ where: { id: existing.id }, data: { ...data, userId } })
        : await prisma.driver.create({ data: { ...data, userId, organisationId: org.id } }),
    );
  }

  // Trips in every status (skip if already seeded)
  const tripCount = await prisma.trip.count({ where: { organisationId: org.id } });
  if (tripCount === 0) {
    const now = new Date();
    const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

    const trips = [
      { tripNumber: "TRIP-0001", source: "Mumbai", destination: "Pune", vehicle: vehicles[0]!, driver: drivers[0]!, cargoWeightKg: 5000, plannedDistanceKm: 150, revenue: 45000, status: TripStatus.COMPLETED, dispatchedAt: daysAgo(80), completedAt: daysAgo(79), actualDistanceKm: 155 },
      { tripNumber: "TRIP-0002", source: "Delhi", destination: "Jaipur", vehicle: vehicles[2]!, driver: drivers[2]!, cargoWeightKg: 2000, plannedDistanceKm: 280, revenue: 38000, status: TripStatus.COMPLETED, dispatchedAt: daysAgo(55), completedAt: daysAgo(53), actualDistanceKm: 290 },
      { tripNumber: "TRIP-0003", source: "Bengaluru", destination: "Chennai", vehicle: vehicles[4]!, driver: drivers[4]!, cargoWeightKg: 1200, plannedDistanceKm: 350, revenue: 30000, status: TripStatus.COMPLETED, dispatchedAt: daysAgo(30), completedAt: daysAgo(28), actualDistanceKm: 360 },
      { tripNumber: "TRIP-0004", source: "Mumbai", destination: "Ahmedabad", vehicle: vehicles[1]!, driver: drivers[1]!, cargoWeightKg: 8000, plannedDistanceKm: 530, revenue: 90000, status: TripStatus.DISPATCHED, dispatchedAt: daysAgo(1) },
      { tripNumber: "TRIP-0005", source: "Kolkata", destination: "Patna", vehicle: vehicles[6]!, driver: drivers[5]!, cargoWeightKg: 6000, plannedDistanceKm: 580, revenue: 70000, status: TripStatus.DRAFT },
      { tripNumber: "TRIP-0006", source: "Pune", destination: "Nagpur", vehicle: vehicles[7]!, driver: drivers[3]!, cargoWeightKg: 15000, plannedDistanceKm: 700, revenue: 120000, status: TripStatus.CANCELLED, cancelledAt: daysAgo(10) },
    ];

    for (const t of trips) {
      const { vehicle, driver, ...data } = t;
      await prisma.trip.create({
        data: { ...data, organisationId: org.id, vehicleId: vehicle.id, driverId: driver.id },
      });
    }

    // Maintenance, fuel, expense history (~3 months)
    await prisma.maintenanceLog.createMany({
      data: [
        { organisationId: org.id, vehicleId: vehicles[3]!.id, description: "Gearbox overhaul", status: "OPEN", cost: 0, openedAt: daysAgo(3) },
        { organisationId: org.id, vehicleId: vehicles[0]!.id, description: "Brake pad replacement", status: "CLOSED", cost: 12000, openedAt: daysAgo(70), closedAt: daysAgo(68) },
        { organisationId: org.id, vehicleId: vehicles[6]!.id, description: "Routine service", status: "CLOSED", cost: 8000, openedAt: daysAgo(40), closedAt: daysAgo(39) },
      ],
    });

    await prisma.fuelLog.createMany({
      data: [
        { organisationId: org.id, vehicleId: vehicles[0]!.id, litres: 60, cost: 6300, odometerKm: 41850, loggedAt: daysAgo(79) },
        { organisationId: org.id, vehicleId: vehicles[2]!.id, litres: 40, cost: 4200, odometerKm: 15300, loggedAt: daysAgo(53) },
        { organisationId: org.id, vehicleId: vehicles[4]!.id, litres: 35, cost: 3700, odometerKm: 30400, loggedAt: daysAgo(28) },
        { organisationId: org.id, vehicleId: vehicles[1]!.id, litres: 90, cost: 9500, odometerKm: 87500, loggedAt: daysAgo(1) },
      ],
    });

    await prisma.expense.createMany({
      data: [
        { organisationId: org.id, vehicleId: vehicles[0]!.id, category: "TOLL", amount: 1200, incurredAt: daysAgo(79), notes: "Mumbai-Pune expressway" },
        { organisationId: org.id, vehicleId: vehicles[2]!.id, category: "PERMIT", amount: 2500, incurredAt: daysAgo(54) },
        { organisationId: org.id, vehicleId: vehicles[4]!.id, category: "TOLL", amount: 900, incurredAt: daysAgo(28) },
        { organisationId: org.id, category: "OTHER", amount: 5000, incurredAt: daysAgo(15), notes: "Office supplies" },
      ],
    });
  }

  console.log("Seed complete.");
  console.log(`Demo login: admin@transitops.local / ${DEMO_PASSWORD} (same password for all roles)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
