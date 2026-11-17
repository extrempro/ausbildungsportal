-- Rückfragen zu Rückmeldungen: Zu einer Fehlermeldung oder Idee können Super-Admin (beides) und Ausbilder (nur Ideen)
-- der meldenden Person schreiben; sie antwortet unter „Meine Meldungen“. Wünsche zu Lerninhalten sind ohne Person
-- gespeichert und bekommen deshalb nie Nachrichten.
CREATE TABLE fehlermeldung_nachricht (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  meldung_id  INTEGER NOT NULL REFERENCES fehlermeldung(id) ON DELETE CASCADE,
  zeit        TEXT NOT NULL,
  von_id      INTEGER REFERENCES benutzer(id) ON DELETE SET NULL,
  von_name    TEXT NOT NULL,
  von_rolle   TEXT NOT NULL,
  text        TEXT NOT NULL
);
CREATE INDEX fehlermeldung_nachricht_meldung ON fehlermeldung_nachricht (meldung_id, id);

-- 1 = die meldende Person hat zuletzt geschrieben, die Antwort ist noch nicht beantwortet oder bearbeitet
ALTER TABLE fehlermeldung ADD COLUMN antwort_neu INTEGER NOT NULL DEFAULT 0 CHECK (antwort_neu IN (0, 1));
-- bis zu welcher Nachricht die meldende Person gelesen hat (für „neu“ unter „Meine Meldungen“)
ALTER TABLE fehlermeldung ADD COLUMN person_gesehen INTEGER NOT NULL DEFAULT 0;

-- Benachrichtigungen per Teams und E-Mail: neuer Bereich „rueckmeldungen“. Die feste Liste steckt in einer CHECK-Regel –
-- die Tabelle wird neu angelegt, die bisherige Wahl bleibt erhalten.
CREATE TABLE benachrichtigung_wahl_neu (
  benutzer_id INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
  bereich     TEXT NOT NULL CHECK (bereich IN ('berichtsheft', 'urlaub', 'plan', 'rueckmeldungen')),
  teams       INTEGER NOT NULL DEFAULT 0 CHECK (teams IN (0, 1)),
  mail        INTEGER NOT NULL DEFAULT 0 CHECK (mail IN (0, 1)),
  PRIMARY KEY (benutzer_id, bereich)
);
INSERT INTO benachrichtigung_wahl_neu (benutzer_id, bereich, teams, mail) SELECT benutzer_id, bereich, teams, mail FROM benachrichtigung_wahl;
DROP TABLE benachrichtigung_wahl;
ALTER TABLE benachrichtigung_wahl_neu RENAME TO benachrichtigung_wahl;
