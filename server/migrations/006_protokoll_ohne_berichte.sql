-- Das Protokoll enthält keine Ereignisse zu einzelnen Berichten mehr (eingereicht, abgezeichnet, zurückgegeben, Abzeichnung aufgehoben).
-- Diese Schritte stehen weiterhin im Verlauf des jeweiligen Berichts (Tabelle bericht_verlauf) – dort sehen sie nur die Beteiligten.
DELETE FROM protokoll WHERE aktion IN ('bericht_eingereicht', 'bericht_abgezeichnet', 'bericht_zurueckgegeben', 'bericht_geoeffnet');
