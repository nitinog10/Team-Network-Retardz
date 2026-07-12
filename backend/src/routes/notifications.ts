import { Router } from "express";
import { prisma } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

// Get notifications for the current user
notificationsRouter.get("/", async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      title: true,
      message: true,
      read: true,
      tripId: true,
      createdAt: true,
    },
  });

  const unreadCount = await prisma.notification.count({
    where: { userId: req.user!.id, read: false },
  });

  res.json({ notifications, unreadCount });
});

// Mark notification as read
notificationsRouter.post("/:id/read", async (req, res) => {
  const notification = await prisma.notification.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
  });
  if (!notification) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  await prisma.notification.update({
    where: { id: notification.id },
    data: { read: true },
  });

  res.json({ ok: true });
});

// Mark all as read
notificationsRouter.post("/read-all", async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.id, read: false },
    data: { read: true },
  });
  res.json({ ok: true });
});
