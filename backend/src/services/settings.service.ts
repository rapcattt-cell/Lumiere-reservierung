import { prisma } from "../prisma";
import type { AvailabilitySettings, OpeningHours } from "../utils/availability";

/** Liest die Singleton-Einstellungen (id="default"). Wirft, falls nicht geseedet. */
export async function getSettings() {
  const s = await prisma.restaurantSettings.findUnique({ where: { id: "default" } });
  if (!s) throw new Error("RestaurantSettings nicht initialisiert — bitte seed ausführen.");
  return s;
}

/** In die Form bringen, die die Verfügbarkeits-Engine erwartet. */
export function toAvailabilitySettings(s: {
  openingHours: unknown;
  slotIntervalMin: number;
  seatingDurationMin: number;
  lastSeatingBeforeCloseMin: number;
  maxConcurrentCapacity: number;
  bookingWindowDays: number;
  minPartySize: number;
  maxPartySize: number;
}): AvailabilitySettings {
  return {
    openingHours: s.openingHours as OpeningHours,
    slotIntervalMin: s.slotIntervalMin,
    seatingDurationMin: s.seatingDurationMin,
    lastSeatingBeforeCloseMin: s.lastSeatingBeforeCloseMin,
    maxConcurrentCapacity: s.maxConcurrentCapacity,
    bookingWindowDays: s.bookingWindowDays,
    minPartySize: s.minPartySize,
    maxPartySize: s.maxPartySize,
  };
}

export async function updateSettings(data: Record<string, unknown>) {
  return prisma.restaurantSettings.update({ where: { id: "default" }, data });
}
