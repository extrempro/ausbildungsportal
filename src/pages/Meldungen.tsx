import { useEffect, useState } from 'react';
import { api, ROLLE_TEXT, zeit } from '../api';
import type { Rolle } from '../api';

interface Meldung {
  id: number;
  zeit: string;
  name: string;
  rolle: Rolle;
  text: string;
  seite: string;
  version: string;
  browser: string;
  fenster: string;
  technik: string;
  status: 'offen' | 'erledigt';
  erledigtAm: string | null;
}
interface Antwort {
  meldungen: Meldung[];
  offen: number;
}

/** Text zum Weitergeben, z. B. an die Entwicklung – ohne Namen der meldenden Person. */
function alsText(m: Meldung): string {
  return [
    `Fehlermeldung aus dem Ausbildungsportal (Nr. ${m.id}, ${zeit(m.zeit)})`,
    '',
    m.text,
    '',
    `Rolle: ${ROLLE_TEXT[m.rolle] ?? m.rolle}`,
    `Seite: ${m.seite || '–'}`,
    `Version: ${m.version || '–'}`,
    `Fenster: ${m.fenster || '–'}`,
    `Browser: ${m.browser || '–'}`,
    ...(m.technik ? ['Fehlermeldungen des Browsers:', m.technik] : []),
  ].join('\n');
}

export function Meldungen({ onGeaendert }: { onGeaendert: (offen: number) => void }) {
  const [daten, setDaten] = useState<Antwort | null>(null);
  const [fehler, setFehler] = useState('');
  const [kopiert, setKopiert] = useState<number | null>(null);

  const nimm = (r: Antwort) => {
    setDaten(r);
    setFehler('');
    onGeaendert(r.offen);
  };
  const zeigeFehler = (e: Error) => setFehler(e.message);
  useEffect(() => {
    api<Antwort>('GET', '/api/fehlermeldungen').then(nimm, zeigeFehler);
    // nur beim Öffnen der Seite laden
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setze = (m: Meldung, status: Meldung['status']) => api<Antwort>('PATCH', `/api/fehlermeldungen/${m.id}`, { status }).then(nimm, zeigeFehler);
  const loesche = (m: Meldung) => {
    if (window.confirm(`Meldung Nr. ${m.id} von ${m.name} endgültig löschen?`)) void api<Antwort>('DELETE', `/api/fehlermeldungen/${m.id}`).then(nimm, zeigeFehler);
  };
  const kopiere = async (m: Meldung) => {
    try {
      await navigator.clipboard.writeText(alsText(m));
      setKopiert(m.id);
    } catch {
      setFehler('Kopieren ist in diesem Browser nicht möglich. Bitte den Text markieren und von Hand kopieren.');
    }
  };

  const karte = (m: Meldung) => (
    <article key={m.id} className={`karte meldung ${m.status}`} aria-label={`Meldung Nr. ${m.id} von ${m.name}`}>
      <header className="meldung-kopf">
        <strong>{m.name}</strong>
        <span className="leise">
          {ROLLE_TEXT[m.rolle] ?? m.rolle} · {zeit(m.zeit)} · Nr. {m.id}
        </span>
        <span className={`pille ${m.status === 'offen' ? 'gelb' : 'gruen'}`}>{m.status === 'offen' ? 'Offen' : 'Erledigt'}</span>
      </header>
      <p className="meldung-text">{m.text}</p>
      <dl className="meldung-angaben">
        <dt>Seite</dt>
        <dd>{m.seite || '–'}</dd>
        <dt>Version</dt>
        <dd>{m.version || '–'}</dd>
        <dt>Fenster</dt>
        <dd>{m.fenster || '–'}</dd>
        <dt>Browser</dt>
        <dd>{m.browser || '–'}</dd>
        {m.technik && (
          <>
            <dt>Fehler im Browser</dt>
            <dd>
              <pre>{m.technik}</pre>
            </dd>
          </>
        )}
      </dl>
      <div className="knopfzeile">
        {m.status === 'offen' ? (
          <button type="button" className="knopf klein" onClick={() => void setze(m, 'erledigt')}>
            Als erledigt markieren
          </button>
        ) : (
          <button type="button" className="knopf schlicht klein" onClick={() => void setze(m, 'offen')}>
            Wieder öffnen
          </button>
        )}
        <button type="button" className="knopf schlicht klein" onClick={() => void kopiere(m)}>
          {kopiert === m.id ? 'Kopiert' : 'Als Text kopieren'}
        </button>
        <button type="button" className="knopf schlicht klein gefahr" onClick={() => loesche(m)}>
          Löschen
        </button>
      </div>
    </article>
  );

  const offen = daten?.meldungen.filter((m) => m.status === 'offen') ?? [];
  const erledigt = daten?.meldungen.filter((m) => m.status === 'erledigt') ?? [];
  return (
    <>
      <h1>Fehlermeldungen</h1>
      <p className="leise">
        Was Nutzerinnen und Nutzer über „Fehler melden“ geschickt haben. „Als Text kopieren“ erzeugt eine Fassung ohne Namen zum Weitergeben. Meldungen bleiben gespeichert, bis du sie löschst.
      </p>
      {fehler && (
        <p className="hinweis fehler" role="alert">
          {fehler}
        </p>
      )}
      {daten === null && !fehler && <p className="leise">Lädt …</p>}
      {daten !== null && daten.meldungen.length === 0 && <p className="karte leise">Noch keine Meldungen.</p>}
      {offen.length > 0 && (
        <section aria-label="Offene Meldungen">
          <h2>Offen ({offen.length})</h2>
          {offen.map(karte)}
        </section>
      )}
      {erledigt.length > 0 && (
        <details className="meldung-erledigt">
          <summary>Erledigt ({erledigt.length})</summary>
          {erledigt.map(karte)}
        </details>
      )}
    </>
  );
}
