-- Abwesenheit im Bericht: Die Gründe „krank“ und „sonstiges“ werden zu „abwesend“ (Wunsch des Betriebs, Datensparsamkeit).
-- Ein Grund mit Gesundheitsbezug wird damit nicht mehr gespeichert – auch nicht in vorhandenen Berichten.
-- Im JSON steht der Grund immer als "grund":"…" ohne Leerzeichen (JSON.stringify); Text in Freitexten ist maskiert (\") und wird nicht getroffen.
UPDATE bericht
SET inhalt = replace(replace(inhalt, '"grund":"krank"', '"grund":"abwesend"'), '"grund":"sonstiges"', '"grund":"abwesend"')
WHERE inhalt LIKE '%"grund":"krank"%' OR inhalt LIKE '%"grund":"sonstiges"%';
