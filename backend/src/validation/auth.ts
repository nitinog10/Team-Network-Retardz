import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["ADMIN", "FLEET_MANAGER", "SAFETY_MANAGER", "FINANCIAL_MANAGER", "DRIVER"]),
});

export const updateUserSchema = z
  .object({
    role: z.enum(["ADMIN", "FLEET_MANAGER", "SAFETY_MANAGER", "FINANCIAL_MANAGER", "DRIVER"]),
    active: z.boolean(),
    name: z.string().min(1).max(100),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update" });
