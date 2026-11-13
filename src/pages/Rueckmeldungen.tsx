import { useEffect, useState } from 'react';
import { api, datum, ROLLE_TEXT, zeit } from '../api';
import type { Rolle } from '../api';
import { melde, rueckfrage } from '../dialoge';
import { HandbuchLink } from '../handbuchLink';
import { Link } from '../router';

/**
 * Rückmeldungen für Ausbilder: Wünsche der Azubis zu den Lerninhalten (ohne Namen – abhaken und löschen)
 * und Ideen fürs Portal (nur lesen; der Super-Admin bearbeitet sie).
 */
interface Wunsch {
  id: number;
  tag: string;
  paket: string;
  paketTitel: string;
  thema: string;
  text: string;
  status: 'offen' | 'erledigt';
  erledigtAm: string | null;
}
interface Idee {
  id: number;
  zeit: string;
  name: string;
  rolle: Rolle;
  text: string;
  seite: string;
  status: 'offen' | 'erledigt';
}
interface Antwort {
  inhalte: Wunsch[];
  ideen: Idee[];
  offen: number;
}

export function Rueckmeldungen({ onGeaendert }: { onGeaendert: (offen: number) => void }) {
  const [daten, setDaten] = useState<Antwort | null>(null);
  const [fehler, setFehler] = useState('');
  const nimm = (r: Antwort) => {
    setDaten(r);
    setFehler('');
    onGeaendert(r.offen);
  };
  const zeigeFehler = (e: Error) => setFehler(e.message);
  useEffect(() => {
    api<Antwort>('GET', '/api/rueckmeldungen').then(nimm, zeigeFehler);
    // nur beim Öffnen der Seite laden
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setze = (w: Wunsch, status: Wunsch['status']) => api<Antwort>('PATCH', `/api/rueckmeldungen/${w.id}`, { status }).then(nimm, zeigeFehler);
  const loesche = async (w: Wunsch) => {
    if (!(await rueckfrage(`Diesen Wunsch endgültig löschen?\n\n„${w.text.length > 120 ? `${w.text.slice(0, 120)} …` : w.text}“`, { ja: 'Wunsch löschen', gefahr: true }))) return;
    await api<Antwort>('DELETE', `/api/rueckmeldungen/${w.id}`).then((r) => {
      nimm(r);
      melde('Wunsch gelöscht.');
    }, zeigeFehler);
  };

  const wunsch = (w: Wunsch) => (
    <article key={w.id} className={`karte meldung ${w.status}`} aria-label={`Wunsch zu ${w.thema || w.paketTitel} vom ${datum(w.tag)}`}>
      <header className="meldung-kopf">
        <strong>{w.thema || 'Kein bestimmtes Thema'}</strong>
        <span className="leise">
          {w.paketTitel} · {datum(w.tag)}
        </span>
        <span className={`pille ${w.status === 'offen' ? 'gelb' : 'gruen'}`}>{w.status === 'offen' ? 'Offen' : 'Erledigt'}</span>
      </header>
      <p className="meldung-text">{w.text}</p>
      <div className="aktionen links">
        {w.status === 'offen' ? (
          <button type="button" className="knopf klein" onClick={() => void setze(w, 'erledigt')}>
            Als erledigt markieren
          </button>
        ) : (
          <button type="button" className="knopf schlicht klein" onClick={() => void setze(w, 'offen')}>
            Wieder öffnen
          </button>
        )}
        {w.paket && (
          <Link zu={`/lerninhalte/${w.paket}`} className="knopf schlicht klein">
            Lerninhalte ansehen
          </Link>
        )}
        <button type="button" className="knopf schlicht klein gefahr" onClick={() => void loesche(w)}>
          Wunsch löschen
        </button>
      </div>
    </article>
  );

  const offen = daten?.inhalte.filter((w) => w.status === 'offen') ?? [];
  const erledigt = daten?.inhalte.filter((w) => w.status === 'erledigt') ?? [];
  return (
    <>
      <h1>Rückmeldungen</h1>
      <p className="leise">
        Was über „Rückmeldung geben“ (das Symbol mit den zwei Daumen oben neben der Glocke) für euch Ausbilder angekommen ist. <HandbuchLink kapitel="rueckmeldungen">Rückmeldungen lesen</HandbuchLink>
      </p>
      {fehler && (
        <p className="hinweis fehler" role="alert">
          {fehler}
        </p>
      )}
      {daten === null && !fehler && <p className="leise">Lädt …</p>}
      {daten !== null && (
        <>
          <section aria-labelledby="rueck-wuensche">
            <h2 id="rueck-wuensche">Wünsche zu den Lerninhalten{offen.length > 0 ? ` (${offen.length} offen)` : ''}</h2>
            <p className="leise">Azubis schreiben hier, was sie im Lernmodul besser erklärt haben möchten. Die Wünsche kommen ohne Namen an – nachfragen kannst du also nicht. Wenn du die Lerninhalte angepasst hast, markiere den Wunsch als erledigt.</p>
            {daten.inhalte.length === 0 && <p className="karte leise">Noch keine Wünsche.</p>}
            {offen.map(wunsch)}
            {erledigt.length > 0 && (
              <details className="klapp frei meldung-erledigt">
                <summary>Erledigt ({erledigt.length})</summary>
                {erledigt.map(wunsch)}
              </details>
            )}
          </section>
          <section aria-labelledby="rueck-ideen">
            <h2 id="rueck-ideen">Ideen fürs Portal</h2>
            <p className="leise">Zum Mitlesen: Was sich Nutzerinnen und Nutzer am Portal wünschen. Bearbeitet werden die Ideen vom Betreiber des Portals (Super-Admin) – er setzt sie auch auf „erledigt“.</p>
            {daten.ideen.length === 0 ? (
              <p className="karte leise">Noch keine Ideen.</p>
            ) : (
              daten.ideen.map((i) => (
                <article key={i.id} className={`karte meldung ${i.status}`} aria-label={`Idee von ${i.name}`}>
                  <header className="meldung-kopf">
                    <strong>{i.name}</strong>
                    <span className="leise">
                      {ROLLE_TEXT[i.rolle] ?? i.rolle} · {zeit(i.zeit)}
                      {i.seite ? ` · geschrieben auf ${i.seite}` : ''}
                    </span>
                    <span className={`pille ${i.status === 'offen' ? 'gelb' : 'gruen'}`}>{i.status === 'offen' ? 'Offen' : 'Erledigt'}</span>
                  </header>
                  <p className="meldung-text">{i.text}</p>
                </article>
              ))
            )}
          </section>
        </>
      )}
    </>
  );
}
