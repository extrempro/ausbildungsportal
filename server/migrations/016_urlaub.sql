-- Urlaub beantragen: Der Azubi stellt einen Antrag, die zugewiesenen Ausbildungsbeauftragten bestätigen,
-- der zuständige Ausbilder genehmigt endgültig; danach geht eine Mail an die Personalstelle.

-- Urlaubsanspruch je Kalenderjahr in Arbeitstagen; NULL = nicht eingetragen
ALTER TABLE azubi_profil ADD COLUMN urlaubstage INTEGER;

CREATE TABLE urlaub_antrag (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  azubi_id    INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
  von         TEXT NOT NULL,                 -- erster Urlaubstag (JJJJ-MM-TT)
  bis         TEXT NOT NULL,                 -- letzter Urlaubstag
  tage        INTEGER NOT NULL,              -- Arbeitstage im Zeitraum (ohne Wochenenden und Feiertage), beim Antrag gezählt
  bemerkung   TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'genehmigt', 'abgelehnt', 'zurueckgezogen', 'storniert')),
  erstellt    TEXT NOT NULL,
  geaendert   TEXT NOT NULL,
  -- Mail an die Personalstelle: '' = keine fällig, sonst 'offen', 'gesendet', 'fehler' oder 'ohne' (keine Adresse/kein Versand eingerichtet)
  mail_stand  TEXT NOT NULL DEFAULT '',
  mail_fehler TEXT NOT NULL DEFAULT '',
  CHECK (bis >= von)
);
CREATE INDEX urlaub_antrag_azubi ON urlaub_antrag (azubi_id, von);

-- Wer bestätigen muss, steht beim Antrag fest: alle, denen der Azubi im Zeitraum zugewiesen ist. zeit = NULL heißt: steht noch aus.
CREATE TABLE urlaub_bestaetigung (
  antrag_id   INTEGER NOT NULL REFERENCES urlaub_antrag(id) ON DELETE CASCADE,
  benutzer_id INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  zeit        TEXT,
  PRIMARY KEY (antrag_id, benutzer_id)
);

-- Verlauf eines Antrags; Namen stehen mit darin, damit er nach dem Löschen eines Kontos lesbar bleibt
CREATE TABLE urlaub_verlauf (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  antrag_id INTEGER NOT NULL REFERENCES urlaub_antrag(id) ON DELETE CASCADE,
  zeit      TEXT NOT NULL,
  aktion    TEXT NOT NULL,                   -- beantragt, bestaetigt, genehmigt, abgelehnt, zurueckgezogen, storniert, mail
  name      TEXT NOT NULL,
  rolle     TEXT NOT NULL,
  kommentar TEXT NOT NULL DEFAULT ''
);
CREATE INDEX urlaub_verlauf_antrag ON urlaub_verlauf (antrag_id, id);

-- Glocke: neue Arten für Urlaub. SQLite kann die CHECK-Bedingung nicht ändern – Tabelle neu anlegen und umkopieren.
CREATE TABLE aktivitaet_neu (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  zeit        TEXT NOT NULL,
  azubi_id    INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
  akteur_id   INTEGER REFERENCES benutzer(id) ON DELETE SET NULL,
  akteur_name TEXT NOT NULL,
  art         TEXT NOT NULL CHECK (art IN ('plan_neu', 'bericht_eingereicht', 'bericht_abgezeichnet', 'bericht_zurueck', 'bericht_geoeffnet',
                                           'urlaub_beantragt', 'urlaub_bestaetigt', 'urlaub_genehmigt', 'urlaub_abgelehnt', 'urlaub_zurueckgezogen', 'urlaub_storniert')),
  montag      TEXT,                          -- betroffene Woche (JJJJ-MM-TT)
  titel       TEXT NOT NULL DEFAULT '',      -- Titel des Plan-Eintrags, Name der Vorlage bzw. Zeitraum des Urlaubs
  anzahl      INTEGER NOT NULL DEFAULT 1,
  sammel_id   INTEGER
);
INSERT INTO aktivitaet_neu (id, zeit, azubi_id, akteur_id, akteur_name, art, montag, titel, anzahl, sammel_id)
  SELECT id, zeit, azubi_id, akteur_id, akteur_name, art, montag, titel, anzahl, sammel_id FROM aktivitaet;
DROP TABLE aktivitaet;
ALTER TABLE aktivitaet_neu RENAME TO aktivitaet;
CREATE INDEX aktivitaet_azubi ON aktivitaet (azubi_id, id);
