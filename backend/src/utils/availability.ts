/* ============================================================================
 * availability.ts — Serverseitige Verfügbarkeits-Engine (maßgeblich)
 * ----------------------------------------------------------------------------
 * Identische Logik wie im Frontend-Prototyp, hier aber autoritativ: das
 * Frontend darf vorschlagen, der Server entscheidet. Wird sowohl von
 * GET /availability als auch beim POST /reservations (Re-Check) verwendet.
 * ========================================================================== */

export interface OpeningWindow { open: number; close: number; } // Minuten ab Mitternacht
export type OpeningHours = Record<string, OpeningWindow[]>;       // "0".."6" (0=So)

export interface AvailabilitySettings {
  openingHours: OpeningHours;
  slotIntervalMin: number;
  seatingDurationMin: number;
  lastSeatingBeforeCloseMin: number;
  maxConcurrentCapacity: number;
  bookingWindowDays: number;
  minPartySize: number;
  maxPartySize: number;
}

export interface ExistingReservation { time: string; guestCount: number; }

const pad = (n: number) => String(n).padStart(2, "0");
export const minToHHMM = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const hhmmToMin = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};

/** Wochentag im JS-Stil (0=So..6=Sa) aus "YYYY-MM-DD" (lokal, ohne TZ-Drift). */
export function weekdayOf(dateISO: string): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function isClosed(dateISO: string, s: AvailabilitySettings): boolean {
  return (s.openingHours[String(weekdayOf(dateISO))] ?? []).length === 0;
}

/** Alle Roh-Slots eines Tages (vor Kapazitätsprüfung), in Minuten. */
export function daySlots(dateISO: string, s: AvailabilitySettings): number[] {
  const windows = s.openingHours[String(weekdayOf(dateISO))] ?? [];
  const out: number[] = [];
  for (const w of windows) {
    const last = w.close - s.lastSeatingBeforeCloseMin;
    for (let m = w.open; m <= last; m += s.slotIntervalMin) out.push(m);
  }
  return out;
}

/** Belegte Plätze, deren Sitzfenster mit [slot, slot+dauer) überlappt. */
export function occupiedAt(
  slotMin: number,
  existing: ExistingReservation[],
  s: AvailabilitySettings,
): number {
  const dur = s.seatingDurationMin;
  const a0 = slotMin, a1 = slotMin + dur;
  return existing.reduce((sum, r) => {
    const b0 = hhmmToMin(r.time), b1 = b0 + dur;
    return a0 < b1 && b0 < a1 ? sum + r.guestCount : sum;
  }, 0);
}

export interface Slot { time: string; remaining: number; }

/**
 * Verfügbare Slots für Datum & Personenzahl.
 * `existing` sind die bestätigten/aktiven Reservierungen dieses Tages.
 * `now` erlaubt deterministisches Testen (Default: aktuelle Zeit).
 */
export function availableSlots(
  dateISO: string,
  party: number,
  existing: ExistingReservation[],
  s: AvailabilitySettings,
  now: Date = new Date(),
): Slot[] {
  const isToday = dateISO === `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const cap = s.maxConcurrentCapacity;

  return daySlots(dateISO, s)
    .filter((m) => !isToday || m > nowMin + 15) // 15 Min Vorlauf heute
    .map((m) => ({ time: minToHHMM(m), remaining: cap - occupiedAt(m, existing, s) }))
    .filter((slot) => slot.remaining >= party);
}

/** Ist ein konkreter Wunsch-Slot buchbar? (autoritative Prüfung beim Anlegen) */
export function isSlotBookable(
  dateISO: string,
  time: string,
  party: number,
  existing: ExistingReservation[],
  s: AvailabilitySettings,
  now: Date = new Date(),
): boolean {
  return availableSlots(dateISO, party, existing, s, now).some((slot) => slot.time === time);
}
