import { z } from "zod";

export const createTripSchema = z.object({
  source: z.string().min(1, "Source is required").max(100),
  destination: z.string().min(1, "Destination is required").max(100),
  vehicleId: z.string().min(1, "Vehicle is required"),
  driverId: z.string().min(1, "Driver is required"),
  cargoWeightKg: z.number().int().positive("Cargo weight must be positive"),
  plannedDistanceKm: z.number().int().positive("Planned distance must be positive"),
  revenue: z.number().min(0).default(0),
});

export const completeTripSchema = z.object({
  finalOdometerKm: z.number().int().positive("Final odometer is required"),
});

export const tripFiltersSchema = z.object({
  status: z.enum(["DRAFT", "DISPATCHED", "COMPLETED", "CANCELLED"]).optional(),
});
