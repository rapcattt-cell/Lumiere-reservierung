#!/usr/bin/env bash
# Startet das Reservierungssystem als EIN Prozess (API + Gastseite + Admin) auf Port 4000.
# Geeignet für manuellen Start und für launchd (läuft im Vordergrund).
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
export PATH="$HOME/.local/node/bin:$PATH"
cd "$DIR/backend"

# Abhängigkeiten sicherstellen
[ -d node_modules ] || npm install

# DB-Schema anwenden (idempotent)
npx prisma migrate deploy

# Bauen, falls noch kein Build vorhanden
[ -f dist/server.js ] || npm run build

# Erst-Seed nur, wenn noch keine Benutzer existieren (bestehende Daten bleiben unberührt)
if ! node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.count().then(n=>{p.\$disconnect();process.exit(n>0?0:1)})"; then
  npm run seed
fi

echo "▶ Reservierungssystem startet auf http://127.0.0.1:${PORT:-4000}/ (Admin: /admin/)"
exec node dist/server.js
