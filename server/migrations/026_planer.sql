-- Planer für das Prüfungsvorhaben (Abschlussprojekt, Gesellenstück …). Was er enthält, steht im Inhaltspaket des
-- Berufs (planer.md). Hier stehen nur die Eintragungen des Azubis – privat wie der Lernstand: Es gibt keine Route,
-- die sie Ausbildern, Beauftragten oder dem Super-Admin liefert. Einzige Ausnahme sind die Termine: Sie stehen im
-- Ausbildungsplan und sind dort für alle sichtbar, die den Azubi sehen dürfen.
CREATE TABLE planer (
  azubi_id     INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
  paket        TEXT NOT NULL,                 -- Kennung des Inhaltspakets
  name         TEXT NOT NULL DEFAULT '',      -- z. B. Projekttitel
  auftraggeber TEXT NOT NULL DEFAULT '',
  termine      TEXT NOT NULL DEFAULT '{}',    -- JSON: { "<termin>": "JJJJ-MM-TT" }
  haken        TEXT NOT NULL DEFAULT '{}',    -- JSON: { "<checkliste>.<punkt>": true }
  phasen       TEXT,                          -- JSON: [{ name, soll, ist }]; NULL = noch nicht angefangen (Vorschlag des Pakets)
  antworten    TEXT NOT NULL DEFAULT '{}',    -- JSON: { "<fragen>.<frage>": "Stichworte" }
  notizen      TEXT NOT NULL DEFAULT '',
  geaendert    TEXT NOT NULL,
  PRIMARY KEY (azubi_id, paket)
);

-- Freischaltung je Azubi (durch Ausbilder im Profil). 0 = der Azubi sieht den Planer nicht.
ALTER TABLE azubi_profil ADD COLUMN planer_frei INTEGER NOT NULL DEFAULT 0;

-- Glocke: neue Arten „planer_frei“ und „planer_termine“. Die Tabelle wird ein letztes Mal neu angelegt – diesmal ohne
-- die feste Liste der Arten, damit neue Arten künftig keine Migration mehr brauchen (welche es gibt, legt der Code fest).
-- Wartende Benachrichtigungen hängen an der Tabelle und werden über den Umbau gerettet.
CREATE TABLE benachrichtigung_warte_sicher AS SELECT benutzer_id, aktivitaet_id, teams, mail, zeit FROM benachrichtigung_warte;
CREATE TABLE aktivitaet_neu (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  zeit        TEXT NOT NULL,
  azubi_id    INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
  akteur_id   INTEGER REFERENCES benutzer(id) ON DELETE SET NULL,
  akteur_name TEXT NOT NULL,
  art         TEXT NOT NULL,
  montag      TEXT,                          -- betroffene Woche (JJJJ-MM-TT)
  titel       TEXT NOT NULL DEFAULT '',
  anzahl      INTEGER NOT NULL DEFAULT 1,
  sammel_id   INTEGER
);
INSERT INTO aktivitaet_neu (id, zeit, azubi_id, akteur_id, akteur_name, art, montag, titel, anzahl, sammel_id)
  SELECT id, zeit, azubi_id, akteur_id, akteur_name, art, montag, titel, anzahl, sammel_id FROM aktivitaet;
DROP TABLE aktivitaet;
ALTER TABLE aktivitaet_neu RENAME TO aktivitaet;
CREATE INDEX aktivitaet_azubi ON aktivitaet (azubi_id, id);
DELETE FROM benachrichtigung_warte;
INSERT INTO benachrichtigung_warte (benutzer_id, aktivitaet_id, teams, mail, zeit)
  SELECT benutzer_id, aktivitaet_id, teams, mail, zeit FROM benachrichtigung_warte_sicher;
DROP TABLE benachrichtigung_warte_sicher;
