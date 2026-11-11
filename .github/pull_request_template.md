## Was sich ändert

<!-- In zwei, drei Sätzen: Was kann man jetzt, was vorher nicht ging? Wer sieht es (Azubi, Beauftragte, Ausbilder, Super-Admin)? -->

## Checkliste

Bitte abhaken. Trifft ein Punkt nicht zu, kurz dahinter schreiben, warum (z. B. „keine Änderung an der Oberfläche“). Die Regeln stehen in `CONTRIBUTING.md`.

- [ ] Größere Funktion: vorher als Issue abgestimmt (Nummer: #…)
- [ ] Versionsnummer an drei Stellen gleich erhöht (`package.json`, `README.md`, `docs/entra-einrichtung.md`) und `CHANGELOG.md` ergänzt
- [ ] `npm run typecheck`, `npm test` und `npm run build` laufen
- [ ] Bedienregeln (`docs/bedienregeln.md`) durchgegangen
- [ ] Handbuch ergänzt – für jede Rolle, die die Änderung sieht – und im Portal verlinkt
- [ ] Im Browser durchgespielt: PC und Handybreite (390 px), hell und dunkel
- [ ] Neue Routen stehen in der Rechte-Tabelle (`server/test/api.test.ts`), der verbotene Zugriff ist getestet
- [ ] Keine neuen Abhängigkeiten
- [ ] Keine Geheimnisse, privaten Daten oder fremden Inhalte ohne Lizenz

## Abweichungen von den Bedienregeln

<!-- „Keine“ – oder welche Regel nicht passt und warum. -->

## Neue Daten über Personen oder neue Rechte

<!-- „Keine“ – oder: Was wird gespeichert, wer sieht es, wann wird es gelöscht? (für die Leistungsbeschreibung an den Betriebsrat) -->

## Nicht geprüft

<!-- Ehrlich aufzählen, z. B. echte Geräte, echter Entra-Mandant, echter Mailserver. -->
