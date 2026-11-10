#!/bin/sh
# Startskript des Containers: sorgt dafür, dass die App in den Datenordner schreiben kann,
# und startet sie dann als Benutzer 'node' (UID 1000) – nie als root.
set -e

DATA_DIR="${DATA_DIR:-/app/data}"

if [ "$(id -u)" = "0" ]; then
  # Docker legt einen fehlenden Ordner ./data auf dem Host als root an. Deshalb hier einmal die Rechte
  # richten – nur wenn nötig, damit der Start bei vielen Dateien nicht jedes Mal dauert.
  mkdir -p "$DATA_DIR"
  if [ -n "$(find "$DATA_DIR" ! -user node 2>/dev/null | head -n 1)" ]; then
    if ! chown -R node:node "$DATA_DIR" 2>/dev/null; then
      echo "FEHLER: Die Rechte am Datenordner $DATA_DIR lassen sich nicht anpassen." >&2
      echo "Auf dem Host ausführen:  sudo chown -R 1000:1000 ./data" >&2
      exit 1
    fi
    echo "Rechte am Datenordner $DATA_DIR an den Benutzer 'node' (UID 1000) angepasst."
  fi
  exec su-exec node "$@"
fi

# Container wurde mit einem eigenen Benutzer gestartet (user: in der Compose-Datei)
if ! mkdir -p "$DATA_DIR" 2>/dev/null || ! touch "$DATA_DIR/.schreibtest" 2>/dev/null; then
  echo "FEHLER: In den Datenordner $DATA_DIR kann nicht geschrieben werden." >&2
  echo "Der Container läuft als Benutzer $(id -u). Auf dem Host ausführen:  sudo chown -R $(id -u):$(id -g) ./data" >&2
  exit 1
fi
rm -f "$DATA_DIR/.schreibtest"

exec "$@"
