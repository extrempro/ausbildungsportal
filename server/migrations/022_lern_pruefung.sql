-- Lernmodul „Prüfung“: Ergebnisse der Übungssätze (pruefung/<id>.md).
-- Privat wie der übrige Lernstand – nur der Azubi selbst liest und schreibt (server/lernen.ts).
CREATE TABLE lern_pruefung (
  azubi_id      INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
  paket         TEXT NOT NULL,
  satz_id       TEXT NOT NULL,
  versuche      INTEGER NOT NULL DEFAULT 0,
  letzte_punkte REAL NOT NULL DEFAULT 0,     -- Teilpunkte möglich, z. B. 2,5 von 4 Feldern
  letzte_gesamt INTEGER NOT NULL DEFAULT 0,
  beste_prozent INTEGER NOT NULL DEFAULT 0,
  zuletzt       TEXT NOT NULL,
  PRIMARY KEY (azubi_id, paket, satz_id)
);
