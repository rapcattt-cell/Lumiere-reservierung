import { z } from "zod";

const dateISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss YYYY-MM-DD sein");
const timeHHMM = z.string().regex(/^\d{2}:\d{2}$/, "Uhrzeit muss HH:MM sein");

export const RESERVATION_STATUSES = ["pending", "confirmed", "seated", "cancelled"] as const;

/** Öffentliche Gäste-Reservierung. */
export const createReservationSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email(),
  phone: z.string().trim().min(4).max(40),
  date: dateISO,
  time: timeHHMM,
  guestCount: z.number().int().min(1).max(50),
  notes: z.string().trim().max(1000).optional().default(""),
  gdprConsent: z.literal(true, {
    errorMap: () => ({ message: "DSGVO-Zustimmung erforderlich" }),
  }),
});
export type CreateReservationInput = z.infer<typeof createReservationSchema>;

/** Admin-Update (Status, Tischzuweisung, Verschieben, Notiz). */
export const updateReservationSchema = z
  .object({
    status: z.enum(RESERVATION_STATUSES).optional(),
    assignedTableId: z.string().nullable().optional(),
    date: dateISO.optional(),
    time: timeHHMM.optional(),
    guestCount: z.number().int().min(1).max(50).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Keine Felder zum Aktualisieren" });
export type UpdateReservationInput = z.infer<typeof updateReservationSchema>;

/** Query-Filter für die Listenansicht. */
export const listReservationsQuerySchema = z.object({
  date: dateISO.optional(),
  from: dateISO.optional(),
  to: dateISO.optional(),
  status: z.enum(RESERVATION_STATUSES).optional(),
  q: z.string().trim().max(120).optional(),
});

export const availabilityQuerySchema = z.object({
  date: dateISO,
  party: z.coerce.number().int().min(1).max(50),
});
