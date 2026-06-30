/* ============================================================================
 * app.js — Reservierungs-Logik (Prototyp, kein Build-Step, ES-Module)
 * ----------------------------------------------------------------------------
 * Verantwortlich für:
 *   • Reservierungsfluss (Details → Gast → Bestätigung)
 *   • Anbindung an die REST-API (Verfügbarkeit & Anlegen)
 *   • Offline-Fallback: lokale Engine + Mock-Daten (data.js), wenn API weg ist
 *   • DE/EN-Umschaltung & Dark/Light-Theme
 * ========================================================================== */

import { RESTAURANT, SETTINGS, SEED_RESERVATIONS } from "./data.js?v=7";
import * as api from "./api.js?v=7";

/* ---------------------------------------------------------------------------
 * 1) Internationalisierung (DE/EN)
 * ------------------------------------------------------------------------- */
const I18N = {
  de: {
    "brand.tag": RESTAURANT.tagline.de,
    "hero.eyebrow": "Tischreservierung",
    "hero.title": "Reservieren Sie Ihren Tisch",
    "hero.sub": "Wählen Sie Datum, Uhrzeit und Personenzahl — wir bestätigen sofort.",
    "step.1": "Details",
    "step.2": "Ihre Daten",
    "step.3": "Bestätigt",
    "f.date": "Datum",
    "f.party": "Personen",
    "f.party.unit": "Personen",
    "f.party.one": "Person",
    "f.check": "Verfügbarkeit prüfen",
    "slots.title": "Verfügbare Uhrzeiten",
    "slots.none": "An diesem Tag sind keine Zeiten verfügbar. Bitte anderes Datum wählen.",
    "slots.closed": "Ruhetag — an diesem Tag ist geschlossen.",
    "slots.hint": "Tippen Sie auf eine Uhrzeit, um fortzufahren.",
    "g.title": "Ihre Kontaktdaten",
    "g.first": "Vorname",
    "g.last": "Nachname",
    "g.email": "E-Mail",
    "g.phone": "Telefon",
    "g.notes": "Notiz / Sonderwünsche",
    "g.notes.ph": "Allergien, Kinderstuhl, Anlass …",
    "g.gdpr": "Ich stimme der Verarbeitung meiner Daten gemäß Datenschutzerklärung zu.",
    "g.back": "Zurück",
    "g.submit": "Reservierung bestätigen",
    "g.summary": "Ihre Auswahl",
    "ok.title": "Reservierung bestätigt",
    "ok.sub": "Wir freuen uns auf Ihren Besuch. Eine Bestätigung wurde (simuliert) versendet.",
    "ok.number": "Reservierungsnummer",
    "ok.new": "Weitere Reservierung",
    "err.required": "Bitte ausfüllen.",
    "err.email": "Bitte gültige E-Mail eingeben.",
    "err.gdpr": "Zustimmung erforderlich.",
    "foot.proto": "Prototyp — Gast-Reservierung gegen die echte API; bei fehlendem Backend lokale Demo-Daten.",
    "slots.loading": "Lade Verfügbarkeit …",
    "err.slotGone": "Dieser Zeitpunkt wurde gerade vergeben. Bitte wählen Sie eine andere Uhrzeit.",
    "err.submit": "Reservierung fehlgeschlagen. Bitte erneut versuchen.",
    "conn.live": "Live",
    "conn.offline": "Offline-Demo",
    "for": "für",
    "guests": "Gäste",
    "guest": "Gast",
  },
  en: {
    "brand.tag": RESTAURANT.tagline.en,
    "hero.eyebrow": "Table reservation",
    "hero.title": "Reserve your table",
    "hero.sub": "Pick a date, time and party size — we confirm instantly.",
    "step.1": "Details",
    "step.2": "Your details",
    "step.3": "Confirmed",
    "f.date": "Date",
    "f.party": "Guests",
    "f.party.unit": "guests",
    "f.party.one": "guest",
    "f.check": "Check availability",
    "slots.title": "Available times",
    "slots.none": "No times available on this day. Please pick another date.",
    "slots.closed": "Closed — no service on this day.",
    "slots.hint": "Tap a time to continue.",
    "g.title": "Your contact details",
    "g.first": "First name",
    "g.last": "Last name",
    "g.email": "Email",
    "g.phone": "Phone",
    "g.notes": "Note / special requests",
    "g.notes.ph": "Allergies, high chair, occasion …",
    "g.gdpr": "I consent to the processing of my data per the privacy policy.",
    "g.back": "Back",
    "g.submit": "Confirm reservation",
    "g.summary": "Your selection",
    "ok.title": "Reservation confirmed",
    "ok.sub": "We look forward to your visit. A confirmation has been (simulated) sent.",
    "ok.number": "Reservation number",
    "ok.new": "New reservation",
    "err.required": "Required.",
    "err.email": "Please enter a valid email.",
    "err.gdpr": "Consent required.",
    "foot.proto": "Prototype — guest booking against the real API; falls back to local demo data if the backend is down.",
    "slots.loading": "Loading availability …",
    "err.slotGone": "This time was just taken. Please choose another time.",
    "err.submit": "Reservation failed. Please try again.",
    "conn.live": "Live",
    "conn.offline": "Offline demo",
    "for": "for",
    "guests": "guests",
    "guest": "guest",
  },
};

let lang = localStorage.getItem("res-lang") || "de";
const t = (key) => (I18N[lang] && I18N[lang][key]) || I18N.de[key] || key;

/* ---------------------------------------------------------------------------
 * 2) Datums-/Zeit-Helfer
 * ------------------------------------------------------------------------- */
const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const minToHHMM = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const hhmmToMin = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
function parseISO(iso) { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); }

/* ---------------------------------------------------------------------------
 * 3) Reservierungs-Speicher (Seed + localStorage)
 * ------------------------------------------------------------------------- */
const STORE_KEY = "res-bookings";
function loadBookings() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
  catch { return []; }
}
function saveBooking(b) {
  const all = loadBookings();
  all.push(b);
  localStorage.setItem(STORE_KEY, JSON.stringify(all));
}
/** Alle relevanten Reservierungen für ein Datum (Seed + eigene). */
function reservationsOn(dateISO) {
  return [...SEED_RESERVATIONS, ...loadBookings()].filter((r) => r.date === dateISO);
}

/* ---------------------------------------------------------------------------
 * 4) Verfügbarkeits-Engine
 * ------------------------------------------------------------------------- */
/** Belegte Plätze, die mit dem Fenster [start, start+duration) überlappen. */
function occupiedAt(dateISO, slotMin) {
  const dur = SETTINGS.seatingDurationMin;
  const a0 = slotMin, a1 = slotMin + dur;
  return reservationsOn(dateISO).reduce((sum, r) => {
    const b0 = hhmmToMin(r.time), b1 = b0 + dur;
    const overlap = a0 < b1 && b0 < a1;
    return overlap ? sum + r.guests : sum;
  }, 0);
}

/** Alle Roh-Slots eines Tages (vor Kapazitätsprüfung). */
function daySlots(dateISO) {
  const day = parseISO(dateISO).getDay();
  const windows = SETTINGS.openingHours[day] || [];
  const out = [];
  for (const w of windows) {
    const last = w.close - SETTINGS.lastSeatingBeforeCloseMin;
    for (let m = w.open; m <= last; m += SETTINGS.slotIntervalMin) out.push(m);
  }
  return out;
}

/**
 * Verfügbare Slots für ein Datum & Personenzahl.
 * Liefert [{ time, remaining }] — nur Zeiten mit genug Restkapazität.
 * Vergangene Slots am heutigen Tag werden ausgeblendet.
 */
export function availableSlots(dateISO, party) {
  const now = new Date();
  const isToday = dateISO === toISO(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const cap = SETTINGS.maxConcurrentCapacity;

  return daySlots(dateISO)
    .filter((m) => !isToday || m > nowMin + 15) // min. 15 Min Vorlauf heute
    .map((m) => ({ time: minToHHMM(m), remaining: cap - occupiedAt(dateISO, m) }))
    .filter((s) => s.remaining >= party);
}

/** Ist der Tag grundsätzlich ein Ruhetag? */
export function isClosed(dateISO) {
  const day = parseISO(dateISO).getDay();
  return (SETTINGS.openingHours[day] || []).length === 0;
}

/* ---------------------------------------------------------------------------
 * 5) UI-State
 * ------------------------------------------------------------------------- */
const state = {
  step: 1,
  date: null,
  party: 2,
  time: null,
  online: false,      // API erreichbar? (sonst lokale Demo-Engine)
  apiSettings: null,  // öffentliche Einstellungen vom Server (Limits, Fenster)
  slotReq: 0,         // Token gegen veraltete Verfügbarkeits-Antworten
  guest: { first: "", last: "", email: "", phone: "", notes: "", gdpr: false },
};

const partyMin = () => state.apiSettings?.minPartySize ?? SETTINGS.minPartySize;
const partyMax = () => state.apiSettings?.maxPartySize ?? SETTINGS.maxPartySize;
const bookingWindow = () => state.apiSettings?.bookingWindowDays ?? SETTINGS.bookingWindowDays;

/**
 * Verfügbarkeit holen — online über die API, sonst lokal (data.js-Engine).
 * Einheitliche Form: { closed, slots:[{time,remaining}] }.
 */
async function fetchAvailability(dateISO, party, signal) {
  if (state.online) {
    const data = await api.getAvailability(dateISO, party, signal);
    return { closed: !!data.closed, slots: data.slots || [] };
  }
  return { closed: isClosed(dateISO), slots: availableSlots(dateISO, party) };
}

function updateConnBadge() {
  const badge = $("#connBadge");
  if (!badge) return;
  badge.classList.toggle("on", state.online);
  badge.classList.toggle("off", !state.online);
  badge.querySelector(".lbl").textContent = t(state.online ? "conn.live" : "conn.offline");
}
function setOnline(on) { state.online = on; updateConnBadge(); }

let noticeTimer;
function flashNotice(msg) {
  const n = $("#notice");
  if (!n) return;
  n.textContent = msg;
  n.classList.add("show");
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => n.classList.remove("show"), 4500);
}

/* ---------------------------------------------------------------------------
 * 6) DOM-Referenzen
 * ------------------------------------------------------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const els = {};

/* ---------------------------------------------------------------------------
 * 7) Rendering
 * ------------------------------------------------------------------------- */
function applyStaticI18n() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPh);
  });
  $("#langBtn").textContent = lang === "de" ? "EN" : "DE";
}

function renderSteps() {
  document.querySelectorAll(".step").forEach((s) => {
    const n = Number(s.dataset.step);
    s.classList.toggle("active", n === state.step);
    s.classList.toggle("done", n < state.step);
  });
  els.panels.forEach((p) => {
    p.hidden = Number(p.dataset.panel) !== state.step;
  });
}

function partyLabel(n) {
  return `${n} ${n === 1 ? t("f.party.one") : t("f.party.unit")}`;
}

function renderPartyValue() {
  els.partyValue.textContent = partyLabel(state.party);
}

function fmtDateLong(iso) {
  if (!iso) return "—";
  const d = parseISO(iso);
  return d.toLocaleDateString(lang === "de" ? "de-DE" : "en-GB", {
    weekday: "long", day: "numeric", month: "long",
  });
}

async function renderSlots() {
  if (state.step !== 1) return; // Slots nur im Detail-Schritt rendern/abrufen
  const wrap = els.slots;
  if (!state.date) { els.slotsSection.hidden = true; return; }
  els.slotsSection.hidden = false;

  const reqId = ++state.slotReq;
  els.slotsHint.hidden = true;
  wrap.innerHTML = `<p class="slots-msg">${t("slots.loading")}</p>`;

  let data;
  try {
    data = await fetchAvailability(state.date, state.party);
  } catch {
    if (state.online) setOnline(false); // API ausgefallen → lokale Engine
    data = { closed: isClosed(state.date), slots: availableSlots(state.date, state.party) };
  }
  if (reqId !== state.slotReq) return; // veraltete Antwort verwerfen

  wrap.innerHTML = "";
  if (data.closed) {
    wrap.innerHTML = `<p class="slots-msg">${t("slots.closed")}</p>`;
    els.slotsHint.hidden = true;
    return;
  }
  if (!data.slots.length) {
    wrap.innerHTML = `<p class="slots-msg">${t("slots.none")}</p>`;
    els.slotsHint.hidden = true;
    return;
  }
  els.slotsHint.hidden = false;
  for (const s of data.slots) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "slot";
    b.textContent = s.time;
    if (s.remaining <= 8) b.classList.add("scarce"); // „nur noch wenige"
    b.setAttribute("aria-pressed", String(state.time === s.time));
    b.classList.toggle("selected", state.time === s.time);
    b.addEventListener("click", () => {
      state.time = s.time;
      state.step = 2;
      renderAll();
      els.section.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    wrap.appendChild(b);
  }
}

function renderSummary() {
  els.summaryDate.textContent = fmtDateLong(state.date);
  els.summaryTime.textContent = state.time || "—";
  els.summaryParty.textContent = partyLabel(state.party);
}

function renderAll() {
  applyStaticI18n();
  updateConnBadge();
  renderSteps();
  renderPartyValue();
  renderSlots();
  renderSummary();
}

/* ---------------------------------------------------------------------------
 * 8) Validierung & Absenden
 * ------------------------------------------------------------------------- */
function showError(input, key) {
  const field = input.closest(".field");
  field.classList.add("invalid");
  const msg = field.querySelector(".err");
  if (msg) msg.textContent = key ? t(key) : "";
}
function clearError(input) {
  const field = input.closest(".field");
  field.classList.remove("invalid");
  const msg = field.querySelector(".err");
  if (msg) msg.textContent = "";
}

function validateGuest() {
  let ok = true;
  const g = els.form;
  const req = ["first", "last", "email", "phone"];
  for (const name of req) {
    const input = g.elements[name];
    if (!input.value.trim()) { showError(input, "err.required"); ok = false; }
    else clearError(input);
  }
  const email = g.elements.email;
  if (email.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
    showError(email, "err.email"); ok = false;
  }
  const gdpr = g.elements.gdpr;
  if (!gdpr.checked) { showError(gdpr, "err.gdpr"); ok = false; }
  else clearError(gdpr);
  return ok;
}

function genReservationNumber() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `LUM-${s}`;
}

/** Slot ist während des Ausfüllens vergeben worden → zurück zur Auswahl. */
function handleSlotGone() {
  flashNotice(t("err.slotGone"));
  state.time = null;
  state.step = 1;
  renderAll(); // lädt frische Verfügbarkeit
  els.section.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function submitReservation(e) {
  e.preventDefault();
  if (!validateGuest()) return;
  const f = els.form.elements;
  const submitBtn = els.form.querySelector('button[type="submit"]');

  const payload = {
    firstName: f.first.value.trim(),
    lastName: f.last.value.trim(),
    email: f.email.value.trim(),
    phone: f.phone.value.trim(),
    date: state.date,
    time: state.time,
    guestCount: state.party,
    notes: f.notes.value.trim(),
    gdprConsent: true, // Checkbox bereits in validateGuest() geprüft
  };

  submitBtn.disabled = true;
  try {
    let number;
    if (state.online) {
      try {
        const r = await api.createReservation(payload); // POST /api/reservations
        number = r.reservationNumber;
      } catch (err) {
        if (err.status === 409) return handleSlotGone();   // Slot vergeben
        if (err.status === 400) { flashNotice(t("err.submit")); return; }
        setOnline(false); // Netzwerkausfall → Offline-Fallback unten
      }
    }
    if (!number) {
      // Offline-Fallback: lokal in localStorage (simuliert die DB)
      number = genReservationNumber();
      saveBooking({
        reservation_number: number, date: state.date, time: state.time, guests: state.party,
        first_name: payload.firstName, last_name: payload.lastName, email: payload.email,
        phone: payload.phone, notes: payload.notes, status: "confirmed",
        created_at: new Date().toISOString(),
      });
    }
    els.okNumber.textContent = number;
    els.okDetails.textContent =
      `${fmtDateLong(state.date)} · ${state.time} · ${partyLabel(state.party)}`;
    state.step = 3;
    renderAll();
    els.section.scrollIntoView({ behavior: "smooth", block: "start" });
  } finally {
    submitBtn.disabled = false;
  }
}

function resetFlow() {
  state.step = 1;
  state.time = null;
  state.guest = { first: "", last: "", email: "", phone: "", notes: "", gdpr: false };
  els.form.reset();
  renderAll();
  els.section.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------------------------------------------------------------------------
 * 9) Theme & Sprache
 * ------------------------------------------------------------------------- */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("res-theme", theme);
  $("#themeBtn").setAttribute("aria-label", theme === "dark" ? "Light mode" : "Dark mode");
}
function initTheme() {
  const saved = localStorage.getItem("res-theme");
  const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved || (prefersDark ? "dark" : "light"));
}

/* ---------------------------------------------------------------------------
 * 10) Init
 * ------------------------------------------------------------------------- */
function initDateInput() {
  const input = els.dateInput;
  const today = new Date();
  const max = new Date();
  max.setDate(max.getDate() + bookingWindow());
  input.min = toISO(today);
  input.max = toISO(max);
  // Default: nächster nicht-geschlossener Tag
  let d = new Date(today);
  for (let i = 0; i < 8; i++) {
    if (!isClosed(toISO(d))) break;
    d.setDate(d.getDate() + 1);
  }
  input.value = toISO(d);
  state.date = input.value;
}

function bind() {
  els.section = $("#reserve");
  els.panels = [...document.querySelectorAll(".panel")];
  els.dateInput = $("#date");
  els.partyValue = $("#partyValue");
  els.slots = $("#slots");
  els.slotsSection = $("#slotsSection");
  els.slotsHint = $("#slotsHint");
  els.form = $("#guestForm");
  els.summaryDate = $("#sumDate");
  els.summaryTime = $("#sumTime");
  els.summaryParty = $("#sumParty");
  els.okNumber = $("#okNumber");
  els.okDetails = $("#okDetails");

  els.dateInput.addEventListener("change", () => {
    state.date = els.dateInput.value;
    state.time = null;
    renderSlots();
  });

  $("#partyMinus").addEventListener("click", () => {
    state.party = Math.max(partyMin(), state.party - 1);
    state.time = null;
    renderPartyValue(); renderSlots();
  });
  $("#partyPlus").addEventListener("click", () => {
    state.party = Math.min(partyMax(), state.party + 1);
    state.time = null;
    renderPartyValue(); renderSlots();
  });

  $("#backToDetails").addEventListener("click", () => {
    state.step = 1; renderAll();
    els.section.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  els.form.addEventListener("submit", submitReservation);
  $("#newReservation").addEventListener("click", resetFlow);

  $("#langBtn").addEventListener("click", () => {
    lang = lang === "de" ? "en" : "de";
    localStorage.setItem("res-lang", lang);
    renderAll();
  });
  $("#themeBtn").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
  });

  // Live-Fehler beim Tippen entfernen
  els.form.querySelectorAll("input, textarea").forEach((inp) => {
    inp.addEventListener("input", () => clearError(inp));
    inp.addEventListener("change", () => clearError(inp));
  });
}

async function main() {
  initTheme();
  bind();
  // API-Erreichbarkeit prüfen + öffentliche Einstellungen laden
  try {
    state.apiSettings = await api.getPublicSettings();
    setOnline(true);
  } catch {
    setOnline(false); // Backend nicht erreichbar → lokale Demo-Daten
  }
  initDateInput();
  renderAll();
}

document.addEventListener("DOMContentLoaded", main);
