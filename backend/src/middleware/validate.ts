import { RequestHandler } from "express";
import { ZodSchema } from "zod";
import { badRequest } from "../utils/httpError";

type Source = "body" | "query" | "params";

/** Validiert & ersetzt req[source] durch die geparsten, typsicheren Daten. */
export function validate(schema: ZodSchema, source: Source = "body"): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      return next(badRequest("Validierung fehlgeschlagen", details));
    }
    // Geparste Werte zurückschreiben (inkl. Defaults/Coercion).
    (req as any)[source] = result.data;
    next();
  };
}
