import { prisma } from "../prisma";
import { getSettings } from "./settings.service";

/** Kennzahlen fürs Dashboard: Auslastung, Reservierungen/Tag, beliebte Zeiten. */
export async function overview(from?: string, to?: string) {
  const where: any = { status: { not: "cancelled" } };
  if (from || to) where.date = { gte: from, lte: to };

  const rows = await prisma.reservation.findMany({
    where,
    select: { date: true, time: true, guestCount: true },
  });

  const settings = await getSettings();
  const totalReservations = rows.length;
  const totalGuests = rows.reduce((s, r) => s + r.guestCount, 0);

  // Reservierungen & Gäste pro Tag
  const perDay = new Map<string, { reservations: number; guests: number }>();
  for (const r of rows) {
    const e = perDay.get(r.date) ?? { reservations: 0, guests: 0 };
    e.reservations += 1;
    e.guests += r.guestCount;
    perDay.set(r.date, e);
  }
  const reservationsPerDay = [...perDay.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Beliebteste Uhrzeiten
  const perTime = new Map<string, number>();
  for (const r of rows) perTime.set(r.time, (perTime.get(r.time) ?? 0) + 1);
  const popularTimes = [...perTime.entries()]
    .map(([time, count]) => ({ time, count }))
    .sort((a, b) => b.count - a.count || a.time.localeCompare(b.time))
    .slice(0, 8);

  // Durchschnittliche Auslastung je Tag relativ zur Kapazität (grobe Schätzung)
  const days = reservationsPerDay.length || 1;
  const avgGuestsPerDay = totalGuests / days;
  const occupancyRate = Math.min(1, avgGuestsPerDay / (settings.maxConcurrentCapacity || 1));

  return {
    range: { from: from ?? null, to: to ?? null },
    totals: { reservations: totalReservations, guests: totalGuests },
    occupancyRate: Number(occupancyRate.toFixed(3)),
    reservationsPerDay,
    popularTimes,
  };
}
