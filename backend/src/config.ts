import dotenv from "dotenv";
dotenv.config();

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Fehlende Umgebungsvariable: ${name}`);
  return v;
}

export const config = {
  env: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  jwt: {
    accessSecret: req("JWT_ACCESS_SECRET", "dev-access-secret-change-me"),
    refreshSecret: req("JWT_REFRESH_SECRET", "dev-refresh-secret-change-me"),
    accessTtl: process.env.ACCESS_TOKEN_TTL ?? "15m",
    refreshTtl: process.env.REFRESH_TOKEN_TTL ?? "7d",
  },
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://127.0.0.1:8200")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  mail: {
    // Versand ist aktiv, sobald ein SMTP-Host gesetzt ist (und nicht explizit deaktiviert).
    // Ohne Konfiguration läuft alles weiter — der Versand wird einfach übersprungen.
    enabled: process.env.MAIL_ENABLED !== "false" && Boolean(process.env.SMTP_HOST),
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    // true für Port 465 (implizites TLS), false für 587 (STARTTLS).
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    // Absenderadresse; fällt auf den SMTP-Benutzer zurück.
    from: process.env.MAIL_FROM ?? process.env.SMTP_USER ?? "",
    // Postfach des Restaurants für die Benachrichtigung pro Buchung (leer = keine).
    notifyTo: process.env.RESTAURANT_NOTIFY_EMAIL ?? "",
    restaurantName: process.env.RESTAURANT_NAME ?? "Lumière",
  },
};
