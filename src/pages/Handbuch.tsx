import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ROLLE_TEXT } from '../api';
import type { Rolle } from '../api';
import { Link } from '../router';

/**
 * Handbuch je Rolle. Für Azubis bewusst in kurzen Sätzen und mit erklärten Begriffen –
 * die Leser sind zwischen 16 und 30 Jahre alt und kennen die Abläufe einer Ausbildung oft noch nicht.
 */
interface Kapitel {
  id: string;
  titel: string;
  inhalt: ReactNode;
}

const LERN_ORDNER = `industriekaufleute/
  paket.json            Titel, Quelle, Lizenz
  meta.json             Stand der Inhalte
  themenfelder.json     Liste und Reihenfolge der Themenfelder
  themen/
    buchfuehrung.md     je Themenfeld eine Datei
    beschaffung.md
  bilder/               Grafiken (nur SVG), freiwillig
  zusatz/               Abläufe Schritt für Schritt, freiwillig`;

const LERN_THEMA = `---
titel: Buchführung
---

Wie Geschäftsvorfälle erfasst werden: Konten, Buchungssätze und der Weg zum Jahresabschluss.

## Buchungssätze {#buchungssaetze}

### Kernbegriffe
- **Soll:** linke Seite eines Kontos.
- **Haben:** rechte Seite eines Kontos.

### Tabelle: Kontenarten
| Kontenart | Zugang | Abgang |
| --- | --- | --- |
| Aktivkonto | im Soll | im Haben |
| Passivkonto | im Haben | im Soll |

### Merksatz
Jeder Buchungssatz lautet: Soll an Haben.

### Prüfungsfrage
Ein Kunde bezahlt eine Rechnung über 1.190 € per Überweisung. Bilde den Buchungssatz.

1. Bank nimmt zu – Aktivkonto, also im Soll.
2. Forderungen nehmen ab – Aktivkonto, also im Haben.
3. Bank 1.190 € an Forderungen 1.190 €.

## Inventur {#inventur}

## Häufige Fehler
- Soll und Haben vertauscht.

## Links
- [Beispiel-Seite](https://www.example.org/) – Erklärungen zum Nachlesen`;

const IMPORT_BEISPIEL = `{
  "format": "ausbildungsportal-planvorlagen",
  "version": 1,
  "vorlagen": [
    {
      "titel": "Station IT-Support",
      "beruf": "Fachinformatiker/-in – Systemintegration",
      "eintraege": [
        {
          "art": "einsatz",
          "abWoche": 1,
          "wochen": 8,
          "titel": "IT-Support",
          "text": "Tickets annehmen und bearbeiten, Arbeitsplätze einrichten.",
          "unteraufgaben": []
        },
        {
          "art": "aufgabe",
          "abWoche": 2,
          "wochen": 1,
          "titel": "Drucker einrichten",
          "text": "",
          "unteraufgaben": ["Treiber installieren", "Testseite drucken"]
        },
        {
          "art": "notiz",
          "abWoche": 8,
          "wochen": 1,
          "titel": "Abschlussgespräch mit dem Teamleiter",
          "text": "",
          "unteraufgaben": []
        }
      ]
    }
  ]
}`;

function Begriff({ wort, children }: { wort: string; children: ReactNode }) {
  return (
    <>
      <dt>{wort}</dt>
      <dd>{children}</dd>
    </>
  );
}

const BEDIENUNG: Kapitel = {
  id: 'bedienung',
  titel: 'Bedienung auf PC, Tablet und Handy',
  inhalt: (
    <ul className="punkte">
      <li>Am PC steht das Menü oben. Auf Tablet und Handy steht es unten; weitere Punkte findest du unter „Mehr“.</li>
      <li className="nur-mit-glocke">Die Glocke oben rechts zeigt, was es Neues gibt. Mehr dazu im Kapitel „Die Glocke“.</li>
      <li>Etwas funktioniert nicht? Im Menü an deinem Namen bzw. unter „Mehr“ steht „Fehler melden“. Beschreibe kurz, was passiert ist. Wenn du magst, hängst du ein Bildschirmfoto an – du siehst es vorher und kannst es wieder entfernen. Mehr dazu im Kapitel „Fehler melden“. Die Meldung geht an den Betreiber des Portals; Seite, Version und Browser werden automatisch mitgeschickt.</li>
      <li>Wird das Portal aktualisiert, während du es offen hast, erscheint unten der Hinweis „Das Portal wurde aktualisiert“. Speichere, was du gerade eingibst, und wähle „Seite neu laden“.</li>
      <li>Leicht blau getönte Kästen mit „Anzeigen“ rechts lassen sich aufklappen – dahinter steht mehr, zum Beispiel eine Anleitung. Mit „Einklappen“ schließt du sie wieder.</li>
      <li>Hell oder dunkel: im Menü an deinem Namen bzw. unter „Mehr“. „Automatisch“ stellst du unter „Konto“ ein.</li>
      <li>Alles geht auch mit der Tastatur: Tab wechselt das Feld, Enter löst aus, Escape schließt Menüs und Fenster.</li>
      <li>Nach acht Stunden ohne Eingabe wirst du abgemeldet. Speichere längere Texte zwischendurch.</li>
    </ul>
  ),
};

const FEHLER: Kapitel = {
  id: 'fehler',
  titel: 'Fehler melden',
  inhalt: (
    <>
      <p>Etwas funktioniert nicht oder sieht falsch aus? Dann melde es – so wird es behoben.</p>
      <ol className="schritte">
        <li>Im Menü an deinem Namen (am Handy unter „Mehr“) „Fehler melden“ wählen. Das geht von jeder Seite aus.</li>
        <li>Kurz beschreiben: Was wolltest du tun? Was ist stattdessen passiert?</li>
        <li>Wenn du magst, ein Bildschirmfoto anhängen: auswählen, einfügen (Strg + V) oder am PC direkt aufnehmen. Du siehst das Bild vor dem Senden und kannst es wieder entfernen.</li>
        <li>„Meldung senden“.</li>
      </ol>
      <ul className="punkte">
        <li>
          <strong>Das wird mitgeschickt:</strong> dein Name und deine Rolle, die Seite, auf der du warst, die Version des Portals, dein Browser, die Größe des Fensters und die letzten Fehlermeldungen des Browsers. Im Fenster steht das unter „Das wird automatisch mitgeschickt“.
        </li>
        <li>
          <strong>Wer liest das?</strong> Der Betreiber des Portals (Super-Admin). Er sieht auch alles, was auf einem Bildschirmfoto steht – zum Beispiel Texte aus einem Bericht. Entferne das Bild, wenn etwas darauf nicht für ihn gedacht ist.
        </li>
        <li>Eine Antwort bekommst du im Portal nicht. Wenn es eilt, sprich zusätzlich deinen Ausbilder oder die IT an.</li>
        <li>Fragen zur Ausbildung oder zu einem Bericht gehören nicht hierher – die klärst du mit deinem Ausbilder.</li>
      </ul>
    </>
  ),
};

const DRUCKEN = (rolle: Rolle): Kapitel => ({
  id: 'drucken',
  titel: 'Berichte und Berichtsheft: PDF herunterladen oder drucken',
  inhalt: (
    <>
      <dl className="begriffe">
        <Begriff wort="Ein einzelner Bericht">Den Bericht öffnen und „Als PDF herunterladen“ wählen. Das Portal erzeugt die Datei und der Browser speichert sie bei deinen Downloads. „Bericht drucken“ öffnet stattdessen das Druckfenster.</Begriff>
        <Begriff wort="Das ganze Berichtsheft">Im Berichtsheft „Berichtsheft drucken …“. Auf der Seite dahinter wählst du aus, was hinein soll, und druckst es oder lädst es als PDF herunter. Daraus wird ein Dokument: ein Deckblatt, dann jeder Bericht auf einer eigenen Seite.</Begriff>
        <Begriff wort="Abkürzung">Die kleinen Knöpfe mit dem Pfeil nach unten laden sofort ein PDF, ohne weitere Fragen: oben neben „Berichtsheft drucken …“ das Heft mit Deckblatt und allen abgezeichneten Berichten, in jeder Woche den Bericht dieser Woche.</Begriff>
      </dl>
      <h3>Das ganze Berichtsheft drucken oder als PDF herunterladen</h3>
      <ol className="schritte">
        <li>Im Berichtsheft „Berichtsheft drucken …“ wählen.</li>
        <li>Auswählen, was hinein soll. Vorgegeben ist „Nur abgezeichnete“ – das ist das Heft, das du aus der Hand gibst. Mit „Auch nicht abgezeichnete“ kommen die übrigen dazu, zum Beispiel zum Durchsehen. Außerdem: alle Ausbildungsjahre oder eines; mit oder ohne Deckblatt. Darunter steht, wie viele Berichte es sind und welcher Zeitraum.</li>
        <li>„Berichtsheft drucken“ öffnet das Druckfenster. Oder „PDF herunterladen“: Die Datei heißt „Berichtsheft“, dein Name und der Zeitraum – du findest sie bei den Downloads deines Browsers.</li>
      </ol>
      <ul className="punkte">
        <li>Auf dem Deckblatt stehen Name, Beruf, Betrieb, Ausbilder, Zeitraum und die Zahl der Berichte – und das Logo des Betriebs, wenn eines hinterlegt ist.</li>
        <li>Im PDF stehen Kopf, Tätigkeiten, Stunden und die Unterschriften. Ist ein Logo hinterlegt, steht es blass hinter den Unterschriften. Unten steht auf jeder Seite „Seite … von …“.</li>
        <li>Ein langer Bericht läuft auf der nächsten Seite weiter; dort steht „Fortsetzung“.</li>
        <li>Für die Kammer zählen nur abgezeichnete Berichte – deshalb ist das die Vorgabe. Das Deckblatt nennt, wie viele Berichte abgezeichnet sind und wie viele nicht.</li>
        <li>Nicht abgezeichnete Berichte sind unübersehbar gekennzeichnet: Quer über die Seite steht „Entwurf“ bzw. „Nicht abgezeichnet“ – am Bildschirm, im Ausdruck und im PDF. {rolle === 'azubi' ? 'Hast du gerade etwas geändert: erst speichern, dann herunterladen.' : 'Entwürfe der Azubis siehst du nicht und bekommst sie auch nicht ins PDF: Bis zum Einreichen steht die Woche bei dir als „fehlt“.'}</li>
        <li>Zeichen, die es in der Schrift des PDF nicht gibt (zum Beispiel Emojis), erscheinen als „?“.</li>
        <li>Lieber auf Papier? „Berichtsheft drucken“ bzw. „Bericht drucken“ öffnet das Druckfenster. Chrome und Edge lassen Datum, Titel und Adresse am Rand von selbst weg; in anderen Browsern schaltest du dort unter „Weitere Einstellungen“ die „Kopf- und Fußzeilen“ aus.</li>
        {rolle === 'ausbilder' && <li>Bevor du das Konto eines Azubis löschst: das Berichtsheft als PDF herunterladen. Mit dem Konto werden die Berichte gelöscht.</li>}
      </ul>
    </>
  ),
});

const KALENDER = (rolle: Rolle): Kapitel => ({
  id: 'kalender',
  titel: 'Kalender abonnieren (Kalender-Abo)',
  inhalt: (
    <>
      <p>
        {rolle === 'azubi' ? 'Du kannst deinen Ausbildungsplan' : 'Du kannst die Pläne deiner Azubis'} in dein Kalenderprogramm holen – zum Beispiel auf dem Handy oder in Outlook. Das nennt man <strong>abonnieren</strong>: Der Kalender holt sich die Termine von selbst immer wieder neu.
      </p>
      <ol className="schritte">
        <li>
          Unter <Link zu="/konto">Konto</Link> bei „Kalender abonnieren“ auf „Kalender-Link erstellen“ gehen.
        </li>
        <li>Den Link kopieren und im Kalenderprogramm als Kalender-Abo eintragen – so geht es je Programm:</li>
      </ol>
      <dl className="begriffe">
        <Begriff wort="iPhone, iPad, Mac">Im Portal „Im Kalenderprogramm öffnen“ antippen und „Abonnieren“ bestätigen. Oder: Einstellungen → Kalender → Accounts → Account hinzufügen → Andere → Kalenderabo hinzufügen, dort den Link einfügen.</Begriff>
        <Begriff wort="Outlook">Im Kalender „Kalender hinzufügen“ → „Aus dem Internet abonnieren“ wählen und den Link einfügen. Der Kalender erscheint danach auch in der Outlook-App auf dem Handy.</Begriff>
        <Begriff wort="Google Kalender (Android)">Am PC calendar.google.com öffnen: links bei „Weitere Kalender“ auf „+“ → „Per URL“, den Link einfügen. Danach erscheint der Kalender auch auf dem Handy.</Begriff>
      </dl>
      <ul className="punkte">
        <li>Im Kalender stehen Berufsschule, Einsätze und Prüfungstermine als ganztägige Termine. {rolle === 'azubi' ? 'Dazu kommen deine eigenen Termine, mit Uhrzeit, wenn du eine angegeben hast. ' : 'Private Termine der Azubis stehen nicht in deinem Kalender. '}Aufgaben, Notizen und Berichte stehen dort nicht.</li>
        {rolle !== 'azubi' && <li>Vor jedem Termin steht der Name des Azubis. Du kannst den Link auch auf einen einzelnen Azubi beschränken. Du siehst nur Azubis, die du auch im Portal siehst.</li>}
        <li>Änderungen kommen mit Verzögerung an – je nach Programm nach einigen Stunden oder am nächsten Tag. Verbindlich ist der Plan im Portal.</li>
        <li>Der Kalender ist nur zum Lesen. Termine änderst du im Portal, nicht im Kalenderprogramm. Wochen gehen im Kalender von Montag bis Sonntag.</li>
        <li>
          <strong>Der Link ist wie ein Passwort:</strong> Wer ihn kennt, kann die Termine lesen. Gib ihn nicht weiter. Mit „Link erneuern“ wird der alte ungültig, mit „Abo beenden“ schaltest du es ganz ab.
        </li>
      </ul>
    </>
  ),
});

const BENACHRICHTIGUNGEN = (rolle: Rolle): Kapitel => ({
  id: 'benachrichtigungen',
  titel: 'Benachrichtigungen per Teams und E-Mail',
  inhalt: (
    <>
      <p>
        Die Glocke zeigt dir immer, was es Neues gibt. Zusätzlich kann dir das Portal eine Nachricht schicken – per Teams, per E-Mail oder beides. Das ist freiwillig und am Anfang ausgeschaltet. Du stellst es unter <Link zu="/konto">Konto</Link> bei „Benachrichtigungen“ ein.
      </p>
      <dl className="begriffe">
        <Begriff wort="Berichtsheft">{rolle === 'azubi' ? 'Dein Bericht wurde abgezeichnet, zurückgegeben oder wieder geöffnet.' : 'Ein Azubi hat einen Bericht eingereicht – oder an einem Bericht hat sich etwas getan.'}</Begriff>
        <Begriff wort="Urlaub">{rolle === 'azubi' ? 'Dein Urlaubsantrag wurde bestätigt, genehmigt, abgelehnt oder storniert.' : 'Ein Azubi hat Urlaub beantragt – oder an einem Antrag hat sich etwas getan.'}</Begriff>
        <Begriff wort="Ausbildungsplan">{rolle === 'azubi' ? 'In deinem Plan gibt es neue Einträge.' : 'Im Plan eines deiner Azubis gibt es neue Einträge von jemand anderem.'}</Begriff>
      </dl>
      <ul className="punkte">
        <li>Für jeden der drei Bereiche wählst du getrennt: per Teams, per E-Mail, beides oder gar nicht. Ein Haken wird sofort gespeichert.</li>
        <li>Du bekommst nur Nachrichten zu dem, was du auch in der Glocke siehst. Was du selbst gemacht hast, wird dir nicht gemeldet.</li>
        <li>
          <strong>In der Nachricht stehen keine anderen Namen und keine Inhalte.</strong> Sie spricht dich mit deinem Vornamen an und sagt nur, was passiert ist – zum Beispiel „Ein Bericht für KW 46 wurde eingereicht“. Der Knopf „Im Portal öffnen“ führt zur passenden Seite. Dort siehst du alles Weitere.
        </li>
        <li>Passiert mehreres kurz nacheinander, kommt es nach wenigen Minuten als eine Nachricht. Es dauert also etwas, bis sie da ist.</li>
        <li>Die Nachricht trägt oben „Ausbildungsportal“, den Namen und das Logo eures Betriebs. Ein farbiger Punkt vor jeder Zeile hilft beim Überfliegen: grün für erledigt, gelb für „wartet auf dich“, rot für „bitte ansehen“.</li>
        <li>In Teams kommt die Nachricht als Chat vom Absender „Workflows“. E-Mails gehen an die Adresse, mit der du dich anmeldest.</li>
        <li>Mit „Testnachricht senden“ probierst du aus, ob und wie die Nachricht bei dir ankommt.</li>
        <li>Ist ein Haken grau, ist dieser Weg in eurem Portal nicht eingerichtet. Darunter steht der Grund. Einrichten kann das nur, wer das Portal betreibt.</li>
        <li>Verlass dich nicht allein darauf: Kommt eine Nachricht einmal nicht an, steht es trotzdem in der Glocke.</li>
        <li>Gespeichert wird nur deine Auswahl. Welche Nachrichten du bekommen hast, merkt sich das Portal nicht.</li>
      </ul>
    </>
  ),
});

const GLOCKE = (rolle: Rolle): Kapitel => ({
  id: 'glocke',
  titel: 'Die Glocke: Was gibt es Neues?',
  inhalt: (
    <>
      <p>Oben rechts steht eine Glocke. Eine rote Zahl daran sagt dir, wie viel seit deinem letzten Blick neu ist.</p>
      <dl className="begriffe">
        {rolle === 'azubi' ? (
          <>
            <Begriff wort="Neuer Eintrag im Ausbildungsplan">Dein Ausbilder oder ein Ausbildungsbeauftragter hat etwas in deinen Plan eingetragen.</Begriff>
            <Begriff wort="Bericht abgezeichnet">Der Bericht ist unterschrieben und damit fertig.</Begriff>
            <Begriff wort="Bericht zurückgegeben">Du sollst etwas ändern. Ein Tipp auf die Zeile öffnet den Bericht, dort steht der Grund.</Begriff>
            <Begriff wort="Urlaub bestätigt, genehmigt, abgelehnt, storniert">Es hat sich etwas an deinem Urlaubsantrag getan. Die Zeile führt zu „Urlaub“.</Begriff>
          </>
        ) : (
          <>
            <Begriff wort="Bericht wartet auf Abzeichnung">Ein Azubi hat einen Bericht eingereicht. Die Zeile führt zu „Abzeichnen“.</Begriff>
            <Begriff wort="Neuer Eintrag im Ausbildungsplan">Ein Azubi hat eine eigene Aufgabe oder Notiz eingetragen – oder eine andere betreuende Person hat etwas geplant.</Begriff>
            <Begriff wort="Urlaub beantragt, bestätigt, zurückgezogen">Ein Azubi hat Urlaub beantragt oder an einem Antrag hat sich etwas getan. Die Zeile führt zu „Urlaub“.</Begriff>
          </>
        )}
      </dl>
      <ul className="punkte">
        <li>Ein Tipp auf eine Zeile führt direkt zum Plan oder zum Bericht.</li>
        <li>Sobald du die Glocke öffnest, verschwindet die Zahl. Die Zeilen bleiben stehen, damit du später noch einmal nachsehen kannst.</li>
        <li>Mehrere gleiche Dinge an einem Tag stehen in einer Zeile, zum Beispiel „3 Berichte abgezeichnet“.</li>
        <li>Was du selbst gemacht hast, steht nicht in der Glocke. Nach 60 Tagen werden die Zeilen gelöscht.</li>
        <li>Wer mag, bekommt zusätzlich eine Nachricht per Teams oder E-Mail. Das stellst du selbst ein – siehe Kapitel „Benachrichtigungen per Teams und E-Mail“. Ohne das schickt das Portal nichts; sieh dann regelmäßig hinein.</li>
      </ul>
    </>
  ),
});

const PROFILBILD = (rolle: Rolle): Kapitel => ({
  id: 'profilbild',
  titel: 'Profilbild',
  inhalt: (
    <>
      <p>
        Hat der Betreiber des Portals es eingeschaltet, zeigt das Portal dein Profilbild aus Microsoft 365 – dort, wo sonst deine Anfangsbuchstaben stehen. Unter <Link zu="/konto">Konto</Link> steht der Abschnitt „Profilbild“. Ist der Haken dort gesperrt, ist die Funktion nicht eingeschaltet – dann gibt es im Portal kein Bild von dir.
      </p>
      <ul className="punkte">
        <li>Das Portal holt das Bild bei jeder Anmeldung. Ein neues Bild in Microsoft 365 erscheint also nach deiner nächsten Anmeldung.</li>
        <li>Ändern kannst du das Bild nur in Microsoft 365, nicht im Portal.</li>
        <li>
          {rolle === 'azubi'
            ? 'Dein Bild sehen du selbst, dein Ausbilder und deine Ausbildungsbeauftragten. Andere Azubis sehen es nicht.'
            : 'Dein eigenes Bild siehst nur du. Die Bilder der Azubis siehst du bei den Azubis, die du auch sonst siehst – auf den Karten und beim Abzeichnen.'}
        </li>
        <li>
          <strong>Du willst kein Bild?</strong> Nimm unter „Konto“ den Haken bei „Mein Profilbild aus Microsoft 365 anzeigen“ heraus. Das Portal löscht dein Bild dann sofort und holt es nicht wieder.
        </li>
      </ul>
    </>
  ),
});

const APP: Kapitel = {
  id: 'app',
  titel: 'Als App auf Handy oder Tablet einrichten',
  inhalt: (
    <>
      <p>Du kannst das Portal wie eine App auf den Startbildschirm legen. Dann öffnest du es mit einem Tipp, ohne die Adresse einzugeben. Es wird nichts aus einem App-Store geladen.</p>
      <h3>Android (Chrome)</h3>
      <ol className="schritte">
        <li>Öffne das Portal in Chrome und melde dich an.</li>
        <li>Tippe oben rechts auf die drei Punkte.</li>
        <li>Wähle „App installieren“ oder „Zum Startbildschirm hinzufügen“ und bestätige.</li>
      </ol>
      <p className="leise klein">Oft geht es noch schneller: Im Portal unter „Mehr“ steht dann der Punkt „Als App installieren“.</p>
      <h3>iPhone und iPad (Safari)</h3>
      <ol className="schritte">
        <li>Öffne das Portal in Safari und melde dich an.</li>
        <li>Tippe auf das Teilen-Symbol (Viereck mit Pfeil nach oben).</li>
        <li>Wähle „Zum Home-Bildschirm“ und dann „Hinzufügen“.</li>
      </ol>
      <h3>Gut zu wissen</h3>
      <ul className="punkte">
        <li>Beim ersten Öffnen der App meldest du dich einmal neu an.</li>
        <li>Die App braucht eine Verbindung zum Portal. Ohne Verbindung erscheint ein Hinweis; schreiben kannst du dann nicht.</li>
        <li>Fehlt der Menüpunkt zum Installieren, ist das Portal bei euch nicht über eine sichere Adresse (https) erreichbar. Sag deinem Ausbilder Bescheid.</li>
        <li>Entfernen geht wie bei jeder App: Symbol gedrückt halten und löschen. Deine Berichte bleiben im Portal erhalten.</li>
      </ul>
    </>
  ),
};

const AZUBI: Kapitel[] = [
  {
    id: 'ueberblick',
    titel: 'Worum geht es?',
    inhalt: (
      <>
        <p>Das Portal hat zwei Teile:</p>
        <ul className="punkte">
          <li>
            <strong>Ausbildungsplan</strong> – hier siehst du, was in welcher Woche ansteht: Berufsschule, Abteilung, Aufgaben, Prüfungen. Das ist deine Startseite.
          </li>
          <li>
            <strong>Berichtsheft</strong> – hier schreibst du jede Woche auf, was du gemacht hast. Dein Ausbilder liest es und bestätigt es.
          </li>
        </ul>
        <p>Das Berichtsheft ist Pflicht. Ohne vollständige Berichte wirst du nicht zur Abschlussprüfung zugelassen. Es lohnt sich also, jede Woche dranzubleiben.</p>
      </>
    ),
  },
  {
    id: 'plan',
    titel: 'Den Ausbildungsplan lesen',
    inhalt: (
      <>
        <p>Jede Zeile ist eine Kalenderwoche (KW). Die laufende Woche ist blau hinterlegt. In einer Woche können stehen:</p>
        <dl className="begriffe">
          <Begriff wort="Berufsschule">Du bist in der Schule. Die Woche hat links einen violetten Streifen.</Begriff>
          <Begriff wort="Einsatz">In dieser Abteilung oder an diesem Ort arbeitest du. Dabei steht oft, wer für dich zuständig ist.</Begriff>
          <Begriff wort="Neue Abteilung">Beginnt ein Einsatz in einer Abteilung, steht darüber ein gelber Streifen. Die Karte zeigt deine Ansprechpersonen dort – die Stellvertretung hat einen hellen Kreis – und in welcher Woche des Einsatzes du bist. Links (am Handy unter „Abteilungen“) siehst du alle Abteilungen der Reihe nach.</Begriff>
          <Begriff wort="Aufgabe">Etwas, das du erledigen sollst. Wenn du fertig bist, setzt du den Haken.</Begriff>
          <Begriff wort="Notiz">Ein Hinweis ohne Haken.</Begriff>
          <Begriff wort="Termin">Ein einzelner Tag, den du selbst eingetragen hast – mit Datum und, wenn du willst, Uhrzeit.</Begriff>
          <Begriff wort="Prüfung">Ein Prüfungstermin. Oben auf der Seite siehst du, wie viele Wochen es noch sind.</Begriff>
          <Begriff wort="Schulferien, Feiertag">Zur Info. In den Schulferien ist keine Berufsschule – im Betrieb arbeitest du normal weiter, außer du hast Urlaub.</Begriff>
          <Begriff wort="Firmentermin">Ein Termin deines Betriebs, der für alle gilt – zum Beispiel „Betrieb geschlossen“ oder eine Betriebsversammlung. Er steht als gelbe Zeile in der Woche. Das ist nur eine Info: In deinem Bericht steht er nicht von selbst, und Urlaub musst du trotzdem beantragen, wenn dein Betrieb das so regelt. Frag im Zweifel deinen Ausbilder.</Begriff>
        </dl>
        <p>
          <strong>Selbst etwas eintragen:</strong> Mit dem „+“ an einer Woche legst du eigene Aufgaben und Notizen an, zum Beispiel „Für die Klassenarbeit lernen“. Diese kannst du auch wieder ändern oder löschen.
        </p>
        <p>
          <strong>Termine:</strong> Einzelne Tage wie eine JAV-Sitzung trägst du als Termin ein. Mehr dazu im Kapitel „Eigene Termine eintragen“.
        </p>
        <p>Was dein Ausbilder oder deine Ausbildungsbeauftragten eingetragen haben, kannst du nicht ändern – nur abhaken.</p>
      </>
    ),
  },
  {
    id: 'termine',
    titel: 'Eigene Termine eintragen',
    inhalt: (
      <>
        <p>
          Mit „+ Termin“ bei „Diese Woche“ oder „Nächste Woche“ – oder über „+“ an einer Woche und die Art „Termin“ – trägst du einzelne Tage ein, die du dir merken willst. Zum Beispiel eine Sitzung der JAV (Jugend- und
          Auszubildendenvertretung), ein Gespräch mit der Personalabteilung oder eine Betriebsversammlung. Du gibst den Tag an und, wenn du willst, Beginn und Ende.
        </p>
        <ul className="punkte">
          <li>
            <strong>Termine siehst nur du.</strong> Dein Ausbilder und deine Ausbildungsbeauftragten sehen sie nicht – nicht in deinem Plan, nicht in ihrem Jahreskalender, nicht in der Glocke und nicht in ihrem Kalender. Wenn sie von einem Termin wissen sollen, sag es ihnen selbst.
          </li>
          <li>Termine stehen oben bei „Diese Woche“ und „Nächste Woche“ und, wenn du deinen Kalender abonniert hast, auch dort.</li>
          <li>Du kannst jeden Termin ändern oder löschen.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'bericht',
    titel: 'Einen Bericht schreiben – Schritt für Schritt',
    inhalt: (
      <>
        <p>
          <strong>Einmal vorab:</strong> Unterschreibe unter <Link zu="/konto">Konto</Link> im Feld „Unterschrift“ – mit dem Finger, einem Stift oder der Maus. Diese Unterschrift kommt unter jeden Bericht, den du einreichst. Ohne sie
          kannst du nicht einreichen.
        </p>
        <ol className="schritte">
          <li>
            Öffne das <Link zu="/berichtsheft">Berichtsheft</Link> und wähle bei der Woche „Schreiben“.
          </li>
          <li>
            Trag ein, was du gemacht hast, und wie viele Stunden es waren. Die Seite hat vier Teile. „Betriebliche Tätigkeiten“ ist offen; die anderen öffnest du mit „Eintragen“, wenn du sie brauchst:
            <ul className="punkte">
              <li>
                <strong>Betriebliche Tätigkeiten</strong> – deine Arbeit im Betrieb.
              </li>
              <li>
                <strong>Unterweisungen und Schulungen</strong> – wenn dir etwas erklärt wurde, zum Beispiel Arbeitssicherheit oder ein Lehrgang.
              </li>
              <li>
                <strong>Berufsschule</strong> – die Themen aus dem Unterricht.
              </li>
              <li>
                <strong>Abwesenheit</strong> – Urlaub, Krankheit, Feiertag.
              </li>
            </ul>
          </li>
          <li>Unter „Deine Woche“ (am Handy in der Leiste unten) siehst du beim Schreiben, wie viele Stunden schon drinstehen und wie viele noch fehlen. Die Summe sollte ungefähr zu deinen Wochenstunden passen.</li>
          <li>
            Noch nicht fertig? <strong>„Als Entwurf speichern“</strong>. Du schreibst später weiter; den Entwurf siehst nur du.
          </li>
          <li>
            Fertig? <strong>„Einreichen“</strong>. Damit unterschreibst du den Bericht und gibst ihn an deinen Ausbilder. Bis er unterschrieben hat, kannst du den Bericht noch zurückholen.
          </li>
        </ol>
        <p>
          <strong>Drucken:</strong> Mehr dazu im Kapitel „Berichte und Berichtsheft: PDF herunterladen oder drucken“.
        </p>
        <h3>Fotos und Dateien anhängen</h3>
        <p>Manchmal sagt ein Foto mehr als ein Satz: der fertig verkabelte Schrank, das Werkstück, die Skizze. Solche Dinge kannst du an den Bericht hängen.</p>
        <ul className="punkte">
          <li>
            Wähle <strong>„Foto oder Datei anhängen“</strong>. Am Handy und Tablet gibt es zusätzlich <strong>„Foto aufnehmen“</strong> – das öffnet die Kamera.
          </li>
          <li>Schreibst du Tag für Tag, hängt der Anhang am jeweiligen Tag. Sonst gehört er zum ganzen Bericht (Teil „Fotos und Dateien“).</li>
          <li>Erlaubt sind Bilder (JPG, PNG, GIF, WebP, HEIC), PDF und Office-Dateien (DOCX, XLSX, PPTX, ODT, ODS, ODP). Je Datei höchstens 5 MB, je Bericht höchstens 12 Anhänge. Große Fotos macht das Portal vor dem Hochladen kleiner.</li>
          <li>Alte Office-Formate (DOC, XLS, PPT) und Dateien mit Makros nimmt das Portal nicht an. Speichere sie als DOCX, XLSX, PPTX oder PDF.</li>
          <li>
            <strong>Ein Anhang wird sofort gespeichert</strong> – du musst nicht extra speichern. Ist der Bericht noch nicht gespeichert, legt das Portal dabei einen Entwurf an. Auch „Löschen“ wirkt sofort.
          </li>
          <li>
            <strong>Achte darauf, was zu sehen ist:</strong> keine anderen Personen ohne ihr Einverständnis, keine Bildschirme oder Unterlagen mit Namen, Passwörtern oder Kundendaten. Im Zweifel frag deinen Ausbilder.
          </li>
          <li>Anhänge sehen dieselben Personen wie den Bericht – bei einem Entwurf also nur du. Nach dem Einreichen kannst du sie nicht mehr ändern, außer du ziehst den Bericht zurück.</li>
          <li>Im Ausdruck und im PDF des Berichtshefts stehen Anhänge nicht.</li>
        </ul>
        <h3>Wenn dein Betrieb Einträge je Tag möchte</h3>
        <p>Dein Betrieb legt fest, ob du die Woche im Ganzen beschreibst oder Tag für Tag – das kann für jeden Azubi anders sein. Was für dich gilt, steht unter „Konto“ bei „Meine Ausbildung“. Bei „je Tag“ sieht die Seite etwas anders aus:</p>
        <ul className="punkte">
          <li>Statt der drei Teile steht für jeden Tag von Montag bis Freitag ein eigener Kasten. Oben rechts im Kasten siehst du die Stunden dieses Tages.</li>
          <li>
            In jedem Kasten wählst du, was du einträgst: <strong>„Tätigkeit im Betrieb eintragen“</strong>, <strong>„Unterweisung eintragen“</strong> oder <strong>„Berufsschule eintragen“</strong>. Über dem Textfeld steht dann, wozu die Zeile gehört.
          </li>
          <li>Stunden kannst du in Viertelstunden eintragen: 0,25 ist eine Viertelstunde, 1,5 sind anderthalb Stunden.</li>
          <li>Hast du am Samstag oder Sonntag gearbeitet, wähle unter den Tagen „Wochenende anzeigen“.</li>
          <li>Urlaub, Krankheit und Feiertage trägst du weiter unten bei „Abwesenheit“ ein. Im Kasten des Tages steht dann ein gelber Hinweis.</li>
          <li>Unter „Deine Woche“ siehst du zusätzlich die Stunden je Tag – und welche Tage noch leer sind.</li>
          <li>Es bleibt ein Bericht für die ganze Woche: Du reichst ihn einmal ein, und er wird einmal abgezeichnet.</li>
          <li>Berichte, die du schon gespeichert hast, behalten ihre alte Form – auch wenn dein Betrieb umstellt.</li>
        </ul>
        <h3>So schreibst du gute Einträge</h3>
        <p>Schreib kurz und genau: Was hast du gemacht, womit und wozu?</p>
        <dl className="begriffe">
          <Begriff wort="Zu ungenau">„Im Lager geholfen“</Begriff>
          <Begriff wort="Besser">„Wareneingang geprüft: Lieferscheine mit der Bestellung verglichen und 40 Artikel eingelagert“</Begriff>
        </dl>
        <p>Am einfachsten ist es, wenn du dir jeden Tag ein paar Stichworte notierst und am Freitag den Bericht fertig machst.</p>
      </>
    ),
  },
  {
    id: 'urlaub',
    titel: 'Urlaub beantragen',
    inhalt: (
      <>
        <p>
          Unter <Link zu="/urlaub">Urlaub</Link> beantragst du deinen Urlaub. Du kommst auch aus dem Ausbildungsplan über „Urlaub beantragen“ dorthin.
        </p>
        <ol className="schritte">
          <li>Trag den ersten und den letzten Urlaubstag ein. Für einen einzelnen Tag ist beides derselbe Tag.</li>
          <li>Das Portal zählt die Arbeitstage: Montag bis Freitag, ohne Feiertage. Es sagt dir auch, wer zustimmen muss.</li>
          <li>Lies die Hinweise, falls welche erscheinen – zum Beispiel, wenn in der Zeit Berufsschule ist. Du kannst den Antrag trotzdem stellen, klär das aber vorher.</li>
          <li>Tipp auf „Urlaub beantragen“.</li>
        </ol>
        <p>So geht es weiter:</p>
        <dl className="begriffe">
          <Begriff wort="Wartet auf Bestätigung">Deine Ausbildungsbeauftragten müssen zustimmen. Bist du in einer Abteilung eingesetzt, genügt die Zustimmung einer Person aus dieser Abteilung.</Begriff>
          <Begriff wort="Wartet auf Genehmigung">Jetzt entscheidet dein Ausbilder. Ist dir niemand zugewiesen, liegt der Antrag sofort bei ihm.</Begriff>
          <Begriff wort="Genehmigt">Der Urlaub steht fest. Er erscheint von selbst im Jahreskalender, im Bericht der Woche und im abonnierten Kalender. Die Personalstelle bekommt vom Portal eine Mail mit deinem Namen und dem Zeitraum – deine Bemerkung steht nicht darin.</Begriff>
          <Begriff wort="Abgelehnt">Der Grund steht am Antrag. Du kannst einen neuen Antrag für eine andere Zeit stellen.</Begriff>
          <Begriff wort="Storniert">Dein Ausbilder hat einen genehmigten Urlaub wieder aufgehoben. Der Grund steht am Antrag.</Begriff>
        </dl>
        <ul className="punkte">
          <li>Was sich an deinem Antrag tut, siehst du auch in der Glocke.</li>
          <li>Solange noch nicht entschieden ist, kannst du den Antrag zurückziehen. Danach nicht mehr – sprich dann mit deinem Ausbilder.</li>
          <li>Ändern lässt sich ein Antrag nicht. Zieh ihn zurück und stell einen neuen.</li>
          <li>Das Urlaubskonto oben zeigt Anspruch, genehmigte und beantragte Tage und was noch frei ist. Resturlaub aus dem Vorjahr kennt das Portal nicht – frag im Zweifel nach.</li>
          <li>Halbe Tage gibt es im Portal nicht.</li>
          <li>Die Bemerkung ist freiwillig. Schreib nichts zu Gesundheit oder Privatem hinein.</li>
          <li>Krank melden kannst du dich hier nicht – das läuft wie bisher im Betrieb.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'jahreskalender',
    titel: 'Den Jahreskalender lesen',
    inhalt: (
      <>
        <p>
          Der <Link zu="/jahreskalender">Jahreskalender</Link> zeigt dein ganzes Jahr auf einer Seite. Du findest ihn im Ausbildungsplan über „Jahreskalender anzeigen“. Die Monate stehen nebeneinander, die Tage 1 bis 31 untereinander – wie bei einem Wandkalender.
        </p>
        <dl className="begriffe">
          <Begriff wort="Violett">Berufsschule.</Begriff>
          <Begriff wort="Grün">Einsatz in einer Abteilung. Der Name steht am ersten Tag und an jedem Montag.</Begriff>
          <Begriff wort="Gelb">Urlaub – genehmigter Urlaub und Urlaub, den du im Berichtsheft als Abwesenheit eingetragen hast.</Begriff>
          <Begriff wort="Gelb gestreift, „Urlaub?“">Beantragter Urlaub, über den noch nicht entschieden ist.</Begriff>
          <Begriff wort="Rot">Prüfung.</Begriff>
          <Begriff wort="Blau">Feiertag. Ein blauer Punkt mit Text ist ein eigener Termin von dir – den siehst nur du.</Begriff>
          <Begriff wort="Gelber Rand">Firmentermin: ein Termin deines Betriebs für alle, zum Beispiel „Betrieb geschlossen“. Alle Firmentermine des Jahres stehen außerdem als Liste über dem Kalender.</Begriff>
          <Begriff wort="Türkiser Strich unten">Schulferien.</Begriff>
          <Begriff wort="Grau">Wochenende oder Tage vor Beginn und nach Ende deiner Ausbildung.</Begriff>
        </dl>
        <ul className="punkte">
          <li>Der heutige Tag ist blau umrandet.</li>
          <li>Mit „←“ und „→“ blätterst du ein Jahr zurück oder vor. „Dieses Jahr“ bringt dich zurück.</li>
          <li>Fahr mit der Maus über einen Tag (oder tipp ihn lange an): Dann steht dort alles zu diesem Tag.</li>
          <li>Am Handy ist der Kalender breiter als der Bildschirm – wisch nach links und rechts. Die Spalte mit den Tagen bleibt stehen.</li>
          <li>Ändern kannst du hier nichts. Einträge machst du im Ausbildungsplan, Urlaub beantragst du unter „Urlaub“.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'lernen',
    titel: 'Lernen mit Cheatsheets und Ampel',
    inhalt: (
      <>
        <p>
          Den Menüpunkt <Link zu="/lernen">Lernen</Link> gibt es, wenn für deinen Ausbildungsberuf Lerninhalte eingeschaltet sind. Fehlt er, gibt es für deinen Beruf noch keine – frag deinen Ausbilder.
        </p>
        <dl className="begriffe">
          <Begriff wort="Themenfeld">Ein großes Thema deines Berufs, zum Beispiel „Netzwerkgrundlagen“. Jedes Themenfeld hat mehrere Unterthemen.</Begriff>
          <Begriff wort="Cheatsheet">Ein Spickzettel zu einem Unterthema: die wichtigsten Begriffe, Tabellen, Befehle, ein Merksatz und oft eine typische Prüfungsfrage mit Lösungsweg. Grafiken werden groß, wenn du sie anklickst.</Begriff>
          <Begriff wort="Ampel">Damit schätzt du dich selbst ein: „Offen“ (noch nichts gemacht), „In Arbeit“ (kenne ich, brauche aber noch das Cheatsheet), „Sicher“ (kann ich ohne Hilfe erklären und anwenden).</Begriff>
          <Begriff wort="Lernpunkt">Steht ein Unterthema auf „In Arbeit“, kannst du notieren, was dir noch schwerfällt. Der Text bleibt, auch wenn du später auf „Sicher“ stellst.</Begriff>
          <Begriff wort="Notiz">Eine freie Notiz zu jedem Unterthema, zum Beispiel „in der Berufsschule nachfragen“.</Begriff>
          <Begriff wort="Zusatzwissen">Vertiefungen zu einem Themenfeld, zum Beispiel ein Ablauf Schritt für Schritt oder ein Vergleich. Zusatzwissen ist freiwillig und zählt nicht zur Ampel. Du findest es unten im Themenfeld im gestrichelten Rahmen.</Begriff>
        </dl>
        <ol className="schritte">
          <li>Unter „Lernen“ ein Themenfeld öffnen. Links stehen dann alle Themenfelder und die Unterthemen des geöffneten – damit springst du direkt hin. Am Handy steckt diese Liste hinter „Themenfeld wechseln“.</li>
          <li>Das Cheatsheet des Unterthemas lesen. Es steht gleich offen da. Jedes Unterthema hat einen eigenen Kasten mit Nummer und Titel im farbigen Kopf – so siehst du, wo eins aufhört und das nächste anfängt.</li>
          <li>Die Ampel einstellen. Das Portal fragt nach, ob du wirklich umstellen willst – so ändert ein versehentlicher Klick nichts. Nach „Auf … stellen“ ist der neue Stand gespeichert. Sei ehrlich zu dir – die Ampel ist nur für dich.</li>
          <li>Bei „In Arbeit“ den Lernpunkt eintragen und „Lernpunkt speichern“ wählen.</li>
        </ol>
        <ul className="punkte">
          <li>
            <strong>Deinen Lernstand siehst nur du.</strong> Dein Ausbilder und deine Ausbildungsbeauftragten sehen weder deine Ampeln noch deine Lernpunkte oder Notizen. Es gibt auch keine Auswertung für sie.
          </li>
          <li>Die Ampel eines Themenfelds ergibt sich aus den Unterthemen: „Sicher“, wenn mindestens 80 von 100 Unterthemen sicher sind und keines offen ist. „Offen“, wenn alle offen sind. Sonst „In Arbeit“.</li>
          <li>Die Prozentzahl: sicher zählt ganz, in Arbeit halb, offen gar nicht.</li>
          <li>Steht bei einem Unterthema „Inhalt aktualisiert“, wurde das Cheatsheet geändert, seit du es bewertet hast. Lies es noch einmal und wähle „Als gesehen merken“.</li>
          <li>Steht an einem Unterthema „Vertiefung“, gibt es dazu Zusatzwissen. Der Link darunter bringt dich hin – manchmal in ein anderes Themenfeld. Beim Zusatzwissen steht umgekehrt unter „Vertieft:“, zu welchen Unterthemen es gehört.</li>
          <li>Bei einem Ablauf gehst du mit „Nächster Schritt“ weiter oder lässt ihn mit „Ablauf abspielen“ von selbst laufen; das Tempo kannst du wählen. Die Tabellen daneben zeigen, was sich in diesem Schritt ändert.</li>
          <li>Hast du ein Zusatzwissen durch, setz den Haken bei „Gelesen“. Auch diesen Haken siehst nur du.</li>
          <li>Die Cheatsheets ersetzen nicht die Berufsschule. Sie helfen dir, den Stoff zu sortieren und Lücken zu finden.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'ueben',
    titel: 'Üben mit Karteikarten und Quiz',
    inhalt: (
      <>
        <p>
          Unter <Link zu="/lernen/ueben">Lernen → Üben</Link> wiederholst du den Stoff. Die Karten und Fragen entstehen aus den Kernbegriffen und Prüfungsfragen der Cheatsheets.
        </p>
        <h3>Karteikarten</h3>
        <ol className="schritte">
          <li>Wähl ein Themenfeld oder „Karteikarten aus allen Themenfeldern“. Eine Runde hat höchstens 20 Karten.</li>
          <li>Lies die Vorderseite und überleg dir die Antwort.</li>
          <li>Tipp auf „Karte umdrehen“ und vergleiche.</li>
          <li>Sag ehrlich „Gewusst“ oder „Nicht gewusst“.</li>
        </ol>
        <ul className="punkte">
          <li>Das Portal arbeitet wie ein Karteikasten mit fünf Fächern. Eine gewusste Karte wandert ein Fach weiter und kommt später wieder: nach 1, 3, 7, 14 und 30 Tagen. Eine nicht gewusste Karte geht zurück in Fach 1 und ist sofort wieder dran.</li>
          <li>„Heute dran“ sind neue Karten und alle, deren Pause vorbei ist. Ist keine dran, kannst du mit „Trotzdem üben“ weitermachen.</li>
          <li>Karteikarten zählen nicht für die Abzeichen. Sie sind zum Lernen da.</li>
        </ul>
        <h3>Quiz</h3>
        <ul className="punkte">
          <li>Zu jedem Unterthema mit mindestens drei Kernbegriffen gibt es ein Quiz. Du liest eine Erklärung und wählst den passenden Begriff aus vier Vorschlägen.</li>
          <li>Nach jeder Antwort siehst du, ob sie stimmt. Am Ende wertet das Portal aus.</li>
          <li>
            <strong>Bestanden</strong> hast du ab 80 Prozent richtigen Antworten. Du kannst ein Quiz so oft wiederholen, wie du willst; bestanden bleibt bestanden.
          </li>
          <li>
            <strong>Meister:</strong> Frühestens eine Woche nach dem Bestehen zählt eine fehlerfreie Runde. Am Quiz steht, ab wann.
          </li>
          <li>Bestandene Quiz bringen dir die Abzeichen Silber, Gold und Meister – mehr im Kapitel „Abzeichen sammeln“.</li>
          <li>Verlässt du ein Quiz mittendrin, zählt die Runde nicht.</li>
          <li>Deine Ergebnisse siehst nur du.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'abzeichen',
    titel: 'Abzeichen sammeln',
    inhalt: (
      <>
        <p>
          Unter <Link zu="/lernen">Lernen</Link> sammelst du Abzeichen: in jedem Themenfeld ein Schild, das mit deinem Lernstand wächst. Es gibt sechs Stufen. Die ersten drei hängen an Ampel und Zusatzwissen, die oberen drei am Quiz unter „Üben“:
        </p>
        <dl className="begriffe">
          <Begriff wort="Holz">Bei einem Unterthema steht die Ampel auf Gelb oder Grün.</Begriff>
          <Begriff wort="Stein">Bei der Hälfte der Unterthemen steht die Ampel auf Gelb oder Grün.</Begriff>
          <Begriff wort="Bronze">Bei allen Unterthemen steht die Ampel auf Gelb oder Grün und du hast das Zusatzwissen des Themenfelds als gelesen abgehakt.</Begriff>
          <Begriff wort="Silber">Wie Bronze – und du hast das Quiz zur Hälfte der Unterthemen bestanden.</Begriff>
          <Begriff wort="Gold">Du hast das Quiz zu allen Unterthemen bestanden.</Begriff>
          <Begriff wort="Meister">Du hast alle Quiz noch einmal ohne Fehler geschafft – frühestens eine Woche nach dem Bestehen. So zeigt sich, was wirklich sitzt.</Begriff>
        </dl>
        <ul className="punkte">
          <li>Unter jedem Schild steht, was bis zur nächsten Stufe fehlt.</li>
          <li>Gezählt werden nur Unterthemen, für die es ein Quiz gibt. Hat ein Themenfeld gar kein Quiz, ist dort Bronze die höchste Stufe.</li>
          <li>Ein neues Abzeichen zeigt dir das Portal einmal groß an.</li>
          <li>Ein Abzeichen bleibt. Stellst du eine Ampel später zurück auf Rot oder kommen neue Inhalte dazu, verlierst du es nicht.</li>
          <li>
            <strong>Dein Rang</strong> steht oben auf der Seite „Lernen“. Er ist die Stufe, die du in mindestens der Hälfte der Themenfelder erreicht hast.
          </li>
          <li>Abzeichen siehst nur du – wie deinen ganzen Lernstand. Ausbilder und Ausbildungsbeauftragte sehen sie nicht, und es gibt keine Rangliste.</li>
          <li>Sei ehrlich mit der Ampel: Die Abzeichen sollen dir Spaß machen. Für die Prüfung zählt, was du wirklich kannst.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'kompendium',
    titel: 'Im Kompendium nachschlagen',
    inhalt: (
      <>
        <p>
          Das <Link zu="/lernen/kompendium">Kompendium</Link> ist ein Nachschlagewerk: Es sammelt alles aus allen Cheatsheets in einer Liste von A bis Z – Begriffe, Befehle, Tabellen, Merksätze, Prüfungsfragen und das Zusatzwissen. Praktisch, wenn du im Betrieb schnell etwas wissen willst und nicht weißt, in welchem Themenfeld es steht. Du findest es unter „Lernen“ oben neben „Themenfelder“.
        </p>
        <ol className="schritte">
          <li>Bei „Suchen“ ein Wort eintippen, zum Beispiel „DHCP“. Die Liste zeigt sofort nur noch passende Einträge. Die Fundstellen sind gelb markiert.</li>
          <li>Wenn du willst: ein Themenfeld wählen oder nur eine Art anzeigen, zum Beispiel „Befehle“.</li>
          <li>Unter jedem Eintrag steht „Zum Cheatsheet“ (beim Zusatzwissen „Zum Zusatzwissen“). Damit springst du zur passenden Stelle.</li>
        </ol>
        <ul className="punkte">
          <li>Mehrere Suchwörter: Es erscheinen nur Einträge, in denen alle vorkommen.</li>
          <li>Umlaute musst du nicht genau treffen: „Schluessel“ findet auch „Schlüssel“.</li>
          <li>Bei Prüfungsfragen ist der Lösungsweg eingeklappt. Überleg erst selbst, dann klapp ihn auf.</li>
          <li>Mit den Buchstaben springst du in der Liste weiter. „Filter zurücksetzen“ zeigt wieder alles.</li>
          <li>Suche und Filter bleiben stehen, wenn du zu einem Cheatsheet springst und zurückkommst.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'stand',
    titel: 'Was bedeutet der Stand eines Berichts?',
    inhalt: (
      <dl className="begriffe">
        <Begriff wort="fehlt">Für diese Woche hast du noch nichts geschrieben.</Begriff>
        <Begriff wort="Entwurf">Du hast angefangen und gespeichert. Nur du siehst den Bericht. Er ist noch nicht abgegeben.</Begriff>
        <Begriff wort="eingereicht">Du hast den Bericht abgegeben. Jetzt ist dein Ausbilder dran. Solange er nicht unterschrieben hat, kannst du den Bericht zurückziehen und ändern.</Begriff>
        <Begriff wort="zurückgegeben">Dein Ausbilder möchte, dass du etwas änderst. Der Grund steht oben im Bericht. Ändere ihn und reiche ihn noch einmal ein. Das ist normal und kein Drama.</Begriff>
        <Begriff wort="abgezeichnet">Dein Ausbilder hat unterschrieben. Der Bericht ist fertig und lässt sich nicht mehr ändern.</Begriff>
      </dl>
    ),
  },
  DRUCKEN('azubi'),
  {
    id: 'konto',
    titel: 'Dein Konto und deine Unterschrift',
    inhalt: (
      <>
        <p>
          Unter <Link zu="/konto">Konto</Link> (im Menü an deinem Namen, am Handy unter „Mehr“) steht alles, was nur dich betrifft:
        </p>
        <dl className="begriffe">
          <Begriff wort="Meine Ausbildung">Beruf, Berufsschule, Ausbildungszeit, Wochenstunden, die Form deines Berichtshefts und Prüfungstermine. Das trägt dein Ausbilder ein. Stimmt etwas nicht, sag ihm Bescheid.</Begriff>
          <Begriff wort="Unterschrift">Du unterschreibst einmal mit dem Finger, einem Stift oder der Maus. Diese Unterschrift kommt unter jeden Bericht, den du einreichst. Ohne sie kannst du nicht einreichen. Änderst du sie später, behalten alte Berichte die alte Unterschrift.</Begriff>
          <Begriff wort="Kalender abonnieren">Dein Plan im eigenen Kalender. Mehr dazu im Kapitel „Kalender abonnieren“.</Begriff>
          <Begriff wort="Benachrichtigungen">Ob du zusätzlich zur Glocke eine Nachricht per Teams oder E-Mail bekommst. Mehr dazu im Kapitel „Benachrichtigungen per Teams und E-Mail“.</Begriff>
          <Begriff wort="Darstellung">Hell, dunkel oder automatisch wie dein Gerät.</Begriff>
        </dl>
        <p>Angemeldet wirst du mit deinem Microsoft-Konto. Ein eigenes Passwort für das Portal gibt es nicht.</p>
      </>
    ),
  },
  {
    id: 'fragen',
    titel: 'Häufige Fragen',
    inhalt: (
      <dl className="begriffe breit">
        <Begriff wort="Ich habe Wochen vergessen. Was jetzt?">Schreib sie nach – die fehlenden Wochen stehen im Berichtsheft unter „Fehlt“. Je früher, desto leichter erinnerst du dich.</Begriff>
        <Begriff wort="Ich habe einen Fehler eingereicht.">Öffne den Bericht und wähle „Zurückziehen“. Das geht, solange er nicht abgezeichnet ist. Danach bitte deinen Ausbilder, die Abzeichnung aufzuheben.</Begriff>
        <Begriff wort="Ich war die ganze Woche krank oder im Urlaub.">Schreib trotzdem einen Bericht: Trag die Tage unter „Abwesenheit“ ein und reiche ihn ein. Genehmigter Urlaub steht dort schon.</Begriff>
        <Begriff wort="„Einreichen“ geht nicht.">Meist fehlt die Unterschrift. Hinterlege sie unter „Konto“. Außerdem müssen Stunden eingetragen sein.</Begriff>
        <Begriff wort="Kann ich meine Unterschrift ändern?">Ja, unter „Konto“. Schon unterschriebene Berichte behalten die alte Unterschrift.</Begriff>
        <Begriff wort="Wer sieht meine Berichte?">Du, deine Ausbilder und die Ausbildungsbeauftragten, denen du zugeteilt bist. Andere Azubis sehen sie nicht.</Begriff>
        <Begriff wort="Ich brauche das Berichtsheft auf Papier.">Im Berichtsheft „Berichtsheft drucken …“ wählen: Dort druckst du es oder lädst es als PDF herunter.</Begriff>
        <Begriff wort="Ich komme nicht weiter.">Frag deinen Ausbilder oder deine Ausbildungsbeauftragten. Wenn die Anmeldung nicht klappt, hilft die IT deines Betriebs.</Begriff>
      </dl>
    ),
  },
  KALENDER('azubi'),
  GLOCKE('azubi'),
  BENACHRICHTIGUNGEN('azubi'),
  PROFILBILD('azubi'),
  FEHLER,
  APP,
  BEDIENUNG,
];

const BETREUUNG = (rolle: 'ausbilder' | 'beauftragter'): Kapitel[] => [
  {
    id: 'aufgabe',
    titel: rolle === 'ausbilder' ? 'Deine Aufgaben im Portal' : 'Deine Aufgaben als Ausbildungsbeauftragte/r',
    inhalt:
      rolle === 'ausbilder' ? (
        <>
          <p>Du richtest Azubis ein, planst ihre Ausbildung, liest ihre Berichte und zeichnest sie ab.</p>
          <p>
            <strong>Du siehst deine Azubis</strong> – also die, bei denen du im Profil als zuständiger Ausbilder eingetragen bist. Dazu kommen Azubis ohne Ausbilder und Azubis, die du für einen Zeitraum vertrittst. Mehr dazu im Kapitel „Meine Azubis, Übernehmen, Vertretung“.
          </p>
        </>
      ) : (
        <>
          <p>Du betreust Azubis, solange sie in deinem Bereich sind. Du liest ihre Berichte, zeichnest sie ab oder gibst sie zurück und kannst ihnen Aufgaben und Notizen in den Plan schreiben.</p>
          <p>Du siehst nur Azubis, die dir der Ausbilder zugewiesen hat. Abzeichnen kannst du Berichte der Wochen, in denen die Zuweisung gilt. Ältere Berichte bleiben für dich lesbar.</p>
        </>
      ),
  },
  {
    id: 'unterschrift',
    titel: 'Einmalig: Unterschrift hinterlegen',
    inhalt: (
      <p>
        Unter <Link zu="/konto">Konto</Link> im Feld „Unterschrift“ unterschreiben. Ohne hinterlegte Unterschrift lässt sich nichts abzeichnen. Beim Abzeichnen wird eine Kopie am Bericht gespeichert; eine spätere Änderung verändert alte Berichte nicht.
      </p>
    ),
  },
  {
    id: 'abzeichnen',
    titel: 'Berichte lesen, abzeichnen, zurückgeben',
    inhalt: (
      <>
        <ol className="schritte">
          <li>
            Unter <Link zu="/abzeichnen">Abzeichnen</Link> stehen alle eingereichten Berichte, die auf dich warten. Die Startseite zeigt die Anzahl.
          </li>
          <li>Zum Lesen die Woche öffnen. Hat der Azubi Fotos oder Dateien angehängt, stehen sie unter dem Bericht bei „Fotos und Dateien“: Bilder öffnen sich mit einem Klick in einem neuen Fenster, andere Dateien lädst du herunter. Im Ausdruck und im PDF stehen sie nicht.</li>
          <li>
            <strong>Abzeichnen</strong> bestätigt den Bericht mit deiner Unterschrift. Mehrere Berichte lassen sich in der Liste anhaken und gemeinsam abzeichnen.
          </li>
          <li>
            <strong>Zurückgeben</strong> braucht einen Kommentar. Schreib konkret, was fehlt – der Azubi sieht den Text oben im Bericht und reicht danach erneut ein.
          </li>
        </ol>
        <p>Ein abgezeichneter Bericht ist gesperrt. {rolle === 'ausbilder' ? 'Du kannst die Abzeichnung mit Begründung aufheben; der Bericht geht dann zurück an den Azubi.' : 'Aufheben kann die Abzeichnung nur ein Ausbilder.'}</p>
        <p className="leise klein">Hinweis für Rückmeldungen: Viele Azubis schreiben zum ersten Mal Berichte. Ein Beispiel („Schreib dazu, womit du gearbeitet hast“) hilft mehr als „zu ungenau“.</p>
      </>
    ),
  },
  {
    id: 'plan',
    titel: 'Ausbildungsplan',
    inhalt: (
      <>
        <p>
          Über <Link zu="/azubis">Azubis</Link> den Azubi öffnen, dann „Ausbildungsplan“. Oben stehen diese und die nächste Woche, links die Übersicht über die Ausbildungsjahre, rechts alle Kalenderwochen.
        </p>
        {rolle === 'ausbilder' ? (
          <ul className="punkte">
            <li>Mit „+“ an einer Woche oder „Eintrag hinzufügen“ legst du Schulblöcke, Einsätze, Aufgaben und Notizen an. Ein Eintrag kann über mehrere Wochen gehen.</li>
            <li>Bei Einsätzen und Aufgaben kannst du eine zuständige Person wählen. Ist es ein Ausbildungsbeauftragter, lässt er sich beim Speichern gleich für den Zeitraum zuweisen.</li>
            <li>
              Was immer wieder vorkommt, fügst du als <Link zu="/planung/bausteine">Planbaustein</Link> ein; was für mehrere Azubis gleich ist, trägst du in der <Link zu="/planung/sammelplanung">Sammelplanung</Link> ein. Mehr dazu im Kapitel „Planung“.
            </li>
            <li>Azubis können eigene Aufgaben und Notizen eintragen. Diese sind mit „vom Azubi eingetragen“ gekennzeichnet; du kannst sie ändern.</li>
            <li>Azubis können sich außerdem private <strong>Termine</strong> eintragen (zum Beispiel eine JAV-Sitzung). Diese sieht nur der Azubi selbst – du siehst sie nicht, auch nicht in Jahreskalender, Glocke oder Kalender-Abo.</li>
          </ul>
        ) : (
          <ul className="punkte">
            <li>Während deiner Zuweisung kannst du Aufgaben (mit Unteraufgaben) und Notizen eintragen, ändern und löschen.</li>
            <li>Schulblöcke und Einsätze plant der Ausbilder.</li>
          </ul>
        )}
        <p>
          Der <Link zu="/jahreskalender">Jahreskalender</Link> zeigt {rolle === 'ausbilder' ? 'deine' : 'alle dir zugewiesenen'} Azubis untereinander über ein ganzes Jahr: Schule, Einsätze und Urlaub.
        </p>
      </>
    ),
  },
  {
    id: 'urlaub',
    titel: 'Urlaubsanträge',
    inhalt: (
      <>
        <p>
          Azubis beantragen ihren Urlaub im Portal. Unter <Link zu="/urlaub">Urlaub</Link> (am Handy unter „Mehr“) stehen alle Anträge {rolle === 'ausbilder' ? 'deiner' : 'der dir zugewiesenen'} Azubis. Eine Zahl am Menüpunkt und eine Kachel auf der Startseite zeigen, wie viele auf dich warten.
        </p>
        <p>Der Ablauf hat zwei Stufen:</p>
        <ol className="schritte">
          <li>
            <strong>Bestätigen:</strong> Alle, denen der Azubi im Urlaubszeitraum zugewiesen ist, bestätigen den Antrag – Ausbildungsbeauftragte und Ausbilder als Vertretung. Sind mehrere von Hand zugewiesen, müssen alle bestätigen. Ist der Azubi in einer Abteilung eingesetzt, genügt aus dieser Abteilung eine Bestätigung – von einem Beauftragten oder der Stellvertretung.
          </li>
          <li>
            <strong>Genehmigen:</strong> Danach entscheidet der zuständige Ausbilder endgültig. Ist im Zeitraum niemand zugewiesen, liegt der Antrag sofort bei ihm.
          </li>
        </ol>
        <dl className="begriffe">
          <Begriff wort="Urlaub bestätigen">{rolle === 'ausbilder' ? 'Nur, wenn du dem Azubi als Vertretung zugewiesen bist.' : 'Deine Zustimmung.'} Sie lässt sich nicht zurücknehmen.</Begriff>
          {rolle === 'ausbilder' && (
            <Begriff wort="Urlaub genehmigen">
              Die endgültige Entscheidung. Steht noch eine Bestätigung aus, fragt das Portal nach, ob du trotzdem genehmigen willst – so bleibt kein Antrag liegen, wenn jemand fehlt. Im Verlauf steht dann, dass ohne diese Bestätigung entschieden wurde.
            </Begriff>
          )}
          <Begriff wort="Antrag ablehnen …">Geht in beiden Stufen, immer mit Begründung. Der Azubi liest sie.</Begriff>
          {rolle === 'ausbilder' && <Begriff wort="Urlaub stornieren …">Hebt einen genehmigten Urlaub wieder auf, mit Begründung. Der Zeitraum ist danach wieder frei.</Begriff>}
          <Begriff wort="Hinweise am Antrag">Das Portal warnt, wenn im Zeitraum Berufsschule oder eine Prüfung liegt oder die Tage laut Urlaubskonto nicht reichen. Es sperrt nichts – die Entscheidung liegt bei euch.</Begriff>
          <Begriff wort="Verlauf">Wer wann was getan hat, klappt an jedem Antrag auf.</Begriff>
        </dl>
        <ul className="punkte">
          <li>Gezählt werden Arbeitstage: Montag bis Freitag ohne die Feiertage des Bundeslands aus den Stammdaten. Halbe Tage gibt es nicht.</li>
          <li>Ein Klick auf den Namen zeigt das Urlaubskonto des Azubis: Anspruch, genehmigt, beantragt, frei.{rolle === 'ausbilder' ? ' Den Anspruch trägst du im Profil des Azubis unter „Urlaubstage im Jahr“ ein.' : ' Den Anspruch trägt der Ausbilder im Profil ein.'} Resturlaub aus dem Vorjahr kennt das Portal nicht.</li>
          <li>Genehmigter Urlaub steht von selbst im Jahreskalender, im Bericht der Woche (als Abwesenheit) und im abonnierten Kalender des Azubis. Beantragter Urlaub steht im Jahreskalender gestreift.</li>
          <li>In der Glocke steht, wenn ein Antrag gestellt, bestätigt oder zurückgezogen wurde.</li>
          <li>
            <strong>Mail an die Personalstelle:</strong> Nach der Genehmigung und nach einer Stornierung schickt das Portal von selbst eine kurze Mail an die Personalstelle – mit Name, Zeitraum, Arbeitstagen und wer bestätigt und entschieden hat. Sie trägt oben „Ausbildungsportal“, den Namen und das Logo eures Betriebs. Die Mail beginnt mit „Guten Tag“ – oder mit der Anrede, die ein Ausbilder in den Stammdaten eingetragen hat, zum Beispiel „Hallo Kim“. Die Bemerkung des Azubis und die Begründung einer Stornierung stehen nicht darin.{' '}
            {rolle === 'ausbilder'
              ? 'Die Adresse trägst du in den Stammdaten ein. Kommt die Mail nicht raus, gilt die Genehmigung trotzdem: Am Antrag steht dann der Grund und der Knopf „Mail an die Personalstelle senden“.'
              : 'Darum kümmert sich der Ausbilder.'}
          </li>
          <li>Die Bemerkung des Azubis ist freiwillig. Bitte keine Gründe verlangen – erst recht keine zur Gesundheit.</li>
          <li>Krankmeldungen laufen nicht über das Portal.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'abteilungen',
    titel: 'Abteilungen und Einsätze',
    inhalt: (
      <>
        <p>
          Azubis durchlaufen Abteilungen. Im Portal ist eine Abteilung ein Name mit den Menschen, die dort für Azubis da sind: den <strong>Beauftragten</strong> und – freiwillig – einer <strong>Stellvertretung</strong>. Hinterlegen lassen sich Ausbildungsbeauftragte und Ausbilder.
        </p>
        {rolle === 'ausbilder' ? (
          <>
            <h3>Abteilung anlegen</h3>
            <ol className="schritte">
              <li>
                Unter <Link zu="/verwaltung/stammdaten">Stammdaten</Link> bei „Abteilungen“ auf „Abteilung anlegen“.
              </li>
              <li>Namen eintragen, Beauftragte ankreuzen, auf Wunsch eine Stellvertretung.</li>
              <li>„Abteilung anlegen“.</li>
            </ol>
            <h3>Azubi einer Abteilung zuweisen</h3>
            <ol className="schritte">
              <li>Im Ausbildungsplan des Azubis einen Eintrag der Art „Einsatz“ anlegen (oder in der Sammelplanung für mehrere Azubis).</li>
              <li>Im Feld „Abteilung“ die Abteilung wählen. Der Titel wird vorgeschlagen und lässt sich ändern. Das Feld „Zuständig“ verschwindet – zuständig sind die Beauftragten der Abteilung, sie stehen unter dem Titel.</li>
              <li>Zeitraum eintragen und speichern.</li>
            </ol>
          </>
        ) : (
          <p>Abteilungen legen die Ausbilder in den Stammdaten an. Sie tragen auch die Einsätze in den Ausbildungsplan ein.</p>
        )}
        <h3>So sieht es im Plan aus</h3>
        <ul className="punkte">
          <li>In der ersten Woche steht über dem Einsatz ein gelber Streifen „Neue Abteilung“ mit der Dauer. Die Karte darunter zeigt die Marke „Abteilung“, die Beauftragten und die Stellvertretung (heller Kreis) sowie den Fortschritt, zum Beispiel „Woche 1 von 4“.</li>
          <li>In den folgenden Wochen steht der Einsatz nur noch als eine Zeile mit Fortschritt und den Beauftragten.</li>
          <li>Links im Jahresband sind Wochen in einer Abteilung grün. Darunter steht beim aufgeklappten Ausbildungsjahr die Liste „Abteilungen“ in zeitlicher Reihenfolge; ein Klick springt zur ersten Woche. Wochen ab heute, in denen weder Abteilung noch Einsatz noch Berufsschule steht, erscheinen als „Noch nicht geplant“.</li>
          <li>Am Handy und Tablet steht dieselbe Liste zum Aufklappen über den Wochen.</li>
        </ul>
        <h3>Was dann gilt</h3>
        <ul className="punkte">
          <li>
            Für die Dauer des Einsatzes sind die Beauftragten und die Stellvertretung der Abteilung <strong>automatisch zuständig</strong>: Sie sehen den Azubi mit Plan und Berichtsheft, zeichnen die Berichte dieser Wochen ab und bestätigen Urlaub. Niemand muss sie eigens zuweisen.
          </li>
          <li>Die Stellvertretung ist immer mit zuständig – nicht erst, wenn jemand ausfällt.</li>
          <li>Die Zuständigkeit reicht vom Montag der ersten bis zum Sonntag der letzten Woche des Einsatzes. Berichte aus dieser Zeit bleiben auch danach einsehbar.</li>
          <li>Beim Urlaub genügt aus einer Abteilung eine Bestätigung – von einem Beauftragten oder der Stellvertretung.</li>
          {rolle === 'ausbilder' && (
            <>
              <li>Änderst du den Zeitraum des Einsatzes, die Abteilung oder die Personen der Abteilung, ändern sich die Zuweisungen sofort mit. Löschst du den Einsatz, enden sie.</li>
              <li>Im Profil des Azubis stehen diese Zuweisungen unter „Aus Einsätzen in Abteilungen (automatisch)“. Zuweisungen von Hand gibt es weiterhin – für alles, was nicht an einer Abteilung hängt.</li>
              <li>Eine Abteilung lässt sich erst löschen, wenn kein Einsatz sie mehr verwendet.</li>
              <li>Ein Einsatz ohne Abteilung bleibt möglich, zum Beispiel für einen Lehrgang.</li>
            </>
          )}
        </ul>
      </>
    ),
  },
  {
    id: 'lernansicht',
    titel: 'Lerninhalte ansehen',
    inhalt: (
      <>
        <p>
          Unter <Link zu="/lerninhalte">Lerninhalte</Link> ({rolle === 'ausbilder' ? 'im Menü „Planung“' : 'am Handy unter „Mehr“'}) liest du, was die Azubis im Lernmodul lernen. Du siehst alle Lernmodule, die auf dem Server liegen – auch solche, die noch für keinen Beruf eingeschaltet sind.
        </p>
        <dl className="begriffe">
          <Begriff wort="Themenfelder">Die Gliederung des Stoffs. Ein Klick öffnet das Themenfeld mit seinen Unterthemen.</Begriff>
          <Begriff wort="Cheatsheet">Steht an jedem Unterthema offen da: Begriffe, Tabellen, Befehle, Merksatz, Prüfungsfrage. Die Unterthemen sind nummeriert und haben je einen eigenen Kasten.</Begriff>
          <Begriff wort="Zusatzwissen">Vertiefungen am Ende eines Themenfelds.</Begriff>
          <Begriff wort="Kompendium">Alle Bausteine aus allen Cheatsheets zum Suchen und Nachschlagen.</Begriff>
        </dl>
        <ul className="punkte">
          <li>Die Ansicht ist nur zum Lesen. Ampel, Notizen und Abzeichen gibt es nur bei den Azubis.</li>
          <li>
            <strong>Den Lernstand einzelner Azubis siehst du nicht</strong> – auch nicht, welche Abzeichen jemand hat. Er gehört den Azubis allein; so ist es ihnen im Portal zugesagt.
          </li>
          <li>
            {rolle === 'ausbilder'
              ? 'Fällt dir ein Fehler im Stoff auf oder willst du Inhalte ergänzen: Ändere die Dateien und reiche das Paket auf dieser Seite neu ein. Wie das geht, steht im Kapitel „Lerninhalte für einen Beruf erstellen“.'
              : 'Fällt dir ein Fehler im Stoff auf oder willst du Inhalte ergänzen: Wende dich an den zuständigen Ausbilder. Ausbilder können Lerninhalte im Portal einreichen.'}
          </li>
          {rolle === 'ausbilder' && <li>Für welchen Beruf ein Lernmodul gilt, stellst du in den Stammdaten am Beruf ein.</li>}
        </ul>
      </>
    ),
  },
  {
    id: 'jahreskalender',
    titel: 'Den Jahreskalender lesen',
    inhalt: (
      <>
        <p>
          Der <Link zu="/jahreskalender">Jahreskalender</Link> (eigener Menüpunkt, am Handy „Jahr“) beantwortet: Wer ist wann wo? Er zeigt ein ganzes Kalenderjahr für alle {rolle === 'ausbilder' ? 'deine' : 'dir zugewiesenen'} Azubis: Die Monate stehen nebeneinander, jeder Azubi hat eine Zeile.
        </p>
        <dl className="begriffe">
          <Begriff wort="Obere Balken (violett)">Berufsschule.</Begriff>
          <Begriff wort="Mittlere Balken (grün)">Einsätze, mit Namen. Ist der Balken zu kurz für den Namen: mit der Maus darauf zeigen.</Begriff>
          <Begriff wort="Schmale Balken unten (gelb)">Urlaub: genehmigte Urlaubsanträge und Urlaub, den der Azubi in einem eingereichten Bericht unter „Abwesenheit“ eingetragen hat. Gestreift mit gestricheltem Rand ist beantragter Urlaub, über den noch nicht entschieden ist. Krankheit erscheint im Jahreskalender nicht.</Begriff>
          <Begriff wort="Rote Linie mit Raute">Prüfungstermin.</Begriff>
          <Begriff wort="Türkiser Strich ganz unten">Schulferien (nach dem Bundesland der Berufsschule).</Begriff>
          <Begriff wort="Schraffiert">Der Azubi ist in dieser Zeit nicht in der Ausbildung.</Begriff>
          <Begriff wort="Blaue senkrechte Linie">Heute.</Begriff>
        </dl>
        <ul className="punkte">
          <li>Die Azubis sind nach Ausbildungsjahr geordnet.</li>
          <li>Ein Klick auf den Namen öffnet den Kalender dieses Azubis Tag für Tag: Monate als Spalten, Tage als Zeilen, dazu die Feiertage und – mit gelbem Rand – die Firmentermine. In der Übersicht aller Azubis haben Firmentermine oben eine eigene Zeile und ziehen sich als gelbes Band durch jede Zeile; alle Firmentermine des Jahres stehen außerdem als Liste über dem Kalender. Dorthin kommst du auch aus dem Ausbildungsplan eines Azubis über „Jahreskalender anzeigen“.</li>
          <li>Mit „←“ und „→“ blätterst du ein Jahr zurück oder vor.</li>
          <li>Private Termine der Azubis stehen nicht im Kalender.</li>
          <li>Der Kalender ist nur zum Lesen. Geplant wird im Ausbildungsplan{rolle === 'ausbilder' ? ' oder in der Sammelplanung' : ''}.</li>
          <li>Am Handy steht statt der breiten Tabelle je Azubi eine Karte: oben das Jahr als schmale Leiste, darunter „Jetzt und als Nächstes“ als Text. „Ganzes Jahr“ klappt alle Einträge der Reihe nach auf.</li>
        </ul>
      </>
    ),
  },
  ...(rolle === 'ausbilder'
    ? [
        {
          id: 'planung',
          titel: 'Planung: Sammelplanung und Bausteine',
          inhalt: (
            <>
              <p>Unter „Planung“ (auf dem Handy unter „Mehr“) steht, was über den Plan eines einzelnen Azubis hinausgeht.</p>
              <h3>Sammelplanung</h3>
              <ol className="schritte">
                <li>
                  <Link zu="/planung/sammelplanung">Sammelplanung</Link> öffnen und die Azubis anhaken – einzeln oder per Schnellauswahl nach Ausbildungsjahr, Berufsschule oder Beruf.
                </li>
                <li>Einen einzelnen Eintrag ausfüllen (zum Beispiel einen Schulblock) oder einen Baustein mit Startwoche wählen.</li>
                <li>„Eintragen“. Danach steht bei jedem Azubi, ob es geklappt hat. Wer in dem Zeitraum nicht in der Ausbildung ist, wird ausgelassen.</li>
              </ol>
              <p>
                <strong>Versehen?</strong> Unter „Zuletzt eingetragen“ nimmst du eine Sammelplanung der letzten 30 Tage wieder zurück. Einträge, die seitdem jemand geändert oder abgehakt hat, bleiben stehen.
              </p>
              <h3>Planbausteine</h3>
              <ul className="punkte">
                <li>
                  Ein <Link zu="/planung/bausteine">Baustein</Link> ist ein Stück Ausbildung, das immer wieder vorkommt – etwa die Station „IT-Support“ mit 8 Wochen Einsatz und den Aufgaben dazu.
                </li>
                <li>Im Ausbildungsplan eines Azubis wählst du den Baustein und die Woche, ab der er gelten soll. So bleibt jeder Plan individuell.</li>
                <li>
                  Bausteine lassen sich als Datei exportieren und wieder importieren – zur Sicherung oder für ein anderes Portal. Wie die Datei aussehen muss, steht im Kapitel „Bausteine importieren: Aufbau der Datei“ gleich darunter.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: 'import',
          titel: 'Bausteine importieren: Aufbau der Datei',
          inhalt: (
            <>
              <p>
                Unter <Link zu="/planung/bausteine">Planung → Planbausteine</Link> liest „Importieren“ eine Datei mit Bausteinen ein. <strong>Am einfachsten:</strong> Einen vorhandenen Baustein mit „Exportieren“ speichern, die Datei in einem Texteditor ändern und wieder importieren. So stimmt der Aufbau von selbst.
              </p>
              <h3>Die Datei</h3>
              <ul className="punkte">
                <li>
                  Eine Textdatei im Format <strong>JSON</strong>, Endung <code>.json</code>, Zeichensatz UTF-8 (damit Umlaute stimmen). Höchstens 1 MB.
                </li>
                <li>Bearbeiten mit einem Texteditor (Editor, Notepad++, VS Code) – nicht mit Word oder Excel.</li>
                <li>Die Datei enthält nur Bausteine, keine Daten von Azubis.</li>
              </ul>
              <h3>Beispiel</h3>
              <pre className="datei-beispiel" tabIndex={0} aria-label="Beispiel einer Datei mit einem Baustein">{IMPORT_BEISPIEL}</pre>
              <h3>Der Rahmen</h3>
              <dl className="begriffe">
                <Begriff wort="format">
                  Immer genau <code>"ausbildungsportal-planvorlagen"</code>. Daran erkennt das Portal die Datei. Fehlt die Angabe oder ist sie anders geschrieben, heißt es „Das ist keine Baustein-Datei aus dem Ausbildungsportal“.
                </Begriff>
                <Begriff wort="version">
                  Immer <code>1</code>.
                </Begriff>
                <Begriff wort="vorlagen">Die Liste der Bausteine in eckigen Klammern. Mindestens einer, höchstens 50 je Datei.</Begriff>
              </dl>
              <h3>Ein Baustein</h3>
              <dl className="begriffe">
                <Begriff wort="titel">Name des Bausteins, Pflicht, höchstens 120 Zeichen. Gibt es den Namen schon, hängt das Portal „(Import)“ an – vorhandene Bausteine werden nie überschrieben.</Begriff>
                <Begriff wort="beruf">
                  Für welchen Beruf der Baustein gilt: der Name genau so, wie er in den Stammdaten steht – mit Fachrichtung in der Form <code>"Bezeichnung – Fachrichtung"</code> (Leerzeichen, Halbgeviertstrich, Leerzeichen). Für alle Berufe: <code>null</code> (ohne Anführungszeichen). Kennt das Portal den Beruf nicht, gilt der Baustein für alle Berufe; das Portal sagt das nach dem Import.
                </Begriff>
                <Begriff wort="eintraege">Die Einträge des Bausteins in eckigen Klammern, höchstens 100.</Begriff>
              </dl>
              <h3>Ein Eintrag</h3>
              <dl className="begriffe">
                <Begriff wort="art">
                  Pflicht. Eines von: <code>"schule"</code> (Berufsschule), <code>"einsatz"</code> (Einsatz in einer Abteilung), <code>"aufgabe"</code>, <code>"notiz"</code>. Klein geschrieben. Termine gibt es in Bausteinen nicht.
                </Begriff>
                <Begriff wort="abWoche">
                  In welcher Woche des Bausteins der Eintrag beginnt: <code>1</code> ist die Woche, die du beim Einfügen als Startwoche wählst, <code>3</code> zwei Wochen später. Ganze Zahl von 1 bis 260, ohne Anführungszeichen. Fehlt die Angabe, gilt <code>1</code>. Im Formular heißt sie „Beginnt in Woche“ und erscheint dort nur, wenn ein Baustein mehrere Einträge hat oder ein Eintrag später beginnt – in der Datei steht sie nach einem Export trotzdem immer.
                </Begriff>
                <Begriff wort="wochen">
                  Dauer in Wochen, ganze Zahl von 1 bis 160. Fehlt die Angabe, gilt <code>1</code>.
                </Begriff>
                <Begriff wort="titel">Pflicht, höchstens 120 Zeichen. Zum Beispiel „IT-Support“ oder „Drucker einrichten“.</Begriff>
                <Begriff wort="text">
                  Beschreibung, höchstens 2000 Zeichen. Ohne Beschreibung: <code>""</code>. Ein Zeilenumbruch im Text wird als <code>\n</code> geschrieben.
                </Begriff>
                <Begriff wort="unteraufgaben">
                  Nur bei der Art <code>"aufgabe"</code>: Liste von Texten, höchstens 30, je höchstens 200 Zeichen. Bei den anderen Arten wird sie nicht beachtet. Ohne Unteraufgaben: <code>[]</code>.
                </Begriff>
              </dl>
              <h3>Worauf es bei JSON ankommt</h3>
              <ul className="punkte">
                <li>
                  Namen und Texte stehen in geraden doppelten Anführungszeichen <code>"…"</code> – nicht in „deutschen“ und nicht in einfachen.
                </li>
                <li>
                  Zahlen und <code>null</code> stehen ohne Anführungszeichen.
                </li>
                <li>Zwischen zwei Angaben steht ein Komma, nach der letzten in einer Klammer keines.</li>
                <li>Die Namen der Angaben genau so schreiben wie hier, auch die Großbuchstaben („abWoche“).</li>
                <li>
                  Ein Anführungszeichen im Text wird als <code>\"</code> geschrieben.
                </li>
              </ul>
              <h3>Was beim Import passiert</h3>
              <ul className="punkte">
                <li>Jeder Baustein der Datei wird zusätzlich angelegt. Nichts wird überschrieben oder gelöscht.</li>
                <li>Stimmt in einem Baustein etwas nicht, bricht der Import dort ab. Das Portal nennt den Baustein und den Grund und sagt, wie viele davor schon angelegt wurden. Die Datei berichtigen, die schon importierten Bausteine aus der Datei entfernen und noch einmal importieren.</li>
                <li>„Die Datei lässt sich nicht lesen“ heißt: Das JSON ist nicht in Ordnung – meist fehlt ein Komma oder eine Klammer, oder es stehen falsche Anführungszeichen darin.</li>
                <li>Danach den Baustein öffnen und prüfen, bevor du ihn in Pläne einfügst.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'zustaendig',
          titel: 'Meine Azubis, Übernehmen, Vertretung',
          inhalt: (
            <>
              <ul className="punkte">
                <li>
                  <strong>Zuständig</strong> bist du für Azubis, bei denen du im Profil unter „Zuständiger Ausbilder“ stehst. Legst du selbst ein Azubi-Konto an, trägt das Portal dich gleich ein. Nur diese Azubis siehst du in Listen, Jahreskalender, Abzeichnen und Glocke.
                </li>
                <li>
                  <strong>Ohne Ausbilder</strong> (gelbe Marke): Solange niemand zuständig ist, sehen und bearbeiten alle Ausbilder den Azubi. Im Profil übernimmst du ihn mit „Azubi übernehmen“. Das gilt auch, solange das Konto des zuständigen Ausbilders gesperrt ist.
                </li>
                <li>
                  <strong>Abgeben:</strong> Im Profil einen anderen Ausbilder als zuständig eintragen und speichern. Danach siehst du den Azubi nicht mehr – das Portal fragt vorher nach.
                </li>
                <li>
                  <strong>Vertretung</strong> (Urlaub, Krankheit): Im Profil unter „Ausbildungsbeauftragte und Vertretung“ einen anderen Ausbilder mit Zeitraum zuweisen. Die Vertretung liest Plan und Berichte, zeichnet Berichte der Wochen in ihrem Zeitraum ab und trägt Aufgaben und Notizen
                  ein. Profil, Einsätze, Schulblöcke und Zuweisungen bleiben bei dir. Eine Abzeichnung aufheben kann die Vertretung nicht.
                </li>
                <li>
                  <strong>Gesamtsicht:</strong> Der Super-Admin kann einem Ausbilder-Konto erlauben, alle Azubis zu sehen und zu bearbeiten – gedacht für die Ausbildungsleitung.
                </li>
              </ul>
              <p className="leise klein">Stammdaten und Planbausteine gelten weiter für das ganze Portal. In der Sammelplanung stehen nur Azubis zur Wahl, die du voll bearbeiten darfst; zurücknehmen lässt sich ein Lauf nur von der Person, die ihn eingetragen hat (oder mit Gesamtsicht).</p>
            </>
          ),
        },
        {
          id: 'profil',
          titel: 'Das Profil eines Azubis',
          inhalt: (
            <>
              <p>
                Über <Link zu="/azubis">Azubis</Link> → „Profil“. Aus diesen Angaben berechnet das Portal Ausbildungsjahr, Wochen und Ende der Ausbildung.
              </p>
              <dl className="begriffe">
                <Begriff wort="Ausbildungsberuf, Berufsschule">Aus den Stammdaten. Der Beruf bestimmt die Regeldauer, die Berufsschule das Bundesland für die Schulferien.</Begriff>
                <Begriff wort="Zuständiger Ausbilder">Bestimmt, wer den Azubi sieht und voll bearbeitet. Mehr im Kapitel „Meine Azubis, Übernehmen, Vertretung“.</Begriff>
                <Begriff wort="Ausbildungsbeginn">Erst damit gibt es Berichtsheft und Plan. Die erste Woche ist die Woche mit diesem Tag.</Begriff>
                <Begriff wort="Vertragsende">Nur eintragen, wenn es vom berechneten Ende abweicht.</Begriff>
                <Begriff wort="Verkürzung">Monate und Art: „Ausbildung endet früher“ oder „am Anfang angerechnet“ (Start in einem höheren Ausbildungsjahr). Das Portal rechnet nur mit den Monaten – ob eine Verkürzung zulässig ist, entscheidet die Kammer.</Begriff>
                <Begriff wort="Wochenstunden">Daran misst der Bericht, ob die eingetragenen Stunden zur Woche passen.</Begriff>
                <Begriff wort="Form des Berichtshefts">Ob dieser Azubi die Woche im Ganzen beschreibt oder Tag für Tag. „Wie im Betrieb eingestellt“ übernimmt, was in den Stammdaten steht. Gilt für Berichte, die ab dann begonnen werden; schon gespeicherte behalten ihre Form.</Begriff>
                <Begriff wort="Urlaubstage im Jahr">Der Urlaubsanspruch in Arbeitstagen je Kalenderjahr. Daraus rechnet das Urlaubskonto, was noch frei ist. Bleibt das Feld leer, lässt sich Urlaub trotzdem beantragen – nur ohne Rechnung.</Begriff>
                <Begriff wort="Prüfungstermine">Bis zu acht, mit freier Bezeichnung. Sie erscheinen im Plan des Azubis, in der Kachel „Wochen bis zur Prüfung“ und im abonnierten Kalender.</Begriff>
              </dl>
              <p className="leise klein">Der Azubi sieht diese Angaben unter „Konto“ bei „Meine Ausbildung“, kann sie aber nicht ändern.</p>
            </>
          ),
        },
        {
          id: 'stammdaten',
          titel: 'Stammdaten pflegen',
          inhalt: (
            <>
              <p>
                Unter <Link zu="/verwaltung/stammdaten">Stammdaten</Link> stehen Betrieb, Ausbildungsberufe und Berufsschulen. Sie gelten <strong>für das ganze Portal</strong> – alle Ausbilder arbeiten mit denselben Einträgen.
              </p>
              <dl className="begriffe">
                <Begriff wort="Betrieb">Name und Anschrift stehen im Kopf der Berichte. Das Bundesland bestimmt die Feiertage im Plan.</Begriff>
                <Begriff wort="Form des Berichtshefts">Entweder beschreiben Azubis die Woche im Ganzen (drei Teile: Betrieb, Unterweisung, Berufsschule) oder Tag für Tag (für jeden Tag ein Kasten mit eigenen Zeilen). In beiden Fällen ist es ein Bericht je Woche, der einmal eingereicht und abgezeichnet wird. Die Wahl gilt für Berichte, die ab dann begonnen werden; schon gespeicherte behalten ihre Form. Für einzelne Azubis lässt sich die Form im Profil des Azubis abweichend einstellen (Feld „Form des Berichtshefts“) – zum Beispiel, wenn nur ein Beruf oder ein Ausbildungsjahr Tag für Tag schreiben soll. Welche Form eure Kammer verlangt, klärt ihr am besten mit ihr.</Begriff>
                <Begriff wort="Mail-Adresse der Personalstelle">Dorthin schickt das Portal eine kurze Mail, sobald ein Urlaub genehmigt oder storniert wurde. Genau eine Adresse, am besten ein Sammelpostfach. Mit „Testmail an die Personalstelle senden“ prüfst du, ob Mails ankommen. Der Knopf ist gesperrt, solange der Betreiber des Portals keinen Mailserver eingerichtet hat oder die Adresse fehlt.</Begriff>
                <Begriff wort="Anrede in der Mail an die Personalstelle">So beginnt die Mail, zum Beispiel „Hallo Kim“ oder „Guten Tag Frau Beispiel“. Das Komma dahinter setzt das Portal. Lässt du das Feld leer, heißt es „Guten Tag“. Die Anrede sehen nur Ausbilder.</Begriff>
                <Begriff wort="Ausbildungsberufe">Bezeichnung, bei Bedarf Fachrichtung, und Regeldauer in Monaten.</Begriff>
                <Begriff wort="Lernmodul">
                  Am Beruf lässt sich ein Paket mit Lerninhalten einschalten, sofern eines auf dem Server liegt. Azubis dieses Berufs sehen dann den Menüpunkt „Lernen“ mit Cheatsheets und einer Ampel zur Selbsteinschätzung. Den Lernstand sieht nur der Azubi selbst – du siehst ihn nicht, auch
                  nicht als Zusammenfassung. Die Inhalte legt der Betreiber des Portals auf dem Server ab; schreiben kannst du sie selbst – siehe „Lerninhalte für einen Beruf erstellen“. Liegen dort noch keine, ist das Feld gesperrt und die Seite sagt, was fehlt.
                </Begriff>
                <Begriff wort="Berufsschulen">Name, Ort und Bundesland. Das Bundesland bestimmt die Schulferien im Plan; hinterlegt sind derzeit die Ferien für Hamburg.</Begriff>
              </dl>
              <ul className="punkte">
                <li>Bitte nichts ändern oder löschen, nur weil du es selbst gerade nicht brauchst.</li>
                <li>Ein Beruf oder eine Berufsschule lässt sich erst löschen, wenn kein Azubi mehr zugeordnet ist.</li>
                <li>Änderungen stehen mit deinem Namen im Protokoll.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'firmentermine',
          titel: 'Firmentermine für alle',
          inhalt: (
            <>
              <p>
                Unter <Link zu="/verwaltung/stammdaten">Stammdaten</Link> bei „Firmentermine“ trägst du ganztägige Termine ein, die für alle im Betrieb gelten – zum Beispiel eine Betriebsschließung zwischen den Feiertagen, eine Betriebsversammlung oder ein Sommerfest.
              </p>
              <dl className="begriffe">
                <Begriff wort="Titel">Freier Text, so wie er im Plan stehen soll – etwa „Betrieb geschlossen“.</Begriff>
                <Begriff wort="Erster und letzter Tag">Der Termin gilt für ganze Tage. Lässt du den letzten Tag leer, ist es ein einzelner Tag.</Begriff>
                <Begriff wort="Hinweis">Freiwillig, eine Zeile – zum Beispiel „Notdienst über die Zentrale“.</Begriff>
              </dl>
              <ul className="punkte">
                <li>Alle Azubis, Ausbildungsbeauftragten und Ausbilder sehen den Termin: im Ausbildungsplan in der betroffenen Woche (gelbe Zeile „Firmentermin“) und im Jahreskalender. Dort stehen sie als Liste über dem Kalender, in der Übersicht aller Azubis als eigene Zeile „Firmentermine“ und als gelbes Band durch jede Zeile, im Kalender eines Azubis als gelber Rand am Tag.</li>
                <li>
                  <strong>Es ist nur eine Übersicht.</strong> Ein Firmentermin steht nicht im Berichtsheft, zieht keinen Urlaub ab und ändert nichts an Berufsschule oder Einsätzen. Müssen Azubis für eine Schließung Urlaub nehmen, beantragen sie ihn wie sonst auch.
                </li>
                <li>Eine Benachrichtigung gibt es dafür nicht – auch nicht in der Glocke.</li>
                <li>Vergangene Termine stehen eingeklappt unter „Vergangene Firmentermine“. Du kannst sie dort ändern oder löschen.</li>
                <li>Anlegen, ändern und löschen können alle Ausbilder. Jede Änderung steht mit Namen im Protokoll.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'lerninhalte',
          titel: 'Lerninhalte für einen Beruf erstellen',
          inhalt: (
            <>
              <p>
                Für jeden Ausbildungsberuf kann es ein eigenes <strong>Lernmodul</strong> geben – Cheatsheets, Kompendium und Zusatzwissen wie beim Fachinformatiker. Dafür muss niemand programmieren: Ein Lernmodul ist ein Ordner mit Textdateien in einem festen Aufbau. Die eigentliche Arbeit ist, die Inhalte zu schreiben.
              </p>
              <p className="hinweis">
                <strong>So kommen die Inhalte ins Portal:</strong> Du packst den fertigen Ordner als ZIP-Datei und reichst ihn unter <Link zu="/lerninhalte">Lerninhalte</Link> ein. Das Portal prüft den Aufbau sofort. Danach sieht der Betreiber des Portals (Super-Admin) die Einreichung und lädt sie hoch oder gibt sie dir mit einer Rückmeldung zurück. Nach dem Hochladen erscheint das Paket unter <Link zu="/verwaltung/stammdaten">Stammdaten</Link>, und du schaltest es am Beruf im Feld „Lernmodul“ ein. Für jede spätere Änderung reichst du das ganze Paket noch einmal mit derselben Kennung ein.
              </p>
              <h3>So gehst du vor</h3>
              <ol className="schritte">
                <li>
                  <strong>Stoff gliedern.</strong> Ausbildungsrahmenplan und Prüfungskatalog des Berufs in etwa 8 bis 15 Themenfelder aufteilen, jedes mit 5 bis 10 Unterthemen. Zum Vergleich: Das Modul für Fachinformatiker hat 13 Themenfelder.
                </li>
                <li>
                  <strong>Gerüst anlegen.</strong> Die Liste der Themenfelder und je Themenfeld eine Datei mit den Unterthemen – noch ohne Inhalt. Schon damit funktioniert das Modul; bei leeren Unterthemen steht „Cheatsheet folgt“.
                </li>
                <li>
                  <strong>Cheatsheets schreiben.</strong> Unterthema für Unterthema füllen: Kernbegriffe, Tabellen, ein Merksatz, eine typische Prüfungsfrage mit Lösungsweg.
                </li>
                <li>
                  <strong>Als ZIP-Datei einreichen.</strong> Den Ordner packen und unter „Lerninhalte“ bei „Lerninhalte einreichen“ hochladen: Kennung eintragen (der Ordnername, z. B. <code>kaufleute-buero</code>), Datei wählen, auf Wunsch eine Notiz.
                </li>
                <li>
                  <strong>Prüfen und einschalten.</strong> Unter Stammdaten steht das Paket mit der Zahl der Themenfelder. Stimmt in einer Datei etwas nicht, zeigt die Seite den Fehler mit Datei und Zeile. Dann am Beruf einschalten.
                </li>
              </ol>
              <h3>Der Ordner</h3>
              <p>
                Der Name des Ordners ist die Kennung des Pakets: nur Kleinbuchstaben, Ziffern und Bindestrich, zum Beispiel <code>industriekaufleute</code>.
              </p>
              <pre className="datei-beispiel" tabIndex={0} aria-label="Aufbau des Ordners eines Lernmoduls">{LERN_ORDNER}</pre>
              <dl className="begriffe">
                <Begriff wort="paket.json">
                  Titel, Quelle und Lizenz – stehen unter den Lerninhalten. Beispiel: <code>{'{ "titel": "Industriekaufleute", "quelle": "Muster GmbH", "lizenz": "nur für den internen Gebrauch" }'}</code>
                </Begriff>
                <Begriff wort="meta.json">
                  Der Stand der Inhalte als Datum: <code>{'{ "stand": "2026-11-11" }'}</code>. Bei jeder Änderung das Datum erhöhen – daran erkennt das Portal, dass es neu einlesen soll.
                </Begriff>
                <Begriff wort="themenfelder.json">
                  Die Themenfelder in der Reihenfolge, in der sie erscheinen sollen. Je Themenfeld: <code>id</code> (so heißt auch die Datei unter <code>themen/</code>), <code>lernfelder</code> und <code>pruefung</code> (beides Listen kurzer Texte, die als Marken am Themenfeld stehen).
                </Begriff>
                <Begriff wort="themen/">Je Themenfeld eine Textdatei im Format Markdown – siehe unten.</Begriff>
                <Begriff wort="bilder/">Grafiken, nur im Format SVG. Dateinamen nur mit Kleinbuchstaben, Ziffern und Bindestrich.</Begriff>
                <Begriff wort="zusatz/">Nur für Abläufe Schritt für Schritt im Zusatzwissen. Das Format ist aufwendiger – dafür am besten Hilfe holen.</Begriff>
              </dl>
              <h3>Eine Themen-Datei</h3>
              <pre className="datei-beispiel" tabIndex={0} aria-label="Beispiel einer Themen-Datei">{LERN_THEMA}</pre>
              <ul className="punkte">
                <li>Ganz oben steht zwischen zwei Zeilen aus drei Strichen der Titel des Themenfelds. Der Absatz danach ist „Worum geht’s“.</li>
                <li>
                  Jede Überschrift mit <code>##</code> ist ein <strong>Unterthema</strong> und braucht eine Kennung in geschweiften Klammern: <code>{'{#buchungssaetze}'}</code>. Nur Kleinbuchstaben, Ziffern und Bindestrich; in einer Datei jede nur einmal.
                </li>
                <li>
                  <strong>An dieser Kennung hängt der Lernstand der Azubis.</strong> Den Titel darfst du jederzeit ändern – die Kennung nicht. Musst du sie doch ändern, sag es dem Betreiber: Er trägt alt und neu in die Datei <code>umbenennungen.json</code> ein, damit kein Lernstand verloren geht.
                </li>
                <li>
                  Im Unterthema sind diese Abschnitte erlaubt, alle freiwillig: <code>### Kernbegriffe</code>, <code>### Tabelle: Titel</code> (beliebig oft), <code>### Abbildung: Titel</code>, <code>### Befehle</code>, <code>### Merksatz</code>, <code>### Prüfungsfrage</code>. Andere Überschriften mit <code>###</code> meldet das Portal als Fehler.
                </li>
                <li>
                  Kernbegriffe immer in der Form <code>- **Begriff:** Erklärung</code>. Eine Prüfungsfrage besteht aus dem Fragetext und nummerierten Lösungsschritten.
                </li>
                <li>
                  Am Ende der Datei dürfen <code>## Häufige Fehler</code> (Liste) und <code>## Links</code> stehen. Links in der Form <code>- [Titel](https://…) – Beschreibung</code>.
                </li>
                <li>
                  Zusatzwissen beginnt mit <code>## Zusatz: Titel {'{#kennung}'}</code>, darunter <code>typ: text</code> und bei Bedarf <code>zu: kennung-des-unterthemas</code>. Darin sind Abschnitte mit <code>###</code> frei; <code>### Checkliste: …</code> zeigt Haken, <code>### Vergleich: …</code> mit Karten unter <code>####</code> stellt Dinge nebeneinander.
                </li>
                <li>
                  Im Text gehen <code>**fett**</code>, <code>`Code`</code> und Links. Mehr Auszeichnung gibt es nicht.
                </li>
              </ul>
              <h3>Worauf du achten solltest</h3>
              <ul className="punkte">
                <li>
                  <strong>Urheberrecht:</strong> Texte, Tabellen und Bilder aus Lehrbüchern, von Webseiten oder aus alten Prüfungen darfst du nicht einfach übernehmen. Schreib die Inhalte selbst oder klär die Rechte. In <code>paket.json</code> steht, woher die Inhalte kommen.
                </li>
                <li>
                  <strong>Sprache:</strong> kurze Sätze, ein Gedanke je Satz. Ein Cheatsheet ist ein Spickzettel, kein Lehrbuch.
                </li>
                <li>
                  <strong>Keine Personen:</strong> In die Inhalte gehören keine Namen oder Daten von Azubis oder Kollegen.
                </li>
                <li>Bearbeiten mit einem Texteditor (Editor, Notepad++, VS Code) – nicht mit Word. Zeichensatz UTF-8, damit Umlaute stimmen.</li>
                <li>Änderst du später ein Cheatsheet, sehen Azubis, die das Unterthema schon bewertet haben, den Hinweis „Inhalt aktualisiert“. Ihre Ampel bleibt.</li>
                <li>Löschst du ein Unterthema, bleibt der Lernstand dazu gespeichert und taucht wieder auf, wenn die Kennung zurückkommt.</li>
                <li>Den Lernstand der Azubis siehst du nie – auch nicht als Verfasser der Inhalte.</li>
              </ul>
              <h3>Einreichen und Status</h3>
              <dl className="begriffe">
                <Begriff wort="Sofort-Prüfung">Beim Hochladen liest das Portal das Paket ein. Findet es Fehler, nimmt es nichts an und zeigt sie mit Datei und Zeile. Behebe sie und lade neu hoch.</Begriff>
                <Begriff wort="Eingereicht – wird geprüft">Die Einreichung liegt beim Betreiber des Portals. Solange kannst du sie zurückziehen. Für dieselbe Kennung geht in dieser Zeit keine zweite Einreichung.</Begriff>
                <Begriff wort="Zurückgegeben">Der Betreiber möchte Änderungen. Seine Rückmeldung steht an der Einreichung. Ändere die Dateien und reiche neu ein.</Begriff>
                <Begriff wort="Hochgeladen">Die Inhalte sind im Portal. Ein neues Lernmodul schaltest du jetzt am Beruf ein; eine neue Fassung eines vorhandenen Lernmoduls gilt sofort. Der Lernstand der Azubis bleibt erhalten.</Begriff>
              </dl>
              <ul className="punkte">
                <li>Die ZIP-Datei darf den Ordner selbst enthalten oder direkt seinen Inhalt – das Portal findet das Paket an der Datei <code>themenfelder.json</code>.</li>
                <li>Übernommen werden nur Dateien, die zu einem Inhaltspaket gehören. Was sonst in der ZIP-Datei liegt, zeigt die Einreichung unter „Nicht übernommene Dateien“.</li>
                <li>Alle Ausbilder sehen alle Einreichungen, weil die Lernmodule für das ganze Portal gelten.</li>
                <li>Ausbildungsbeauftragte reichen nicht selbst ein. Sie wenden sich an einen Ausbilder.</li>
              </ul>
              <p>
                Für den Betreiber: Er kann Pakete weiterhin auch als Ordner auf dem Server einbinden; wie, steht in der Datei <code>lerninhalte/README.md</code> des Portals.
              </p>
            </>
          ),
        },
        {
          id: 'einrichten',
          titel: 'Einen neuen Azubi einrichten',
          inhalt: (
            <ol className="schritte">
              <li>
                Einmalig unter <Link zu="/verwaltung/stammdaten">Stammdaten</Link> Betrieb (mit Bundesland für die Feiertage), Ausbildungsberuf und Berufsschule anlegen.
              </li>
              <li>
                Unter <Link zu="/verwaltung/konten">Konten</Link> das Konto anlegen: Rolle „Azubi“, Microsoft-Anmeldename, Anzeigename. Die Anmeldung läuft über Microsoft; beim ersten Anmelden wird das Konto fest verknüpft. Du bist damit gleich als zuständiger Ausbilder eingetragen.
              </li>
              <li>
                Unter <Link zu="/azubis">Azubis</Link> das Profil ausfüllen: Beruf, Berufsschule, Ausbildungsbeginn, Wochenstunden, Prüfungstermine. <strong>Erst mit einem Ausbildungsbeginn</strong> gibt es Berichtsheft und Plan.
              </li>
              <li>Bei Bedarf Ausbildungsbeauftragte – oder einen anderen Ausbilder als Vertretung – mit Zeitraum zuweisen.</li>
              <li>Im Ausbildungsplan Bausteine einfügen oder die Einträge von Hand anlegen.</li>
              <li>Dem Azubi das Handbuch zeigen (Reiter „Azubi“ oben auf dieser Seite) und beim ersten Bericht helfen.</li>
            </ol>
          ),
        },
        {
          id: 'konten',
          titel: 'Konten verwalten',
          inhalt: (
            <ul className="punkte">
              <li>Du legst Konten für Azubis und Ausbildungsbeauftragte an, sperrst oder löschst sie. Von den Azubi-Konten siehst du nur die deiner Azubis (und die ohne Ausbilder). Konten von Ausbildern verwaltet der Super-Admin.</li>
              <li>
                <strong>Sperren</strong> verhindert die Anmeldung, alle Daten bleiben. <strong>Löschen</strong> entfernt bei einem Azubi auch Berichte und Plan – das lässt sich nicht rückgängig machen. Vorher bei Bedarf das Berichtsheft als PDF herunterladen.
              </li>
              <li>„Verknüpfung lösen“ brauchst du nur, wenn die IT das Microsoft-Konto einer Person neu angelegt hat. Es gehen keine Daten verloren.</li>
              <li>Auf der Seite selbst erklärt „Was bewirkt was?“ jede Rolle und jede Funktion mit ihren Folgen.</li>
            </ul>
          ),
        },
      ]
    : []),
  {
    id: 'azubi-sicht',
    titel: 'Was der Azubi sieht',
    inhalt: (
      <p>Azubis sehen nur ihre eigenen Daten. Ihre Startseite ist der Ausbildungsplan; im Berichtsheft schreiben und reichen sie ein. Was genau sie lesen, steht im Handbuch für Azubis{rolle === 'ausbilder' || rolle === 'beauftragter' ? ' (Reiter oben)' : ''}.</p>
    ),
  },
  DRUCKEN(rolle),
  KALENDER(rolle),
  GLOCKE(rolle),
  BENACHRICHTIGUNGEN(rolle),
  PROFILBILD(rolle),
  FEHLER,
  APP,
  BEDIENUNG,
];

const ADMIN: Kapitel[] = [
  {
    id: 'aufgabe',
    titel: 'Deine Aufgaben als Super-Admin',
    inhalt: (
      <p>
        Du verwaltest Konten, siehst das Protokoll, bearbeitest <Link zu="/verwaltung/meldungen">Fehlermeldungen</Link> und stellst das Logo ein. Ausbildungspläne, Berichte und Stammdaten siehst du nicht. Fehlermeldungen kommen von allen Nutzern über „Fehler melden“; die Zahl am Menüpunkt zeigt die
        offenen. „Als Text kopieren“ erzeugt eine Fassung ohne Namen zum Weitergeben.
      </p>
    ),
  },
  {
    id: 'konten',
    titel: 'Konten',
    inhalt: (
      <ul className="punkte">
        <li>
          Unter <Link zu="/verwaltung/konten">Konten</Link> legst du Konten an, sperrst oder löschst sie – auch die der Ausbilder.
        </li>
        <li>
          Ausbilder sehen nur ihre eigenen Azubis, Azubis ohne Ausbilder und Vertretungen. Mit dem Haken <strong>„sieht alle Azubis“</strong> an einem Ausbilder-Konto gibst du die Gesamtsicht über alle Azubis des Betriebs – gedacht für die Ausbildungsleitung. Legst du selbst ein
          Azubi-Konto an, hat der Azubi zunächst keinen Ausbilder; alle Ausbilder sehen ihn, bis einer ihn übernimmt.
        </li>
        <li>Azubis, Ausbildungsbeauftragte und Ausbilder melden sich mit ihrem Microsoft-Konto an. Beim Anlegen genügt der Microsoft-Anmeldename.</li>
        <li>Nur der Super-Admin meldet sich lokal mit Passwort an (mindestens 14 Zeichen) – unter der Adresse des Portals mit <code>/super</code> am Ende.</li>
      </ul>
    ),
  },
  {
    id: 'protokoll',
    titel: 'Protokoll',
    inhalt: (
      <p>
        Das <Link zu="/verwaltung/protokoll">Protokoll</Link> zeigt Anmeldungen und Änderungen an Konten, Zuweisungen, Stammdaten und Azubi-Profilen. Berichte und Ausbildungspläne erscheinen dort nicht – weder ihr Inhalt noch, wer wann eingereicht oder abgezeichnet hat. Nur du kannst das Protokoll einsehen.
      </p>
    ),
  },
  {
    id: 'lernpruefung',
    titel: 'Lerninhalte prüfen und hochladen',
    inhalt: (
      <>
        <p>
          Ausbilder reichen Lerninhalte für das Lernmodul als ZIP-Datei ein. Unter <Link zu="/verwaltung/lerninhalte">Lerninhalte</Link> (am Handy unter „Mehr“) stehen die Einreichungen; eine Zahl am Menüpunkt zeigt, wie viele warten.
        </p>
        <dl className="begriffe">
          <Begriff wort="Was das Portal schon geprüft hat">Den Aufbau: Jede Einreichung wurde mit dem Einleser des Lernmoduls gelesen. Pakete mit Fehlern kommen gar nicht erst bei dir an. Hinweise (zum Beispiel ein Unterthema ohne Inhalt) stehen an der Einreichung.</Begriff>
          <Begriff wort="Was du prüfst">Den Inhalt: Stimmt er fachlich, ist er eigener Text (Urheberrecht), stehen keine Namen oder Daten realer Personen darin? Mit „ZIP-Datei herunterladen“ siehst du dir die Dateien an.</Begriff>
          <Begriff wort="Einreichung zurückgeben …">Mit Rückmeldung, was zu ändern ist. Der Ausbilder liest sie und reicht neu ein.</Begriff>
          <Begriff wort="Lerninhalte hochladen …">Übernimmt das Paket ins Portal, auf Wunsch mit einem Kommentar. Gibt es schon ein Lernmodul mit dieser Kennung, wird es ersetzt und gilt sofort für alle Azubis, deren Beruf es nutzt. Ihr Lernstand bleibt erhalten.</Begriff>
        </dl>
        <ul className="punkte">
          <li>Ist die Benachrichtigung in Teams eingerichtet (siehe „Fehlermeldungen“), erscheint dort ein Hinweis, sobald jemand Lerninhalte einreicht.</li>
          <li>Ein neues Lernmodul sehen Azubis erst, wenn ein Ausbilder es in den Stammdaten an einem Beruf einschaltet.</li>
          <li>Hochgeladene Pakete liegen im Datenordner des Portals unter <code>lerninhalte/</code> und sind damit in der Datensicherung. Sie gehen vor ein gleichnamiges Paket, das als Ordner auf dem Server eingebunden ist.</li>
          <li>Nach der Entscheidung löscht das Portal die eingereichte ZIP-Datei.</li>
          <li>Lerninhalte sind keine Daten über Personen. Den Lernstand der Azubis siehst du weiterhin nicht.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'meldungen',
    titel: 'Fehlermeldungen',
    inhalt: (
      <ul className="punkte">
        <li>
          Jede angemeldete Person kann über „Fehler melden“ ein Problem beschreiben, auf Wunsch mit Bildschirmfoto. Die Meldungen stehen unter <Link zu="/verwaltung/meldungen">Fehlermeldungen</Link>; die Zahl am Menüpunkt zeigt die offenen.
        </li>
        <li>Ein Bildschirmfoto erscheint erst nach einem Klick. Es kann Inhalte zeigen, die du sonst nicht siehst – etwa Texte aus Berichten.</li>
        <li>„Als Text kopieren“ erzeugt eine Fassung ohne Namen zum Weitergeben. „Als erledigt markieren“ räumt die Liste auf, „Meldung löschen“ entfernt sie endgültig.</li>
        <li>Wer den Server betreibt, kann eine Benachrichtigung in Teams einrichten. Ob sie eingerichtet ist, steht oben auf der Seite; dort lässt sich auch eine Testnachricht senden.</li>
        <li>Davon getrennt sind die persönlichen Benachrichtigungen per Teams und E-Mail, die Azubis, Ausbildungsbeauftragte und Ausbilder unter „Konto“ für sich einschalten. Sie brauchen eine eigene Einrichtung auf dem Server (README, Abschnitt „Benachrichtigungen per Teams und E-Mail“). Ein Super-Admin bekommt keine.</li>
      </ul>
    ),
  },
  {
    id: 'logo',
    titel: 'Logo',
    inhalt: (
      <p>
        Unter <Link zu="/verwaltung/erscheinungsbild">Erscheinungsbild</Link> hinterlegst du das Logo des Betriebs (PNG, JPEG oder WebP, höchstens 150 KB) – eines für die helle und, wenn du möchtest, eines für die dunkle Darstellung. Es steht in der Kopfzeile und auf der Anmeldeseite; „Ausbildungsportal“ bleibt klein daneben stehen.
      </p>
    ),
  },
  FEHLER,
  APP,
  BEDIENUNG,
];

export function Handbuch({ rolle, onFuehrung }: { rolle: Rolle; onFuehrung: () => void }) {
  // Ausbilder und Beauftragte können auch das Handbuch der Azubis lesen, um ihnen zu helfen
  const ansichten: Rolle[] = rolle === 'ausbilder' ? ['ausbilder', 'beauftragter', 'azubi'] : rolle === 'beauftragter' ? ['beauftragter', 'azubi'] : [rolle];
  const [ansicht, setAnsicht] = useState<Rolle>(rolle);
  const kapitel = ansicht === 'azubi' ? AZUBI : ansicht === 'admin' ? ADMIN : BETREUUNG(ansicht);
  const springe = (id: string) => document.getElementById(`kapitel-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Verweise aus dem Portal (HandbuchLink) öffnen das Handbuch gleich beim richtigen Kapitel
  useEffect(() => {
    const zeige = () => {
      const id = /^#kapitel-([a-z-]+)$/.exec(window.location.hash)?.[1];
      if (!id) return;
      document.querySelectorAll('.kapitel.ziel').forEach((x) => x.classList.remove('ziel'));
      const el = document.getElementById(`kapitel-${id}`);
      if (el) {
        el.scrollIntoView({ block: 'start' });
        el.classList.add('ziel');
        return;
      }
      // steht das Kapitel nur im Handbuch einer anderen Rolle, die man lesen darf, dorthin wechseln
      const andere = ansichten.find((r) => r !== ansicht && (r === 'azubi' ? AZUBI : r === 'admin' ? ADMIN : BETREUUNG(r)).some((k) => k.id === id));
      if (andere) setAnsicht(andere);
    };
    zeige();
    window.addEventListener('hashchange', zeige);
    return () => window.removeEventListener('hashchange', zeige);
  }, [ansicht]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <h1>Handbuch</h1>
      <p className="leise">
        {ansicht === 'azubi' ? 'Hier steht, wie das Portal funktioniert – kurz und der Reihe nach.' : `Anleitung für die Rolle ${ROLLE_TEXT[ansicht]}.`}
      </p>
      {ansichten.length > 1 && (
        <div className="filter nicht-drucken" role="group" aria-label="Handbuch für">
          {ansichten.map((r) => (
            <button key={r} type="button" className="knopf schlicht" aria-pressed={ansicht === r} onClick={() => setAnsicht(r)}>
              {ROLLE_TEXT[r]}
            </button>
          ))}
        </div>
      )}
      <nav aria-label="Inhalt des Handbuchs" className="karte nicht-drucken">
        <h2>Inhalt</h2>
        <ol className="inhalt">
          {kapitel.map((k) => (
            <li key={k.id}>
              <button type="button" className="link-knopf" onClick={() => springe(k.id)}>
                {k.titel}
              </button>
            </li>
          ))}
        </ol>
        <div className="aktionen links">
          {ansicht === rolle && (
            <button type="button" className="knopf" onClick={onFuehrung}>
              Führung starten
            </button>
          )}
          <button type="button" className="knopf schlicht" onClick={() => window.print()}>
            Handbuch drucken
          </button>
        </div>
        {ansicht === rolle && <p className="leise klein">Die Führung zeigt dir die wichtigsten Stellen direkt im Portal. Sie dauert etwa eine Minute und lässt sich jederzeit abbrechen und wiederholen.</p>}
      </nav>
      {kapitel.map((k, i) => (
        <section className="karte kapitel" id={`kapitel-${k.id}`} key={`${ansicht}-${k.id}`}>
          <h2>
            {i + 1}. {k.titel}
          </h2>
          {k.inhalt}
        </section>
      ))}
    </>
  );
}
