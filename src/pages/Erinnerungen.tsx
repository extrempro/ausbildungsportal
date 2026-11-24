import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, datum, plusTage } from '../api';
import type { Rolle } from '../api';
import { Ladefehler, melde, rueckfrage } from '../dialoge';
import { HandbuchLink } from '../handbuchLink';
import { useUngespeichert } from '../router';

/**
 * Erinnerungen (/erinnerungen) für Ausbildungsbeauftragte und Ausbilder – privat, nur für die Person, die sie anlegt.
 * Bezug „vor einem Einsatz“ (wandert mit, wenn der Einsatz verschoben wird) oder ein fester Tag.
 * Fällige Erinnerungen stehen in der Glocke; Teams und E-Mail melden nur, dass etwas fällig ist.
 */
interface Erinnerung {
  id: number;
  azubi: { id: number; anzeigename: string };
  datum: string;
  text: string;
  einsatz: { titel: string; von: string; zeitraum: string } | null;
  tageVorher: number | null;
  erledigt: string | null;
  faellig: boolean;
}

interface Daten {
  heute: string;
  faellig: number;
  erinnerungen: Erinnerung[];
  azubis: { id: number; anzeigename: string; einsaetze: { id: number; titel: string; von: string; zeitraum: string }[] }[];
}

const wannText = (e: Erinnerung, heute: string) => {
  if (e.erledigt) return `erledigt am ${datum(e.erledigt.slice(0, 10))}`;
  if (e.datum === heute) return 'heute';
  if (e.datum < heute) return `seit ${datum(e.datum)}`;
  return datum(e.datum);
};

const bezugText = (e: Erinnerung) =>
  e.einsatz ? `${e.tageVorher === 0 ? 'am ersten Tag' : `${e.tageVorher} ${e.tageVorher === 1 ? 'Tag' : 'Tage'} vor`} dem Einsatz „${e.einsatz.titel}“ (${e.einsatz.zeitraum})` : e.tageVorher !== null ? 'vor einem Einsatz, der nicht mehr im Plan steht' : 'an einem festen Tag';

export function Erinnerungen({ rolle, onGeaendert }: { rolle: Rolle; onGeaendert: (faellig: number) => void }) {
  const [d, setD] = useState<Daten | null>(null);
  const [fehler, setFehler] = useState('');
  const lade = useCallback(async () => {
    try {
      const r = await api<Daten>('GET', '/api/erinnerungen');
      setD(r);
      setFehler('');
      onGeaendert(r.faellig);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Fehler');
    }
  }, [onGeaendert]);
  useEffect(() => void lade(), [lade]);

  if (fehler && !d) return <Ladefehler titel="Erinnerungen" text={fehler} />;
  if (!d) return <p className="leise">Lädt …</p>;
  const faellig = d.erinnerungen.filter((e) => e.faellig);
  const kommend = d.erinnerungen.filter((e) => !e.erledigt && !e.faellig);
  const erledigt = d.erinnerungen.filter((e) => e.erledigt);
  return (
    <>
      <h1>Erinnerungen</h1>
      <p className="leise">
        Merk dir, was du für deine Azubis vorbereiten willst – zum Beispiel eine Woche, bevor jemand {rolle === 'beauftragter' ? 'in deine Abteilung kommt' : 'in eine Abteilung wechselt'}. <strong>Nur du siehst deine Erinnerungen.</strong>{' '}
        <HandbuchLink kapitel="erinnerungen">Erinnerungen</HandbuchLink>
      </p>
      <ErinnerungFormular d={d} onAngelegt={lade} />
      <section className="karte">
        <h2>Fällig{faellig.length > 0 ? ` (${faellig.length})` : ''}</h2>
        {faellig.length === 0 ? <p className="leise">Gerade ist nichts fällig.</p> : <Liste liste={faellig} heute={d.heute} onGeaendert={lade} />}
        <h2>Kommende</h2>
        {kommend.length === 0 ? <p className="leise">Keine kommenden Erinnerungen.</p> : <Liste liste={kommend} heute={d.heute} onGeaendert={lade} />}
      </section>
      {erledigt.length > 0 && (
        <details className="karte">
          <summary>Erledigt ({erledigt.length})</summary>
          <p className="leise klein">Erledigte Erinnerungen löscht das Portal nach 90 Tagen.</p>
          <Liste liste={erledigt} heute={d.heute} onGeaendert={lade} />
        </details>
      )}
    </>
  );
}

function Liste({ liste, heute, onGeaendert }: { liste: Erinnerung[]; heute: string; onGeaendert: () => Promise<void> }) {
  const [fehler, setFehler] = useState('');
  const hake = async (e: Erinnerung, erledigt: boolean) => {
    try {
      await api('PUT', `/api/erinnerungen/${e.id}/erledigt`, { erledigt });
      setFehler('');
      melde(erledigt ? 'Erinnerung erledigt.' : 'Erinnerung wieder offen.');
      await onGeaendert();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Fehler');
    }
  };
  const loesche = async (e: Erinnerung) => {
    if (!(await rueckfrage(`Erinnerung „${e.text}“ löschen?`, { ja: 'Erinnerung löschen', gefahr: true }))) return;
    try {
      await api('DELETE', `/api/erinnerungen/${e.id}`);
      setFehler('');
      melde('Erinnerung gelöscht.');
      await onGeaendert();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Fehler');
    }
  };
  return (
    <>
      {fehler && (
        <p className="hinweis fehler" role="alert">
          {fehler}
        </p>
      )}
      <ul className="erinnerung-liste">
        {liste.map((e) => (
          <li key={e.id} className={`erinnerung${e.erledigt ? ' erledigt' : ''}`}>
            <label className="erinnerung-text">
              <input type="checkbox" checked={!!e.erledigt} onChange={(x) => void hake(e, x.target.checked)} />
              <span>
                <strong>{e.text}</strong>
                <br />
                <span className="leise klein">
                  {e.azubi.anzeigename} · {bezugText(e)}
                </span>
              </span>
            </label>
            <span className={`erinnerung-wann${e.faellig ? ' pille gelb' : ''}`}>{wannText(e, heute)}</span>
            <button type="button" className="knopf schlicht klein gefahr" onClick={() => void loesche(e)}>
              Erinnerung löschen
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function ErinnerungFormular({ d, onAngelegt }: { d: Daten; onAngelegt: () => Promise<void> }) {
  const [azubi, setAzubi] = useState(d.azubis.length === 1 ? String(d.azubis[0].id) : '');
  const [bezug, setBezug] = useState<'einsatz' | 'tag'>('einsatz');
  const [einsatz, setEinsatz] = useState('');
  const [tageVorher, setTageVorher] = useState('7');
  const [tag, setTag] = useState('');
  const [text, setText] = useState('');
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  useUngespeichert(text.trim() !== '' || tag !== '' || einsatz !== '');

  if (d.azubis.length === 0) {
    return (
      <section className="karte">
        <h2>Neue Erinnerung</h2>
        <p className="leise">Du siehst gerade keine Azubis. Erinnerungen lassen sich zu den Azubis anlegen, die dir zugewiesen sind oder die du betreust.</p>
      </section>
    );
  }
  const einsaetze = d.azubis.find((a) => String(a.id) === azubi)?.einsaetze ?? [];
  const gewaehlt = einsaetze.find((e) => String(e.id) === einsatz);
  const tage = Number(tageVorher);
  const tageOk = tageVorher !== '' && Number.isInteger(tage) && tage >= 0 && tage <= 90;

  const sende = async (e: FormEvent) => {
    e.preventDefault();
    setLaeuft(true);
    setFehler('');
    try {
      await api('POST', '/api/erinnerungen', bezug === 'einsatz' ? { azubiId: Number(azubi), text, einsatzId: Number(einsatz), tageVorher: tage } : { azubiId: Number(azubi), text, datum: tag });
      setText('');
      setTag('');
      setEinsatz('');
      melde('Erinnerung angelegt.');
      await onAngelegt();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <section className="karte">
      <h2>Neue Erinnerung</h2>
      <form onSubmit={sende}>
        <div className="reihe">
          <label>
            Azubi
            <select
              value={azubi}
              required
              onChange={(e) => {
                setAzubi(e.target.value);
                setEinsatz('');
              }}
            >
              <option value="">– bitte wählen –</option>
              {d.azubis.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.anzeigename}
                </option>
              ))}
            </select>
          </label>
          <div role="group" aria-label="Wann erinnern?" className="umschalter erinnerung-bezug">
            <button type="button" aria-pressed={bezug === 'einsatz'} onClick={() => setBezug('einsatz')}>
              Vor einem Einsatz
            </button>
            <button type="button" aria-pressed={bezug === 'tag'} onClick={() => setBezug('tag')}>
              An einem Tag
            </button>
          </div>
        </div>
        {bezug === 'einsatz' ? (
          <>
            <div className="reihe">
              <label>
                Einsatz
                <select value={einsatz} required disabled={!azubi} onChange={(e) => setEinsatz(e.target.value)}>
                  <option value="">{!azubi ? 'erst den Azubi wählen' : einsaetze.length === 0 ? 'keine kommenden Einsätze' : '– bitte wählen –'}</option>
                  {einsaetze.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.titel} · {e.zeitraum} (ab {datum(e.von)})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tage vorher
                <input type="number" inputMode="numeric" min={0} max={90} value={tageVorher} required onChange={(e) => setTageVorher(e.target.value)} />
              </label>
            </div>
            <p className="leise klein">
              Wird der Einsatz verschoben, wandert die Erinnerung mit.
              {gewaehlt && tageOk ? ` Erinnert wird am ${datum(plusTage(gewaehlt.von, -tage))}.` : ''}
            </p>
          </>
        ) : (
          <label>
            Tag
            <input type="date" value={tag} min={d.heute} required onChange={(e) => setTag(e.target.value)} />
          </label>
        )}
        <label>
          Woran erinnern?
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={200} required placeholder="z. B. Arbeitsplatz und Zugang vorbereiten" />
        </label>
        {fehler && (
          <p className="hinweis fehler" role="alert">
            {fehler}
          </p>
        )}
        <p className="aktionen links">
          <button className="knopf" disabled={laeuft || (bezug === 'einsatz' && !tageOk)}>
            Erinnerung anlegen
          </button>
        </p>
      </form>
    </section>
  );
}
