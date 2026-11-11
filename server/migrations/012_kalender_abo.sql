-- Kalender-Abo: ein persönlicher, nur lesender Link je Konto (Azubi, Ausbildungsbeauftragte, Ausbilder).
-- Das Geheimnis steht im Klartext hier, damit das Portal den Link erneut anzeigen kann. Es gibt nur Lesezugriff auf
-- Daten, die ohnehin in dieser Datenbank liegen – wer die Datenbank lesen kann, braucht den Link nicht.
CREATE TABLE kalender_abo (
  benutzer_id   INTEGER PRIMARY KEY REFERENCES benutzer(id) ON DELETE CASCADE,
  geheimnis     TEXT NOT NULL UNIQUE,
  erstellt      TEXT NOT NULL,
  letzter_abruf TEXT            -- wann ein Kalenderprogramm den Link zuletzt abgerufen hat; nur das Konto selbst sieht es
);
