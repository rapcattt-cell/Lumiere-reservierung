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
};
