import { useState } from 'react';
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
      <li>Hell oder dunkel: im Menü an deinem Namen bzw. unter „Mehr“. „Automatisch“ stellst du unter „Konto“ ein.</li>
      <li>Alles geht auch mit der Tastatur: Tab wechselt das Feld, Enter löst aus, Escape schließt Menüs und Fenster.</li>
      <li>Nach acht Stunden ohne Eingabe wirst du abgemeldet. Speichere längere Texte zwischendurch.</li>
    </ul>
  ),
};

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
          <Begriff wort="Prüfung">Ein Prüfungstermin. Oben auf der Seite siehst du, wie viele Wochen es noch sind.</Begriff>
          <Begriff wort="Schulferien, Feiertag">Zur Info. In den Schulferien ist keine Berufsschule – im Betrieb arbeitest du normal weiter, außer du hast Urlaub.</Begriff>
        </dl>
        <p>
          <strong>Selbst etwas eintragen:</strong> Mit dem „+“ an einer Woche legst du eigene Aufgaben und Notizen an, zum Beispiel „Für die Klassenarbeit lernen“. Diese kannst du auch wieder ändern oder löschen.
        </p>
        <p>Was dein Ausbilder oder deine Ausbildungsbeauftragten eingetragen haben, kannst du nicht ändern – nur abhaken.</p>
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
            Trag ein, was du gemacht hast, und wie viele Stunden es waren:
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
          <li>Die Summe sollte ungefähr zu deinen Wochenstunden passen. Das Portal zeigt dir, wie viel fehlt oder zu viel ist.</li>
          <li>
            Noch nicht fertig? <strong>„Als Entwurf speichern“</strong>. Den Entwurf siehst nur du.
          </li>
          <li>
            Fertig? <strong>„Einreichen“</strong>. Damit unterschreibst du den Bericht und gibst ihn ab.
          </li>
        </ol>
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
  APP,
  BEDIENUNG,
];

const BETREUUNG = (rolle: 'ausbilder' | 'beauftragter'): Kapitel[] => [
  {
    id: 'aufgabe',
    titel: rolle === 'ausbilder' ? 'Deine Aufgaben im Portal' : 'Deine Aufgaben als Ausbildungsbeauftragte/r',
    inhalt:
      rolle === 'ausbilder' ? (
        <p>Du richtest Azubis ein, planst ihre Ausbildung, liest ihre Berichte und zeichnest sie ab. Du siehst alle Azubis des Betriebs.</p>
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
              Wiederkehrende Abläufe legst du als <Link zu="/verwaltung/vorlagen">Planvorlage</Link> an (Wochen ab Ausbildungsbeginn) und übernimmst sie in den Plan.
            </li>
            <li>Azubis können eigene Aufgaben und Notizen eintragen. Diese sind mit „vom Azubi eingetragen“ gekennzeichnet; du kannst sie ändern.</li>
          </ul>
        ) : (
          <ul className="punkte">
            <li>Während deiner Zuweisung kannst du Aufgaben (mit Unteraufgaben) und Notizen eintragen, ändern und löschen.</li>
            <li>Schulblöcke und Einsätze plant der Ausbilder.</li>
          </ul>
        )}
        <p>
          Die <Link zu="/uebersicht">Übersicht</Link> zeigt alle {rolle === 'ausbilder' ? '' : 'dir zugewiesenen '}Azubis nebeneinander über 26 Wochen: Schule, Einsätze und Urlaub laut Bericht.
        </p>
      </>
    ),
  },
  ...(rolle === 'ausbilder'
    ? [
        {
          id: 'einrichten',
          titel: 'Einen neuen Azubi einrichten',
          inhalt: (
            <ol className="schritte">
              <li>
                Einmalig unter <Link zu="/verwaltung/stammdaten">Stammdaten</Link> Betrieb (mit Bundesland für die Feiertage), Ausbildungsberuf und Berufsschule anlegen.
              </li>
              <li>
                Unter <Link zu="/verwaltung/konten">Konten</Link> das Konto anlegen: Rolle „Azubi“, Microsoft-Anmeldename, Anzeigename. Die Anmeldung läuft über Microsoft; beim ersten Anmelden wird das Konto fest verknüpft.
              </li>
              <li>
                Unter <Link zu="/azubis">Azubis</Link> das Profil ausfüllen: Beruf, Berufsschule, Ausbildungsbeginn, Wochenstunden, Prüfungstermine. <strong>Erst mit einem Ausbildungsbeginn</strong> gibt es Berichtsheft und Plan.
              </li>
              <li>Bei Bedarf Ausbildungsbeauftragte mit Zeitraum zuweisen.</li>
              <li>Im Ausbildungsplan eine Planvorlage übernehmen oder die Einträge von Hand anlegen.</li>
              <li>Dem Azubi das Handbuch zeigen (Reiter „Azubi“ oben auf dieser Seite) und beim ersten Bericht helfen.</li>
            </ol>
          ),
        },
        {
          id: 'konten',
          titel: 'Konten verwalten',
          inhalt: (
            <ul className="punkte">
              <li>Du legst Konten für Azubis und Ausbildungsbeauftragte an, sperrst oder löschst sie. Konten von Ausbildern verwaltet der Super-Admin.</li>
              <li>
                <strong>Sperren</strong> verhindert die Anmeldung, alle Daten bleiben. <strong>Löschen</strong> entfernt bei einem Azubi auch Berichte und Plan – das lässt sich nicht rückgängig machen. Vorher bei Bedarf alle Berichte drucken oder als PDF speichern.
              </li>
              <li>Ändert sich der Microsoft-Anmeldename, hilft „Verknüpfung lösen“.</li>
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
  APP,
  BEDIENUNG,
];

const ADMIN: Kapitel[] = [
  {
    id: 'aufgabe',
    titel: 'Deine Aufgaben als Super-Admin',
    inhalt: <p>Du verwaltest Konten, siehst das Protokoll und stellst das Logo ein. Ausbildungspläne, Berichte und Stammdaten siehst du nicht.</p>,
  },
  {
    id: 'konten',
    titel: 'Konten',
    inhalt: (
      <ul className="punkte">
        <li>
          Unter <Link zu="/verwaltung/konten">Konten</Link> legst du Konten an, sperrst oder löschst sie – auch die der Ausbilder.
        </li>
        <li>Azubis, Ausbildungsbeauftragte und Ausbilder melden sich mit ihrem Microsoft-Konto an. Beim Anlegen genügt der Microsoft-Anmeldename.</li>
        <li>Nur der Super-Admin meldet sich lokal mit Passwort an (mindestens 14 Zeichen).</li>
      </ul>
    ),
  },
  {
    id: 'protokoll',
    titel: 'Protokoll',
    inhalt: (
      <p>
        Das <Link zu="/verwaltung/protokoll">Protokoll</Link> zeigt Anmeldungen und Änderungen: an Konten, Zuweisungen, Stammdaten, Profilen und am Stand von Berichten (eingereicht, abgezeichnet, zurückgegeben). Inhalte von Berichten und Plänen stehen dort nie. Nur du kannst es einsehen.
      </p>
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
  APP,
  BEDIENUNG,
];

export function Handbuch({ rolle, onFuehrung }: { rolle: Rolle; onFuehrung: () => void }) {
  // Ausbilder und Beauftragte können auch das Handbuch der Azubis lesen, um ihnen zu helfen
  const ansichten: Rolle[] = rolle === 'ausbilder' ? ['ausbilder', 'beauftragter', 'azubi'] : rolle === 'beauftragter' ? ['beauftragter', 'azubi'] : [rolle];
  const [ansicht, setAnsicht] = useState<Rolle>(rolle);
  const kapitel = ansicht === 'azubi' ? AZUBI : ansicht === 'admin' ? ADMIN : BETREUUNG(ansicht);
  const springe = (id: string) => document.getElementById(`kapitel-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

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
