import { useEffect, useState } from 'react';
import { api, zeit } from '../api';
import { Gespraech } from '../gespraech';
import type { Nachricht } from '../gespraech';
import { HandbuchLink } from '../handbuchLink';

/**
 * „Meine Meldungen“: die eigenen Fehlermeldungen und Ideen mit dem Gespräch dazu – für jede Rolle.
 * Wünsche zu Lerninhalten stehen hier nicht: Sie sind ohne Namen gespeichert und gehören niemandem.
 */
interface Meldung {
  id: number;
  art: 'fehler' | 'idee';
  zeit: string;
  text: string;
  seite: string;
  status: 'offen' | 'erledigt';
  erledigtAm: string | null;
  nachrichten: Nachricht[];
  /** neue Nachrichten an mich, die ich noch nicht gesehen habe */
  neu: number;
}
interface Antwort {
  meldungen: Meldung[];
  neu: number;
}

export function MeineMeldungen({ onGeaendert }: { onGeaendert: (neu: number) => void }) {
  const [daten, setDaten] = useState<Antwort | null>(null);
  // was beim Öffnen neu war, bleibt markiert, solange die Seite offen ist
  const [warNeu, setWarNeu] = useState<Set<number>>(new Set());
  const [fehler, setFehler] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const r = await api<Antwort>('GET', '/api/meine-meldungen');
        setWarNeu(new Set(r.meldungen.filter((m) => m.neu > 0).map((m) => m.id)));
        const gesehen = r.neu > 0 ? await api<Antwort>('POST', '/api/meine-meldungen/gesehen') : r;
        setDaten(gesehen);
        onGeaendert(gesehen.neu);
      } catch (e) {
        setFehler(e instanceof Error ? e.message : 'Fehler beim Laden');
      }
    })();
    // nur beim Öffnen der Seite laden
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const antworte = async (m: Meldung, text: string) => {
    const r = await api<Antwort>('POST', `/api/meine-meldungen/${m.id}/antwort`, { text });
    setDaten(r);
    onGeaendert(r.neu);
  };

  return (
    <>
      <h1>Meine Meldungen</h1>
      <p className="leise">
        Deine Fehlermeldungen und Ideen fürs Portal. Hat jemand eine Rückfrage, steht sie hier – und die Glocke sagt dir Bescheid. Wünsche zu Lerninhalten stehen hier nicht: Sie kommen ohne deinen Namen an, deshalb kann dazu niemand nachfragen.{' '}
        <HandbuchLink kapitel="fehler">Rückmeldung geben</HandbuchLink>
      </p>
      {fehler && (
        <p className="hinweis fehler" role="alert">
          {fehler}
        </p>
      )}
      {daten === null && !fehler && <p className="leise">Lädt …</p>}
      {daten !== null && daten.meldungen.length === 0 && <p className="karte leise">Du hast noch keine Fehler oder Ideen gemeldet.</p>}
      {daten?.meldungen.map((m) => (
        <article key={m.id} className={`karte meldung ${m.status}`} aria-label={`${m.art === 'idee' ? 'Idee' : 'Fehlermeldung'} Nr. ${m.id}`}>
          <header className="meldung-kopf">
            <span className={`pille ${m.art === 'idee' ? 'blau' : 'rot'}`}>{m.art === 'idee' ? 'Idee' : 'Fehler'}</span>
            <span className="leise">
              {zeit(m.zeit)} · Nr. {m.id}
            </span>
            {warNeu.has(m.id) && <span className="pille violett">Neue Rückfrage</span>}
            <span className={`pille ${m.status === 'offen' ? 'gelb' : 'gruen'}`}>{m.status === 'offen' ? 'Offen' : 'Erledigt'}</span>
          </header>
          <p className="meldung-text">{m.text}</p>
          {m.nachrichten.length > 0 ? (
            <Gespraech
              nachrichten={m.nachrichten}
              personSieht
              knopf="Antwort senden"
              bestaetigung={m.status === 'erledigt' ? 'Antwort gesendet. Die Meldung ist wieder offen.' : 'Antwort gesendet.'}
              onSende={(text) => antworte(m, text)}
            />
          ) : (
            <p className="leise klein">{m.status === 'erledigt' ? 'Erledigt – danke!' : 'Noch keine Rückfrage. Sobald jemand nachfragt, steht es hier.'}</p>
          )}
        </article>
      ))}
    </>
  );
}
