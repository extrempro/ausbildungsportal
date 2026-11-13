# Barrierefreiheit nach WCAG 2.2

Stand: 13.11.2026 · Prüfung an Version 0.61.0, Maßnahmen in 0.61.1 (Tastatur), 0.61.2 (Darstellung) 0.62.0 (Zeitbegrenzung), 0.64.0 (Unterschrift) und 0.65.0 (Erklärung im Handbuch)

## Ziel

Das Portal soll die **WCAG 2.2 auf Stufe AA** erfüllen (Web Content Accessibility Guidelines des W3C). Die europäische Norm EN 301 549 baut darauf auf. Grund: Wer im Betrieb mit einer Behinderung arbeitet – blind, sehbehindert, nur mit Tastatur –, muss Bericht, Plan und Urlaub genauso erledigen können wie alle anderen. Das Berichtsheft ist Pflicht für die Zulassung zur Prüfung.

Neue Funktionen halten sich an die Punkte „Tastatur“, „Jedes Gerät“ und „Navigation“ in [bedienregeln.md](bedienregeln.md); Hintergrund zur Bedienung steht in [iso-9241.md](iso-9241.md).

## Wie geprüft wurde

- **Wer:** eine Durchsicht durch den Entwickler (hier: Claude), keine Zertifizierung durch Dritte.
- **Umfang:** 45 Seiten aus allen vier Rollen mit erfundenen Beispieldaten, hell und dunkel, bei 1280, 820, 640, 390 und 320 px; drei geöffnete Fenster.
- **Werkzeuge:** eigene Prüfskripte im Browser (Chromium über Playwright) für Kontrast, Namen und Beschriftungen, Überschriften, Bedienflächen, Seitentitel, Umbruch, Textabstände, verdeckten Fokus und Fokus in Fenstern; dazu eine Durchsicht des Codes (Zeitbegrenzung, Unterschrift, Statusmeldungen, Bewegung, Ausrichtung).
- **Dauerhaft im Test:** `e2e/11-fokus.test.ts` (Fokus nicht verdeckt, Fenster), `e2e/12-kontrast.test.ts` (Kontrast hell und dunkel, eigenes Skript), `e2e/06-handy.test.ts` (kein Überlauf bei 390 und 320 px), `e2e/10-navigation.test.ts`, `e2e/13-sitzung.test.ts` (Warnung vor dem Abmelden), `e2e/15-unterschrift.test.ts` (Unterschrift nur mit der Tastatur).

## Erfüllt

| Bereich | WCAG |
| --- | --- |
| Kontrast hell und dunkel auf allen geprüften Seiten, auch auf getönten Karten (`--c-muted-getoent`) – dunkel ab 0.61.2; Feldränder mindestens 3 : 1 | 1.4.3, 1.4.11 |
| Jedes Feld, jeder Knopf und jeder Link hat einen Namen; Symbole sind benannt oder für Vorleser ausgeblendet | 1.1.1, 4.1.2 |
| Eigener Seitentitel je Seite, Sprache Deutsch angegeben | 2.4.2, 3.1.1 |
| Sichtbarer Fokusrahmen, „Zum Inhalt springen“, Escape schließt Fenster und Menüs | 2.1.1, 2.4.1, 2.4.7 |
| Fenster holen den Fokus und halten ihn (`useFensterFokus`) – ab 0.61.1 | 2.4.3 |
| Angeheftete Leisten verdecken den Fokus nicht (`src/fokusFrei.ts`) – ab 0.61.1 | 2.4.11 |
| Bedienflächen mindestens 40 × 40 px (verlangt: 24 × 24) | 2.5.8 |
| Kein Überlauf bei 200 % Zoom (640 px) und bei 320 px (entspricht 400 %) – 320 px ab 0.61.2 | 1.4.4, 1.4.10 |
| Größere Text- und Zeilenabstände: nichts läuft über, Beschriftungen der Leiste unten brechen um statt abgeschnitten zu werden – ab 0.61.2 | 1.4.12 |
| Überschriften ohne übersprungene Ebene (Konten, Bericht) – ab 0.61.2 | 1.3.1 |
| Nicht nur Farbe: Ampel, Plan-Arten und Pillen haben immer ein Wort | 1.4.1 |
| „Gespeichert“ und Fehler werden angesagt (`role="status"`, `role="alert"`) | 4.1.3, 3.3.1 |
| Reduzierte Bewegung wird beachtet, Hoch- und Querformat | 2.3.3, 1.3.4 |
| Hilfe (Handbuch, Rückmeldung geben) in jeder Ansicht an derselben Stelle | 3.2.6 |
| Zeitbegrenzung: fünf Minuten vor dem Abmelden ein Fenster mit „Angemeldet bleiben“ (`src/sitzung.tsx`); wer mit ungespeicherten Eingaben abgemeldet wird, behält sie und meldet sich im neuen Tab an – ab 0.62.0 | 2.2.1 |
| Unterschrift ohne Zeichnen: „Unterschrift aus meinem Namen erzeugen“ unter Konto, auch nur mit der Tastatur (`src/unterschriftErzeugen.ts`) – ab 0.64.0 | 2.1.1, 2.5.7 |

## Offen

Aus der Prüfung an Version 0.61.0 ist nichts mehr offen. Neue Befunde kommen hierher.

## Nicht geprüft

- Echte Vorleseprogramme (NVDA, JAWS, VoiceOver, TalkBack) – am besten mit jemandem, der sie täglich nutzt.
- Safari, Firefox, echte Handys und Tablets, Kontrastmodus von Windows.
- Karteikarten, Quiz, Planer, Begleiter und Jahreskalender im Einzelnen mit der Tastatur.
- Inhalte der Lernmodule (Bilder, Tabellen, Grafiken) – sie kommen aus den Inhaltspaketen und werden dort gepflegt.
- Die Anmeldung über Microsoft liegt außerhalb des Portals.

## Erklärung im Portal

Das Handbuch-Kapitel „Barrierefreiheit: Was das Portal kann und was noch fehlt“ (Gruppe „Hilfe“, für alle Rollen) sagt in einfachen Worten, was erfüllt ist und was nicht geprüft wurde. Ändert sich hier etwas, wird es dort mitgezogen (Regel in [bedienregeln.md](bedienregeln.md)).

## Barrieren melden

Über „Rückmeldung geben“ (die zwei Daumen oben in der Leiste) → „Fehler melden“. Die Meldung geht an den Betreiber des Portals.
