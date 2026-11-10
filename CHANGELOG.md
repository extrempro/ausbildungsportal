# Änderungen

## [0.9.2] – 2026-11-10

### Geändert

- Handbuch für Azubis: Das Kapitel „Erste Schritte“ entfällt – es wiederholte nur die Anmeldung und die folgenden Kapitel. Der einzige eigene Punkt, die Unterschrift, steht jetzt dort, wo man sie braucht: am Anfang von „Einen Bericht schreiben“.

## [0.9.1] – 2026-11-10

### Neu

- Eigenes Logo für die dunkle Darstellung: Unter „Erscheinungsbild“ lassen sich zwei Logos hinterlegen, mit Vorschau auf hellem und dunklem Hintergrund. Fehlt das dunkle, wird das helle auch dort gezeigt.
- Kurzweg „Profil“ in der Azubi-Liste und auf der Startseite der Ausbilder, neben „Plan bearbeiten“ und „Berichtsheft“.

### Geändert

- Stammdaten: deutlicher Hinweis, dass sie für das ganze Portal gelten; die Rückfragen beim Löschen nennen das ebenfalls.
- Berichtsheft: Die Anleitung „So funktioniert das Berichtsheft“ ist nur noch offen, solange der Azubi noch keinen Bericht geschrieben hat; danach ist sie eingeklappt. Wer sie selbst auf- oder zuklappt, behält seine Wahl.
- Das Menü schließt sich nach dem Umschalten zwischen hell und dunkel.

## [0.9.0] – 2026-11-10

### Neu

- Handbuch je Rolle (Azubi, Ausbildungsbeauftragte, Ausbilder, Super-Admin) in der App; Ausbilder und Beauftragte können auch das Handbuch der Azubis lesen. Es lässt sich drucken.
- Logo des Betriebs: Der Super-Admin hinterlegt es unter „Erscheinungsbild“. Es steht in der Kopfzeile und auf der Anmeldeseite; „Ausbildungsportal“ bleibt klein daneben stehen.
- Als App auf Android und iOS (Progressive Web App): installierbar auf den Startbildschirm, mit Hinweisseite ohne Verbindung und einer Anleitung im Handbuch. Auf Android erscheint im Menü „Als App installieren“.
- Kurzwege in der Azubi-Liste und auf der Startseite der Ausbilder: direkt zum Ausbildungsplan und zum Berichtsheft.

### Geändert

- Die Startseite der Azubis ist ihr Ausbildungsplan. Die Angaben „Meine Ausbildung“ stehen jetzt unter „Konto“.
- Berichtsheft für Azubis verständlicher: Anleitung in drei Schritten, an jeder Woche ein Knopf („Schreiben“, „Weiterschreiben“, „Überarbeiten“, „Ansehen“), im Bericht der Ablauf mit Erklärung zum Stand, Hinweise und Beispiele zu jedem Abschnitt. Ein neuer Bericht beginnt mit einer leeren Zeile.
- Das Protokoll sieht nur noch der Super-Admin – vollständig, auch Ereignisse zu Berichten und Stammdaten (ohne Inhalte). Ausbilder sehen es nicht mehr.
- Neues Favicon und neue App-Symbole.

## [0.8.0] – 2026-11-10

### Neu

- Bedienung auf Tablet und Android-Handy: Navigation als Leiste unten, weitere Bereiche unter „Mehr“, Tabellen auf dem Handy als Liste, Dialoge von unten.
- Auf Android lässt sich das Portal über „Zum Startbildschirm hinzufügen“ wie eine App ablegen (Manifest und App-Symbole).
- Seite „Hilfe“ mit einer kurzen Anleitung je Rolle.
- Startseite mit Kacheln: wartende Berichte, fehlende und zurückgegebene Wochen.
- Prüfbericht zur ISO 9241 in `docs/iso-9241.md`.

### Geändert

- Überarbeitetes Erscheinungsbild: einzeilige Kopfzeile mit den Menüs „Verwaltung“ und am eigenen Namen, Karten mit weichem Schatten, klarere Eingabefelder.
- Der Seitentitel im Browser nennt die Seite. Nach einem Seitenwechsel steht der Fokus am Inhalt; „Zum Inhalt springen“ ist der erste Tab-Halt.
- Bedienflächen sind mindestens 40 × 40 px groß; kleinste Schrift 12 px; alle Farbpaare erreichen den Mindestkontrast.
- Durchgehend „Bericht“ statt wechselnd „Bericht“ und „Nachweis“.

### Behoben

- Ungespeicherte Eingaben im Bericht gingen bei einem Klick in die Navigation ohne Rückfrage verloren.
- Im Dialog für Plan-Einträge lief die Tab-Taste aus dem Dialog heraus; ein Klick daneben verwarf die Eingaben.

## [0.7.0] – 2026-11-10

### Neu

- Azubis können im eigenen Ausbildungsplan Aufgaben und Notizen eintragen, ändern und löschen. Was Ausbilder und Beauftragte geplant haben, können sie weiterhin nur abhaken. Einträge des Azubis sind als solche gekennzeichnet.
- Prüfungstermine im Azubi-Profil (Bezeichnung und Datum, bis zu acht). Im Ausbildungsplan stehen sie in ihrer Woche und im Wochenband; die Kachel oben zählt die Wochen bis zur nächsten Prüfung, ohne Termin bis zum Ende der Ausbildung.

### Geändert

- Einträge in den Kalenderwochen sind klarer gegliedert: je Eintrag ein Kästchen mit farbigem Rand, links die Art, daneben der Titel, darunter Zeitraum, Zuständigkeit und Stand der Unteraufgaben. Reihenfolge immer Prüfung, Schule, Einsatz, Aufgabe, Notiz; Ferien und Feiertage stehen als Zeile darunter.
- Bearbeiten über einen eigenen Link am Eintrag statt über den Titel.

## [0.6.1] – 2026-11-10

### Geändert

- Ausbildungsplan im Aufbau des FISI-Lernkompass: oben die Karten „Diese Woche“ und „Nächste Woche“ mit Kennzahlen (Wochen bis zum Ende der Ausbildung, fehlende Berichte, offene Aufgaben), links eine mitlaufende Übersicht („Du bist hier“, Fortschritt, je Ausbildungsjahr ein Band aller Wochen mit Schule und Ferien, Sprung zu Monaten), rechts alle Kalenderwochen nach Ausbildungsjahr und Monat.
- Schulwochen tragen einen violetten Streifen; an jeder Woche steht der Stand des Berichts mit Link dorthin.
- Ansicht umschaltbar: alle Wochen oder nur Wochen mit Einträgen; Ferien und Feiertage lassen sich ausblenden.
- Einträge werden in einem Dialog angelegt und bearbeitet.
- Beginn und Ende der Ausbildung sind in ihrer Woche markiert.

## [0.6.0] – 2026-11-10

### Neu

- Ausbildungsplan (Phase 4): je Azubi ein Plan in Kalenderwochen mit Schulblöcken, Einsätzen, Aufgaben (mit Unteraufgaben) und Notizen; Schulferien und Feiertage stehen an den Wochen.
- Ausbilder planen alles, Ausbildungsbeauftragte legen während ihrer Zuweisung Aufgaben und Notizen an, Azubis haken Aufgaben ab.
- Zuständig für einen Einsatz oder eine Aufgabe können Ausbilder und Ausbildungsbeauftragte sein. Bei einem Beauftragten lässt sich die Zuweisung für den Zeitraum gleich mit anlegen.
- Planvorlagen je Beruf: Abläufe in Wochen ab Ausbildungsbeginn, die sich in den Plan eines Azubis übernehmen lassen.
- Übersicht aller Azubis über 26 Wochen: Schule, Einsätze und Urlaub laut Bericht.
- Im Bericht steht beim Schreiben, was laut Ausbildungsplan in der Woche ansteht.
- Versionshinweise in der App (Link unten auf jeder Seite): die zehn neuesten Versionen einzeln, ältere zusammengefasst.
- Schalter für hell/dunkel oben rechts.

### Behoben

- Mit dunklem Farbschema blitzte die Seite beim Laden kurz hell auf.

## [0.5.0] – 2026-11-10

### Neu

- Berichtsheft (Phase 3): Azubis schreiben je Kalenderwoche einen Ausbildungsnachweis (betriebliche Tätigkeiten, Unterweisungen, Berufsschule, Abwesenheit, jeweils mit Stunden) und reichen ihn ein. Landesweite Feiertage sind vorbelegt.
- Abzeichnen: Ausbilder und zuständige Ausbildungsbeauftragte zeichnen eingereichte Nachweise einzeln oder gesammelt ab oder geben sie mit Kommentar zurück. Ausbilder können eine Abzeichnung mit Begründung aufheben. Jeder Schritt steht im Verlauf des Nachweises und im Protokoll.
- Unterschrift: Unter „Konto“ lässt sich eine gezeichnete Unterschrift hinterlegen; beim Einreichen und Abzeichnen wird eine Kopie am Nachweis gespeichert.
- Druckansicht für einzelne und für alle Nachweise (eine Seite je Woche).
- Startseite: Azubis sehen fehlende und zurückgegebene Wochen, Ausbilder und Beauftragte die Zahl der wartenden Nachweise.

### Geändert

- README: Die Anmeldung über Microsoft ist inzwischen gegen ein echtes Entra-Verzeichnis im Einsatz.

## [0.4.0] – 2026-11-10

### Neu

- Stammdaten (Phase 2): Ausbilder pflegen den Betrieb, beliebige Ausbildungsberufe mit Regeldauer und Berufsschulen mit Bundesland.
- Azubi-Profil: Beruf, Berufsschule, zuständiger Ausbilder, Ausbildungsbeginn, Vertragsende, Verkürzung, vorzeitige Zulassung und Wochenstunden. Daraus berechnet die App Ausbildungsjahr und Ende der Ausbildung.
- Neue Seiten „Azubis“ (Liste und Einzelansicht) und „Stammdaten“; Ausbildungsbeauftragte lassen sich in der Einzelansicht mit Zeitraum zuweisen. Azubis sehen ihre Ausbildung auf der Startseite.
- Kalender: gesetzliche Feiertage aller 16 Bundesländer (berechnet) und Schulferien aus `content/ferien/<Kürzel>.json`. Mitgeliefert sind die Ferien für Hamburg.
- Favicon für den Browser-Tab.

## [0.3.1] – 2026-11-10

### Behoben

- Docker: Der Container startete nicht, wenn Docker den Ordner `./data` selbst angelegt hatte („In den Datenordner /app/data kann nicht geschrieben werden“). Er richtet die Rechte jetzt beim Start selbst und wechselt danach zum Benutzer `node`; `sudo chown` von Hand ist nicht mehr nötig. Auch `docker compose exec app npm run backup` und `admin-reset` schreiben als dieser Benutzer.

### Geändert

- Passt `APP_URL` nicht zur Adresse im Browser (z. B. eigener Port oder eigene IP in `docker-compose.override.yml`), nennt die Fehlermeldung jetzt beide Adressen und was einzutragen ist; derselbe Hinweis steht im Log.
- `docker-compose.override.example.yml` und README erklären die Bindung an eine VPN-Adresse und dass `APP_URL` dazu passen muss.
- Die Startmeldung im Log sagt jetzt ausdrücklich, dass der genannte Port mit Docker der Port im Container ist; den Port außen zeigt `docker compose ps`.

## [0.3.0] – 2026-11-10

### Neu

- Docker-Setup: `Dockerfile`, `docker-compose.yml` und Vorlage `docker-compose.override.example.yml` für eigene Ports. Start mit `docker compose up -d --build`; die Daten liegen im Ordner `./data`.

## [0.2.0] – 2026-11-10

### Neu

- Erste veröffentlichte Version (Phase 1 – Fundament): Anmeldung, Konten, Rechte und Protokoll.
- Anmeldung über Microsoft Entra ID für Azubis, Ausbildungsbeauftragte und Ausbilder (OpenID Connect mit PKCE über die Bibliothek `openid-client`, Signaturprüfung des ID-Tokens eingeschaltet); lokale Anmeldung für den Super-Admin mit erzwungenem Passwortwechsel beim ersten Mal.
- Kontenverwaltung: Der Super-Admin legt alle Konten an, sperrt und löscht sie. Ausbilder legen Azubis und Ausbildungsbeauftragte an, sperren und löschen sie und lösen die Verknüpfung mit dem Microsoft-Konto. Konten von Ausbildern und Super-Admins ändert und löscht nur der Super-Admin.
- Zentrale Rechteprüfung im Server, Zuweisung von Azubis an Beauftragte mit optionalem Zeitraum.
- Protokoll über Anmeldungen und Kontenänderungen; der Super-Admin sieht nur Konto-Ereignisse.
- Sicherung (`npm run backup`) und Notfall-Zurücksetzen des Super-Admin-Passworts (`npm run admin-reset`).
