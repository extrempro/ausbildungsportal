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
    planer.md              freiwillig: Planer für die Prüfung (z. B. Abschlussprojekt)
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

Oder den Ordner `content` einfach hierher kopieren – **mit Unterordnern** (`cp -r` bzw. `scp -r`):

```bash
scp -r benutzer@server:/pfad/fisi-lernkompass/content/. lerninhalte/fisi/
chmod -R a+rX lerninhalte/fisi      # das Portal läuft im Container nicht als root
```

Zeigt die Stammdaten-Seite „0 Themenfelder“ mit Fehlern, fehlen meist die Unterordner `themen/` und `bilder/`, sie liegen eine Ebene zu tief (in `lerninhalte/fisi/content/`) oder die Leserechte fehlen. `CHANGELOG.md` und `LICENSE` aus `content/` dürfen mit im Ordner liegen; das Portal liest sie nicht.

Danach schaltet ein Ausbilder das Paket unter **Verwaltung → Stammdaten** am Ausbildungsberuf ein („Lernmodul“). Azubis dieses Berufs sehen dann den Menüpunkt „Lernen“.

Inhalte aktualisieren: Dateien ändern (z. B. `git pull` im Lernkompass) und `meta.json` mit neuem Stand speichern – das Portal liest das Paket innerhalb weniger Sekunden neu ein, ohne Neustart. Fehler in den Dateien stehen im Log des Portals; eine fehlerhafte Datei ersetzt die zuletzt gültige Fassung nicht.

Mehr dazu im README des Portals, Abschnitt „Lernmodul“.

## Einreichen über das Portal

Ausbilder können ein Inhaltspaket auch als ZIP-Datei im Portal einreichen (Seite „Lerninhalte“). Der Super-Admin prüft es und lädt es hoch. Solche Pakete liegen **nicht hier**, sondern im Datenordner des Portals unter `data/lerninhalte/<kennung>/` – dieser Ordner hier ist im Container nur lesend eingebunden. Gibt es dieselbe Kennung an beiden Orten, gilt das über das Portal hochgeladene Paket. Um wieder das Paket aus diesem Ordner zu verwenden, den Ordner `data/lerninhalte/<kennung>/` löschen.

## Planer für die Prüfung

Mit der Datei `planer.md` bekommt ein Beruf einen Planer für das Prüfungsvorhaben (Abschlussprojekt, Gesellenstück, Fachaufgabe …): Termine, Checklisten, Zeitplanung, Fragen zum Üben, Links. Azubis sehen ihn, sobald ein Ausbilder ihn in ihrem Profil freischaltet. Der Aufbau der Datei steht im Handbuch des Portals (Rolle Ausbilder, Kapitel „Planer für einen Beruf erstellen: Aufbau der Datei“).

Die Datei gehört nicht zum Format des FISI-Lernkompass; der Lernkompass liest sie nicht.

**Kennungen nicht ändern:** Was Azubis eintragen, hängt an den Kennungen (`{#…}`) der Termine, Punkte und Fragen. Texte dürfen sich ändern, Kennungen nicht – sonst gehören umbenannte Kennungen in den Abschnitt `## Umbenennungen` der Datei.
