# Änderungen

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
