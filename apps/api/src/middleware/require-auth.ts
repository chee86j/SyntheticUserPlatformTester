import type { Request, Response, NextFunction } from "express";
import { UserRepository } from "@synthetic/database";
import { env } from "../config.js";
import { verifySessionToken } from "../auth/token.js";

const userRepository = new UserRepository();

export type RequestUser = {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: "OWNER" | "ADMIN" | "TESTER" | "VIEWER";
};

export type AuthenticatedRequest = Request & {
  user?: RequestUser;
};

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.cookies?.[env.AUTH_COOKIE_NAME];

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const claims = verifySessionToken(token);
    const user = await userRepository.findSafeById(claims.sub);

    if (!user || user.organizationId !== claims.orgId || user.role !== claims.role) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    req.user = {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      name: user.name,
      role: user.role
    };

    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}
