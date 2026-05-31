import jwt from "jsonwebtoken";
import { env } from "../config.js";

export type SessionClaims = {
  sub: string;
  orgId: string;
  role: "OWNER" | "ADMIN" | "TESTER" | "VIEWER";
};

const SESSION_TTL = "8h";

export function signSessionToken(claims: SessionClaims): string {
  return jwt.sign(claims, env.AUTH_JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: SESSION_TTL
  });
}

export function verifySessionToken(token: string): SessionClaims {
  return jwt.verify(token, env.AUTH_JWT_SECRET) as SessionClaims;
}
