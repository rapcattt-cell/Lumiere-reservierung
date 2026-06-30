import { z } from "zod";

export const SHAPES = ["round", "square", "rect"] as const;

export const createTableSchema = z.object({
  name: z.string().trim().min(1).max(60),
  capacity: z.number().int().min(1).max(50),
  positionX: z.number().optional().default(0),
  positionY: z.number().optional().default(0),
  shape: z.enum(SHAPES).optional().default("square"),
  area: z.string().trim().max(60).optional().default("Restaurant"),
  status: z.enum(["available", "inactive"]).optional().default("available"),
});

export const updateTableSchema = createTableSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: "Keine Felder zum Aktualisieren" },
);
