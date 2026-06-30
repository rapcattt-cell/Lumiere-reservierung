/* ============================================================================
 * api.js — schlanker Client für die Reservierungs-REST-API
 * ----------------------------------------------------------------------------
 * Spricht das Express/Prisma-Backend an (Standard: gleicher Host, Port 4000).
 * Wirft bei Nicht-2xx einen Fehler mit { status, body }, damit app.js gezielt
 * auf 409 (Slot vergeben) / 400 (Validierung) reagieren kann.
 * ========================================================================== */

// Vom Backend ausgeliefert (Port 4000) → gleiche Origin, relativer Pfad.
// Standalone (z. B. Python-Server auf 8200) → Cross-Origin auf Port 4000.
export const API_BASE = location.port === "4000" ? "/api" : `http://${location.hostname || "127.0.0.1"}:4000/api`;

class ApiError extends Error {
  constructor(status, body) {
    super((body && body.error) || `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function request(path, { method = "GET", body, signal } = {}) {
  const res = await fetch(API_BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  let data = null;
  try { data = await res.json(); } catch { /* leerer Body */ }
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

/** Schneller Erreichbarkeitstest (für Live/Offline-Anzeige). */
export async function ping() {
  try {
    await request("/health");
    return true;
  } catch {
    return false;
  }
}

/** Öffentliche Einstellungen fürs Formular (Limits, Buchungsfenster). */
export const getPublicSettings = () => request("/settings/public");

/** Verfügbare Slots: { date, party, closed, slots:[{time,remaining}] }. */
export const getAvailability = (date, party, signal) =>
  request(`/availability?date=${encodeURIComponent(date)}&party=${party}`, { signal });

/** Reservierung anlegen → angelegte Reservierung (inkl. reservationNumber). */
export const createReservation = (payload) =>
  request("/reservations", { method: "POST", body: payload });

export { ApiError };
