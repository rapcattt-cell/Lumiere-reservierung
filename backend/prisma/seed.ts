import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();
const H = (h: number, m = 0) => h * 60 + m;

function isoOffset(days: number): string {
  // Lokales Datum (NICHT toISOString/UTC — sonst Off-by-one je nach Zeitzone).
  const d = new Date();
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function main() {
  // 1) Einstellungen (Singleton) ------------------------------------------------
  const openingHours = {
    "0": [{ open: H(12), close: H(22) }],
    "1": [],
    "2": [{ open: H(11, 30), close: H(14, 30) }, { open: H(17, 30), close: H(23) }],
    "3": [{ open: H(11, 30), close: H(14, 30) }, { open: H(17, 30), close: H(23) }],
    "4": [{ open: H(11, 30), close: H(14, 30) }, { open: H(17, 30), close: H(23) }],
    "5": [{ open: H(11, 30), close: H(14, 30) }, { open: H(17, 30), close: H(23, 30) }],
    "6": [{ open: H(17, 30), close: H(23, 30) }],
  };
  await prisma.restaurantSettings.upsert({
    where: { id: "default" },
    update: { openingHours },
    create: {
      id: "default",
      openingHours,
      slotIntervalMin: 30,
      seatingDurationMin: 120,
      lastSeatingBeforeCloseMin: 30,
      maxConcurrentCapacity: 40,
      bookingWindowDays: 60,
      minPartySize: 1,
      maxPartySize: 12,
    },
  });

  // 2) Benutzer (Admin + Staff) -------------------------------------------------
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@lumiere.test";
  const adminPw = process.env.SEED_ADMIN_PASSWORD ?? "admin1234";
  const staffEmail = process.env.SEED_STAFF_EMAIL ?? "staff@lumiere.test";
  const staffPw = process.env.SEED_STAFF_PASSWORD ?? "staff1234";

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { name: "Admin", email: adminEmail, role: "ADMIN", passwordHash: await bcrypt.hash(adminPw, 10) },
  });
  await prisma.user.upsert({
    where: { email: staffEmail },
    update: {},
    create: { name: "Service", email: staffEmail, role: "STAFF", passwordHash: await bcrypt.hash(staffPw, 10) },
  });

  // 3) Tische (nur anlegen, wenn noch keine vorhanden) --------------------------
  if ((await prisma.table.count()) === 0) {
    await prisma.table.createMany({
      data: [
        { name: "Tisch 1", capacity: 2, shape: "round", area: "Restaurant", positionX: 60, positionY: 60 },
        { name: "Tisch 2", capacity: 2, shape: "round", area: "Restaurant", positionX: 160, positionY: 60 },
        { name: "Tisch 3", capacity: 4, shape: "square", area: "Restaurant", positionX: 60, positionY: 180 },
        { name: "Tisch 4", capacity: 4, shape: "square", area: "Restaurant", positionX: 200, positionY: 180 },
        { name: "Tisch 5", capacity: 6, shape: "rect", area: "Restaurant", positionX: 60, positionY: 300 },
        { name: "Tisch 6", capacity: 6, shape: "rect", area: "Restaurant", positionX: 220, positionY: 300 },
        { name: "Terrasse 1", capacity: 4, shape: "square", area: "Terrasse", positionX: 60, positionY: 60 },
        { name: "Terrasse 2", capacity: 8, shape: "rect", area: "Terrasse", positionX: 200, positionY: 60 },
      ],
    });
  }

  // 4) Demo-Reservierungen — nur mit SEED_DEMO=true (im echten Betrieb leer lassen)
  if (process.env.SEED_DEMO === "true" && (await prisma.reservation.count()) === 0) {
    const demo = [
      { date: isoOffset(0), time: "19:00", guestCount: 10 },
      { date: isoOffset(0), time: "19:30", guestCount: 12 },
      { date: isoOffset(0), time: "20:00", guestCount: 12 },
      { date: isoOffset(0), time: "20:30", guestCount: 8 },
      { date: isoOffset(0), time: "18:30", guestCount: 4 },
      { date: isoOffset(1), time: "19:30", guestCount: 6 },
      { date: isoOffset(1), time: "20:00", guestCount: 4 },
      { date: isoOffset(1), time: "12:30", guestCount: 8 },
      { date: isoOffset(2), time: "19:00", guestCount: 4 },
    ];
    let n = 1;
    for (const d of demo) {
      await prisma.reservation.create({
        data: {
          reservationNumber: `SEED-${String(n).padStart(4, "0")}`,
          firstName: "Demo",
          lastName: `Gast ${n}`,
          email: `demo${n}@example.test`,
          phone: "+49 89 000000",
          status: "confirmed",
          ...d,
        },
      });
      n++;
    }
  }

  console.log("✅ Seed abgeschlossen.");
  console.log(`   Admin: ${adminEmail} / ${adminPw}`);
  console.log(`   Staff: ${staffEmail} / ${staffPw}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
