-- Phase 1: Konten, Sitzungen, Zuweisungen, Protokoll

CREATE TABLE benutzer (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  anmeldung        TEXT NOT NULL CHECK (anmeldung IN ('entra', 'lokal')),
  anmeldename      TEXT NOT NULL UNIQUE,          -- Entra-UPN bzw. lokaler Benutzername, klein geschrieben
  entra_oid        TEXT UNIQUE,                   -- Objekt-ID aus Entra, gesetzt bei der ersten Anmeldung
  anzeigename      TEXT NOT NULL,
  rolle            TEXT NOT NULL CHECK (rolle IN ('admin', 'ausbilder', 'beauftragter', 'azubi')),
  passwort_hash    TEXT,                          -- nur lokal: scrypt inkl. Salt und Parametern
  passwort_wechsel INTEGER NOT NULL DEFAULT 0,    -- 1 = bei der nächsten lokalen Anmeldung erzwingen
  status           TEXT NOT NULL DEFAULT 'aktiv' CHECK (status IN ('aktiv', 'gesperrt')),
  fehlversuche     INTEGER NOT NULL DEFAULT 0,
  gesperrt_bis     TEXT,                          -- ISO-Zeit, Wartezeit nach Fehlversuchen
  theme            TEXT NOT NULL DEFAULT 'auto' CHECK (theme IN ('auto', 'light', 'dark')),
  erstellt         TEXT NOT NULL,
  erstellt_von     INTEGER REFERENCES benutzer(id) ON DELETE SET NULL,
  letzte_anmeldung TEXT,
  -- lokal genau dann, wenn Super-Admin; lokale Konten haben immer ein Passwort
  CHECK ((anmeldung = 'lokal') = (rolle = 'admin')),
  CHECK (anmeldung = 'entra' OR passwort_hash IS NOT NULL)
);

CREATE TABLE sitzung (
  token_hash  TEXT PRIMARY KEY,                   -- SHA-256 des Cookie-Tokens
  benutzer_id INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
  erstellt    TEXT NOT NULL,
  zuletzt     TEXT NOT NULL,
  laeuft_ab   TEXT NOT NULL                       -- spätestes Ende, unabhängig von Aktivität
);
CREATE INDEX sitzung_benutzer ON sitzung (benutzer_id);

-- kurzlebig: state, nonce und PKCE je Entra-Anmeldung
CREATE TABLE anmeldevorgang (
  state         TEXT PRIMARY KEY,
  nonce         TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  erstellt      TEXT NOT NULL
);

CREATE TABLE zuweisung (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  azubi_id        INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
  beauftragter_id INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
  von             TEXT,                           -- JJJJ-MM-TT oder leer = ab Beginn
  bis             TEXT                            -- JJJJ-MM-TT oder leer = bis Ende
);
CREATE INDEX zuweisung_azubi ON zuweisung (azubi_id);
CREATE INDEX zuweisung_beauftragter ON zuweisung (beauftragter_id);

-- Namen werden mitgespeichert, damit Einträge nach dem Löschen eines Kontos lesbar bleiben
CREATE TABLE protokoll (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  zeit          TEXT NOT NULL,
  bereich       TEXT NOT NULL CHECK (bereich IN ('konto', 'fach')),  -- Super-Admin sieht nur 'konto'
  aktion        TEXT NOT NULL,
  benutzer_id   INTEGER,
  benutzer_name TEXT NOT NULL DEFAULT '',
  ziel_id       INTEGER,
  ziel_name     TEXT NOT NULL DEFAULT '',
  detail        TEXT NOT NULL DEFAULT ''
);
CREATE INDEX protokoll_zeit ON protokoll (zeit);

CREATE TABLE einstellungen (schluessel TEXT PRIMARY KEY, wert TEXT);
CREATE TABLE schema_version (version INTEGER NOT NULL);
