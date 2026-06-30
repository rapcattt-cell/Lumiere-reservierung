import { ErrorRequestHandler, RequestHandler } from "express";
import { HttpError } from "../utils/httpError";

/** 404 für unbekannte Routen. */
export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Route nicht gefunden" });
};

/** Zentraler Error-Handler — wandelt Fehler in einheitliche JSON-Antworten. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }
  // Prisma: eindeutige Verletzung (z. B. doppelte E-Mail/Reservierungsnummer)
  if (err && typeof err === "object" && (err as any).code === "P2002") {
    return res.status(409).json({ error: "Eintrag existiert bereits" });
  }
  console.error("Unerwarteter Fehler:", err);
  res.status(500).json({ error: "Interner Serverfehler" });
};
