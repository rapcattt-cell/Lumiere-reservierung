# Reservierungssystem — Betriebsanleitung

Deine **selbst-gehostete Alternative zu Quandoo/OpenTable**: Gäste reservieren
online, du verwaltest alles im Dashboard. Läuft als **ein einziger Prozess**
(API + Gastseite + Admin) — keine laufenden Gebühren, deine Daten bleiben bei dir.

```
http://127.0.0.1:4000/         →  Gäste-Reservierung
http://127.0.0.1:4000/admin/   →  Admin-Dashboard (Login)
```
Demo-Login: `admin@lumiere.test` / `admin1234` · `staff@lumiere.test` / `staff1234`
**→ Passwörter nach dem ersten Login ändern bzw. eigene Konten anlegen.**

---

## 1. Schnellstart (lokal, dein Mac)

```bash
cd ~/Desktop/CLAUDE/reservierung
./start.sh          # baut, migriert, seedet beim ersten Mal, startet auf :4000
```
Stoppen: `./stop.sh`

Node liegt unter `~/.local/node/bin` (wurde lokal installiert). `start.sh` setzt den
Pfad selbst.

## 2. Automatisch starten (autark, beim Anmelden)

Damit der Server immer läuft (Start beim Login, Neustart nach Absturz):

```bash
cp ~/Desktop/CLAUDE/reservierung/deploy/com.lumiere.reservierung.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.lumiere.reservierung.plist
```
Logs: `/tmp/lumiere-reservierung.log` (und `.err`).

Wieder abschalten:
```bash
launchctl unload ~/Library/LaunchAgents/com.lumiere.reservierung.plist
rm ~/Library/LaunchAgents/com.lumiere.reservierung.plist
```

## 📱 Mobile-App (Verwaltung am Handy)

Eine **installierbare Touch-App** für Service/Verwaltung — Reservierungen ansehen,
**Tische per Tippen zuweisen** und Einstellungen ändern. Kein App-Store nötig.

```
http://<server>:4000/m/
```

**Aufs Handy installieren:**
1. Mac und Handy im **selben WLAN**. Lokale IP des Macs herausfinden:
   `ipconfig getifaddr en0` (z. B. `192.168.1.20`).
2. Am Handy im Browser öffnen: `http://192.168.1.20:4000/m/`
3. **iPhone (Safari):** Teilen-Symbol → „Zum Home-Bildschirm".
   **Android (Chrome):** Menü → „App installieren" / „Zum Startbildschirm".
4. Die App liegt dann als Icon auf dem Home-Bildschirm und startet im Vollbild.

> Für Zugriff von unterwegs (außerhalb des WLANs) den Server wie in Punkt 5
> (Docker) hinter einer Domain mit HTTPS betreiben.

## 3. Datensicherung

```bash
./backup.sh         # konsistente Kopie nach ./backups/dev-<zeit>.db
```
Automatisch täglich z. B. per `cron` oder einem zweiten LaunchAgent. Die ganze
Datenbank ist **eine Datei** (`backend/prisma/dev.db`) — einfach mitsichern.

Wiederherstellen: Server stoppen, gewünschte Backup-Datei nach
`backend/prisma/dev.db` kopieren, Server starten.

## 4. Aktualisieren

```bash
./stop.sh
cd backend && npm install && npm run build && npx prisma migrate deploy
cd .. && ./start.sh
```

---

## 5. Auf einem Server hosten (Docker, ein paar €/Monat)

Auf jedem kleinen VPS mit Docker:

```bash
export JWT_ACCESS_SECRET=$(openssl rand -hex 32)
export JWT_REFRESH_SECRET=$(openssl rand -hex 32)
docker compose up -d --build
docker compose exec app npm run seed   # einmalig: Einstellungen, Admin, Tische
```
Die Daten liegen im Volume `reservierung-data` und überleben Updates.
Davor eine Domain + HTTPS (z. B. Caddy/Traefik/Nginx als Reverse-Proxy auf Port 4000).

## 6. Für mehrere Standorte / hohe Last: PostgreSQL

SQLite reicht für ein Restaurant locker. Für viele Standorte:

1. `backend/prisma/schema.prisma`: `provider = "postgresql"`.
2. `DATABASE_URL` auf den Postgres-String setzen.
3. `npx prisma migrate dev` (frische Migrationen) bzw. `migrate deploy` in Prod.

Der restliche Code bleibt unverändert (Prisma abstrahiert die DB).

---

## 7. Sicherheits-Checkliste vor dem echten Einsatz

- [ ] **JWT-Secrets** neu erzeugen (`openssl rand -hex 32`) und in `.env`/Umgebung setzen.
- [ ] **Seed-Passwörter ändern**, eigene Mitarbeiterkonten anlegen.
- [ ] `SEED_DEMO=false` (keine Demo-Buchungen im echten Betrieb).
- [ ] `NODE_ENV=production` (striktes CORS; Frontend wird ohnehin gleich-Origin geliefert).
- [ ] HTTPS davor (Reverse-Proxy), niemals Klartext-HTTP öffentlich.
- [ ] `.env` nicht ins öffentliche Git (steht in `.gitignore`; `backend/` wird vom
      Server NICHT ausgeliefert — geprüft).
- [ ] Regelmäßiges Backup aktiv (Punkt 3).

Bereits eingebaut: bcrypt-Passwörter, JWT + Refresh-Rotation, Rollen (ADMIN/STAFF),
Eingabevalidierung (zod), Helmet inkl. CSP, Rate-Limit (Buchung 10/Min, Login 20/Min),
serverseitig verbindliche Verfügbarkeits- und Doppelbelegungsprüfung.

---

## 8. Was kann das System? (Funktionsüberblick)

- **Gäste:** Online-Reservierung mit Live-Verfügbarkeit (Öffnungszeiten, Kapazität,
  belegte Slots), Sofortbestätigung mit Reservierungsnummer, DE/EN, Dark/Light, mobil.
- **Dashboard:** Tag/Woche/Liste, Suche & Filter, Statistik (Auslastung, Gäste/Tag,
  beliebte Zeiten), Reservierungen annehmen/verschieben/stornieren, Notizen,
  Gast per E-Mail/Telefon kontaktieren.
- **Tischplan:** Tische grafisch anlegen/verschieben/bearbeiten, Reservierungen per
  Drag&Drop zuweisen — mit Kapazitäts- und Doppelbelegungsprüfung.
- **Echtzeit:** Das Dashboard aktualisiert sich automatisch bei neuen/geänderten
  Buchungen (Server-Sent Events).
- **Mobile-App (`/m/`):** installierbare Touch-App (PWA) für Service/Verwaltung —
  Reservierungen verwalten, Tische **per Tippen** zuweisen, Einstellungen ändern.
  Installation siehe Abschnitt „📱 Mobile-App". Zusätzlich ist das Desktop-Dashboard
  responsiv und am Handy nutzbar.

## 9. Kosten

Quandoo/OpenTable berechnen oft pro Gast/Reservierung oder eine Monatsgebühr.
Dieses System: **einmalig einrichten, danach nur die Server-Kosten** (lokal 0 €,
auf einem kleinen VPS wenige €/Monat). Keine Provisionen, keine Gästedaten bei Dritten.

## 10. Problemlösung

- **Dashboard lädt leer / alte Version:** Browser-Cache. Safari: **`Cmd+Option+R`**
  (nicht `Cmd+Shift+R`). Der Server schickt inzwischen `Cache-Control: no-cache`,
  das Problem sollte nicht mehr auftreten.
- **„Server nicht erreichbar":** läuft der Prozess? `./start.sh` bzw. launchd-Log prüfen.
- **Port 4000 belegt:** `./stop.sh` oder `lsof -ti :4000 | xargs kill -9`.
- **Technische Details / API-Endpunkte:** siehe `backend/README.md`.
```
