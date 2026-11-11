-- Termine: einzelne Tage mit freiwilliger Uhrzeit, die Azubis selbst in ihren Plan eintragen
-- (z. B. JAV-Sitzung, Gespräch mit der Personalabteilung). Neue Art „termin“.
-- SQLite kann die CHECK-Bedingung einer Spalte nicht ändern – deshalb wird die Tabelle neu angelegt und umkopiert.
-- von/bis bleiben bei Terminen der Montag der Woche (so steht der Termin in seiner Woche wie alles andere); der Tag steht in „tag“.
CREATE TABLE plan_eintrag_neu (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  azubi_id      INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
  art           TEXT NOT NULL CHECK (art IN ('schule', 'einsatz', 'aufgabe', 'notiz', 'termin')),
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
  sammel_id     INTEGER REFERENCES sammelplanung(id) ON DELETE SET NULL,
  tag           TEXT,                          -- nur Termine: der Tag (JJJJ-MM-TT)
  zeit_von      TEXT NOT NULL DEFAULT '',      -- nur Termine: HH:MM oder leer (ganztägig)
  zeit_bis      TEXT NOT NULL DEFAULT '',      -- nur Termine: HH:MM oder leer
  CHECK (bis >= von),
  CHECK ((art = 'termin') = (tag IS NOT NULL))
);
INSERT INTO plan_eintrag_neu (id, azubi_id, art, von, bis, titel, text, zustaendig_id, erledigt, unteraufgaben, erstellt_von, geaendert_von, geaendert, sammel_id)
  SELECT id, azubi_id, art, von, bis, titel, text, zustaendig_id, erledigt, unteraufgaben, erstellt_von, geaendert_von, geaendert, sammel_id FROM plan_eintrag;
DROP TABLE plan_eintrag;
ALTER TABLE plan_eintrag_neu RENAME TO plan_eintrag;
CREATE INDEX plan_eintrag_azubi ON plan_eintrag (azubi_id, von);
CREATE INDEX plan_eintrag_sammel ON plan_eintrag (sammel_id);
