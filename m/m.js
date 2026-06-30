/* ============================================================================
 * m.js — Mobile Verwalter-App (Login, Heute, Tisch-Zuweisung, Einstellungen)
 * Spricht dieselbe REST-API wie das Desktop-Dashboard.
 * ========================================================================== */
import { api, login, logout, getUser, isLoggedIn } from "./mApi.js?v=1";

/* --------------------------------- Helfer --------------------------------- */
const $ = (s, r = document) => r.querySelector(s);
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const parseISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
const fmtDay = (s, o) => parseISO(s).toLocaleDateString("de-DE", o);
const toMin = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
const minToHHMM = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const STATUS = { confirmed: "Bestätigt", pending: "Offen", seated: "Eingecheckt", cancelled: "Storniert" };
const STATUS_ORDER = ["pending", "confirmed", "seated", "cancelled"];
const badge = (st) => `<span class="badge ${st}">${STATUS[st] || st}</span>`;

let toastTimer;
function toast(msg, isErr) {
  const t = $("#toast");
  t.textContent = msg; t.classList.toggle("err", !!isErr); t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 3000);
}

/* --------------------------------- State ---------------------------------- */
const state = {
  screen: "today",
  day: today(),
  planDate: today(),
  selRid: null,        // ausgewählte Reservierung im Tisch-Screen
  tables: [],
  seatDur: 120,
};

/* ------------------------------ Login / Shell ----------------------------- */
function showLogin() { $("#app").hidden = true; $("#login").hidden = false; }
function showApp() { $("#login").hidden = true; $("#app").hidden = false; setScreen(state.screen); }

async function onLogin(e) {
  e.preventDefault();
  const btn = $("#loginBtn"); btn.disabled = true; $("#loginErr").textContent = "";
  try { await login($("#email").value.trim(), $("#password").value); showApp(); }
  catch (err) {
    $("#loginErr").textContent = err.status === 401 ? "E-Mail oder Passwort falsch."
      : err.status ? (err.message || "Anmeldung fehlgeschlagen.")
      : "Server nicht erreichbar.";
  } finally { btn.disabled = false; }
}

const TITLES = { today: "Heute", plan: "Tische", settings: "Einstellungen" };
function setScreen(name) {
  state.screen = name; state.selRid = null;
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.screen === name));
  $("#screenTitle").textContent = TITLES[name];
  render();
}

async function render() {
  const c = $("#screen");
  c.innerHTML = '<p class="loading">Lade …</p>';
  try {
    if (state.screen === "today") await renderToday(c);
    else if (state.screen === "plan") await renderPlan(c);
    else if (state.screen === "settings") await renderSettings(c);
  } catch (e) {
    if (e.status === 401) { await logout(); showLogin(); return; }
    c.innerHTML = `<p class="empty">Fehler: ${esc(e.message)}</p>`;
  }
}

/* -------------------------------- Heute ----------------------------------- */
async function renderToday(c) {
  const rows = await api(`/reservations?date=${state.day}`);
  const active = rows.filter((r) => r.status !== "cancelled");
  const guests = active.reduce((s, r) => s + r.guestCount, 0);
  const head = `
    <div class="datenav">
      <button id="prev">‹</button>
      <div class="d-label">${fmtDay(state.day, { weekday: "short", day: "numeric", month: "short" })}</div>
      <button id="next">›</button>
    </div>
    <div class="day-sum">${active.length} Reservierungen · ${guests} Gäste${state.day !== today() ? ' · <a id="toToday" style="color:var(--gold)">heute</a>' : ""}</div>`;

  let body;
  if (!rows.length) body = '<p class="empty">Keine Reservierungen an diesem Tag.</p>';
  else {
    body = rows.sort((a, b) => a.time.localeCompare(b.time)).map((r) => `
      <div class="rcard" data-rid="${r.id}">
        <div class="r-time">${r.time}</div>
        <div class="r-main">
          <div class="r-name">${esc(r.firstName)} ${esc(r.lastName)}</div>
          <div class="r-sub">${r.guestCount} Pers.${r.assignedTable ? " · " + esc(r.assignedTable.name) : ""}${r.notes ? " · ✎" : ""}</div>
        </div>
        ${badge(r.status)}<div class="r-chevron">›</div>
      </div>`).join("");
  }
  c.innerHTML = head + body;
  $("#prev").onclick = () => { state.day = addDays(state.day, -1); render(); };
  $("#next").onclick = () => { state.day = addDays(state.day, 1); render(); };
  const tt = $("#toToday"); if (tt) tt.onclick = () => { state.day = today(); render(); };
  c.querySelectorAll(".rcard").forEach((el) => (el.onclick = () => openResSheet(el.dataset.rid)));
}

/* ----------------------- Tische (Tap-Zuweisung) --------------------------- */
async function loadSeatDur() {
  try { state.seatDur = (await api("/settings")).seatingDurationMin || 120; } catch { state.seatDur = 120; }
}
const tableSize = (cap) => Math.max(50, 44 + cap * 6);

async function renderPlan(c) {
  state.tables = await api("/tables");
  const rows = (await api(`/reservations?date=${state.planDate}`)).filter((r) => r.status !== "cancelled");
  await loadSeatDur();

  const sel = state.selRid ? rows.find((r) => r.id === state.selRid) : null;
  const overlaps = (t1, t2) => { const a0 = toMin(t1), a1 = a0 + state.seatDur, b0 = toMin(t2), b1 = b0 + state.seatDur; return a0 < b1 && b0 < a1; };

  const chips = rows.length ? rows.map((r) => {
    const tbl = r.assignedTableId ? state.tables.find((t) => t.id === r.assignedTableId) : null;
    return `<button class="chip ${r.assignedTableId ? "assigned" : ""} ${state.selRid === r.id ? "sel" : ""}" data-rid="${r.id}">
      <span class="c-t">${r.time}</span> ${esc(r.lastName)} · ${r.guestCount}P${tbl ? " →" + esc(tbl.name) : ""}</button>`;
  }).join("") : '<span class="assign-hint">Keine Reservierungen.</span>';

  const areas = [...new Set(state.tables.map((t) => t.area || "Restaurant"))];
  const floors = areas.map((area) => {
    const ts = state.tables.filter((t) => (t.area || "Restaurant") === area);
    return `<div class="floor-title">${esc(area)}</div><div class="floor">` + ts.map((t) => {
      const here = rows.filter((r) => r.assignedTableId === t.id);
      let cls = "";
      if (sel) {
        const occupied = here.some((r) => r.id !== sel.id && overlaps(r.time, sel.time));
        cls = t.capacity >= sel.guestCount && !occupied ? " fit" : " dim";
      } else if (here.length) cls = " occupied";
      const base = tableSize(t.capacity);
      const w = t.shape === "rect" ? base + 24 : base, h = t.shape === "rect" ? base - 4 : base;
      const radius = t.shape === "round" ? "50%" : "11px";
      const occ = here.length ? `<span class="t-occ">${here.map((r) => esc(r.lastName)).join(", ")}</span>` : "";
      return `<div class="tbl${cls}" data-tid="${t.id}" style="left:${t.positionX}px;top:${t.positionY}px;width:${w}px;height:${h}px;border-radius:${radius}">
        <span class="t-name">${esc(t.name)}</span><span class="t-cap">${t.capacity}P</span>${occ}</div>`;
    }).join("") + "</div>";
  }).join("");

  c.innerHTML = `
    <div class="datenav">
      <button id="pprev">‹</button>
      <div class="d-label">${fmtDay(state.planDate, { weekday: "short", day: "numeric", month: "short" })}</div>
      <button id="pnext">›</button>
    </div>
    <p class="assign-hint ${sel ? "active" : ""}">${sel ? `„${esc(sel.lastName)}" (${sel.guestCount}P) — grünen Tisch antippen` : "Reservierung antippen, dann Tisch wählen."}</p>
    <div class="chips">${chips}</div>
    ${floors || '<p class="empty">Noch keine Tische (im Desktop-Dashboard anlegen).</p>'}`;

  $("#pprev").onclick = () => { state.planDate = addDays(state.planDate, -1); state.selRid = null; render(); };
  $("#pnext").onclick = () => { state.planDate = addDays(state.planDate, 1); state.selRid = null; render(); };
  c.querySelectorAll(".chip").forEach((el) => (el.onclick = () => {
    state.selRid = state.selRid === el.dataset.rid ? null : el.dataset.rid; render();
  }));
  c.querySelectorAll(".tbl").forEach((el) => (el.onclick = () => onTableTap(el.dataset.tid, rows)));
}

async function onTableTap(tid, rows) {
  if (state.selRid) {
    try {
      await api("/reservations/" + state.selRid, { method: "PATCH", body: { assignedTableId: tid } });
      toast("Tisch zugewiesen"); state.selRid = null; render();
    } catch (e) { toast(e.body?.error || "Zuweisung fehlgeschlagen", true); }
  } else {
    // Tisch ohne Auswahl angetippt → belegende Reservierung verwalten
    const here = rows.find((r) => r.assignedTableId === tid);
    if (here) openResSheet(here.id);
  }
}

/* ------------------------------ Einstellungen ----------------------------- */
const DAYS = [["1", "Mo"], ["2", "Di"], ["3", "Mi"], ["4", "Do"], ["5", "Fr"], ["6", "Sa"], ["0", "So"]];

async function renderSettings(c) {
  let s;
  try { s = await api("/settings"); }
  catch (e) {
    if (e.status === 403) { c.innerHTML = '<p class="empty">Einstellungen nur für Administratoren.<br>Bitte mit einem Admin-Konto anmelden.</p>'; return; }
    throw e;
  }
  const oh = s.openingHours || {};
  const win = (dayKey, idx, field) => {
    const w = (oh[dayKey] || [])[idx];
    return w ? minToHHMM(w[field]) : "";
  };
  const dayRows = DAYS.map(([k, lbl]) => {
    const open = (oh[k] || []).length > 0;
    return `<div class="day-row ${open ? "" : "day-closed"}" data-day="${k}">
      <span class="day-name">${lbl}</span>
      <div class="win"><input type="time" data-w="0" data-f="open" value="${win(k, 0, "open")}"><span class="sep">–</span><input type="time" data-w="0" data-f="close" value="${win(k, 0, "close")}"></div>
      <div class="win"><input type="time" data-w="1" data-f="open" value="${win(k, 1, "open")}"><span class="sep">–</span><input type="time" data-w="1" data-f="close" value="${win(k, 1, "close")}"></div>
      <label class="day-toggle"><input type="checkbox" class="dayOpen" ${open ? "checked" : ""}>offen</label>
    </div>`;
  }).join("");

  const num = (id, label, val) => `<div class="set-row"><label for="${id}">${label}</label><input type="number" id="${id}" inputmode="numeric" value="${val}"></div>`;

  c.innerHTML = `
    <div class="set-title">Kapazität & Buchung</div>
    <div class="set-group">
      ${num("maxCap", "Max. Gäste gleichzeitig", s.maxConcurrentCapacity)}
      ${num("interval", "Zeitraster (Min)", s.slotIntervalMin)}
      ${num("dur", "Sitzdauer (Min)", s.seatingDurationMin)}
      ${num("window", "Buchbar im Voraus (Tage)", s.bookingWindowDays)}
      ${num("pmin", "Min. Personen", s.minPartySize)}
      ${num("pmax", "Max. Personen", s.maxPartySize)}
    </div>
    <div class="set-title">Öffnungszeiten (zwei Fenster je Tag möglich)</div>
    <div class="set-group">${dayRows}</div>
    <button class="btn btn-primary btn-block" id="saveSettings">Speichern</button>`;

  // „offen"-Toggle steuert die Sichtbarkeit der Zeitfelder
  c.querySelectorAll(".dayOpen").forEach((cb) => (cb.onchange = () => {
    cb.closest(".day-row").classList.toggle("day-closed", !cb.checked);
  }));
  $("#saveSettings").onclick = () => saveSettings(c);
}

async function saveSettings(c) {
  const N = (id) => Number($("#" + id, c).value);
  // Öffnungszeiten zusammenbauen
  const openingHours = {};
  c.querySelectorAll(".day-row").forEach((row) => {
    const k = row.dataset.day;
    if (!row.querySelector(".dayOpen").checked) { openingHours[k] = []; return; }
    const wins = [];
    [0, 1].forEach((i) => {
      const o = row.querySelector(`input[data-w="${i}"][data-f="open"]`).value;
      const cl = row.querySelector(`input[data-w="${i}"][data-f="close"]`).value;
      if (o && cl && toMin(cl) > toMin(o)) wins.push({ open: toMin(o), close: toMin(cl) });
    });
    openingHours[k] = wins;
  });

  const body = {
    maxConcurrentCapacity: N("maxCap"), slotIntervalMin: N("interval"), seatingDurationMin: N("dur"),
    bookingWindowDays: N("window"), minPartySize: N("pmin"), maxPartySize: N("pmax"), openingHours,
  };
  const btn = $("#saveSettings"); btn.disabled = true;
  try { await api("/settings", { method: "PUT", body }); toast("Einstellungen gespeichert"); }
  catch (e) { toast(e.body?.error || "Speichern fehlgeschlagen", true); btn.disabled = false; }
}

/* --------------------------- Reservierungs-Sheet -------------------------- */
function openSheet() { $("#sheet").hidden = false; }
function closeSheet() { $("#sheet").hidden = true; }

async function openResSheet(id) {
  if (!state.tables.length) { try { state.tables = await api("/tables"); } catch { /* egal */ } }
  let r;
  try { r = await api("/reservations/" + id); }
  catch { toast("Konnte Reservierung nicht laden", true); return; }

  const tableOpts = `<option value="">— kein Tisch —</option>` +
    state.tables.map((t) => `<option value="${t.id}" ${r.assignedTableId === t.id ? "selected" : ""}>${esc(t.name)} (${t.capacity}P)</option>`).join("");

  $("#sheetBody").innerHTML = `
    <div class="s-head"><span class="s-name">${esc(r.firstName)} ${esc(r.lastName)}</span>${badge(r.status)}</div>
    <div class="s-num">${esc(r.reservationNumber)} · ${fmtDay(r.date, { day: "numeric", month: "short" })} · ${r.time} · ${r.guestCount}P</div>
    <div class="s-contact">
      <a href="tel:${esc(r.phone)}">☎ Anrufen</a>
      <a href="mailto:${esc(r.email)}">✉ E-Mail</a>
    </div>
    <div class="s-field"><label>Status</label>
      <div class="s-status">${STATUS_ORDER.map((st) => `<button data-st="${st}" class="${r.status === st ? "on" : ""}">${STATUS[st]}</button>`).join("")}</div>
    </div>
    <div class="s-field"><label>Tisch</label><select id="sTable">${tableOpts}</select></div>
    <div class="s-field"><label>Uhrzeit & Personen</label>
      <div style="display:flex;gap:8px"><input id="sTime" type="time" value="${r.time}" style="flex:1"><input id="sGuests" type="number" inputmode="numeric" value="${r.guestCount}" style="width:84px"></div>
    </div>
    <div class="s-field"><label>Notiz</label><textarea id="sNotes">${esc(r.notes || "")}</textarea></div>
    <div class="s-actions">
      <button class="btn btn-primary grow" id="sSave">Speichern</button>
      <button class="btn btn-danger" id="sCancel">Stornieren</button>
    </div>`;
  openSheet();

  let chosenStatus = r.status;
  $("#sheetBody").querySelectorAll(".s-status button").forEach((b) => (b.onclick = () => {
    chosenStatus = b.dataset.st;
    $("#sheetBody").querySelectorAll(".s-status button").forEach((x) => x.classList.toggle("on", x === b));
  }));

  $("#sSave").onclick = async () => {
    const body = {
      status: chosenStatus,
      assignedTableId: $("#sTable").value || null,
      time: $("#sTime").value,
      guestCount: Number($("#sGuests").value),
      notes: $("#sNotes").value,
    };
    const btn = $("#sSave"); btn.disabled = true;
    try { await api("/reservations/" + id, { method: "PATCH", body }); toast("Gespeichert"); closeSheet(); render(); }
    catch (e) { toast(e.body?.error || "Speichern fehlgeschlagen", true); btn.disabled = false; }
  };
  $("#sCancel").onclick = async () => {
    if (!confirm("Reservierung stornieren?")) return;
    try { await api("/reservations/" + id, { method: "DELETE" }); toast("Storniert"); closeSheet(); render(); }
    catch (e) { toast(e.body?.error || "Stornieren fehlgeschlagen", true); }
  };
}

/* ---------------------------------- Init ---------------------------------- */
function bind() {
  $("#loginForm").onsubmit = onLogin;
  $("#logoutBtn").onclick = async () => { await logout(); showLogin(); };
  document.querySelectorAll(".tab").forEach((b) => (b.onclick = () => setScreen(b.dataset.screen)));
  $("#sheet").querySelectorAll("[data-close]").forEach((el) => (el.onclick = closeSheet));
}

async function main() {
  bind();
  if (isLoggedIn()) {
    try { await api("/auth/me"); showApp(); }
    catch { await logout(); showLogin(); }
  } else showLogin();
}
document.addEventListener("DOMContentLoaded", main);
