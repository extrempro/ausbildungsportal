import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { ROLLE_TEXT, zeit } from './api';
import type { Rolle } from './api';
import { melde } from './dialoge';
import { useUngespeichert } from './router';

/**
 * Gespräch zu einer Rückmeldung (Fehler oder Idee): Super-Admin und – bei Ideen – Ausbilder fragen nach,
 * die meldende Person antwortet unter „Meine Meldungen“. Älteste Nachricht oben.
 */
export interface Nachricht {
  id: number;
  zeit: string;
  name: string;
  rolle: Rolle;
  /** von der Person, die die Rückmeldung geschickt hat */
  vonPerson: boolean;
  text: string;
}

const MAX_TEXT = 2000;

export function Gespraech({
  nachrichten,
  personSieht,
  knopf,
  bestaetigung,
  gesperrt,
  an,
  onSende,
}: {
  nachrichten: Nachricht[];
  /** true auf „Meine Meldungen“: die eigenen Nachrichten heißen dann „Du“ */
  personSieht: boolean;
  /** Text des Knopfs, z. B. „Rückfrage senden“ */
  knopf: string;
  bestaetigung: string;
  /** Grund, warum nicht geschrieben werden kann (z. B. Konto gelöscht) – dann kein Eingabefeld */
  gesperrt?: string;
  /** Name der Person, die die Rückmeldung geschickt hat (für die Beschriftung des Eingabefelds) */
  an?: string;
  onSende: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const id = useId();
  useUngespeichert(text.trim() !== '');

  const sende = async (e: FormEvent) => {
    e.preventDefault();
    setLaeuft(true);
    setFehler('');
    try {
      await onSende(text);
      setText('');
      melde(bestaetigung);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Die Nachricht konnte nicht gesendet werden');
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <div className="gespraech">
      {nachrichten.length > 0 && (
        <ol className="gespraech-liste" aria-label="Gespräch zu dieser Rückmeldung">
          {nachrichten.map((n) => (
            <li key={n.id} className={n.vonPerson ? 'von-person' : 'vom-team'}>
              <span className="leise klein">
                <strong>{n.vonPerson && personSieht ? 'Du' : n.name}</strong> {n.vonPerson || n.name === ROLLE_TEXT[n.rolle] ? '' : `(${ROLLE_TEXT[n.rolle] ?? n.rolle}) `}· {zeit(n.zeit)}
              </span>
              <p>{n.text}</p>
            </li>
          ))}
        </ol>
      )}
      {gesperrt ? (
        <p className="leise klein">{gesperrt}</p>
      ) : (
        <form onSubmit={sende} className="gespraech-form">
          <label htmlFor={`${id}-text`}>{personSieht ? 'Deine Antwort' : `Nachricht an ${an ?? 'die Person, die das geschickt hat'}`}</label>
          <textarea id={`${id}-text`} rows={3} value={text} maxLength={MAX_TEXT} onChange={(e) => setText(e.target.value)} />
          {fehler && (
            <p className="hinweis fehler" role="alert">
              {fehler}
            </p>
          )}
          <div className="aktionen links">
            <button type="submit" className="knopf klein" disabled={laeuft || text.trim().length < 2}>
              {laeuft ? 'Sendet …' : knopf}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
