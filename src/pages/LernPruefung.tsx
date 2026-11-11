import { useCallback, useEffect, useState } from 'react';
import { api, datum, ladeDatei } from '../api';
import { Ladefehler, melde, rueckfrage } from '../dialoge';
import { HandbuchLink } from '../handbuchLink';
import { useLern } from '../lernen/basis';
import { Inline, LernReiter, TabelleAnsicht } from '../lernen/teile';
import type { Tabelle } from '../lernen/teile';
import { Link, useUngespeichert } from '../router';
import { PaketFuss } from './Lernen';
import type { LernPaket } from './Lernen';

/**
 * Prüfung im Lernmodul: Übungssätze mit Auswertung (wie eine schriftliche Prüfung) und Unterlagen als PDF.
 * - Azubi: bearbeitet Übungssätze; ausgewertet wird auf dem Server, die Lösungen kommen erst mit dem Ergebnis. Ergebnisse privat.
 * - Leseansicht (Ausbilder, Beauftragte): alle Fragen mit Lösungen und alle Unterlagen, auch die Lösungsvorschläge.
 */
interface Satz {
  id: string;
  titel: string;
  gruppe: string;
  beschreibung: string;
  fragen: number;
  probetest: boolean;
  stand: { versuche: number; punkte: number; gesamt: number; besteProzent: number; am: string } | null;
}
interface Dokument {
  datei: string;
  titel: string;
  gruppe: string;
  nurBetreuung: boolean;
  groesse: number;
}
interface Uebersicht {
  paket: LernPaket;
  saetze: Satz[];
  dokumente: Dokument[];
}

const zahl = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
const mb = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`);

/** Gruppiert nach `gruppe`, Reihenfolge wie in den Inhalten. */
function gruppiere<T extends { gruppe: string }>(liste: T[]): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const x of liste) m.set(x.gruppe, [...(m.get(x.gruppe) ?? []), x]);
  return [...m.entries()];
}

function DokumentKnopf({ pfad, titel }: { pfad: string; titel: string }) {
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState('');
  return (
    <>
      <button
        type="button"
        className="knopf schlicht klein"
        aria-label={`PDF herunterladen: ${titel}`}
        aria-busy={laeuft || undefined}
        disabled={laeuft}
        onClick={() => {
          setLaeuft(true);
          setFehler('');
          ladeDatei(pfad)
            .then(() => melde('PDF heruntergeladen – es liegt bei deinen Downloads.'))
            .catch((e: unknown) => setFehler(e instanceof Error ? e.message : 'Das PDF ließ sich nicht laden.'))
            .finally(() => setLaeuft(false));
        }}
      >
        PDF herunterladen
      </button>
      {fehler && (
        <span className="hinweis fehler" role="alert">
          {fehler}
        </span>
      )}
    </>
  );
}

/** Übersicht: Übungssätze und Unterlagen. */
export function LernPruefung() {
  const { basis, api: quelle, lesen } = useLern();
  const [d, setD] = useState<Uebersicht | null>(null);
  const [fehler, setFehler] = useState('');
  useEffect(() => {
    api<Uebersicht>('GET', `${quelle}/pruefung`).then(setD, (e: Error) => setFehler(e.message));
  }, [quelle]);
  if (fehler) return <Ladefehler titel="Prüfung" text={fehler} />;
  if (!d) return <p className="leise">Lädt …</p>;
  return (
    <>
      {lesen && (
        <p className="klein">
          <Link zu="/lerninhalte">← Alle Lernmodule</Link>
        </p>
      )}
      <h1>Prüfung</h1>
      <LernReiter />
      <p className="leise">
        {lesen
          ? 'Übungssätze und Unterlagen zur Prüfungsvorbereitung – hier mit allen Lösungen. Die Ergebnisse der Azubis siehst du nicht.'
          : 'Übe mit Aufgaben wie in der echten Prüfung und lade alte Prüfungen als PDF herunter. Deine Ergebnisse siehst nur du.'}{' '}
        <HandbuchLink kapitel={lesen ? 'lernansicht' : 'pruefung'}>{lesen ? 'Lerninhalte ansehen' : 'Prüfung üben'}</HandbuchLink>
      </p>

      <h2>Übungssätze</h2>
      {d.saetze.length === 0 ? (
        <p className="leise">Für dieses Lernmodul gibt es noch keine Übungssätze.</p>
      ) : (
        gruppiere(d.saetze).map(([gruppe, saetze]) => (
          <section key={gruppe} className="karte">
            {gruppe && <h3 className="pruef-gruppe">{gruppe}</h3>}
            <ul className="ueben-quiz">
              {saetze.map((s) => (
                <li key={s.id}>
                  <span className="ueben-quiz-titel">
                    <strong>{s.titel}</strong>
                    <span className="leise klein">
                      {s.fragen} Fragen
                      {s.stand && ` · zuletzt ${zahl(s.stand.punkte)} von ${s.stand.gesamt} Punkten am ${datum(s.stand.am)} · bestes Ergebnis ${s.stand.besteProzent} %`}
                    </span>
                    {s.beschreibung && (
                      <span className="leise klein">
                        <Inline text={s.beschreibung} />
                      </span>
                    )}
                  </span>
                  {s.probetest && <span className="pille blau">Probetest</span>}
                  <Link zu={`${basis}/pruefung/${s.id}`} className="knopf schlicht klein" aria-label={`${lesen ? 'Fragen und Lösungen ansehen' : s.stand ? 'Übungssatz wiederholen' : 'Übungssatz starten'}: ${s.titel}`}>
                    {lesen ? 'Fragen und Lösungen ansehen' : s.stand ? 'Übungssatz wiederholen' : 'Übungssatz starten'}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <h2>Unterlagen</h2>
      {d.dokumente.length === 0 ? (
        <p className="leise">Für dieses Lernmodul gibt es noch keine Unterlagen.</p>
      ) : (
        gruppiere(d.dokumente).map(([gruppe, docs]) => (
          <details key={gruppe} className="karte klapp">
            <summary>
              {gruppe || 'Weitere Unterlagen'} <span className="leise klein">({docs.length})</span>
            </summary>
            <ul className="ueben-quiz">
              {docs.map((x) => (
                <li key={x.datei}>
                  <span className="ueben-quiz-titel">
                    <strong>{x.titel}</strong>
                    <span className="leise klein">PDF · {mb(x.groesse)}</span>
                  </span>
                  {x.nurBetreuung && <span className="pille gelb">Nur für Ausbilder und Beauftragte</span>}
                  <DokumentKnopf pfad={`${quelle}/dokument/${encodeURIComponent(x.datei)}`} titel={x.titel} />
                </li>
              ))}
            </ul>
          </details>
        ))
      )}
      {!lesen && d.dokumente.length > 0 && <p className="leise klein">Die Lösungsvorschläge der alten Prüfungen hat dein Ausbilder. Frag ihn, wenn du deine Lösung vergleichen willst.</p>}
      <PaketFuss p={d.paket} />
    </>
  );
}

interface Frage {
  schluessel: string;
  titel: string;
  quelle: string;
  absaetze: string[];
  punkte: string[];
  tabelle: Tabelle | null;
  art: 'auswahl' | 'zahl' | 'zuordnung';
  mehrfach: boolean;
  optionen: { nr: number; text: string }[];
  felder: { text: string; einheit: string }[];
  links: string[];
  rechts: string[];
}
interface Loesung {
  zu: string[];
  richtig: number[];
  werte: { wert: number; toleranz: number }[];
  zuordnung: string[];
  loesung: { absaetze: string[]; schritte: string[] };
}
type FrageMitLoesung = Frage & Loesung;
interface SatzDaten {
  id: string;
  titel: string;
  gruppe: string;
  beschreibung: string;
  probetest: boolean;
  fragen: (Frage | FrageMitLoesung)[];
}
interface Ergebnis {
  punkte: number;
  gesamt: number;
  prozent: number;
  note: { note: number; text: string };
  versuche: number;
  besteProzent: number;
  ergebnisse: (FrageMitLoesung & { antwort: unknown; anteil: number })[];
}
type Antwort = number[] | string[];

const mitLoesung = (f: Frage | FrageMitLoesung): f is FrageMitLoesung => 'loesung' in f;

/** Fragetext: Absätze, Liste, Tabelle. */
function FrageText({ f }: { f: Frage }) {
  return (
    <>
      {f.absaetze.map((a, i) => (
        <p key={i}>
          <Inline text={a} />
        </p>
      ))}
      {f.punkte.length > 0 && (
        <ul>
          {f.punkte.map((p, i) => (
            <li key={i}>
              <Inline text={p} />
            </li>
          ))}
        </ul>
      )}
      {f.tabelle && <TabelleAnsicht t={f.tabelle} />}
    </>
  );
}

/** Die richtige Antwort in Worten. */
function richtigeAntwort(f: FrageMitLoesung): string[] {
  if (f.art === 'auswahl') return f.richtig.map((i) => f.optionen.find((o) => o.nr === i)?.text ?? '');
  if (f.art === 'zahl') return f.werte.map((w, i) => `${f.felder[i].text ? `${f.felder[i].text}: ` : ''}${zahl(w.wert)}${f.felder[i].einheit ? ` ${f.felder[i].einheit}` : ''}${w.toleranz ? ` (± ${zahl(w.toleranz)})` : ''}`);
  return f.links.map((l, i) => `${l} → ${f.zuordnung[i]}`);
}

/** Die eigene Antwort in Worten (nach der Auswertung). */
function eigeneAntwort(f: FrageMitLoesung, a: unknown): string[] {
  const liste = Array.isArray(a) ? a : [];
  if (f.art === 'auswahl') return liste.length ? liste.map((i) => f.optionen.find((o) => o.nr === i)?.text ?? '?') : ['keine Antwort'];
  if (f.art === 'zahl') return f.felder.map((x, i) => `${x.text ? `${x.text}: ` : ''}${typeof liste[i] === 'string' && liste[i] !== '' ? (liste[i] as string) : '–'}${x.einheit ? ` ${x.einheit}` : ''}`);
  return f.links.map((l, i) => `${l} → ${typeof liste[i] === 'string' && liste[i] !== '' ? (liste[i] as string) : '–'}`);
}

function LoesungAnsicht({ f, basis }: { f: FrageMitLoesung; basis: string }) {
  return (
    <div className="ueben-hinten pruef-loesung">
      <p>
        <strong>Richtig:</strong>
      </p>
      <ul>
        {richtigeAntwort(f).map((t, i) => (
          <li key={i}>
            <Inline text={t} />
          </li>
        ))}
      </ul>
      {(f.loesung.absaetze.length > 0 || f.loesung.schritte.length > 0) && (
        <>
          <p>
            <strong>Lösungsweg:</strong>
          </p>
          {f.loesung.absaetze.map((a, i) => (
            <p key={i}>
              <Inline text={a} />
            </p>
          ))}
          {f.loesung.schritte.length > 0 && (
            <ol>
              {f.loesung.schritte.map((s, i) => (
                <li key={i}>
                  <Inline text={s} />
                </li>
              ))}
            </ol>
          )}
        </>
      )}
      {f.zu.length > 0 && (
        <p className="klein">
          Nachlesen:{' '}
          {f.zu.map((ref, i) => {
            const [feld, ut] = ref.split('.');
            return (
              <span key={ref}>
                {i > 0 && ', '}
                <Link zu={`${basis}/${feld}#u-${ut}`}>im Cheatsheet</Link>
              </span>
            );
          })}
        </p>
      )}
    </div>
  );
}

/** Eingabe zu einer Frage – je nach Antwortart. */
function Eingabe({ f, nr, wert, setze }: { f: Frage; nr: number; wert: Antwort | undefined; setze: (a: Antwort) => void }) {
  const name = `frage-${nr}`;
  if (f.art === 'auswahl') {
    const gewaehlt = (wert as number[] | undefined) ?? [];
    return (
      <fieldset className="pruef-optionen">
        <legend className="leise klein">{f.mehrfach ? 'Mehrere Antworten sind richtig.' : 'Eine Antwort ist richtig.'}</legend>
        {f.optionen.map((o) => (
          <label key={o.nr} className="pruef-option">
            <input
              type={f.mehrfach ? 'checkbox' : 'radio'}
              name={name}
              checked={gewaehlt.includes(o.nr)}
              onChange={(e) => setze(f.mehrfach ? (e.target.checked ? [...gewaehlt, o.nr] : gewaehlt.filter((x) => x !== o.nr)) : [o.nr])}
            />
            <span>
              <Inline text={o.text} />
            </span>
          </label>
        ))}
      </fieldset>
    );
  }
  const liste = (wert as string[] | undefined) ?? [];
  const aendere = (i: number, v: string) => {
    const neu = [...liste];
    while (neu.length <= i) neu.push('');
    neu[i] = v;
    setze(neu);
  };
  if (f.art === 'zahl') {
    return (
      <div className="pruef-felder">
        {f.felder.map((x, i) => (
          <label key={i} className="pruef-feld">
            <span>{x.text || 'Ergebnis'}</span>
            <span className="pruef-zahl">
              <input type="text" inputMode="decimal" autoComplete="off" value={liste[i] ?? ''} onChange={(e) => aendere(i, e.target.value)} />
              {x.einheit && <span>{x.einheit}</span>}
            </span>
          </label>
        ))}
        <p className="leise klein">Nur die Zahl eingeben – Komma oder Punkt geht beides.</p>
      </div>
    );
  }
  return (
    <div className="pruef-felder">
      {f.links.map((l, i) => (
        <label key={i} className="pruef-feld">
          <span>
            <Inline text={l} />
          </span>
          <select value={liste[i] ?? ''} onChange={(e) => aendere(i, e.target.value)}>
            <option value="">– bitte wählen –</option>
            {f.rechts.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

const beantwortet = (f: Frage, a: Antwort | undefined) => !!a && (f.art === 'auswahl' ? a.length > 0 : (a as string[]).some((x) => x.trim() !== ''));
const bewertung = (anteil: number) => (anteil >= 1 ? { text: 'Richtig', farbe: 'gruen' } : anteil > 0 ? { text: `Teilweise richtig (${Math.round(anteil * 100)} %)`, farbe: 'gelb' } : { text: 'Falsch', farbe: 'rot' });

/** Ein Übungssatz: bearbeiten und auswerten (Azubi) oder mit Lösungen lesen (Leseansicht). */
export function LernUebungssatz({ id }: { id: string }) {
  const { basis, api: quelle, lesen } = useLern();
  const [d, setD] = useState<SatzDaten | null>(null);
  const [fehler, setFehler] = useState('');
  const [antworten, setAntworten] = useState<Record<string, Antwort>>({});
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const lade = useCallback(() => {
    setD(null);
    setAntworten({});
    setErgebnis(null);
    api<SatzDaten>('GET', `${quelle}/pruefung/${encodeURIComponent(id)}`).then(setD, (e: Error) => setFehler(e.message));
  }, [id, quelle]);
  useEffect(() => lade(), [lade]);
  useUngespeichert(!lesen && Object.keys(antworten).length > 0 && !ergebnis);

  if (fehler && !d) return <Ladefehler titel="Übungssatz" text={fehler} />;
  if (!d) return <p className="leise">Lädt …</p>;

  const offen = d.fragen.filter((f) => !beantwortet(f, antworten[f.schluessel])).length;
  const auswerten = async () => {
    if (offen > 0 && !(await rueckfrage(`${offen} von ${d.fragen.length} Fragen sind noch ohne Antwort. Sie zählen dann als falsch.\n\nTrotzdem auswerten?`, { ja: 'Übungssatz auswerten' }))) return;
    setLaeuft(true);
    setFehler('');
    try {
      const r = await api<Ergebnis>('POST', `${quelle}/pruefung/${encodeURIComponent(id)}`, { antworten });
      setErgebnis(r);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Das hat nicht geklappt.');
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <>
      <p className="klein">
        <Link zu={`${basis}/pruefung`}>← Prüfung</Link>
      </p>
      <h1>{d.titel}</h1>
      <p className="leise">
        {d.gruppe && `${d.gruppe} · `}
        {d.fragen.length} Fragen. {d.beschreibung && <Inline text={d.beschreibung} />}{' '}
        {lesen ? 'Hier mit allen Lösungen.' : 'Beantworte alle Fragen und werte dann aus. Rechne auf Papier mit – wie in der Prüfung.'}{' '}
        <HandbuchLink kapitel={lesen ? 'lernansicht' : 'pruefung'}>{lesen ? 'Lerninhalte ansehen' : 'Prüfung üben'}</HandbuchLink>
      </p>

      {ergebnis && (
        <section className="karte ueben-ergebnis" aria-live="polite">
          <h2>
            {zahl(ergebnis.punkte)} von {ergebnis.gesamt} Punkten – {ergebnis.prozent} %
          </h2>
          <p>
            Nach dem IHK-Notenschlüssel wäre das <strong>„{ergebnis.note.text}“</strong> (Note {ergebnis.note.note}). Bestanden ist eine Prüfung ab 50 %. {ergebnis.versuche > 1 && `Dein bestes Ergebnis bisher: ${ergebnis.besteProzent} %.`}
          </p>
          <p className="leise">Unten siehst du zu jeder Frage deine Antwort, die richtige Lösung und den Lösungsweg.</p>
          <p className="aktionen links">
            <button type="button" className="knopf" onClick={lade}>
              Übungssatz wiederholen
            </button>
            <Link zu={`${basis}/pruefung`} className="knopf schlicht">
              Zurück zu „Prüfung“
            </Link>
          </p>
        </section>
      )}

      <ol className="pruef-fragen">
        {d.fragen.map((f, nr) => {
          const e = ergebnis?.ergebnisse.find((x) => x.schluessel === f.schluessel);
          const b = e && bewertung(e.anteil);
          return (
            <li key={f.schluessel} className="karte pruef-frage">
              <div className="antrag-kopf">
                <h2>
                  {nr + 1}. {f.titel}
                </h2>
                {b && <span className={`pille ${b.farbe}`}>{b.text}</span>}
              </div>
              {f.quelle && <p className="leise klein">Quelle: {f.quelle}</p>}
              <FrageText f={f} />
              {lesen && mitLoesung(f) ? (
                <>
                  {f.art === 'auswahl' && (
                    <ul>
                      {f.optionen.map((o) => (
                        <li key={o.nr}>
                          <Inline text={o.text} />
                        </li>
                      ))}
                    </ul>
                  )}
                  <LoesungAnsicht f={f} basis={basis} />
                </>
              ) : e ? (
                <>
                  <div className="pruef-eigene">
                    <p>
                      <strong>Deine Antwort:</strong>
                    </p>
                    <ul>
                      {eigeneAntwort(e, e.antwort).map((t, i) => (
                        <li key={i}>
                          <Inline text={t} />
                        </li>
                      ))}
                    </ul>
                  </div>
                  <LoesungAnsicht f={e} basis={basis} />
                </>
              ) : (
                <Eingabe f={f} nr={nr} wert={antworten[f.schluessel]} setze={(a) => setAntworten((x) => ({ ...x, [f.schluessel]: a }))} />
              )}
            </li>
          );
        })}
      </ol>

      {!lesen && !ergebnis && (
        <section className="karte">
          <p className="leise">{offen === 0 ? 'Alle Fragen sind beantwortet.' : `${offen} von ${d.fragen.length} Fragen sind noch ohne Antwort.`}</p>
          {fehler && (
            <p className="hinweis fehler" role="alert">
              {fehler}
            </p>
          )}
          <p className="aktionen links">
            <button type="button" className="knopf" disabled={laeuft} onClick={() => void auswerten()}>
              Übungssatz auswerten
            </button>
          </p>
        </section>
      )}
    </>
  );
}
