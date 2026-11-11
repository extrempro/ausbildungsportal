import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, ROLLE_TEXT } from './api';
import type { Rolle } from './api';
import { melde, rueckfrage } from './dialoge';
import { HandbuchLink } from './handbuchLink';
import { useUngespeichert } from './router';

/**
 * Abteilungen in den Stammdaten: Name, Beauftragte und freiwillige Stellvertretung.
 * Gehört ein Einsatz im Ausbildungsplan zu einer Abteilung, sind diese Personen für die Dauer automatisch zuständig.
 */
export interface Abteilung {
  id: number;
  name: string;
  einsaetze: number;
  beauftragte: { id: number; anzeigename: string; aktiv: boolean }[];
  stellvertretung: { id: number; anzeigename: string; aktiv: boolean }[];
}
interface Person {
  id: number;
  anzeigename: string;
  rolle: Rolle;
}

let zwischen: Abteilung[] | null = null;
/** Die Abteilungen für Auswahlfelder (Ausbildungsplan, Sammelplanung). Lädt einmal und merkt sich das Ergebnis. */
export function useAbteilungen(aktiv: boolean): Abteilung[] {
  const [liste, setListe] = useState<Abteilung[]>(zwischen ?? []);
  useEffect(() => {
    if (!aktiv) return;
    api<{ abteilungen: Abteilung[] }>('GET', '/api/abteilungen').then(
      (r) => setListe((zwischen = r.abteilungen)),
      () => undefined,
    );
  }, [aktiv]);
  return liste;
}

const namen = (l: { anzeigename: string; aktiv: boolean }[]) => l.map((p) => (p.aktiv ? p.anzeigename : `${p.anzeigename} (gesperrt)`)).join(', ');

function Formular({ a, personen, onFertig, onAbbruch }: { a: Abteilung | null; personen: Person[]; onFertig: (text: string) => Promise<void>; onAbbruch: () => void }) {
  const [name, setName] = useState(a?.name ?? '');
  const [bea, setBea] = useState<number[]>(a?.beauftragte.map((p) => p.id) ?? []);
  const [stv, setStv] = useState<number[]>(a?.stellvertretung.map((p) => p.id) ?? []);
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  useUngespeichert(name !== (a?.name ?? '') || JSON.stringify(bea) !== JSON.stringify(a?.beauftragte.map((p) => p.id) ?? []) || JSON.stringify(stv) !== JSON.stringify(a?.stellvertretung.map((p) => p.id) ?? []));
  const schalte = (liste: number[], setze: (l: number[]) => void, id: number, an: boolean) => setze(an ? [...liste, id] : liste.filter((x) => x !== id));

  const sende = async (ev: FormEvent) => {
    ev.preventDefault();
    setLaeuft(true);
    setFehler('');
    try {
      const body = { name, beauftragte: bea, stellvertretung: stv.filter((i) => !bea.includes(i)) };
      if (a) await api('PUT', `/api/abteilungen/${a.id}`, body);
      else await api('POST', '/api/abteilungen', body);
      await onFertig(a ? 'Abteilung gespeichert.' : 'Abteilung angelegt.');
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <form className="abt-formular" onSubmit={(ev) => void sende(ev)}>
      <label>
        Name der Abteilung
        <input value={name} onChange={(ev) => setName(ev.target.value)} maxLength={80} required autoFocus placeholder="z. B. IT-Betrieb" />
      </label>
      <div className="abt-wahl">
        <fieldset>
          <legend>Beauftragte</legend>
          {personen.map((p) => (
            <label key={p.id} className="haken">
              <input type="checkbox" checked={bea.includes(p.id)} onChange={(ev) => schalte(bea, setBea, p.id, ev.target.checked)} />
              {p.anzeigename} <span className="leise klein">({ROLLE_TEXT[p.rolle]})</span>
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Stellvertretung (freiwillig)</legend>
          {personen.map((p) => (
            <label key={p.id} className="haken">
              <input type="checkbox" checked={stv.includes(p.id) && !bea.includes(p.id)} disabled={bea.includes(p.id)} onChange={(ev) => schalte(stv, setStv, p.id, ev.target.checked)} />
              {p.anzeigename} <span className="leise klein">({ROLLE_TEXT[p.rolle]})</span>
            </label>
          ))}
        </fieldset>
      </div>
      {personen.length === 0 && <p className="leise">Es gibt noch keine Ausbildungsbeauftragten oder weiteren Ausbilder.</p>}
      {a && a.einsaetze > 0 && (
        <p className="hinweis" role="note">
          Diese Abteilung steht in {a.einsaetze} {a.einsaetze === 1 ? 'Einsatz' : 'Einsätzen'}. Änderst du die Personen, ändern sich dort sofort die Zuweisungen.
        </p>
      )}
      {fehler && (
        <p className="hinweis fehler" role="alert">
          {fehler}
        </p>
      )}
      <p className="aktionen links">
        <button className="knopf" disabled={laeuft}>
          {a ? 'Abteilung speichern' : 'Abteilung anlegen'}
        </button>
        <button type="button" className="knopf schlicht" onClick={onAbbruch}>
          Abbrechen
        </button>
      </p>
    </form>
  );
}

export function AbteilungenBereich() {
  const [d, setD] = useState<{ abteilungen: Abteilung[]; personen: Person[] } | null>(null);
  const [fehler, setFehler] = useState('');
  // null = nichts offen, 0 = neue Abteilung, sonst die Nummer der bearbeiteten
  const [offen, setOffen] = useState<number | null>(null);
  const lade = useCallback(async () => {
    try {
      const r = await api<{ abteilungen: Abteilung[]; personen: Person[] }>('GET', '/api/abteilungen');
      setD(r);
      zwischen = r.abteilungen;
      setFehler('');
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Fehler');
    }
  }, []);
  useEffect(() => void lade(), [lade]);
  const fertig = async (text: string) => {
    setOffen(null);
    await lade();
    melde(text);
  };
  const loesche = async (a: Abteilung) => {
    if (!(await rueckfrage(`Abteilung „${a.name}“ löschen?\n\nSie steht danach im Ausbildungsplan nicht mehr zur Auswahl.`, { ja: 'Abteilung löschen', gefahr: true }))) return;
    try {
      await api('DELETE', `/api/abteilungen/${a.id}`);
      await fertig('Abteilung gelöscht.');
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Fehler');
    }
  };

  return (
    <section className="karte">
      <h2>Abteilungen</h2>
      <p className="leise">
        Abteilungen, in denen Azubis eingesetzt werden, mit den Beauftragten vor Ort. Trägst du im Ausbildungsplan einen Einsatz in einer Abteilung ein, sind ihre Beauftragten und die Stellvertretung für diese Zeit automatisch zuständig.{' '}
        <HandbuchLink kapitel="abteilungen">Abteilungen und Einsätze</HandbuchLink>
      </p>
      {fehler && (
        <p className="hinweis fehler" role="alert">
          {fehler}
        </p>
      )}
      {!d ? (
        <p className="leise">Lädt …</p>
      ) : (
        <>
          {d.abteilungen.length === 0 && offen === null && <p className="leise">Noch keine Abteilung angelegt.</p>}
          <ul className="abt-liste">
            {d.abteilungen.map((a) =>
              offen === a.id ? (
                <li key={a.id}>
                  <Formular a={a} personen={d.personen} onFertig={fertig} onAbbruch={() => setOffen(null)} />
                </li>
              ) : (
                <li key={a.id} className="abt-zeile">
                  <span>
                    <strong>{a.name}</strong>
                    <span className="abt-leute">
                      Beauftragte: {a.beauftragte.length ? namen(a.beauftragte) : 'niemand hinterlegt'}
                      {a.stellvertretung.length > 0 && ` · Stellvertretung: ${namen(a.stellvertretung)}`}
                      {a.einsaetze > 0 && ` · in ${a.einsaetze} ${a.einsaetze === 1 ? 'Einsatz' : 'Einsätzen'}`}
                    </span>
                  </span>
                  <span className="abt-knoepfe">
                    <button type="button" className="knopf schlicht klein" onClick={() => setOffen(a.id)} aria-label={`Abteilung bearbeiten: ${a.name}`}>
                      Bearbeiten
                    </button>
                    <button type="button" className="knopf schlicht klein gefahr" disabled={a.einsaetze > 0} title={a.einsaetze > 0 ? 'Wird in Einsätzen verwendet' : undefined} onClick={() => void loesche(a)} aria-label={`Abteilung löschen: ${a.name}`}>
                      Löschen
                    </button>
                  </span>
                </li>
              ),
            )}
          </ul>
          {offen === 0 ? (
            <Formular a={null} personen={d.personen} onFertig={fertig} onAbbruch={() => setOffen(null)} />
          ) : (
            offen === null && (
              <p className="aktionen links">
                <button type="button" className="knopf schlicht" onClick={() => setOffen(0)}>
                  Abteilung anlegen
                </button>
              </p>
            )
          )}
        </>
      )}
    </section>
  );
}
