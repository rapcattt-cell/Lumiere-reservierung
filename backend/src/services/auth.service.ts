import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { prisma } from "../prisma";
import { config } from "../config";
import { unauthorized } from "../utils/httpError";
import type { AuthUser } from "../middleware/auth";

function signAccess(user: AuthUser): string {
  return jwt.sign(user, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessTtl,
  } as SignOptions);
}

function signRefresh(sub: string): string {
  return jwt.sign({ sub }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshTtl,
  } as SignOptions);
}

function toAuthUser(u: { id: string; email: string; role: string }): AuthUser {
  return { sub: u.id, email: u.email, role: u.role };
}

/** Login: Passwort prüfen, Token-Paar ausstellen, Refresh-Hash speichern. */
export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw unauthorized("E-Mail oder Passwort falsch");
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw unauthorized("E-Mail oder Passwort falsch");

  const accessToken = signAccess(toAuthUser(user));
  const refreshToken = signRefresh(user.id);
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshHash: await bcrypt.hash(refreshToken, 10) },
  });

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}

/** Refresh: Token verifizieren, gegen gespeicherten Hash prüfen, rotieren. */
export async function refresh(refreshToken: string) {
  let sub: string;
  try {
    ({ sub } = jwt.verify(refreshToken, config.jwt.refreshSecret) as { sub: string });
  } catch {
    throw unauthorized("Refresh-Token ungültig oder abgelaufen");
  }
  const user = await prisma.user.findUnique({ where: { id: sub } });
  if (!user || !user.refreshHash) throw unauthorized("Sitzung nicht gültig");
  const matches = await bcrypt.compare(refreshToken, user.refreshHash);
  if (!matches) throw unauthorized("Sitzung nicht gültig");

  const newAccess = signAccess(toAuthUser(user));
  const newRefresh = signRefresh(user.id); // Rotation
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshHash: await bcrypt.hash(newRefresh, 10) },
  });
  return { accessToken: newAccess, refreshToken: newRefresh };
}

/** Logout: gespeicherten Refresh-Hash löschen (invalidiert die Sitzung). */
export async function logout(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { refreshHash: null } }).catch(() => {});
}

export async function me(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!u) throw unauthorized();
  return u;
}
