import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { Ladefehler } from '../dialoge';
import { HandbuchLink } from '../handbuchLink';
import { Link } from '../router';

/**
 * Lernspiele im Game Vault: Begriffe-Memory und Zeit-Sprint mit den Kernbegriffen aus dem Lernpaket.
 * Nichts davon wird gespeichert und nichts zählt für Lernstand oder Abzeichen. Mit Pflanzenregal bringt die erste
 * geschaffte Runde je Spiel und Themenfeld einmal Tropfen. Die Bestmarke im Sprint merkt sich nur der Browser.
 */

interface Kopf {
  feld: string;
  titel: string;
  felder: { id: string; titel: string }[];
  zaehlt: boolean;
  tropfen: number;
}
interface MemoryDaten extends Kopf {
  paare: { id: string; begriff: string; erklaerung: string }[];
}
interface SprintDaten extends Kopf {
  fragen: { id: string; erklaerung: string; optionen: string[]; richtig: string }[];
}

function FeldWahl({ feld, felder, onWahl }: { feld: string; felder: Kopf['felder']; onWahl: (f: string) => void }) {
  return (
    <label className="spiel-feld">
      Themenfeld
      <select value={feld} onChange={(e) => onWahl(e.target.value)}>
        <option value="alle">Alle Themenfelder</option>
        <option value="heute">Heute dran (Karteikarten)</option>
        {felder.map((f) => (
          <option key={f.id} value={f.id}>
            {f.titel}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Nach der Runde: Tropfen fürs Regal abholen (einmal je Spiel und Themenfeld). */
function useGeschafft(spiel: string) {
  const [tropfen, setTropfen] = useState(0);
  const melde = useCallback(
    (feld: string, zaehlt: boolean) => {
      if (!zaehlt) return;
      api<{ regalTropfen: number }>('POST', `/api/lernen/spiele/${spiel}`, { feld }).then(
        (r) => setTropfen(r.regalTropfen),
        () => undefined,
      );
    },
    [spiel],
  );
  return { tropfen, setTropfen, melde };
}

function TropfenHinweis({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <p className="hinweis gut" role="status">
      +{n} Tropfen fürs Pflanzenregal. <Link zu="/lernen/vault/regal">Zum Regal</Link>
    </p>
  );
}

// ---------- Begriffe-Memory ----------

interface MemoryKarte {
  paar: string;
  art: 'begriff' | 'erklaerung';
  text: string;
}

function mische<T>(l: T[]): T[] {
  const a = [...l];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function BegriffeMemory() {
  const [feld, setFeld] = useState('alle');
  const [d, setD] = useState<MemoryDaten | null>(null);
  const [fehler, setFehler] = useState('');
  const [karten, setKarten] = useState<MemoryKarte[]>([]);
  const [offen, setOffen] = useState<number[]>([]);
  const [gefunden, setGefunden] = useState<string[]>([]);
  const [zuege, setZuege] = useState(0);
  const [hinweis, setHinweis] = useState('');
  const uhr = useRef<number | undefined>(undefined);
  const { tropfen, setTropfen, melde } = useGeschafft('memory');

  const lade = useCallback(
    (f: string) => {
      window.clearTimeout(uhr.current);
      setD(null);
      setFehler('');
      setTropfen(0);
      api<MemoryDaten>('GET', `/api/lernen/spiele/memory?feld=${encodeURIComponent(f)}`).then(
        (x) => {
          setD(x);
          setKarten(mische(x.paare.flatMap((p) => [{ paar: p.id, art: 'begriff' as const, text: p.begriff }, { paar: p.id, art: 'erklaerung' as const, text: p.erklaerung }])));
          setOffen([]);
          setGefunden([]);
          setZuege(0);
          setHinweis('');
        },
        (e: Error) => setFehler(e.message),
      );
    },
    [setTropfen],
  );
  useEffect(() => {
    lade(feld);
    return () => window.clearTimeout(uhr.current);
  }, [lade, feld]);

  if (fehler) return <Ladefehler titel="Begriffe-Memory" text={fehler} />;
  if (!d) return <p className="leise">Lädt …</p>;
  const fertig = d.paare.length > 0 && gefunden.length === d.paare.length;
  const dreh = (i: number) => {
    if (offen.length === 2 || offen.includes(i) || gefunden.includes(karten[i].paar)) return;
    const neu = [...offen, i];
    if (neu.length < 2) {
      setOffen(neu);
      setHinweis('');
      return;
    }
    const [a, b] = [karten[neu[0]], karten[neu[1]]];
    setZuege((z) => z + 1);
    if (a.paar === b.paar && a.art !== b.art) {
      const g = [...gefunden, a.paar];
      setGefunden(g);
      setOffen([]);
      setHinweis(`Paar gefunden: ${a.art === 'begriff' ? a.text : b.text}.`);
      if (g.length === d.paare.length) melde(d.feld, d.zaehlt);
      return;
    }
    setOffen(neu);
    setHinweis('Kein Paar – merk dir, wo die Karten liegen.');
    uhr.current = window.setTimeout(() => setOffen([]), 1200);
  };

  return (
    <>
      <p>
        <Link zu="/lernen/vault">← Game Vault</Link>
      </p>
      <div className="vault-kopf">
        <div>
          <h1>Begriffe-Memory</h1>
          <p className="leise">
            Finde zu jedem Begriff die passende Erklärung. Nichts davon wird gespeichert. <HandbuchLink kapitel="lernspiele">Lernspiele</HandbuchLink>
          </p>
        </div>
        <FeldWahl feld={feld} felder={d.felder} onWahl={setFeld} />
      </div>
      {d.paare.length < 2 ? (
        <p className="hinweis">Hier gibt es zu wenige Begriffe für ein Memory. Wähl ein anderes Themenfeld.</p>
      ) : (
        <>
          <p className="vault-marken">
            <span className="pille grau">
              {gefunden.length} von {d.paare.length} Paaren
            </span>
            <span className="pille grau">{zuege} Züge</span>
            {d.zaehlt && !fertig && <span className="pille blau">Bringt einmal {d.tropfen} Tropfen fürs Regal</span>}
          </p>
          {fertig ? (
            <section className="hinweis gut spiel-fertig" role="status">
              <span>
                <strong>Alle Paare gefunden!</strong> {zuege} Züge.
              </span>
              <button type="button" className="knopf klein" onClick={() => lade(feld)}>
                Neue Runde starten
              </button>
            </section>
          ) : (
            <p className="nur-vorleser" role="status">
              {hinweis}
            </p>
          )}
          <TropfenHinweis n={tropfen} />
          <div className="memory-feld">
            {karten.map((k, i) => {
              const weg = gefunden.includes(k.paar);
              const auf = weg || offen.includes(i);
              return (
                <button key={i} type="button" className={`memory-karte${auf ? ' auf' : ''}${weg ? ' weg' : ''}`} onClick={() => dreh(i)} aria-disabled={weg} aria-label={auf ? `${k.art === 'begriff' ? 'Begriff' : 'Erklärung'}: ${k.text}` : `Verdeckte Karte ${i + 1}`}>
                  {auf ? (
                    <>
                      <span className="memory-art">{k.art === 'begriff' ? 'Begriff' : 'Erklärung'}</span>
                      <span className={k.art === 'begriff' ? 'memory-begriff' : ''}>{k.text}</span>
                    </>
                  ) : (
                    <span className="memory-ruecken" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

// ---------- Zeit-Sprint ----------

const SEKUNDEN = 60;
const bestSchluessel = (feld: string) => `vault-sprint-${feld}`;
function leseBest(feld: string): number {
  try {
    return Number(localStorage.getItem(bestSchluessel(feld))) || 0;
  } catch {
    return 0;
  }
}
function merkeBest(feld: string, n: number): void {
  try {
    localStorage.setItem(bestSchluessel(feld), String(n));
  } catch {
    // ohne Speicher im Browser gibt es eben keine Bestmarke
  }
}

export function ZeitSprint() {
  const [feld, setFeld] = useState('alle');
  const [d, setD] = useState<SprintDaten | null>(null);
  const [fehler, setFehler] = useState('');
  const [phase, setPhase] = useState<'start' | 'laeuft' | 'ende'>('start');
  const [rest, setRest] = useState(SEKUNDEN);
  const [nr, setNr] = useState(0);
  const [richtig, setRichtig] = useState(0);
  const [falsch, setFalsch] = useState<{ begriff: string; erklaerung: string }[]>([]);
  const [rueck, setRueck] = useState<{ ok: boolean; text: string } | null>(null);
  const [best, setBest] = useState(0);
  const [neuerBest, setNeuerBest] = useState(false);
  const uhr = useRef<number | undefined>(undefined);
  const stand = useRef({ richtig: 0 });
  const { tropfen, setTropfen, melde } = useGeschafft('sprint');

  useEffect(() => {
    setD(null);
    setFehler('');
    setPhase('start');
    setBest(leseBest(feld));
    api<SprintDaten>('GET', `/api/lernen/spiele/sprint?feld=${encodeURIComponent(feld)}`).then(setD, (e: Error) => setFehler(e.message));
  }, [feld]);
  useEffect(() => () => window.clearInterval(uhr.current), []);

  const ende = useCallback(() => {
    window.clearInterval(uhr.current);
    setPhase('ende');
    const n = stand.current.richtig;
    const alt = leseBest(feld);
    if (n > alt) {
      merkeBest(feld, n);
      setBest(n);
      setNeuerBest(true);
    }
    if (d && n > 0) melde(d.feld, d.zaehlt);
  }, [feld, d, melde]);

  if (fehler) return <Ladefehler titel="Zeit-Sprint" text={fehler} />;
  if (!d) return <p className="leise">Lädt …</p>;
  const zuWenig = d.fragen.length < 4;

  const los = () => {
    window.clearInterval(uhr.current);
    setNr(0);
    setRichtig(0);
    stand.current.richtig = 0;
    setFalsch([]);
    setRueck(null);
    setNeuerBest(false);
    setTropfen(0);
    setRest(SEKUNDEN);
    setPhase('laeuft');
    const start = Date.now();
    uhr.current = window.setInterval(() => {
      const r = SEKUNDEN - Math.floor((Date.now() - start) / 1000);
      if (r <= 0) ende();
      else setRest(r);
    }, 250);
  };
  const frage = d.fragen[nr % d.fragen.length];
  const waehle = (b: string) => {
    const ok = b === frage.richtig;
    if (ok) {
      setRichtig((n) => n + 1);
      stand.current.richtig++;
    } else setFalsch((l) => (l.some((x) => x.begriff === frage.richtig) ? l : [...l, { begriff: frage.richtig, erklaerung: frage.erklaerung }]));
    setRueck({ ok, text: ok ? 'Richtig!' : `Gesucht war: ${frage.richtig}` });
    setNr((n) => n + 1);
  };

  return (
    <>
      <p>
        <Link zu="/lernen/vault">← Game Vault</Link>
      </p>
      <div className="vault-kopf">
        <div>
          <h1>Zeit-Sprint</h1>
          <p className="leise">
            {SEKUNDEN} Sekunden: Zu jeder Erklärung tippst du den passenden Begriff. Nur gegen dich selbst. <HandbuchLink kapitel="lernspiele">Lernspiele</HandbuchLink>
          </p>
        </div>
        {phase !== 'laeuft' && <FeldWahl feld={feld} felder={d.felder} onWahl={setFeld} />}
      </div>
      {zuWenig ? (
        <p className="hinweis">Hier gibt es zu wenige Begriffe für einen Sprint. Wähl ein anderes Themenfeld.</p>
      ) : phase === 'start' ? (
        <section className="karte sprint">
          <p>
            Deine beste Runde auf diesem Gerät: <strong>{best}</strong> richtig. Gespeichert wird im Portal nichts.
          </p>
          {d.zaehlt && <p className="leise klein">Die erste Runde mit mindestens einer richtigen Antwort bringt einmal {d.tropfen} Tropfen fürs Pflanzenregal.</p>}
          <p className="aktionen links">
            <button type="button" className="knopf" onClick={los}>
              Sprint starten
            </button>
          </p>
        </section>
      ) : phase === 'laeuft' ? (
        <section className="karte sprint" aria-label="Sprint läuft">
          <div className="sprint-stand">
            <span>
              <strong>{richtig}</strong> richtig
            </span>
            <span className={`sprint-uhr${rest <= 10 ? ' knapp' : ''}`}>{rest} s</span>
          </div>
          <div className="balken">
            <span style={{ width: `${(rest / SEKUNDEN) * 100}%` }} />
          </div>
          <p className="sprint-frage">{frage.erklaerung}</p>
          <div className="sprint-optionen">
            {frage.optionen.map((o) => (
              <button key={`${nr}-${o}`} type="button" className="knopf schlicht" onClick={() => waehle(o)}>
                {o}
              </button>
            ))}
          </div>
          <p className={`klein sprint-rueck${rueck && !rueck.ok ? ' falsch' : ''}`} role="status">
            {rueck?.text ?? ''}
          </p>
          <p className="aktionen links">
            <button type="button" className="knopf schlicht klein" onClick={ende}>
              Sprint beenden
            </button>
          </p>
        </section>
      ) : (
        <section className="karte sprint" role="status">
          <p className="sprint-ergebnis">
            <strong>{richtig}</strong> richtig in {SEKUNDEN} Sekunden
          </p>
          {neuerBest && <p className="hinweis gut">Neue Bestmarke auf diesem Gerät!</p>}
          <TropfenHinweis n={tropfen} />
          {falsch.length > 0 && (
            <>
              <h2>Nochmal ansehen</h2>
              <dl className="begriffe">
                {falsch.map((f) => (
                  <Fragment key={f.begriff}>
                    <dt>{f.begriff}</dt>
                    <dd>{f.erklaerung}</dd>
                  </Fragment>
                ))}
              </dl>
            </>
          )}
          <p className="aktionen links">
            <button type="button" className="knopf" onClick={los}>
              Neuen Sprint starten
            </button>
          </p>
        </section>
      )}
    </>
  );
}
