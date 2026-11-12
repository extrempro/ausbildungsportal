import { useEffect, useState } from 'react';
import { api } from './api';
import type { Rolle } from './api';
import { melde } from './dialoge';
import { HandbuchLink } from './handbuchLink';

/**
 * Konto: Benachrichtigungen per Teams und E-Mail – zusätzlich zur Glocke.
 * Je Bereich zwei Haken; jede Änderung wird sofort gespeichert. Ist ein Weg nicht eingerichtet, ist er gesperrt und sagt, warum.
 */
type Bereich = 'berichtsheft' | 'urlaub' | 'plan';
type Weg = 'teams' | 'mail';

interface Antwort {
  teams: { grund: string | null };
  mail: { grund: string | null; adresse: string | null };
  wahl: { bereich: Bereich; teams: boolean; mail: boolean }[];
}

const TITEL: Record<Bereich, string> = { berichtsheft: 'Berichtsheft', urlaub: 'Urlaub', plan: 'Ausbildungsplan' };
const WEG: Record<Weg, string> = { teams: 'Teams', mail: 'E-Mail' };

function wofuer(bereich: Bereich, azubi: boolean): string {
  if (bereich === 'berichtsheft') return azubi ? 'Dein Bericht wurde abgezeichnet, zurückgegeben oder wieder geöffnet.' : 'Ein Azubi hat einen Bericht eingereicht – oder an einem Bericht hat sich etwas getan.';
  if (bereich === 'urlaub') return azubi ? 'Dein Urlaubsantrag wurde bestätigt, genehmigt, abgelehnt oder storniert.' : 'Ein Azubi hat Urlaub beantragt – oder an einem Antrag hat sich etwas getan.';
  return azubi ? 'In deinem Plan gibt es neue Einträge.' : 'Im Plan eines deiner Azubis gibt es neue Einträge von jemand anderem.';
}

export function Benachrichtigungen({ rolle }: { rolle: Rolle }) {
  const [daten, setDaten] = useState<Antwort | null>(null);
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [testFehler, setTestFehler] = useState('');
  const azubi = rolle === 'azubi';

  useEffect(() => {
    api<Antwort>('GET', '/api/ich/benachrichtigungen').then(setDaten, (e) => setFehler(e instanceof Error ? e.message : 'Fehler'));
  }, []);

  const setze = async (bereich: Bereich, weg: Weg, an: boolean) => {
    if (!daten) return;
    setLaeuft(true);
    setFehler('');
    try {
      const wahl = daten.wahl.map((z) => (z.bereich === bereich ? { ...z, [weg]: an } : z));
      setDaten(await api<Antwort>('PUT', '/api/ich/benachrichtigungen', { wahl }));
      melde(an ? `Eingeschaltet: ${TITEL[bereich]} per ${WEG[weg]}.` : `Ausgeschaltet: ${TITEL[bereich]} per ${WEG[weg]}.`);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLaeuft(false);
    }
  };

  const teste = async (weg: Weg) => {
    setLaeuft(true);
    setTestFehler('');
    try {
      await api('POST', '/api/ich/benachrichtigungen/test', { weg });
      melde(weg === 'teams' ? 'Testnachricht gesendet. Sieh in Teams nach – sie kommt vom Absender „Workflows“.' : 'Testnachricht gesendet. Sieh in dein Postfach.');
    } catch (e) {
      setTestFehler(`Testnachricht per ${WEG[weg]} nicht gesendet: ${e instanceof Error ? e.message : 'Fehler'}`);
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <section className="karte" id="benachrichtigungen">
      <h2>Benachrichtigungen</h2>
      <p>
        Was es Neues gibt, zeigt dir immer die Glocke oben rechts. Hier stellst du ein, ob du zusätzlich eine Nachricht bekommst. <HandbuchLink kapitel="benachrichtigungen">Mehr zu Benachrichtigungen</HandbuchLink>
      </p>
      {fehler && (
        <p className="hinweis fehler" role="alert">
          {fehler}
        </p>
      )}
      {!daten && !fehler && <p className="leise">Lädt …</p>}
      {daten && (
        <>
          <div className="benach-liste">
            {daten.wahl.map((z) => (
              <fieldset key={z.bereich} className="benach-bereich">
                <legend>{TITEL[z.bereich]}</legend>
                <p className="leise klein">{wofuer(z.bereich, azubi)}</p>
                {(['teams', 'mail'] as const).map((weg) => (
                  <label key={weg} className="haken">
                    <input type="checkbox" checked={z[weg]} disabled={laeuft || (!!daten[weg].grund && !z[weg])} onChange={(e) => void setze(z.bereich, weg, e.target.checked)} />
                    Per {WEG[weg]}
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
          {(['teams', 'mail'] as const).map(
            (weg) =>
              daten[weg].grund && (
                <p key={weg} className="leise klein benach-grund">
                  <strong>{WEG[weg]} ist gesperrt:</strong> {daten[weg].grund}
                </p>
              ),
          )}
          <p className="leise klein">
            Die Nachrichten nennen keine Namen und keine Inhalte – nur, was passiert ist, und einen Link ins Portal. Mehreres kurz nacheinander kommt nach wenigen Minuten als eine Nachricht.
            {daten.mail.adresse && !daten.mail.grund ? ` E-Mails gehen an ${daten.mail.adresse}.` : ''}
          </p>
          {testFehler && (
            <p className="hinweis fehler" role="alert">
              {testFehler}
            </p>
          )}
          <div className="aktionen links">
            <button type="button" className="knopf schlicht" disabled={laeuft || !!daten.teams.grund} onClick={() => void teste('teams')}>
              Testnachricht per Teams senden
            </button>
            <button type="button" className="knopf schlicht" disabled={laeuft || !!daten.mail.grund} onClick={() => void teste('mail')}>
              Testnachricht per E-Mail senden
            </button>
          </div>
        </>
      )}
    </section>
  );
}
