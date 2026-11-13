-- Rückmeldung: neben Fehlern (wie bisher) auch Ideen fürs Portal und Wünsche zu Lerninhalten.
-- Wünsche zu Lerninhalten (art = 'inhalt') werden ohne Person gespeichert: benutzer_id bleibt NULL, der Name leer,
-- keine technischen Angaben, kein Bild, und als Zeit nur der Tag. Dazu Lernmodul (paket) und Thema als lesbarer Text.
ALTER TABLE fehlermeldung ADD COLUMN art TEXT NOT NULL DEFAULT 'fehler' CHECK (art IN ('fehler', 'idee', 'inhalt'));
ALTER TABLE fehlermeldung ADD COLUMN paket TEXT NOT NULL DEFAULT '';
ALTER TABLE fehlermeldung ADD COLUMN thema TEXT NOT NULL DEFAULT '';
CREATE INDEX fehlermeldung_art ON fehlermeldung (art, status, id);
