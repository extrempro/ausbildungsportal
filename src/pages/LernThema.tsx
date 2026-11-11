import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Ladefehler, melde } from '../dialoge';
import { HandbuchLink } from '../handbuchLink';
import { Icon } from '../icons';
import { AMPEL_REGEL, ampelVon, prozent, zaehle, zusammenfassung } from '../lernen/ampel';
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

  useEffect(() => {
    api<{ paket: LernPaket; thema: Thema }>('GET', `/api/lernen/thema/${encodeURIComponent(id)}`).then(setDaten, (e: Error) => setFehler(e.message));
  }, [id]);

  const aendere = useCallback(
    async (unterthema: string, patch: Aenderung) => {
      const r = await api<Pick<Unterthema, 'status' | 'luecke' | 'notiz' | 'geaendert' | 'inhaltAktualisiert'>>('PATCH', `/api/lernen/unterthema/${id}.${unterthema}`, patch);
      // die Antwort nennt die volle Kennung (themenfeld.unterthema) – hier zählt nur der neue Stand
      const stand = { status: r.status, luecke: r.luecke, notiz: r.notiz, geaendert: r.geaendert, inhaltAktualisiert: r.inhaltAktualisiert };
      setDaten((d) => d && { ...d, thema: { ...d.thema, unterthemen: d.thema.unterthemen.map((u) => (u.id === unterthema ? { ...u, ...stand } : u)) } });
    },
    [id],
  );

  if (fehler) return <Ladefehler titel="Lernen" text={fehler} />;
  if (!daten) return <p className="leise">Lädt …</p>;
  const t = daten.thema;
  const z = zaehle(t.unterthemen);

  return (
    <>
      <p className="klein">
        <Link zu="/lernen">← Alle Themenfelder</Link>
      </p>
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
        <UnterthemaKarte key={u.id} u={u} aendere={(p) => aendere(u.id, p)} />
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
      <PaketFuss p={daten.paket} />
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
        <AmpelSchalter titel={u.titel} status={u.status} gesperrt={laeuft} onChange={(s) => void tue({ status: s })} />
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
        <details className="klapp">
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
