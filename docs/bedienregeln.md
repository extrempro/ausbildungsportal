# Bedienregeln

Stand: 11.11.2026 · gilt ab Version 0.16.0, zuletzt ergänzt mit 0.22.2

Diese Regeln halten die Bedienung einheitlich. Sie gelten für **jede neue Funktion und jede Änderung** an der Oberfläche. Hintergrund und Befunde stehen in [iso-9241.md](iso-9241.md), Farben und Bausteine in [gestaltung.md](gestaltung.md).

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
- [ ] **Navigation:** Neue Seiten gehören in eine vorhandene Gruppe (Hauptleiste, „Planung“, „Verwaltung“, Menü am Namen). Zurück-Links nur auf echten Unterseiten (Azubi → Plan, Berichtsheft → Bericht).
- [ ] **Begriffe:** Bericht (nicht Nachweis), Azubi, Ausbildungsbeauftragte, Planbaustein, Sammelplanung; gegenüber Azubis „Betreiber des Portals“, als Rolle „Super-Admin“. Anrede durchgehend „du“. Kurze Sätze, erklärte Fachwörter – die Leser sind zwischen 16 und 30 Jahre alt.
- [ ] **Jedes Gerät:** kein waagerechter Überlauf bei 390 px, Bedienflächen mindestens 40 × 40 px, Schrift mindestens 12 px, jedes Feld mit Beschriftung, nichts Wichtiges nur im Tooltip oder nur durch Farbe.
- [ ] **Tastatur:** alles erreichbar, Escape schließt Fenster und Menüs, der Fokus kehrt dorthin zurück, wo er war.
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
  4. Was privat für den Azubi ist (Lernstand, Abzeichen, Übungsergebnisse, Termine), wird niemand anderem gemeldet.
- [ ] **Mitziehen:** Führung (`src/fuehrung.tsx`), Versionshinweise und – bei neuen Daten über Personen – die Leistungsbeschreibung für den Betriebsrat sind angepasst.
- [ ] **Im Browser durchgespielt** in PC- und Handybreite, nicht nur übersetzt und getestet.

## Wenn eine Regel nicht passt

Dann wird die Abweichung begründet und hier oder in `iso-9241.md` festgehalten – nicht stillschweigend ein neues Muster eingeführt.
