import { Router } from "express";
import { prisma } from "../lib/db.js";
import { hashPassword } from "../lib/auth/password.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { createUserSchema, updateUserSchema } from "../validation/auth.js";
import { logActivity } from "../services/activity.js";

export const usersRouter = Router();

usersRouter.use(requireAuth);

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
  createdAt: true,
} as const;

usersRouter.get("/", requirePermission("users", "read"), async (req, res) => {
  const users = await prisma.user.findMany({
    where: { organisationId: req.user!.orgId },
    select: userSelect,
    orderBy: { createdAt: "asc" },
  });
  res.json({ users });
});

usersRouter.post("/", requirePermission("users", "create"), async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { email, name, password, role } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "A user with this email already exists" });
    return;
  }

  const user = await prisma.user.create({
    data: {
      organisationId: req.user!.orgId,
      email,
      name,
      role,
      passwordHash: await hashPassword(password),
    },
    select: userSelect,
  });

  await logActivity(req.user!, "User", user.id, "created", { email, role });
  res.status(201).json({ user });
});

usersRouter.patch("/:id", requirePermission("users", "update"), async (req, res) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const id = String(req.params.id);
  const target = await prisma.user.findFirst({
    where: { id, organisationId: req.user!.orgId },
  });
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (target.id === req.user!.id && parsed.data.active === false) {
    res.status(400).json({ error: "You cannot disable your own account" });
    return;
  }

  const user = await prisma.user.update({
    where: { id: target.id },
    data: parsed.data,
    select: userSelect,
  });

  await logActivity(req.user!, "User", user.id, "updated", parsed.data);
  res.json({ user });
});
