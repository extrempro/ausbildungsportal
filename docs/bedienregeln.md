# Bedienregeln

Stand: 11.11.2026 · gilt ab Version 0.16.0

Diese Regeln halten die Bedienung einheitlich. Sie gelten für **jede neue Funktion und jede Änderung** an der Oberfläche. Hintergrund und Befunde stehen in [iso-9241.md](iso-9241.md).

## Vor dem Pull Request prüfen

- [ ] **Rückfragen** laufen über `rueckfrage()` aus `src/dialoge.tsx`, nie über `window.confirm`. Erster Absatz: die Frage. Weitere Absätze: die Folgen. Der Knopf nennt die Handlung (`ja: 'Konto löschen'`); bei Endgültigem `gefahr: true`.
- [ ] **Bestätigungen** nach einer gelungenen Aktion über `melde()`. **Fehler** stehen an der betroffenen Stelle (`.hinweis.fehler` mit `role="alert"`) und bleiben, bis sie behoben sind.
- [ ] **Ungespeicherte Eingaben:** Jedes Formular meldet sie über `useUngespeichert()` oder `useEingaben()` aus `src/router.tsx`. Fenster fragen vor dem Schließen nach, wenn schon etwas eingegeben ist.
- [ ] **Doppeltes Auslösen** ist ausgeschlossen: Knöpfe, die etwas anlegen oder versenden, sind währenddessen und danach gesperrt, bis sich die Eingabe ändert.
- [ ] **Ladefehler** zeigen `<Ladefehler titel="…">` – die Überschrift bleibt stehen.
- [ ] **Jede Seite** hat genau eine `h1` und darunter einen Satz, wozu sie dient. Abläufe mit mehreren Schritten bekommen die nummerierten Schritte (`ol.ablauf-liste`).
- [ ] **Knöpfe:** Tätigkeit und Gegenstand („Eintrag speichern“, „Beruf löschen“). „Entfernen“ für noch nicht Gespeichertes, „Löschen“ für Endgültiges. Der Hauptknopf (`.knopf`) steht zuerst, Nebenknöpfe sind `.knopf.schlicht`, Endgültiges zusätzlich `.gefahr`. Knopfzeilen sind `.aktionen.links`.
- [ ] **Gleiche Felder, gleiche Bausteine:** Plan-Einträge immer über `EintragFelder`. Bevor ein Formular ein zweites Mal entsteht, wird das vorhandene wiederverwendet.
- [ ] **Aufklappen** mit `details.karte` oder dem Kopf `.anleitung` – kein drittes Muster.
- [ ] **Navigation:** Neue Seiten gehören in eine vorhandene Gruppe (Hauptleiste, „Planung“, „Verwaltung“, Menü am Namen). Zurück-Links nur auf echten Unterseiten (Azubi → Plan, Berichtsheft → Bericht).
- [ ] **Begriffe:** Bericht (nicht Nachweis), Azubi, Ausbildungsbeauftragte, Planbaustein, Sammelplanung; gegenüber Azubis „Betreiber des Portals“, als Rolle „Super-Admin“. Anrede durchgehend „du“. Kurze Sätze, erklärte Fachwörter – die Leser sind zwischen 16 und 30 Jahre alt.
- [ ] **Jedes Gerät:** kein waagerechter Überlauf bei 390 px, Bedienflächen mindestens 40 × 40 px, Schrift mindestens 12 px, jedes Feld mit Beschriftung, nichts Wichtiges nur im Tooltip oder nur durch Farbe.
- [ ] **Tastatur:** alles erreichbar, Escape schließt Fenster und Menüs, der Fokus kehrt dorthin zurück, wo er war.
- [ ] **Hooks** stehen vor jedem frühen `return` einer Komponente.
- [ ] **Mitziehen:** Führung (`src/fuehrung.tsx`), Handbuch, Versionshinweise und – bei neuen Daten über Personen – die Leistungsbeschreibung für den Betriebsrat sind angepasst.
- [ ] **Im Browser durchgespielt** in PC- und Handybreite, nicht nur übersetzt und getestet.

## Wenn eine Regel nicht passt

Dann wird die Abweichung begründet und hier oder in `iso-9241.md` festgehalten – nicht stillschweigend ein neues Muster eingeführt.
