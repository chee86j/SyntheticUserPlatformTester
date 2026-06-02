import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest, RequestUser } from "./require-auth.js";

type PlatformRole = RequestUser["role"];

export function requireRole(...allowedRoles: PlatformRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    next();
  };
}
