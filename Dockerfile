# Ausbildungsportal als Container – Bauen und Starten: docker compose up -d --build

ARG NODE_VERSION=22

# ---------- 1. Oberfläche bauen ----------
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

# ---------- 2. Laufzeit ----------
FROM node:${NODE_VERSION}-alpine
# tzdata: Datumsangaben („heute“, Sicherungen) in deutscher Zeit
# su-exec: das Startskript wechselt damit von root zum Benutzer „node“
RUN apk add --no-cache tzdata su-exec
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATA_DIR=/app/data \
    TZ=Europe/Berlin
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY server ./server
COPY scripts ./scripts
COPY CHANGELOG.md tsconfig.json ./
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# Windows-Zeilenenden im Startskript entfernen, falls die Datei unter Windows bearbeitet wurde
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
    && mkdir -p /app/data \
    && chown -R node:node /app/data

# Kein USER hier: Das Startskript beginnt als root, richtet bei Bedarf die Rechte am Datenordner
# und startet die App dann als Benutzer „node“ (UID 1000). Die App selbst läuft nie als root.
EXPOSE 3000
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health > /dev/null || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node_modules/.bin/tsx", "server/index.ts", "--production"]
