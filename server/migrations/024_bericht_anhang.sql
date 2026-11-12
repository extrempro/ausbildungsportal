-- Anhänge an Berichten: Fotos und Dateien, die der Azubi zu einem Bericht hochlädt.
-- In der Tagesform gehört ein Anhang zu einem Tag, in der Wochenform zum ganzen Bericht (tag leer).
-- Die Datei liegt in der Datenbank – so ist sie in der Sicherung enthalten und verschwindet mit dem Bericht und mit dem Konto.
CREATE TABLE bericht_anhang (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  azubi_id  INTEGER NOT NULL,
  montag    TEXT NOT NULL,
  tag       TEXT,                       -- JJJJ-MM-TT innerhalb der Woche oder leer = ganzer Bericht
  name      TEXT NOT NULL,              -- Dateiname, wie er angezeigt und beim Herunterladen vorgeschlagen wird
  typ       TEXT NOT NULL,              -- Inhaltstyp, vom Server am Dateianfang geprüft
  groesse   INTEGER NOT NULL,
  erstellt  TEXT NOT NULL,
  daten     BLOB NOT NULL,
  FOREIGN KEY (azubi_id, montag) REFERENCES bericht (azubi_id, montag) ON DELETE CASCADE
);
CREATE INDEX bericht_anhang_bericht ON bericht_anhang (azubi_id, montag);
