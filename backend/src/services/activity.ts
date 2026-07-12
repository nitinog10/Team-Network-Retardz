import { prisma } from "../lib/db.js";
import type { AuthedUser } from "../middleware/auth.js";

export async function logActivity(
  actor: AuthedUser,
  entityType: string,
  entityId: string,
  action: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await prisma.activityLog.create({
    data: {
      organisationId: actor.orgId,
      actorId: actor.id,
      entityType,
      entityId,
      action,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
    },
  });
}
