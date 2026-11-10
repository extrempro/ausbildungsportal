# Änderungen

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
