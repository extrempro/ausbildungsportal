-- Bausteine eines Unterthemas je Inhaltsstand (Kernbegriffe, Tabellenzeilen, Befehle, Merksatz, Prüfungsfrage, Abbildungen),
-- jeweils mit einer kurzen Prüfsumme. Damit markiert das Portal beim Azubi, was seit seinem letzten Blick neu ist oder sich
-- geändert hat. Gespeichert wird nur über die Inhalte, nichts über Personen. Aufgehoben wird ein Stand, solange er aktuell ist
-- oder ein Lernstand auf ihn verweist (lern_status.inhalt_hash).
CREATE TABLE lern_inhalt_version (
  paket     TEXT NOT NULL,
  hash      TEXT NOT NULL,
  bausteine TEXT NOT NULL,
  PRIMARY KEY (paket, hash)
);
