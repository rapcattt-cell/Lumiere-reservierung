import { z } from "zod";

const windowSchema = z.object({
  open: z.number().int().min(0).max(1440),
  close: z.number().int().min(0).max(1440),
}).refine((w) => w.close > w.open, { message: "close muss größer als open sein" });

// Öffnungszeiten: Schlüssel "0".."6" (0=So), Wert = Liste von Fenstern.
const openingHoursSchema = z.record(
  z.string().regex(/^[0-6]$/),
  z.array(windowSchema),
);

export const updateSettingsSchema = z.object({
  openingHours: openingHoursSchema.optional(),
  slotIntervalMin: z.number().int().min(5).max(240).optional(),
  seatingDurationMin: z.number().int().min(15).max(600).optional(),
  lastSeatingBeforeCloseMin: z.number().int().min(0).max(240).optional(),
  maxConcurrentCapacity: z.number().int().min(1).max(10000).optional(),
  bookingWindowDays: z.number().int().min(1).max(365).optional(),
  minPartySize: z.number().int().min(1).max(50).optional(),
  maxPartySize: z.number().int().min(1).max(100).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: "Keine Felder zum Aktualisieren" });
