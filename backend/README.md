# Reservierungssystem — Backend (REST-API)

Express + TypeScript + Prisma. Lokal mit **SQLite** (dateibasiert, kein DB-Server),
für Produktion auf **PostgreSQL** umstellbar (Einzeiler im Prisma-Schema).

Liefert die API für die Gäste-Reservierung **und** das spätere Admin-Dashboard:
Verfügbarkeit, Reservierungen, Tische, Einstellungen, Statistiken, Auth mit
JWT + Refresh-Token und Rollenrechten (ADMIN / STAFF).

---

## Voraussetzung: Node

In dieser Umgebung wurde Node lokal nach `~/.local/node` installiert. Vor jedem
Befehl auf den PATH legen (oder dauerhaft in `~/.zshrc` eintragen):

```bash
export PATH="$HOME/.local/node/bin:$PATH"
node -v   # v24.x
```

## Setup & Start

```bash
cd reservierung/backend
npm install                       # einmalig
npx prisma migrate deploy         # DB-Schema anwenden (SQLite: prisma/dev.db)
npm run seed                      # Demo-Daten + Admin/Staff-Konten
npm run dev                       # Dev-Server (Hot-Reload) auf :4000
# ODER produktionsnah:
npm run build && npm start
```

API-Basis: `http://127.0.0.1:4000/api` · Healthcheck: `GET /api/health`

**Seed-Logins (nur Entwicklung):**
`admin@lumiere.test / admin1234` (ADMIN) · `staff@lumiere.test / staff1234` (STAFF)

## NPM-Skripte

| Skript | Zweck |
|---|---|
| `npm run dev` | Dev-Server mit Hot-Reload (tsx) |
| `npm run build` | TypeScript → `dist/` |
| `npm start` | Kompilierten Server starten |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run seed` | Demo-Daten/Seed |
| `npm run migrate` | Neue Migration im Dev-Modus |

---

## Endpunkte

> `🔓` öffentlich · `Auth` = Token nötig · **STAFF** = Staff & Admin · **ADMIN** = nur Admin

### Auth
| Methode | Pfad | Zugriff | Beschreibung |
|---|---|---|---|
| POST | `/api/auth/login` | 🔓 | Login → `{ accessToken, refreshToken, user }` |
| POST | `/api/auth/refresh` | 🔓 | Refresh-Token → neues Token-Paar (Rotation) |
| POST | `/api/auth/logout` | Auth | Refresh-Sitzung invalidieren |
| GET | `/api/auth/me` | Auth | Aktuelles Benutzerprofil |

### Öffentlich (Gast)
| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/api/settings/public` | Öffnungszeiten, Buchungsfenster, Personen-Limits |
| GET | `/api/availability?date=YYYY-MM-DD&party=N` | Verfügbare Slots (Engine-geprüft) |
| POST | `/api/reservations` | Reservierung anlegen (autoritative Verfügbarkeitsprüfung, DSGVO-Pflicht) |
| GET | `/api/reservations/by-number/:number` | Eigene Reservierung per Nummer abfragen |

### Reservierungen verwalten
| Methode | Pfad | Zugriff | Beschreibung |
|---|---|---|---|
| GET | `/api/reservations?date=&from=&to=&status=&q=` | STAFF | Liste mit Filtern/Suche |
| GET | `/api/reservations/:id` | STAFF | Einzelne Reservierung |
| PATCH | `/api/reservations/:id` | STAFF | Status / Tisch / verschieben / Notiz |
| DELETE | `/api/reservations/:id` | STAFF | Stornieren (Status `cancelled`, behält Historie) |

### Tische
| Methode | Pfad | Zugriff |
|---|---|---|
| GET | `/api/tables` · `/api/tables/:id` | STAFF |
| POST | `/api/tables` | ADMIN |
| PATCH | `/api/tables/:id` | ADMIN |
| DELETE | `/api/tables/:id` | ADMIN |

### Einstellungen & Statistik
| Methode | Pfad | Zugriff | Beschreibung |
|---|---|---|---|
| GET | `/api/settings` | ADMIN | Vollständige Restaurant-Einstellungen |
| PUT | `/api/settings` | ADMIN | Öffnungszeiten/Kapazität/Intervalle ändern |
| GET | `/api/stats/overview?from=&to=` | STAFF | Auslastung, Reservierungen/Tag, beliebte Zeiten |

### Beispiel — Reservierung anlegen
```bash
curl -X POST http://127.0.0.1:4000/api/reservations \
  -H 'Content-Type: application/json' \
  -d '{"firstName":"Max","lastName":"Mustermann","email":"max@example.com",
       "phone":"+49170...","date":"2026-06-19","time":"21:00",
       "guestCount":2,"gdprConsent":true}'
# 201 → { "reservationNumber":"LUM-XXXXXX", "status":"confirmed", ... }
# 409 → Slot nicht (mehr) verfügbar   |  400 → Validierung (z. B. DSGVO fehlt)
```

### Beispiel — Admin-Login & geschützter Abruf
```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@lumiere.test","password":"admin1234"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')
curl http://127.0.0.1:4000/api/reservations?date=2026-06-19 \
  -H "Authorization: Bearer $TOKEN"
```

---

## Architektur

```
src/
  config.ts            Env-Konfiguration
  prisma.ts            PrismaClient-Singleton
  app.ts               Express-App (helmet, cors, json, Router, Error-Handler)
  server.ts            Entrypoint (DB-Check, Listen, Graceful Shutdown)
  routes/index.ts      zentrale Routen-Definition + Middleware-Verdrahtung
  middleware/          auth (JWT + Rollen), validate (zod), error, asyncHandler
  dtos/                zod-Schemas (Validierung + Typen)
  controllers/         dünne HTTP-Adapter
  services/            Geschäftslogik (reservation, table, settings, auth, stats, availability)
  utils/               availability-Engine, Reservierungsnummer, HttpError
prisma/
  schema.prisma        Datenmodell (User, RestaurantSettings, Table, Reservation)
  seed.ts              Demo-Daten + Admin/Staff
```

**Verfügbarkeits-Engine** (`utils/availability.ts`) ist serverseitig **maßgeblich**:
sie berücksichtigt Öffnungszeiten je Wochentag (inkl. Ruhetag/Lunch/Dinner),
Kapazität, überlappende Belegungen (Sitzdauer) und Vorlaufzeit — dieselbe Logik
wie im Frontend, hier aber autoritativ (auch beim Anlegen erneut geprüft).

---

## Auf PostgreSQL umstellen (Produktion)

1. In `prisma/schema.prisma`: `provider = "postgresql"`.
2. `DATABASE_URL` auf den Postgres-Connection-String setzen.
3. `npx prisma migrate dev` (frische Migrationen für Postgres).
4. Secrets in `.env` ersetzen (`JWT_*`), `.env` aus der Versionskontrolle nehmen.

## Sicherheit (Status)

- ✅ Passwörter mit bcrypt gehasht, Refresh-Token serverseitig als Hash, Rotation
- ✅ JWT Access (kurzlebig) + Refresh getrennt, Rollenprüfung pro Route
- ✅ Eingaben via zod validiert, `helmet`, CORS-Allowlist, JSON-Bodylimit
- ⏳ Für Produktion offen: Rate-Limiting, E-Mail-Versand (Bestätigungen),
  Refresh-Token in HttpOnly-Cookie statt JSON, Audit-Log
