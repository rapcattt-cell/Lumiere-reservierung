import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";
import { generateReservationNumber } from "../utils/reservationNumber";
import { conflict, badRequest, notFound } from "../utils/httpError";
import { checkBookable } from "./availability.service";
import { getSettings } from "./settings.service";
import { emitChange } from "../events";
import { hhmmToMin } from "../utils/availability";
import type { CreateReservationInput, UpdateReservationInput } from "../dtos/reservation.dto";

/** Ist der Tisch zu (date,time) bereits durch eine andere Reservierung belegt? */
async function tableHasConflict(tableId: string, dateISO: string, time: string, dur: number, excludeId: string) {
  const others = await prisma.reservation.findMany({
    where: { assignedTableId: tableId, date: dateISO, status: { not: "cancelled" }, id: { not: excludeId } },
    select: { time: true },
  });
  const a0 = hhmmToMin(time), a1 = a0 + dur;
  return others.some((r) => { const b0 = hhmmToMin(r.time), b1 = b0 + dur; return a0 < b1 && b0 < a1; });
}

/** Öffentliche Gäste-Reservierung mit autoritativer Verfügbarkeitsprüfung. */
export async function createReservation(input: CreateReservationInput) {
  const ok = await checkBookable(input.date, input.time, input.guestCount);
  if (!ok) {
    throw conflict("Der gewünschte Zeitpunkt ist nicht (mehr) verfügbar.", {
      date: input.date,
      time: input.time,
    });
  }

  // Reservierungsnummer ist unique — bei (sehr seltener) Kollision neu würfeln.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const created = await prisma.reservation.create({
        data: {
          reservationNumber: generateReservationNumber(),
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          date: input.date,
          time: input.time,
          guestCount: input.guestCount,
          notes: input.notes ?? "",
          status: "confirmed",
        },
      });
      emitChange({ entity: "reservation", action: "created", date: created.date });
      return created;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  throw conflict("Reservierungsnummer konnte nicht vergeben werden, bitte erneut versuchen.");
}

export interface ListFilter {
  date?: string;
  from?: string;
  to?: string;
  status?: string;
  q?: string;
}

export async function listReservations(f: ListFilter) {
  const where: Prisma.ReservationWhereInput = {};
  if (f.date) where.date = f.date;
  else if (f.from || f.to) where.date = { gte: f.from, lte: f.to };
  if (f.status) where.status = f.status;
  if (f.q) {
    where.OR = [
      { firstName: { contains: f.q } },
      { lastName: { contains: f.q } },
      { email: { contains: f.q } },
      { phone: { contains: f.q } },
      { reservationNumber: { contains: f.q } },
    ];
  }
  return prisma.reservation.findMany({
    where,
    orderBy: [{ date: "asc" }, { time: "asc" }],
    include: { assignedTable: true },
  });
}

export async function getReservation(id: string) {
  const r = await prisma.reservation.findUnique({ where: { id }, include: { assignedTable: true } });
  if (!r) throw notFound("Reservierung nicht gefunden");
  return r;
}

/** Öffentliche Statusabfrage per Nummer (für Gäste). */
export async function getByNumber(number: string) {
  const r = await prisma.reservation.findUnique({ where: { reservationNumber: number } });
  if (!r) throw notFound("Reservierung nicht gefunden");
  return r;
}

export async function updateReservation(id: string, input: UpdateReservationInput) {
  const existing = await getReservation(id);

  // Effektive Werte (geänderte oder bestehende) für die Prüfungen.
  const effDate = input.date ?? existing.date;
  const effTime = input.time ?? existing.time;
  const effGuests = input.guestCount ?? existing.guestCount;

  // Tischzuweisung prüfen (Existenz + Kapazität + Doppelbelegung).
  if (input.assignedTableId) {
    const table = await prisma.table.findUnique({ where: { id: input.assignedTableId } });
    if (!table) throw badRequest("Zugewiesener Tisch existiert nicht");
    if (table.capacity < effGuests) {
      throw conflict("Tischkapazität reicht für die Personenzahl nicht aus", {
        tableCapacity: table.capacity,
        guestCount: effGuests,
      });
    }
    const dur = (await getSettings()).seatingDurationMin;
    if (await tableHasConflict(input.assignedTableId, effDate, effTime, dur, id)) {
      throw conflict("Tisch ist zu dieser Zeit bereits belegt.", { table: table.name, time: effTime });
    }
  }

  const updated = await prisma.reservation.update({
    where: { id },
    data: {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.assignedTableId !== undefined ? { assignedTableId: input.assignedTableId } : {}),
      ...(input.date !== undefined ? { date: input.date } : {}),
      ...(input.time !== undefined ? { time: input.time } : {}),
      ...(input.guestCount !== undefined ? { guestCount: input.guestCount } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
    include: { assignedTable: true },
  });
  emitChange({ entity: "reservation", action: "updated", date: updated.date });
  return updated;
}

/** Stornieren = Status auf "cancelled" (gibt Kapazität frei, behält Historie). */
export async function cancelReservation(id: string) {
  await getReservation(id);
  const cancelled = await prisma.reservation.update({
    where: { id },
    data: { status: "cancelled", assignedTableId: null },
  });
  emitChange({ entity: "reservation", action: "cancelled", date: cancelled.date });
  return cancelled;
}
