-- Phase 4: Ausbildungsplan je Azubi und Planvorlagen je Beruf

CREATE TABLE plan_eintrag (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  azubi_id      INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
  art           TEXT NOT NULL CHECK (art IN ('schule', 'einsatz', 'aufgabe', 'notiz')),
  von           TEXT NOT NULL,                 -- JJJJ-MM-TT, Montag der ersten Woche
  bis           TEXT NOT NULL,                 -- JJJJ-MM-TT, Montag der letzten Woche
  titel         TEXT NOT NULL,
  text          TEXT NOT NULL DEFAULT '',
  zustaendig_id INTEGER REFERENCES benutzer(id) ON DELETE SET NULL,  -- Ausbilder oder Beauftragte/r
  erledigt      INTEGER NOT NULL DEFAULT 0,
  unteraufgaben TEXT NOT NULL DEFAULT '[]',    -- JSON: [{ text, erledigt }]
  erstellt_von  INTEGER REFERENCES benutzer(id) ON DELETE SET NULL,
  geaendert_von INTEGER REFERENCES benutzer(id) ON DELETE SET NULL,
  geaendert     TEXT NOT NULL,
  CHECK (bis >= von)
);
CREATE INDEX plan_eintrag_azubi ON plan_eintrag (azubi_id, von);

CREATE TABLE planvorlage (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  beruf_id      INTEGER REFERENCES beruf(id) ON DELETE SET NULL,
  titel         TEXT NOT NULL,
  eintraege     TEXT NOT NULL DEFAULT '[]',    -- JSON: [{ art, abWoche, wochen, titel, text, unteraufgaben }] – Wochen ab Ausbildungsbeginn
  geaendert_von INTEGER REFERENCES benutzer(id) ON DELETE SET NULL,
  geaendert     TEXT NOT NULL
);
