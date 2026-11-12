-- Benachrichtigungen per Teams und E-Mail – zusätzlich zur Glocke, von jeder Person selbst einzuschalten.

-- Was jemand gewählt hat: je Bereich, ob per Teams und/oder per E-Mail. Keine Zeile = nichts gewählt.
CREATE TABLE benachrichtigung_wahl (
  benutzer_id INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
  bereich     TEXT NOT NULL CHECK (bereich IN ('berichtsheft', 'urlaub', 'plan')),
  teams       INTEGER NOT NULL DEFAULT 0 CHECK (teams IN (0, 1)),
  mail        INTEGER NOT NULL DEFAULT 0 CHECK (mail IN (0, 1)),
  PRIMARY KEY (benutzer_id, bereich)
);

-- Warteschlange: was noch zu verschicken ist. Wird nach dem Versand geleert – einen Verlauf gibt es nicht.
-- Verschwindet die Aktivität (z. B. weil eine Sammelplanung zurückgenommen wird), verschwindet auch der Eintrag.
CREATE TABLE benachrichtigung_warte (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  benutzer_id   INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
  aktivitaet_id INTEGER NOT NULL REFERENCES aktivitaet(id) ON DELETE CASCADE,
  teams         INTEGER NOT NULL,
  mail          INTEGER NOT NULL,
  zeit          TEXT NOT NULL
);
CREATE INDEX benachrichtigung_warte_benutzer ON benachrichtigung_warte (benutzer_id);
