# Reservierungssystem — selbst-gehostete Quandoo-Alternative

Online-Tischreservierung für Restaurants: Gäste buchen auf der Website, das Team
verwaltet alles im Dashboard. **Ein Prozess** liefert API, Gastseite und Admin aus —
keine laufenden Gebühren, deine Daten bleiben bei dir.

```
http://127.0.0.1:4000/         Gäste-Reservierung
http://127.0.0.1:4000/admin/   Admin-Dashboard (Desktop)
http://127.0.0.1:4000/m/        Mobile Verwalter-App (installierbare PWA)
```

## Schnellstart
```bash
./start.sh      # baut, migriert, seedet beim ersten Mal, startet auf :4000
./stop.sh
```
Demo-Login: `admin@lumiere.test` / `admin1234`

👉 **Live über Render.com (Klick-Anleitung): [RENDER-ANLEITUNG.md](RENDER-ANLEITUNG.md)**
👉 **Live gehen – alle Wege (VPS, Docker, Domain): [LIVE-SCHALTEN.md](LIVE-SCHALTEN.md)**
👉 **Vollständige Anleitung (Autostart, Backup, Docker, Sicherheit, Kosten): [BETRIEB.md](BETRIEB.md)**
👉 **API-Doku & Architektur: [backend/README.md](backend/README.md)**

## Aufbau
```
index.html, app.js, api.js, data.js, styles.css   Gäste-Reservierung (statisch)
admin/                                             Admin-Dashboard (statisch)
backend/                                           API (Express + TypeScript + Prisma + SQLite)
start.sh · stop.sh · backup.sh                     Betrieb
Dockerfile · docker-compose.yml                    Deployment
deploy/com.lumiere.reservierung.plist              Autostart (launchd)
BETRIEB.md                                          Betriebsanleitung
```

## Funktionen
- **Gäste:** Live-Verfügbarkeit (Öffnungszeiten, Kapazität, belegte Slots), Sofort­bestätigung,
  DE/EN, Dark/Light, mobile-first.
- **Dashboard:** Tag/Woche/Liste, Suche/Filter, Statistik, annehmen/verschieben/stornieren,
  Gast kontaktieren.
- **Tischplan:** Tische grafisch anordnen, Reservierungen per Drag&Drop zuweisen
  (Kapazitäts- + Doppelbelegungsprüfung).
- **Echtzeit:** Dashboard aktualisiert sich automatisch (Server-Sent Events).
- **Sicherheit:** JWT + Refresh, Rollen, bcrypt, Validierung, Helmet/CSP, Rate-Limit.

> Hinweis: eigenständiges Projekt im Unterordner `reservierung/`. Die statische
> Taklamakan-Website im übergeordneten Ordner ist davon unberührt.
