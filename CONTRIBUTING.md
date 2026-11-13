# Mitarbeiten am Ausbildungsportal

Danke, dass du mithelfen willst. Diese Seite sagt, wie die Zusammenarbeit hier läuft – damit Bedienung, Gestaltung und Datenschutz einheitlich bleiben, egal wer eine Änderung baut.

Wer mit Claude Code arbeitet: Dieselben Regeln stehen als Arbeitsanweisung in [CLAUDE.md](CLAUDE.md) und werden dort automatisch gelesen.

## Bevor du anfängst

- **Größere Funktionen zuerst abstimmen.** Lege ein Issue an und beschreibe in ein paar Sätzen, was die Funktion tut, wer sie sieht und welche Daten sie speichert. Gebaut wird nach der Freigabe durch den Betreiber des Repositorys. Das spart Arbeit, wenn die Richtung nicht passt.
- **Kleine Korrekturen** (Tippfehler, ein Fehler mit klarer Ursache) gehen direkt als Pull Request.

## Der Ablauf

1. **Branch anlegen.** Nichts geht direkt nach `main`; der Branch ist geschützt.
2. **Ändern** – mit den Regeln unten.
3. **Versionsnummer erhöhen**, an drei Stellen gleich: `package.json`, `README.md` („Stand: Version …“) und `docs/entra-einrichtung.md` („passt zu Version …“). Ein Test prüft das. Neue Funktion: mittlere Stelle. Korrektur: letzte Stelle.
4. **`CHANGELOG.md` ergänzen:** oben ein Abschnitt `## [x.y.z] – JJJJ-MM-TT` mit `### Neu`, `### Geändert` oder `### Behoben`. In Worten, die ein Nutzer versteht – das Portal zeigt den Text unter „Versionshinweise“.
5. **Prüfen:**
   ```
   npm run typecheck
   npm test
   npm run build
   ```
   Danach die Änderung **im Browser durchspielen**, am PC und in Handybreite (390 px), hell und dunkel. Tests allein genügen nicht.
6. **Pull Request gegen `main`.** Die Vorlage mit der Checkliste erscheint von selbst. In die Beschreibung gehören: was sich ändert, was geprüft wurde, was **nicht** geprüft wurde, und ob neue Daten über Personen gespeichert werden.
7. **Mergen** tut der Betreiber des Repositorys, wenn die Prüfungen `pruefen` und `docker` grün sind.

## Was jede Änderung einhalten muss

### Bedienung

Die Checkliste in [docs/bedienregeln.md](docs/bedienregeln.md) gilt für jede Änderung an der Oberfläche. Hake sie vor dem Pull Request ab. Passt eine Regel nicht, begründe die Abweichung im Pull Request und halte sie in der Datei fest – führe kein neues Muster stillschweigend ein. Den Hintergrund erklärt [docs/iso-9241.md](docs/iso-9241.md).

Das Wichtigste in Kürze:

- Rückfragen, Bestätigungen und Fehler laufen über die vorhandenen Bausteine, nicht über Fenster des Browsers.
- Knöpfe nennen Tätigkeit und Gegenstand („Eintrag speichern“).
- Alles funktioniert am Handy, mit der Tastatur und ohne Farbe als einzigem Hinweis.
- Anrede „du“, kurze Sätze, erklärte Fachwörter. Die Azubis sind zwischen 16 und 30 Jahre alt.
- Schalter, die von der Einrichtung abhängen, werden nie ausgeblendet – sie sind gesperrt und sagen, was fehlt.

### Handbuch

Jede neue Funktion und jede Änderung wird im Handbuch beschrieben – für jede Rolle, die sie sieht – und an der Stelle im Portal verlinkt. Fällt eine Funktion weg, fällt auch ihr Kapitel weg. Wie ein Kapitel aufgebaut ist (Gruppe, Einleitung, „So geht's“, „Begriffe“, „Gut zu wissen“), steht in [docs/handbuch-regeln.md](docs/handbuch-regeln.md); ein Test prüft es.

### Führung

Beim ersten Anmelden zeigt eine Führung jeder Rolle die wichtigsten Stellen (`src/fuehrung.tsx`). Kommt ein Bereich dazu, den man am ersten Tag kennen sollte, bekommt er eine Station – für jede Rolle, die ihn sieht. Ändert sich eine Stelle, auf die eine Station zeigt, wird die Station angepasst. Danach die Führung einmal im Browser durchklicken, am PC und am Handy. Ein Test prüft, dass jede Station auf etwas zeigt, das es gibt; ob der Text noch stimmt, sieht nur ein Mensch.

### Benachrichtigungen

Bei jeder neuen Funktion fragen: Erfährt dadurch eine andere Person etwas Neues – etwa weil jemand etwas einreicht, entscheidet oder für jemanden plant? Dann gehört das Ereignis in die Glocke; Nachrichten per Teams und E-Mail hängen daran und gehen von selbst mit. Wenn nicht, steht im Pull Request ein Satz dazu, warum. Wie das geht, steht in den Bedienregeln.

### Rechte

- Jede neue Route nennt, wer sie aufrufen darf, und steht in der Rechte-Tabelle des Tests `server/test/api.test.ts`.
- Fremde Daten gibt es nicht: unbekannte oder fremde Kennung → 404, falsche Rolle → 403.
- Zu neuen Rechten gehört ein Test, der auch den verbotenen Zugriff prüft.

### Technik

- **Keine neuen Abhängigkeiten** ohne vorherige Abstimmung. Kein UI-Framework, keine CSS-Bibliothek.
- **Datenbank:** Änderungen nur als neue, fortlaufend nummerierte Datei in `server/migrations/`. Vorhandene Migrationen werden nie geändert.
- **Gestaltung:** ein Stylesheet (`src/index.css`), Farben nur über die vorhandenen Variablen (`--c-…`), damit hell und dunkel stimmen. Welche Farben und Bausteine es gibt, zeigt [docs/gestaltung.md](docs/gestaltung.md) – erst dort nachsehen, dann neu bauen.
- **Sprache:** Oberfläche, Kommentare und Bezeichner sind deutsch.

### Abläufe im Browser (E2E-Tests)

Die wichtigsten Abläufe werden im echten Browser durchgespielt: erste Anmeldung, Bericht schreiben bis abzeichnen, Urlaub beantragen bis genehmigen, Lernen, Planer, Begleiter, die Führung jeder Rolle – und jede Seite bei 390 px ohne waagerechten Überlauf. Die Tests liegen in `e2e/` und laufen bei jedem Pull Request als Prüfung `e2e`.

- Lokal: einmalig `npx playwright install chromium`, dann `npm run e2e`. Jede Testdatei startet ein eigenes Portal mit leerem Datenordner; deine Daten bleiben unberührt.
- Scheitert ein Ablauf, liegen Bildschirmfotos in `e2e/ergebnis/` (auf GitHub als Paket `e2e-bilder` am Lauf).
- Ändert sich ein abgedeckter Ablauf, wird der Test angepasst. Kommt ein wichtiger Ablauf oder eine neue Seite dazu, wird der Test ergänzt.
- In den Tests stehen nur erfundene Namen und Inhalte – keine echten Personen, keine echten Lerninhalte.

### Bildschirmfotos

Unter [docs/bilder/](docs/bilder/README.md) liegen Bildschirmfotos aller Bereiche – damit man sehen kann, wie das Portal aussieht, ohne es zu installieren. Sie entstehen automatisch: `npm run bilder` startet ein frisches Portal mit erfundenen Beispieldaten und schreibt den Ordner samt Übersicht neu. Echte Daten können so nicht hineingeraten. Die Bilder werden von Zeit zu Zeit gesammelt erneuert, nicht bei jeder Änderung. Kommt ein Bereich dazu, wird er in `e2e/bilder.ts` ergänzt.

## Datenschutz und Recht

- **Privat bleibt privat.** Lernstand, Abzeichen, Übungsergebnisse, Eintragungen im Planer für die Prüfung, private Termine und Entwürfe sieht nur der Azubi selbst. Keine Rangliste, keine Auswertung für Ausbilder, Beauftragte oder Super-Admin.
- **Neue Daten über Personen** nennst du im Pull Request ausdrücklich (was, wie lange, wer sieht es). Der Betreiber ergänzt damit die Leistungsbeschreibung für den Betriebsrat.
- **Meldungen nach außen** (Teams, Mail) enthalten so wenig wie möglich – keine Namen in Teams-Karten für Kanäle, keine Bemerkungen in Mails. Persönliche Benachrichtigungen sprechen nur die Person an, an die sie gehen, und nennen niemanden sonst.
- **Keine Geheimnisse im Repository.** Es ist öffentlich. `.env`, der Ordner `data/`, Zugangsdaten, Webhook-Adressen und echte Namen oder Mailadressen gehören nicht hinein – auch nicht in Tests, Commits oder Pull Requests.
- **Urheberrecht:** keine fremden Bilder, Grafiken oder Texte ohne passende Lizenz. Keine Original-Prüfungsaufgaben. Grafiken werden selbst gezeichnet (SVG).
- **Lerninhalte** liegen nicht in diesem Repository, sondern als Inhaltspaket daneben (siehe [lerninhalte/README.md](lerninhalte/README.md)).

## Sicherheitslücken

Bitte nicht als öffentliches Issue melden – der Weg steht in [SECURITY.md](SECURITY.md).
