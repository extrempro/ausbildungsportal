import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Ladefehler } from '../dialoge';
import { HandbuchLink } from '../handbuchLink';
import { EinreichungKarte } from '../lernen/einreichung';
import type { Einreichung } from '../lernen/einreichung';

/** Super-Admin: eingereichte Lerninhalte prüfen – hochladen oder mit Rückmeldung zurückgeben. */
export function LernEinreichungen({ onGeaendert }: { onGeaendert: (offen: number) => void }) {
  const [d, setD] = useState<{ offen: number; einreichungen: Einreichung[] } | null>(null);
  const [fehler, setFehler] = useState('');
  const lade = useCallback(async () => {
    try {
      const r = await api<{ offen: number; einreichungen: Einreichung[] }>('GET', '/api/lernpakete/einreichungen');
      setD(r);
      setFehler('');
      onGeaendert(r.offen);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Fehler');
    }
  }, [onGeaendert]);
  useEffect(() => void lade(), [lade]);

  if (fehler && !d) return <Ladefehler titel="Lerninhalte" text={fehler} />;
  if (!d) return <p className="leise">Lädt …</p>;
  const offen = d.einreichungen.filter((e) => e.status === 'eingereicht');
  const erledigt = d.einreichungen.filter((e) => e.status !== 'eingereicht');
  return (
    <>
      <h1>Lerninhalte</h1>
      <p className="leise">
        Ausbilder reichen hier Lerninhalte für das Lernmodul ein. Das Portal hat jede Einreichung schon auf Fehler im Aufbau geprüft. Du siehst sie durch und lädst sie hoch oder gibst sie mit einer Rückmeldung zurück.{' '}
        <HandbuchLink kapitel="lernpruefung">Lerninhalte prüfen und hochladen</HandbuchLink>
      </p>
      <section>
        <h2 className="abschnitt-titel">Wartet auf deine Prüfung{offen.length ? ` (${offen.length})` : ''}</h2>
        {offen.length === 0 ? (
          <p className="karte leise">Im Moment wartet keine Einreichung.</p>
        ) : (
          <ul className="antrag-liste">
            {offen.map((e) => (
              <EinreichungKarte key={e.id} e={e} onGeaendert={lade} />
            ))}
          </ul>
        )}
      </section>
      {erledigt.length > 0 && (
        <details className="karte">
          <summary>Erledigte Einreichungen ({erledigt.length})</summary>
          <ul className="antrag-liste">
            {erledigt.map((e) => (
              <EinreichungKarte key={e.id} e={e} onGeaendert={lade} />
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
