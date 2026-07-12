import { prisma } from "../lib/db.js";
import { logActivity } from "./activity.js";
import type { AuthedUser } from "../middleware/auth.js";
import { Prisma } from "@prisma/client";

/**
 * Generates a trip number like TRIP-0007 by counting existing trips in the org.
 */
async function generateTripNumber(orgId: string): Promise<string> {
  const count = await prisma.trip.count({ where: { organisationId: orgId } });
  return `TRIP-${String(count + 1).padStart(4, "0")}`;
}

export interface CreateTripInput {
  source: string;
  destination: string;
  vehicleId: string;
  driverId: string;
  cargoWeightKg: number;
  plannedDistanceKm: number;
  revenue: number;
}

/**
 * Creates a DRAFT trip. Vehicle/driver eligibility is advisory at this stage
 * — real validation happens at dispatch.
 */
export async function createDraftTrip(actor: AuthedUser, input: CreateTripInput) {
  // Verify vehicle and driver belong to this org
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: input.vehicleId, organisationId: actor.orgId },
  });
  if (!vehicle) throw new TripError("Vehicle not found in this organisation");

  const driver = await prisma.driver.findFirst({
    where: { id: input.driverId, organisationId: actor.orgId },
  });
  if (!driver) throw new TripError("Driver not found in this organisation");

  const tripNumber = await generateTripNumber(actor.orgId);

  const trip = await prisma.trip.create({
    data: {
      organisationId: actor.orgId,
      tripNumber,
      source: input.source,
      destination: input.destination,
      vehicleId: input.vehicleId,
      driverId: input.driverId,
      cargoWeightKg: input.cargoWeightKg,
      plannedDistanceKm: input.plannedDistanceKm,
      revenue: input.revenue,
      status: "DRAFT",
    },
    include: {
      vehicle: { select: { id: true, registrationNumber: true, type: true } },
      driver: { select: { id: true, name: true, licenceNumber: true } },
    },
  });

  await logActivity(actor, "Trip", trip.id, "created", {
    tripNumber,
    source: input.source,
    destination: input.destination,
  });

  return trip;
}

/**
 * Dispatches a DRAFT trip. Uses SELECT … FOR UPDATE to prevent double-dispatch races.
 * Full server-side revalidation of all dispatch rules.
 */
export async function dispatchTrip(actor: AuthedUser, tripId: string) {
  return prisma.$transaction(async (tx) => {
    // Lock the trip first
    const [trip] = await tx.$queryRaw<Array<{
      id: string;
      status: string;
      vehicleId: string;
      driverId: string;
      cargoWeightKg: number;
      organisationId: string;
    }>>(
      Prisma.sql`SELECT id, status, vehicleId, driverId, cargoWeightKg, organisationId
                 FROM Trip WHERE id = ${tripId} FOR UPDATE`
    );

    if (!trip) throw new TripError("Trip not found");
    if (trip.organisationId !== actor.orgId) throw new TripError("Trip not found");
    if (trip.status !== "DRAFT") throw new TripError("Only DRAFT trips can be dispatched");

    // Lock and validate vehicle
    const [vehicle] = await tx.$queryRaw<Array<{
      id: string;
      status: string;
      maxLoadKg: number;
      organisationId: string;
    }>>(
      Prisma.sql`SELECT id, status, maxLoadKg, organisationId
                 FROM Vehicle WHERE id = ${trip.vehicleId} FOR UPDATE`
    );

    if (!vehicle) throw new TripError("Vehicle not found");
    if (vehicle.organisationId !== actor.orgId) throw new TripError("Vehicle does not belong to this organisation");
    if (vehicle.status !== "AVAILABLE") throw new TripError("Vehicle is not available (current status: " + vehicle.status + ")");
    if (trip.cargoWeightKg > vehicle.maxLoadKg) {
      throw new TripError(`Cargo weight (${trip.cargoWeightKg} kg) exceeds vehicle capacity (${vehicle.maxLoadKg} kg)`);
    }

    // Lock and validate driver
    const [driver] = await tx.$queryRaw<Array<{
      id: string;
      status: string;
      verificationStatus: string;
      licenceExpiry: Date;
      organisationId: string;
    }>>(
      Prisma.sql`SELECT id, status, verificationStatus, licenceExpiry, organisationId
                 FROM Driver WHERE id = ${trip.driverId} FOR UPDATE`
    );

    if (!driver) throw new TripError("Driver not found");
    if (driver.organisationId !== actor.orgId) throw new TripError("Driver does not belong to this organisation");
    if (driver.status !== "AVAILABLE") throw new TripError("Driver is not available (current status: " + driver.status + ")");
    if (driver.verificationStatus !== "VERIFIED") throw new TripError("Driver is not verified (status: " + driver.verificationStatus + ")");
    if (new Date(driver.licenceExpiry) <= new Date()) throw new TripError("Driver's licence has expired");

    // All checks pass — update everything
    const now = new Date();

    await tx.trip.update({
      where: { id: tripId },
      data: { status: "DISPATCHED", dispatchedAt: now },
    });

    await tx.vehicle.update({
      where: { id: vehicle.id },
      data: { status: "ON_TRIP" },
    });

    await tx.driver.update({
      where: { id: driver.id },
      data: { status: "ON_TRIP" },
    });

    await tx.activityLog.create({
      data: {
        organisationId: actor.orgId,
        actorId: actor.id,
        entityType: "Trip",
        entityId: tripId,
        action: "dispatched",
        metadata: { vehicleId: vehicle.id, driverId: driver.id },
      },
    });

    // Notify the driver's linked user account about the trip assignment
    const driverRecord = await tx.driver.findUnique({
      where: { id: driver.id },
      select: { userId: true, name: true },
    });

    if (driverRecord?.userId) {
      const tripData = await tx.trip.findUnique({
        where: { id: tripId },
        select: { tripNumber: true, source: true, destination: true },
      });
      await tx.notification.create({
        data: {
          userId: driverRecord.userId,
          title: "New Trip Assigned",
          message: `You have been assigned to trip ${tripData?.tripNumber ?? ""}: ${tripData?.source ?? ""} → ${tripData?.destination ?? ""}`,
          tripId,
        },
      });
    }

    return tx.trip.findUnique({
      where: { id: tripId },
      include: {
        vehicle: { select: { id: true, registrationNumber: true, type: true, status: true } },
        driver: { select: { id: true, name: true, status: true } },
      },
    });
  });
}

/**
 * Completes a DISPATCHED trip. Updates odometer math and frees vehicle + driver.
 */
export async function completeTrip(
  actor: AuthedUser,
  tripId: string,
  finalOdometerKm: number,
) {
  return prisma.$transaction(async (tx) => {
    const trip = await tx.trip.findFirst({
      where: { id: tripId, organisationId: actor.orgId },
      include: {
        vehicle: true,
        driver: { include: { user: true } },
      },
    });

    if (!trip) throw new TripError("Trip not found");
    if (trip.status !== "DISPATCHED") throw new TripError("Only DISPATCHED trips can be completed");

    // Driver can only complete their own trip
    if (actor.role === "DRIVER") {
      if (!trip.driver.userId || trip.driver.userId !== actor.id) {
        throw new TripError("You can only complete your own trips");
      }
    }

    if (finalOdometerKm < trip.vehicle.odometerKm) {
      throw new TripError(
        `Final odometer (${finalOdometerKm}) must be ≥ current vehicle odometer (${trip.vehicle.odometerKm})`,
      );
    }

    const actualDistanceKm = finalOdometerKm - trip.vehicle.odometerKm;
    const now = new Date();

    await tx.trip.update({
      where: { id: tripId },
      data: {
        status: "COMPLETED",
        completedAt: now,
        finalOdometerKm,
        actualDistanceKm,
      },
    });

    await tx.vehicle.update({
      where: { id: trip.vehicleId },
      data: { status: "AVAILABLE", odometerKm: finalOdometerKm },
    });

    await tx.driver.update({
      where: { id: trip.driverId },
      data: { status: "AVAILABLE" },
    });

    await tx.activityLog.create({
      data: {
        organisationId: actor.orgId,
        actorId: actor.id,
        entityType: "Trip",
        entityId: tripId,
        action: "completed",
        metadata: { finalOdometerKm, actualDistanceKm },
      },
    });

    return tx.trip.findUnique({
      where: { id: tripId },
      include: {
        vehicle: { select: { id: true, registrationNumber: true, type: true, status: true, odometerKm: true } },
        driver: { select: { id: true, name: true, status: true } },
      },
    });
  });
}

/**
 * Cancels a DRAFT or DISPATCHED trip. Frees resources if already dispatched.
 */
export async function cancelTrip(actor: AuthedUser, tripId: string) {
  return prisma.$transaction(async (tx) => {
    const trip = await tx.trip.findFirst({
      where: { id: tripId, organisationId: actor.orgId },
    });

    if (!trip) throw new TripError("Trip not found");
    if (trip.status !== "DRAFT" && trip.status !== "DISPATCHED") {
      throw new TripError("Only DRAFT or DISPATCHED trips can be cancelled");
    }

    const now = new Date();

    await tx.trip.update({
      where: { id: tripId },
      data: { status: "CANCELLED", cancelledAt: now },
    });

    // Free resources if trip was dispatched
    if (trip.status === "DISPATCHED") {
      await tx.vehicle.update({
        where: { id: trip.vehicleId },
        data: { status: "AVAILABLE" },
      });
      await tx.driver.update({
        where: { id: trip.driverId },
        data: { status: "AVAILABLE" },
      });
    }

    await tx.activityLog.create({
      data: {
        organisationId: actor.orgId,
        actorId: actor.id,
        entityType: "Trip",
        entityId: tripId,
        action: "cancelled",
        metadata: { previousStatus: trip.status },
      },
    });

    return tx.trip.findUnique({
      where: { id: tripId },
      include: {
        vehicle: { select: { id: true, registrationNumber: true, type: true, status: true } },
        driver: { select: { id: true, name: true, status: true } },
      },
    });
  });
}

/**
 * Custom error class for trip business rule violations.
 */
export class TripError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TripError";
  }
}
