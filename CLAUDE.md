# Arbeitsanweisung für Claude Code

Das Ausbildungsportal ist eine Mehrbenutzer-Web-App für einen Ausbildungsbetrieb: Ausbildungsplan, Berichtsheft, Urlaub, Lernmodul. Rollen: Azubi, Ausbildungsbeauftragte, Ausbilder (Anmeldung über Microsoft Entra ID) und ein lokaler Super-Admin. Eine Installation gehört zu einem Betrieb.

Die Regeln für Menschen stehen in [CONTRIBUTING.md](CONTRIBUTING.md). Diese Datei sagt dasselbe als Arbeitsanweisung und nennt die Stellen im Code. **Schreibe mit dem Nutzer und im Code deutsch.**

## Grundhaltung

- **Wenn du etwas nicht weißt oder nicht sicher bist: frag nach oder sag es.** Rate nicht. Das gilt für Fachliches (Ausbildungsrecht, Prüfungen), für die Einrichtung des Betriebs und für Annahmen über fremde Systeme.
- **Größere Funktionen erst abstimmen**, dann bauen: kurz beschreiben, was sie tut, wer sie sieht, welche Daten sie speichert – und die Freigabe abwarten.
- Sag im Abschlussbericht offen, was du **nicht** geprüft hast (echte Geräte, echter Entra-Mandant, echter Mailserver …).

## Befehle

```
npm run dev         # Entwicklung
npm run typecheck   # Typen
npm test            # alle Tests (dauert einige Minuten)
npm run build       # Oberfläche bauen
```

Node ab 22.16. Lokal ohne Microsoft anmelden: `DEV_ANMELDUNG=true` (nie im Echtbetrieb). Daten liegen in `DATA_DIR`, Lerninhalte in `LERN_DIR`.

## Aufbau

| Ort | Inhalt |
| --- | --- |
| `server/api.ts`, `server/api-basis.ts` | Einstieg der API; jede Route hat `m`, `p`, `wer`, `h` |
| `server/rechte.ts` | Rechte zentral – wer darf welchen Azubi sehen |
| `server/migrations/` | Datenbank, fortlaufend nummerierte SQL-Dateien |
| `server/test/` | Tests; `api.test.ts` enthält die Rechte-Tabelle aller Routen, `handbuch.test.ts` prüft die Handbuch-Verweise |
| `server/mail-gestalt.ts` | das gemeinsame Aussehen aller Mails (`gestalteMail`) – neue Mails nicht von Hand gestalten |
| `server/aktivitaet.ts`, `server/benachrichtigung.ts` | Glocke und – daran angehängt – Benachrichtigungen per Teams und E-Mail (ohne Namen, nur für Berechtigte) |
| `server/lernen.ts`, `server/lernen/` | Lernmodul (Inhaltspakete, Lernstand, Abzeichen, Üben) |
| `src/App.tsx`, `src/router.tsx` | Seiten und eigener Router (`geheZu`, `<Link>`, `useUngespeichert`) |
| `src/pages/` | je Seite eine Datei; `Handbuch.tsx` ist das Handbuch für alle Rollen |
| `src/dialoge.tsx` | `rueckfrage()`, `melde()`, `<Ladefehler>` |
| `src/index.css` | das eine Stylesheet |
| `docs/bedienregeln.md` | Checkliste für die Bedienung – **vor jedem Pull Request lesen** |
| `docs/gestaltung.md` | Farben, Schrift und vorhandene Bausteine – **vor neuem CSS lesen** |

Technik: `node:http` und `node:sqlite` ohne Server-Framework, React 19, reines CSS, esbuild. **Keine neuen Abhängigkeiten** ohne Rückfrage beim Nutzer.

## Bei jeder Änderung

1. **Branch + Pull Request.** Nie direkt nach `main`; der Nutzer mergt.
2. **Versionsnummer** an drei Stellen gleich erhöhen: `package.json`, `README.md` („Stand: Version …“), `docs/entra-einrichtung.md` („passt zu Version …“). `server/test/version.test.ts` prüft das.
3. **`CHANGELOG.md`**: neuer Abschnitt oben, `### Neu` / `### Geändert` / `### Behoben`, in Worten für Nutzer.
4. **`docs/bedienregeln.md` durchgehen** und im Abschlussbericht sagen, dass geprüft wurde und wo abgewichen wird.
5. **Handbuch mitziehen** (`src/pages/Handbuch.tsx`) – für jede Rolle, die die Änderung sieht – und an der Stelle im Portal einen `<HandbuchLink kapitel="…">` setzen. Ohne Aufforderung.
6. **Benachrichtigungen mitdenken:** Erfährt durch die Änderung eine andere Person etwas Neues? Dann gehört das Ereignis in die Glocke (`merkeAktivitaet`) – Teams und E-Mail gehen von selbst mit; neue Arten brauchen Texte in `src/glocke.tsx` und `server/benachrichtigung.ts`. Wenn nicht, im Pull Request kurz begründen. Einzelheiten in `docs/bedienregeln.md`.
7. **Neue Route:** `wer` setzen, in die Rechte-Tabelle in `server/test/api.test.ts` eintragen, den verbotenen Zugriff testen. Fremde Kennung → 404, falsche Rolle → 403.
8. **Prüfen:** `npm run typecheck`, `npm test`, `npm run build` – und die Änderung **im Browser durchspielen**: PC und 390 px, hell und dunkel, ohne waagerechten Überlauf, ohne Fehler in der Konsole.
9. **Neue Daten über Personen oder neue Rechte:** im Pull Request ausdrücklich nennen (für die Leistungsbeschreibung an den Betriebsrat).

## Bedienung und Gestaltung – die häufigsten Punkte

Vollständig in `docs/bedienregeln.md` (Verhalten) und `docs/gestaltung.md` (Aussehen). Nimm vorhandene Bausteine, bevor du etwas neu baust.

- **Rückfrage:** `rueckfrage(text, { ja: 'Konto löschen', gefahr: true })` – nie `window.confirm`.
- **Bestätigung:** `melde('…')`. **Fehler:** an der Stelle, `.hinweis.fehler` mit `role="alert"`.
- **Ungespeichertes:** `useUngespeichert()`; Seitenwechsel nur über `geheZu` oder `<Link>`.
- **Knöpfe:** Tätigkeit + Gegenstand. Hauptknopf `.knopf`, Nebenknopf `.knopf.schlicht`. Gefüllter roter Knopf ist `knopf rot`; `.gefahr` ist nur rote Schrift für schlichte Knöpfe.
- **Aufklappen:** `details.karte` oder `details.klapp` – keine eigene Bauform.
- **Plan-Einträge:** immer über `EintragFelder` (`src/eintragFelder.tsx`).
- **Personen:** `<Avatar>` aus `src/avatar.tsx`.
- **Farben:** nur über die Variablen `--c-…` in `src/index.css` (hell und dunkel sind dort festgelegt). Keine festen Farbwerte in neuen Regeln.
- **Schmal und breit:** Hilfsklassen `nur-breit`, `nur-schmal`, `nicht-drucken`, `nur-vorleser`. Das Attribut `hidden` wird vom Stylesheet überschrieben – Elemente stattdessen bedingt rendern.
- **Einrichtungs-Schalter** nie ausblenden: sperren und erklären, was fehlt.
- **Sprache:** „du“, kurze Sätze, erklärte Fachwörter (Azubis sind 16 bis 30). Feste Begriffe: Bericht, Azubi, Ausbildungsbeauftragte, Planbaustein, Sammelplanung.
- **Geräte:** PC, Tablet, Handy. Bedienflächen mindestens 40 × 40 px, Schrift mindestens 12 px.

## Datenschutz und Recht – nicht verhandelbar

- Lernstand, Abzeichen, Übungsergebnisse, private Termine und Entwürfe sind **privat für den Azubi**: keine Route und keine Ansicht für Ausbilder, Beauftragte oder Super-Admin, keine Rangliste.
- Teams-Karten ohne Namen. Benachrichtigungen nennen nur die Person, an die sie gehen (Anrede mit Vornamen) – keine anderen Namen, keine Inhalte. Mails an die Personalstelle ohne Bemerkung und ohne Begründung.
- Geheimnisse (Webhook-Adressen, SMTP-Zugang, Kalender-Link) stehen nur in `.env` und werden nie protokolliert.
- Das Repository ist **öffentlich**: keine privaten Daten, keine echten Namen oder Mailadressen, kein `data/`, keine `.env` – auch nicht in Tests, Commits und Pull-Request-Texten.
- Keine fremden Bilder, Grafiken oder Texte ohne Lizenz; keine Original-Prüfungsaufgaben. Grafiken selbst als SVG zeichnen.
- Lerninhalte gehören nicht in dieses Repository (siehe `lerninhalte/README.md`).

## Commits und Pull Requests

- Commit-Nachricht und Pull-Request-Text deutsch.
- Der Pull Request folgt der Vorlage `.github/pull_request_template.md` (Checkliste abhaken) und nennt: was sich ändert, was geprüft wurde, was nicht geprüft wurde, Abweichungen von den Bedienregeln, neue Daten über Personen.
- Keine Links auf Claude-Sitzungen in Commits oder Pull Requests.
