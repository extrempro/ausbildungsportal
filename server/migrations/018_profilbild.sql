-- Profilbild aus Microsoft Entra (freiwillig, ENTRA_PROFILBILD=true): bei der Anmeldung geholt, klein (96 × 96) gespeichert.
-- bild_zeigen = 0: Die Person will kein Bild – es wird gelöscht und nicht mehr geholt.
-- bild_stand: Kennung des gespeicherten Bilds (für die Adresse, damit der Browser ein neues Bild sofort lädt); NULL = kein Bild.
ALTER TABLE benutzer ADD COLUMN bild_zeigen INTEGER NOT NULL DEFAULT 1;
ALTER TABLE benutzer ADD COLUMN bild_stand TEXT;

CREATE TABLE benutzer_bild (
  benutzer_id INTEGER PRIMARY KEY REFERENCES benutzer(id) ON DELETE CASCADE,
  typ         TEXT NOT NULL CHECK (typ IN ('image/jpeg', 'image/png')),
  daten       BLOB NOT NULL,
  geaendert   TEXT NOT NULL
);
