import { z } from "zod";

export const createMaintenanceSchema = z.object({
  vehicleId: z.string().min(1, "Vehicle is required"),
  description: z.string().min(1, "Description is required").max(500),
});

export const closeMaintenanceSchema = z.object({
  cost: z.number().min(0, "Cost must be non-negative"),
});

export const maintenanceFiltersSchema = z.object({
  status: z.enum(["OPEN", "CLOSED"]).optional(),
  vehicleId: z.string().optional(),
});
