import { Ladefehler } from '../dialoge';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api, berichtsheftPfad, h, STATUS_FARBE, STATUS_TEXT, wocheText } from '../api';
import type { BerichtListe, BerichtStatus } from '../api';
import { Icon } from '../icons';
import { Link } from '../router';
import { BerichtBlatt } from './Bericht';

/**
 * Merkt, ob der Azubi die Anleitung selbst auf- oder zugeklappt hat.
 * Neuer Name seit 0.9.3: Unter dem alten Namen hat Version 0.9.0 von sich aus „offen“ gespeichert – das hielt die Anleitung dauerhaft offen.
 */
const ANLEITUNG = 'berichtsheft-anleitung';

/** Was der Azubi mit einer Woche als Nächstes tun kann. */
const AKTION: Record<BerichtStatus, string> = { fehlt: 'Schreiben', entwurf: 'Weiterschreiben', zurueck: 'Überarbeiten', eingereicht: 'Ansehen', abgezeichnet: 'Ansehen' };

function Schritt({ nr, titel, children }: { nr: number; titel: string; children: ReactNode }) {
  return (
    <li>
      <span className="ablauf-nr">{nr}</span>
      <div>
        <strong>{titel}</strong>
        <div className="leise klein">{children}</div>
      </div>
    </li>
  );
}

const FILTER: { wert: BerichtStatus | 'alle'; text: string }[] = [
  { wert: 'alle', text: 'Alle' },
  { wert: 'fehlt', text: 'Fehlt' },
  { wert: 'entwurf', text: 'Entwurf' },
  { wert: 'zurueck', text: 'Zurückgegeben' },
  { wert: 'eingereicht', text: 'Eingereicht' },
  { wert: 'abgezeichnet', text: 'Abgezeichnet' },
];

/** Liste aller Wochen der Ausbildung mit dem Stand des jeweiligen Berichts. */
function lies(schluessel: string): string | null {
  try {
    return localStorage.getItem(schluessel);
  } catch {
    return null;
  }
}
function merke(schluessel: string, wert: string): void {
  try {
    localStorage.setItem(schluessel, wert);
  } catch {
    // ohne Speicher bleibt die Anleitung einfach offen
  }
}

export function Berichtsheft({ azubiId }: { azubiId: number }) {
  const [daten, setDaten] = useState<BerichtListe | null>(null);
  const [fehler, setFehler] = useState('');
  const [filter, setFilter] = useState<BerichtStatus | 'alle'>('alle');
  const [hatUnterschrift, setHatUnterschrift] = useState(true);
  // Anleitung: von sich aus nur offen, solange noch kein Bericht geschrieben ist; danach eingeklappt.
  // Wer sie selbst auf- oder zuklappt, behält seine Wahl.
  const [anleitung, setAnleitung] = useState<boolean | null>(() => (lies(ANLEITUNG) === '1' ? true : lies(ANLEITUNG) === '0' ? false : null));

  useEffect(() => {
    api<BerichtListe>('GET', `/api/azubis/${azubiId}/berichte`).then(setDaten, (e: Error) => setFehler(e.message));
    api<{ pfad: string | null }>('GET', '/api/ich/unterschrift').then((r) => setHatUnterschrift(!!r.pfad), () => {});
  }, [azubiId]);

  if (fehler) {
    return (
      <>
        <h1>Berichtsheft nicht gefunden</h1>
        <p className="leise">{fehler}</p>
      </>
    );
  }
  if (!daten) return <p className="leise">Lädt …</p>;

  const basis = berichtsheftPfad(azubiId, daten.eigenes);
  const anleitungOffen = anleitung ?? daten.wochen.every((w) => w.status === 'fehlt');
  const anzahl = (s: BerichtStatus | 'alle') => (s === 'alle' ? daten.wochen.length : daten.wochen.filter((w) => w.status === s).length);
  const sichtbar = daten.wochen.filter((w) => filter === 'alle' || w.status === filter);

  return (
    <>
      {!daten.eigenes && (
        <p className="klein">
          <Link zu={`/azubis/${azubiId}`}>← {daten.azubi.anzeigename}</Link>
        </p>
      )}
      <h1>Berichtsheft{daten.eigenes ? '' : ` von ${daten.azubi.anzeigename}`}</h1>
      <p className="leise">
        {daten.eigenes
          ? 'Für jede Woche deiner Ausbildung schreibst du einen Bericht (Ausbildungsnachweis): Was hast du gemacht, und wie viele Stunden?'
          : 'Ein Bericht (Ausbildungsnachweis) je Kalenderwoche. Nur der Azubi selbst kann die Berichte bearbeiten.'}
      </p>

      {daten.eigenes && !daten.beginnFehlt && (
        <section className={`karte anleitung${anleitungOffen ? '' : ' zu'}`}>
          <button
            type="button"
            className="anleitung-kopf"
            aria-expanded={anleitungOffen}
            aria-controls="anleitung-inhalt"
            onClick={() => {
              setAnleitung(!anleitungOffen);
              merke(ANLEITUNG, anleitungOffen ? '0' : '1');
            }}
          >
            <Icon name="hilfe" />
            <span className="anleitung-titel">So funktioniert das Berichtsheft</span>
            <span className="anleitung-schalter">
              {anleitungOffen ? 'Einklappen' : 'Anzeigen'}
              <Icon name="unten" groesse={18} />
            </span>
          </button>
          {anleitungOffen && (
            <div id="anleitung-inhalt">
              <ol className="ablauf-liste">
                <Schritt nr={1} titel="Woche öffnen und schreiben">
                  Wähle unten bei der Woche „Schreiben“. Trag ein, was du gemacht hast, und die Stunden dazu.
                </Schritt>
                <Schritt nr={2} titel="Speichern oder einreichen">
                  Noch nicht fertig? „Als Entwurf speichern“ – du schreibst später weiter. Fertig? „Einreichen“ – damit gibst du den Bericht ab.
                </Schritt>
                <Schritt nr={3} titel="Dein Ausbilder zeichnet ab">
                  Er liest den Bericht und unterschreibt. Möchte er eine Änderung, bekommst du den Bericht zurück – dann steht hier „zurückgegeben“.
                </Schritt>
              </ol>
              <p className="leise klein">
                Tipp: Schreib den Bericht am Ende jeder Woche. Mehr dazu im <Link zu="/handbuch">Handbuch</Link>.
              </p>
            </div>
          )}
        </section>
      )}
      {daten.eigenes && !hatUnterschrift && (
        <p className="hinweis">
          Bevor du einen Bericht einreichen kannst, brauchst du eine Unterschrift. <Link zu="/konto">Jetzt unter „Konto“ unterschreiben</Link>
        </p>
      )}

      {daten.beginnFehlt ? (
        <p className="hinweis">
          {daten.eigenes ? 'Für dich ist noch kein Ausbildungsbeginn eingetragen. Bitte wende dich an deinen Ausbilder – erst dann lassen sich Berichte schreiben.' : 'Für diesen Azubi ist noch kein Ausbildungsbeginn eingetragen. Er steht im Profil.'}
        </p>
      ) : (
        <>
          <div className="filter" role="group" aria-label="Nach Stand filtern">
            {FILTER.filter((f) => f.wert === 'alle' || anzahl(f.wert) > 0).map((f) => (
              <button key={f.wert} type="button" className="knopf schlicht" aria-pressed={filter === f.wert} onClick={() => setFilter(f.wert)}>
                {f.text} ({anzahl(f.wert)})
              </button>
            ))}
            {anzahl('alle') > anzahl('fehlt') && (
              <Link zu={`${basis}/druck`} className="knopf schlicht rechts">
                Alle Berichte drucken
              </Link>
            )}
          </div>
          <div className="karte tabelle-rahmen">
            <table className="stapel">
              <thead>
                <tr>
                  <th>Woche</th>
                  <th>Zeitraum</th>
                  <th>Stand</th>
                  <th className="zahl">Stunden</th>
                  <th>
                    <span className="nur-vorleser">Aktion</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sichtbar.map((w) => (
                  <tr key={w.montag}>
                    <td className="eng kopf">
                      <Link zu={`${basis}/${w.montag}`}>
                        <strong>
                          KW {w.kw}/{w.jahr}
                        </strong>
                      </Link>
                    </td>
                    <td className="eng" data-label="Zeitraum">
                      <span>
                        {wocheText(w.montag, w.sonntag)}
                        {w.ausbildungsjahr ? <span className="leise"> · {w.ausbildungsjahr}. Jahr</span> : null}
                      </span>
                    </td>
                    <td data-label="Stand">
                      <span className={`pille ${STATUS_FARBE[w.status]}`}>{STATUS_TEXT[w.status]}</span>
                    </td>
                    <td className="zahl" data-label="Stunden">{w.status === 'fehlt' ? '–' : `${h(w.stunden)} von ${h(daten.soll)}`}</td>
                    <td className="aktion">
                      <Link zu={`${basis}/${w.montag}`} className={`knopf klein${daten.eigenes && (w.status === 'fehlt' || w.status === 'zurueck' || w.status === 'entwurf') ? '' : ' schlicht'}`}>
                        {daten.eigenes ? AKTION[w.status] : 'Ansehen'}
                        <span className="nur-vorleser">
                          , KW {w.kw}/{w.jahr}
                        </span>
                      </Link>
                    </td>
                  </tr>
                ))}
                {sichtbar.length === 0 && (
                  <tr>
                    <td colSpan={5} className="leise">
                      Keine Wochen mit diesem Stand.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

/** Alle vorhandenen Berichte untereinander – jede Woche auf einer eigenen Druckseite. */
export function BerichteDruck({ azubiId }: { azubiId: number }) {
  const [daten, setDaten] = useState<BerichtListe | null>(null);
  const [fehler, setFehler] = useState('');
  const [nur, setNur] = useState<'alle' | 'abgezeichnet'>('alle');

  useEffect(() => {
    api<BerichtListe>('GET', `/api/azubis/${azubiId}/berichte?voll=1`).then(setDaten, (e: Error) => setFehler(e.message));
  }, [azubiId]);

  if (fehler) return <Ladefehler titel="Berichtsheft" text={fehler} />;
  if (!daten) return <p className="leise">Lädt …</p>;
  const berichte = (daten.berichte ?? []).filter((b) => nur === 'alle' || b.status === 'abgezeichnet');

  return (
    <>
      <div className="nicht-drucken">
        <p className="klein">
          <Link zu={berichtsheftPfad(azubiId, daten.eigenes)}>← Berichtsheft</Link>
        </p>
        <h1>Berichte drucken</h1>
        <p className="leise">
          {daten.azubi.anzeigename} · {berichte.length} Berichte, jeder auf einer eigenen Seite. Über „Drucken“ lässt sich im Druckdialog auch „Als PDF speichern“ wählen.
        </p>
        <div className="filter">
          <button type="button" className="knopf schlicht" aria-pressed={nur === 'alle'} onClick={() => setNur('alle')}>
            Alle vorhandenen
          </button>
          <button type="button" className="knopf schlicht" aria-pressed={nur === 'abgezeichnet'} onClick={() => setNur('abgezeichnet')}>
            Nur abgezeichnete
          </button>
          <button type="button" className="knopf rechts" onClick={() => window.print()} disabled={berichte.length === 0}>
            Drucken
          </button>
        </div>
      </div>
      {berichte.map((b) => (
        <section className="karte druckseite" key={b.montag}>
          <BerichtBlatt b={b} />
        </section>
      ))}
      {berichte.length === 0 && <p className="karte leise">Keine Berichte vorhanden.</p>}
    </>
  );
}
