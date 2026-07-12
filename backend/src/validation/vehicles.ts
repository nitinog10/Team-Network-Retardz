import { z } from "zod";

export const createVehicleSchema = z.object({
  registrationNumber: z.string().min(1, "Registration number is required").max(20),
  type: z.string().min(1, "Vehicle type is required").max(50),
  maxLoadKg: z.number().int().positive("Max load must be positive"),
  odometerKm: z.number().int().min(0).default(0),
  acquisitionCost: z.number().min(0).default(0),
  region: z.string().min(1, "Region is required").max(50),
});

export const updateVehicleSchema = z
  .object({
    registrationNumber: z.string().min(1).max(20),
    type: z.string().min(1).max(50),
    maxLoadKg: z.number().int().positive(),
    odometerKm: z.number().int().min(0),
    acquisitionCost: z.number().min(0),
    region: z.string().min(1).max(50),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update" });

export const vehicleFiltersSchema = z.object({
  status: z.enum(["AVAILABLE", "ON_TRIP", "IN_SHOP", "RETIRED"]).optional(),
  type: z.string().optional(),
  region: z.string().optional(),
});
