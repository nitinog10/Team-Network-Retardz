import { z } from "zod";

export const createFuelLogSchema = z.object({
  vehicleId: z.string().min(1, "Vehicle is required"),
  tripId: z.string().optional(),
  litres: z.number().positive("Litres must be positive"),
  cost: z.number().min(0, "Cost must be non-negative"),
  odometerKm: z.number().int().min(0, "Odometer must be non-negative"),
});

export const fuelLogFiltersSchema = z.object({
  vehicleId: z.string().optional(),
  tripId: z.string().optional(),
});

export const createExpenseSchema = z.object({
  vehicleId: z.string().optional(),
  tripId: z.string().optional(),
  category: z.enum(["FUEL", "TOLL", "REPAIR", "PERMIT", "OTHER"]),
  amount: z.number().positive("Amount must be positive"),
  notes: z.string().max(500).optional(),
  incurredAt: z.string().optional(),
});

export const expenseFiltersSchema = z.object({
  vehicleId: z.string().optional(),
  tripId: z.string().optional(),
  category: z.enum(["FUEL", "TOLL", "REPAIR", "PERMIT", "OTHER"]).optional(),
});
