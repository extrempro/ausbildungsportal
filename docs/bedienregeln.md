# Bedienregeln

Stand: 13.11.2026 · gilt ab Version 0.16.0, zuletzt ergänzt mit 0.61.2

Diese Regeln halten die Bedienung einheitlich. Sie gelten für **jede neue Funktion und jede Änderung** an der Oberfläche. Hintergrund und Befunde stehen in [iso-9241.md](iso-9241.md) und [barrierefreiheit.md](barrierefreiheit.md) (Ziel: WCAG 2.2 AA), Farben und Bausteine in [gestaltung.md](gestaltung.md).

## Vor dem Pull Request prüfen

- [ ] **Rückfragen** laufen über `rueckfrage()` aus `src/dialoge.tsx`, nie über `window.confirm`. Erster Absatz: die Frage. Weitere Absätze: die Folgen. Der Knopf nennt die Handlung (`ja: 'Konto löschen'`); bei Endgültigem `gefahr: true`.
- [ ] **Bestätigungen** nach einer gelungenen Aktion über `melde()`. **Fehler** stehen an der betroffenen Stelle (`.hinweis.fehler` mit `role="alert"`) und bleiben, bis sie behoben sind.
- [ ] **Ungespeicherte Eingaben:** Jedes Formular meldet sie über `useUngespeichert()` oder `useEingaben()` aus `src/router.tsx`. Fenster fragen vor dem Schließen nach, wenn schon etwas eingegeben ist. Der Router fragt dann bei Links, Menü und der Zurück-Taste des Browsers nach – Seitenwechsel deshalb nur über `geheZu` oder `<Link>`, nie direkt über `history`.
- [ ] **Doppeltes Auslösen** ist ausgeschlossen: Knöpfe, die etwas anlegen oder versenden, sind währenddessen und danach gesperrt, bis sich die Eingabe ändert.
- [ ] **Ladefehler** zeigen `<Ladefehler titel="…">` – die Überschrift bleibt stehen.
- [ ] **Jede Seite** hat genau eine `h1` und darunter einen Satz, wozu sie dient. Abläufe mit mehreren Schritten bekommen die nummerierten Schritte (`ol.ablauf-liste`).
- [ ] **Knöpfe:** Tätigkeit und Gegenstand („Eintrag speichern“, „Beruf löschen“). „Entfernen“ für noch nicht Gespeichertes, „Löschen“ für Endgültiges. Der Hauptknopf (`.knopf`) steht zuerst, Nebenknöpfe sind `.knopf.schlicht`, Endgültiges zusätzlich `.gefahr`. Knopfzeilen sind `.aktionen.links`.
- [ ] **Gleiche Felder, gleiche Bausteine:** Plan-Einträge immer über `EintragFelder`. Bevor ein Formular ein zweites Mal entsteht, wird das vorhandene wiederverwendet.
- [ ] **Aufklappen** sieht überall gleich aus und ist als solches erkennbar: eingeklappt eine leicht blau getönte Fläche ohne Schatten, links der Titel, rechts „Anzeigen“ mit Pfeil, der ganze Kopf reagiert beim Überfahren; aufgeklappt eine weiße Karte mit größerem Titel, „Einklappen“ und einer Linie unter dem Kopf (das ursprüngliche Aussehen von „Was bewirkt was?“) (in `index.css` unter „Einklappen: ein Aussehen für alles“). Drei Bauformen: `details.karte` (eine ganze Karte), `details.klapp` (Kasten innerhalb einer Karte oder eines Fensters; `frei` ohne Rahmen, `schmal` nur mit Pfeil für schmale Spalten) und `.anleitung` (Karte, die sich ihren Zustand merkt). Hilfetexte bekommen vorn `<Icon name="hilfe" />`. Das Wort heißt immer „Einklappen“, nie „Zuklappen“ oder „Schließen“. 
- [ ] **Erklärungen in Fenstern und Formularen:** höchstens der eine Satz, den man zum Entscheiden braucht (z. B. „Termine siehst nur du.“). Alles Weitere steht im Handbuch und wird mit `<HandbuchLink kapitel="…">` verlinkt (`src/handbuchLink.tsx`; öffnet in neuem Fenster, damit Eingaben stehen bleiben). Jedes Kapitel hat dafür die Sprungmarke `#kapitel-<id>`. Ausnahmen: Was vor dem Absenden gewusst werden muss, steht an Ort und Stelle (z. B. „Das wird automatisch mitgeschickt“ beim Fehler-Melden); Seiten mit vielen Folgen behalten ihre Anleitung als Karte (Berichtsheft, Konten).
- [ ] **Navigation ist überall gleich** – in jeder Rolle und auf jedem Gerät. Die Punkte stehen nur an einer Stelle, in `src/App.tsx` (`haupt`, `planung`, `verwaltung`, `persoenlich`); PC-Leiste, Leiste unten und „Mehr“ werden daraus gebaut, nie von Hand doppelt gepflegt.
  1. **Gleich erreichbar:** Was am PC erreichbar ist, ist am Tablet und am Handy genauso erreichbar – höchstens an anderer Stelle („Mehr“ statt Hauptleiste). Der Test `e2e/10-navigation.test.ts` prüft das für jede Rolle.
  2. **Gleicher Ort für Gleiches:** Neue Seiten gehören in eine vorhandene Gruppe – Hauptleiste (tägliche Arbeit), „Planung“ (Pläne über einzelne Azubis hinaus, Lerninhalte), „Verwaltung“ (Konten, Stammdaten, Rückmeldungen), Menü am Namen (Persönliches). Dieselbe Art Seite steht bei allen Rollen in derselben Gruppe, soweit die Rolle Gruppen hat.
  3. **Zahlen gehen nicht verloren:** Ein Menüpunkt mit Zahl zeigt sie auch in „Planung“, „Verwaltung“ und „Mehr“; der Knopf davor zeigt die Summe.
  4. **Eine Grenze:** Unter 1024 px wechselt *alles* zur Darstellung für Tablet und Handy – Leiste unten statt oben, Zeile „Inhalt“ statt Seitenleiste (Lernmodul, Handbuch, Ausbildungsplan). Keine eigenen Grenzen für einzelne Navigationen.
  5. **Seiten-Navigation heißt gleich:** „Inhalt“ – am PC als Seitenleiste (einklappbar, siehe `NaviKnopf` in `src/ansicht.tsx`), am Handy als angeheftete Zeile, die zeigt, wo man liest. Mit Suchfeld heißt sie „Inhalt und Suche“. Neue lange Leseseiten bekommen dieselbe Bauform, keine eigene.
  6. **Reiter oder Zurück-Link:** Reiter (`nav.reiter`) nur zwischen *gleichrangigen* Seiten eines Bereichs – Themenfelder · Kompendium · Üben; Profil · Ausbildungsplan · Berichtsheft · Urlaub eines Azubis (`src/azubiReiter.tsx`). Eine Ebene tiefer gibt es keine Reiter, sondern einen Zurück-Link zur Ebene darüber (Themenfeld → „← Alle Themenfelder“, Bericht einer Woche → „← Berichtsheft“, die Seiten eines Azubis → „← Alle Azubis“).
  7. **Symbole:** Jeder Menüpunkt und jede Gruppe hat ein eigenes Symbol; dieselbe Seitenart hat bei allen Rollen dasselbe (Rückmeldungen: die zwei Daumen).
  8. **Kurznamen** in der Leiste unten nur, wo der Platz fehlt – und nur als Kürzung desselben Worts („Plan“, „Jahr“, „Meldungen“), nie ein anderes Wort. Was selten gebraucht wird, steht unter „Mehr“ mit vollem Namen.
- [ ] **Begriffe:** Bericht (nicht Nachweis), Azubi, Ausbildungsbeauftragte, Planbaustein, Sammelplanung; gegenüber Azubis „Betreiber des Portals“, als Rolle „Super-Admin“. Anrede durchgehend „du“. Kurze Sätze, erklärte Fachwörter – die Leser sind zwischen 16 und 30 Jahre alt.
- [ ] **Jedes Gerät:** kein waagerechter Überlauf bei 390 px und 320 px (`e2e/06-handy.test.ts`), Text mindestens 4,5 : 1 Kontrast hell und dunkel (`e2e/12-kontrast.test.ts`; auf getönten Karten `--c-muted-getoent` statt `--c-muted`), Beschriftungen nie abschneiden (umbrechen), Bedienflächen mindestens 40 × 40 px, Schrift mindestens 12 px, jedes Feld mit Beschriftung, nichts Wichtiges nur im Tooltip oder nur durch Farbe.
- [ ] **Tastatur:** alles erreichbar, Escape schließt Fenster und Menüs, der Fokus kehrt dorthin zurück, wo er war.
  - **Fenster** (`role="dialog"`) nutzen `useFensterFokus()` aus `src/dialoge.tsx`: Fokus beim Öffnen hinein, Tab bleibt drin, Escape schließt, danach zurück (WCAG 2.4.3). Kein eigener Nachbau.
  - **Angeheftete Leisten** (sticky/fixed) dürfen das fokussierte Element nie verdecken (WCAG 2.4.11). Eine neue angeheftete Leiste kommt in `LEISTEN` in `src/fokusFrei.ts`. `e2e/11-fokus.test.ts` prüft beides.
- [ ] **Hooks** stehen vor jedem frühen `return` einer Komponente.
- [ ] **Handbuch gehört dazu – bei jeder neuen Funktion und jeder Änderung, ohne dass es eigens verlangt wird:**
  1. Das Handbuch (`src/pages/Handbuch.tsx`) beschreibt die Funktion für **jede Rolle, die sie sieht** – als eigenes Kapitel, wenn man danach suchen würde (Titel = das Wort, das auf dem Bildschirm steht), sonst als Absatz im passenden Kapitel. Für Azubis in kurzen Sätzen mit erklärten Begriffen.
  2. An der Stelle im Portal steht ein `<HandbuchLink kapitel="…">` zum Kapitel: auf Seiten am Ende des einleitenden Satzes unter der `h1`, in Fenstern und Abschnitten bei der Erklärung. Kein Verweis, wo es nichts zu erklären gibt (Versionshinweise, Anmeldeseite).
  3. Ändert sich eine Funktion, wird der Handbuchtext mitgeändert; fällt sie weg, auch das Kapitel und seine Verweise.
  4. Jedes Kapitel folgt dem Aufbau in [handbuch-regeln.md](handbuch-regeln.md): Gruppe, einleitender Satz, „So geht's“, „Begriffe“, „Gut zu wissen“.
  5. Der Test `server/test/handbuch.test.ts` prüft diesen Aufbau und dass jeder Verweis auf ein vorhandenes Kapitel zeigt. Gilt ein Kapitel nicht für alle Rollen, wählt der Verweis das Kapitel nach Rolle.
- [ ] **Benachrichtigungen mitdenken – bei jeder neuen Funktion:** Passiert dabei etwas, das eine andere Person wissen sollte (jemand reicht etwas ein, entscheidet, gibt zurück, plant für jemanden)?
  1. Wenn ja: Das Ereignis kommt in die Glocke (`merkeAktivitaet` in `server/aktivitaet.ts`). Benachrichtigungen per Teams und E-Mail hängen daran und gehen dann von selbst mit.
  2. Eine neue Art von Ereignis braucht einen Text in der Glocke (`src/glocke.tsx`) und einen für die Nachricht (`TEXT` in `server/benachrichtigung.ts`) – ohne Namen anderer Personen, ohne Inhalte. Sie gehört zu einem Bereich, den man unter „Konto“ wählen kann; ein neuer Bereich kommt dort als eigene Auswahl hinzu.
  3. Wenn nein: im Pull Request in einem Satz sagen, warum nicht (zum Beispiel „betrifft nur die Person selbst“ oder „privat für den Azubi“).
  4. Was privat für den Azubi ist (Lernstand, Abzeichen, Übungsergebnisse, Eintragungen im Planer, Begleiter, Termine), wird niemand anderem gemeldet.
- [ ] **Mitziehen:** Führung (`src/fuehrung.tsx`), Versionshinweise, die E2E-Tests (`e2e/`) und – bei neuen Daten über Personen – die Leistungsbeschreibung für den Betriebsrat sind angepasst. Sieht eine Ansicht merklich anders aus, sind die Bildschirmfotos in `docs/bilder/` fällig (`npm run bilder`).
- [ ] **Im Browser durchgespielt** in PC- und Handybreite, nicht nur übersetzt und getestet. Die E2E-Tests (`npm run e2e`) ersetzen das nicht.

## Wenn eine Regel nicht passt

Dann wird die Abweichung begründet und hier oder in `iso-9241.md` festgehalten – nicht stillschweigend ein neues Muster eingeführt.
