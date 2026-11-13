# Barrierefreiheit nach WCAG 2.2

Stand: 13.11.2026 · Prüfung an Version 0.61.0, erste Maßnahmen in 0.61.1

## Ziel

Das Portal soll die **WCAG 2.2 auf Stufe AA** erfüllen (Web Content Accessibility Guidelines des W3C). Die europäische Norm EN 301 549 baut darauf auf. Grund: Wer im Betrieb mit einer Behinderung arbeitet – blind, sehbehindert, nur mit Tastatur –, muss Bericht, Plan und Urlaub genauso erledigen können wie alle anderen. Das Berichtsheft ist Pflicht für die Zulassung zur Prüfung.

Neue Funktionen halten sich an die Punkte „Tastatur“, „Jedes Gerät“ und „Navigation“ in [bedienregeln.md](bedienregeln.md); Hintergrund zur Bedienung steht in [iso-9241.md](iso-9241.md).

## Wie geprüft wurde

- **Wer:** eine Durchsicht durch den Entwickler (hier: Claude), keine Zertifizierung durch Dritte.
- **Umfang:** 45 Seiten aus allen vier Rollen mit erfundenen Beispieldaten, hell und dunkel, bei 1280, 820, 640, 390 und 320 px; drei geöffnete Fenster.
- **Werkzeuge:** eigene Prüfskripte im Browser (Chromium über Playwright) für Kontrast, Namen und Beschriftungen, Überschriften, Bedienflächen, Seitentitel, Umbruch, Textabstände, verdeckten Fokus und Fokus in Fenstern; dazu eine Durchsicht des Codes (Zeitbegrenzung, Unterschrift, Statusmeldungen, Bewegung, Ausrichtung).
- **Dauerhaft im Test:** `e2e/11-fokus.test.ts` (Fokus nicht verdeckt, Fenster), `e2e/06-handy.test.ts` (kein Überlauf), `e2e/10-navigation.test.ts`.

## Erfüllt

| Bereich | WCAG |
| --- | --- |
| Kontrast in heller Darstellung auf allen geprüften Seiten; Feldränder mindestens 3 : 1 | 1.4.3, 1.4.11 |
| Jedes Feld, jeder Knopf und jeder Link hat einen Namen; Symbole sind benannt oder für Vorleser ausgeblendet | 1.1.1, 4.1.2 |
| Eigener Seitentitel je Seite, Sprache Deutsch angegeben | 2.4.2, 3.1.1 |
| Sichtbarer Fokusrahmen, „Zum Inhalt springen“, Escape schließt Fenster und Menüs | 2.1.1, 2.4.1, 2.4.7 |
| Fenster holen den Fokus und halten ihn (`useFensterFokus`) – ab 0.61.1 | 2.4.3 |
| Angeheftete Leisten verdecken den Fokus nicht (`src/fokusFrei.ts`) – ab 0.61.1 | 2.4.11 |
| Bedienflächen mindestens 40 × 40 px (verlangt: 24 × 24) | 2.5.8 |
| Kein Überlauf bei 200 % Zoom (640 px) | 1.4.4 |
| Nicht nur Farbe: Ampel, Plan-Arten und Pillen haben immer ein Wort | 1.4.1 |
| „Gespeichert“ und Fehler werden angesagt (`role="status"`, `role="alert"`) | 4.1.3, 3.3.1 |
| Reduzierte Bewegung wird beachtet, Hoch- und Querformat | 2.3.3, 1.3.4 |
| Hilfe (Handbuch, Rückmeldung geben) in jeder Ansicht an derselben Stelle | 3.2.6 |

## Offen

| Befund | WCAG | Plan |
| --- | --- | --- |
| Abmelden nach 8 Stunden ohne Vorwarnung – nicht gespeicherter Text geht verloren | 2.2.1 | Hinweis vor Ablauf mit „Angemeldet bleiben“ |
| Bericht einreichen und abzeichnen nur mit gezeichneter Unterschrift | 2.1.1 / 2.5.7 (formal Ausnahme) | Weg ohne Zeichnen – muss vorher fachlich geklärt werden |
| Bei 320 px ragen die Pille „Feiertag: …“ und die Karten der Sammelplanung 6 px über den Rand | 1.4.10 | umbrechen lassen |
| Dunkle Darstellung: graue Zusatzzeilen auf getönten Karten 3,8 bis 4,5 : 1 | 1.4.3 | Textfarbe statt Grau in getönten Karten |
| Vergrößerte Textabstände: Startseite am Handy läuft über, „Berichtsheft“ in der Leiste unten wird abgeschnitten | 1.4.12 | Beschriftung umbrechen |
| Überschrift springt von h1 auf h3 (Konten, Bericht) | 1.3.1 (Empfehlung) | Ebene anpassen |

## Nicht geprüft

- Echte Vorleseprogramme (NVDA, JAWS, VoiceOver, TalkBack) – am besten mit jemandem, der sie täglich nutzt.
- Safari, Firefox, echte Handys und Tablets, Kontrastmodus von Windows.
- Karteikarten, Quiz, Planer, Begleiter und Jahreskalender im Einzelnen mit der Tastatur.
- Inhalte der Lernmodule (Bilder, Tabellen, Grafiken) – sie kommen aus den Inhaltspaketen und werden dort gepflegt.
- Die Anmeldung über Microsoft liegt außerhalb des Portals.

## Barrieren melden

Über „Rückmeldung geben“ (die zwei Daumen oben in der Leiste) → „Fehler melden“. Die Meldung geht an den Betreiber des Portals.
