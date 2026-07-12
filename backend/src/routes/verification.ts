import { Router } from "express";
import { prisma } from "../lib/db.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { createVerifier } from "../services/verification/adapter.js";
import { logActivity } from "../services/activity.js";

export const verificationRouter = Router();

verificationRouter.use(requireAuth);

const verifier = createVerifier();

// Trigger licence verification for a driver — Safety Manager only
verificationRouter.post(
  "/:driverId/verify",
  requirePermission("driverSafety", "update"),
  async (req, res) => {
    const driver = await prisma.driver.findFirst({
      where: { id: req.params.driverId, organisationId: req.user!.orgId },
    });

    if (!driver) {
      res.status(404).json({ error: "Driver not found" });
      return;
    }

    // Set to PENDING while verification runs
    await prisma.driver.update({
      where: { id: driver.id },
      data: { verificationStatus: "PENDING" },
    });

    try {
      const result = await verifier.verify(driver.licenceNumber, driver.name);

      const updated = await prisma.driver.update({
        where: { id: driver.id },
        data: {
          verificationStatus: result.status,
          verifiedAt: result.verifiedAt,
        },
        select: {
          id: true,
          name: true,
          licenceNumber: true,
          verificationStatus: true,
          verifiedAt: true,
          status: true,
          safetyScore: true,
        },
      });

      await logActivity(req.user!, "Driver", driver.id, "verification_" + result.status.toLowerCase(), {
        licenceNumber: driver.licenceNumber,
        details: result.details,
        mock: true,
      });

      res.json({
        driver: updated,
        verification: {
          status: result.status,
          details: result.details,
          mock: true,
        },
      });
    } catch (err) {
      // Revert to previous status on error
      await prisma.driver.update({
        where: { id: driver.id },
        data: { verificationStatus: driver.verificationStatus },
      });
      throw err;
    }
  },
);
