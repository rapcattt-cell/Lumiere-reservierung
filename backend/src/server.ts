import { createApp } from "./app";
import { config } from "./config";
import { prisma } from "./prisma";

async function main() {
  // Frühe DB-Prüfung — klarer Fehler statt erst beim ersten Request.
  await prisma.$queryRaw`SELECT 1`;

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`✅ API läuft auf http://127.0.0.1:${config.port}/api  (${config.env})`);
  });

  const shutdown = async (sig: string) => {
    console.log(`\n${sig} — fahre herunter …`);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch(async (e) => {
  console.error("Startfehler:", e);
  await prisma.$disconnect();
  process.exit(1);
});
