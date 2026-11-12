-- Form des Berichtshefts je Azubi: 'woche' (Tätigkeiten der ganzen Woche) oder 'tag' (Einträge je Tag).
-- Leer = es gilt, was der Betrieb in den Stammdaten eingestellt hat.
ALTER TABLE azubi_profil ADD COLUMN bericht_form TEXT CHECK (bericht_form IN ('woche', 'tag'));
