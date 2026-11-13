import { melde, rueckfrage } from '../dialoge';
import { useEffect, useState } from 'react';
import { api, ROLLE_TEXT, zeit } from '../api';
import type { Rolle } from '../api';
import { HandbuchLink } from '../handbuchLink';

interface Meldung {
  id: number;
  art: 'fehler' | 'idee';
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
  hatBild: boolean;
}
interface Antwort {
  meldungen: Meldung[];
  offen: number;
  /** Teams-Benachrichtigung eingerichtet (FEHLER_WEBHOOK_URL) */
  webhook: boolean;
  webhookMitText: boolean;
}

/** Text zum Weitergeben, z. B. an die Entwicklung – ohne Namen der meldenden Person. */
function alsText(m: Meldung): string {
  return [
    `${m.art === 'idee' ? 'Idee fürs Ausbildungsportal' : 'Fehlermeldung aus dem Ausbildungsportal'} (Nr. ${m.id}, ${zeit(m.zeit)})`,
    '',
    m.text,
    '',
    `Rolle: ${ROLLE_TEXT[m.rolle] ?? m.rolle}`,
    `Seite: ${m.seite || '–'}`,
    `Version: ${m.version || '–'}`,
    ...(m.art === 'fehler' ? [`Fenster: ${m.fenster || '–'}`, `Browser: ${m.browser || '–'}`] : []),
    ...(m.hatBild ? ['Bildschirmfoto: im Portal vorhanden (nicht in diesem Text)'] : []),
    ...(m.technik ? ['Fehlermeldungen des Browsers:', m.technik] : []),
  ].join('\n');
}

export function Meldungen({ onGeaendert }: { onGeaendert: (offen: number) => void }) {
  const [daten, setDaten] = useState<Antwort | null>(null);
  const [fehler, setFehler] = useState('');
  const [kopiert, setKopiert] = useState<number | null>(null);
  const [zeige, setZeige] = useState<'alle' | 'fehler' | 'idee'>('alle');
  // geladene Bildschirmfotos je Meldung – erst auf Klick, die Liste selbst enthält keine Bilder
  const [bilder, setBilder] = useState<Record<number, string>>({});
  const [gross, setGross] = useState<number | null>(null);
  const [test, setTest] = useState<{ text: string; fehler: boolean } | null>(null);
  const zeigeBild = (m: Meldung) => api<{ bild: string }>('GET', `/api/fehlermeldungen/${m.id}/bild`).then((r) => setBilder((alt) => ({ ...alt, [m.id]: r.bild })), zeigeFehler);
  const sendeTest = () => {
    setTest(null);
    api('POST', '/api/fehlermeldungen/webhook-test').then(
      () => setTest({ text: 'Die Testnachricht wurde angenommen. Sie sollte jetzt im Teams-Kanal stehen.', fehler: false }),
      (e: Error) => setTest({ text: e.message, fehler: true }),
    );
  };

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
  const loesche = async (m: Meldung) => {
    if (!(await rueckfrage(`Meldung Nr. ${m.id} von ${m.name} endgültig löschen?\n\nText${m.hatBild ? ', Bildschirmfoto' : ''} und technische Angaben sind danach weg.`, { ja: 'Meldung löschen', gefahr: true }))) return;
    await api<Antwort>('DELETE', `/api/fehlermeldungen/${m.id}`).then((r) => {
      nimm(r);
      melde(`Rückmeldung Nr. ${m.id} gelöscht.`);
    }, zeigeFehler);
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
    <article key={m.id} className={`karte meldung ${m.status}`} aria-label={`${m.art === 'idee' ? 'Idee' : 'Fehlermeldung'} Nr. ${m.id} von ${m.name}`}>
      <header className="meldung-kopf">
        <span className={`pille ${m.art === 'idee' ? 'blau' : 'rot'}`}>{m.art === 'idee' ? 'Idee' : 'Fehler'}</span>
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
        {m.art === 'fehler' && (
          <>
            <dt>Fenster</dt>
            <dd>{m.fenster || '–'}</dd>
            <dt>Browser</dt>
            <dd>{m.browser || '–'}</dd>
          </>
        )}
        {m.technik && (
          <>
            <dt>Fehler im Browser</dt>
            <dd>
              <pre>{m.technik}</pre>
            </dd>
          </>
        )}
      </dl>
      {m.hatBild &&
        (bilder[m.id] ? (
          <button type="button" className={`meldung-bild${gross === m.id ? ' gross' : ''}`} title={gross === m.id ? 'Verkleinern' : 'Vergrößern'} onClick={() => setGross(gross === m.id ? null : m.id)}>
            <img src={bilder[m.id]} alt={`Bildschirmfoto zu Meldung Nr. ${m.id} – anklicken zum ${gross === m.id ? 'Verkleinern' : 'Vergrößern'}`} />
          </button>
        ) : (
          <p className="meldung-bild-hinweis">
            <button type="button" className="knopf schlicht klein" onClick={() => void zeigeBild(m)}>
              Bildschirmfoto anzeigen
            </button>
            <span className="leise klein">Kann Inhalte zeigen, die du sonst nicht siehst – etwa Texte aus Berichten.</span>
          </p>
        ))}
      <div className="aktionen links">
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
          Meldung löschen
        </button>
      </div>
    </article>
  );

  const gezeigt = daten?.meldungen.filter((m) => zeige === 'alle' || m.art === zeige) ?? [];
  const offen = gezeigt.filter((m) => m.status === 'offen');
  const erledigt = gezeigt.filter((m) => m.status === 'erledigt');
  const ideen = daten?.meldungen.filter((m) => m.art === 'idee').length ?? 0;
  return (
    <>
      <h1>Rückmeldungen</h1>
      <p className="leise">
        Fehler und Ideen fürs Portal, die über „Rückmeldung geben“ (das Symbol mit den zwei Gesichtern oben in der Leiste) gekommen sind. Sie bleiben gespeichert, bis du sie löschst. Die Ideen lesen auch die Ausbilder; Wünsche zu Lerninhalten gehen nur an sie.{' '}
        <HandbuchLink kapitel="meldungen">Rückmeldungen bearbeiten</HandbuchLink>
      </p>
      {fehler && (
        <p className="hinweis fehler" role="alert">
          {fehler}
        </p>
      )}
      {daten !== null && (
        <section className="karte meldung-teams" aria-label="Benachrichtigung in Teams">
          <div>
            <strong>Benachrichtigung in Teams</strong> <span className={`pille ${daten.webhook ? 'gruen' : 'grau'}`}>{daten.webhook ? 'eingerichtet' : 'nicht eingerichtet'}</span>
            <p className="leise klein">
              {daten.webhook
                ? `Bei jedem neuen Fehler und jeder neuen Idee geht ein Hinweis an den Teams-Kanal: Nummer, Rolle, Seite und ein Link hierher – ohne Namen und ohne Bild${daten.webhookMitText ? ', mit dem Text der Meldung' : ', ohne den Text der Meldung'}.`
                : 'Wer den Server betreibt, trägt dafür in der .env die Adresse eines Teams-Workflows als FEHLER_WEBHOOK_URL ein. Die Anleitung steht in der README.'}
            </p>
          </div>
          {daten.webhook && (
            <button type="button" className="knopf schlicht klein" onClick={sendeTest}>
              Testnachricht senden
            </button>
          )}
          {test && (
            <p className={`hinweis ${test.fehler ? 'fehler' : 'gut'}`} role={test.fehler ? 'alert' : 'status'}>
              {test.text}
            </p>
          )}
        </section>
      )}
      {daten === null && !fehler && <p className="leise">Lädt …</p>}
      {daten !== null && daten.meldungen.length === 0 && <p className="karte leise">Noch keine Rückmeldungen.</p>}
      {daten !== null && ideen > 0 && ideen < daten.meldungen.length && (
        <label className="meldung-filter">
          Zeigen
          <select value={zeige} onChange={(e) => setZeige(e.target.value as typeof zeige)}>
            <option value="alle">Fehler und Ideen</option>
            <option value="fehler">nur Fehler</option>
            <option value="idee">nur Ideen</option>
          </select>
        </label>
      )}
      {offen.length > 0 && (
        <section aria-label="Offene Meldungen">
          <h2>Offen ({offen.length})</h2>
          {offen.map(karte)}
        </section>
      )}
      {erledigt.length > 0 && (
        <details className="klapp frei meldung-erledigt">
          <summary>Erledigt ({erledigt.length})</summary>
          {erledigt.map(karte)}
        </details>
      )}
    </>
  );
}
