-- Game Vault: Lernspiele bringen je Spiel und Themenfeld einmal Tropfen. Gespeichert wird nur, welche Kombination
-- schon gezählt hat (z. B. "memory:netzwerke") – ohne Datum, ohne Ergebnis.
ALTER TABLE regal ADD COLUMN spiele TEXT NOT NULL DEFAULT '';
