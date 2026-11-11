import { Ladefehler } from '../dialoge';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api, datum } from '../api';
import type { Versionshinweis } from '../api';

/** So viele Versionen stehen einzeln, ältere gesammelt darunter. */
const NEUESTE = 10;

/** `Code` und **fett** aus dem Changelog; alles andere bleibt Text. */
function Inline({ text }: { text: string }): ReactNode {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/).map((t, i) => {
    if (t.startsWith('`') && t.length > 2) return <code key={i}>{t.slice(1, -1)}</code>;
    if (t.startsWith('**') && t.length > 4) return <strong key={i}>{t.slice(2, -2)}</strong>;
    return t;
  });
}

function Eintrag({ e, aktuell }: { e: Versionshinweis; aktuell: boolean }) {
  return (
    <>
      <h2>
        Version {e.version}
        {aktuell && <span className="pille gruen">läuft gerade</span>} <span className="leise klein">{datum(e.datum)}</span>
      </h2>
      {e.gruppen.map((g, i) => (
        <div key={i}>
          {g.titel && <h3>{g.titel}</h3>}
          <ul className="punkte">
            {g.punkte.map((p, j) => (
              <li key={j}>
                <Inline text={p} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

export function Versionen() {
  const [d, setD] = useState<{ version: string; eintraege: Versionshinweis[] } | null>(null);
  const [fehler, setFehler] = useState('');
  useEffect(() => {
    api<{ version: string; eintraege: Versionshinweis[] }>('GET', '/api/versionshinweise').then(setD, (e: Error) => setFehler(e.message));
  }, []);

  if (fehler) return <Ladefehler titel="Versionshinweise" text={fehler} />;
  if (!d) return <p className="leise">Lädt …</p>;
  const aeltere = d.eintraege.slice(NEUESTE);
  return (
    <>
      <h1>Versionshinweise</h1>
      <p className="leise">Was sich mit welcher Version geändert hat. Es läuft Version {d.version}.</p>
      {d.eintraege.length === 0 && <p className="karte leise">Keine Versionshinweise vorhanden.</p>}
      {d.eintraege.slice(0, NEUESTE).map((e) => (
        <section className="karte" key={e.version}>
          <Eintrag e={e} aktuell={e.version === d.version} />
        </section>
      ))}
      {aeltere.length > 0 && (
        <details className="karte">
          <summary>
            Ältere Versionen{' '}
            <span className="leise klein">
              · {aeltere[aeltere.length - 1].version} bis {aeltere[0].version} · {aeltere.length} {aeltere.length === 1 ? 'Version' : 'Versionen'}
            </span>
          </summary>
          {aeltere.map((e) => (
            <Eintrag key={e.version} e={e} aktuell={false} />
          ))}
        </details>
      )}
    </>
  );
}
