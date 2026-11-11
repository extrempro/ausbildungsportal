-- Lernmodul: Abzeichen je Themenfeld. Eine Zeile hält die höchste Stufe fest, die ein Azubi in einem Themenfeld erreicht hat.
-- Einmal erreicht, bleibt die Stufe – auch wenn später Inhalte dazukommen oder die Ampel zurückgestellt wird.
-- Privat wie der übrige Lernstand: nur der Azubi selbst liest und schreibt (server/lernen.ts).
CREATE TABLE lern_abzeichen (
  azubi_id INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
  paket    TEXT NOT NULL,                 -- Ordnername des Inhaltspakets
  feld_id  TEXT NOT NULL,                 -- Themenfeld, z. B. 'netzwerkgrundlagen'
  stufe    INTEGER NOT NULL CHECK (stufe BETWEEN 1 AND 6),
  erreicht TEXT NOT NULL,                 -- Tag, an dem diese Stufe erreicht wurde
  PRIMARY KEY (azubi_id, paket, feld_id)
);
