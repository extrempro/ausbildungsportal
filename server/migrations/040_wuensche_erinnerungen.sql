-- Einsatzwünsche: Ein Azubi wünscht sich einen Einsatz in einer Abteilung (aus den Stammdaten) für einen Zeitraum.
-- Der Ausbilder genehmigt (dann steht ein Einsatz im Plan) oder lehnt mit Begründung ab. Wochen über ihren Montag.
CREATE TABLE planungswunsch (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  azubi_id         INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
  abteilung_id     INTEGER REFERENCES abteilung(id) ON DELETE SET NULL,
  abteilung_name   TEXT NOT NULL,                 -- Name beim Wünschen, falls die Abteilung später gelöscht wird
  von              TEXT NOT NULL,
  bis              TEXT NOT NULL,
  grund            TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'genehmigt', 'abgelehnt', 'zurueckgezogen')),
  erstellt         TEXT NOT NULL,
  entschieden      TEXT,
  entschieden_von  INTEGER REFERENCES benutzer(id) ON DELETE SET NULL,
  entschieden_name TEXT NOT NULL DEFAULT '',
  begruendung      TEXT NOT NULL DEFAULT '',
  einsatz_id       INTEGER REFERENCES plan_eintrag(id) ON DELETE SET NULL
);
CREATE INDEX planungswunsch_azubi ON planungswunsch (azubi_id, status);

-- Erinnerungen von Ausbildungsbeauftragten und Ausbildern zu einem Azubi – privat: nur die Person, die sie angelegt hat, sieht sie.
-- Mit Bezug auf einen Einsatz: Datum = Beginn des Einsatzes minus tage_vorher (wandert mit, wenn der Einsatz verschoben wird).
CREATE TABLE erinnerung (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  benutzer_id  INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
  azubi_id     INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
  einsatz_id   INTEGER REFERENCES plan_eintrag(id) ON DELETE SET NULL,
  tage_vorher  INTEGER,
  datum        TEXT NOT NULL,                     -- festes Datum; mit Einsatz der zuletzt errechnete Tag
  text         TEXT NOT NULL,
  erledigt     TEXT,
  gemeldet     TEXT,                              -- an diesem Zeitpunkt in die Glocke gestellt (für dieses Datum)
  gemeldet_fuer TEXT,
  erstellt     TEXT NOT NULL
);
CREATE INDEX erinnerung_benutzer ON erinnerung (benutzer_id, erledigt);
