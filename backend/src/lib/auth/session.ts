import { SignJWT, jwtVerify } from "jose";
import type { Response } from "express";
import type { Role } from "@prisma/client";
import { env } from "../../config/env.js";

const SESSION_COOKIE = "transitops_session";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

const secret = new TextEncoder().encode(env.SESSION_SECRET);

export interface SessionPayload {
  userId: string;
  orgId: string;
  role: Role;
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (
      typeof payload.userId !== "string" ||
      typeof payload.orgId !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      orgId: payload.orgId,
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export { SESSION_COOKIE };
