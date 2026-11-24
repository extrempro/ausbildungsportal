-- Samstag und Sonntag im Berichtsheft (Tagesform): schaltet der Ausbilder je Azubi im Profil frei.
-- Ohne Freischaltung gibt es in der Tagesform nur Montag bis Freitag; schon gespeicherte Einträge am Wochenende bleiben.
ALTER TABLE azubi_profil ADD COLUMN wochenende INTEGER NOT NULL DEFAULT 0;
