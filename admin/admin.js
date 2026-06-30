/* ============================================================================
 * admin.js — Admin-Dashboard (Login, Übersichten, Verwaltung, Statistik)
 * Spricht ausschließlich die REST-API an (adminApi.js). Kein Build-Step.
 * ========================================================================== */

import { api, login, logout, getUser, isLoggedIn, API_BASE } from "./adminApi.js?v=7";

/* ---------------------------------- Helfer -------------------------------- */
const $ = (s, r = document) => r.querySelector(s);
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const parseISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
const weekStartISO = (s) => { const d = parseISO(s); const off = (d.getDay() + 6) % 7; d.setDate(d.getDate() - off); return iso(d); };
const fmtDay = (s, opts) => parseISO(s).toLocaleDateString("de-DE", opts);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const STATUS = { confirmed: "Bestätigt", pending: "Offen", seated: "Eingecheckt", cancelled: "Storniert" };
const STATUS_ORDER = ["pending", "confirmed", "seated", "cancelled"];
const badge = (st) => `<span class="badge ${st}">${STATUS[st] || st}</span>`;

let toastTimer;
function toast(msg, isErr) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.toggle("err", !!isErr);
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3500);
}

/* ---------------------------------- State --------------------------------- */
const state = {
  view: "day",
  day: today(),
  week: weekStartISO(today()),
  rangeFrom: today(),
  rangeTo: addDays(today(), 30),
  listStatus: "",
  q: "",
  tables: [],
  planMode: "edit",   // Tischplan: "edit" | "assign"
  planDate: today(),
};

async function ensureTables() {
  if (!state.tables.length) { try { state.tables = await api("/tables"); } catch { /* egal */ } }
}

/* --------------------------- Login / App-Umschaltung ---------------------- */
function showLogin() { stopLiveUpdates(); $("#app").hidden = true; $("#login").hidden = false; }
function showApp() {
  const u = getUser();
  $("#login").hidden = true;
  $("#app").hidden = false;
  $("#whoName").textContent = u?.name || u?.email || "—";
  $("#whoRole").textContent = u?.role || "";
  startLiveUpdates();
  setView(state.view);
}

/* --------------------------- Echtzeit (SSE) ------------------------------- */
let _es = null, _esDebounce = null;
function startLiveUpdates() {
  if (_es || typeof EventSource === "undefined") return;
  try {
    _es = new EventSource(API_BASE + "/events");
    _es.onmessage = () => {
      // Aktuelle Ansicht neu laden — aber laufende Bearbeitung (offenes Modal) nicht stören.
      clearTimeout(_esDebounce);
      _esDebounce = setTimeout(() => {
        if (!$("#app").hidden && $("#modal").hidden) renderContent();
      }, 500);
    };
    _es.onerror = () => { /* Browser verbindet automatisch neu */ };
  } catch { /* SSE nicht verfügbar — Dashboard funktioniert weiterhin manuell */ }
}
function stopLiveUpdates() {
  if (_es) { _es.close(); _es = null; }
}

async function onLogin(e) {
  e.preventDefault();
  const email = $("#email").value.trim();
  const pw = $("#password").value;
  const btn = $("#loginBtn");
  btn.disabled = true;
  $("#loginErr").textContent = "";
  try {
    await login(email, pw);
    showApp();
  } catch (err) {
    $("#loginErr").textContent =
      err.status === 401 ? "E-Mail oder Passwort falsch."
      : err.status ? (err.message || "Anmeldung fehlgeschlagen.")
      : "Server nicht erreichbar. Läuft das Backend auf Port 4000? (npm start im Ordner backend)";
  } finally {
    btn.disabled = false;
  }
}

/* --------------------------------- Ansichten ------------------------------ */
const TITLES = { day: "Tagesansicht", week: "Wochenansicht", list: "Liste", plan: "Tischplan", stats: "Statistik" };

function setView(v) {
  state.view = v;
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
  $("#viewTitle").textContent = TITLES[v];
  refresh();
}
function refresh() { renderControls(); renderContent(); }

function renderControls() {
  const tc = $("#topControls");
  if (state.view === "day") {
    tc.innerHTML = `
      <span class="nudge"><button id="prev">‹</button><button id="next">›</button></span>
      <input type="date" id="dayPick" value="${state.day}">
      <button class="btn btn-ghost" id="todayBtn">Heute</button>`;
    $("#prev").onclick = () => { state.day = addDays(state.day, -1); refresh(); };
    $("#next").onclick = () => { state.day = addDays(state.day, 1); refresh(); };
    $("#dayPick").onchange = (e) => { state.day = e.target.value; renderContent(); };
    $("#todayBtn").onclick = () => { state.day = today(); refresh(); };
  } else if (state.view === "week") {
    const end = addDays(state.week, 6);
    tc.innerHTML = `
      <span class="nudge"><button id="prev">‹</button><button id="next">›</button></span>
      <span style="font-weight:600">${fmtDay(state.week, { day: "numeric", month: "short" })} – ${fmtDay(end, { day: "numeric", month: "short" })}</span>
      <button class="btn btn-ghost" id="thisWeek">Diese Woche</button>`;
    $("#prev").onclick = () => { state.week = addDays(state.week, -7); refresh(); };
    $("#next").onclick = () => { state.week = addDays(state.week, 7); refresh(); };
    $("#thisWeek").onclick = () => { state.week = weekStartISO(today()); refresh(); };
  } else if (state.view === "list") {
    tc.innerHTML = `
      <input type="date" id="rFrom" value="${state.rangeFrom}">
      <span style="color:var(--ink-faint)">–</span>
      <input type="date" id="rTo" value="${state.rangeTo}">
      <select id="lStatus"><option value="">Alle Status</option>
        ${STATUS_ORDER.map((s) => `<option value="${s}" ${state.listStatus === s ? "selected" : ""}>${STATUS[s]}</option>`).join("")}
      </select>
      <input class="search" id="lQ" placeholder="Suche Name, E-Mail, Nr. …" value="${esc(state.q)}">`;
    $("#rFrom").onchange = (e) => { state.rangeFrom = e.target.value; renderContent(); };
    $("#rTo").onchange = (e) => { state.rangeTo = e.target.value; renderContent(); };
    $("#lStatus").onchange = (e) => { state.listStatus = e.target.value; renderContent(); };
    let deb;
    $("#lQ").oninput = (e) => { state.q = e.target.value; clearTimeout(deb); deb = setTimeout(renderContent, 300); };
  } else if (state.view === "stats") {
    tc.innerHTML = `
      <input type="date" id="rFrom" value="${state.rangeFrom}">
      <span style="color:var(--ink-faint)">–</span>
      <input type="date" id="rTo" value="${state.rangeTo}">`;
    $("#rFrom").onchange = (e) => { state.rangeFrom = e.target.value; renderContent(); };
    $("#rTo").onchange = (e) => { state.rangeTo = e.target.value; renderContent(); };
  } else if (state.view === "plan") {
    tc.innerHTML = `
      <div class="seg">
        <button class="seg-btn ${state.planMode === "edit" ? "active" : ""}" data-mode="edit">Bearbeiten</button>
        <button class="seg-btn ${state.planMode === "assign" ? "active" : ""}" data-mode="assign">Zuweisen</button>
      </div>
      ${state.planMode === "edit"
        ? `<button class="btn btn-primary" id="addTable">+ Tisch</button>`
        : `<span class="nudge"><button id="pPrev">‹</button><button id="pNext">›</button></span>
           <input type="date" id="planDate" value="${state.planDate}">`}`;
    tc.querySelectorAll(".seg-btn").forEach((b) => (b.onclick = () => { state.planMode = b.dataset.mode; refresh(); }));
    if (state.planMode === "edit") {
      $("#addTable").onclick = addTable;
    } else {
      $("#pPrev").onclick = () => { state.planDate = addDays(state.planDate, -1); refresh(); };
      $("#pNext").onclick = () => { state.planDate = addDays(state.planDate, 1); refresh(); };
      $("#planDate").onchange = (e) => { state.planDate = e.target.value; renderContent(); };
    }
  }
}

async function renderContent() {
  const c = $("#content");
  c.innerHTML = '<p class="loading">Lade …</p>';
  try {
    if (state.view === "day") await renderDay(c);
    else if (state.view === "week") await renderWeek(c);
    else if (state.view === "list") await renderList(c);
    else if (state.view === "plan") await renderPlan(c);
    else if (state.view === "stats") await renderStats(c);
  } catch (e) {
    if (e.status === 401) { await logout(); showLogin(); return; }
    c.innerHTML = `<p class="empty">Fehler beim Laden: ${esc(e.message)}</p>`;
  }
}

function wireCards(root) {
  root.querySelectorAll("[data-id]").forEach((el) => (el.onclick = () => openModal(el.dataset.id)));
}

function resCard(r) {
  return `<div class="res-card" data-id="${r.id}">
    <div class="rc-top"><span class="rc-name">${esc(r.firstName)} ${esc(r.lastName)}</span>${badge(r.status)}</div>
    <div class="rc-meta">${r.guestCount} Pers.${r.assignedTable ? ` · ${esc(r.assignedTable.name)}` : ""}${r.notes ? " · ✎" : ""}</div>
  </div>`;
}

async function renderDay(c) {
  const rows = await api(`/reservations?date=${state.day}`);
  const active = rows.filter((r) => r.status !== "cancelled");
  const guests = active.reduce((s, r) => s + r.guestCount, 0);
  const head = `<div style="margin-bottom:16px;color:var(--ink-soft)">${fmtDay(state.day, { weekday: "long", day: "numeric", month: "long" })} · ${active.length} Reservierungen · ${guests} Gäste</div>`;
  if (!rows.length) { c.innerHTML = head + '<p class="empty">Keine Reservierungen an diesem Tag.</p>'; return; }

  const byTime = {};
  for (const r of rows) (byTime[r.time] ??= []).push(r);
  let html = head + '<div class="timeline">';
  for (const time of Object.keys(byTime).sort()) {
    html += `<div class="tl-row"><div class="tl-time">${time}</div><div class="tl-cards">`;
    for (const r of byTime[time]) html += resCard(r);
    html += "</div></div>";
  }
  html += "</div>";
  c.innerHTML = html;
  wireCards(c);
}

async function renderWeek(c) {
  const start = state.week, end = addDays(start, 6);
  const rows = await api(`/reservations?from=${start}&to=${end}`);
  const byDate = {};
  for (const r of rows) (byDate[r.date] ??= []).push(r);
  const names = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  let html = '<div class="week">';
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const list = (byDate[d] || []).filter((r) => r.status !== "cancelled").sort((a, b) => a.time.localeCompare(b.time));
    const guests = list.reduce((s, r) => s + r.guestCount, 0);
    html += `<div class="wk-col"><div class="wk-head ${d === today() ? "today" : ""}">
        <div class="wk-day">${names[i]}</div><div class="wk-date">${fmtDay(d, { day: "numeric", month: "short" })}</div></div>
      <div class="wk-body">`;
    for (const r of list) html += `<div class="wk-item ${r.status}" data-id="${r.id}"><span class="wi-t">${r.time}</span> · ${esc(r.lastName)} (${r.guestCount})</div>`;
    if (!list.length) html += '<div class="tl-empty" style="font-size:.74rem">—</div>';
    html += `</div><div class="wk-sum">${list.length} Res. · ${guests} G.</div></div>`;
  }
  html += "</div>";
  c.innerHTML = html;
  wireCards(c);
}

async function renderList(c) {
  const qs = new URLSearchParams();
  if (state.rangeFrom) qs.set("from", state.rangeFrom);
  if (state.rangeTo) qs.set("to", state.rangeTo);
  if (state.listStatus) qs.set("status", state.listStatus);
  if (state.q) qs.set("q", state.q);
  const rows = await api("/reservations?" + qs.toString());
  if (!rows.length) { c.innerHTML = '<p class="empty">Keine Reservierungen gefunden.</p>'; return; }

  let html = `<div class="table-wrap"><table class="res"><thead><tr>
    <th>Datum</th><th>Zeit</th><th>Gast</th><th>Pers.</th><th>Tisch</th><th>Status</th><th>Nr.</th>
    </tr></thead><tbody>`;
  for (const r of rows) {
    html += `<tr data-id="${r.id}">
      <td class="tnum">${fmtDay(r.date, { day: "2-digit", month: "2-digit", year: "2-digit" })}</td>
      <td class="tnum">${r.time}</td>
      <td><div class="cell-name">${esc(r.firstName)} ${esc(r.lastName)}</div><div class="cell-sub">${esc(r.email)}</div></td>
      <td class="tnum">${r.guestCount}</td>
      <td>${r.assignedTable ? esc(r.assignedTable.name) : "—"}</td>
      <td>${badge(r.status)}</td>
      <td class="cell-sub tnum">${esc(r.reservationNumber)}</td>
    </tr>`;
  }
  html += "</tbody></table></div>";
  c.innerHTML = html;
  wireCards(c);
}

async function renderStats(c) {
  const qs = new URLSearchParams();
  if (state.rangeFrom) qs.set("from", state.rangeFrom);
  if (state.rangeTo) qs.set("to", state.rangeTo);
  const s = await api("/stats/overview?" + qs.toString());
  const occ = Math.round(s.occupancyRate * 100);
  const maxDay = Math.max(1, ...s.reservationsPerDay.map((d) => d.guests));
  const maxTime = Math.max(1, ...s.popularTimes.map((t) => t.count));

  const dayBars = s.reservationsPerDay.length
    ? s.reservationsPerDay.map((d) => `<div class="bar-row"><span class="tnum">${fmtDay(d.date, { day: "2-digit", month: "2-digit" })}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round((d.guests / maxDay) * 100)}%"></div></div>
        <span class="bar-val">${d.guests}</span></div>`).join("")
    : '<p class="tl-empty">Keine Daten im Zeitraum.</p>';
  const timeBars = s.popularTimes.length
    ? s.popularTimes.map((t) => `<div class="bar-row"><span class="tnum">${t.time}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round((t.count / maxTime) * 100)}%"></div></div>
        <span class="bar-val">${t.count}</span></div>`).join("")
    : '<p class="tl-empty">Keine Daten im Zeitraum.</p>';

  c.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">Reservierungen</div><div class="stat-value">${s.totals.reservations}</div></div>
      <div class="stat-card"><div class="stat-label">Gäste gesamt</div><div class="stat-value">${s.totals.guests}</div></div>
      <div class="stat-card"><div class="stat-label">Ø Auslastung / Tag</div>
        <div class="gauge"><div class="gauge-ring" style="--p:${occ}" data-label="${occ}%"></div></div></div>
    </div>
    <div class="panel"><h3>Gäste pro Tag</h3>${dayBars}</div>
    <div class="panel"><h3>Beliebteste Uhrzeiten</h3>${timeBars}</div>`;
}

/* ------------------------------- Tischplan -------------------------------- */
const toMin = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
let _seatDur = null;
async function seatingDuration() {
  if (_seatDur) return _seatDur;
  try { _seatDur = (await api("/settings")).seatingDurationMin; } catch { _seatDur = 120; }
  return _seatDur;
}
const tableSize = (cap) => Math.max(52, 46 + cap * 7);
function tableBox(t) {
  const base = tableSize(t.capacity);
  const w = t.shape === "rect" ? base + 28 : base;
  const h = t.shape === "rect" ? base - 6 : base;
  const radius = t.shape === "round" ? "50%" : "12px";
  return `left:${t.positionX}px;top:${t.positionY}px;width:${w}px;height:${h}px;border-radius:${radius}`;
}
const SHAPE_LABEL = { round: "Rund", square: "Quadrat", rect: "Rechteck" };

async function renderPlan(c) {
  state.tables = await api("/tables");
  if (state.planMode === "edit") renderPlanEdit(c);
  else await renderPlanAssign(c);
}

function floorsByArea(buildTable) {
  const areas = [...new Set(state.tables.map((t) => t.area || "Restaurant"))];
  return areas.map((area) => {
    const ts = state.tables.filter((t) => (t.area || "Restaurant") === area);
    return `<div class="floor-wrap"><div class="floor-title">${esc(area)}</div>
      <div class="floor" data-area="${esc(area)}">${ts.map(buildTable).join("")}</div></div>`;
  }).join("");
}

/* --- Editor: Tische verschieben / bearbeiten / anlegen / löschen --- */
function renderPlanEdit(c) {
  if (!state.tables.length) { c.innerHTML = '<p class="empty">Noch keine Tische — oben „+ Tisch" anlegen.</p>'; return; }
  c.innerHTML = floorsByArea((t) =>
    `<div class="tbl editable" data-tid="${t.id}" style="${tableBox(t)}">
       <span class="tbl-name">${esc(t.name)}</span><span class="tbl-cap">${t.capacity}P</span></div>`)
    + '<p class="floor-hint">Tische ziehen zum Verschieben · klicken zum Bearbeiten.</p>';
  enableTableDrag(c);
}

function enableTableDrag(root) {
  root.querySelectorAll(".tbl.editable").forEach((el) => {
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const floor = el.parentElement;
      const startX = e.clientX, startY = e.clientY;
      const origX = parseFloat(el.style.left), origY = parseFloat(el.style.top);
      let moved = false;
      el.setPointerCapture(e.pointerId);
      el.classList.add("dragging");
      const move = (ev) => {
        const dx = ev.clientX - startX, dy = ev.clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
        const maxX = floor.clientWidth - el.offsetWidth, maxY = floor.clientHeight - el.offsetHeight;
        el.style.left = Math.max(0, Math.min(maxX, origX + dx)) + "px";
        el.style.top = Math.max(0, Math.min(maxY, origY + dy)) + "px";
      };
      const up = async () => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        el.classList.remove("dragging");
        if (moved) {
          const x = Math.round(parseFloat(el.style.left)), y = Math.round(parseFloat(el.style.top));
          try { await api("/tables/" + el.dataset.tid, { method: "PATCH", body: { positionX: x, positionY: y } }); }
          catch (err) { toast(err.body?.error || "Verschieben fehlgeschlagen (Admin nötig)", true); renderContent(); }
        } else {
          openTableModal(el.dataset.tid);
        }
      };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
    });
  });
}

async function addTable() {
  const area = [...new Set(state.tables.map((t) => t.area || "Restaurant"))][0] || "Restaurant";
  try {
    await api("/tables", { method: "POST", body: { name: "Tisch " + (state.tables.length + 1), capacity: 2, shape: "square", area, positionX: 24, positionY: 24 } });
    toast("Tisch angelegt");
    renderContent();
  } catch (e) { toast(e.body?.error || "Anlegen fehlgeschlagen (Admin-Recht nötig)", true); }
}

function openTableModal(tid) {
  const t = state.tables.find((x) => x.id === tid);
  if (!t) return;
  $("#modalBody").innerHTML = `
    <div class="m-head"><span class="m-name">${esc(t.name)}</span></div>
    <div class="m-grid">
      <div class="m-field full"><label>Name</label><input id="tName" value="${esc(t.name)}"></div>
      <div class="m-field"><label>Kapazität</label><input id="tCap" type="number" min="1" max="50" value="${t.capacity}"></div>
      <div class="m-field"><label>Form</label><select id="tShape">${["round", "square", "rect"].map((s) => `<option value="${s}" ${t.shape === s ? "selected" : ""}>${SHAPE_LABEL[s]}</option>`).join("")}</select></div>
      <div class="m-field"><label>Bereich</label><input id="tArea" value="${esc(t.area || "Restaurant")}"></div>
      <div class="m-field"><label>Status</label><select id="tStatus">
        <option value="available" ${t.status === "available" ? "selected" : ""}>Aktiv</option>
        <option value="inactive" ${t.status === "inactive" ? "selected" : ""}>Inaktiv</option></select></div>
    </div>
    <div class="m-actions">
      <button class="btn btn-primary grow" id="tSave">Speichern</button>
      <button class="btn btn-danger" id="tDel">Löschen</button>
    </div>`;
  $("#modal").hidden = false;
  $("#tSave").onclick = () => saveTable(tid);
  $("#tDel").onclick = () => delTable(tid);
}

async function saveTable(tid) {
  const body = {
    name: $("#tName").value.trim(),
    capacity: Number($("#tCap").value),
    shape: $("#tShape").value,
    area: $("#tArea").value.trim() || "Restaurant",
    status: $("#tStatus").value,
  };
  try { await api("/tables/" + tid, { method: "PATCH", body }); toast("Gespeichert"); closeModal(); renderContent(); }
  catch (e) { toast(e.body?.error || "Speichern fehlgeschlagen (Admin nötig)", true); }
}

async function delTable(tid) {
  if (!confirm("Tisch wirklich löschen?")) return;
  try { await api("/tables/" + tid, { method: "DELETE" }); toast("Gelöscht"); closeModal(); renderContent(); }
  catch (e) { toast(e.body?.error || "Löschen fehlgeschlagen (Admin nötig)", true); }
}

/* --- Zuweisung: Reservierungen per Drag&Drop auf Tische --- */
async function renderPlanAssign(c) {
  const rows = (await api("/reservations?date=" + state.planDate)).filter((r) => r.status !== "cancelled");
  const dur = await seatingDuration();

  const floors = floorsByArea((t) => {
    const here = rows.filter((r) => r.assignedTableId === t.id);
    const occ = here.length ? " occupied" : "";
    const lbl = here.length ? `<span class="tbl-occ">${here.map((r) => esc(r.lastName) + " " + r.time).join("<br>")}</span>` : "";
    return `<div class="tbl droppable${occ}" data-tid="${t.id}" data-cap="${t.capacity}" style="${tableBox(t)}">
      <span class="tbl-name">${esc(t.name)}</span><span class="tbl-cap">${t.capacity}P</span>${lbl}</div>`;
  });

  const chips = rows.length ? rows.map((r) => {
    const tbl = r.assignedTableId ? state.tables.find((t) => t.id === r.assignedTableId) : null;
    return `<div class="res-chip ${r.assignedTableId ? "assigned" : ""}" draggable="true" data-rid="${r.id}" data-guests="${r.guestCount}" data-time="${r.time}">
      <div class="rc-line"><span class="wi-t">${r.time}</span> <strong>${esc(r.lastName)}</strong> · ${r.guestCount}P</div>
      <div class="rc-sub">${tbl ? "→ " + esc(tbl.name) : "kein Tisch"}</div></div>`;
  }).join("") : '<p class="tl-empty">Keine Reservierungen an diesem Tag.</p>';

  c.innerHTML = `<div class="assign-layout">
    <div class="assign-side">
      <div class="assign-side-head">${fmtDay(state.planDate, { weekday: "short", day: "numeric", month: "short" })} · ${rows.length} Res.</div>
      ${chips}
    </div>
    <div class="assign-floors">${floors}
      <p class="floor-hint">Reservierung aus der Liste auf einen Tisch ziehen — passende freie Tische werden grün hervorgehoben, belegte/zu kleine ausgegraut.</p>
    </div>
  </div>`;
  enableAssignDnD(c, rows, dur);
}

function enableAssignDnD(root, rows, dur) {
  const overlaps = (t1, t2) => { const a0 = toMin(t1), a1 = a0 + dur, b0 = toMin(t2), b1 = b0 + dur; return a0 < b1 && b0 < a1; };
  root.querySelectorAll(".res-chip").forEach((chip) => {
    chip.addEventListener("dragstart", (e) => {
      const rid = chip.dataset.rid, guests = +chip.dataset.guests, time = chip.dataset.time;
      e.dataTransfer.setData("text/plain", rid);
      e.dataTransfer.effectAllowed = "move";
      root.querySelectorAll(".tbl.droppable").forEach((tl) => {
        const occupied = rows.some((r) => r.id !== rid && r.assignedTableId === tl.dataset.tid && overlaps(r.time, time));
        tl.classList.add(+tl.dataset.cap >= guests && !occupied ? "fit" : "nofit");
      });
    });
    chip.addEventListener("dragend", () => root.querySelectorAll(".tbl.droppable").forEach((tl) => tl.classList.remove("fit", "nofit", "over")));
    // Klick (ohne Ziehen) öffnet die Reservierung zum Bearbeiten/Lösen
    chip.addEventListener("click", () => openModal(chip.dataset.rid));
  });
  root.querySelectorAll(".tbl.droppable").forEach((tl) => {
    tl.addEventListener("dragover", (e) => { e.preventDefault(); tl.classList.add("over"); });
    tl.addEventListener("dragleave", () => tl.classList.remove("over"));
    tl.addEventListener("drop", async (e) => {
      e.preventDefault();
      tl.classList.remove("over");
      const rid = e.dataTransfer.getData("text/plain");
      if (!rid) return;
      try { await api("/reservations/" + rid, { method: "PATCH", body: { assignedTableId: tl.dataset.tid } }); toast("Tisch zugewiesen"); renderContent(); }
      catch (err) { toast(err.body?.error || "Zuweisung fehlgeschlagen", true); }
    });
  });
}

/* ----------------------------- Detail-Modal ------------------------------- */
async function openModal(id) {
  await ensureTables();
  let r;
  try { r = await api("/reservations/" + id); }
  catch (e) { if (e.status === 401) { await logout(); showLogin(); } else toast("Konnte Reservierung nicht laden", true); return; }

  const tableOpts = `<option value="">— kein Tisch —</option>` +
    state.tables.map((t) => `<option value="${t.id}" ${r.assignedTableId === t.id ? "selected" : ""}>${esc(t.name)} (${t.capacity}P)</option>`).join("");

  $("#modalBody").innerHTML = `
    <div class="m-head"><span class="m-name">${esc(r.firstName)} ${esc(r.lastName)}</span>${badge(r.status)}</div>
    <div class="m-num">${esc(r.reservationNumber)}</div>
    <div class="m-contact">
      <a href="mailto:${encodeURIComponent(r.email)}">✉ ${esc(r.email)}</a>
      <a href="tel:${esc(r.phone)}">☎ ${esc(r.phone)}</a>
    </div>
    <div class="m-grid">
      <div class="m-field"><label>Datum</label><input type="date" id="mDate" value="${r.date}"></div>
      <div class="m-field"><label>Uhrzeit</label><input type="time" id="mTime" value="${r.time}"></div>
      <div class="m-field"><label>Personen</label><input type="number" id="mGuests" min="1" max="50" value="${r.guestCount}"></div>
      <div class="m-field"><label>Status</label><select id="mStatus">${STATUS_ORDER.map((st) => `<option value="${st}" ${r.status === st ? "selected" : ""}>${STATUS[st]}</option>`).join("")}</select></div>
      <div class="m-field full"><label>Tisch</label><select id="mTable">${tableOpts}</select></div>
      <div class="m-field full"><label>Notiz / Sonderwünsche</label><textarea id="mNotes">${esc(r.notes || "")}</textarea></div>
    </div>
    <div class="m-actions">
      <button class="btn btn-primary grow" id="mSave">Speichern</button>
      <button class="btn btn-danger" id="mCancel">Stornieren</button>
    </div>`;
  $("#modal").hidden = false;
  $("#mSave").onclick = () => saveModal(r.id);
  $("#mCancel").onclick = () => cancelModal(r.id);
}
function closeModal() { $("#modal").hidden = true; }

async function saveModal(id) {
  const body = {
    date: $("#mDate").value,
    time: $("#mTime").value,
    guestCount: Number($("#mGuests").value),
    status: $("#mStatus").value,
    assignedTableId: $("#mTable").value || null,
    notes: $("#mNotes").value,
  };
  const btn = $("#mSave");
  btn.disabled = true;
  try {
    await api("/reservations/" + id, { method: "PATCH", body });
    toast("Gespeichert");
    closeModal();
    renderContent();
  } catch (e) {
    toast(e.body?.error || "Speichern fehlgeschlagen", true);
    btn.disabled = false;
  }
}

async function cancelModal(id) {
  if (!confirm("Reservierung wirklich stornieren?")) return;
  try {
    await api("/reservations/" + id, { method: "DELETE" });
    toast("Storniert");
    closeModal();
    renderContent();
  } catch {
    toast("Stornieren fehlgeschlagen", true);
  }
}

/* --------------------------------- Theme ---------------------------------- */
function initTheme() {
  const saved = localStorage.getItem("admin-theme");
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = saved || (dark ? "dark" : "light");
}

/* ---------------------------------- Init ---------------------------------- */
function bindGlobal() {
  document.querySelectorAll(".nav-item").forEach((b) => (b.onclick = () => setView(b.dataset.view)));
  $("#logoutBtn").onclick = async () => { await logout(); showLogin(); };
  $("#themeBtn").onclick = () => {
    const n = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = n;
    localStorage.setItem("admin-theme", n);
  };
  $("#modal").querySelectorAll("[data-close]").forEach((el) => (el.onclick = closeModal));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  $("#loginForm").onsubmit = onLogin;
}

async function main() {
  initTheme();
  bindGlobal();
  if (isLoggedIn()) {
    try { await api("/auth/me"); showApp(); }
    catch { await logout(); showLogin(); }
  } else {
    showLogin();
  }
}

document.addEventListener("DOMContentLoaded", main);
