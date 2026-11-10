# Änderungen

## [0.12.0] – 2026-11-10

### Neu

- Fehler melden: Im Menü am Namen bzw. unter „Mehr“ kann jede angemeldete Person ein Problem beschreiben. Seite, Version, Browser, Fenstergröße und die letzten Fehlermeldungen des Browsers werden automatisch mitgeschickt; das Formular zeigt vorher genau, was das ist.
- Super-Admin: neue Seite „Fehlermeldungen“ mit offenen und erledigten Meldungen. Meldungen lassen sich als erledigt markieren, als Text ohne Namen kopieren und löschen. Die Zahl der offenen Meldungen steht am Menüpunkt.
- Planvorlagen exportieren und importieren: einzelne oder alle Vorlagen als Datei speichern und in diesem oder einem anderen Ausbildungsportal wieder einlesen. Der Import legt Vorlagen zusätzlich an und überschreibt nichts; der Beruf wird über seinen Namen zugeordnet. Dazu „Duplizieren“.
- Konten: Der Abschnitt „Was bewirkt was?“ erklärt jede Rolle, jede Funktion (anlegen, Rolle ändern, sperren, Verknüpfung lösen, Passwort zurücksetzen, löschen) mit ihren Folgen und wofür sie gedacht ist, dazu die drei Stände eines Kontos.

### Geändert

- Planvorlagen neu gegliedert: drei Schritte als Einstieg, je Vorlage Beruf, Zahl der Einträge und Dauer, ein Zeitstrahl nach Art und der Ablauf als Liste. Einträge im Formular tragen Art, Wochen und Titel in der Überschrift und werden beim Speichern nach Wochen geordnet.
- Glocke: Das Fenster hebt sich deutlich ab – blauer Kopf, blauer Rand, die Seite dahinter wird abgedunkelt; dazu ein Knopf zum Schließen.
- Konten: Nach jeder Aktion steht eine Bestätigung da, was passiert ist. Die Rückfragen vor dem Löschen, dem Rollenwechsel, dem Lösen der Verknüpfung und dem Zurücksetzen des Passworts nennen die Folgen.

## [0.11.0] – 2026-11-10

### Neu

- Glocke in der Kopfzeile mit Aktivitäten. Azubis sehen dort neue Einträge in ihrem Ausbildungsplan und ob ein Bericht abgezeichnet oder zurückgegeben wurde. Ausbilder und Ausbildungsbeauftragte sehen neue Einträge im Plan ihrer Azubis und eingereichte Berichte. Die Zahl an der Glocke zeigt, wie viel neu ist; ein Klick auf eine Zeile führt direkt zum Plan, zum Bericht oder zu „Abzeichnen“.
- Gleiche Aktivitäten eines Tages sind zu einer Zeile zusammengefasst, zum Beispiel „5 neue Einträge im Ausbildungsplan“ oder „3 Berichte warten auf Abzeichnung“.
- Gespeichert wird nur, wer was für welche Woche getan hat – keine Inhalte von Berichten und keine Kommentare. Nach 60 Tagen werden Aktivitäten gelöscht. Eigene Handlungen stehen nicht in der Glocke, der Super-Admin hat keine.

### Geändert

- Ausbildungsplan auf dem Handy: Die Legende zeigt alle Angaben auf einen Blick in höchstens zwei kleinen Zeilen, statt in einer Zeile zum Wischen.

## [0.10.2] – 2026-11-10

### Geändert

- Abzeichnen ist nach Azubi gegliedert. Je Bericht stehen Woche, Stunden im Verhältnis zu den Wochenstunden und der Zeitpunkt des Einreichens. „Lesen“ klappt den Bericht direkt in der Zeile auf; darunter lässt er sich abzeichnen oder mit Kommentar zurückgeben, ohne die Seite zu verlassen. Mehrere Berichte lassen sich anhaken – je Azubi oder alle – und über eine Leiste am unteren Rand gemeinsam abzeichnen.
- Ausbildungsplan: Die Legende bleibt beim Scrollen unter der Kopfzeile stehen; auf dem Handy in einer Zeile zum Wischen.

## [0.10.1] – 2026-11-10

### Geändert

- Die Anmeldung des Super-Admins liegt auf der eigenen Seite `/super`. Die normale Anmeldeseite zeigt nur noch die Microsoft-Anmeldung. Nach dem Abmelden landet der Super-Admin wieder auf `/super`; die Adresse steht beim Start auch im Log.
- Das Protokoll enthält keine Ereignisse zu Berichten mehr (eingereicht, abgezeichnet, zurückgegeben, Abzeichnung aufgehoben). Vorhandene Einträge dieser Art werden beim Update gelöscht. Die Schritte stehen weiterhin im Verlauf des jeweiligen Berichts, den nur Azubi, Ausbilder und zuständige Beauftragte sehen.

### Behoben

- Die Karte der interaktiven Führung war auf manchen Seiten schwer zu finden. Sie hat jetzt einen kräftigen blauen Kopf mit „Führung“ und Schrittzahl, einen gelben Rand wie der Rahmen um die erklärte Stelle, einen Fortschrittsbalken und blendet bei jedem Schritt kurz auf; der Hintergrund ist stärker abgedunkelt.
- Die Übersicht war auf dem Handy nicht nutzbar: Die breite Tabelle ließ sich nur mühsam verschieben. Auf schmalen Bildschirmen stehen die Wochen jetzt untereinander – die laufende und die nächste Woche mit allen Azubis, spätere Wochen mit denen, für die etwas eingetragen ist. Blättern und Zeitraum passen in die Breite.

## [0.10.0] – 2026-11-10

### Neu

- Interaktive Führung für Azubis, Ausbildungsbeauftragte, Ausbilder und Super-Admin: wenige Schritte, jeder hebt eine Stelle im Portal hervor und erklärt sie in ein, zwei Sätzen. Sie wird beim ersten Besuch einmal angeboten, lässt sich mit Escape abbrechen und über „Führung starten“ im Menü oder im Handbuch beliebig oft wiederholen.
- Knopf „Nach oben“ unten rechts, sobald man ein Stück gescrollt hat.
- Übersicht: oben die Karten „Diese Woche“ und „Nächste Woche“ mit allen Azubis und dem, was ansteht. Der Zeitstrahl darunter hat Monate als Überschrift, ist nach Ausbildungsjahr gruppiert und lässt sich auf 13, 26 oder 52 Wochen stellen.

### Geändert

- Der Schriftzug „Ausbildungsportal“ ist klar von der Navigation abgesetzt: kleiner, in Großbuchstaben und durch eine Linie getrennt – er liest sich nicht mehr wie ein Menüpunkt neben „Ausbildungsplan“.
- Neues Favicon und neue App-Symbole (Absolventenhut).

## [0.9.3] – 2026-11-10

### Geändert

- Azubis für Ausbilder und Beauftragte als Karten, auf der Startseite und unter „Azubis“ gleich aufgebaut: oben Name und Beruf, darunter Stand der Ausbildung (Ausbildungsjahr, Ende, Fortschritt) und der Berichte (warten auf Abzeichnung, zurückgegeben, fehlen), unten immer dieselben drei Wege – Profil, Ausbildungsplan, Berichtsheft. Ab fünf Azubis gibt es ein Suchfeld.
- Die Anleitung „So funktioniert das Berichtsheft“ hat einen klaren Schalter („Einklappen“ / „Anzeigen“ mit Pfeil) und ist eingeklappt nur noch eine schmale Zeile.

### Behoben

- Die Anleitung im Berichtsheft blieb offen, obwohl schon Berichte geschrieben waren: Version 0.9.0 hatte im Browser von sich aus „offen“ gespeichert. Dieser alte Merker wird nicht mehr beachtet.

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
