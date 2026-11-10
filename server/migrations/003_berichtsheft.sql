-- Phase 3: Berichtsheft (Ausbildungsnachweise) – ein Bericht je Azubi und Kalenderwoche

CREATE TABLE bericht (
  azubi_id         INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
  montag           TEXT NOT NULL,                 -- JJJJ-MM-TT, Montag der Berichtswoche
  status           TEXT NOT NULL DEFAULT 'entwurf'
                   CHECK (status IN ('entwurf', 'eingereicht', 'zurueck', 'abgezeichnet')),
  inhalt           TEXT NOT NULL DEFAULT '{}',    -- JSON: betrieb, unterweisung, schule, abwesenheit
  kommentar        TEXT NOT NULL DEFAULT '',      -- Begründung beim Zurückgeben
  eingereicht_am   TEXT,
  abgezeichnet_am  TEXT,
  abgezeichnet_von INTEGER REFERENCES benutzer(id) ON DELETE SET NULL,
  geaendert        TEXT NOT NULL,
  PRIMARY KEY (azubi_id, montag)
);
CREATE INDEX bericht_status ON bericht (status);

-- aktuelle, gezeichnete Unterschrift je Konto (SVG-Pfad im Feld 600 × 200, nur M/L-Befehle und Zahlen)
CREATE TABLE unterschrift (
  benutzer_id INTEGER PRIMARY KEY REFERENCES benutzer(id) ON DELETE CASCADE,
  pfad        TEXT NOT NULL,
  geaendert   TEXT NOT NULL
);

-- Kopie der Unterschrift zum Zeitpunkt des Einreichens bzw. Abzeichnens: Eine später geänderte
-- Unterschrift oder ein gelöschtes Konto verändert alte Nachweise nicht.
CREATE TABLE bericht_signatur (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  azubi_id    INTEGER NOT NULL,
  montag      TEXT NOT NULL,
  art         TEXT NOT NULL CHECK (art IN ('azubi', 'abzeichnung')),
  name        TEXT NOT NULL,
  rolle       TEXT NOT NULL,
  pfad        TEXT NOT NULL,
  zeit        TEXT NOT NULL,
  FOREIGN KEY (azubi_id, montag) REFERENCES bericht(azubi_id, montag) ON DELETE CASCADE
);
CREATE INDEX bericht_signatur_bericht ON bericht_signatur (azubi_id, montag);

-- Verlauf je Bericht: eingereicht, zurückgezogen, zurückgegeben, abgezeichnet, Abzeichnung aufgehoben
CREATE TABLE bericht_verlauf (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  azubi_id  INTEGER NOT NULL,
  montag    TEXT NOT NULL,
  zeit      TEXT NOT NULL,
  aktion    TEXT NOT NULL,
  name      TEXT NOT NULL,
  rolle     TEXT NOT NULL,
  kommentar TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (azubi_id, montag) REFERENCES bericht(azubi_id, montag) ON DELETE CASCADE
);
CREATE INDEX bericht_verlauf_bericht ON bericht_verlauf (azubi_id, montag);
