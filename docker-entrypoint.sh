#!/bin/sh
# Startskript des Containers: prüft den Datenordner und startet dann die App.
set -e

DATA_DIR="${DATA_DIR:-/app/data}"

if ! mkdir -p "$DATA_DIR" 2>/dev/null || ! touch "$DATA_DIR/.schreibtest" 2>/dev/null; then
  echo "FEHLER: In den Datenordner $DATA_DIR kann nicht geschrieben werden." >&2
  echo "Die App läuft im Container als Benutzer 'node' (UID 1000)." >&2
  echo "Unter Linux auf dem Host:  sudo chown -R 1000:1000 ./data" >&2
  exit 1
fi
rm -f "$DATA_DIR/.schreibtest"

exec "$@"
