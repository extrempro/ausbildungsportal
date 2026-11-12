-- Firmentermine: ganztägige Termine des Betriebs, die für alle gelten (z. B. Betriebsschließung, Betriebsversammlung).
-- Sie stehen zur Übersicht im Ausbildungsplan und im Jahreskalender – nicht im Berichtsheft und ohne Folgen für den Urlaub.
CREATE TABLE firmentermin (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  titel        TEXT NOT NULL,
  von          TEXT NOT NULL,              -- JJJJ-MM-TT, erster Tag
  bis          TEXT NOT NULL,              -- JJJJ-MM-TT, letzter Tag (einschließlich)
  hinweis      TEXT NOT NULL DEFAULT '',
  erstellt     TEXT NOT NULL,
  erstellt_von INTEGER REFERENCES benutzer(id) ON DELETE SET NULL,
  CHECK (bis >= von)
);
CREATE INDEX firmentermin_zeit ON firmentermin (von, bis);
