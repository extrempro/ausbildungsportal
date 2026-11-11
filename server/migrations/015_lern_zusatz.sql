-- Lernmodul: Zusatzwissen. Es zählt nicht zur Ampel; der Azubi kann es nur als „gelesen“ abhaken.
-- Privat wie der übrige Lernstand – nur der Azubi selbst liest und schreibt (server/lernen.ts).
-- Eine Zeile heißt: gelesen. Wird der Haken entfernt, wird die Zeile gelöscht.
CREATE TABLE lern_zusatz (
  azubi_id  INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
  paket     TEXT NOT NULL,                 -- Ordnername des Inhaltspakets
  zusatz_id TEXT NOT NULL,                 -- 'themenfeld.zusatz', z. B. 'netzwerkdienste.dhcp-ablauf'
  geaendert TEXT NOT NULL,
  PRIMARY KEY (azubi_id, paket, zusatz_id)
);
