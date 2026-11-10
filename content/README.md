# Inhalte

Dieser Ordner enthält Daten, die sich ohne Programmieren pflegen lassen. Mit Docker ist er lesend in den Container eingebunden; Änderungen werden ohne Neustart übernommen.

## Schulferien (`ferien/<Kürzel>.json`)

Eine Datei je Bundesland, benannt nach dem Kürzel: `BW`, `BY`, `BE`, `BB`, `HB`, `HH`, `HE`, `MV`, `NI`, `NW`, `RP`, `SL`, `SN`, `ST`, `SH`, `TH`.

Mitgeliefert ist bisher nur **Hamburg** (`HH.json`). Für Berufsschulen in anderen Bundesländern zeigt die App keine Ferien, bis die passende Datei angelegt ist. Die gesetzlichen **Feiertage** aller Bundesländer berechnet die App selbst; dafür ist keine Datei nötig.

```json
{
  "land": "Bayern",
  "quelle": "Woher die Termine stammen, z. B. Ferienordnung des Kultusministeriums",
  "stand": "2026-11-10",
  "hinweis": "Optionaler Hinweistext",
  "ferien": [
    { "name": "Herbstferien", "von": "2026-11-02", "bis": "2026-11-06" },
    { "name": "Weihnachtsferien", "von": "2026-12-24", "bis": "2027-01-08" }
  ]
}
```

- `von` und `bis` sind der erste und der letzte Ferientag im Format `JJJJ-MM-TT`.
- Einzelne freie Tage (Brückentage) haben dasselbe Datum in `von` und `bis`.
- Fehlerhafte Einträge lässt die App aus und meldet sie im Log.

Die Termine bitte aus der amtlichen Ferienordnung des jeweiligen Landes übernehmen und die Quelle eintragen.
