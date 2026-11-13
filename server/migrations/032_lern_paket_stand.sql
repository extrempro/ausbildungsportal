-- Zuletzt gesehener Inhaltsstand je Unterthema und Paket. Ändern sich Unterthemen (ohne <!-- kein-hinweis -->),
-- bekommen die Azubis des Berufs einen Eintrag in der Glocke – nur dort, ohne Teams und E-Mail.
-- Ist für ein Paket noch nichts gespeichert (erstes Einlesen), wird nur der Stand gemerkt.
CREATE TABLE lern_paket_stand (
  paket        TEXT NOT NULL,
  unterthema_id TEXT NOT NULL,
  hash         TEXT NOT NULL,
  PRIMARY KEY (paket, unterthema_id)
);
