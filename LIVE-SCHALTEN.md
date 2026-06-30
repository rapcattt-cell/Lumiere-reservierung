# Live gehen — öffentlich erreichbar, ohne lokales Hosting

Damit Gäste online reservieren und ihr die App von überall nutzen könnt, läuft das
System auf einem **Mietserver** statt auf dem Mac. Du brauchst dafür:

1. **Einen kleinen Server** (immer an) — ab ~4 €/Monat.
2. **Eine Domain** (z. B. `reservierung.dein-restaurant.de`) — ~1 €/Monat.
3. **HTTPS** — macht der Server automatisch (Caddy, kostenlos).
4. **Datenspeicher** — bleibt erhalten (ist eingerichtet).

> Was nur **du** machen kannst (Konto/Bezahlung darf ich nicht übernehmen):
> Server mieten, Domain kaufen, DNS einstellen. Alles andere ist vorbereitet —
> ich führe dich Schritt für Schritt durch.

---

## Empfohlener Weg: eigener Mini-Server + Docker (am günstigsten, dein Eigentum)

### A. Server & Domain besorgen (einmalig)
1. **Server mieten** — z. B. Hetzner Cloud „CX22" (Ubuntu 24.04, ~4,5 €/Monat) oder
   DigitalOcean/Netcup. Du bekommst eine **IP-Adresse** (z. B. `203.0.113.10`).
2. **Domain** — bei einem Anbieter (Namecheap, INWX, IONOS …) registrieren oder eine
   vorhandene Subdomain nutzen.
3. **DNS verbinden:** beim Domain-Anbieter einen **A-Record** anlegen:
   `reservierung.dein-restaurant.de` → deine Server-IP. (Wirkt nach einigen Minuten.)

### B. Auf dem Server installieren (einmalig, ~10 Min)
Per SSH auf den Server (`ssh root@deine-server-ip`), dann:

```bash
# Docker installieren
curl -fsSL https://get.docker.com | sh

# Projekt auf den Server holen (eine der beiden Varianten):
#  – per git, wenn du es auf GitHub hast:   git clone <dein-repo> lumiere && cd lumiere/reservierung
#  – oder den Ordner 'reservierung/' per scp/rsync hochladen und hineinwechseln.

# Konfiguration anlegen
cp backend/.env .env   # als Vorlage
nano .env              # siehe unten, was rein muss
```

In die `.env` (im Projekt-Stammordner, neben docker-compose.prod.yml):
```
DOMAIN=reservierung.dein-restaurant.de
JWT_ACCESS_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>
SEED_ADMIN_EMAIL=chef@dein-restaurant.de
SEED_ADMIN_PASSWORD=<starkes-passwort>
```
(Secrets erzeugen: `openssl rand -hex 32` zweimal ausführen.)

### C. Starten
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
Das war's. Nach ~1 Minute (Caddy holt das HTTPS-Zertifikat) ist alles live:

| Adresse | Für |
|---|---|
| `https://reservierung.dein-restaurant.de/` | **Gäste-Reservierung** |
| `https://reservierung.dein-restaurant.de/admin/` | **Dashboard** (Desktop) |
| `https://reservierung.dein-restaurant.de/m/` | **Mobile App** (zum Home-Bildschirm hinzufügen) |

### D. Erste Schritte nach dem Go-Live
- Im Dashboard mit `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` anmelden.
- **Passwörter ändern**, Mitarbeiterkonten anlegen.
- Unter **Einstellungen** (Mobile App `/m/` oder API): Öffnungszeiten, Kapazität,
  Zeitraster setzen. Tische im Tischplan anlegen.
- Den Gäste-Link `https://…/` auf eure **Website / Google-Profil / Instagram** setzen.

### Updates & Backup
```bash
# Update (neue Version):
git pull   # oder Dateien neu hochladen
docker compose -f docker-compose.prod.yml up -d --build

# Backup der Datenbank (läuft im Volume reservierung-data):
docker compose -f docker-compose.prod.yml exec app sh -c "cp prisma/dev.db /app/backend/prisma/backup-$(date +%F).db"
# besser regelmäßig per Cron + Kopie vom Server herunterladen.
```

---

## Bequemer Weg ohne Server-Verwaltung: Managed-Plattform

Wenn du dich **nicht** um einen Linux-Server kümmern willst — etwas teurer, dafür
fast nur Klicks:

- **Render.com** oder **Railway.app**: „New → Web Service → Docker", dieses Repo
  verbinden. HTTPS + Subdomain (`…onrender.com`) gibt's automatisch; eigene Domain
  anbindbar.
- **Wichtig:** ein **persistentes Volume/Disk** auf den Pfad
  `/app/backend/prisma` legen (sonst sind die Reservierungen nach jedem Neustart weg).
- Umgebungsvariablen setzen: `NODE_ENV=production`, `JWT_ACCESS_SECRET`,
  `JWT_REFRESH_SECRET`, `SEED_ADMIN_PASSWORD` (und optional `SEED_ADMIN_EMAIL`).

Für viele Standorte / sehr hohe Last später auf **PostgreSQL** umstellen
(siehe `BETRIEB.md` → „Auf PostgreSQL umstellen").

---

## Checkliste vor dem ersten echten Gast
- [ ] HTTPS funktioniert (`https://…` lädt mit Schloss-Symbol).
- [ ] Eigene, starke `JWT_*`-Secrets gesetzt.
- [ ] Admin-/Mitarbeiter-Passwörter geändert.
- [ ] Öffnungszeiten, Kapazität, Tische konfiguriert.
- [ ] Testreservierung auf `/` gemacht und im Dashboard gesehen.
- [ ] Backup-Routine eingerichtet.
- [ ] Gäste-Link veröffentlicht.

> Datenschutz/Impressum: Da ihr Gästedaten (Name, E-Mail, Telefon) erhebt, gehören
> auf die Reservierungsseite ein Impressum und eine Datenschutzerklärung
> (Vorlagen gibt es beim DEHOGA / IHK). Die nötigen Felder/Hinweise (DSGVO-Zustimmung)
> sind im Formular bereits vorhanden.
```
