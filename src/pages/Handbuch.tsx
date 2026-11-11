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
  titel: 'Berichte drucken oder als PDF speichern',
  inhalt: (
    <>
      <dl className="begriffe">
        <Begriff wort="Ein einzelner Bericht">Im Berichtsheft steht an jeder Woche mit Bericht „Drucken“. Auf der Seite des Berichts heißt der Knopf „Bericht drucken“.</Begriff>
        <Begriff wort="Alle Berichte">Im Berichtsheft „Alle Berichte drucken“. Jeder Bericht steht auf einer eigenen Seite.</Begriff>
        <Begriff wort="Als PDF">Im Druckfenster als Drucker „Als PDF speichern“ wählen. So entsteht eine Datei, zum Beispiel für die Kammer.</Begriff>
      </dl>
      <ul className="punkte">
        <li>Auf dem Ausdruck stehen Kopf, Tätigkeiten, Stunden und die Unterschriften. Menüs und Knöpfe werden nicht gedruckt.</li>
        <li>Chrome und Edge lassen Datum, Titel und Adresse am Rand von selbst weg. In anderen Browsern schaltest du im Druckfenster unter „Weitere Einstellungen“ die „Kopf- und Fußzeilen“ aus – der Browser merkt sich das.</li>
        <li>{rolle === 'azubi' ? 'Ein Entwurf lässt sich auch drucken. Er trägt dann den Vermerk „Entwurf – noch nicht eingereicht und nicht unterschrieben“.' : 'Entwürfe der Azubis siehst du nicht; drucken lassen sich eingereichte und abgezeichnete Berichte.'}</li>
        {rolle === 'ausbilder' && <li>Bevor du das Konto eines Azubis löschst: alle Berichte drucken oder als PDF speichern. Mit dem Konto werden die Berichte gelöscht.</li>}
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
          </>
        ) : (
          <>
            <Begriff wort="Bericht wartet auf Abzeichnung">Ein Azubi hat einen Bericht eingereicht. Die Zeile führt zu „Abzeichnen“.</Begriff>
            <Begriff wort="Neuer Eintrag im Ausbildungsplan">Ein Azubi hat eine eigene Aufgabe oder Notiz eingetragen – oder eine andere betreuende Person hat etwas geplant.</Begriff>
          </>
        )}
      </dl>
      <ul className="punkte">
        <li>Ein Tipp auf eine Zeile führt direkt zum Plan oder zum Bericht.</li>
        <li>Sobald du die Glocke öffnest, verschwindet die Zahl. Die Zeilen bleiben stehen, damit du später noch einmal nachsehen kannst.</li>
        <li>Mehrere gleiche Dinge an einem Tag stehen in einer Zeile, zum Beispiel „3 Berichte abgezeichnet“.</li>
        <li>Was du selbst gemacht hast, steht nicht in der Glocke. Nach 60 Tagen werden die Zeilen gelöscht.</li>
        <li>Eine E-Mail oder Mitteilung aufs Handy schickt das Portal nicht – sieh also regelmäßig hinein.</li>
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
          <Begriff wort="Aufgabe">Etwas, das du erledigen sollst. Wenn du fertig bist, setzt du den Haken.</Begriff>
          <Begriff wort="Notiz">Ein Hinweis ohne Haken.</Begriff>
          <Begriff wort="Termin">Ein einzelner Tag, den du selbst eingetragen hast – mit Datum und, wenn du willst, Uhrzeit.</Begriff>
          <Begriff wort="Prüfung">Ein Prüfungstermin. Oben auf der Seite siehst du, wie viele Wochen es noch sind.</Begriff>
          <Begriff wort="Schulferien, Feiertag">Zur Info. In den Schulferien ist keine Berufsschule – im Betrieb arbeitest du normal weiter, außer du hast Urlaub.</Begriff>
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
            <strong>Termine siehst nur du.</strong> Dein Ausbilder und deine Ausbildungsbeauftragten sehen sie nicht – nicht in deinem Plan, nicht in ihrer Übersicht, nicht in der Glocke und nicht in ihrem Kalender. Wenn sie von einem Termin wissen sollen, sag es ihnen selbst.
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
          <strong>Drucken:</strong> Mehr dazu im Kapitel „Berichte drucken oder als PDF speichern“.
        </p>
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
        </dl>
        <ol className="schritte">
          <li>Unter „Lernen“ ein Themenfeld öffnen.</li>
          <li>Beim Unterthema „Cheatsheet“ aufklappen und lesen.</li>
          <li>Die Ampel einstellen. Sei ehrlich zu dir – die Ampel ist nur für dich.</li>
          <li>Bei „In Arbeit“ den Lernpunkt eintragen und „Lernpunkt speichern“ wählen.</li>
        </ol>
        <ul className="punkte">
          <li>
            <strong>Deinen Lernstand siehst nur du.</strong> Dein Ausbilder und deine Ausbildungsbeauftragten sehen weder deine Ampeln noch deine Lernpunkte oder Notizen. Es gibt auch keine Auswertung für sie.
          </li>
          <li>Die Ampel eines Themenfelds ergibt sich aus den Unterthemen: „Sicher“, wenn mindestens 80 von 100 Unterthemen sicher sind und keines offen ist. „Offen“, wenn alle offen sind. Sonst „In Arbeit“.</li>
          <li>Die Prozentzahl: sicher zählt ganz, in Arbeit halb, offen gar nicht.</li>
          <li>Steht bei einem Unterthema „Inhalt aktualisiert“, wurde das Cheatsheet geändert, seit du es bewertet hast. Lies es noch einmal und wähle „Als gesehen merken“.</li>
          <li>Die Cheatsheets ersetzen nicht die Berufsschule. Sie helfen dir, den Stoff zu sortieren und Lücken zu finden.</li>
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
          <Begriff wort="Meine Ausbildung">Beruf, Berufsschule, Ausbildungszeit, Wochenstunden und Prüfungstermine. Das trägt dein Ausbilder ein. Stimmt etwas nicht, sag ihm Bescheid.</Begriff>
          <Begriff wort="Unterschrift">Du unterschreibst einmal mit dem Finger, einem Stift oder der Maus. Diese Unterschrift kommt unter jeden Bericht, den du einreichst. Ohne sie kannst du nicht einreichen. Änderst du sie später, behalten alte Berichte die alte Unterschrift.</Begriff>
          <Begriff wort="Kalender abonnieren">Dein Plan im eigenen Kalender. Mehr dazu im Kapitel „Kalender abonnieren“.</Begriff>
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
        <Begriff wort="Ich war die ganze Woche krank oder im Urlaub.">Schreib trotzdem einen Bericht: Trag die Tage unter „Abwesenheit“ ein und reiche ihn ein.</Begriff>
        <Begriff wort="„Einreichen“ geht nicht.">Meist fehlt die Unterschrift. Hinterlege sie unter „Konto“. Außerdem müssen Stunden eingetragen sein.</Begriff>
        <Begriff wort="Kann ich meine Unterschrift ändern?">Ja, unter „Konto“. Schon unterschriebene Berichte behalten die alte Unterschrift.</Begriff>
        <Begriff wort="Wer sieht meine Berichte?">Du, deine Ausbilder und die Ausbildungsbeauftragten, denen du zugeteilt bist. Andere Azubis sehen sie nicht.</Begriff>
        <Begriff wort="Ich brauche das Berichtsheft auf Papier.">Im Berichtsheft „Alle Berichte drucken“ wählen. Im Druckfenster kannst du auch „Als PDF speichern“ nehmen.</Begriff>
        <Begriff wort="Ich komme nicht weiter.">Frag deinen Ausbilder oder deine Ausbildungsbeauftragten. Wenn die Anmeldung nicht klappt, hilft die IT deines Betriebs.</Begriff>
      </dl>
    ),
  },
  KALENDER('azubi'),
  GLOCKE('azubi'),
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
          <li>Zum Lesen die Woche öffnen.</li>
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
            <li>Azubis können sich außerdem private <strong>Termine</strong> eintragen (zum Beispiel eine JAV-Sitzung). Diese sieht nur der Azubi selbst – du siehst sie nicht, auch nicht in Übersicht, Glocke oder Kalender.</li>
          </ul>
        ) : (
          <ul className="punkte">
            <li>Während deiner Zuweisung kannst du Aufgaben (mit Unteraufgaben) und Notizen eintragen, ändern und löschen.</li>
            <li>Schulblöcke und Einsätze plant der Ausbilder.</li>
          </ul>
        )}
        <p>
          Die <Link zu="/uebersicht">Übersicht</Link> zeigt {rolle === 'ausbilder' ? 'deine' : 'alle dir zugewiesenen'} Azubis nebeneinander über 26 Wochen: Schule, Einsätze und Urlaub laut Bericht.
        </p>
      </>
    ),
  },
  {
    id: 'uebersicht',
    titel: 'Die Übersicht lesen',
    inhalt: (
      <>
        <p>
          Die <Link zu="/uebersicht">Übersicht</Link> beantwortet: Wer ist wann wo? Oben stehen „Diese Woche“ und „Nächste Woche“ mit allen {rolle === 'ausbilder' ? 'deinen' : 'dir zugewiesenen'} Azubis, darunter die nächsten 26 Wochen nebeneinander – am Handy als Liste der Wochen.
        </p>
        <dl className="begriffe">
          <Begriff wort="Berufsschule, Einsatz">Kommen aus den Ausbildungsplänen.</Begriff>
          <Begriff wort="Urlaub">Kommt aus den Berichten. Er erscheint erst, wenn der Azubi ihn im Bericht der Woche unter „Abwesenheit“ eingetragen hat. Krankheit erscheint in der Übersicht nicht.</Begriff>
          <Begriff wort="Graue Felder">Die Woche liegt außerhalb der Ausbildung dieses Azubis.</Begriff>
        </dl>
        <ul className="punkte">
          <li>Die Azubis sind nach Ausbildungsjahr geordnet. Ein Klick auf den Namen öffnet den Ausbildungsplan.</li>
          <li>Private Termine der Azubis (zum Beispiel eine JAV-Sitzung) stehen hier nicht.</li>
          {rolle === 'ausbilder' && <li>Über „Für mehrere Azubis planen“ kommst du zur Sammelplanung.</li>}
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
                <li>Bausteine lassen sich als Datei exportieren und wieder importieren – zur Sicherung oder für ein anderes Portal.</li>
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
                  <strong>Zuständig</strong> bist du für Azubis, bei denen du im Profil unter „Zuständiger Ausbilder“ stehst. Legst du selbst ein Azubi-Konto an, trägt das Portal dich gleich ein. Nur diese Azubis siehst du in Listen, Übersicht, Abzeichnen und Glocke.
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
                <Begriff wort="Ausbildungsberufe">Bezeichnung, bei Bedarf Fachrichtung, und Regeldauer in Monaten.</Begriff>
                <Begriff wort="Lernmodul">
                  Am Beruf lässt sich ein Paket mit Lerninhalten einschalten, sofern eines auf dem Server liegt. Azubis dieses Berufs sehen dann den Menüpunkt „Lernen“ mit Cheatsheets und einer Ampel zur Selbsteinschätzung. Den Lernstand sieht nur der Azubi selbst – du siehst ihn nicht, auch
                  nicht als Zusammenfassung. Die Inhalte pflegt, wer den Server betreibt. Liegen dort noch keine, ist das Feld gesperrt und die Seite sagt, was fehlt.
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
                <strong>Sperren</strong> verhindert die Anmeldung, alle Daten bleiben. <strong>Löschen</strong> entfernt bei einem Azubi auch Berichte und Plan – das lässt sich nicht rückgängig machen. Vorher bei Bedarf alle Berichte drucken oder als PDF speichern.
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
