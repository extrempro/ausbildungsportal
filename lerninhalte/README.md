# Lerninhalte

In diesen Ordner gehören die Inhaltspakete des Lernmoduls – **ein Unterordner je Paket**. Die Inhalte selbst liegen nicht im Repository des Portals (siehe `.gitignore`).

```
lerninhalte/
  fisi/                    Ordnername = Kennung des Pakets (a–z, 0–9, Bindestrich)
    paket.json             freiwillig: { "titel": "…", "quelle": "…", "lizenz": "…" }
    meta.json              { "stand": "JJJJ-MM-TT" }
    themenfelder.json      Reihenfolge der Themenfelder
    themen/<id>.md         ein Cheatsheet je Themenfeld
    bilder/*.svg           Grafiken
    umbenennungen.json     freiwillig: alte → neue Kennungen
```

Das Format ist das des [FISI-Lernkompass](https://github.com/extrempro/fisi-lernkompass) (dort der Ordner `content/`). Dessen Inhalte für Fachinformatiker Systemintegration lassen sich so einbinden:

```bash
git clone https://github.com/extrempro/fisi-lernkompass ../fisi-lernkompass
ln -s ../../fisi-lernkompass/content lerninhalte/fisi        # ohne Docker
```

Mit Docker statt des Links den Ordner einbinden (in `docker-compose.override.yml`):

```yaml
services:
  app:
    volumes:
      - ../fisi-lernkompass/content:/app/lerninhalte/fisi:ro
```

Danach schaltet ein Ausbilder das Paket unter **Verwaltung → Stammdaten** am Ausbildungsberuf ein („Lernmodul“). Azubis dieses Berufs sehen dann den Menüpunkt „Lernen“.

Inhalte aktualisieren: Dateien ändern (z. B. `git pull` im Lernkompass) und `meta.json` mit neuem Stand speichern – das Portal liest das Paket innerhalb weniger Sekunden neu ein, ohne Neustart. Fehler in den Dateien stehen im Log des Portals; eine fehlerhafte Datei ersetzt die zuletzt gültige Fassung nicht.

Mehr dazu im README des Portals, Abschnitt „Lernmodul“.
