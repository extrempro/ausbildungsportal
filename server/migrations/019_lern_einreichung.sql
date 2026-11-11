-- Lerninhalte einreichen: Ausbilder laden ein Inhaltspaket als ZIP hoch, der Super-Admin prüft es und
-- übernimmt es (dann liegt es unter <DATA_DIR>/lerninhalte/<kennung>) oder gibt es mit einer Rückmeldung zurück.
-- Die ZIP-Datei bleibt nur gespeichert, solange die Einreichung offen ist.
CREATE TABLE lern_einreichung (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  kennung        TEXT NOT NULL,                 -- Ordnername des Pakets
  titel          TEXT NOT NULL DEFAULT '',      -- aus paket.json
  ausbilder_id   INTEGER REFERENCES benutzer(id) ON DELETE SET NULL,
  ausbilder_name TEXT NOT NULL,
  notiz          TEXT NOT NULL DEFAULT '',      -- Hinweis des Ausbilders
  groesse        INTEGER NOT NULL,              -- Bytes der ZIP-Datei
  pruefung       TEXT NOT NULL,                 -- JSON: Ergebnis der automatischen Prüfung
  status         TEXT NOT NULL DEFAULT 'eingereicht' CHECK (status IN ('eingereicht', 'zurueck', 'hochgeladen', 'zurueckgezogen')),
  rueckmeldung   TEXT NOT NULL DEFAULT '',      -- vom Super-Admin: Grund der Rückgabe oder Kommentar zur Übernahme
  geprueft_von   TEXT NOT NULL DEFAULT '',
  geprueft_am    TEXT,
  erstellt       TEXT NOT NULL,
  zip            BLOB
);
CREATE INDEX lern_einreichung_status ON lern_einreichung (status, erstellt);
