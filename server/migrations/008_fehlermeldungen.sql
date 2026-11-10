-- Fehlermeldungen aus dem Portal: Jedes angemeldete Konto kann ein Problem melden, der Super-Admin sieht und bearbeitet die Meldungen.
-- Neben dem Text stehen nur technische Angaben (Seite, Version, Browser, Fenstergröße, letzte Fehlermeldungen des Browsers).
CREATE TABLE fehlermeldung (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  zeit          TEXT NOT NULL,
  benutzer_id   INTEGER REFERENCES benutzer(id) ON DELETE SET NULL,
  benutzer_name TEXT NOT NULL,
  rolle         TEXT NOT NULL,
  text          TEXT NOT NULL,
  seite         TEXT NOT NULL DEFAULT '',
  version       TEXT NOT NULL DEFAULT '',
  browser       TEXT NOT NULL DEFAULT '',
  fenster       TEXT NOT NULL DEFAULT '',
  technik       TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'erledigt')),
  erledigt_am   TEXT
);
CREATE INDEX fehlermeldung_status ON fehlermeldung (status, id);
