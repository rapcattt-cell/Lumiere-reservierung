import { RequestHandler } from "express";
import { HttpError } from "../utils/httpError";

/**
 * Einfaches In-Memory-Rate-Limit pro IP (ohne externe Abhängigkeit).
 * Schützt öffentliche Endpunkte (Buchung, Login) vor Missbrauch/Brute-Force.
 */
export function rateLimit({ windowMs, max }: { windowMs: number; max: number }): RequestHandler {
  const hits = new Map<string, { count: number; reset: number }>();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || "unknown";

    // Gelegentlich abgelaufene Einträge aufräumen.
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    }

    let entry = hits.get(key);
    if (!entry || entry.reset < now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count++;

    if (entry.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((entry.reset - now) / 1000)));
      return next(new HttpError(429, "Zu viele Anfragen — bitte kurz warten und erneut versuchen."));
    }
    next();
  };
}
