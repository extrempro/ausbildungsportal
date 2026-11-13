import { begleiterSagt } from '../begleiter';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { Ladefehler, melde, rueckfrage } from '../dialoge';
import { HandbuchLink } from '../handbuchLink';
import { Icon } from '../icons';
import { AMPEL_REGEL, AMPEL_TEXT, ampelVon, prozent, zaehle, zusammenfassung } from '../lernen/ampel';
import type { LernStatus } from '../lernen/ampel';
import { AmpelSchalter, Grafik, Inline, StapelBalken, StatusPille, TabelleAnsicht } from '../lernen/teile';
import type { Bild, Tabelle } from '../lernen/teile';
import { ZusatzBereich } from '../lernen/zusatz';
import type { Verweis, Zusatz } from '../lernen/zusatz';
import { Link, useUngespeichert } from '../router';
import { AbzeichenFeier, Schild } from '../lernen/abzeichen';
import type { Erfolg, FeldAbzeichen } from '../lernen/abzeichen';
import { useLern } from '../lernen/basis';
import { PaketFuss } from './Lernen';
import type { LernPaket } from './Lernen';

interface Unterthema {
  id: string;
  titel: string;
  begriffe: { begriff: string; erklaerung: string }[];
  tabellen: Tabelle[];
  befehle: { befehl: string; info: string }[];
  merksatz: string | null;
  frage: { frage: string; loesung: string[] } | null;
  abbildungen: { titel: string; bilder: Bild[] }[];
  hatInhalt: boolean;
  status: LernStatus;
  luecke: string;
  notiz: string;
  geaendert: string | null;
  inhaltAktualisiert: boolean;
  /** Zusatzwissen, das dieses Unterthema vertieft */
  vertiefung: Verweis[];
}

interface Thema {
  id: string;
  titel: string;
  lernfelder: string[];
  pruefung: string[];
  worum: string;
  fehler: string[];
  links: { titel: string; url: string; info: string }[];
  unterthemen: Unterthema[];
  zusatz: Zusatz[];
  abzeichen: FeldAbzeichen;
}

type Aenderung = { status?: LernStatus; luecke?: string; notiz?: string; bestaetigen?: true };

/** Lernen – ein Themenfeld: Cheatsheet je Unterthema mit Ampel, Lernpunkt und Notiz. */
export function LernThema({ id }: { id: string }) {
  const [daten, setDaten] = useState<{ paket: LernPaket; thema: Thema } | null>(null);
  const [fehler, setFehler] = useState('');
  // alle Themenfelder mit dem eigenen Stand – für die Navigation am Rand
  const [felder, setFelder] = useState<NavFeld[]>([]);

  const { basis, api: quelle, anleitungen } = useLern();
  const [naviOffen, setNaviOffen] = useState(false);
  // nach dem Wechsel in ein anderes Themenfeld ist die Navigation wieder zu
  useEffect(() => setNaviOffen(false), [id]);
  const ladeFelder = useCallback(() => api<{ themenfelder: NavFeld[] }>('GET', quelle).then((r) => setFelder(r.themenfelder), () => undefined), [quelle]);
  useEffect(() => void ladeFelder(), [ladeFelder]);
  // neu erreichtes Abzeichen oder neuer Rang – wird einmal groß gezeigt
  const [erfolg, setErfolg] = useState<Erfolg | null>(null);
  const schliesseErfolg = useCallback(() => {
    setErfolg(null);
    // erst nach dem Schließen des Fensters – der Begleiter redet nie über ein offenes Fenster
    window.setTimeout(() => begleiterSagt('abzeichen'), 300);
  }, []);
  const nachSpeichern = useCallback(
    (r: Erfolg) => {
      if (r.abzeichen || r.rang) setErfolg({ abzeichen: r.abzeichen, rang: r.rang });
      // der Weg zur nächsten Stufe hat sich geändert
      void ladeFelder();
    },
    [ladeFelder],
  );

  useEffect(() => {
    let aktuell = true;
    setFehler('');
    api<{ paket: LernPaket; thema: Thema }>('GET', `${quelle}/thema/${encodeURIComponent(id)}`).then(
      (d) => aktuell && setDaten(d),
      (e: Error) => aktuell && setFehler(e.message),
    );
    return () => {
      aktuell = false;
    };
  }, [id, quelle]);

  const aendere = useCallback(
    async (unterthema: string, patch: Aenderung) => {
      const r = await api<Pick<Unterthema, 'status' | 'luecke' | 'notiz' | 'geaendert' | 'inhaltAktualisiert'> & Erfolg>('PATCH', `/api/lernen/unterthema/${id}.${unterthema}`, patch);
      // die Antwort nennt die volle Kennung (themenfeld.unterthema) – hier zählt nur der neue Stand
      const stand = { status: r.status, luecke: r.luecke, notiz: r.notiz, geaendert: r.geaendert, inhaltAktualisiert: r.inhaltAktualisiert };
      setDaten((d) => d && { ...d, thema: { ...d.thema, unterthemen: d.thema.unterthemen.map((u) => (u.id === unterthema ? { ...u, ...stand } : u)) } });
      setFelder((fs) => fs.map((f) => (f.id === id ? { ...f, unterthemen: f.unterthemen.map((u) => (u.id === unterthema ? { ...u, status: r.status } : u)) } : f)));
      if (patch.status !== undefined) nachSpeichern(r);
    },
    [id, nachSpeichern],
  );

  const setzeGelesen = useCallback(
    async (z: Zusatz, gelesen: boolean) => {
      const r = await api<Erfolg>('PATCH', `/api/lernen/zusatz/${id}.${z.id}`, { gelesen });
      setDaten((d) => d && { ...d, thema: { ...d.thema, zusatz: d.thema.zusatz.map((x) => (x.id === z.id ? { ...x, gelesen } : x)) } });
      setFelder((fs) => fs.map((f) => (f.id === id ? { ...f, zusatz: f.zusatz.map((x) => (x.id === z.id ? { ...x, gelesen } : x)) } : f)));
      melde(gelesen ? `„${z.titel}“ ist als gelesen abgehakt.` : `Haken bei „${z.titel}“ entfernt.`);
      nachSpeichern(r);
    },
    [id, nachSpeichern],
  );

  // Sprung aus dem Kompendium oder von einer Vertiefung (#u-… / #z-…): hinrollen und – beim Zusatzwissen – den Inhalt aufklappen; einmal, sobald die Seite steht
  const gesprungen = useRef('');
  useEffect(() => {
    if (!daten || daten.thema.id !== id || gesprungen.current === id) return;
    gesprungen.current = id;
    const marke = decodeURIComponent(window.location.hash.slice(1));
    const ziel = /^[uz]-/.test(marke) ? document.getElementById(marke) : null;
    if (!ziel) return;
    ziel.querySelector<HTMLDetailsElement>('details.lern-zusatz-inhalt')?.setAttribute('open', '');
    ziel.scrollIntoView();
  }, [daten, id]);

  const geladen = daten?.thema.id === id ? daten : null;
  const aktiv = useAktivesUnterthema(geladen?.thema ?? null);

  if (fehler) return <Ladefehler titel="Lernen" text={fehler} />;
  if (!daten) return <p className="leise">Lädt …</p>;
  // Handy und Tablet: Die Navigation steht als Zeile unter der Kopfzeile, bleibt beim Rollen stehen und klappt nach einer Auswahl wieder zu (wie im Handbuch)
  const zu = () => setNaviOffen(false);
  const navi = felder.length > 0 && <ThemenNavi felder={felder} id={id} aktiv={aktiv} onGewaehlt={zu} />;
  const hier = geladen ? [...geladen.thema.unterthemen.map((u) => ({ marke: `u-${u.id}`, titel: u.titel })), ...geladen.thema.zusatz.map((x) => ({ marke: `z-${x.id}`, titel: x.titel }))].find((x) => x.marke === aktiv)?.titel : undefined;

  return (
    <div className="lern-layout">
      {navi && (
        <aside className="karte lern-navi" aria-label={anleitungen ? 'Anleitungen' : 'Themenfelder'}>
          <h2>{anleitungen ? 'Anleitungen' : 'Themenfelder'}</h2>
          {navi}
        </aside>
      )}
      <div className="lern-haupt">
        <p className="klein">
          <Link zu={basis}>{anleitungen ? '← Alle Anleitungen' : '← Alle Themenfelder'}</Link>
        </p>
        {navi && (
          <details className="karte lern-navi-klapp nicht-drucken" open={naviOffen} onToggle={(e) => setNaviOffen(e.currentTarget.open)}>
            <summary>
              <span className="handbuch-kopf">
                <span>Inhalt</span>
                {/* angeheftet zeigt die Zeile, wo man gerade liest */}
                {!naviOffen && geladen && (
                  <span className="handbuch-wo">
                    {geladen.thema.titel}
                    {hier ? ` › ${hier}` : ''}
                  </span>
                )}
              </span>
            </summary>
            <nav aria-label={anleitungen ? 'Anleitungen' : 'Themenfelder'}>{navi}</nav>
          </details>
        )}
        {geladen ? <ThemaInhalt t={geladen.thema} paket={geladen.paket} abzeichen={felder.find((f) => f.id === id)?.abzeichen ?? geladen.thema.abzeichen} aendere={aendere} setzeGelesen={setzeGelesen} /> : <p className="leise">Lädt …</p>}
        {erfolg && <AbzeichenFeier erfolg={erfolg} onZu={schliesseErfolg} />}
      </div>
    </div>
  );
}

interface NavFeld {
  id: string;
  titel: string;
  unterthemen: { id: string; titel: string; status: LernStatus }[];
  zusatz: { id: string; titel: string; gelesen: boolean }[];
  abzeichen: FeldAbzeichen;
}

/** Welches Unterthema oder Zusatzwissen steht gerade oben im Fenster (als Sprungmarke „u-…“ / „z-…“)? Für die Markierung in der Navigation. */
function useAktivesUnterthema(t: Thema | null): string | null {
  const [aktiv, setAktiv] = useState<string | null>(null);
  useEffect(() => {
    if (!t) return;
    let wartet = 0;
    const miss = () => {
      wartet = 0;
      let treffer: string | null = null;
      for (const marke of [...t.unterthemen.map((u) => `u-${u.id}`), ...t.zusatz.map((z) => `z-${z.id}`)]) {
        const el = document.getElementById(marke);
        if (el && el.getBoundingClientRect().top <= 160) treffer = marke;
      }
      setAktiv(treffer);
    };
    const beiRollen = () => {
      if (!wartet) wartet = requestAnimationFrame(miss);
    };
    miss();
    window.addEventListener('scroll', beiRollen, { passive: true });
    return () => {
      window.removeEventListener('scroll', beiRollen);
      if (wartet) cancelAnimationFrame(wartet);
    };
  }, [t]);
  return aktiv;
}

/** Navigation am Rand: alle Themenfelder mit Stand; beim geöffneten Themenfeld darunter seine Unterthemen. */
function ThemenNavi({ felder, id, aktiv, onGewaehlt }: { felder: NavFeld[]; id: string; aktiv: string | null; onGewaehlt?: () => void }) {
  const { basis, lesen, anleitungen } = useLern();
  const springe = (ziel: string) => {
    onGewaehlt?.();
    // erst zuklappen lassen, dann rollen – sonst stimmt das Ziel nicht, solange die aufgeklappte Navigation noch Platz einnimmt
    requestAnimationFrame(() => document.getElementById(ziel)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
  };
  return (
    <ul className="lern-navi-liste">
      {felder.map((f) => {
        const z = zaehle(f.unterthemen);
        const a = ampelVon(z);
        return (
          <li key={f.id}>
            <Link zu={`${basis}/${f.id}`} className="lern-navi-feld">
              {!lesen && <span className={`lern-punkt ${a}`} aria-hidden="true" />}
              <span className="lern-navi-titel">
                {f.titel}
                {!lesen && <span className="nur-vorleser">, {AMPEL_TEXT[a]}</span>}
              </span>
              {!lesen && <span className="lern-navi-prozent">{prozent(z)} %</span>}
            </Link>
            {f.id === id && (
              <ul className="lern-navi-unter" aria-label={`Unterthemen: ${f.titel}`}>
                {f.unterthemen.map((u) => (
                  <li key={u.id}>
                    <button type="button" aria-current={aktiv === `u-${u.id}` ? 'location' : undefined} onClick={() => springe(`u-${u.id}`)}>
                      {!lesen && <span className={`lern-punkt klein ${u.status}`} aria-hidden="true" />}
                      <span>
                        {u.titel}
                        {!lesen && <span className="nur-vorleser">, {AMPEL_TEXT[u.status]}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {f.id === id && f.zusatz.length > 0 && (
              <>
                <p className="lern-navi-zwischen">{anleitungen ? 'Zum Vertiefen' : 'Zusatzwissen'}</p>
                <ul className="lern-navi-unter" aria-label={`Zusatzwissen: ${f.titel}`}>
                  {f.zusatz.map((z) => (
                    <li key={z.id}>
                      <button type="button" aria-current={aktiv === `z-${z.id}` ? 'location' : undefined} onClick={() => springe(`z-${z.id}`)}>
                        <Icon name={z.gelesen ? 'haken' : 'stern'} />
                        <span>
                          {z.titel}
                          {z.gelesen && <span className="nur-vorleser">, gelesen</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ThemaInhalt({ t, paket, abzeichen, aendere, setzeGelesen }: { t: Thema; paket: LernPaket; abzeichen: FeldAbzeichen; aendere: (unterthema: string, p: Aenderung) => Promise<void>; setzeGelesen: (z: Zusatz, gelesen: boolean) => Promise<void> }) {
  const z = zaehle(t.unterthemen);
  const { lesen, anleitungen } = useLern();
  return (
    <>
      <h1>
        {t.titel} {!lesen && <StatusPille status={ampelVon(z)} />}
      </h1>
      <div className="lern-kopf">
        <span className="lern-marken">
          {t.lernfelder.map((l) => (
            <span key={l} className="pille grau">
              {l}
            </span>
          ))}
          {t.pruefung.map((p) => (
            <span key={p} className="pille blau">
              {p}
            </span>
          ))}
        </span>
        {!lesen && (
          <span className="lern-kachel-stand">
            <StapelBalken z={z} />
            <span>{prozent(z)} %</span>
          </span>
        )}
        <span className="leise klein">{anleitungen ? `${z.n} Abschnitte` : lesen ? `${z.n} Unterthemen` : `${z.n} Unterthemen: ${zusammenfassung(z)}`}</span>
      </div>
      <section className="karte abz-feld" hidden={lesen} aria-label="Abzeichen in diesem Themenfeld">
        <Schild stufe={abzeichen.stufe} groesse={64} />
        <div>
          <strong>{abzeichen.name ? `Abzeichen: ${abzeichen.name}` : 'Noch kein Abzeichen'}</strong>
          <div className="abz-balken" role="img" aria-label={`${abzeichen.fortschritt} Prozent des Wegs zur nächsten Stufe`}>
            <i style={{ width: `${abzeichen.fortschritt}%` }} />
          </div>
          <span className="leise klein">
            {abzeichen.fehlt} <HandbuchLink kapitel="abzeichen">Abzeichen sammeln</HandbuchLink>
          </span>
        </div>
      </section>

      {t.worum && (
        <section className="karte">
          <h2>Worum geht’s</h2>
          <p>
            <Inline text={t.worum} />
          </p>
        </section>
      )}

      <h2 className="abschnitt-titel">{anleitungen ? 'Schritt für Schritt' : 'Unterthemen'}</h2>
      {anleitungen ? (
        <p className="leise">
          Zum Lesen und Nachschlagen – ohne Ampel und ohne Abzeichen. <HandbuchLink kapitel="anleitungen">Anleitungen lesen</HandbuchLink>
        </p>
      ) : lesen ? (
        <p className="leise">
          So sehen die Azubis die Inhalte. Bei ihnen steht an jedem Unterthema zusätzlich die Ampel und ein Feld für Notizen. <HandbuchLink kapitel="lernansicht">Lerninhalte ansehen</HandbuchLink>
        </p>
      ) : (
        <p className="leise">
          Stell bei jedem Unterthema ein, wie sicher du bist. Bei „In Arbeit“ notierst du, was noch hakt. <HandbuchLink kapitel="lernen">So nutzt du die Ampel</HandbuchLink>
        </p>
      )}
      {t.unterthemen.map((u, i) => (
        <UnterthemaKarte key={`${t.id}.${u.id}`} feld={t.id} u={u} nr={i + 1} von={t.unterthemen.length} aendere={(p) => aendere(u.id, p)} />
      ))}

      {t.fehler.length > 0 && (
        <section className="karte">
          <h2>Häufige Fehler</h2>
          <ul className="punkte">
            {t.fehler.map((f, i) => (
              <li key={i}>
                <Inline text={f} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <ZusatzBereich feld={t.id} zusatz={t.zusatz} setzeGelesen={setzeGelesen} />

      {t.links.length > 0 && (
        <section className="karte">
          <h2>Weiterführende Links</h2>
          <ul className="punkte">
            {t.links.map((l) => (
              <li key={l.url}>
                <a href={l.url} target="_blank" rel="noopener noreferrer">
                  {l.titel}
                </a>
                <span className="nur-vorleser"> (öffnet in neuem Fenster)</span>
                {l.info && <span className="leise"> – {l.info}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <PaketFuss p={paket} />
    </>
  );
}

function UnterthemaKarte({ feld, u, nr, von, aendere }: { feld: string; u: Unterthema; /** Stelle im Themenfeld, ab 1 */ nr: number; von: number; aendere: (p: Aenderung) => Promise<void> }) {
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState('');
  const { basis, lesen, anleitungen } = useLern();
  const tue = async (p: Aenderung, bestaetigung?: string) => {
    setLaeuft(true);
    setFehler('');
    try {
      await aendere(p);
      if (bestaetigung) melde(bestaetigung);
      return true;
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Das hat nicht geklappt.');
      return false;
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <section className={`karte lern-unterthema ${lesen ? 'lesen' : u.status}`} id={`u-${u.id}`}>
      <div className="lern-unterthema-kopf">
        <h3>
          <span className="lern-nr" aria-hidden="true">
            {nr}
          </span>
          <span className="nur-vorleser">
            Unterthema {nr} von {von}:{' '}
          </span>
          {u.titel}
          {!u.hatInhalt && <span className="pille grau">Cheatsheet folgt</span>}
          {u.vertiefung.length > 0 && <span className="pille blau">Vertiefung</span>}
        </h3>
        {!lesen && <AmpelSchalter titel={u.titel} status={u.status} gesperrt={laeuft} onChange={(s) => {
            // erst fragen, dann umstellen – ein versehentlicher Klick ändert nichts. Gespeichert wird danach ohne weitere Meldung: Die Ampel zeigt den neuen Stand.
            void rueckfrage(`Ampel umstellen?\n\n„${u.titel}“ steht auf „${AMPEL_TEXT[u.status]}“ und wechselt auf „${AMPEL_TEXT[s]}“.`, { ja: `Auf „${AMPEL_TEXT[s]}“ stellen` }).then((ja) => ja && tue({ status: s }));
          }}
        />}
      </div>
      {!lesen && <p className="leise klein lern-regel">{AMPEL_REGEL[u.status]}</p>}
      {fehler && (
        <p className="hinweis fehler" role="alert">
          {fehler}
        </p>
      )}

      {!lesen && u.inhaltAktualisiert && (
        <p className="hinweis lern-neu">
          <span>Der Inhalt wurde aktualisiert – ein zweiter Blick lohnt sich.</span>
          <button type="button" className="knopf schlicht" disabled={laeuft} onClick={() => void tue({ bestaetigen: true })}>
            Als gesehen merken
          </button>
        </p>
      )}

      {!lesen && u.status === 'gelb' && (
        <TextMitSpeichern
          klasse="lern-lernpunkt"
          label="Lernpunkt: Was fällt dir noch schwer? Was willst du dir nochmal ansehen?"
          platzhalter="z. B. Blockgröße bei /27 üben"
          wert={u.luecke}
          knopf="Lernpunkt speichern"
          hinweis="Bleibt gespeichert, auch wenn du später auf „Sicher“ stellst."
          onSpeichern={(text) => tue({ luecke: text }, 'Lernpunkt gespeichert.')}
        />
      )}

      {u.vertiefung.length > 0 && (
        <div className="lern-vertiefung">
          <strong>
            <Icon name="stern" /> {anleitungen ? 'Mehr dazu weiter unten' : 'Vertiefung im Zusatzwissen'}
          </strong>
          <ul>
            {u.vertiefung.map((v) => (
              <li key={`${v.feld}.${v.id}`}>
                {v.feld === feld ? (
                  <a href={`#z-${v.id}`}>{v.titel}</a>
                ) : (
                  <Link zu={`${basis}/${v.feld}#z-${v.id}`}>
                    {v.titel} <span className="leise">({v.feldTitel})</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {u.hatInhalt ? (
        // das Cheatsheet steht offen da – man liest ein Themenfeld von oben nach unten, ohne jedes Unterthema aufzuklappen
        <div className="lern-cheatsheet">
          <Inhalt u={u} />
        </div>
      ) : (
        <p className="leise">Zu diesem Unterthema gibt es noch kein Cheatsheet.{lesen ? '' : ' Du kannst dir trotzdem eine Notiz machen.'}</p>
      )}

      <details className="klapp" open={u.notiz !== '' || undefined} hidden={lesen}>
        <summary>Meine Notiz</summary>
        <TextMitSpeichern label="Notiz (nur für dich)" platzhalter="z. B. in der Berufsschule nachfragen" wert={u.notiz} knopf="Notiz speichern" onSpeichern={(text) => tue({ notiz: text }, 'Notiz gespeichert.')} />
      </details>
    </section>
  );
}

/** Textfeld mit eigenem Speichern-Knopf; fragt beim Verlassen nach, solange etwas ungespeichert ist. */
function TextMitSpeichern({ label, platzhalter, wert, knopf, hinweis, klasse, onSpeichern }: { label: string; platzhalter: string; wert: string; knopf: string; hinweis?: string; klasse?: string; onSpeichern: (text: string) => Promise<boolean> }) {
  const [text, setText] = useState(wert);
  const [laeuft, setLaeuft] = useState(false);
  const offen = text.trim() !== wert.trim();
  useUngespeichert(offen);
  return (
    <form
      className={`lern-text ${klasse ?? ''}`}
      onSubmit={(e) => {
        e.preventDefault();
        setLaeuft(true);
        void onSpeichern(text).finally(() => setLaeuft(false));
      }}
    >
      <label>
        {label}
        <textarea rows={2} maxLength={2000} value={text} placeholder={platzhalter} onChange={(e) => setText(e.target.value)} />
      </label>
      {hinweis && <p className="leise klein">{hinweis}</p>}
      <div className="aktionen links">
        <button className="knopf schlicht" disabled={!offen || laeuft}>
          {knopf}
        </button>
      </div>
    </form>
  );
}

function Inhalt({ u }: { u: Unterthema }) {
  return (
    <div className="lern-inhalt">
      {u.begriffe.length > 0 && (
        <div>
          <h4>Kernbegriffe</h4>
          <dl className="lern-begriffe">
            {u.begriffe.map((b) => (
              <div key={b.begriff}>
                <dt>
                  <Inline text={b.begriff} />
                </dt>
                <dd>
                  <Inline text={b.erklaerung} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {u.abbildungen.map((a) => (
        <div key={a.titel}>
          <h4>{a.titel}</h4>
          <div className="lern-grafiken">
            {a.bilder.map((b) => (
              <Grafik key={b.datei} bild={b} />
            ))}
          </div>
        </div>
      ))}
      {u.tabellen.map((t) => (
        <div key={t.titel}>
          <h4>{t.titel}</h4>
          <TabelleAnsicht t={t} />
        </div>
      ))}
      {u.befehle.length > 0 && (
        <div>
          <h4>Befehle</h4>
          <ul className="lern-befehle">
            {u.befehle.map((b) => (
              <li key={b.befehl}>
                <code>{b.befehl}</code>
                {b.info && <span className="leise"> {b.info}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {u.merksatz && (
        <div className="lern-merksatz">
          <Icon name="hilfe" />
          <div>
            <strong>Merksatz</strong>
            <p>
              <Inline text={u.merksatz} />
            </p>
          </div>
        </div>
      )}
      {u.frage && (
        <div className="lern-frage">
          <h4>Typische Prüfungsfrage</h4>
          <p>
            <strong>
              <Inline text={u.frage.frage} />
            </strong>
          </p>
          <details className="klapp">
            <summary>Lösungsweg</summary>
            <ol>
              {u.frage.loesung.map((l, i) => (
                <li key={i}>
                  <Inline text={l} />
                </li>
              ))}
            </ol>
          </details>
        </div>
      )}
    </div>
  );
}
