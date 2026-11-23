-- Klassen an der Berufsschule und ihre Schulblöcke.
-- Ein Azubi gehört zu einer Klasse seiner Berufsschule (bleibt die ganze Ausbildung). Die Schulblöcke werden einmal an der
-- Klasse gepflegt; im Plan jedes Azubis der Klasse steht dazu ein Eintrag „Schule“, der mit dem Block verknüpft ist.
CREATE TABLE klasse (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  berufsschule_id INTEGER NOT NULL REFERENCES berufsschule(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  beruf_id        INTEGER REFERENCES beruf(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX klasse_name ON klasse (berufsschule_id, name COLLATE NOCASE);

ALTER TABLE azubi_profil ADD COLUMN klasse_id INTEGER REFERENCES klasse(id) ON DELETE SET NULL;

CREATE TABLE schulblock (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  klasse_id     INTEGER NOT NULL REFERENCES klasse(id) ON DELETE CASCADE,
  von           TEXT NOT NULL,                 -- JJJJ-MM-TT, Montag der ersten Woche
  bis           TEXT NOT NULL,                 -- JJJJ-MM-TT, Montag der letzten Woche
  titel         TEXT NOT NULL,
  text          TEXT NOT NULL DEFAULT '',
  geaendert     TEXT NOT NULL,
  geaendert_von INTEGER REFERENCES benutzer(id) ON DELETE SET NULL,
  CHECK (bis >= von)
);
CREATE INDEX schulblock_klasse ON schulblock (klasse_id, von);

-- der Eintrag im Plan eines Azubis, der zu einem Block der Klasse gehört; wird mit dem Block gelöscht
ALTER TABLE plan_eintrag ADD COLUMN schulblock_id INTEGER REFERENCES schulblock(id) ON DELETE CASCADE;
CREATE INDEX plan_eintrag_schulblock ON plan_eintrag (schulblock_id);

-- Ausnahmen: Für diesen Azubi wurde der Block im eigenen Plan geändert oder gelöscht – er folgt der Klasse nicht mehr
CREATE TABLE schulblock_ausnahme (
  schulblock_id INTEGER NOT NULL REFERENCES schulblock(id) ON DELETE CASCADE,
  azubi_id      INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
  PRIMARY KEY (schulblock_id, azubi_id)
);
