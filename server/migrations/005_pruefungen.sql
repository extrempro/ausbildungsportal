-- Prüfungstermine je Azubi (z. B. Abschlussprüfung Teil 1 und Teil 2) – erscheinen im Ausbildungsplan
ALTER TABLE azubi_profil ADD COLUMN pruefungen TEXT NOT NULL DEFAULT '[]';  -- JSON: [{ bezeichnung, datum }]
