import { z } from "zod";

export const createDriverSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  licenceNumber: z.string().min(1, "Licence number is required").max(30),
  licenceCategory: z.string().min(1, "Licence category is required").max(10),
  licenceExpiry: z.string().datetime({ message: "Invalid date" }).or(z.string().min(1)),
  safetyScore: z.number().int().min(0).max(100).default(100),
  userId: z.string().optional(),
});

export const updateDriverSchema = z
  .object({
    name: z.string().min(1).max(100),
    licenceNumber: z.string().min(1).max(30),
    licenceCategory: z.string().min(1).max(10),
    licenceExpiry: z.string().datetime().or(z.string().min(1)),
    userId: z.string().nullable().optional(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update" });

export const updateDriverSafetySchema = z.object({
  safetyScore: z.number().int().min(0).max(100).optional(),
  status: z.enum(["AVAILABLE", "SUSPENDED", "OFF_DUTY"]).optional(),
}).refine((data) => data.safetyScore !== undefined || data.status !== undefined, {
  message: "Must provide safetyScore or status",
});

export const driverFiltersSchema = z.object({
  status: z.enum(["AVAILABLE", "ON_TRIP", "OFF_DUTY", "SUSPENDED"]).optional(),
  verificationStatus: z.enum(["UNVERIFIED", "PENDING", "VERIFIED", "FAILED"]).optional(),
});
