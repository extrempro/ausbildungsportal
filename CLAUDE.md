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
npm run e2e         # Abläufe im Browser (Playwright); einmalig vorher: npx playwright install chromium
npm run build       # Oberfläche bauen
npm run bilder      # Bildschirmfotos in docs/bilder/ neu erzeugen (erfundene Daten)
```

Node ab 22.16. Lokal ohne Microsoft anmelden: `DEV_ANMELDUNG=true` (nie im Echtbetrieb). Daten liegen in `DATA_DIR`, Lerninhalte in `LERN_DIR`.

## Aufbau

| Ort | Inhalt |
| --- | --- |
| `server/api.ts`, `server/api-basis.ts` | Einstieg der API; jede Route hat `m`, `p`, `wer`, `h` |
| `server/rechte.ts` | Rechte zentral – wer darf welchen Azubi sehen |
| `server/migrations/` | Datenbank, fortlaufend nummerierte SQL-Dateien |
| `e2e/` | End-to-End-Tests im Browser (Playwright mit `node:test`): je Datei ein frisches Portal mit erfundenen Daten (`e2e/hilfe.ts`); Abläufe je Rolle, Führung, 390 px ohne Überlauf, Handbuch-Verweise. Bildschirmfotos von Fehlern in `e2e/ergebnis/` |
| `e2e/bilder.ts`, `docs/bilder/` | Bildschirmfotos aller Bereiche mit erfundenen Beispieldaten, im Repository abgelegt (z. B. für den Betriebsrat); `npm run bilder` schreibt den Ordner samt Übersicht `docs/bilder/README.md` neu |
| `server/test/` | Tests; `api.test.ts` enthält die Rechte-Tabelle aller Routen, `handbuch.test.ts` prüft die Handbuch-Verweise |
| `server/berichte.ts`, `server/bericht-anhang.ts` | Berichtsheft (Wochen- und Tagesform) und Fotos/Dateien an Berichten – Dateityp am Dateianfang geprüft, Rechte wie der Bericht |
| `server/firmentermin.ts` | Firmentermine für alle (Stammdaten) – reine Übersicht in Plan und Jahreskalender, bewusst ohne Glocke und nicht im Berichtsheft |
| `server/meldungen.ts`, `src/fehler.tsx`, `src/pages/Rueckmeldungen.tsx`, `src/pages/Meldungen.tsx` | „Rückmeldung geben“ (Zettel mit Stift in der Kopfzeile), drei Arten: Fehler (nur Super-Admin), Idee fürs Portal (Super-Admin bearbeitet, Ausbilder lesen mit), Wunsch zu Lerninhalten (nur Azubis; **ohne Person gespeichert**, nur für Ausbilder) |
| `server/mail-gestalt.ts` | das gemeinsame Aussehen aller Mails (`gestalteMail`) – neue Mails nicht von Hand gestalten |
| `server/aktivitaet.ts`, `server/benachrichtigung.ts` | Glocke und – daran angehängt – Benachrichtigungen per Teams und E-Mail (ohne Namen, nur für Berechtigte) |
| `server/lernen.ts`, `server/lernen/` | Lernmodul (Inhaltspakete, Lernstand, Abzeichen, Üben); dazu ein Paket „für alle Berufe“ (Einstellung `lern_allgemein`, in den Stammdaten festgelegt), das jeder Azubi unter `/anleitungen` nur liest – ohne Lernstand, nichts wird gespeichert |
| `server/planer.ts`, `server/lernen/planer.ts` | Planer für das Prüfungsvorhaben (z. B. Abschlussprojekt): Inhalt aus `planer.md` im Inhaltspaket, Freischaltung je Azubi im Profil, Eintragungen privat – nur die Termine stehen im Plan |
| `server/begleiter.ts`, `src/begleiter.tsx`, `src/begleiter/figuren.tsx` | Begleiter der Azubis: selbst gezeichnete Figur mit Zubehör, das sich über die Ausbildungszeit verteilt – freiwillig, privat, ohne Punkte; Schalter für das ganze Portal beim Super-Admin |
| `server/begleiter-erinnerung.ts` | woran der Begleiter erinnert (fehlender Bericht, Berufsschule, Firmentermin, Prüfung, Urlaub, Unterschrift) – bei jeder Abfrage neu errechnet, nichts gespeichert, nie ans Lernen; neue Arten dort, in `ERINNERUNGEN` in `src/begleiter.tsx` und im Handbuch |
| `src/fuehrung.tsx` | die Führung beim ersten Anmelden, je Rolle eine Folge von Stationen; `server/test/fuehrung.test.ts` prüft, dass jede Station auf etwas zeigt, das es gibt |
| `src/App.tsx`, `src/router.tsx` | Seiten und eigener Router (`geheZu`, `<Link>`, `useUngespeichert`) |
| `src/pages/` | je Seite eine Datei; `Handbuch.tsx` ist das Handbuch für alle Rollen |
| `src/dialoge.tsx` | `rueckfrage()`, `melde()`, `<Ladefehler>` |
| `src/index.css` | das eine Stylesheet |
| `docs/bedienregeln.md` | Checkliste für die Bedienung – **vor jedem Pull Request lesen** |
| `docs/gestaltung.md` | Farben, Schrift und vorhandene Bausteine – **vor neuem CSS lesen** |
| `docs/handbuch-regeln.md` | Aufbau eines Handbuch-Kapitels (Gruppe, Einleitung, „So geht's“, „Begriffe“, „Gut zu wissen“) – **vor jedem neuen oder geänderten Kapitel lesen**; `handbuch.test.ts` prüft es |

Technik: `node:http` und `node:sqlite` ohne Server-Framework, React 19, reines CSS, esbuild; für die E2E-Tests Playwright (nur Entwicklung). **Keine neuen Abhängigkeiten** ohne Rückfrage beim Nutzer.

## Bei jeder Änderung

1. **Branch + Pull Request.** Nie direkt nach `main`; der Nutzer mergt.
2. **Versionsnummer** an drei Stellen gleich erhöhen: `package.json`, `README.md` („Stand: Version …“), `docs/entra-einrichtung.md` („passt zu Version …“). `server/test/version.test.ts` prüft das.
3. **`CHANGELOG.md`**: neuer Abschnitt oben, `### Neu` / `### Geändert` / `### Behoben`, in Worten für Nutzer.
4. **`docs/bedienregeln.md` durchgehen** und im Abschlussbericht sagen, dass geprüft wurde und wo abgewichen wird.
5. **Handbuch mitziehen** (`src/pages/Handbuch.tsx`) – für jede Rolle, die die Änderung sieht – und an der Stelle im Portal einen `<HandbuchLink kapitel="…">` setzen. Ohne Aufforderung. Aufbau nach `docs/handbuch-regeln.md`.
6. **Führung mitziehen** (`src/fuehrung.tsx`): Kommt ein Bereich dazu, den jemand am ersten Tag kennen sollte, oder ändert sich eine Stelle, auf die eine Station zeigt? Dann Station ergänzen oder anpassen – für jede Rolle – und die Führung im Browser durchklicken. Wenn nicht, im Pull Request kurz begründen.
7. **Benachrichtigungen mitdenken:** Erfährt durch die Änderung eine andere Person etwas Neues? Dann gehört das Ereignis in die Glocke (`merkeAktivitaet`) – Teams und E-Mail gehen von selbst mit; neue Arten brauchen Texte in `src/glocke.tsx` und `server/benachrichtigung.ts`. Wenn nicht, im Pull Request kurz begründen. Einzelheiten in `docs/bedienregeln.md`.
8. **Neue Route:** `wer` setzen, in die Rechte-Tabelle in `server/test/api.test.ts` eintragen, den verbotenen Zugriff testen. Fremde Kennung → 404, falsche Rolle → 403.
9. **Prüfen:** `npm run typecheck`, `npm test`, `npm run build`, `npm run e2e` – und die Änderung **im Browser durchspielen**: PC und 390 px, hell und dunkel, ohne waagerechten Überlauf, ohne Fehler in der Konsole. Ändert sich ein Ablauf, den ein E2E-Test abdeckt, den Test anpassen; kommt ein wichtiger Ablauf oder eine Seite dazu, den Test ergänzen (neue Seiten in die Liste in `e2e/06-handy.test.ts`). Die E2E-Tests ersetzen das Durchspielen nicht.
10. **Bildschirmfotos:** Sieht eine fotografierte Ansicht danach merklich anders aus oder kommt ein Bereich dazu, im Abschlussbericht daran erinnern, dass die Bilder in `docs/bilder/` veraltet sind. Neu erzeugt (`npm run bilder`, neue Ansichten in `e2e/bilder.ts` ergänzen) wird gesammelt, wenn der Nutzer es sagt – nicht bei jeder kleinen Änderung, die Bilder sind groß. In den Bildern stehen nur erfundene Namen und Inhalte.
11. **Neue Daten über Personen oder neue Rechte:** im Pull Request ausdrücklich nennen (für die Leistungsbeschreibung an den Betriebsrat).

## Bedienung und Gestaltung – die häufigsten Punkte

Vollständig in `docs/bedienregeln.md` (Verhalten) und `docs/gestaltung.md` (Aussehen). Nimm vorhandene Bausteine, bevor du etwas neu baust.

- **Rückfrage:** `rueckfrage(text, { ja: 'Konto löschen', gefahr: true })` – nie `window.confirm`.
- **Bestätigung:** `melde('…')`. **Fehler:** an der Stelle, `.hinweis.fehler` mit `role="alert"`.
- **Ungespeichertes:** `useUngespeichert()`; Seitenwechsel nur über `geheZu` oder `<Link>`.
- **Knöpfe:** Tätigkeit + Gegenstand. Hauptknopf `.knopf`, Nebenknopf `.knopf.schlicht`. Gefüllter roter Knopf ist `knopf rot`; `.gefahr` ist nur rote Schrift für schlichte Knöpfe.
- **Aufklappen:** `details.karte` oder `details.klapp` – keine eigene Bauform.
- **Plan-Einträge:** immer über `EintragFelder` (`src/eintragFelder.tsx`).
- **Personen:** `<Avatar>` aus `src/avatar.tsx`.
- **Farben:** nur über die Variablen `--c-…` in `src/index.css` (hell und dunkel sind dort festgelegt). Keine festen Farbwerte in neuen Regeln. Einzige Ausnahme: die Figuren des Begleiters haben eigene Farben `--bf-…`.
- **Schmal und breit:** Hilfsklassen `nur-breit`, `nur-schmal`, `nicht-drucken`, `nur-vorleser`. Das Attribut `hidden` wird vom Stylesheet überschrieben – Elemente stattdessen bedingt rendern.
- **Einrichtungs-Schalter** nie ausblenden: sperren und erklären, was fehlt.
- **Sprache:** „du“, kurze Sätze, erklärte Fachwörter (Azubis sind 16 bis 30). Feste Begriffe: Bericht, Azubi, Ausbildungsbeauftragte, Planbaustein, Sammelplanung.
- **Geräte:** PC, Tablet, Handy. Bedienflächen mindestens 40 × 40 px, Schrift mindestens 12 px.

## Datenschutz und Recht – nicht verhandelbar

- Lernstand, Abzeichen, Übungsergebnisse, Eintragungen im Planer für die Prüfung (außer seinen Terminen), der Begleiter (ob, welche Figur, Name), private Termine und Entwürfe sind **privat für den Azubi**: keine Route und keine Ansicht für Ausbilder, Beauftragte oder Super-Admin, keine Rangliste.
- Wünsche zu Lerninhalten („Lerninhalt besser erklären“) werden **ohne Person** gespeichert: kein Konto, kein Name, keine Uhrzeit, keine technischen Angaben. Nur Ausbilder lesen sie – nicht der Super-Admin, nicht die Beauftragten. Nichts ergänzen, was die Person erkennbar macht (auch keine Glocke: Aktivitäten speichern, wer etwas getan hat).
- Teams-Karten ohne Namen. Benachrichtigungen nennen nur die Person, an die sie gehen (Anrede mit Vornamen) – keine anderen Namen, keine Inhalte. Mails an die Personalstelle ohne Bemerkung und ohne Begründung.
- Geheimnisse (Webhook-Adressen, SMTP-Zugang, Kalender-Link) stehen nur in `.env` und werden nie protokolliert.
- Das Repository ist **öffentlich**: keine privaten Daten, keine echten Namen oder Mailadressen, kein `data/`, keine `.env` – auch nicht in Tests, Commits und Pull-Request-Texten.
- Keine fremden Bilder, Grafiken oder Texte ohne Lizenz; keine Original-Prüfungsaufgaben. Grafiken selbst als SVG zeichnen.
- Lerninhalte gehören nicht in dieses Repository (siehe `lerninhalte/README.md`).

## Commits und Pull Requests

- Commit-Nachricht und Pull-Request-Text deutsch.
- Der Pull Request folgt der Vorlage `.github/pull_request_template.md` (Checkliste abhaken) und nennt: was sich ändert, was geprüft wurde, was nicht geprüft wurde, Abweichungen von den Bedienregeln, neue Daten über Personen.
- Keine Links auf Claude-Sitzungen in Commits oder Pull Requests.
