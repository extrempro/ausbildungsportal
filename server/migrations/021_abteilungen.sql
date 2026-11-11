-- Abteilungen: Stammdaten mit hinterlegten Beauftragten (Ausbildungsbeauftragte oder Ausbilder) und freiwilliger Stellvertretung.
-- Ein Einsatz im Ausbildungsplan kann einer Abteilung gehören. Dann sind die hinterlegten Personen für die Dauer des Einsatzes
-- automatisch zugewiesen: Dafür entstehen Zeilen in `zuweisung` mit einsatz_id – sie verschwinden mit dem Einsatz.
CREATE TABLE abteilung (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE abteilung_person (
  abteilung_id INTEGER NOT NULL REFERENCES abteilung(id) ON DELETE CASCADE,
  benutzer_id  INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
  art          TEXT NOT NULL CHECK (art IN ('beauftragt', 'stellvertretung')),
  PRIMARY KEY (abteilung_id, benutzer_id)
);

ALTER TABLE plan_eintrag ADD COLUMN abteilung_id INTEGER REFERENCES abteilung(id) ON DELETE SET NULL;
CREATE INDEX plan_eintrag_abteilung ON plan_eintrag (abteilung_id);

-- NULL = von Hand zugewiesen; sonst der Einsatz, aus dem die Zuweisung entstanden ist
ALTER TABLE zuweisung ADD COLUMN einsatz_id INTEGER REFERENCES plan_eintrag(id) ON DELETE CASCADE;
CREATE INDEX zuweisung_einsatz ON zuweisung (einsatz_id);

-- Urlaub: Bestätigungen aus einer Abteilung bilden eine Gruppe – eine Bestätigung aus der Gruppe genügt.
ALTER TABLE urlaub_bestaetigung ADD COLUMN gruppe TEXT NOT NULL DEFAULT '';
