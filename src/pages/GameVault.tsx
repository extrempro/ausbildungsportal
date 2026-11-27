import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api, datum } from '../api';
import { Ladefehler, melde, rueckfrage, useFensterFokus } from '../dialoge';
import { HandbuchLink } from '../handbuchLink';
import { LernReiter } from '../lernen/teile';
import { geheZu, Link } from '../router';
import { Pflanze, SELTENHEIT, wuchsVon } from '../vault/pflanzen';

/**
 * Game Vault: Spiele zum Lernen und Abschalten – freiwillig und privat. Das erste ist das Pflanzenregal:
 * Tropfen (aus Berichten, Lernstand, Quiz, Karteikarten) zum Gießen, Funken (aus Zusatzwissen und Abzeichen) für
 * Booster, Samenpakete bei Meilensteinen der Ausbildungszeit. Alles errechnet der Server; hier wird nur gezeigt.
 */

interface PflanzeDaten {
  id: number;
  platz: number;
  art: string;
  name: string;
  seltenheit: string;
  stufe: number;
  wuchs: number;
  feuchte: number;
  giessbar: boolean;
  booster: { art: string; bis: string } | null;
}
interface Regal {
  erlaubt: boolean;
  angelegt: boolean;
  an: boolean;
  tropfen?: number;
  funken?: number;
  herkunft?: { berichte: number; lernen: number; karten: number; funken: number };
  plaetze?: number;
  pflanzen?: PflanzeDaten[];
  gewaechse?: { jahr: number; blaetter: number; luecken: number }[];
  vorrat?: Record<string, number>;
  gadgets?: { id: string; name: string; text: string; meilensteinName: string | null; hat: boolean }[];
  booster?: { id: string; name: string; preis: number; text: string }[];
  pakete?: number;
  meilensteine?: { id: string; name: string; am: string | null; erreicht: boolean }[];
  naechster?: { id: string; name: string; am: string } | null;
  ohneZeit?: boolean;
  regeln?: { tropfen: Record<string, number>; funken: Record<string, number>; preis: Record<string, number>; giessenAb: number };
  gewachsen?: boolean;
  neu?: { id: number; art: string; name: string; seltenheit: string };
}
type Voll = Required<Omit<Regal, 'gewachsen' | 'neu'>> & Pick<Regal, 'gewachsen' | 'neu'>;
const istVoll = (r: Regal | null): r is Voll => !!r && r.angelegt && r.pflanzen !== undefined;

const STUFE = ['Keimling', 'Jungpflanze', 'Kräftig', 'Prachtstück'];
const BOOSTER_NAME: Record<string, string> = { lampe: 'Pflanzenlampe', nebel: 'Luftbefeuchter', duenger: 'Dünger' };
const SORTEN = [
  { id: 'gruen', name: 'Grünpflanzen', text: 'Kräftige Blätter, wächst gut' },
  { id: 'bluete', name: 'Blühpflanzen', text: 'Blüht, wenn sie groß ist' },
  { id: 'haenge', name: 'Hängepflanzen', text: 'Rankt übers Regalbrett' },
];

function useRegal() {
  const [regal, setRegal] = useState<Regal | null>(null);
  const [fehler, setFehler] = useState('');
  const lade = useCallback(() => api<Regal>('GET', '/api/regal').then(setRegal, (e: Error) => setFehler(e.message)), []);
  useEffect(() => {
    void lade();
  }, [lade]);
  return { regal, setRegal, fehler, lade };
}

function Tropfen() {
  return (
    <svg className="vault-muenze" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path className="vault-tropfen" d="M12 3C12 3 5 11 5 15a7 7 0 0 0 14 0C19 11 12 3 12 3Z" />
    </svg>
  );
}
function Funke() {
  return (
    <svg className="vault-muenze" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path className="vault-funke" d="M12 2l2.2 7.2 7.3.4-5.7 4.5 2.1 7.1L12 17l-5.9 4.2 2.1-7.1-5.7-4.5 7.3-.4z" />
    </svg>
  );
}

function Guthaben({ r }: { r: Voll }) {
  return (
    <div className="vault-guthaben" aria-label="Dein Guthaben">
      <Link zu="/lernen/vault/tropfen" className="vault-geld">
        <Tropfen />
        <strong>{r.tropfen}</strong> Tropfen
      </Link>
      <Link zu="/lernen/vault/tropfen" className="vault-geld">
        <Funke />
        <strong>{r.funken}</strong> Funken
      </Link>
    </div>
  );
}

// ---------- Übersicht ----------

export function GameVault() {
  const { regal, setRegal, fehler } = useRegal();
  const [laeuft, setLaeuft] = useState(false);
  const [fehlerAktion, setFehlerAktion] = useState('');
  if (fehler) return <Ladefehler titel="Game Vault" text={fehler} />;
  if (!regal) return <p className="leise">Lädt …</p>;
  const aendere = (methode: string, body: unknown, text: string) => {
    setLaeuft(true);
    setFehlerAktion('');
    api<Regal>(methode, '/api/regal', body).then(
      (r) => {
        setRegal(r);
        melde(text);
      },
      (e: Error) => setFehlerAktion(e.message),
    ).finally(() => setLaeuft(false));
  };
  const durst = istVoll(regal) ? regal.pflanzen.filter((p) => p.feuchte < 50).length : 0;
  return (
    <>
      <h1>Game Vault</h1>
      <LernReiter />
      <p className="leise">
        Spiele zum Lernen und zum Abschalten zwischendurch. Freiwillig und nur für dich – <strong>niemand sieht, ob oder wie viel du spielst.</strong>{' '}
        <HandbuchLink kapitel="game-vault">Game Vault und Pflanzenregal</HandbuchLink>
      </p>
      {fehlerAktion && (
        <p className="hinweis fehler" role="alert">
          {fehlerAktion}
        </p>
      )}
      {!regal.erlaubt ? (
        <p className="hinweis">Der Game Vault ist im Moment ausgeschaltet.</p>
      ) : (
        <div className="vault-kacheln">
          <section className="karte vault-kachel">
            <Pflanze art="orchidee" seltenheit="selten" wuchs={2.4} feuchte={80} groesse={72} />
            <div>
              <h2>Pflanzenregal</h2>
              <p className="leise">Gieß deine Pflanzen mit Tropfen aus Berichten und Lernen. Bei jedem Meilenstein deiner Ausbildung gibt es ein Samenpaket.</p>
              {!regal.angelegt ? (
                <p className="aktionen links">
                  <button type="button" className="knopf" disabled={laeuft} onClick={() => aendere('POST', {}, 'Dein Regal steht. Such dir dein erstes Samenpaket aus.')}>
                    Regal anlegen
                  </button>
                </p>
              ) : !regal.an ? (
                <>
                  <p className="leise klein">Dein Regal ist ausgeblendet. Es bleibt gespeichert.</p>
                  <p className="aktionen links">
                    <button type="button" className="knopf" disabled={laeuft} onClick={() => aendere('PUT', { an: true }, 'Dein Regal ist wieder da.')}>
                      Regal wieder zeigen
                    </button>
                  </p>
                </>
              ) : (
                <>
                  {istVoll(regal) && (
                    <p className="vault-marken">
                      <span className="pille gruen">{regal.pflanzen.length === 1 ? '1 Pflanze' : `${regal.pflanzen.length} Pflanzen`}</span>
                      {durst > 0 && <span className="pille gelb">{durst === 1 ? '1 hat Durst' : `${durst} haben Durst`}</span>}
                      {regal.pakete > 0 && <span className="pille blau">Samenpaket wartet</span>}
                    </p>
                  )}
                  <p className="aktionen links">
                    <Link zu="/lernen/vault/regal" className="knopf">
                      Zum Regal
                    </Link>
                  </p>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

// ---------- Regal ----------

function Samenpaket({ r, onFertig, onZu }: { r: Voll; onFertig: (r: Voll) => void; onZu: () => void }) {
  const flaeche = useRef<HTMLElement>(null);
  useFensterFokus(flaeche, onZu);
  const [sorte, setSorte] = useState('gruen');
  const [selten, setSelten] = useState(false);
  const [neu, setNeu] = useState<Voll['neu']>(undefined);
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const kauf = r.pakete < 1;
  const preis = (kauf ? r.regeln.preis.extraPaket : 0) + (selten ? r.regeln.preis.seltenesPaket : 0);
  const frei = r.plaetze - r.pflanzen.length;
  const oeffne = () => {
    setLaeuft(true);
    setFehler('');
    api<Voll>('POST', '/api/regal/paket', { sorte, selten, kauf }).then(
      (x) => {
        setNeu(x.neu);
        onFertig(x);
      },
      (e: Error) => setFehler(e.message),
    ).finally(() => setLaeuft(false));
  };
  const meilenstein = [...r.meilensteine].filter((m) => m.erreicht).slice(-r.pakete)[0];
  return (
    <div className="dialog-hintergrund" onMouseDown={(e) => e.target === e.currentTarget && onZu()}>
      <section ref={flaeche} className="karte dialog vault-paket" role="dialog" aria-modal="true" aria-labelledby="paket-kopf">
        <div className="dialog-kopf">
          <h2 id="paket-kopf">{neu ? 'Aus deinem Samenpaket' : kauf ? 'Samenpaket kaufen' : 'Ein Samenpaket wartet'}</h2>
          <button type="button" className="knopf schlicht klein" onClick={onZu}>
            Schließen
          </button>
        </div>
        {neu ? (
          <div className="vault-neu" role="status">
            <Pflanze art={neu.art} seltenheit={neu.seltenheit} wuchs={0.4} feuchte={100} groesse={150} />
            <span className={`pille ${neu.seltenheit === 'gewoehnlich' ? 'grau' : 'blau'}`}>{SELTENHEIT[neu.seltenheit]}</span>
            <h3>{neu.name}</h3>
            <p className="leise">Steht jetzt als Keimling in deinem Regal. Gieß sie, wenn die Erde trocken ist.</p>
            <p className="aktionen">
              <button type="button" className="knopf" onClick={onZu}>
                Zum Regal
              </button>
            </p>
          </div>
        ) : (
          <>
            <p className="leise">
              {kauf
                ? `Gerade wartet kein Paket aus einem Meilenstein. Für ${r.regeln.preis.extraPaket} Tropfen kannst du dir eins kaufen.`
                : `${meilenstein ? `${meilenstein.name}! ` : ''}Such dir aus, was in dem Paket sein soll.`}
            </p>
            <fieldset className="vault-sorten">
              <legend className="nur-vorleser">Sorte</legend>
              {SORTEN.map((s) => (
                <label key={s.id} className={`vault-sorte${sorte === s.id && !selten ? ' an' : ''}`}>
                  <input type="radio" name="sorte" value={s.id} checked={sorte === s.id && !selten} onChange={() => (setSorte(s.id), setSelten(false))} />
                  <span>
                    <strong>{s.name}</strong>
                    <span className="leise klein">{s.text}</span>
                  </span>
                </label>
              ))}
              <label className={`vault-sorte${selten ? ' an' : ''}`}>
                <input type="radio" name="sorte" value="selten" checked={selten} onChange={() => setSelten(true)} />
                <span>
                  <strong>Seltenes Paket</strong>
                  <span className="leise klein">+{r.regeln.preis.seltenesPaket} Tropfen – selten, besonders oder mit Glück legendär</span>
                </span>
              </label>
            </fieldset>
            {frei < 1 && (
              <p className="hinweis" role="status">
                Im Regal ist kein Platz frei. Gib zuerst eine Pflanze weg – oder hol dir das vierte Regalbrett.
              </p>
            )}
            {fehler && (
              <p className="hinweis fehler" role="alert">
                {fehler}
              </p>
            )}
            <p className="aktionen">
              <button type="button" className="knopf" disabled={laeuft || frei < 1 || r.tropfen < preis} onClick={oeffne}>
                {preis ? `Paket öffnen · ${preis} Tropfen` : 'Paket öffnen'}
              </button>
            </p>
            {r.tropfen < preis && <p className="leise klein">Dafür fehlen dir noch {preis - r.tropfen} Tropfen.</p>}
          </>
        )}
      </section>
    </div>
  );
}

function Brett({ children }: { children: ReactNode }) {
  return (
    <div className="vault-brett">
      <div className="vault-plaetze">{children}</div>
      <div className="vault-holz" aria-hidden="true" />
    </div>
  );
}

function zustandVon(p: { feuchte: number }) {
  return p.feuchte < 20 ? { text: 'Lässt die Blätter hängen', farbe: 'rot' } : p.feuchte < 50 ? { text: 'Durstig', farbe: 'gelb' } : { text: 'Gut versorgt', farbe: 'gruen' };
}

export function PflanzenRegal() {
  const { regal, setRegal, fehler } = useRegal();
  const [gewaehlt, setGewaehlt] = useState<number | null>(null);
  const [paket, setPaket] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState('');
  const [fehlerAktion, setFehlerAktion] = useState('');
  const detail = useRef<HTMLElement>(null);
  if (fehler) return <Ladefehler titel="Pflanzenregal" text={fehler} />;
  if (!regal) return <p className="leise">Lädt …</p>;
  if (!istVoll(regal) || !regal.an || !regal.erlaubt)
    return (
      <>
        <p>
          <Link zu="/lernen/vault">← Game Vault</Link>
        </p>
        <h1>Pflanzenregal</h1>
        <p className="hinweis">{!regal.erlaubt ? 'Der Game Vault ist im Moment ausgeschaltet.' : 'Leg dein Regal im Game Vault an.'}</p>
      </>
    );
  const r = regal;
  const p = r.pflanzen.find((x) => x.id === gewaehlt) ?? r.pflanzen[0] ?? null;
  const tu = (pfad: string, body: unknown, text: (x: Voll) => string, methode = 'POST') => {
    setLaeuft(true);
    setFehlerAktion('');
    setMeldung('');
    api<Voll>(methode, pfad, body).then(
      (x) => {
        setRegal(x);
        setMeldung(text(x));
      },
      (e: Error) => setFehlerAktion(e.message),
    ).finally(() => setLaeuft(false));
  };
  // am Handy und Tablet steht die Pflanze unter dem Regal – nach dem Antippen dorthin, damit Gießen und Rückmeldung im Bild sind
  const waehle = (id: number) => {
    setGewaehlt(id);
    setMeldung('');
    setFehlerAktion('');
    if (window.matchMedia('(max-width: 1023px)').matches) {
      const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      requestAnimationFrame(() => detail.current?.scrollIntoView({ block: 'start', behavior: ruhig ? 'auto' : 'smooth' }));
    }
  };
  const weg = (methode: string, body: unknown, text: string) => {
    setLaeuft(true);
    api<Regal>(methode, '/api/regal', body).then(
      () => {
        melde(text);
        geheZu('/lernen/vault');
      },
      (e: Error) => {
        setFehlerAktion(e.message);
        setLaeuft(false);
      },
    );
  };
  const reihen: (PflanzeDaten | number)[][] = [];
  for (let i = 0; i < r.plaetze; i += 3) reihen.push([0, 1, 2].map((j) => r.pflanzen.find((x) => x.platz === i + j) ?? i + j));
  const vorrat = Object.entries(r.vorrat).filter(([, n]) => n > 0);
  const zustand = p ? zustandVon(p) : null;

  return (
    <>
      <p>
        <Link zu="/lernen/vault">← Game Vault</Link>
      </p>
      <div className="vault-kopf">
        <div>
          <h1>Dein Pflanzenregal</h1>
          <p className="leise">
            Gieß deine Pflanzen mit Tropfen, wenn die Erde trocken ist – etwa einmal in der Woche. Tropfen gibt es für Berichte und fürs <Link zu="/lernen/ueben">Üben</Link>. Nur du siehst dein Regal. <HandbuchLink kapitel="game-vault">Pflanzenregal</HandbuchLink>
          </p>
        </div>
        <div className="vault-kopf-rechts">
          <Guthaben r={r} />
          <Link zu="/lernen/vault/gaertnerei" className="knopf schlicht">
            Gärtnerei
          </Link>
        </div>
      </div>

      {r.pakete > 0 && (
        <section className="hinweis gut vault-wartet" aria-label="Samenpaket">
          <span>{r.pakete === 1 ? 'Ein Samenpaket wartet auf dich.' : `${r.pakete} Samenpakete warten auf dich.`}</span>
          <button type="button" className="knopf klein" onClick={() => setPaket(true)}>
            Samenpaket öffnen
          </button>
        </section>
      )}

      <div className="vault-raum">
        <section className="karte vault-regal" aria-label="Regal">
          {r.gewaechse.length > 0 && (
            <Brett>
              {r.gewaechse.map((g) => (
                <div key={g.jahr} className="vault-platz vault-gewaechs">
                  <Pflanze art="bericht" seltenheit="bericht" wuchs={Math.min(3, g.blaetter / 15)} feuchte={100} groesse={96} />
                  <strong>Berichtsheft {g.jahr}. Jahr</strong>
                  <span className="pille gruen">
                    {g.blaetter} {g.blaetter === 1 ? 'Blatt' : 'Blätter'}
                    {g.luecken > 0 ? ` · ${g.luecken} ${g.luecken === 1 ? 'Lücke' : 'Lücken'}` : ''}
                  </span>
                </div>
              ))}
            </Brett>
          )}
          {reihen.map((reihe, i) => (
            <Brett key={i}>
              {reihe.map((x) =>
                typeof x === 'number' ? (
                  <div key={`frei-${x}`} className="vault-platz vault-frei">
                    Freier Platz
                  </div>
                ) : (
                  <button key={x.id} type="button" className={`vault-platz vault-pflanze${p?.id === x.id ? ' an' : ''}`} aria-pressed={p?.id === x.id} onClick={() => waehle(x.id)}>
                    <Pflanze art={x.art} seltenheit={x.seltenheit} wuchs={wuchsVon(x.stufe, x.wuchs)} feuchte={x.feuchte} groesse={96} />
                    <strong>{x.name}</strong>
                    <span className={`pille ${zustandVon(x).farbe}`}>{zustandVon(x).text}</span>
                  </button>
                ),
              )}
            </Brett>
          ))}
          <p className="leise klein">Das Berichtsheft-Gewächs bekommt ein Blatt für jeden eingereichten Bericht – auch für nachgeholte. Es braucht kein Wasser.</p>
        </section>

        <aside className="vault-seite">
          {p && zustand ? (
            <section ref={detail} className="karte vault-detail" aria-label={p.name}>
              <h2 className="vault-name">
                {p.name} <span className={`pille ${p.seltenheit === 'gewoehnlich' ? 'grau' : 'blau'}`}>{SELTENHEIT[p.seltenheit]}</span>
              </h2>
              <p className="leise klein">
                Stufe {p.stufe} von 4 · {STUFE[p.stufe - 1]}
              </p>
              {p.stufe < 4 && (
                <div className="vault-wert">
                  <span>Wachstum bis zur nächsten Stufe</span>
                  <strong>{p.wuchs} %</strong>
                  <div className="balken">
                    <span style={{ width: `${p.wuchs}%` }} />
                  </div>
                </div>
              )}
              <div className="vault-wert">
                <span>Erde</span>
                <strong>{p.feuchte} % feucht</strong>
                <div className="balken vault-wasser">
                  <span style={{ width: `${p.feuchte}%` }} />
                </div>
              </div>
              {p.booster && (
                <p className="hinweis klein">
                  {BOOSTER_NAME[p.booster.art]} bis {datum(p.booster.bis)}
                </p>
              )}
              <p className="aktionen links">
                <button
                  type="button"
                  className="knopf"
                  disabled={laeuft || !p.giessbar || r.tropfen < r.regeln.preis.giessen}
                  onClick={() => tu(`/api/regal/pflanzen/${p.id}/giessen`, {}, (x) => (x.gewachsen ? `${p.name} ist gewachsen!` : `${p.name} ist gegossen.`))}
                >
                  Pflanze gießen · {r.regeln.preis.giessen} Tropfen
                </button>
              </p>
              {!p.giessbar && <p className="leise klein">Die Erde ist noch feucht genug. Gießen geht ab {r.regeln.giessenAb} %.</p>}
              {p.giessbar && r.tropfen < r.regeln.preis.giessen && (
                <p className="hinweis klein" role="status">
                  Dir fehlen Tropfen. Neue gibt es für jeden Bericht und fürs Üben: <Link zu="/lernen/ueben">Karteikarten und Quiz</Link> · <Link zu="/berichtsheft">Berichtsheft</Link>
                </p>
              )}
              {vorrat.length > 0 && (
                <details className="klapp">
                  <summary>Booster geben</summary>
                  <p className="aktionen links">
                    {vorrat.map(([art, n]) => (
                      <button key={art} type="button" className="knopf schlicht klein" disabled={laeuft} onClick={() => tu(`/api/regal/pflanzen/${p.id}/booster`, { art }, (x) => (x.gewachsen ? `${p.name} ist gewachsen!` : `${BOOSTER_NAME[art]} gegeben.`))}>
                        {BOOSTER_NAME[art]} ({n})
                      </button>
                    ))}
                  </p>
                </details>
              )}
              {meldung && (
                <p className="hinweis gut" role="status">
                  {meldung}
                </p>
              )}
              {fehlerAktion && (
                <p className="hinweis fehler" role="alert">
                  {fehlerAktion}
                </p>
              )}
              <p className="aktionen links">
                <button
                  type="button"
                  className="knopf schlicht klein gefahr"
                  disabled={laeuft}
                  onClick={async () => {
                    if (await rueckfrage(`${p.name} weggeben? Der Platz im Regal wird frei.`, { ja: 'Pflanze weggeben', gefahr: true })) tu(`/api/regal/pflanzen/${p.id}`, null, () => `${p.name} ist weg.`, 'DELETE');
                  }}
                >
                  Pflanze weggeben
                </button>
              </p>
            </section>
          ) : (
            <section className="karte">
              <h2>Noch keine Pflanze</h2>
              <p className="leise">Öffne dein erstes Samenpaket – dann steht hier deine erste Pflanze.</p>
              {fehlerAktion && (
                <p className="hinweis fehler" role="alert">
                  {fehlerAktion}
                </p>
              )}
            </section>
          )}

          <section className="karte">
            <h2>Meilensteine</h2>
            {r.ohneZeit ? (
              <p className="leise">In deinem Profil fehlt noch der Ausbildungsbeginn. Sobald dein Ausbilder ihn einträgt, gibt es Meilensteine.</p>
            ) : r.naechster ? (
              <p>
                Nächster: <strong>{r.naechster.name}</strong> am {datum(r.naechster.am)}. Dann gibt es ein Samenpaket.
              </p>
            ) : (
              <p>Alle Meilensteine geschafft. Herzlichen Glückwunsch!</p>
            )}
            <details className="klapp">
              <summary>Alle Meilensteine</summary>
              <ul className="vault-liste">
                {r.meilensteine.map((m) => (
                  <li key={m.id}>
                    <span className={`pille ${m.erreicht ? 'gruen' : 'grau'}`}>{m.erreicht ? 'geschafft' : 'kommt'}</span> {m.name}
                    {m.am && ` · ${datum(m.am)}`}
                  </li>
                ))}
              </ul>
            </details>
            {r.pakete < 1 && (
              <p className="aktionen links">
                <button type="button" className="knopf schlicht klein" onClick={() => setPaket(true)}>
                  Samenpaket kaufen · {r.regeln.preis.extraPaket} Tropfen
                </button>
              </p>
            )}
          </section>

          <details className="karte">
            <summary>Regal ausblenden oder löschen</summary>
            <p className="leise">Ausgeblendet bleibt alles gespeichert. Löschen entfernt Regal, Pflanzen und Vorrat – deine Berichte und dein Lernstand bleiben, daraus gibt es die Tropfen wieder.</p>
            <p className="aktionen links">
              <button type="button" className="knopf schlicht" disabled={laeuft} onClick={() => weg('PUT', { an: false }, 'Regal ausgeblendet. Im Game Vault holst du es zurück.')}>
                Regal ausblenden
              </button>
              <button
                type="button"
                className="knopf schlicht gefahr"
                disabled={laeuft}
                onClick={async () => {
                  if (await rueckfrage('Regal mit allen Pflanzen löschen? Das lässt sich nicht rückgängig machen.', { ja: 'Regal löschen', gefahr: true })) weg('DELETE', null, 'Regal gelöscht.');
                }}
              >
                Regal löschen
              </button>
            </p>
          </details>
        </aside>
      </div>
      {paket && <Samenpaket r={r} onFertig={(x) => setRegal(x)} onZu={() => setPaket(false)} />}
    </>
  );
}

// ---------- Gärtnerei ----------

export function Gaertnerei() {
  const { regal, setRegal, fehler } = useRegal();
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState('');
  const [fehlerAktion, setFehlerAktion] = useState('');
  if (fehler) return <Ladefehler titel="Gärtnerei" text={fehler} />;
  if (!regal) return <p className="leise">Lädt …</p>;
  if (!istVoll(regal) || !regal.an || !regal.erlaubt)
    return (
      <>
        <p>
          <Link zu="/lernen/vault">← Game Vault</Link>
        </p>
        <h1>Gärtnerei</h1>
        <p className="hinweis">{!regal.erlaubt ? 'Der Game Vault ist im Moment ausgeschaltet.' : 'Leg dein Regal im Game Vault an.'}</p>
      </>
    );
  const r = regal;
  const kaufe = (was: string, text: string) => {
    setLaeuft(true);
    setFehlerAktion('');
    setMeldung('');
    api<Voll>('POST', '/api/regal/kaufen', { was }).then(
      (x) => {
        setRegal(x);
        setMeldung(text);
      },
      (e: Error) => setFehlerAktion(e.message),
    ).finally(() => setLaeuft(false));
  };
  return (
    <>
      <p>
        <Link zu="/lernen/vault/regal">← Pflanzenregal</Link>
      </p>
      <div className="vault-kopf">
        <div>
          <h1>Gärtnerei</h1>
          <p className="leise">Booster kaufst du mit Funken. Gadgets bekommst du bei Meilensteinen – oder für Tropfen.</p>
        </div>
        <Guthaben r={r} />
      </div>
      {(meldung || fehlerAktion) && (
        <p className={`hinweis ${fehlerAktion ? 'fehler' : 'gut'}`} role={fehlerAktion ? 'alert' : 'status'}>
          {fehlerAktion || meldung}
        </p>
      )}
      <h2>Booster</h2>
      <div className="vault-kacheln">
        {r.booster.map((b) => (
          <section key={b.id} className="karte vault-ware">
            <h3>{b.name}</h3>
            <p className="leise">{b.text}</p>
            <p className="leise klein">Im Vorrat: {r.vorrat[b.id] ?? 0}</p>
            <p className="aktionen links">
              <button type="button" className="knopf" disabled={laeuft || r.funken < b.preis} onClick={() => kaufe(b.id, `${b.name} liegt im Vorrat. Im Regal gibst du ihn einer Pflanze.`)}>
                {b.name} kaufen · {b.preis} {b.preis === 1 ? 'Funke' : 'Funken'}
              </button>
            </p>
          </section>
        ))}
      </div>
      <h2>Gadgets</h2>
      <div className="vault-kacheln">
        {r.gadgets.map((g) => (
          <section key={g.id} className="karte vault-ware">
            <h3>{g.name}</h3>
            <p className="leise">{g.text}</p>
            {g.hat ? (
              <p>
                <span className="pille gruen">Hast du</span>
              </p>
            ) : (
              <>
                <p className="leise klein">Kommt mit dem Meilenstein „{g.meilensteinName ?? '–'}“.</p>
                <p className="aktionen links">
                  <button type="button" className="knopf schlicht" disabled={laeuft || r.tropfen < r.regeln.preis.gadget} onClick={() => kaufe(g.id, `${g.name} gehört jetzt dir.`)}>
                    {g.name} kaufen · {r.regeln.preis.gadget} Tropfen
                  </button>
                </p>
              </>
            )}
          </section>
        ))}
      </div>
    </>
  );
}

// ---------- So bekommst du Tropfen und Funken ----------

export function VaultTropfen() {
  const { regal, fehler } = useRegal();
  if (fehler) return <Ladefehler titel="Tropfen und Funken" text={fehler} />;
  if (!regal) return <p className="leise">Lädt …</p>;
  const r = istVoll(regal) ? regal : null;
  const t = r?.regeln.tropfen;
  return (
    <>
      <p>
        <Link zu={r ? '/lernen/vault/regal' : '/lernen/vault'}>{r ? '← Pflanzenregal' : '← Game Vault'}</Link>
      </p>
      <h1>So bekommst du Tropfen und Funken</h1>
      <p className="leise">
        Tropfen sind für die Pflege, Funken für Booster. Beides gibt es nur für dich – es zählt nirgends, niemand sieht deinen Stand, und es gibt keine Fristen. <HandbuchLink kapitel="game-vault">Game Vault</HandbuchLink>
      </p>
      <section className="karte">
        <h2 className="vault-name">
          <Tropfen /> Tropfen – für die Pflege
        </h2>
        <table className="stapel">
          <thead>
            <tr>
              <th>Wofür</th>
              <th>Tropfen</th>
              <th>Wie oft</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td data-label="Wofür">Bericht eingereicht – egal wann</td>
              <td data-label="Tropfen">+{t?.bericht ?? 5}</td>
              <td data-label="Wie oft">je Woche einmal, dazu ein Blatt am Berichtsheft-Gewächs</td>
            </tr>
            <tr>
              <td data-label="Wofür">Unterthema im Lernstand auf Gelb</td>
              <td data-label="Tropfen">+{t?.gelb ?? 2}</td>
              <td data-label="Wie oft">je Unterthema einmal</td>
            </tr>
            <tr>
              <td data-label="Wofür">Unterthema im Lernstand auf Grün</td>
              <td data-label="Tropfen">+{t?.gruen ?? 5}</td>
              <td data-label="Wie oft">je Unterthema einmal</td>
            </tr>
            <tr>
              <td data-label="Wofür">Quiz bestanden</td>
              <td data-label="Tropfen">+{t?.quiz ?? 3}</td>
              <td data-label="Wie oft">je Unterthema einmal – Fehlversuche kosten nichts</td>
            </tr>
            <tr>
              <td data-label="Wofür">Fällige Karteikarte wiederholt</td>
              <td data-label="Tropfen">+{t?.karte ?? 1}</td>
              <td data-label="Wie oft">jedes Mal, wenn sie dran ist</td>
            </tr>
          </tbody>
        </table>
        {r && (
          <p className="leise klein">
            Bei dir bisher: {r.herkunft.berichte} aus Berichten, {r.herkunft.lernen} aus Lernstand und Quiz, {r.herkunft.karten} aus Karteikarten.
          </p>
        )}
      </section>
      <section className="karte">
        <h2 className="vault-name">
          <Funke /> Funken – für Booster
        </h2>
        <ul className="punkte">
          <li>Zusatzwissen gelesen: +{r?.regeln.funken.zusatz ?? 1} je Text</li>
          <li>Abzeichen-Stufe in einem Themenfeld: +{r?.regeln.funken.abzeichen ?? 3}</li>
          <li>Funken verfallen nicht.</li>
        </ul>
      </section>
      <section className="karte">
        <h2>Damit es fair bleibt</h2>
        <ul className="punkte">
          <li>
            <strong>Nichts wird mitgeschrieben.</strong> Das Portal rechnet dein Guthaben jedes Mal neu aus deinem Berichtsheft und deinem Lernstand aus – minus das, was du ausgegeben hast. Stellst du ein Thema zurück auf Gelb, bleiben die Tropfen.
          </li>
          <li>
            <strong>Urlaub, Berufsschule, Abwesenheit:</strong> Dann trocknet nichts aus. Die Erde trocknet nur an Arbeitstagen im Betrieb.
          </li>
          <li>
            <strong>Nichts geht verloren:</strong> Pflanzen lassen höchstens die Blätter hängen. Nach dem Gießen erholen sie sich.
          </li>
          <li>
            <strong>Nur für dich:</strong> Ausbilder, Beauftragte und Admin sehen weder Regal noch Tropfen. Es gibt keine Rangliste.
          </li>
        </ul>
      </section>
    </>
  );
}

// ---------- Schalter des Super-Admins ----------

/** Game Vault für das ganze Portal an oder aus – anfangs aus. Der Super-Admin sieht dabei nichts über einzelne Azubis. */
export function VaultSchalter() {
  const [an, setAn] = useState<boolean | null>(null);
  const [fehler, setFehler] = useState('');
  useEffect(() => {
    api<{ an: boolean }>('GET', '/api/regal/einstellung').then((r) => setAn(r.an), (e: Error) => setFehler(e.message));
  }, []);
  return (
    <section className="karte">
      <h2>Game Vault für Azubis</h2>
      <p className="leise">
        Ein freiwilliges Spiel unter „Lernen“: ein Pflanzenregal, das Azubis mit Tropfen aus Berichten und Lernen pflegen. Ohne Fristen, ohne Rangliste – was ein Azubi dort tut, siehst du nicht und sieht auch sonst niemand.{' '}
        <HandbuchLink kapitel="vault-schalter">Game Vault ein- oder ausschalten</HandbuchLink>
      </p>
      {fehler && (
        <p className="hinweis fehler" role="alert">
          {fehler}
        </p>
      )}
      <label className="haken">
        <input
          type="checkbox"
          checked={an === true}
          disabled={an === null}
          onChange={(e) => {
            const neu = e.target.checked;
            setFehler('');
            setAn(neu);
            api<{ an: boolean }>('PUT', '/api/regal/einstellung', { an: neu }).then(
              (r) => {
                setAn(r.an);
                melde(r.an ? 'Game Vault eingeschaltet.' : 'Game Vault für alle ausgeschaltet.');
              },
              (err: Error) => {
                setAn(!neu);
                setFehler(err.message);
              },
            );
          }}
        />
        Azubis dürfen den Game Vault nutzen
      </label>
      <p className="leise klein">Anfangs ausgeschaltet – vorher am besten mit dem Betriebsrat sprechen. Ausgeschaltet verschwindet der Game Vault bei allen Azubis; ihre Regale bleiben gespeichert.</p>
    </section>
  );
}
