# Änderungen

## [0.36.0] – 2026-11-11

### Neu

- **Lerninhalte einreichen.** Ausbilder laden ein Inhaltspaket als ZIP-Datei im Portal hoch (Seite „Lerninhalte“): Kennung, Datei, auf Wunsch eine Notiz. Das Portal liest das Paket sofort ein; mit Fehlern nimmt es nichts an und zeigt sie mit Datei und Zeile.
- **Status der Einreichung:** „Eingereicht – wird geprüft“ → „Zurückgegeben“ (mit Rückmeldung des Super-Admins) oder „Hochgeladen“ (mit freiwilligem Kommentar). Solange sie offen ist, kann der Ausbilder sie zurückziehen.
- **Super-Admin:** neue Seite „Lerninhalte“ mit Zahl am Menüpunkt. Er lädt die ZIP-Datei zur Durchsicht herunter, gibt die Einreichung zurück oder lädt sie hoch. Hochgeladene Pakete gelten sofort; ein vorhandenes Lernmodul mit derselben Kennung wird ersetzt, der Lernstand der Azubis bleibt.
- Hochgeladene Pakete liegen im Datenordner unter `lerninhalte/` (beschreibbar und in der Datensicherung). Der Ordner `LERN_DIR` bleibt nur lesend; bei gleicher Kennung gilt das hochgeladene Paket.
- Ausbildungsbeauftragte sehen auf der Seite „Lerninhalte“ den Hinweis, sich für Ergänzungen an einen Ausbilder zu wenden.
- Handbuch: „Lerninhalte für einen Beruf erstellen“ beschreibt das Einreichen; neues Kapitel „Lerninhalte prüfen und hochladen“ für den Super-Admin.

### Geändert

- Konto: Der Abschnitt „Profilbild“ steht jetzt bei allen Konten, die sich über Microsoft anmelden. Sind Profilbilder im Portal nicht eingeschaltet, ist der Haken gesperrt und der Text sagt, warum. Bisher fehlte der Abschnitt dann ganz.

### Behoben

- Urlaub: Die Knöpfe „Antrag ablehnen“ und „Urlaub stornieren“ im Begründungsfeld hatten rote Schrift auf blauem Grund und waren schlecht lesbar. Sie sind jetzt rot mit weißer Schrift.

### Sicherheit

- ZIP-Dateien liest das Portal mit einem eigenen, engen Leser: höchstens 15 MB, 600 Dateien und 40 MB entpackt; keine verschlüsselten Archive; Dateinamen mit „..“ oder absolutem Pfad werden abgelehnt; es wird nie mehr entpackt, als das Archiv ankündigt. Übernommen werden nur die Dateiarten eines Inhaltspakets.

## [0.35.0] – 2026-11-11

### Neu

- **Profilbild aus Microsoft Entra (freiwillig).** Mit `ENTRA_PROFILBILD=true` holt das Portal bei jeder Entra-Anmeldung das Profilbild der Person aus Microsoft 365 (klein, 96 × 96) und zeigt es dort, wo sonst die Anfangsbuchstaben stehen: am Namen oben rechts, auf den Azubi-Karten und beim Abzeichnen.
- **Abschaltbar für jede Person:** Unter „Konto“ steht „Mein Profilbild aus Microsoft 365 anzeigen“. Wer den Haken herausnimmt, dessen Bild wird sofort gelöscht und nicht wieder geholt.
- Sichtbar ist ein Bild für die Person selbst und für Ausbilder und Beauftragte, die diesen Azubi sehen dürfen – nicht für andere Azubis, nicht für den Super-Admin.
- Die Anmeldung hängt nicht am Bild: Antwortet Microsoft Graph nicht oder liefert kein Bild, gelingt sie trotzdem; der Grund steht im Log.
- Handbuch: Kapitel „Profilbild“ für Azubis, Ausbilder und Beauftragte.

### Wichtig für den Betrieb

- Die Funktion ist **aus**, solange `ENTRA_PROFILBILD` nicht gesetzt ist. Vor dem Einschalten braucht die App-Registrierung die delegierte Berechtigung **User.Read** (Microsoft Graph) mit Zustimmung – sonst fragt Microsoft jede Person bei der Anmeldung nach einer Zustimmung oder lehnt die Anmeldung ab. Die Schritte stehen in `docs/entra-einrichtung.md`.

## [0.34.0] – 2026-11-11

### Neu

- **Lerninhalte ansehen (Ausbilder und Ausbildungsbeauftragte).** Unter „Lerninhalte“ lesen sie, was die Azubis im Lernmodul lernen: Themenfelder, Cheatsheets, Zusatzwissen und Kompendium – für alle Lernmodule auf dem Server, auch solche, die noch für keinen Beruf eingeschaltet sind. An jedem Lernmodul steht, für welche Berufe es gilt.
- Die Ansicht ist nur zum Lesen: keine Ampel, keine Notizen, keine Abzeichen. **Den Lernstand einzelner Azubis zeigt sie nicht** – der bleibt privat.
- Ausbilder finden den Punkt im Menü „Planung“, Beauftragte in der Hauptleiste (am Handy unter „Mehr“).
- Handbuch (Ausbilder, Beauftragte): Kapitel „Lerninhalte ansehen“.

## [0.33.0] – 2026-11-11

### Neu

- **Abzeichen im Lernmodul.** In jedem Themenfeld sammeln Azubis ein Schild in sechs Stufen (Holz, Stein, Bronze, Silber, Gold, Meister) – eigene Zeichnung, jede Stufe mit eigenem Material und einem zusätzlichen Zeichen (Winkel, Lorbeer, Krone, Strahlen).
- Jetzt erreichbar: **Holz** (bei einem Unterthema steht die Ampel auf Gelb oder Grün), **Stein** (bei der Hälfte), **Bronze** (bei allen, und das Zusatzwissen ist gelesen). Silber, Gold und Meister sind für bestandene Übungen vorgesehen und stehen grau da, bis das Lernmodul Übungen hat.
- Unter jedem Schild steht, was bis zur nächsten Stufe fehlt. Ein neues Abzeichen zeigt das Portal einmal groß an.
- **Rang** auf der Seite „Lernen“: die Stufe, die in mindestens der Hälfte der Themenfelder erreicht ist. „Alle Stufen“ erklärt die Leiter.
- Ein erreichtes Abzeichen bleibt, auch wenn eine Ampel zurückgestellt wird oder Inhalte dazukommen. Wer schon vorher gelernt hat, bekommt seine Abzeichen beim Öffnen von „Lernen“ gutgeschrieben.
- **Privat:** Abzeichen sieht nur der Azubi selbst – wie den ganzen Lernstand. Es gibt keine Rangliste und keinen Vergleich.
- Handbuch (Azubi): Kapitel „Abzeichen sammeln“.

## [0.32.0] – 2026-11-11

### Neu

- **Mail an die Personalstelle.** Sobald ein Urlaub genehmigt oder ein genehmigter Urlaub storniert wurde, schickt das Portal eine kurze Mail an die Personalstelle: Name, Zeitraum, Arbeitstage, wer bestätigt und entschieden hat. Die Bemerkung des Azubis und die Begründung einer Stornierung gehen nicht mit. Die Personalstelle braucht kein Konto.
- Stammdaten → Betrieb: Feld „Mail-Adresse der Personalstelle“ und Knopf „Testmail an die Personalstelle senden“. Der Knopf ist gesperrt und erklärt, solange kein Mailserver eingerichtet ist oder die Adresse fehlt.
- Versand über den Mailserver des Betriebs (SMTP): neue Einstellungen `SMTP_HOST`, `SMTP_ABSENDER`, `SMTP_PORT`, `SMTP_SICHERHEIT`, `SMTP_BENUTZER`, `SMTP_PASSWORT` in der `.env` (README: „Mail an die Personalstelle“). Ohne `SMTP_HOST` verschickt das Portal nichts. Das Passwort geht nie unverschlüsselt über das Netz, das Zertifikat des Mailservers wird geprüft.
- **Die Genehmigung gilt auch, wenn die Mail nicht rausgeht.** Am Antrag sieht der zuständige Ausbilder, ob die Personalstelle informiert ist – sonst den Grund und den Knopf „Mail an die Personalstelle senden“. Das gilt auch für Urlaub, der vor dieser Version genehmigt wurde.
- Handbuch: Urlaubsanträge und Stammdaten ergänzt.

## [0.31.0] – 2026-11-11

### Neu

- **Urlaub beantragen.** Azubis stellen ihren Urlaubsantrag im Portal (Menüpunkt „Urlaub“, Knopf im Ausbildungsplan). Ablauf in zwei Stufen: Alle, denen der Azubi im Zeitraum zugewiesen ist (Ausbildungsbeauftragte, Ausbilder als Vertretung), **bestätigen** – danach **genehmigt** der zuständige Ausbilder. Ist niemand zugewiesen, liegt der Antrag sofort beim Ausbilder. Steht eine Bestätigung aus, kann der Ausbilder nach einer Rückfrage trotzdem entscheiden; das steht dann im Verlauf.
- Ablehnen (beide Stufen) und Stornieren (Ausbilder, nach der Genehmigung) nur mit Begründung, die der Azubi liest. Der Azubi kann einen offenen Antrag zurückziehen. Jeder Schritt steht mit Name und Zeit im Verlauf des Antrags.
- **Urlaubskonto je Kalenderjahr:** Anspruch, genehmigt, beantragt, noch frei. Den Anspruch trägt der Ausbilder im Profil unter „Urlaubstage im Jahr“ ein. Gezählt werden Arbeitstage: Montag bis Freitag ohne die Feiertage des Bundeslands aus den Stammdaten.
- **Hinweise statt Sperren:** Liegt im Zeitraum Berufsschule oder eine Prüfung oder reichen die freien Tage nicht, warnt das Portal – beim Beantragen und beim Entscheiden. Beantragen und genehmigen lässt sich trotzdem.
- Genehmigter Urlaub steht von selbst im **Jahreskalender**, als Abwesenheit im **Bericht der Woche** und im **Kalender-Abo** des Azubis. Beantragter Urlaub steht im Jahreskalender gestreift („Urlaub?“).
- Für Ausbilder und Beauftragte: Seite „Urlaubsanträge“ (zuerst, was auf sie wartet), Zahl am Menüpunkt, Kachel auf der Startseite, Urlaubskonto und Anträge je Azubi. Die Glocke meldet Anträge, Bestätigungen und Entscheidungen.
- Handbuch: Kapitel „Urlaub beantragen“ (Azubi) und „Urlaubsanträge“ (Ausbilder, Beauftragte); Jahreskalender, Profil und Glocke ergänzt.

### Geändert

- Jahreskalender: Urlaub kommt jetzt aus genehmigten Anträgen und – wie bisher – aus eingereichten Berichten. Damit sehen Ausbilder geplanten Urlaub schon vorher.

### Noch offen

- Die **Mail an die Personalstelle** nach Genehmigung und Storno folgt mit Version 0.32.0.
- Bewusst nicht enthalten: halbe Tage, Resturlaub aus dem Vorjahr, andere Abwesenheiten (Krankheit, Sonderurlaub).

## [0.30.1] – 2026-11-11

### Geändert

- **Berichtsheft am Handy:** Über der Liste stehen zwei klar getrennte Gruppen mit Überschrift – „Wochen anzeigen“ (Filter als gleich breite Knöpfe in zwei Spalten) und „Ganzes Berichtsheft“ („Berichtsheft drucken …“ über die ganze Breite, das PDF-Symbol rechts daneben). Die Knöpfe einer Woche stehen links beieinander.
- **Jahreskalender für Ausbilder und Beauftragte am Handy:** statt der breiten Tabelle je Azubi eine Karte – oben das Jahr als schmale Leiste, darunter „Jetzt und als Nächstes“ als Text (Art, Zeitraum, Titel); „Ganzes Jahr“ klappt alle Einträge der Reihe nach auf. Nichts mehr zum seitlichen Wischen. Am PC bleibt die Tabelle mit Balken.
- Tablet: Die Knöpfe einer Berichtszeile brechen um, statt die Seite breiter als den Bildschirm zu machen.

## [0.30.0] – 2026-11-11

### Geändert

- **Entwürfe gehören dem Azubi allein.** Ausbilder und Ausbildungsbeauftragte sehen einen Bericht erst, wenn er eingereicht ist. Bis dahin steht die Woche bei ihnen als „fehlt“ – in der Liste, in der Einzelansicht, auf der Karte des Azubis, im Ausdruck und im PDF. Zieht der Azubi einen Bericht zurück, ist er wieder nur für ihn sichtbar. Zurückgegebene Berichte bleiben sichtbar. Bisher lieferte das Portal Entwürfe mit aus, obwohl das Handbuch den Azubis „den Entwurf siehst nur du“ zusagte.
- Jahreskalender: Urlaub aus einem Bericht sehen Ausbilder und Beauftragte erst, wenn der Bericht eingereicht ist.
- **Berichtsheft drucken und PDF: Vorgabe ist „Nur abgezeichnete“.** „Auch nicht abgezeichnete“ lässt sich bewusst dazuwählen. Die Abkürzung (Symbol) lädt nur abgezeichnete Berichte und ist gesperrt, solange es keinen gibt.
- **Nicht abgezeichnete Berichte sind unübersehbar gekennzeichnet:** Quer über die Seite steht „Entwurf“ bzw. „Nicht abgezeichnet“ – am Bildschirm, im Ausdruck und im PDF (auch auf Fortsetzungsseiten). Das Deckblatt nennt abgezeichnete und nicht abgezeichnete Berichte getrennt.

## [0.29.4] – 2026-11-11

### Neu

- Handbuch (Ausbilder): Kapitel „Lerninhalte für einen Beruf erstellen“ – Vorgehen, Aufbau des Ordners, Beispiel einer Themen-Datei, Regeln und Hinweise zu Urheberrecht und Kennungen. Es sagt ausdrücklich: Den fertigen Ordner bekommt der Betreiber des Portals, der ihn auf dem Server ablegt. Link dorthin beim Feld „Lernmodul“ in den Stammdaten.

## [0.29.3] – 2026-11-11

### Geändert

- Berichtsheft: Der Knopf heißt jetzt „Berichtsheft drucken …“ statt „Berichtsheft als PDF …“ – er führt zur Seite, auf der man das Heft druckt oder als PDF herunterlädt. Das Symbol daneben bleibt die Abkürzung zum PDF. Seitentitel und Handbuch entsprechend.

## [0.29.2] – 2026-11-11

### Geändert

- Lernmodul: Vor dem Umstellen der Ampel fragt das Portal nach („Ampel umstellen? … steht auf „Offen“ und wechselt auf „Sicher““). Erst nach der Bestätigung wird gespeichert. Die Meldung nach dem Speichern entfällt – die Ampel zeigt den neuen Stand.

## [0.29.1] – 2026-11-11

### Geändert

- Berichtsheft: Der Knopf „Berichtsheft als PDF …“ ist jetzt gefüllt und trägt ein Symbol – er hebt sich von den Filtern daneben ab. Die drei Punkte zeigen: Es folgt die Seite mit der Auswahl.
- **Abkürzungen als Symbol:** Links daneben lädt ein Symbol-Knopf das ganze Berichtsheft sofort als PDF (alle Berichte, mit Deckblatt). In jeder Woche mit Bericht lädt ein Symbol-Knopf den Bericht dieser Woche als PDF. Was der Knopf tut, steht im Tooltip und für Vorleseprogramme.

## [0.29.0] – 2026-11-11

### Neu

- **Berichtsheft als PDF – direkt vom Server.** „PDF herunterladen“ erzeugt die Datei im Portal und der Browser speichert sie, ohne Druckfenster. Im Berichtsheft für das ganze Heft (Deckblatt, Auswahl „alle / nur abgezeichnete“, Ausbildungsjahr), am einzelnen Bericht über „Als PDF herunterladen“.
- Das PDF enthält Kopf, Tätigkeiten, Stunden, Abwesenheit, Summe und die Unterschriften; das Logo des Betriebs steht auf dem Deckblatt und blass hinter den Unterschriften. Lange Berichte laufen auf der nächsten Seite weiter („Fortsetzung“), unten steht „Seite … von …“. Nicht abgezeichnete Berichte tragen einen Vermerk.
- Schnittstelle `GET /api/azubis/:id/berichtsheft.pdf` (`nur=abgezeichnet`, `jahr=`, `deckblatt=0`, `woche=`) – dieselben Rechte wie beim Lesen der Berichte.
- Ohne neue Abhängigkeit: Ein kleiner eigener PDF-Schreiber (`server/pdf.ts`) setzt Text, Linien, Unterschriften und Bilder (PNG, JPEG).

### Geändert

- Das Drucken über das Druckfenster bleibt als zweiter Knopf („Berichtsheft drucken“, „Bericht drucken“).
- Handbuch: Kapitel „Berichte und Berichtsheft: PDF herunterladen oder drucken“ neu gefasst.

### Bekannte Grenzen

- Schrift im PDF ist Helvetica mit dem Zeichensatz Windows-1252: Alle deutschen Zeichen stimmen; Zeichen außerhalb davon (z. B. Emojis) erscheinen als „?“. Die Schrift ist nicht eingebettet – das PDF ist damit kein PDF/A.
- Ein Logo im Format WebP kann das PDF nicht aufnehmen; es entsteht dann ohne Logo. PNG und JPEG gehen.

## [0.28.0] – 2026-11-11

### Entfernt

- **Die „Übersicht“ (26 Wochen) entfällt.** Der Jahreskalender zeigt dasselbe über das ganze Jahr. Weg sind der Menüpunkt, die Seite samt den Karten „Diese Woche“ und „Nächste Woche“, die Schnittstelle `GET /api/uebersicht` und das Handbuch-Kapitel dazu.

### Geändert

- Startseite der Ausbilder und Beauftragten: Die dritte Kachel führt zum Jahreskalender.
- Führung: Der Schritt „Wer ist wann wo?“ zeigt den Jahreskalender.
- Der Jahreskalender steht am Handy wieder in der Leiste unten („Jahr“).
- Bausteine importieren: Die Angabe `abWoche` darf in der Datei fehlen – dann beginnt der Eintrag in der Startwoche (Woche 1), passend zum Formular, das „Beginnt in Woche“ nur bei Bedarf zeigt. Das Handbuch erklärt den Zusammenhang.

## [0.27.0] – 2026-11-11

### Neu

- **Jahreskalender** für Azubis, Ausbilder und Ausbildungsbeauftragte – ein Kalenderjahr auf einer Seite, nur zum Lesen, mit Blättern zwischen den Jahren.
  - **Azubi:** im Ausbildungsplan über „Jahreskalender anzeigen“. Monate als Spalten, Tage 1–31 als Zeilen: Berufsschule, Einsätze, Prüfungen, Urlaub (laut Berichtsheft), Feiertage, Schulferien und die eigenen Termine.
  - **Ausbilder und Beauftragte:** eigener Menüpunkt „Jahreskalender“ (am Handy unter „Mehr“). Monate als Spalten, je Azubi eine Zeile mit Balken für Berufsschule, Einsätze und Urlaub, Markierung für Prüfungen, Schulferien und „heute“; nach Ausbildungsjahr geordnet. Ein Klick auf den Namen zeigt den Kalender dieses Azubis Tag für Tag.
  - Es gelten dieselben Rechte wie überall: Ausbilder sehen ihre Azubis, Beauftragte die zugewiesenen. Private Termine eines Azubis stehen nur in seinem eigenen Kalender.
- Schnittstelle `GET /api/jahreskalender?jahr=&azubi=`.
- Handbuch: Kapitel „Den Jahreskalender lesen“ für Azubis sowie für Ausbilder und Beauftragte.

### Geändert

- Kopfzeile am PC: Die Menüpunkte stehen etwas enger, damit auch sieben Punkte passen. Neben einem Logo des Betriebs entfällt der Schriftzug „Ausbildungsportal“; in schmalen Fenstern (unter 1232 px) stehen nur Zeichen bzw. Logo und am Konto-Knopf nur die Initialen.
- Handy: Menüpunkte, die nicht in die Leiste unten passen, stehen unter „Mehr“ → „Weitere Bereiche“.

## [0.26.0] – 2026-11-11

### Neu

- **Berichtsheft als PDF:** Aus „Alle Berichte drucken“ wird „Berichtsheft als PDF oder drucken“. Die Seite baut aus den gewählten Berichten ein Dokument – mit Deckblatt (Name, Beruf, Betrieb, Ausbilder, Zeitraum, Zahl der Berichte, Logo), Auswahl nach „alle / nur abgezeichnete“ und Ausbildungsjahr. Gespeichert wird über „Als PDF speichern“ im Druckfenster; als Dateiname schlägt der Browser „Berichtsheft <Name> <Zeitraum>“ vor.
- **Logo hinter den Unterschriften:** Im Ausdruck (und im PDF) steht das Logo des Betriebs blass hinter beiden Unterschriften, wenn eines hinterlegt ist. Am Bildschirm bleibt es unsichtbar.
- **Handbuch (Ausbilder): „Bausteine importieren: Aufbau der Datei“** – ausführlich mit Beispiel, allen Angaben, Grenzen, JSON-Regeln und dem Verhalten bei Fehlern. Link dorthin beim Knopf „Importieren“.

### Geändert

- **Führung:** Der Schritt „Deine Azubis“ zeigt jetzt immer auf den Bereich mit den Azubis – auch wenn noch kein Azubi zugeordnet ist (bisher sprang er dann auf die Begrüßung).
- **Führung:** Jede Karte nennt die Seite, auf der der Schritt spielt. Wechselt die Führung die Seite, steht dort hervorgehoben „→ Neue Seite: …“, und der Menüpunkt der neuen Seite ist zusätzlich umrandet.

## [0.25.0] – 2026-11-11

### Neu

- **Lernmodul: Zusatzwissen.** Unten im Themenfeld steht das Zusatzwissen des Inhaltspakets: Texte mit Grafiken, Tabellen und Schritten, Checklisten, Vergleiche als Karten und **Abläufe Schritt für Schritt** (Geräte in einer Reihe, ein Paket wandert; weiter per Knopf oder von selbst mit wählbarem Tempo).
- Zusatzwissen ist freiwillig und zählt nicht zur Ampel. Der Azubi kann es als „Gelesen“ abhaken – privat wie der übrige Lernstand (neue Tabelle `lern_zusatz`, Migration 015).
- Verweise in beide Richtungen: Am Unterthema steht „Vertiefung im Zusatzwissen“, am Zusatzwissen „Vertieft: …“ – auch über Themenfelder hinweg.
- Navigation am Rand nennt das Zusatzwissen des geöffneten Themenfelds; im Kompendium gibt es die Art „Zusatzwissen“, die Suche findet auch im Text.
- Schnittstelle `PATCH /api/lernen/zusatz/:id` (nur Azubi, nur der eigene Haken).
- Handbuch für Azubis: Kapitel „Lernen“ und „Kompendium“ ergänzt.

## [0.24.0] – 2026-11-11

### Neu

- **Lernmodul, Stufe 2: Kompendium.** Unter „Lernen“ gibt es neben „Themenfelder“ den Bereich „Kompendium“: alle Begriffe, Befehle, Tabellen, Merksätze und Prüfungsfragen aus allen Cheatsheets in einer Liste von A bis Z. Mit Suche (mehrere Wörter, Umlaute egal, Fundstellen markiert), Filter nach Themenfeld und Art, Buchstabenleiste und eingeklapptem Lösungsweg bei Prüfungsfragen.
- Von jedem Eintrag führt „Zum Cheatsheet“ zum passenden Unterthema; dessen Cheatsheet ist dann schon aufgeklappt. Suche und Filter bleiben beim Zurückkommen stehen.
- **Cheatsheet mit Navigation am linken Rand** (wie im Lernkompass): alle Themenfelder mit Ampelpunkt und Prozentzahl, beim geöffneten Themenfeld darunter seine Unterthemen. Ein Klick springt zum Unterthema; das gerade gelesene ist markiert. Am Handy und Tablet steckt die Liste hinter „Themenfeld wechseln“.
- Wird die Ampel umgestellt, erscheint jetzt eine Bestätigung („… steht jetzt auf „Sicher““); Punkt und Prozentzahl in der Navigation ändern sich sofort mit.
- Handbuch für Azubis: neues Kapitel „Im Kompendium nachschlagen“; Kapitel „Lernen“ um Navigation und Bestätigung ergänzt.
- Schnittstelle `GET /api/lernen/kompendium` (nur Azubis mit eingeschaltetem Lernmodul; enthält nur Inhalte, keinen Lernstand).

### Noch nicht enthalten

- Das „Zusatzwissen“ des Lernkompass (Abläufe, Vergleiche) zeigt das Portal noch nicht – weder im Cheatsheet noch im Kompendium.

## [0.23.2] – 2026-11-11

### Geändert

- Stammdaten: Haben die Lerninhalte Fehler, zeigt die Seite sie jetzt im Klartext (die ersten fünf) statt nur ihre Zahl. Ist ein Paket leer, nennt sie die häufigste Ursache: Unterordner beim Kopieren vergessen, Inhalte eine Ebene zu tief (im Unterordner `content`) oder fehlende Leserechte.
- Lassen sich Lerninhalte gar nicht lesen, zeigt das Portal das als Fehler des Pakets; die Stammdaten-Seite funktioniert trotzdem.

## [0.23.1] – 2026-11-11

### Geändert

- Stammdaten: Das Feld „Lernmodul“ steht jetzt immer am Ausbildungsberuf. Liegen auf dem Server noch keine Lerninhalte, ist es gesperrt, und ein Hinweis sagt, was fehlt und wo die Anleitung steht. Sind Inhalte da, nennt die Seite sie mit Umfang und Stand. Vorher fehlte das Feld ohne Erklärung.
- Beim Start schreibt das Portal ins Log, welche Lerninhalte es gefunden hat – oder dass der Ordner leer ist.

## [0.23.0] – 2026-11-11

### Neu

- **Lernen (Lernmodul, Stufe 1):** Azubis bekommen den Menüpunkt „Lernen“, wenn für ihren Ausbildungsberuf Lerninhalte eingeschaltet sind. Dort stehen die Themenfelder ihres Berufs mit je einem Cheatsheet: Kernbegriffe, Tabellen, Befehle, Merksätze, typische Prüfungsfragen mit Lösungsweg und Grafiken zum Vergrößern.
- **Ampel je Unterthema:** „Offen“, „In Arbeit“ oder „Sicher“. Bei „In Arbeit“ lässt sich ein Lernpunkt notieren (was noch schwerfällt), dazu eine freie Notiz. Die Übersicht zeigt den Stand je Themenfeld und insgesamt.
- **Der Lernstand ist privat.** Nur der Azubi selbst sieht ihn. Ausbilder, Ausbildungsbeauftragte und der Super-Admin sehen weder Ampeln noch Lernpunkte oder Notizen – auch keine Zusammenfassung.
- **Einschalten je Beruf:** Unter „Stammdaten“ wählt ein Ausbilder am Ausbildungsberuf das Lernmodul (Inhaltspaket) aus. Ohne Auswahl gibt es für diesen Beruf kein „Lernen“.
- Die Inhalte kommen als Dateien von außen (Ordner `lerninhalte/`, Format des FISI-Lernkompass). Wie man sie einbindet, steht in `lerninhalte/README.md`. Ändern sich die Inhalte, zeigt das Portal bei schon bewerteten Unterthemen „Inhalt aktualisiert“.
- Noch nicht enthalten: Kompendium, Üben (Karteikarten, Quiz, Prüfungssimulation), Prüfungsseite und Zusatzwissen – sie folgen in den nächsten Stufen.

## [0.22.2] – 2026-11-11

### Geändert

- Eingeklappte Bereiche sehen jetzt überall so aus wie „Was bewirkt was?“ ursprünglich: eine leicht blau getönte Fläche mit Titel und „Anzeigen“ rechts; der ganze Kopf reagiert beim Überfahren. Aufgeklappt wird daraus eine weiße Karte mit größerem Titel und einer Linie unter dem Kopf. Der umrandete Knopf aus 0.22.1 entfällt wieder.

## [0.22.1] – 2026-11-11

### Geändert

- Eingeklappte Bereiche sind jetzt deutlich zu erkennen: Sie sind leicht blau getönt und umrandet, und rechts steht ein richtiger Knopf „Anzeigen“. Aufgeklappt ist der Bereich weiß, der Kopf ist durch eine Linie vom Inhalt getrennt, der Knopf heißt „Einklappen“. Das gilt überall: Anleitung im Berichtsheft, „Was bewirkt was?“, Planbausteine, ältere Versionen, technische Angaben beim Fehler-Melden, erledigte Fehlermeldungen.

## [0.22.0] – 2026-11-11

### Neu

- **Verweise ins Handbuch auf jeder Seite:** Unter der Überschrift der meisten Seiten und in mehreren Fenstern steht jetzt „Im Handbuch: …“. Der Verweis öffnet das Handbuch in einem neuen Fenster direkt beim passenden Kapitel. Neu dabei: Ausbildungsplan, Berichtsheft, Bericht (Abzeichnen), Abzeichnen, Azubis, Profil und Zuweisungen, Übersicht, Sammelplanung, Planbausteine, Stammdaten, Konten, Protokoll, Fehlermeldungen, Erscheinungsbild, Unterschrift, Glocke, Fehler melden und der Druckhinweis.
- **Neue Kapitel im Handbuch:** „Fehler melden“ (alle Rollen), „Berichte drucken oder als PDF speichern“ (Azubis, Ausbildungsbeauftragte, Ausbilder), „Dein Konto und deine Unterschrift“ (Azubis), „Die Übersicht lesen“ (Ausbildungsbeauftragte, Ausbilder), „Das Profil eines Azubis“ und „Stammdaten pflegen“ (Ausbilder).

### Geändert

- Einige lange Erklärungen auf den Seiten sind gekürzt; die Einzelheiten stehen im Handbuch (Sammelplanung, Planbausteine, Fehlermeldungen, Zuweisungen, Druckhinweis).

## [0.21.1] – 2026-11-11

### Geändert

- Alles, was sich ein- und ausklappen lässt, sieht jetzt gleich aus: links der Titel, rechts „Anzeigen“ oder „Einklappen“ mit einem Pfeil. Hilfetexte tragen vorn ein Fragezeichen-Symbol. Das betrifft die Anleitung im Berichtsheft, „Was bewirkt was?“ bei den Konten, Planbausteine, ältere Versionen, die technischen Angaben beim Fehler-Melden und erledigte Fehlermeldungen.
- Erklärungen in Fenstern und Formularen sind jetzt kurz und verweisen einheitlich aufs Handbuch („Im Handbuch: …“, öffnet in neuem Fenster beim passenden Kapitel): im Termin-Fenster, beim Kalender-Abo und beim Bericht („Entwurf oder einreichen?“).
- Handbuch: Das Kapitel zum Kalender heißt jetzt „Kalender abonnieren (Kalender-Abo)“ und enthält die Schritte für iPhone, Outlook und Google Kalender. Für Azubis gibt es ein eigenes Kapitel „Eigene Termine eintragen“.
- Beim Abzeichnen heißt der Knopf zum Schließen eines Berichts jetzt „Einklappen“ statt „Zuklappen“.

## [0.21.0] – 2026-11-11

### Neu

- **Termine für Azubis:** Azubis können einzelne Tage in ihren Plan eintragen – mit Datum und, wenn gewünscht, Beginn und Ende. Gedacht zum Merken einzelner Termine: eine JAV-Sitzung (Jugend- und Auszubildendenvertretung), ein Gespräch mit der Personalabteilung, eine Betriebsversammlung.
- **Termine sind privat.** Nur der Azubi selbst trägt sie ein, sieht, ändert und löscht sie. Ausbilder und Ausbildungsbeauftragte sehen sie nicht – weder im Plan des Azubis noch in ihrer Übersicht, in der Glocke oder in ihrem Kalender. Das Formular sagt das dem Azubi.
- Für den Azubi stehen Termine oben in den Kacheln „Diese Woche“ und „Nächste Woche“ (dort gibt es den Knopf „+ Termin“), in der Wochenliste und in seinem abonnierten Kalender – dort mit Uhrzeit, aber ohne Ort und Anmerkung.

## [0.20.0] – 2026-11-11

### Neu

- **Kalender abonnieren:** Azubis, Ausbildungsbeauftragte und Ausbilder können den Ausbildungsplan in ihr Kalenderprogramm holen (Outlook, iPhone, Google Kalender und andere). Unter „Konto“ erstellt jeder einen persönlichen Link und trägt ihn dort als Kalender-Abo ein.
- Im Kalender stehen Berufsschule, Einsätze und Prüfungstermine als ganztägige Termine, Wochen von Montag bis Sonntag. Aufgaben, Notizen, Freitexte und Berichte stehen nicht darin.
- Ausbilder und Ausbildungsbeauftragte sehen alle ihre Azubis in einem Kalender (mit Namen im Termin) oder beschränken den Link auf einen Azubi. Es gelten bei jedem Abruf dieselben Rechte wie im Portal.
- Der Link ist wie ein Passwort und nur zum Lesen. Er lässt sich erneuern oder abschalten; das Portal zeigt, wann er zuletzt abgerufen wurde. Erstellen, Erneuern und Beenden stehen im Protokoll.
- Änderungen am Plan kommen im Kalender mit Verzögerung an – wie oft abgerufen wird, bestimmt das Kalenderprogramm.

## [0.19.0] – 2026-11-11

### Geändert

- **Ausbilder sehen nur noch ihre eigenen Azubis.** Eigene Azubis sind die, bei denen der Ausbilder im Profil als „Zuständiger Ausbilder“ eingetragen ist. Das gilt überall: Azubi-Liste, Startseite, Übersicht, Abzeichnen, Glocke, Sammelplanung und Kontenliste. **Nach dem Update bitte prüfen, ob bei jedem Azubi der richtige Ausbilder im Profil steht.**
- Azubis ohne zuständigen Ausbilder sehen und bearbeiten weiterhin alle Ausbilder – so bleibt niemand unbetreut. Sie tragen die Marke „ohne Ausbilder“. Das gilt auch, solange das Konto des zuständigen Ausbilders gesperrt ist.
- Wer als Ausbilder ein Azubi-Konto anlegt, ist gleich als zuständiger Ausbilder eingetragen.
- Eine Sammelplanung nimmt nur zurück, wer sie eingetragen hat (oder ein Ausbilder mit Gesamtsicht).
- Wechselt ein Ausbilder die Rolle, haben seine Azubis danach keinen zuständigen Ausbilder mehr.

### Neu

- „Azubi übernehmen“ im Profil eines Azubis ohne Ausbilder. Beim Abgeben an einen anderen Ausbilder fragt das Portal nach, weil der Azubi danach nicht mehr sichtbar ist.
- Vertretung: Im Profil lässt sich neben Ausbildungsbeauftragten auch ein anderer Ausbilder für einen Zeitraum zuweisen. Die Vertretung hat die Rechte von Ausbildungsbeauftragten: Plan und Berichte lesen, Berichte der Wochen im Zeitraum abzeichnen, Aufgaben und Notizen eintragen.
- Gesamtsicht: Der Super-Admin kann bei einem Ausbilder-Konto „sieht alle Azubis“ anhaken, zum Beispiel für die Ausbildungsleitung. Das Ein- und Ausschalten steht im Protokoll.

## [0.18.0] – 2026-11-11

### Neu

- Hinweis auf eine neue Version: Wird das Portal aktualisiert, während es im Browser offen ist, erscheint unten „Das Portal wurde aktualisiert“ mit dem Knopf „Seite neu laden“. Der Hinweis bleibt stehen, bis neu geladen wird; „Später“ blendet ihn für zehn Minuten aus. Bei ungespeicherten Eingaben fragt der Browser vor dem Neuladen nach.
- Einzelnen Bericht drucken: Im Berichtsheft steht an jeder Woche mit Bericht der Knopf „Drucken“. Auf der Seite des Berichts gibt es „Bericht drucken“ jetzt in jedem Stand – auch beim Schreiben; ein Entwurf trägt auf dem Ausdruck den Vermerk „Entwurf – noch nicht eingereicht und nicht unterschrieben“.

### Geändert

- Ausdruck ohne Kopf- und Fußzeile des Browsers: Seiten mit einem Bericht werden ohne Seitenrand gedruckt, der Rand gehört zum Blatt. Chrome und Edge lassen Datum, Titel und Adresse dann weg. In anderen Browsern hilft der Hinweis neben dem Druck-Knopf: im Druckfenster „Kopf- und Fußzeilen“ ausschalten.

## [0.17.0] – 2026-11-11

### Geändert

- Bericht schreiben, neu gegliedert: Jeder der vier Teile (Betriebliche Tätigkeiten, Unterweisungen, Berufsschule, Abwesenheit) ist eine eigene Karte mit Nummer und den Stunden dieses Teils. Teile, in denen diese Woche nichts steht, sind nur eine Zeile mit „Eintragen“ – steht Berufsschule im Ausbildungsplan, ist der Teil gleich offen.
- Neben dem Formular steht „Deine Woche“: Stunden mit Balken, was noch fehlt, die Aufteilung nach Teilen, ob schon gespeichert ist, und die Knöpfe „Einreichen“ und „Als Entwurf speichern“. Am PC bleibt das beim Scrollen stehen; auf Handy und Tablet bleiben Summe und Knöpfe als Leiste am unteren Rand erreichbar.
- Zeilen sind nummeriert; bei der Abwesenheit wird der nächste freie Tag der Woche vorgeschlagen.
- Handbuch: eigenes Kapitel „Die Glocke: Was gibt es Neues?“ für Azubis, Ausbilder und Ausbildungsbeauftragte.

## [0.16.0] – 2026-11-10

Einheitliche Bedienung: Die Anwendung wurde Seite für Seite auf gleiche Abläufe, Beschriftungen und Rückmeldungen durchgesehen (Maßstab: ISO 9241-110).

### Geändert

- Menü: Für Ausbilder gibt es den neuen Punkt „Planung“ mit Sammelplanung und Planbausteinen. „Verwaltung“ enthält nur noch Konten und Stammdaten. Die alten Adressen leiten weiter.
- Rückfragen sehen überall gleich aus: ein eigenes Fenster, das die Folgen nennt und dessen Knopf sagt, was passiert („Konto endgültig löschen“ statt „OK“). Bei Endgültigem ist der Knopf rot und „Abbrechen“ vorausgewählt.
- Bestätigungen erscheinen immer an derselben Stelle unten auf der Seite, bleiben einige Sekunden und lassen sich schließen. Fehlermeldungen stehen weiter direkt an der betroffenen Stelle.
- Ungespeicherte Eingaben: Alle Formulare fragen jetzt nach, bevor Eingaben beim Seitenwechsel verloren gehen (Azubi-Profil, Zuweisungen, Stammdaten, Bausteine, Sammelplanung). „Fehler melden“ fragt nach, bevor ein begonnener Text verworfen wird. Die Rückfrage kommt auch bei der Zurück- und Vor-Taste des Browsers.
- Sammelplanung: Der Knopf „Eintragen“ ist nach dem Eintragen gesperrt, bis sich an Auswahl oder Angaben etwas ändert – so wird nichts doppelt eingetragen. Der einzelne Eintrag hat dieselben Felder wie im Ausbildungsplan, jetzt auch mit Unteraufgaben.
- Knöpfe nennen Tätigkeit und Gegenstand („Eintrag speichern“, „Beruf löschen“, „Konto anlegen“). „Entfernen“ steht für noch nicht Gespeichertes, „Löschen“ für Endgültiges.
- Aufklappbare Bereiche haben überall denselben Kopf mit „Anzeigen“ und „Einklappen“.
- Lässt sich eine Seite nicht laden, bleibt die Überschrift stehen; der Fehler wird vorgelesen und es gibt „Erneut versuchen“.
- Führung und Handbuch kennen jetzt Glocke, „Fehler melden“, Planung und die Fehlermeldungen des Super-Admins. „Erscheinungsbild“ und „Planbausteine“ haben eigene Symbole.

## [0.15.0] – 2026-11-10

### Neu

- Sammelplanung zurücknehmen: Auf der Seite „Sammelplanung“ stehen die letzten Läufe der vergangenen 30 Tage. „Zurücknehmen“ entfernt die dabei angelegten Einträge wieder aus allen Plänen. Einträge, die seitdem jemand geändert oder abgehakt hat, bleiben stehen und werden genannt. Direkt nach dem Eintragen gibt es dafür den Knopf „Das war ein Versehen – zurücknehmen“.

### Geändert

- Planbausteine: Das Feld „Ab Woche“ heißt jetzt „Beginnt in Woche“ und erscheint erst, wenn ein Baustein mehrere Einträge hat – bei einem einzelnen Eintrag genügt die Dauer. Darunter steht in Worten, was die Zahl bedeutet. Weitere Einträge beginnen von sich aus in Woche 1 (als Aufgabe), statt an den vorherigen anzuschließen.

## [0.14.0] – 2026-11-10

### Neu

- Planbausteine statt Planvorlagen: Ein Baustein ist ein Stück Ausbildung, das immer wieder vorkommt, zum Beispiel eine Station mit ihren Aufgaben. Im Ausbildungsplan fügst du ihn ab einer Woche deiner Wahl ein – auch mehrfach und bei jedem Azubi an anderer Stelle. Bisher begann eine Vorlage immer mit dem Ausbildungsbeginn.
- Sammelplanung (Ausbilder, erreichbar über die Übersicht): einen Eintrag oder einen Baustein in die Pläne mehrerer Azubis auf einmal eintragen, etwa einen Schulblock für eine Klasse. Auswahl einzeln oder per Schnellauswahl nach Ausbildungsjahr, Berufsschule oder Beruf. Wer in dem Zeitraum nicht in der Ausbildung ist, wird ausgelassen; das Ergebnis nennt je Azubi, was passiert ist.

### Geändert

- Die bisherigen Planvorlagen sind jetzt Bausteine; es geht nichts verloren. Dateien aus dem bisherigen Export lassen sich weiter importieren.

## [0.13.0] – 2026-11-10

### Neu

- Fehler melden mit Bildschirmfoto: Ein Bild lässt sich auswählen, aus der Zwischenablage einfügen oder am PC direkt aufnehmen. Es ist freiwillig, wird vor dem Senden gezeigt und lässt sich wieder entfernen. Der Browser verkleinert es. Der Super-Admin sieht es erst nach einem Klick auf „Bildschirmfoto anzeigen“; es wird mit der Meldung gelöscht.
- Benachrichtigung in Teams: Ist in der `.env` die Adresse eines Teams-Workflows hinterlegt (`FEHLER_WEBHOOK_URL`), geht bei jeder neuen Fehlermeldung ein Hinweis in den Kanal – mit Nummer, Rolle, Seite und Link ins Portal, ohne Namen und ohne Bild. Den Text der Meldung schickt das Portal nur mit `FEHLER_WEBHOOK_MIT_TEXT=true`. Auf der Seite „Fehlermeldungen“ steht, ob die Benachrichtigung eingerichtet ist, mit einem Knopf für eine Testnachricht.

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
