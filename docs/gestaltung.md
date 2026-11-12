# Gestaltung

Stand: 11.11.2026 · gilt ab Version 0.39.3

Diese Seite zeigt, woraus die Oberfläche gebaut ist: Farben, Schrift, Bausteine. Sie ergänzt die [Bedienregeln](bedienregeln.md) – dort steht, **wie** sich das Portal verhält, hier, **wie es aussieht**. Maßgeblich bleibt `src/index.css`; diese Seite ist der Wegweiser dorthin.

**Grundsatz:** Erst nachsehen, ob es den Baustein schon gibt. Neue Klassen nur, wenn keiner passt – und dann aus denselben Farben, Abständen und Rundungen gebaut.

## Farben

Farben stehen nur einmal fest: als Variablen am Anfang von `src/index.css`, je einmal für hell (`:root`) und dunkel (`html.dark`). Neue Regeln verwenden **nur diese Variablen**, nie feste Farbwerte – sonst stimmt die dunkle Darstellung nicht.

| Variable | Wofür |
| --- | --- |
| `--c-bg` | Hintergrund der Seite |
| `--c-card` | Fläche von Karten, Fenstern, Feldern |
| `--c-text` | normaler Text |
| `--c-muted` | Nebentext (Klasse `.leise`) |
| `--c-border` | Linien und Rahmen |
| `--c-rand-feld` | Rahmen von Eingabefeldern (dunkler, damit das Feld als Feld erkennbar ist) |
| `--c-accent`, `--c-on-accent` | Hauptknopf, Links, aktive Auswahl – und die Schrift darauf |
| `--c-accent-soft` | leicht getönte Fläche: aktuelle Woche, aktiver Menüpunkt, eingeklappte Bereiche |
| `--c-chip`, `--c-code` | neutrale kleine Flächen: graue Marken, Code |
| `--c-track` | Schiene von Fortschrittsbalken |
| `--c-gruen-bg`, `--c-gruen-fg` | gut, erledigt, Einsatz |
| `--c-warn-bg`, `--c-warn-fg` | Hinweis, wartet, Achtung |
| `--c-rot-bg`, `--c-rot-fg` | Fehler, abgelehnt, endgültig |
| `--c-schule`, `--c-schule-soft` | Berufsschule |
| `--c-ferien`, `--c-ferien-soft` | Schulferien |
| `--c-schatten` | Schatten von Karten |

Regeln dazu:

- **Farbpaare gehören zusammen:** Text in `…-fg` steht auf `…-bg`. Diese Paare sind auf Kontrast geprüft (mindestens 4,5:1), frei gemischte nicht.
- **Farbe trägt nie allein die Bedeutung.** Der Stand steht immer auch als Wort da („Abgezeichnet“, „Falsch“).
- **Einzige feste Farbe:** der gefüllte rote Knopf (`.knopf.rot`), weil Weiß auf Rot in beiden Darstellungen gleich bleiben soll.
- **Hell und dunkel:** Die Klasse `dark` an `<html>` schaltet um (Einstellung des Nutzers oder des Geräts). Jede Änderung wird in beiden Darstellungen angesehen.
- **Grafiken (SVG):** Farben über die Klassen `sv-…` in `src/index.css`, damit auch sie umschalten.

**Ausnahme Begleiter:** Die fünf Figuren des Begleiters (`src/begleiter/figuren.tsx`) haben eigene Farben `--bf-…` (Fell, Bauch, Schnabel, Zubehör …), festgelegt an `.bf` und für dunkel an `html.dark .bf`. Sie gelten nur innerhalb der Figur. Neue Figuren oder Teile werden selbst gezeichnet (SVG, Strichstärke wie die vorhandenen) und nehmen diese Variablen.

## Schrift und Abstände

- **Schrift:** Inter, sonst die Schrift des Geräts. Für Code und Passwörter JetBrains Mono, sonst die Festbreitenschrift des Geräts. Es werden keine Schriften aus dem Netz geladen.
- **Größen:** Fließtext 16 px, Nebentext 14 px (`.klein`), Marken 12 px. Überschriften: `h1` 30 px, `h2` 20 px, `h3` 16 px.
- **Kleinste Schrift für Text: 12 px.** Kleiner sind nur Beschriftungen in Grafiken und einzelne Kürzel (z. B. Monatsnamen im kleinen Jahresband) – nichts, was man zum Bedienen lesen muss.
- **Abstände** in Schritten von 4 px: meist 8, 12, 16, 24 px. Karten haben 24 px Innenabstand und 24 px Abstand nach unten.
- **Rundungen:** Karten groß (12–16 px), Knöpfe und Felder 8–10 px, Marken 6 px, Personen und Zähler rund.
- **Breite:** Der Inhalt ist höchstens 1200 px breit, schmale Seiten (Anmeldung) 480 px.

## Bausteine

### Knöpfe

| Klasse | Aussehen | Wofür |
| --- | --- | --- |
| `.knopf` | gefüllt, Akzentfarbe | die **eine** Haupthandlung eines Bereichs; steht zuerst |
| `.knopf.schlicht` | Rahmen, ohne Füllung | alles daneben („Abbrechen“, „Zurück“) |
| `.knopf.schlicht.gefahr` | wie schlicht, rote Schrift | Endgültiges neben anderen Knöpfen („Eintrag löschen“) |
| `.knopf.rot` | gefüllt rot | Endgültiges als Haupthandlung, v. a. in der Rückfrage |
| `.knopf.klein` | niedriger | in Listen und Zeilen |
| `.knopf.symbol` | nur Symbol | braucht `aria-label` und `title` |
| `.link-knopf` | sieht aus wie ein Link | kleine Handlung im Text („Bearbeiten“) |

- Knöpfe sind mindestens 44 px hoch, kleine mindestens 40 px.
- Knopfzeilen stehen in `.aktionen` (rechtsbündig) oder `.aktionen.links` – als `<div>` oder `<p>`. Die Klasse sorgt für 8 px Abstand zwischen den Knöpfen und den Umbruch am Handy; Knöpfe nie ohne sie nebeneinander setzen.
- **Achtung:** `.gefahr` allein färbt nur die Schrift rot. Auf einem gefüllten Knopf ergibt das rote Schrift auf Blau – dafür ist `.knopf.rot` da.

### Karten und Aufklappen

- **`.karte`** – der Kasten für alles, was zusammengehört: weiße Fläche, Rahmen, weicher Schatten.
- **`details.karte`** – eine ganze Karte zum Aufklappen.
- **`details.klapp`** – Aufklappen innerhalb einer Karte oder eines Fensters (`frei` ohne Rahmen, `schmal` für schmale Spalten).
- **`.anleitung`** – Karte mit Hilfetext, die sich merkt, ob sie offen ist.
- **`.kacheln` / `.kachel`** – Zahl mit Ziel auf der Startseite.

Eine andere Bauform zum Aufklappen gibt es nicht (siehe Bedienregeln).

### Meldungen

| Baustein | Aussehen | Wofür |
| --- | --- | --- |
| `.hinweis` | gelbe Fläche | Hinweis, der beachtet werden soll |
| `.hinweis.fehler` + `role="alert"` | rote Fläche | Fehler, an der betroffenen Stelle |
| `.hinweis.gut` | grüne Fläche | dauerhaft sichtbarer guter Stand |
| `melde('…')` | Leiste unten, verschwindet | Bestätigung nach einer Handlung |
| `rueckfrage(…)` | eigenes Fenster | Nachfrage vor Folgenreichem |
| `<Ladefehler>` | Überschrift bleibt, Fehler darunter | Seite ließ sich nicht laden |

### Marken (`.pille`)

Kleine Wörter für einen Stand, 12 px: `gruen` (gut, erledigt), `gelb` (wartet, Achtung), `rot` (Fehler, abgelehnt), `blau` (Auswahl, Hinweis), `grau` (neutral), `violett` (Berufsschule), `ferien`. Dazu `umrandet` und `voll` als Formen. In einer Marke steht immer ein Wort, nie nur Farbe.

### Formulare

- Jedes Feld steckt in einem `<label>` mit sichtbarer Beschriftung.
- Mehrere Felder nebeneinander: `.reihe` – sie brechen am Handy von selbst um.
- Haken: `label.haken`.
- Plan-Einträge immer über `EintragFelder` (`src/eintragFelder.tsx`), nie als eigenes Formular.

### Weitere Bausteine

- **Personen:** `<Avatar name bild>` aus `src/avatar.tsx` – Bild oder Anfangsbuchstaben im Kreis.
- **Symbole:** `<Icon name="…">` aus `src/icons.tsx`, eigene Zeichnungen. Neue Symbole kommen dort hinzu; keine Symbol-Bibliothek, keine Emojis als Bedienelement.
- **Verweis ins Handbuch:** `<HandbuchLink kapitel="…">`.
- **Tabellen:** normales `<table>`; unter 700 px werden sie zur Liste, die Spaltenüberschrift steht dann vor jedem Wert.
- **Hauptnavigation:** Symbol über dem Wort (`.nav-symbol`, `.nav-text`), am PC oben, sonst unten. Ein neuer Menüpunkt braucht ein Symbol aus `src/icons.tsx`.
- **Reiter und Filter:** `.filter` mit Knöpfen bzw. `<Link>`.
- **Fenster:** `.dialog` – am Handy kommt es von unten.

## Breiten

| Gerät | Breite | Was sich ändert |
| --- | --- | --- |
| PC, Tablet quer | ab 1024 px | Navigation oben, Seitenleisten sichtbar |
| Tablet hoch | 700–1023 px | Navigation unten; Seitenleisten (z. B. im Plan) entfallen |
| Handy | unter 700 px | Tabellen als Liste, Fenster von unten |

- Geprüft wird bei **390 px**: kein waagerechtes Schieben.
- Hilfsklassen: `nur-breit`, `nur-schmal`, `nicht-drucken`, `nur-drucken`, `nur-vorleser` (nur für Vorleseprogramme).
- **Nicht `hidden` verwenden**, um etwas auszublenden – das Stylesheet überschreibt es an mehreren Stellen. Stattdessen das Element gar nicht erst ausgeben.
- Fällt am Handy eine Seitenleiste weg, braucht ihr Inhalt dort einen anderen Platz (Beispiel: die Liste „Abteilungen“ im Plan steht am Handy zum Aufklappen über den Wochen).

## Bewegung, Fokus, Druck

- **Bewegung** nur innerhalb von `@media (prefers-reduced-motion: no-preference)`. Wer am Gerät Bewegung abgestellt hat, sieht keine.
- **Fokus:** Der blaue Rahmen (3 px) für die Tastatur bleibt überall sichtbar und wird nicht entfernt.
- **Druck:** Was auf Papier nichts zu suchen hat (Knöpfe, Navigation), bekommt `nicht-drucken`.

Die Animationen des Begleiters (neues Teil, Konfetti, Sprechblase) stehen vollständig in `@media (prefers-reduced-motion: no-preference)` – bei „Bewegung reduzieren“ bleibt ein ruhiges Bild. Ton gibt es nicht.

## Wenn etwas Neues nötig ist

1. Nachsehen, ob ein Baustein oben passt – auch wenn er etwas anders aussieht als gedacht.
2. Wenn nicht: neue Klassen am Ende von `src/index.css`, mit einer Überschrift als Kommentar, nur aus den Variablen oben.
3. In hell und dunkel, am PC und bei 390 px ansehen.
4. Wird daraus ein Baustein, den andere brauchen können: hier eintragen.
