import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { Ladefehler, melde } from '../dialoge';
import { HandbuchLink } from '../handbuchLink';
import { Icon } from '../icons';
import { AMPEL_REGEL, AMPEL_TEXT, ampelVon, prozent, zaehle, zusammenfassung } from '../lernen/ampel';
import type { LernStatus } from '../lernen/ampel';
import { AmpelSchalter, Grafik, Inline, StapelBalken, StatusPille, TabelleAnsicht } from '../lernen/teile';
import type { Bild, Tabelle } from '../lernen/teile';
import { Link, useUngespeichert } from '../router';
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
}

type Aenderung = { status?: LernStatus; luecke?: string; notiz?: string; bestaetigen?: true };

/** Lernen – ein Themenfeld: Cheatsheet je Unterthema mit Ampel, Lernpunkt und Notiz. */
export function LernThema({ id }: { id: string }) {
  const [daten, setDaten] = useState<{ paket: LernPaket; thema: Thema } | null>(null);
  const [fehler, setFehler] = useState('');
  // alle Themenfelder mit dem eigenen Stand – für die Navigation am Rand
  const [felder, setFelder] = useState<NavFeld[]>([]);

  useEffect(() => {
    api<{ themenfelder: NavFeld[] }>('GET', '/api/lernen').then((r) => setFelder(r.themenfelder), () => undefined);
  }, []);

  useEffect(() => {
    let aktuell = true;
    setFehler('');
    api<{ paket: LernPaket; thema: Thema }>('GET', `/api/lernen/thema/${encodeURIComponent(id)}`).then(
      (d) => aktuell && setDaten(d),
      (e: Error) => aktuell && setFehler(e.message),
    );
    return () => {
      aktuell = false;
    };
  }, [id]);

  const aendere = useCallback(
    async (unterthema: string, patch: Aenderung) => {
      const r = await api<Pick<Unterthema, 'status' | 'luecke' | 'notiz' | 'geaendert' | 'inhaltAktualisiert'>>('PATCH', `/api/lernen/unterthema/${id}.${unterthema}`, patch);
      // die Antwort nennt die volle Kennung (themenfeld.unterthema) – hier zählt nur der neue Stand
      const stand = { status: r.status, luecke: r.luecke, notiz: r.notiz, geaendert: r.geaendert, inhaltAktualisiert: r.inhaltAktualisiert };
      setDaten((d) => d && { ...d, thema: { ...d.thema, unterthemen: d.thema.unterthemen.map((u) => (u.id === unterthema ? { ...u, ...stand } : u)) } });
      setFelder((fs) => fs.map((f) => (f.id === id ? { ...f, unterthemen: f.unterthemen.map((u) => (u.id === unterthema ? { ...u, status: r.status } : u)) } : f)));
    },
    [id],
  );

  // Sprung aus dem Kompendium (#u-…): zum Unterthema rollen und dessen Cheatsheet aufklappen – einmal, sobald die Seite steht
  const gesprungen = useRef('');
  useEffect(() => {
    if (!daten || daten.thema.id !== id || gesprungen.current === id) return;
    gesprungen.current = id;
    const marke = decodeURIComponent(window.location.hash.slice(1));
    const ziel = marke.startsWith('u-') ? document.getElementById(marke) : null;
    if (!ziel) return;
    ziel.querySelector<HTMLDetailsElement>('details.lern-cheatsheet')?.setAttribute('open', '');
    ziel.scrollIntoView();
  }, [daten, id]);

  const geladen = daten?.thema.id === id ? daten : null;
  const aktiv = useAktivesUnterthema(geladen?.thema ?? null);

  if (fehler) return <Ladefehler titel="Lernen" text={fehler} />;
  if (!daten) return <p className="leise">Lädt …</p>;
  const navi = felder.length > 0 && <ThemenNavi felder={felder} id={id} aktiv={aktiv} />;

  return (
    <div className="lern-layout">
      {navi && (
        <aside className="karte lern-navi" aria-label="Themenfelder">
          <h2>Themenfelder</h2>
          {navi}
        </aside>
      )}
      <div className="lern-haupt">
        <p className="klein">
          <Link zu="/lernen">← Alle Themenfelder</Link>
        </p>
        {navi && (
          <details className="klapp lern-navi-klapp">
            <summary>Themenfeld wechseln</summary>
            {navi}
          </details>
        )}
        {geladen ? <ThemaInhalt t={geladen.thema} paket={geladen.paket} aendere={aendere} /> : <p className="leise">Lädt …</p>}
      </div>
    </div>
  );
}

interface NavFeld {
  id: string;
  titel: string;
  unterthemen: { id: string; titel: string; status: LernStatus }[];
}

/** Welches Unterthema steht gerade oben im Fenster? Für die Markierung in der Navigation. */
function useAktivesUnterthema(t: Thema | null): string | null {
  const [aktiv, setAktiv] = useState<string | null>(null);
  useEffect(() => {
    if (!t) return;
    let wartet = 0;
    const miss = () => {
      wartet = 0;
      let treffer: string | null = null;
      for (const u of t.unterthemen) {
        const el = document.getElementById(`u-${u.id}`);
        if (el && el.getBoundingClientRect().top <= 140) treffer = u.id;
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
function ThemenNavi({ felder, id, aktiv }: { felder: NavFeld[]; id: string; aktiv: string | null }) {
  const springe = (ziel: string) => document.getElementById(ziel)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  return (
    <ul className="lern-navi-liste">
      {felder.map((f) => {
        const z = zaehle(f.unterthemen);
        const a = ampelVon(z);
        return (
          <li key={f.id}>
            <Link zu={`/lernen/${f.id}`} className="lern-navi-feld">
              <span className={`lern-punkt ${a}`} aria-hidden="true" />
              <span className="lern-navi-titel">
                {f.titel}
                <span className="nur-vorleser">, {AMPEL_TEXT[a]}</span>
              </span>
              <span className="lern-navi-prozent">{prozent(z)} %</span>
            </Link>
            {f.id === id && (
              <ul className="lern-navi-unter" aria-label={`Unterthemen: ${f.titel}`}>
                {f.unterthemen.map((u) => (
                  <li key={u.id}>
                    <button type="button" aria-current={aktiv === u.id ? 'location' : undefined} onClick={() => springe(`u-${u.id}`)}>
                      <span className={`lern-punkt klein ${u.status}`} aria-hidden="true" />
                      <span>
                        {u.titel}
                        <span className="nur-vorleser">, {AMPEL_TEXT[u.status]}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ThemaInhalt({ t, paket, aendere }: { t: Thema; paket: LernPaket; aendere: (unterthema: string, p: Aenderung) => Promise<void> }) {
  const z = zaehle(t.unterthemen);
  return (
    <>
      <h1>
        {t.titel} <StatusPille status={ampelVon(z)} />
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
        <span className="lern-kachel-stand">
          <StapelBalken z={z} />
          <span>{prozent(z)} %</span>
        </span>
        <span className="leise klein">
          {z.n} Unterthemen: {zusammenfassung(z)}
        </span>
      </div>

      {t.worum && (
        <section className="karte">
          <h2>Worum geht’s</h2>
          <p>
            <Inline text={t.worum} />
          </p>
        </section>
      )}

      <h2 className="abschnitt-titel">Unterthemen</h2>
      <p className="leise">
        Stell bei jedem Unterthema ein, wie sicher du bist. Bei „In Arbeit“ notierst du, was noch hakt. <HandbuchLink kapitel="lernen">So nutzt du die Ampel</HandbuchLink>
      </p>
      {t.unterthemen.map((u) => (
        <UnterthemaKarte key={`${t.id}.${u.id}`} u={u} aendere={(p) => aendere(u.id, p)} />
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

function UnterthemaKarte({ u, aendere }: { u: Unterthema; aendere: (p: Aenderung) => Promise<void> }) {
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState('');
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
    <section className={`karte lern-unterthema ${u.status}`} id={`u-${u.id}`}>
      <div className="lern-unterthema-kopf">
        <h3>
          {u.titel}
          {!u.hatInhalt && <span className="pille grau">Cheatsheet folgt</span>}
        </h3>
        <AmpelSchalter titel={u.titel} status={u.status} gesperrt={laeuft} onChange={(s) => void tue({ status: s }, `„${u.titel}“ steht jetzt auf „${AMPEL_TEXT[s]}“.`)} />
      </div>
      <p className="leise klein lern-regel">{AMPEL_REGEL[u.status]}</p>
      {fehler && (
        <p className="hinweis fehler" role="alert">
          {fehler}
        </p>
      )}

      {u.inhaltAktualisiert && (
        <p className="hinweis lern-neu">
          <span>Der Inhalt wurde aktualisiert – ein zweiter Blick lohnt sich.</span>
          <button type="button" className="knopf schlicht" disabled={laeuft} onClick={() => void tue({ bestaetigen: true })}>
            Als gesehen merken
          </button>
        </p>
      )}

      {u.status === 'gelb' && (
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

      {u.hatInhalt ? (
        <details className="klapp lern-cheatsheet">
          <summary>Cheatsheet</summary>
          <Inhalt u={u} />
        </details>
      ) : (
        <p className="leise">Zu diesem Unterthema gibt es noch kein Cheatsheet. Du kannst dir trotzdem eine Notiz machen.</p>
      )}

      <details className="klapp" open={u.notiz !== '' || undefined}>
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
