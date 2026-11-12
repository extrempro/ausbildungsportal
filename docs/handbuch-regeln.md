# Handbuch-Regeln

Stand: 12.11.2026 · gilt ab Version 0.49.0

Das Handbuch (`src/pages/Handbuch.tsx`) wächst mit jeder Funktion. Diese Regeln halten es einheitlich: Wer ein Kapitel kennt, findet sich in jedem zurecht. Sie ergänzen den Punkt „Handbuch gehört dazu“ in den [Bedienregeln](bedienregeln.md). Der Test `server/test/handbuch.test.ts` prüft, was sich prüfen lässt – was er prüft, ist unten mit **(Test)** markiert.

## Vor dem Pull Request prüfen

- [ ] Jedes neue Kapitel hat eine **Gruppe** aus der Liste unten. **(Test)**
- [ ] Das Kapitel beginnt mit **ein bis zwei Sätzen: Wozu ist das da?** **(Test: erstes Element ist ein Absatz)**
- [ ] Die Abschnitte heißen **„So geht's“**, **„Begriffe“**, **„Gut zu wissen“** und stehen in dieser Reihenfolge. **(Test)**
- [ ] Keine Liste ohne Überschrift davor. **(Test)**
- [ ] Der **Titel** folgt dem Muster unten und hat höchstens 70 Zeichen. **(Test: Länge, kein Punkt am Ende)**
- [ ] Das Kapitel hat höchstens **100 Zeilen** im Quelltext. Längere werden geteilt. **(Test)**
- [ ] Die Kennung (`id`) ist je Handbuch eindeutig; Verweise (`<HandbuchLink>`) zeigen auf vorhandene Kapitel. **(Test)**
- [ ] Im Browser angesehen: PC (Inhaltsverzeichnis links) und 390 px (Inhaltsverzeichnis zum Aufklappen), die Suche findet das Kapitel.

## Gruppen

Das Inhaltsverzeichnis ordnet die Kapitel in Gruppen, immer in dieser Reihenfolge. Innerhalb einer Gruppe gilt die Reihenfolge im Quelltext. Eine Rolle sieht nur die Gruppen, zu denen sie Kapitel hat.

| Gruppe | Was hineingehört |
| --- | --- |
| Erste Schritte | Überblick über die eigene Rolle, Bedienung, Einrichtung als App |
| Ausbildungsplan | Plan lesen und bearbeiten, Termine, Jahreskalender, Kalender-Abo, Sammelplanung |
| Berichtsheft | Berichte schreiben, abzeichnen, drucken |
| Urlaub | Urlaub beantragen, bestätigen, genehmigen |
| Lernen und Prüfung | Lernmodul, Üben, Abzeichen, Planer für die Prüfung, Lerninhalte erstellen |
| Azubis betreuen | Zuständigkeit, Profil, Abteilungen, neue Azubis einrichten |
| Verwaltung | Stammdaten, Firmentermine, Konten, Protokoll, Aufgaben des Super-Admins |
| Dateien und Formate | Aufbau von Dateien zum Import oder Einreichen – getrennt von der Anleitung, wie man vorgeht |
| Konto und Nachrichten | Konto, Profilbild, Glocke, Benachrichtigungen |
| Hilfe | Fehler melden, häufige Fragen |

Eine neue Gruppe kommt nur hinzu, wenn mindestens zwei Kapitel in keine vorhandene passen. Sie wird in `GRUPPEN` in `Handbuch.tsx` und hier eingetragen.

## Aufbau eines Kapitels

```tsx
{
  id: 'urlaub',
  titel: 'Urlaub beantragen',
  gruppe: 'Urlaub',
  inhalt: (
    <>
      <p>Wozu ist das da? Wo finde ich es? – ein bis zwei Sätze.</p>
      <h3>So geht's</h3>
      <ol className="schritte">…</ol>
      <h3>Begriffe</h3>
      <dl className="begriffe">…</dl>
      <h3>Gut zu wissen</h3>
      <ul className="punkte">…</ul>
    </>
  ),
}
```

1. **Einleitung** (Pflicht): Was ist das, wozu dient es, wo steht es im Portal. Keine Schritte, keine Ausnahmen.
2. **„So geht's“**: nummerierte Schritte (`ol.schritte`), wenn es einen Ablauf gibt. Ein Schritt = eine Handlung. Knöpfe und Menüpunkte wörtlich und in „Anführungszeichen“.
3. **Eigene Zwischenüberschriften** (`h3`) nur, wenn ein Kapitel wirklich mehrere Teile hat – zum Beispiel je Gerät („Android“, „iPhone“) oder je Abschnitt einer Datei. Sie stehen zwischen „So geht's“ und „Begriffe“ und heißen nach dem, was auf dem Bildschirm steht.
4. **„Begriffe“**: Wörter und Zustände, die auf dem Bildschirm stehen, mit Erklärung (`dl.begriffe` mit `<Begriff wort="…">`). Das Wort steht so da wie im Portal.
5. **„Gut zu wissen“**: Grenzen, Ausnahmen, Folgen, Datenschutz (`ul.punkte`). Das Wichtigste zuerst und mit einem fett gesetzten Anfang.

Was ein Kapitel nicht braucht, entfällt – die Reihenfolge bleibt. Ein sehr kurzes Kapitel darf nur aus der Einleitung bestehen.

## Titel

- **Anleitung:** Gegenstand und Tätigkeit – „Urlaub beantragen“, „Den Jahreskalender lesen“, „Konten verwalten“.
- **Erklärung:** das Wort vom Bildschirm, wenn nötig mit Zusatz nach Doppelpunkt – „Die Glocke: Was gibt es Neues?“.
- **Dateiformat:** „…: Aufbau der Datei“ – und Gruppe „Dateien und Formate“.
- Kein Punkt am Ende, höchstens 70 Zeichen. Der Titel ist das Wort, nach dem jemand suchen würde.

Wird ein Titel geändert, werden die Stellen mitgeändert, die ihn im Text nennen („siehe Kapitel …“). Die Kennung (`id`) bleibt, damit Verweise aus dem Portal weiter stimmen.

## Länge und Teilen

Höchstens 100 Zeilen Quelltext je Kapitel. Wird ein Kapitel länger, wird es geteilt – meist so:

- **Wie gehe ich vor?** bleibt im Kapitel der Funktion (Gruppe der Funktion).
- **Wie ist die Datei aufgebaut?** wird ein eigenes Kapitel in „Dateien und Formate“.

Beide Kapitel nennen einander im einleitenden Satz.

## Sprache

Wie überall im Portal: „du“, kurze Sätze, ein Gedanke je Satz, erklärte Fachwörter. Für Azubis besonders einfach (16 bis 30 Jahre, viele kennen die Abläufe einer Ausbildung noch nicht). Feste Begriffe stehen in den [Bedienregeln](bedienregeln.md).

## Je Rolle

- Ein Kapitel steht im Handbuch **jeder Rolle, die die Funktion sieht** – mit dem Text, der zu dieser Rolle passt.
- Gemeinsame Kapitel (Bedienung, Glocke, Benachrichtigungen …) sind einmal geschrieben und nehmen die Rolle als Angabe.
- Was eine Rolle nicht darf, steht in ihrem Kapitel als Satz („Freischalten kann nur ein Ausbilder“) – nicht als Anleitung.

## Was die Seite daraus macht

- **Inhaltsverzeichnis** nach Gruppen, am PC links neben dem Text und beim Rollen sichtbar, auf Tablet und Handy zum Aufklappen über dem Text – dort bleibt die Zeile „Inhalt und Suche“ beim Rollen unter der Kopfzeile stehen und nennt das Kapitel, in dem man gerade liest. Das Kapitel, das gerade oben steht, ist im Verzeichnis markiert.
- **Suche** über Titel und Text aller Kapitel der gewählten Rolle.
- **Nummern** laufen in der Reihenfolge des Inhaltsverzeichnisses durch. Sie können sich ändern, wenn ein Kapitel dazukommt – im Text deshalb auf den **Titel** verweisen, nie auf die Nummer.
- Über jedem Kapitel steht klein seine Gruppe.

## Wenn eine Regel nicht passt

Dann wird die Abweichung im Pull Request begründet und hier festgehalten – nicht stillschweigend ein neues Muster eingeführt.

### Bekannte Abweichungen

- **„Häufige Fragen“** (Azubi) besteht nach der Einleitung nur aus Fragen und Antworten, ohne Zwischenüberschrift.
- **Ältere Kapitel** haben zum Teil noch einzelne Absätze zwischen oder nach den Abschnitten (zum Beispiel einen Hinweis unter den Begriffen). Sie werden in „Gut zu wissen“ eingeordnet, wenn das Kapitel das nächste Mal angefasst wird.
