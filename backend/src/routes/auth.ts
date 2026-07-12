import { Router } from "express";
import { prisma } from "../lib/db.js";
import { verifyPassword } from "../lib/auth/password.js";
import { createSessionToken, setSessionCookie, clearSessionCookie } from "../lib/auth/session.js";
import { requireAuth } from "../middleware/auth.js";
import { loginSchema } from "../validation/auth.js";

export const authRouter = Router();

function publicUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  organisationId: string;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    orgId: user.organisationId,
  };
}

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email or password" });
    return;
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  // Same error for unknown email, wrong password, and disabled account.
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = await createSessionToken({
    userId: user.id,
    orgId: user.organisationId,
    role: user.role,
  });
  setSessionCookie(res, token);
  res.json({ user: publicUser(user) });
});

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, (req, res) => {
  const u = req.user!;
  res.json({ user: { id: u.id, email: u.email, name: u.name, role: u.role, orgId: u.orgId } });
});
