-- Aktivitäten für die Glocke in der Kopfzeile: neue Plan-Einträge und Schritte im Berichtsheft.
-- Keine Inhalte von Berichten, nur „wer, was, welche Woche“. Sichtbar für alle, die den Azubi sehen dürfen
-- (ohne die eigenen Handlungen). Einträge werden nach 60 Tagen gelöscht.
CREATE TABLE aktivitaet (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  zeit        TEXT NOT NULL,
  azubi_id    INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
  akteur_id   INTEGER REFERENCES benutzer(id) ON DELETE SET NULL,
  akteur_name TEXT NOT NULL,
  art         TEXT NOT NULL CHECK (art IN ('plan_neu', 'bericht_eingereicht', 'bericht_abgezeichnet', 'bericht_zurueck', 'bericht_geoeffnet')),
  montag      TEXT,                          -- betroffene Woche (JJJJ-MM-TT)
  titel       TEXT NOT NULL DEFAULT '',      -- Titel des Plan-Eintrags bzw. Name der Vorlage
  anzahl      INTEGER NOT NULL DEFAULT 1     -- mehr als 1, wenn eine Planvorlage übernommen wurde
);
CREATE INDEX aktivitaet_azubi ON aktivitaet (azubi_id, id);

-- bis zu welcher Aktivität das Konto die Glocke schon geöffnet hat
ALTER TABLE benutzer ADD COLUMN aktivitaet_gesehen INTEGER NOT NULL DEFAULT 0;
