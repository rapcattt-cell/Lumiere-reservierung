# Reservierungssystem — ein Container, der API + Gastseite + Admin ausliefert.
# Build-Kontext = dieser Ordner (reservierung/).

FROM node:24-alpine

WORKDIR /app

# Frontend (wird vom Backend statisch ausgeliefert)
COPY index.html styles.css app.js api.js data.js impressum.html datenschutz.html ./
COPY admin ./admin
COPY m ./m

# Backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# Beim Start: Schema anwenden, Grundkonfiguration sicherstellen (idempotent:
# Einstellungen/Admin werden ge-upsertet, Tische nur wenn leer, Demo nur bei
# SEED_DEMO=true), dann Server starten.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run seed && node dist/server.js"]
