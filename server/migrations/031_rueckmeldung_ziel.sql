-- Wünsche zu Lerninhalten: Kennungen von Themenfeld und Unterthema („feld|unterthema“), damit die Ausbilder direkt an die Stelle springen.
-- Ältere Wünsche haben hier nichts; für sie sucht der Server die Stelle über die gespeicherten Titel.
ALTER TABLE fehlermeldung ADD COLUMN ziel TEXT NOT NULL DEFAULT '';
