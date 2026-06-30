import { prisma } from "../prisma";
import { notFound } from "../utils/httpError";
import { emitChange } from "../events";

export function listTables() {
  return prisma.table.findMany({ orderBy: { name: "asc" } });
}

export async function getTable(id: string) {
  const t = await prisma.table.findUnique({ where: { id } });
  if (!t) throw notFound("Tisch nicht gefunden");
  return t;
}

export async function createTable(data: any) {
  const t = await prisma.table.create({ data });
  emitChange({ entity: "table", action: "created" });
  return t;
}

export async function updateTable(id: string, data: any) {
  await getTable(id);
  const t = await prisma.table.update({ where: { id }, data });
  emitChange({ entity: "table", action: "updated" });
  return t;
}

export async function deleteTable(id: string) {
  await getTable(id);
  // Zuweisungen lösen, damit kein FK-Konflikt entsteht.
  await prisma.reservation.updateMany({ where: { assignedTableId: id }, data: { assignedTableId: null } });
  const t = await prisma.table.delete({ where: { id } });
  emitChange({ entity: "table", action: "deleted" });
  return t;
}
