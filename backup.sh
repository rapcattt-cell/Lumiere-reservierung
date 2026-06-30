#!/usr/bin/env bash
# Konsistentes Backup der SQLite-Datenbank nach ./backups/.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$DIR/backend/prisma/dev.db"
OUT="$DIR/backups"
mkdir -p "$OUT"
TS="$(date +%Y%m%d-%H%M%S)"
DEST="$OUT/dev-$TS.db"

if [ ! -f "$SRC" ]; then echo "Keine Datenbank unter $SRC"; exit 1; fi

# .backup ist konsistent auch bei laufendem Server; sonst einfache Kopie.
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$SRC" ".backup '$DEST'"
else
  cp "$SRC" "$DEST"
fi
echo "Backup erstellt: $DEST"

# Alte Backups (älter als 30 Tage) aufräumen
find "$OUT" -name 'dev-*.db' -mtime +30 -delete 2>/dev/null || true
