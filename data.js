/* ============================================================================
 * data.js — Mock-Daten & Restaurant-Einstellungen (Prototyp)
 * ----------------------------------------------------------------------------
 * Dies ersetzt im Prototyp die spätere Datenbank/REST-API. Die Struktur ist
 * bewusst nah an einem echten Datenmodell (Restaurant Settings, Tables,
 * Reservations) gehalten, damit der spätere Backend-Tausch 1:1 möglich ist.
 *
 *   Frontend-Prototyp  ──►  später:  GET /api/availability?date=&party=
 *                                    POST /api/reservations
 * ========================================================================== */

/* --- Restaurant-Stammdaten (Demo-Restaurant) ------------------------------ */
export const RESTAURANT = {
  name: "Lumière",
  tagline: { de: "Feine Küche · Tischreservierung", en: "Fine dining · Table reservations" },
  address: "Maximilianstraße 1, 80539 München",
  phone: "+49 89 000 000",
};

/* --- Restaurant Settings (entspricht Tabelle „Restaurant Settings") -------
 * openingHours: pro Wochentag (0=So … 6=Sa) eine Liste von Service-Fenstern.
 * Eine leere Liste = Ruhetag. Zeiten in Minuten ab Mitternacht.
 */
const H = (h, m = 0) => h * 60 + m; // Helfer: Stunde/Minute -> Minuten

export const SETTINGS = {
  // 0=Sonntag, 1=Montag, … 6=Samstag
  openingHours: {
    0: [{ open: H(12), close: H(22) }],                                  // So: durchgehend
    1: [],                                                               // Mo: Ruhetag
    2: [{ open: H(11, 30), close: H(14, 30) }, { open: H(17, 30), close: H(23) }],
    3: [{ open: H(11, 30), close: H(14, 30) }, { open: H(17, 30), close: H(23) }],
    4: [{ open: H(11, 30), close: H(14, 30) }, { open: H(17, 30), close: H(23) }],
    5: [{ open: H(11, 30), close: H(14, 30) }, { open: H(17, 30), close: H(23, 30) }],
    6: [{ open: H(17, 30), close: H(23, 30) }],                          // Sa: nur abends
  },
  slotIntervalMin: 30,        // Reservierungs-Raster (alle 30 Min)
  seatingDurationMin: 120,    // wie lange ein Tisch je Reservierung belegt ist
  lastSeatingBeforeCloseMin: 30, // letzte Reservierung X Min vor Schließung
  maxConcurrentCapacity: 40,  // gleichzeitig verfügbare Plätze (gesamtes Haus)
  bookingWindowDays: 60,      // wie weit im Voraus buchbar
  minPartySize: 1,
  maxPartySize: 12,
};

/* --- Tables (entspricht Tabelle „Tables") ---------------------------------
 * Im Prototyp nur informativ / für spätere Tischzuweisung. Die
 * Verfügbarkeit rechnet vorerst gegen die Gesamtkapazität.
 */
export const TABLES = [
  { id: "T1", name: "Tisch 1", capacity: 2, shape: "round" },
  { id: "T2", name: "Tisch 2", capacity: 2, shape: "round" },
  { id: "T3", name: "Tisch 3", capacity: 4, shape: "square" },
  { id: "T4", name: "Tisch 4", capacity: 4, shape: "square" },
  { id: "T5", name: "Tisch 5", capacity: 6, shape: "rect" },
  { id: "T6", name: "Tisch 6", capacity: 6, shape: "rect" },
  { id: "T7", name: "Terrasse 1", capacity: 4, shape: "square" },
  { id: "T8", name: "Terrasse 2", capacity: 8, shape: "rect" },
];

/* --- Bestehende Reservierungen (Demo) -------------------------------------
 * Simuliert Auslastung, damit die Verfügbarkeitslogik sichtbar greift.
 * date: YYYY-MM-DD relativ zu HEUTE wird beim Laden gesetzt (siehe unten).
 * time: "HH:MM", guests: Personenzahl.
 */
function isoOffset(days) {
  // Lokales Datum (NICHT toISOString/UTC — sonst Off-by-one je nach Zeitzone;
  // app.js rechnet mit lokalem Datum, also muss der Seed das auch tun).
  const d = new Date();
  d.setDate(d.getDate() + days);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* Heute + nächste Tage gut füllen, damit man „fast ausgebucht" sieht. */
export const SEED_RESERVATIONS = [
  // Heute Abend mit Verlauf: Kernzeit ausgebucht, Randzeiten knapp, Lunch frei.
  // (Sitzdauer 120 Min greift über mehrere Slots → realistische Auslastungskurve.)
  { date: isoOffset(0), time: "19:00", guests: 10 },
  { date: isoOffset(0), time: "19:30", guests: 12 },
  { date: isoOffset(0), time: "20:00", guests: 12 },
  { date: isoOffset(0), time: "20:30", guests: 8 },
  { date: isoOffset(0), time: "18:30", guests: 4 },
  // morgen moderat
  { date: isoOffset(1), time: "19:30", guests: 6 },
  { date: isoOffset(1), time: "20:00", guests: 4 },
  { date: isoOffset(1), time: "12:30", guests: 8 },
  // übermorgen leicht
  { date: isoOffset(2), time: "19:00", guests: 4 },
];
