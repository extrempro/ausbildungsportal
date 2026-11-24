import { Ladefehler, melde } from '../dialoge';
import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { api, ApiFehler, datum, h, ladeHoch, plusTage } from '../api';
import { Link, useUngespeichert } from '../router';
import { HandbuchLink } from '../handbuchLink';

/**
 * Berichtsheft → „Alte Berichte einlesen“ (nur der Azubi selbst): alte Berichte als PDF hochladen (auch eingescannt)
 * oder ihren Text einfügen, die erkannten Wochen prüfen, als Entwürfe übernehmen und dann einreichen.
 * Der Ausbilder zeichnet sie wie gewohnt ab und sieht, dass sie eingelesen sind.
 */
interface Eintrag {
  text: string;
  stunden: number;
  tag?: string;
}
interface Woche {
  montag: string;
  kw: number;
  jahr: number;
  form: 'woche' | 'tag';
  betrieb: Eintrag[];
  unterweisung: Eintrag[];
  schule: Eintrag[];
  seiten: number[];
  stunden: number;
  stand: 'neu' | 'leer' | 'vorhanden' | 'ausserhalb' | 'zukunft';
  hinweise: string[];
  unsicher: boolean;
  vorgewaehlt: boolean;
}
interface Stand {
  id?: string;
  status: 'laeuft' | 'fertig' | 'fehler';
  fortschritt?: number;
  fehler?: string;
  quelle?: 'pdf' | 'texterkennung' | 'text';
  modell?: boolean;
  seitenDabei?: boolean;
  wochen?: Woche[];
}
interface Entwurf {
  montag: string;
  kw: number;
  jahr: number;
  stunden: number;
}

const QUELLE: Record<string, string> = { pdf: 'aus der PDF gelesen', texterkennung: 'per Texterkennung gelesen (Scan) – bitte besonders genau prüfen', text: 'aus dem eingefügten Text gelesen' };
const TEIL_TEXT = { betrieb: 'Betriebliche Tätigkeiten', unterweisung: 'Unterweisungen', schule: 'Berufsschule' } as const;
const TAG = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function tagKurz(montag: string, tag: string | undefined): string {
  if (!tag) return '';
  const n = Math.round((Date.parse(`${tag}T00:00:00Z`) - Date.parse(`${montag}T00:00:00Z`)) / 86_400_000);
  return `${TAG[n] ?? ''} `;
}

export function BerichteEinlesen({ azubiId }: { azubiId: number }) {
  const basis = `/api/azubis/${azubiId}/einlesen`;
  const [dienst, setDienst] = useState<boolean | null>(null);
  const [ladefehler, setLadefehler] = useState('');
  const [text, setText] = useState('');
  const [stand, setStand] = useState<Stand | null>(null);
  const [wahl, setWahl] = useState<Set<string>>(new Set());
  const [entwuerfe, setEntwuerfe] = useState<Entwurf[]>([]);
  const [einreichen, setEinreichen] = useState<Set<string>>(new Set());
  const [fehler, setFehler] = useState<{ text: string; unterschrift?: boolean; ort?: 'einreichen' } | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const ladeEntwuerfe = useCallback(
    () =>
      api<{ wochen: Entwurf[] }>('GET', `/api/azubis/${azubiId}/einlesen-entwuerfe`).then((r) => {
        setEntwuerfe(r.wochen);
        setEinreichen(new Set(r.wochen.filter((w) => w.stunden > 0).map((w) => w.montag)));
      }),
    [azubiId],
  );

  const zeige = (s: Stand) => {
    setStand(s);
    if (s.status === 'fertig') setWahl(new Set((s.wochen ?? []).filter((w) => w.vorgewaehlt).map((w) => w.montag)));
  };

  useEffect(() => {
    Promise.all([api<{ dienst: boolean; auftraege: (Stand & { id: string })[] }>('GET', basis), ladeEntwuerfe()])
      .then(([r]) => {
        setDienst(r.dienst);
        // ein angefangener Auftrag (z. B. Seite verlassen, während er lief): dort weitermachen
        if (r.auftraege[0]) zeige(r.auftraege[0]);
      })
      .catch((e: Error) => setLadefehler(e.message));
  }, [basis, ladeEntwuerfe]);

  // solange der Dienst liest: alle zwei Sekunden nachsehen
  useEffect(() => {
    if (stand?.status !== 'laeuft' || !stand.id) return;
    const t = window.setInterval(() => {
      api<Stand>('GET', `${basis}/${stand.id}`).then(zeige, (e: Error) => setFehler({ text: e.message }));
    }, 2000);
    return () => window.clearInterval(t);
  }, [stand?.status, stand?.id, basis]);

  useUngespeichert(stand?.status === 'fertig' && wahl.size > 0);

  const fang = (e: unknown, ort?: 'einreichen') => setFehler({ text: e instanceof Error ? e.message : 'Fehler', unterschrift: e instanceof ApiFehler && e.code === 'unterschrift', ort });
  const lies = async (los: () => Promise<Stand>) => {
    setLaeuft(true);
    setFehler(null);
    try {
      zeige(await los());
    } catch (e) {
      fang(e);
    } finally {
      setLaeuft(false);
    }
  };
  const waehlePdf = (e: ChangeEvent<HTMLInputElement>) => {
    const datei = e.target.files?.[0];
    e.target.value = '';
    if (!datei) return;
    if (datei.size > 10 * 1024 * 1024) return setFehler({ text: `Die Datei ist ${Math.round(datei.size / 1024 / 1024)} MB groß. Erlaubt sind höchstens 10 MB – teil sie auf und lies sie nacheinander ein.` });
    void lies(() => ladeHoch<Stand>(basis, datei, 'application/pdf'));
  };
  const verwerfe = async () => {
    if (stand?.id) await api('DELETE', `${basis}/${stand.id}`).catch(() => {});
    setStand(null);
    setWahl(new Set());
    setFehler(null);
  };
  const schalte = (menge: Set<string>, setze: (s: Set<string>) => void, montag: string) => {
    const neu = new Set(menge);
    if (neu.has(montag)) neu.delete(montag);
    else neu.add(montag);
    setze(neu);
  };

  const wochen = stand?.wochen ?? [];
  const gewaehlt = wochen.filter((w) => wahl.has(w.montag));
  const uebernimm = async () => {
    setLaeuft(true);
    setFehler(null);
    try {
      const r = await api<{ angelegt: number; ohneStunden: number }>('POST', `${basis}/uebernehmen`, {
        auftrag: stand?.id,
        wochen: gewaehlt.map((w) => ({ montag: w.montag, form: w.form, betrieb: w.betrieb, unterweisung: w.unterweisung, schule: w.schule, seiten: w.seiten })),
      });
      setStand(null);
      setWahl(new Set());
      setText('');
      await ladeEntwuerfe();
      melde(`${r.angelegt === 1 ? 'Ein Bericht' : `${r.angelegt} Berichte`} als Entwurf übernommen.${r.ohneStunden ? ' Bei einigen fehlen noch die Stunden.' : ''}`);
    } catch (e) {
      fang(e);
    } finally {
      setLaeuft(false);
    }
  };
  const reicheEin = async () => {
    setLaeuft(true);
    setFehler(null);
    try {
      const r = await api<{ eingereicht: number }>('POST', `${basis}/einreichen`, { montage: [...einreichen] });
      await ladeEntwuerfe();
      melde(`${r.eingereicht === 1 ? 'Ein Bericht' : `${r.eingereicht} Berichte`} eingereicht. Dein Ausbilder zeichnet sie jetzt ab.`);
    } catch (e) {
      fang(e, 'einreichen');
    } finally {
      setLaeuft(false);
    }
  };

  if (ladefehler) return <Ladefehler titel="Alte Berichte einlesen" text={ladefehler} />;
  // Fehler stehen dort, wo gehandelt wurde: beim Einreichen unten, sonst beim Einlesen bzw. in der Vorschau
  const fehlerHier = (ort?: 'einreichen') =>
    fehler && fehler.ort === ort ? (
      <p className="hinweis fehler" role="alert">
        {fehler.text} {fehler.unterschrift && <Link zu="/konto">Zur Unterschrift</Link>}
      </p>
    ) : null;

  return (
    <>
      <p className="klein nicht-drucken">
        <Link zu="/berichtsheft">← Berichtsheft</Link>
      </p>
      <h1>Alte Berichte einlesen</h1>
      <p className="leise">
        Du hast dein Berichtsheft bisher auf Papier oder in einer Datei geführt? Lade es als PDF hoch – auch eingescannt – oder füge den Text ein. Das Portal erkennt die Wochen und macht daraus Entwürfe. Du prüfst sie, reichst sie ein, und dein Ausbilder zeichnet sie ab.{' '}
        <HandbuchLink kapitel="berichte-einlesen">Alte Berichte einlesen</HandbuchLink>
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
            <strong>Prüfen und übernehmen</strong>
            <br />
            <span className="leise klein">Die angehakten Wochen werden Entwürfe.</span>
          </span>
        </li>
        <li>
          <span className="ablauf-nr">3</span>
          <span>
            <strong>Einreichen</strong>
            <br />
            <span className="leise klein">Dein Ausbilder vergleicht und zeichnet ab.</span>
          </span>
        </li>
      </ol>

      {(!stand || stand.status === 'laeuft') && fehlerHier()}

      {!stand && (
        <section className="karte">
          <h2>PDF hochladen</h2>
          {dienst === false && (
            <p className="hinweis" role="note">
              <strong>PDFs lesen geht gerade nicht:</strong> Der Dienst „import“, der PDFs und Scans liest, läuft in diesem Portal nicht. Das richtet der Betreiber des Portals ein. Den Text einzufügen geht immer.
            </p>
          )}
          <label>
            PDF wählen (höchstens 10 MB, 40 Seiten)
            <input type="file" accept="application/pdf" disabled={!dienst || laeuft} onChange={waehlePdf} />
          </label>
          <p className="leise klein">Handschrift liest die Texterkennung oft nur teilweise. Die Originalseite hängt danach am Bericht – du verbesserst den Text im Entwurf.</p>
          <h2>Oder Text einfügen</h2>
          <label>
            Text deiner alten Berichte (z. B. aus Word kopiert)
            <textarea rows={8} maxLength={60000} value={text} onChange={(e) => setText(e.target.value)} placeholder={'z. B. Woche vom 07.09.2026 bis 11.09.2026\nBetriebliche Tätigkeiten\nArbeitsplätze eingerichtet   8'} />
          </label>
          <div className="aktionen links">
            <button type="button" className="knopf" disabled={!text.trim() || laeuft} onClick={() => void lies(() => api<Stand>('POST', basis, { text }))}>
              Text einlesen
            </button>
          </div>
        </section>
      )}

      {stand?.status === 'laeuft' && (
        <section className="karte" aria-live="polite">
          <h2>Berichte werden gelesen …</h2>
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
            {wochen.length === 0
              ? 'Es wurden keine Wochen erkannt. Steht bei jedem Bericht ein Zeitraum („Woche vom … bis …“) oder die Kalenderwoche? Sonst schreib die Berichte im Berichtsheft.'
              : `${wochen.length === 1 ? 'Eine Woche' : `${wochen.length} Wochen`} ${QUELLE[stand.quelle ?? 'text']}${stand.modell ? ', geordnet mit dem Sprachmodell' : ''}. Angehakt ist, was sich übernehmen lässt.${stand.seitenDabei ? ' Die Originalseiten hängen danach am Bericht.' : ''}`}
          </p>
          <ul className="liste">
            {wochen.map((w) => (
              <li key={w.montag}>
                <label className="haken">
                  <input type="checkbox" checked={wahl.has(w.montag)} disabled={w.stand !== 'neu' && w.stand !== 'leer'} onChange={() => schalte(wahl, setWahl, w.montag)} />
                  <span>
                    <strong>
                      KW {w.kw}/{w.jahr}
                    </strong>
                    <span className="leise">
                      {' '}
                      · {datum(w.montag)} – {datum(plusTage(w.montag, 4))} · {h(w.stunden)} Std.
                      {w.form === 'tag' ? ' · nach Tagen' : ''}
                    </span>
                  </span>
                </label>
                {(w.hinweise.length > 0 || w.unsicher) && (
                  <p className="klein">
                    {w.unsicher && (w.stand === 'neu' || w.stand === 'leer') && <span className="pille gelb">prüfen</span>} <span className="leise">{w.hinweise.join(' · ')}</span>
                  </p>
                )}
                {(['betrieb', 'unterweisung', 'schule'] as const).some((t) => w[t].length > 0) && (
                  <details className="klapp">
                    <summary>Einträge ansehen</summary>
                    {(['betrieb', 'unterweisung', 'schule'] as const)
                      .filter((t) => w[t].length > 0)
                      .map((t) => (
                        <div key={t}>
                          <strong className="klein">{TEIL_TEXT[t]}</strong>
                          <ul className="punkte klein">
                            {w[t].map((e, i) => (
                              <li key={i} className="mehrzeilig">
                                {tagKurz(w.montag, e.tag)}
                                {e.text}
                                {e.stunden > 0 ? ` – ${h(e.stunden)} Std.` : ''}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                  </details>
                )}
              </li>
            ))}
          </ul>
          {fehlerHier()}
          <div className="aktionen links">
            <button type="button" className="knopf" disabled={gewaehlt.length === 0 || laeuft} onClick={() => void uebernimm()}>
              {gewaehlt.length === 0 ? 'Wochen als Entwurf übernehmen' : gewaehlt.length === 1 ? 'Eine Woche als Entwurf übernehmen' : `${gewaehlt.length} Wochen als Entwurf übernehmen`}
            </button>
            <button type="button" className="knopf schlicht" onClick={() => void verwerfe()}>
              Verwerfen
            </button>
          </div>
        </section>
      )}

      {entwuerfe.length > 0 && (
        <section className="karte">
          <h2>Eingelesene Entwürfe einreichen</h2>
          <p className="leise">
            Sieh dir jeden Bericht einmal an und verbessere ihn, wo nötig – vor allem bei Handschrift. Dann reich sie hier gesammelt ein. Dein Ausbilder sieht, dass sie eingelesen sind.
          </p>
          <ul className="liste">
            {entwuerfe.map((w) => (
              <li key={w.montag}>
                <label className="haken">
                  <input type="checkbox" checked={einreichen.has(w.montag)} disabled={w.stunden <= 0} onChange={() => schalte(einreichen, setEinreichen, w.montag)} />
                  <span>
                    <strong>
                      KW {w.kw}/{w.jahr}
                    </strong>{' '}
                    <span className="leise">· {w.stunden > 0 ? `${h(w.stunden)} Std.` : 'noch ohne Stunden'}</span>
                  </span>
                </label>
                <Link zu={`/berichtsheft/${w.montag}`} className="knopf schlicht klein">
                  Bericht ansehen
                </Link>
              </li>
            ))}
          </ul>
          {fehlerHier('einreichen')}
          <div className="aktionen links">
            <button type="button" className="knopf" disabled={einreichen.size === 0 || laeuft} onClick={() => void reicheEin()}>
              {einreichen.size === 0 ? 'Berichte einreichen' : einreichen.size === 1 ? 'Einen Bericht einreichen' : `${einreichen.size} Berichte einreichen`}
            </button>
          </div>
        </section>
      )}
    </>
  );
}
