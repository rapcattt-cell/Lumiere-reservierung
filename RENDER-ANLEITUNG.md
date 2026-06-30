# Live über Render.com — Klick für Klick

Drei Teile: **(1)** Code zu GitHub, **(2)** Render einrichten, **(3)** danach.
Dauer: ~20–30 Minuten. Kosten: Render „Starter" ~7 $/Monat (nötig für dauerhaften
Speicher; die kostenlose Stufe verliert Daten und schläft ein).

---

## Teil 1 — Code zu GitHub bringen (ohne Terminal)

Render holt sich den Code aus einem GitHub-Repository.

1. **GitHub-Konto** erstellen: <https://github.com> → „Sign up" (kostenlos).
2. **GitHub Desktop** (App, kein Terminal nötig) laden & installieren:
   <https://desktop.github.com> → starten → mit dem GitHub-Konto anmelden.
3. In GitHub Desktop: **File → Add Local Repository** → den Ordner
   `…/Desktop/CLAUDE/reservierung` wählen → wenn es fragt, **„create a repository"**.
   - Name: z. B. `lumiere-reservierung` → **Create Repository**.
   - (Eine `.gitignore` liegt schon im Ordner — Passwörter/`node_modules` werden
     dadurch **nicht** hochgeladen.)
4. Unten links einen Text bei „Summary" eintippen (z. B. „erste Version") →
   **Commit to main**.
5. Oben **Publish repository** → **wichtig: „Keep this code private" anhaken** →
   **Publish Repository**.

✅ Dein Code liegt jetzt privat auf GitHub.

---

## Teil 2 — Render einrichten

1. Konto: <https://render.com> → „Get Started" → **mit GitHub anmelden**.
2. Oben **New +** → **Web Service**.
3. **Connect a repository** → Render fragt nach GitHub-Zugriff → erlauben →
   dein Repo `lumiere-reservierung` auswählen → **Connect**.
4. Einstellungen:
   - **Name:** `lumiere` (ergibt die Adresse `https://lumiere.onrender.com`)
   - **Region:** **Frankfurt (EU Central)** (nah & DSGVO-freundlich)
   - **Branch:** `main`
   - **Language / Runtime:** **Docker** (erkennt Render automatisch am Dockerfile)
   - **Instance Type:** **Starter** (~7 $/Mt — für dauerhaften Speicher nötig)
5. **Environment Variables** (Abschnitt „Environment Variables" → „Add"):
   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | `file:/data/prod.db` |
   | `JWT_ACCESS_SECRET` | *(Knopf „Generate" nutzen)* |
   | `JWT_REFRESH_SECRET` | *(Knopf „Generate" nutzen)* |
   | `SEED_ADMIN_EMAIL` | deine Chef-E-Mail |
   | `SEED_ADMIN_PASSWORD` | ein starkes Passwort |
   - **PORT nicht setzen** — das macht Render selbst, die App nutzt es automatisch.
   - **E-Mail-Versand** (optional, aber empfohlen) — siehe Abschnitt „E-Mail-Versand
     einrichten" weiter unten. Ohne diese Variablen läuft alles weiter, es werden nur
     keine Bestätigungs-Mails verschickt.
6. **Persistenter Speicher** (sehr wichtig, sonst sind Reservierungen nach Updates weg):
   Abschnitt **Disks** → **Add Disk**:
   - **Name:** `data`
   - **Mount Path:** `/data`
   - **Size:** `1 GB`
7. (Optional) **Health Check Path:** `/api/health`
8. **Create Web Service** → Render baut & startet (erster Build dauert ein paar Minuten;
   Fortschritt unter „Logs").

✅ Wenn oben „Live" steht, ist deine Adresse aktiv:

| Adresse | Für |
|---|---|
| `https://lumiere.onrender.com/` | **Gäste-Reservierung** |
| `https://lumiere.onrender.com/admin/` | **Dashboard** (Desktop) |
| `https://lumiere.onrender.com/m/` | **Mobile App** (zum Home-Bildschirm) |

---

## Teil 3 — Nach dem Go-Live

1. **Anmelden** im Dashboard mit `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.
2. **Einrichten:** Öffnungszeiten, Kapazität, Zeitraster (Mobile App `/m/` → Einstellungen),
   Tische im Tischplan anlegen.
3. **Testreservierung** auf `/` machen und im Dashboard kontrollieren.
4. **Gäste-Link** (`https://lumiere.onrender.com/`) auf Website / Google-Profil /
   Instagram setzen.

### Eigene Domain (optional, empfohlen)
Render → dein Service → **Settings → Custom Domains → Add** →
`reservierung.dein-restaurant.de` eingeben → Render zeigt einen **CNAME**-Eintrag,
den du beim Domain-Anbieter hinterlegst. HTTPS macht Render automatisch.

### Updates
Einfach in GitHub Desktop **Commit → Push** — Render baut & deployt automatisch neu.
Die Datenbank auf dem Disk bleibt erhalten.

### Backup
Render → Service → **Disks** → der Speicher kann sich über Render sichern lassen,
oder per `render`-CLI die Datei `/data/prod.db` herunterladen. Zusätzlich kannst du
über das Dashboard regelmäßig Reservierungen exportieren (Listenansicht).

---

## E-Mail-Versand einrichten (SMTP)

Pro Buchung verschickt das System zwei Mails: eine **Bestätigung an den Gast** und
(optional) eine **Benachrichtigung an das Restaurant**. Versendet wird über **SMTP** —
funktioniert mit jedem Postfach (IONOS, Strato, Gmail, Mailgun, Resend-SMTP …).

**So geht's:** Die SMTP-Zugangsdaten deines Mailpostfachs bereithalten und in Render
unter **Settings → Environment → Add** eintragen:

| Key | Beispiel | Bedeutung |
|---|---|---|
| `SMTP_HOST` | `smtp.ionos.de` | SMTP-Server des Anbieters |
| `SMTP_PORT` | `587` | `587` (STARTTLS) oder `465` (SSL) |
| `SMTP_SECURE` | `false` | `true` **nur** bei Port 465 |
| `SMTP_USER` | `reservierung@dein-restaurant.de` | Postfach-Benutzer |
| `SMTP_PASS` | *(Passwort)* | Postfach-Passwort |
| `MAIL_FROM` | `Lumière <reservierung@dein-restaurant.de>` | Absender (fällt sonst auf `SMTP_USER` zurück) |
| `RESTAURANT_NOTIFY_EMAIL` | `info@dein-restaurant.de` | wohin die Benachrichtigung geht (leer = keine) |
| `RESTAURANT_NAME` | `Lumière` | Name in der Mail (Standard: „Lumière") |

- **Ohne `SMTP_HOST`** ist der Versand inaktiv — Buchungen funktionieren weiter, es
  gehen nur keine Mails raus (im Log: „Versand übersprungen").
- Viele Anbieter verlangen, dass `MAIL_FROM` zum Postfach passt (sonst landet die Mail
  im Spam oder wird abgelehnt). Im Zweifel `MAIL_FROM = SMTP_USER`.
- Nach dem Speichern deployt Render neu; danach eine Test-Reservierung machen und im
  Render-Log auf „Gast-Bestätigung gesendet" prüfen.

---

## Sicherheit / Recht
- Admin-Passwort nach dem ersten Login ändern, Mitarbeiterkonten anlegen.
- Repo **privat** halten (keine Secrets im Code — Werte stehen nur in Render).
- Impressum + Datenschutzerklärung auf die Seite (Vorlagen DEHOGA/IHK); die
  DSGVO-Zustimmung im Formular ist bereits vorhanden.
