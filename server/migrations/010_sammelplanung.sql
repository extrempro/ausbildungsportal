-- Sammelplanung zurücknehmen: Jeder Lauf bekommt eine Nummer; die dabei angelegten Plan-Einträge und Aktivitäten tragen sie.
-- So lassen sich die Einträge eines Laufs wieder entfernen, solange sie seitdem niemand geändert hat.
-- Läufe werden nach 30 Tagen vergessen (die Einträge bleiben, lassen sich dann aber nur noch einzeln löschen).
CREATE TABLE sammelplanung (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  zeit          TEXT NOT NULL,                 -- gilt auch als „geaendert“ der angelegten Einträge
  benutzer_id   INTEGER REFERENCES benutzer(id) ON DELETE SET NULL,
  benutzer_name TEXT NOT NULL,
  titel         TEXT NOT NULL,
  azubis        INTEGER NOT NULL DEFAULT 0,
  eintraege     INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE plan_eintrag ADD COLUMN sammel_id INTEGER REFERENCES sammelplanung(id) ON DELETE SET NULL;
ALTER TABLE aktivitaet ADD COLUMN sammel_id INTEGER;
CREATE INDEX plan_eintrag_sammel ON plan_eintrag (sammel_id);
