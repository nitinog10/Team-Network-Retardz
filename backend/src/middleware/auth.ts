import type { Request, Response, NextFunction } from "express";
import type { Role } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { verifySessionToken, SESSION_COOKIE } from "../lib/auth/session.js";
import { can, type Resource, type Action } from "../lib/auth/rbac.js";

export interface AuthedUser {
  id: string;
  orgId: string;
  role: Role;
  email: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

/**
 * Verifies the session JWT and re-checks the user's `active` flag in the DB
 * on every request, so disabling a user kills existing sessions immediately.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const session = await verifySessionToken(token);
  if (!session) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.active) {
    res.status(401).json({ error: "Account is disabled" });
    return;
  }

  req.user = {
    id: user.id,
    orgId: user.organisationId,
    role: user.role,
    email: user.email,
    name: user.name,
  };
  next();
}

export function requirePermission(resource: Resource, action: Action) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!can(req.user.role, resource, action)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
