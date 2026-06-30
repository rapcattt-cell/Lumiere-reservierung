/* ============================================================================
 * mApi.js — API-Client der mobilen Verwalter-App (Auth + Auto-Refresh).
 * Gleiche Logik wie das Desktop-Dashboard; teilt sich die Session (gleiche Origin).
 * ========================================================================== */

// API immer gleiche Origin (Backend liefert Frontend aus) → relativ, lokal & live.
export const API_BASE = "/api";

const LS = { access: "admin-access", refresh: "admin-refresh", user: "admin-user" };

export function getUser() {
  try { return JSON.parse(localStorage.getItem(LS.user)); } catch { return null; }
}
function setSession({ accessToken, refreshToken, user }) {
  if (accessToken) localStorage.setItem(LS.access, accessToken);
  if (refreshToken) localStorage.setItem(LS.refresh, refreshToken);
  if (user) localStorage.setItem(LS.user, JSON.stringify(user));
}
export function clearSession() { Object.values(LS).forEach((k) => localStorage.removeItem(k)); }
export function isLoggedIn() { return !!localStorage.getItem(LS.access); }

class ApiError extends Error {
  constructor(status, body) { super((body && body.error) || `HTTP ${status}`); this.status = status; this.body = body; }
}

async function raw(path, { method = "GET", body, token } = {}) {
  const res = await fetch(API_BASE + path, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* leer */ }
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export async function login(email, password) {
  const r = await raw("/auth/login", { method: "POST", body: { email, password } });
  setSession(r);
  return r.user;
}

async function tryRefresh() {
  const rt = localStorage.getItem(LS.refresh);
  if (!rt) return false;
  try { setSession(await raw("/auth/refresh", { method: "POST", body: { refreshToken: rt } })); return true; }
  catch { return false; }
}

export async function api(path, opts = {}) {
  let token = localStorage.getItem(LS.access);
  try { return await raw(path, { ...opts, token }); }
  catch (e) {
    if (e.status === 401 && (await tryRefresh())) {
      token = localStorage.getItem(LS.access);
      return await raw(path, { ...opts, token });
    }
    throw e;
  }
}

export async function logout() {
  try { await api("/auth/logout", { method: "POST" }); } catch { /* egal */ }
  clearSession();
}

export { ApiError };
