import { melde, rueckfrage } from '../dialoge';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import { useEingaben } from '../router';
import type { Beruf, Berufsschule, Stammdaten as Daten } from '../api';
import { HandbuchLink } from '../handbuchLink';

type Meldung = { text: string; fehler: boolean } | null;

function Zeile({ m }: { m: Meldung }) {
  if (!m) return null;
  return (
    <p className={`hinweis ${m.fehler ? 'fehler' : 'gut'}`} role={m.fehler ? 'alert' : 'status'}>
      {m.text}
    </p>
  );
}

function BerufFormular({ beruf, onFertig }: { beruf?: Beruf; onFertig: (text: string) => Promise<void> }) {
  const eingaben = useEingaben();
  const [fehler, setFehler] = useState('');
  const sende = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const body = { bezeichnung: f.get('bezeichnung'), fachrichtung: f.get('fachrichtung'), regeldauerMonate: f.get('regeldauer') };
    try {
      if (beruf) await api('PATCH', `/api/stammdaten/berufe/${beruf.id}`, body);
      else await api('POST', '/api/stammdaten/berufe', body);
      if (!beruf) form.reset();
      eingaben.gespeichert();
      setFehler('');
      await onFertig(beruf ? 'Beruf gespeichert.' : 'Beruf angelegt.');
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Fehler');
    }
  };
  const loesche = async () => {
    if (!beruf || !(await rueckfrage(`Beruf „${beruf.bezeichnung}“ für das ganze Portal löschen?\n\nEr steht dann auch anderen Ausbildern nicht mehr zur Auswahl.`, { ja: 'Beruf löschen', gefahr: true }))) return;
    try {
      await api('DELETE', `/api/stammdaten/berufe/${beruf.id}`);
      await onFertig('Beruf gelöscht.');
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Fehler');
    }
  };
  return (
    <form className="reihe" onSubmit={sende} onInput={eingaben.merke}>
      <label>
        Bezeichnung
        <input name="bezeichnung" defaultValue={beruf?.bezeichnung} maxLength={150} placeholder="z. B. Fachinformatiker/-in" required />
      </label>
      <label>
        Fachrichtung (falls vorhanden)
        <input name="fachrichtung" defaultValue={beruf?.fachrichtung} maxLength={100} placeholder="z. B. Systemintegration" />
      </label>
      <label>
        Regeldauer in Monaten
        <input name="regeldauer" type="number" min={12} max={60} step={1} defaultValue={beruf?.regeldauer_monate ?? 36} list="regeldauern" required />
      </label>
      <div className="aktionen links">
        <button className={beruf ? 'knopf schlicht' : 'knopf'}>{beruf ? 'Beruf speichern' : 'Beruf anlegen'}</button>
        {beruf && (
          <button type="button" className="knopf schlicht gefahr" onClick={() => void loesche()}>
            Beruf löschen
          </button>
        )}
      </div>
      {fehler && (
        <p className="hinweis fehler ganz" role="alert">
          {fehler}
        </p>
      )}
    </form>
  );
}

function SchulFormular({ schule, daten, onFertig }: { schule?: Berufsschule; daten: Daten; onFertig: (text: string) => Promise<void> }) {
  const eingaben = useEingaben();
  const [fehler, setFehler] = useState('');
  const sende = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const body = { name: f.get('name'), ort: f.get('ort'), bundesland: f.get('bundesland'), form: f.get('form') };
    try {
      if (schule) await api('PATCH', `/api/stammdaten/berufsschulen/${schule.id}`, body);
      else await api('POST', '/api/stammdaten/berufsschulen', body);
      if (!schule) form.reset();
      eingaben.gespeichert();
      setFehler('');
      await onFertig(schule ? 'Berufsschule gespeichert.' : 'Berufsschule angelegt.');
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Fehler');
    }
  };
  const loesche = async () => {
    if (!schule || !(await rueckfrage(`Berufsschule „${schule.name}“ für das ganze Portal löschen?\n\nSie steht dann auch anderen Ausbildern nicht mehr zur Auswahl.`, { ja: 'Berufsschule löschen', gefahr: true }))) return;
    try {
      await api('DELETE', `/api/stammdaten/berufsschulen/${schule.id}`);
      await onFertig('Berufsschule gelöscht.');
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Fehler');
    }
  };
  return (
    <form className="reihe" onSubmit={sende} onInput={eingaben.merke}>
      <label>
        Name
        <input name="name" defaultValue={schule?.name} maxLength={150} required />
      </label>
      <label>
        Ort
        <input name="ort" defaultValue={schule?.ort} maxLength={100} />
      </label>
      <label>
        Bundesland (für die Ferien)
        <select name="bundesland" defaultValue={schule?.bundesland ?? daten.betrieb.bundesland} required>
          <option value="">– bitte wählen –</option>
          {daten.bundeslaender.map((b) => (
            <option key={b.kuerzel} value={b.kuerzel}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Unterricht
        <select name="form" defaultValue={schule?.form ?? 'block'}>
          <option value="block">Blockunterricht</option>
          <option value="teilzeit">Teilzeit (feste Wochentage)</option>
        </select>
      </label>
      <div className="aktionen links">
        <button className={schule ? 'knopf schlicht' : 'knopf'}>{schule ? 'Berufsschule speichern' : 'Berufsschule anlegen'}</button>
        {schule && (
          <button type="button" className="knopf schlicht gefahr" onClick={() => void loesche()}>
            Berufsschule löschen
          </button>
        )}
      </div>
      {fehler && (
        <p className="hinweis fehler ganz" role="alert">
          {fehler}
        </p>
      )}
    </form>
  );
}

export function Stammdaten() {
  const eingaben = useEingaben();
  const [daten, setDaten] = useState<Daten | null>(null);
  const [meldung, setMeldung] = useState<Meldung>(null);

  const lade = useCallback(async () => setDaten(await api<Daten>('GET', '/api/stammdaten')), []);
  useEffect(() => {
    lade().catch((e: Error) => setMeldung({ text: e.message, fehler: true }));
  }, [lade]);

  const fertig = async (text: string) => {
    await lade();
    setMeldung(null);
    melde(text);
  };

  const speichereBetrieb = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await api('PUT', '/api/stammdaten/betrieb', { name: f.get('name'), anschrift: f.get('anschrift'), bundesland: f.get('bundesland') });
      eingaben.gespeichert();
      await fertig('Angaben zum Betrieb gespeichert.');
    } catch (err) {
      setMeldung({ text: err instanceof Error ? err.message : 'Fehler', fehler: true });
    }
  };

  if (!daten) return meldung ? <Zeile m={meldung} /> : <p className="leise">Lädt …</p>;

  return (
    <>
      <h1>Stammdaten</h1>
      <p className="leise">Betrieb, Ausbildungsberufe und Berufsschulen. Sie stehen später im Kopf der Berichte und bestimmen Dauer, Feiertage und Ferien.{' '}
        <HandbuchLink kapitel="stammdaten">Stammdaten pflegen</HandbuchLink>
      </p>
      <p className="hinweis" role="note">
        <strong>Diese Stammdaten gelten für das ganze Portal</strong> – für alle Azubis und alle Ausbilder, nicht nur für deine eigenen. Bitte nichts ändern oder löschen, nur weil du es selbst gerade nicht brauchst: Andere Ausbilder
        arbeiten mit denselben Berufen und Berufsschulen.
      </p>
      <Zeile m={meldung} />
      <datalist id="regeldauern">
        <option value="24" />
        <option value="36" />
        <option value="42" />
      </datalist>

      <section className="karte">
        <h2>Betrieb</h2>
        <form className="reihe" onSubmit={speichereBetrieb} onInput={eingaben.merke}>
          <label>
            Name
            <input name="name" defaultValue={daten.betrieb.name} maxLength={150} />
          </label>
          <label>
            Anschrift
            <input name="anschrift" defaultValue={daten.betrieb.anschrift} maxLength={300} placeholder="Straße, PLZ Ort" />
          </label>
          <label>
            Bundesland (für die Feiertage)
            <select name="bundesland" defaultValue={daten.betrieb.bundesland}>
              <option value="">– bitte wählen –</option>
              {daten.bundeslaender.map((b) => (
                <option key={b.kuerzel} value={b.kuerzel}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <div>
            <button className="knopf">Betrieb speichern</button>
          </div>
        </form>
      </section>

      <section className="karte">
        <h2>Ausbildungsberufe</h2>
        {daten.berufe.length === 0 && <p className="leise">Noch kein Beruf angelegt.</p>}
        {daten.berufe.map((b) => (
          <BerufFormular key={`${b.id}-${b.bezeichnung}-${b.fachrichtung}-${b.regeldauer_monate}`} beruf={b} onFertig={fertig} />
        ))}
        <h3>Neuer Beruf</h3>
        <BerufFormular onFertig={fertig} />
      </section>

      <section className="karte">
        <h2>Berufsschulen</h2>
        {daten.berufsschulen.length === 0 && <p className="leise">Noch keine Berufsschule angelegt.</p>}
        {daten.berufsschulen.map((s) => (
          <SchulFormular key={`${s.id}-${s.name}-${s.ort}-${s.bundesland}-${s.form}`} schule={s} daten={daten} onFertig={fertig} />
        ))}
        <h3>Neue Berufsschule</h3>
        {/* key: Bundesland des Betriebs als Vorbelegung übernehmen, sobald es gespeichert ist */}
        <SchulFormular key={`neu-${daten.betrieb.bundesland}`} daten={daten} onFertig={fertig} />
      </section>
    </>
  );
}
