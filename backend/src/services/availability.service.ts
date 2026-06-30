import { prisma } from "../prisma";
import { availableSlots, isClosed, isSlotBookable, type ExistingReservation } from "../utils/availability";
import { getSettings, toAvailabilitySettings } from "./settings.service";

/** Aktive (kapazitätsrelevante) Reservierungen eines Tages: alles außer storniert. */
async function activeReservationsOn(dateISO: string): Promise<ExistingReservation[]> {
  const rows = await prisma.reservation.findMany({
    where: { date: dateISO, status: { not: "cancelled" } },
    select: { time: true, guestCount: true },
  });
  return rows;
}

export async function getAvailability(dateISO: string, party: number) {
  const settings = toAvailabilitySettings(await getSettings());
  if (isClosed(dateISO, settings)) {
    return { date: dateISO, party, closed: true, slots: [] as { time: string; remaining: number }[] };
  }
  const existing = await activeReservationsOn(dateISO);
  const slots = availableSlots(dateISO, party, existing, settings);
  return { date: dateISO, party, closed: false, slots };
}

/** Autoritative Prüfung beim Anlegen: ist (date,time) für party noch frei? */
export async function checkBookable(dateISO: string, time: string, party: number) {
  const settings = toAvailabilitySettings(await getSettings());
  const existing = await activeReservationsOn(dateISO);
  return isSlotBookable(dateISO, time, party, existing, settings);
}
