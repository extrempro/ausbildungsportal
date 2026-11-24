import { Ladefehler, melde } from '../dialoge';
import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { api, datum, ladeHoch } from '../api';
import type { Stammdaten } from '../api';
import { geheZu, Link, useUngespeichert } from '../router';
import { HandbuchLink } from '../handbuchLink';

/**
 * Planung → Schulblöcke → „Plan der Schule einlesen“: PDF hochladen oder Text einfügen, Vorschau prüfen, übernehmen.
 * PDFs liest der Dienst „import“ (Texterkennung, lokales Sprachmodell); Text liest das Portal zur Not auch selbst.
 * Gespeichert wird nur, was hier angehakt und übernommen wird.
 */
interface Zeile {
  klasseText: string;
  klasseId: number | null;
  von: string;
  bis: string;
  titel: string;
  hinweise: string[];
  unsicher: boolean;
  vorgewaehlt: boolean;
  /** Blöcke der Klasse, die sich mit diesem Zeitraum überschneiden – lassen sich ersetzen */
  ueberschneidung: { id: number; von: string; bis: string; titel: string }[];
  /** Azubis der Klasse mit einem eigenen Eintrag „Berufsschule“ in diesen Wochen */
  eigeneEintraege: number;
}
interface Stand {
  id?: string;
  status: 'laeuft' | 'fertig' | 'fehler';
  fortschritt?: number;
  fehler?: string;
  quelle?: 'pdf' | 'texterkennung' | 'text';
  modell?: boolean;
  /** Berufsschule des Auftrags – nach dem Neuladen der Seite wieder gewählt, damit die Klassen zur Auswahl stehen */
  schuleId?: number;
  zeilen?: Zeile[];
}
interface Wahl extends Zeile {
  an: boolean;
  /** die überschneidenden Blöcke ersetzen (nur, solange die erkannte Klasse gewählt ist) */
  ersetzen: boolean;
  /** Klasse, für die die Vorschau gerechnet hat */
  klasseVorschau: number | null;
}

const QUELLE: Record<string, string> = { pdf: 'aus der PDF gelesen', texterkennung: 'per Texterkennung gelesen (Scan) – bitte besonders genau prüfen', text: 'aus dem eingefügten Text gelesen' };

export function SchulplanEinlesen() {
  const [stamm, setStamm] = useState<Stammdaten | null>(null);
  const [dienst, setDienst] = useState<boolean | null>(null);
  const [ladefehler, setLadefehler] = useState('');
  const [schule, setSchule] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [stand, setStand] = useState<Stand | null>(null);
  const [zeilen, setZeilen] = useState<Wahl[]>([]);
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [eigeneEntfernen, setEigeneEntfernen] = useState(false);

  const ladeStamm = useCallback(() => api<Stammdaten>('GET', '/api/stammdaten').then(setStamm), []);
  useEffect(() => {
    Promise.all([ladeStamm(), api<{ dienst: boolean; auftraege: (Stand & { id: string })[] }>('GET', '/api/schulbloecke/einlesen')])
      .then(([, r]) => {
        setDienst(r.dienst);
        // ein angefangener Auftrag (z. B. Seite verlassen, während er lief): dort weitermachen
        const offen = r.auftraege[0];
        if (offen) zeige(offen);
      })
      .catch((e: Error) => setLadefehler(e.message));
  }, [ladeStamm]);
  useEffect(() => {
    if (!schule && stamm?.berufsschulen.length === 1) setSchule(stamm.berufsschulen[0].id);
  }, [stamm, schule]);

  const zeige = (s: Stand) => {
    setStand(s);
    if (s.schuleId) setSchule(s.schuleId);
    if (s.status === 'fertig') setZeilen((s.zeilen ?? []).map((z) => ({ ...z, an: z.vorgewaehlt, ersetzen: false, klasseVorschau: z.klasseId })));
  };

  // solange der Dienst liest: alle zwei Sekunden nachsehen
  useEffect(() => {
    if (stand?.status !== 'laeuft' || !stand.id) return;
    const t = window.setInterval(() => {
      api<Stand>('GET', `/api/schulbloecke/einlesen/${stand.id}`).then(zeige, (e: Error) => setFehler(e.message));
    }, 2000);
    return () => window.clearInterval(t);
  }, [stand?.status, stand?.id]);

  useUngespeichert(zeilen.some((z) => z.an));

  const lies = async (los: () => Promise<Stand>) => {
    setLaeuft(true);
    setFehler('');
    setZeilen([]);
    try {
      zeige(await los());
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLaeuft(false);
    }
  };
  const waehlePdf = (e: ChangeEvent<HTMLInputElement>) => {
    const datei = e.target.files?.[0];
    e.target.value = '';
    if (!datei || !schule) return;
    if (datei.size > 10 * 1024 * 1024) return setFehler(`Die Datei ist ${Math.round(datei.size / 1024 / 1024)} MB groß. Erlaubt sind höchstens 10 MB.`);
    void lies(() => ladeHoch<Stand>(`/api/schulbloecke/einlesen?schule=${schule}`, datei, 'application/pdf'));
  };
  const verwerfe = async () => {
    if (stand?.id) await api('DELETE', `/api/schulbloecke/einlesen/${stand.id}`).catch(() => {});
    setStand(null);
    setZeilen([]);
    setFehler('');
  };
  const setze = (i: number, teil: Partial<Wahl>) => setZeilen((alt) => alt.map((z, j) => (j === i ? { ...z, ...teil } : z)));

  const gewaehlt = zeilen.filter((z) => z.an);
  const ersetzbar = (z: Wahl) => z.ueberschneidung.length > 0 && z.klasseId !== null && z.klasseId === z.klasseVorschau;
  // angehakte Zeilen, bei denen Azubis schon eigene Einträge „Berufsschule“ haben (je Zeile gezählt)
  const eigene = gewaehlt.filter((z) => z.klasseId === z.klasseVorschau).reduce((n, z) => n + z.eigeneEintraege, 0);
  const ohneKlasse = gewaehlt.filter((z) => !z.klasseId).length;
  const uebernimm = async () => {
    setLaeuft(true);
    setFehler('');
    try {
      const r = await api<{ angelegt: number; ersetzt: number; entfernt: number; azubis: number }>('POST', '/api/schulbloecke/uebernehmen', {
        auftrag: stand?.id,
        eigeneEntfernen: eigeneEntfernen && eigene > 0,
        zeilen: gewaehlt.map((z) => ({ klasseId: z.klasseId, von: z.von, bis: z.bis, titel: z.titel, ersetzen: ersetzbar(z) && z.ersetzen ? z.ueberschneidung.map((b) => b.id) : [] })),
      });
      setZeilen([]);
      const teile = [
        r.angelegt || !r.ersetzt ? `${r.angelegt === 1 ? 'ein Schulblock' : `${r.angelegt} Schulblöcke`} übernommen` : '',
        r.ersetzt ? `${r.ersetzt === 1 ? 'ein Block' : `${r.ersetzt} Blöcke`} ersetzt` : '',
        r.entfernt ? `${r.entfernt === 1 ? 'ein eigener Eintrag' : `${r.entfernt} eigene Einträge`} entfernt` : '',
      ].filter(Boolean);
      const satz = teile.join(', ');
      melde(`${satz.charAt(0).toUpperCase()}${satz.slice(1)}${r.azubis ? ` – im Plan von ${r.azubis === 1 ? 'einem Azubi' : `${r.azubis} Azubis`}` : ''}.`);
      geheZu('/planung/schulbloecke', true);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLaeuft(false);
    }
  };

  if (ladefehler) return <Ladefehler titel="Plan der Schule einlesen" text={ladefehler} />;
  const klassen = stamm?.klassen.filter((k) => k.berufsschuleId === schule) ?? [];

  return (
    <>
      <p className="klein nicht-drucken">
        <Link zu="/planung/schulbloecke">← Schulblöcke</Link>
      </p>
      <h1>Plan der Schule einlesen</h1>
      <p className="leise">
        Lade den Plan der Berufsschule als PDF hoch oder füge seinen Text ein. Das Portal schlägt die Schulblöcke je Klasse vor – du prüfst sie und übernimmst, was stimmt.{' '}
        <HandbuchLink kapitel="schulplan-einlesen">Plan der Schule einlesen</HandbuchLink>
      </p>
      <ol className="ablauf-liste">
        <li>
          <span className="ablauf-nr">1</span>
          <span>
            <strong>Einlesen</strong>
            <br />
            <span className="leise klein">PDF hochladen oder Text einfügen.</span>
          </span>
        </li>
        <li>
          <span className="ablauf-nr">2</span>
          <span>
            <strong>Prüfen</strong>
            <br />
            <span className="leise klein">Klasse, Zeitraum und Titel je Zeile ansehen.</span>
          </span>
        </li>
        <li>
          <span className="ablauf-nr">3</span>
          <span>
            <strong>Übernehmen</strong>
            <br />
            <span className="leise klein">Die angehakten Blöcke stehen dann im Plan der Klasse.</span>
          </span>
        </li>
      </ol>

      {!stand && (
        <section className="karte">
          <label>
            Berufsschule
            <select value={schule ?? ''} onChange={(e) => setSchule(e.target.value ? Number(e.target.value) : null)}>
              <option value="">– bitte wählen –</option>
              {stamm?.berufsschulen.map((s) => (
                <option key={s.id} value={s.id}>
                  {[s.name, s.ort].filter(Boolean).join(', ')}
                </option>
              ))}
            </select>
          </label>
          <p className="leise klein">
            Das Portal liest nur die Klassen, die unter <Link zu="/verwaltung/stammdaten">Stammdaten</Link> bei der Schule angelegt sind{klassen.length ? `: ${klassen.map((k) => k.name).join(', ')}` : ' – an dieser Schule gibt es noch keine'}.
          </p>
          <h2>PDF hochladen</h2>
          {dienst === false && (
            <p className="hinweis" role="note">
              <strong>PDFs lesen geht gerade nicht:</strong> Der Dienst „import“, der PDFs und Scans liest, läuft in diesem Portal nicht. Das richtet der Betreiber des Portals ein. Den Text einzufügen geht immer.
            </p>
          )}
          <label>
            PDF wählen (höchstens 10 MB)
            <input type="file" accept="application/pdf" disabled={!schule || !dienst || laeuft} onChange={waehlePdf} />
          </label>
          <h2>Oder Text einfügen</h2>
          <label>
            Text aus dem Plan (aus PDF, Excel, Mail oder Webseite kopiert)
            <textarea rows={8} maxLength={40000} value={text} onChange={(e) => setText(e.target.value)} placeholder={'z. B. FI 25a   31.08.–18.09.2026   09.11.–27.11.2026'} />
          </label>
          <div className="aktionen links">
            <button type="button" className="knopf" disabled={!schule || !text.trim() || laeuft} onClick={() => void lies(() => api<Stand>('POST', '/api/schulbloecke/einlesen', { schuleId: schule, text }))}>
              Text einlesen
            </button>
          </div>
          {!schule && <p className="leise klein">Erst die Berufsschule wählen.</p>}
        </section>
      )}

      {fehler && (
        <p className="hinweis fehler" role="alert">
          {fehler}
        </p>
      )}

      {stand?.status === 'laeuft' && (
        <section className="karte" aria-live="polite">
          <h2>Plan wird gelesen …</h2>
          <progress max={100} value={stand.fortschritt ?? 0} aria-label="Fortschritt" />
          <p className="leise klein">Das kann ein paar Minuten dauern. Du kannst die Seite verlassen – beim nächsten Öffnen geht es hier weiter.</p>
          <button type="button" className="knopf schlicht" onClick={() => void verwerfe()}>
            Einlesen abbrechen
          </button>
        </section>
      )}

      {stand?.status === 'fehler' && (
        <section className="karte">
          <p className="hinweis fehler" role="alert">
            {stand.fehler}
          </p>
          <button type="button" className="knopf schlicht" onClick={() => void verwerfe()}>
            Neu beginnen
          </button>
        </section>
      )}

      {stand?.status === 'fertig' && (
        <section className="karte">
          <h2>Vorschau</h2>
          <p className="leise">
            {zeilen.length === 0
              ? 'Im Plan wurden keine Schulblöcke der angelegten Klassen gefunden. Steht die Klasse im Plan anders da, oder fehlt sie noch? Klassen legst du unter Stammdaten an.'
              : `${zeilen.length === 1 ? 'Ein Zeitraum' : `${zeilen.length} Zeiträume`} ${QUELLE[stand.quelle ?? 'text']}${stand.modell ? ', geordnet vom Sprachmodell' : ''}. Angehakt ist, was sich ohne Weiteres übernehmen lässt.`}
          </p>
          <ul className="liste">
            {zeilen.map((z, i) => (
              <li key={i}>
                <label className="haken">
                  <input type="checkbox" checked={z.an} onChange={(e) => setze(i, { an: e.target.checked })} />
                  <span>
                    <strong>{z.titel}</strong>
                    <span className="leise">
                      {' '}
                      · {datum(z.von)} – {datum(z.bis)}
                    </span>
                  </span>
                </label>
                <div className="reihe">
                  <label>
                    Klasse
                    <select value={z.klasseId ?? ''} onChange={(e) => setze(i, { klasseId: e.target.value ? Number(e.target.value) : null })}>
                      <option value="">– nicht zugeordnet –</option>
                      {klassen.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Titel
                    <input value={z.titel} maxLength={120} onChange={(e) => setze(i, { titel: e.target.value })} />
                  </label>
                  <label>
                    Von
                    <input type="date" value={z.von} onChange={(e) => setze(i, { von: e.target.value })} />
                  </label>
                  <label>
                    Bis
                    <input type="date" value={z.bis} min={z.von} onChange={(e) => setze(i, { bis: e.target.value })} />
                  </label>
                </div>
                {z.hinweise.length > 0 && (
                  <p className="klein">
                    {z.unsicher && <span className="pille gelb">prüfen</span>} <span className="leise">{z.hinweise.join(' · ')}</span>
                  </p>
                )}
                {ersetzbar(z) && (
                  <label className="haken">
                    <input type="checkbox" checked={z.ersetzen} onChange={(e) => setze(i, { ersetzen: e.target.checked, an: e.target.checked || z.an })} />
                    {z.ueberschneidung.length === 1 ? 'Vorhandenen Block ersetzen' : `Die ${z.ueberschneidung.length} vorhandenen Blöcke ersetzen`}
                  </label>
                )}
              </li>
            ))}
          </ul>
          {eigene > 0 && (
            <div className="hinweis">
              <label className="haken">
                <input type="checkbox" checked={eigeneEntfernen} onChange={(e) => setEigeneEntfernen(e.target.checked)} />
                Eigene Einträge „Berufsschule“ der Azubis in diesen Wochen entfernen
              </label>
              <p className="klein">Diese Einträge hängen an keiner Klasse – zum Beispiel von Hand oder über die Sammelplanung eingetragen. Ohne Haken bleiben sie neben dem neuen Block stehen.</p>
            </div>
          )}
          {ohneKlasse > 0 && (
            <p className="hinweis" role="status">
              {ohneKlasse === 1 ? 'Eine angehakte Zeile hat' : `${ohneKlasse} angehakte Zeilen haben`} noch keine Klasse.
            </p>
          )}
          <div className="aktionen links">
            <button type="button" className="knopf" disabled={gewaehlt.length === 0 || ohneKlasse > 0 || laeuft} onClick={() => void uebernimm()}>
              {gewaehlt.length === 1 ? 'Einen Schulblock übernehmen' : `${gewaehlt.length} Schulblöcke übernehmen`}
            </button>
            <button type="button" className="knopf schlicht" onClick={() => void verwerfe()}>
              Verwerfen
            </button>
          </div>
        </section>
      )}
    </>
  );
}
