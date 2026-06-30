import { PrismaClient } from "@prisma/client";

// Einzelne PrismaClient-Instanz für die gesamte App.
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});
