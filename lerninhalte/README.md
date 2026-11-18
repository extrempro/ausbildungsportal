# Lerninhalte

In diesen Ordner gehören die Inhaltspakete des Lernmoduls – **ein Unterordner je Paket**. Die Inhalte selbst liegen nicht im Repository des Portals (siehe `.gitignore`).

```
lerninhalte/
  mein-beruf/              Ordnername = Kennung des Pakets (a–z, 0–9, Bindestrich)
    paket.json             freiwillig: { "titel": "…", "quelle": "…", "lizenz": "…" }
    meta.json              { "stand": "JJJJ-MM-TT" }
    themenfelder.json      Reihenfolge der Themenfelder
    themen/<id>.md         ein Cheatsheet je Themenfeld
    bilder/*.svg           Grafiken
    umbenennungen.json     freiwillig: alte → neue Kennungen
    planer.md              freiwillig: Planer für die Prüfung (z. B. Abschlussprojekt)
```

Ein Paket kommt als Ordner auf den Server – **mit Unterordnern** (`cp -r` bzw. `scp -r`):

```bash
scp -r benutzer@rechner:/pfad/mein-beruf/. lerninhalte/mein-beruf/
chmod -R a+rX lerninhalte/mein-beruf      # das Portal läuft im Container nicht als root
```

Liegt der Ordner woanders, lässt er sich auch verlinken (ohne Docker) oder mit Docker einbinden (in `docker-compose.override.yml`):

```bash
ln -s /pfad/mein-beruf lerninhalte/mein-beruf
```

```yaml
services:
  app:
    volumes:
      - /pfad/mein-beruf:/app/lerninhalte/mein-beruf:ro
```

Zeigt die Stammdaten-Seite „0 Themenfelder“ mit Fehlern, fehlen meist die Unterordner `themen/` und `bilder/`, sie liegen eine Ebene zu tief (etwa in `lerninhalte/mein-beruf/content/`) oder die Leserechte fehlen. Andere Dateien wie `CHANGELOG.md` oder `LICENSE` dürfen mit im Ordner liegen; das Portal liest sie nicht.

Danach schaltet ein Ausbilder das Paket unter **Verwaltung → Stammdaten** am Ausbildungsberuf ein („Lernmodul“). Azubis dieses Berufs sehen dann den Menüpunkt „Lernen“.

Inhalte aktualisieren: Dateien ändern und `meta.json` mit neuem Stand speichern – das Portal liest das Paket innerhalb weniger Sekunden neu ein, ohne Neustart. Fehler in den Dateien stehen im Log des Portals; eine fehlerhafte Datei ersetzt die zuletzt gültige Fassung nicht.

Mehr dazu im README des Portals, Abschnitt „Lernmodul“.

## Einreichen über das Portal

Ausbilder können ein Inhaltspaket auch als ZIP-Datei im Portal einreichen (Seite „Lerninhalte“). Der Super-Admin prüft es und lädt es hoch. Solche Pakete liegen **nicht hier**, sondern im Datenordner des Portals unter `data/lerninhalte/<kennung>/` – dieser Ordner hier ist im Container nur lesend eingebunden. Gibt es dieselbe Kennung an beiden Orten, gilt das über das Portal hochgeladene Paket. Um wieder das Paket aus diesem Ordner zu verwenden, den Ordner `data/lerninhalte/<kennung>/` löschen.

## Lerninhalte für alle Berufe

Ein Paket kann zusätzlich für alle Azubis gelten – gedacht für Anleitungen, die in jedem Beruf passen (zum Beispiel „Arbeiten und Prüfung“). Es hat dasselbe Format wie jedes andere Paket und kommt auf demselben Weg auf den Server. Ein Ausbilder legt es unter Verwaltung → Stammdaten im Feld „Lerninhalte für alle Berufe“ fest. Azubis lesen es dann unter „Lernen“ – ohne Ampel, Üben und Abzeichen.

## Planer für die Prüfung

Mit der Datei `planer.md` bekommt ein Beruf einen Planer für das Prüfungsvorhaben (Abschlussprojekt, Gesellenstück, Fachaufgabe …): Termine, Checklisten, Zeitplanung, Fragen zum Üben, Links. Azubis sehen ihn, sobald ein Ausbilder ihn in ihrem Profil freischaltet. Der Aufbau der Datei steht im Handbuch des Portals (Rolle Ausbilder, Kapitel „Planer für einen Beruf erstellen: Aufbau der Datei“).

**Kennungen nicht ändern:** Was Azubis eintragen, hängt an den Kennungen (`{#…}`) der Termine, Punkte und Fragen. Texte dürfen sich ändern, Kennungen nicht – sonst gehören umbenannte Kennungen in den Abschnitt `## Umbenennungen` der Datei.
