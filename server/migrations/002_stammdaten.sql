-- Phase 2: Stammdaten für beliebige Berufe und das Profil der Azubis.
-- Angaben zum Betrieb (Name, Anschrift, Bundesland) stehen in der Tabelle einstellungen.

CREATE TABLE beruf (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  bezeichnung       TEXT NOT NULL,
  fachrichtung      TEXT NOT NULL DEFAULT '',
  regeldauer_monate INTEGER NOT NULL DEFAULT 36 CHECK (regeldauer_monate BETWEEN 12 AND 60)
);

CREATE TABLE berufsschule (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  ort        TEXT NOT NULL DEFAULT '',
  bundesland TEXT NOT NULL,                       -- Kürzel, z. B. HH – bestimmt die Schulferien
  form       TEXT NOT NULL DEFAULT 'block' CHECK (form IN ('block', 'teilzeit'))
);

CREATE TABLE azubi_profil (
  benutzer_id          INTEGER PRIMARY KEY REFERENCES benutzer(id) ON DELETE CASCADE,
  beruf_id             INTEGER REFERENCES beruf(id) ON DELETE SET NULL,
  berufsschule_id      INTEGER REFERENCES berufsschule(id) ON DELETE SET NULL,
  ausbilder_id         INTEGER REFERENCES benutzer(id) ON DELETE SET NULL,  -- zuständiger Ausbilder
  ausbildungsbeginn    TEXT NOT NULL DEFAULT '',  -- JJJJ-MM-TT oder leer
  vertragsende         TEXT NOT NULL DEFAULT '',  -- abweichendes Ende laut Vertrag oder leer = berechnet
  verkuerzung_monate   INTEGER NOT NULL DEFAULT 0,
  verkuerzung_art      TEXT NOT NULL DEFAULT 'ende' CHECK (verkuerzung_art IN ('ende', 'anfang')),
  verkuerzung_grund    TEXT NOT NULL DEFAULT '',
  vorzeitige_zulassung INTEGER NOT NULL DEFAULT 0,
  wochenstunden        REAL NOT NULL DEFAULT 40,
  geaendert            TEXT NOT NULL,
  geaendert_von        INTEGER REFERENCES benutzer(id) ON DELETE SET NULL
);
