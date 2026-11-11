-- Lernmodul: Lerninhalte (Cheatsheets) je Ausbildungsberuf und der Lernstand je Azubi.
-- Die Inhalte selbst liegen als Dateien im Ordner LERN_DIR (ein Unterordner je Inhaltspaket), nicht in der Datenbank.
-- beruf.lernpaket nennt das Paket (Ordnername); NULL = für diesen Beruf gibt es kein Lernmodul.
ALTER TABLE beruf ADD COLUMN lernpaket TEXT;

-- Lernstand: privat – nur der Azubi selbst liest und schreibt ihn (server/lernen.ts).
CREATE TABLE lern_status (
  azubi_id      INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
  paket         TEXT NOT NULL,                 -- Ordnername des Inhaltspakets
  unterthema_id TEXT NOT NULL,                 -- 'themenfeld.unterthema', z. B. 'netzwerkgrundlagen.subnetting'
  status        TEXT NOT NULL DEFAULT 'rot' CHECK (status IN ('rot', 'gelb', 'gruen')),
  luecke        TEXT NOT NULL DEFAULT '',      -- Lernpunkt: was noch schwerfällt
  notiz         TEXT NOT NULL DEFAULT '',
  inhalt_hash   TEXT,                          -- Stand des Inhalts beim letzten Bestätigen – für „Inhalt aktualisiert“
  geaendert     TEXT NOT NULL,
  PRIMARY KEY (azubi_id, paket, unterthema_id)
);
