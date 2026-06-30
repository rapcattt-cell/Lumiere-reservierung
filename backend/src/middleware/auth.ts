import { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { forbidden, unauthorized } from "../utils/httpError";

export interface AuthUser {
  sub: string;   // User-ID
  email: string;
  role: string;  // "ADMIN" | "STAFF"
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Rollen-Rangordnung: höher = mehr Rechte. ADMIN schließt STAFF ein.
const RANK: Record<string, number> = { STAFF: 1, ADMIN: 2 };

/** Verlangt einen gültigen Access-Token; hängt req.user an. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(unauthorized());
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwt.accessSecret) as AuthUser;
    req.user = { sub: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch {
    next(unauthorized("Token ungültig oder abgelaufen"));
  }
};

/**
 * Verlangt mindestens die angegebene Rolle (nach requireAuth einsetzen).
 * `requireRole("STAFF")` → STAFF und ADMIN dürfen; `requireRole("ADMIN")` → nur ADMIN.
 */
export function requireRole(minRole: "STAFF" | "ADMIN"): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    const have = RANK[req.user.role] ?? 0;
    if (have < RANK[minRole]) return next(forbidden());
    next();
  };
}
