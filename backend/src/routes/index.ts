import { Router, RequestHandler } from "express";
import { validate } from "../middleware/validate";
import { requireAuth, requireRole } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { bus } from "../events";

import * as auth from "../controllers/auth.controller";
import * as reservations from "../controllers/reservation.controller";
import * as tables from "../controllers/table.controller";
import * as settings from "../controllers/settings.controller";
import { availabilityController } from "../controllers/availability.controller";
import { overviewController } from "../controllers/stats.controller";

import { loginSchema, refreshSchema } from "../dtos/auth.dto";
import {
  createReservationSchema,
  updateReservationSchema,
  listReservationsQuerySchema,
  availabilityQuerySchema,
} from "../dtos/reservation.dto";
import { createTableSchema, updateTableSchema } from "../dtos/table.dto";
import { updateSettingsSchema } from "../dtos/settings.dto";

export const router = Router();

router.get("/health", (_req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

/* ----------------- Echtzeit (Server-Sent Events) -------------- */
// Streamt „etwas hat sich geändert"-Signale an verbundene Dashboards.
// Bewusst ohne Auth & ohne sensible Daten (nur Entität/Aktion/Datum).
const sseHandler: RequestHandler = (req, res) => {
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.flushHeaders?.();
  res.write(`event: ping\ndata: "connected"\n\n`);
  const onChange = (e: unknown) => res.write(`data: ${JSON.stringify(e)}\n\n`);
  bus.on("change", onChange);
  const heartbeat = setInterval(() => res.write(`event: ping\ndata: {}\n\n`), 25000);
  req.on("close", () => { clearInterval(heartbeat); bus.off("change", onChange); });
};
router.get("/events", sseHandler);

// Rate-Limits für öffentliche Endpunkte.
const bookingLimiter = rateLimit({ windowMs: 60_000, max: 10 });  // 10 Buchungen/Min/IP
const loginLimiter = rateLimit({ windowMs: 60_000, max: 20 });    // 20 Login-Versuche/Min/IP

/* ---------------------------- Auth ---------------------------- */
router.post("/auth/login", loginLimiter, validate(loginSchema), auth.loginController);
router.post("/auth/refresh", validate(refreshSchema), auth.refreshController);
router.post("/auth/logout", requireAuth, auth.logoutController);
router.get("/auth/me", requireAuth, auth.meController);

/* --------------------- Öffentlich (Gast) ---------------------- */
router.get("/settings/public", settings.publicController);
router.get("/availability", validate(availabilityQuerySchema, "query"), availabilityController);
router.post("/reservations", bookingLimiter, validate(createReservationSchema), reservations.createController);
router.get("/reservations/by-number/:number", reservations.byNumberController);

/* --------------------- Admin/Staff (Auth) --------------------- */
// Reservierungen verwalten
router.get(
  "/reservations",
  requireAuth, requireRole("STAFF"),
  validate(listReservationsQuerySchema, "query"),
  reservations.listController,
);
router.get("/reservations/:id", requireAuth, requireRole("STAFF"), reservations.getController);
router.patch(
  "/reservations/:id",
  requireAuth, requireRole("STAFF"),
  validate(updateReservationSchema),
  reservations.updateController,
);
router.delete("/reservations/:id", requireAuth, requireRole("STAFF"), reservations.cancelController);

// Tische
router.get("/tables", requireAuth, requireRole("STAFF"), tables.listController);
router.get("/tables/:id", requireAuth, requireRole("STAFF"), tables.getController);
router.post("/tables", requireAuth, requireRole("ADMIN"), validate(createTableSchema), tables.createController);
router.patch("/tables/:id", requireAuth, requireRole("ADMIN"), validate(updateTableSchema), tables.updateController);
router.delete("/tables/:id", requireAuth, requireRole("ADMIN"), tables.deleteController);

// Einstellungen
router.get("/settings", requireAuth, requireRole("ADMIN"), settings.getController);
router.put("/settings", requireAuth, requireRole("ADMIN"), validate(updateSettingsSchema), settings.updateController);

// Statistiken
router.get("/stats/overview", requireAuth, requireRole("STAFF"), overviewController);
