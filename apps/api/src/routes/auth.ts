import { Router } from "express";
import { UserRepository } from "@synthetic/database";
import { z } from "zod";
import { env } from "../config.js";
import { verifyPassword } from "../auth/password.js";
import { signSessionToken } from "../auth/token.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/require-auth.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const userRepository = new UserRepository();

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const parseResult = loginSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid login payload" });
    return;
  }

  const { email, password } = parseResult.data;
  const user = await userRepository.findByEmail(email.toLowerCase());

  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const isPasswordValid = await verifyPassword(password, user.passwordHash);

  if (!isPasswordValid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signSessionToken({
    sub: user.id,
    orgId: user.organizationId,
    role: user.role
  });

  res.cookie(env.AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 60 * 60 * 1000
  });

  res.json({
    user: {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      name: user.name,
      role: user.role
    }
  });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(env.AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/"
  });

  res.json({ success: true });
});

authRouter.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  res.json({ user: req.user });
});
