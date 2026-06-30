import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { config } from "./config";
import { router } from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/error";

// Verzeichnis mit dem statischen Frontend (Gastformular + /admin).
// dist/app.js → ../../ = reservierung/ ; src/app.ts (tsx) → ../../ = reservierung/
const FRONTEND_DIR = path.resolve(__dirname, "../../");

export function createApp() {
  const app = express();

  // Hinter einem Reverse-Proxy (Caddy/Nginx/Railway/Render) die echte Client-IP
  // aus X-Forwarded-For übernehmen — wichtig fürs Rate-Limit.
  if (config.env === "production") app.set("trust proxy", 1);

  // Helmet mit gelockerter CSP, damit Google-Fonts & Inline-Styles laufen
  // (das Frontend ist statisch, keine fremden Skript-Quellen).
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          // Schriften werden lokal selbst gehostet (fonts.css + /fonts) → kein Google nötig.
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          // NICHT erzwingen: würde auf http://localhost alle Ressourcen auf https
          // hochstufen und damit CSS/JS lokal unladbar machen.
          upgradeInsecureRequests: null,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(
    cors({
      origin(origin, cb) {
        // Entwicklung: jede lokale Herkunft erlauben (auch file:// → Origin "null"),
        // damit der Login funktioniert, egal wie das Frontend geöffnet wird.
        if (config.env !== "production") return cb(null, true);
        // Produktion: erlaubte Origins bekommen CORS-Header.
        if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
        // Unbekannte Origin: KEINEN Fehler werfen (würde 500 geben), sondern nur
        // keine CORS-Header setzen. Same-Origin (Frontend wird vom Backend selbst
        // ausgeliefert) funktioniert dadurch immer; echte Cross-Origin-Lesezugriffe
        // blockt der Browser weiterhin selbst.
        cb(null, false);
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "100kb" }));

  // 1) API
  app.use("/api", router);

  // 2) Statisches Frontend (Gastseite unter /, Admin unter /admin).
  //    backend/ wird NICHT ausgeliefert (enthält .env, Quellcode, DB).
  app.use((req, res, next) => {
    if (req.path === "/backend" || req.path.startsWith("/backend/")) return notFoundHandler(req, res, next);
    next();
  });
  app.use(
    express.static(FRONTEND_DIR, {
      index: ["index.html"],
      setHeaders: (res) => res.setHeader("Cache-Control", "no-cache"), // immer revalidieren → keine veralteten Dateien
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
