import type { Rolle } from '../api';
import { Link } from '../router';

/** Kurze Anleitung je Rolle – was die Bereiche tun und in welcher Reihenfolge man sie braucht. */
export function Hilfe({ rolle }: { rolle: Rolle }) {
  return (
    <>
      <h1>Hilfe</h1>
      <p className="leise">Kurz erklärt, was du hier tun kannst. Die Texte gelten für deine Rolle.</p>

      {rolle === 'azubi' && (
        <>
          <section className="karte">
            <h2>Berichtsheft führen</h2>
            <ol className="schritte">
              <li>
                Unter <Link zu="/konto">Konto</Link> einmal deine Unterschrift hinterlegen.
              </li>
              <li>
                Im <Link zu="/berichtsheft">Berichtsheft</Link> die Woche öffnen und eintragen, was du gemacht hast – jeweils mit Stunden. „Als Entwurf speichern“ hält den Stand fest.
              </li>
              <li>„Einreichen“ unterschreibt den Bericht und legt ihn deinem Ausbilder oder deinen Ausbildungsbeauftragten vor.</li>
              <li>Kommt ein Bericht zurück, steht der Grund oben im Bericht. Ändern und erneut einreichen.</li>
            </ol>
            <p className="leise klein">Solange ein Bericht nicht abgezeichnet ist, kannst du ihn zurückziehen. Abgezeichnete Berichte sind gesperrt; nur ein Ausbilder kann die Abzeichnung aufheben.</p>
          </section>
          <section className="karte">
            <h2>Ausbildungsplan</h2>
            <p>
              Der <Link zu="/plan">Ausbildungsplan</Link> zeigt deine Ausbildung Woche für Woche: Schulblöcke, Einsätze, Aufgaben, Prüfungen, Ferien und Feiertage. Oben stehen diese und die nächste Woche.
            </p>
            <p>Du kannst eigene Aufgaben und Notizen eintragen („+“ an der Woche) und Aufgaben abhaken. Was Ausbilder und Beauftragte geplant haben, kannst du nicht ändern.</p>
          </section>
        </>
      )}

      {(rolle === 'ausbilder' || rolle === 'beauftragter') && (
        <>
          <section className="karte">
            <h2>Berichte abzeichnen</h2>
            <ol className="schritte">
              <li>
                Unter <Link zu="/konto">Konto</Link> einmal die eigene Unterschrift hinterlegen.
              </li>
              <li>
                Unter <Link zu="/abzeichnen">Abzeichnen</Link> stehen alle eingereichten Berichte, die auf dich warten. Zum Lesen die Woche öffnen.
              </li>
              <li>Abzeichnen (einzeln oder mehrere auf einmal) oder mit einem Kommentar zurückgeben.</li>
            </ol>
            {rolle === 'beauftragter' ? (
              <p className="leise klein">Du siehst nur Azubis, die dir zugewiesen sind, und zeichnest Berichte für Wochen im Zeitraum deiner Zuweisung ab.</p>
            ) : (
              <p className="leise klein">Eine Abzeichnung lässt sich mit Begründung wieder aufheben; der Bericht geht dann zurück an den Azubi.</p>
            )}
          </section>
          <section className="karte">
            <h2>Ausbildungsplan</h2>
            <p>
              Über <Link zu="/azubis">Azubis</Link> den Azubi öffnen, dann „Ausbildungsplan“. {rolle === 'ausbilder' ? 'Du planst Schulblöcke, Einsätze, Aufgaben und Notizen.' : 'Während deiner Zuweisung kannst du Aufgaben und Notizen eintragen; Schulblöcke und Einsätze plant der Ausbilder.'}
            </p>
            <p>
              Die <Link zu="/uebersicht">Übersicht</Link> zeigt alle Azubis nebeneinander: Schule, Einsätze und Urlaub laut Bericht.
            </p>
          </section>
        </>
      )}

      {rolle === 'ausbilder' && (
        <section className="karte">
          <h2>Einen neuen Azubi einrichten</h2>
          <ol className="schritte">
            <li>
              Einmalig unter <Link zu="/verwaltung/stammdaten">Stammdaten</Link> Betrieb, Beruf und Berufsschule anlegen.
            </li>
            <li>
              Unter <Link zu="/verwaltung/konten">Konten</Link> das Konto mit dem Microsoft-Anmeldenamen anlegen. Die Anmeldung selbst läuft über Microsoft.
            </li>
            <li>
              Unter <Link zu="/azubis">Azubis</Link> das Profil ausfüllen: Beruf, Ausbildungsbeginn, Prüfungstermine. Erst mit einem Ausbildungsbeginn gibt es Berichtsheft und Plan.
            </li>
            <li>Bei Bedarf Ausbildungsbeauftragte zuweisen und eine Planvorlage in den Plan übernehmen.</li>
          </ol>
        </section>
      )}

      {rolle === 'admin' && (
        <section className="karte">
          <h2>Konten verwalten</h2>
          <p>
            Als Super-Admin legst du unter <Link zu="/verwaltung/konten">Konten</Link> Konten an, sperrst oder löschst sie. Ausbildungspläne, Berichte und Stammdaten siehst du nicht.
          </p>
          <p>Azubis, Ausbildungsbeauftragte und Ausbilder melden sich mit ihrem Microsoft-Konto an. Beim Anlegen genügt der Microsoft-Anmeldename; das Konto wird bei der ersten Anmeldung verknüpft.</p>
        </section>
      )}

      <section className="karte">
        <h2>Bedienung</h2>
        <ul className="punkte">
          <li>Am PC steht die Navigation oben, auf Handy und Tablet unten; weitere Bereiche stehen unter „Mehr“.</li>
          <li>Hell oder dunkel lässt sich im Menü umschalten; „automatisch“ steht unter „Konto“.</li>
          <li>Alles ist mit der Tastatur bedienbar: Tab wechselt das Feld, Enter löst aus, Escape schließt Menüs und Dialoge.</li>
          <li>Auf Android lässt sich die Seite über das Browser-Menü „Zum Startbildschirm hinzufügen“ wie eine App ablegen.</li>
          <li>Nach acht Stunden ohne Eingabe wirst du abgemeldet. Ungespeicherte Eingaben im Bericht gehen dabei verloren – zwischendurch als Entwurf speichern.</li>
        </ul>
      </section>
    </>
  );
}
