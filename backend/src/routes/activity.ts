import { Router } from "express";
import { prisma } from "../lib/db.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";

export const activityRouter = Router();

activityRouter.use(requireAuth);

// List activity logs — Admin only
activityRouter.get("/", requirePermission("activity", "read"), async (req, res) => {
  const where: Record<string, unknown> = { organisationId: req.user!.orgId };

  if (req.query.entityType) where.entityType = req.query.entityType as string;
  if (req.query.entityId) where.entityId = req.query.entityId as string;

  const logs = await prisma.activityLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      actor: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  res.json({ logs });
});
