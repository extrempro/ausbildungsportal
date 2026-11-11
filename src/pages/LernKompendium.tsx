import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api';
import { Ladefehler } from '../dialoge';
import { HandbuchLink } from '../handbuchLink';
import { Icon } from '../icons';
import { Inline, LernReiter, TabelleAnsicht } from '../lernen/teile';
import type { Tabelle } from '../lernen/teile';
import { Link } from '../router';
import { PaketFuss } from './Lernen';
import type { LernPaket } from './Lernen';

type Typ = 'begriff' | 'befehl' | 'tabelle' | 'merksatz' | 'frage' | 'zusatz';

interface Eintrag {
  typ: Typ;
  titel: string;
  text: string;
  tabelle?: Tabelle;
  loesung?: string[];
  abschnitte?: string[];
  volltext?: string;
  feld: string;
  sub: string;
  subTitel: string;
}

interface Daten {
  paket: LernPaket;
  themenfelder: { id: string; titel: string }[];
  eintraege: Eintrag[];
}

const TYPEN: Typ[] = ['begriff', 'befehl', 'tabelle', 'merksatz', 'frage', 'zusatz'];
const TYP_TEXT: Record<Typ, string> = { begriff: 'Begriff', befehl: 'Befehl', tabelle: 'Tabelle', merksatz: 'Merksatz', frage: 'Prüfungsfrage', zusatz: 'Zusatzwissen' };
const TYP_MEHRZAHL: Record<Typ, string> = { begriff: 'Begriffe', befehl: 'Befehle', tabelle: 'Tabellen', merksatz: 'Merksätze', frage: 'Prüfungsfragen', zusatz: 'Zusatzwissen' };
const TYP_FARBE: Record<Typ, string> = { begriff: 'blau', befehl: 'grau', tabelle: 'grau', merksatz: 'gelb', frage: 'gruen', zusatz: 'violett' };

/** Kleinbuchstaben, Umlaute vereinheitlicht, Auszeichnung entfernt – damit „Schluessel“ auch „Schlüssel“ findet. */
function normalisiere(s: string): string {
  return s
    .toLowerCase()
    .replace(/[`*]/g, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function buchstabeVon(titel: string): string {
  const c = titel
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .charAt(0)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  return /[A-Z]/.test(c) ? c : '#';
}

/** Hebt die Suchwörter im Text hervor. Ohne Suche bleibt die Auszeichnung der Inhalte (Code, fett) erhalten. */
function Treffer({ text, suche }: { text: string; suche: string }) {
  const woerter = suche.trim().split(/\s+/).filter((w) => w.length > 1);
  if (!woerter.length) return <Inline text={text} />;
  const re = new RegExp(`(${woerter.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const teile: ReactNode[] = text
    .replace(/[`*]/g, '')
    .split(re)
    .map((t, i) => (i % 2 === 1 ? <mark key={i}>{t}</mark> : t));
  return <>{teile}</>;
}

/** Suche und Filter bleiben erhalten, wenn man zu einem Cheatsheet springt und zurückkommt. */
let gemerkt: { suche: string; typ: Typ | null; feld: string } = { suche: '', typ: null, feld: '' };

/** Lernen – Kompendium: alle Begriffe, Befehle, Tabellen, Merksätze und Prüfungsfragen zum Nachschlagen. */
export function LernKompendium() {
  const [daten, setDaten] = useState<Daten | null>(null);
  const [fehler, setFehler] = useState('');
  const [filter, setFilter] = useState(gemerkt);
  const { suche, typ, feld } = filter;
  const setze = (neu: Partial<typeof gemerkt>) => setFilter((f) => (gemerkt = { ...f, ...neu }));

  useEffect(() => {
    api<Daten>('GET', '/api/lernen/kompendium').then(setDaten, (e: Error) => setFehler(e.message));
  }, []);

  const alle = useMemo(() => {
    if (!daten) return [];
    const feldTitel = new Map(daten.themenfelder.map((f) => [f.id, f.titel]));
    return daten.eintraege.map((e, i) => {
      const mehr = e.tabelle ? [...e.tabelle.kopf, ...e.tabelle.zeilen.flat()].join(' ') : (e.volltext ?? (e.loesung ?? []).join(' '));
      const ft = feldTitel.get(e.feld) ?? '';
      return { ...e, nr: i, feldTitel: ft, buchstabe: buchstabeVon(e.titel), such: normalisiere(`${e.titel} ${e.text} ${mehr} ${e.subTitel} ${ft}`) };
    });
  }, [daten]);

  // alle Suchwörter müssen vorkommen
  const woerter = useMemo(() => normalisiere(suche).split(/\s+/).filter(Boolean), [suche]);
  const ohneTyp = useMemo(() => alle.filter((e) => (!feld || e.feld === feld) && woerter.every((w) => e.such.includes(w))), [alle, feld, woerter]);
  const gefiltert = useMemo(() => (typ ? ohneTyp.filter((e) => e.typ === typ) : ohneTyp), [ohneTyp, typ]);
  const gruppen = useMemo(() => {
    const m = new Map<string, typeof gefiltert>();
    for (const e of gefiltert) m.set(e.buchstabe, [...(m.get(e.buchstabe) ?? []), e]);
    return [...m.entries()].sort(([a], [b]) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)));
  }, [gefiltert]);

  if (fehler) return <Ladefehler titel="Kompendium" text={fehler} />;
  if (!daten) return <p className="leise">Lädt …</p>;
  const hatFilter = suche !== '' || typ !== null || feld !== '';

  return (
    <>
      <h1>Kompendium</h1>
      <LernReiter />
      <p className="leise">
        Zum Nachschlagen: {alle.length} Einträge aus allen Cheatsheets – Begriffe, Befehle, Tabellen, Merksätze, Prüfungsfragen und Zusatzwissen. <HandbuchLink kapitel="kompendium">Im Kompendium nachschlagen</HandbuchLink>
      </p>

      <section className="karte komp-filter" aria-label="Suche und Filter">
        <div className="komp-felder">
          <label>
            Suchen
            <input type="search" value={suche} onChange={(e) => setze({ suche: e.target.value })} placeholder="z. B. Subnetz, DHCP, chmod" autoComplete="off" />
          </label>
          <label>
            Themenfeld
            <select value={feld} onChange={(e) => setze({ feld: e.target.value })}>
              <option value="">Alle Themenfelder</option>
              {daten.themenfelder.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.titel}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="knopf schlicht" disabled={!hatFilter} onClick={() => setze({ suche: '', typ: null, feld: '' })}>
            Filter zurücksetzen
          </button>
        </div>
        <div className="filter" role="group" aria-label="Nach Art filtern">
          <button type="button" className="knopf schlicht" aria-pressed={typ === null} onClick={() => setze({ typ: null })}>
            Alle ({ohneTyp.length})
          </button>
          {TYPEN.map((t) => (
            <button key={t} type="button" className="knopf schlicht" aria-pressed={typ === t} onClick={() => setze({ typ: t })}>
              {TYP_MEHRZAHL[t]} ({ohneTyp.filter((e) => e.typ === t).length})
            </button>
          ))}
        </div>
        {gruppen.length > 1 && (
          <nav className="komp-buchstaben" aria-label="Zum Buchstaben springen">
            {gruppen.map(([b]) => (
              <a key={b} href={`#k-${b}`}>
                {b}
              </a>
            ))}
          </nav>
        )}
      </section>

      <p className="leise klein" role="status" aria-live="polite">
        {gefiltert.length === alle.length ? `${alle.length} Einträge` : `${gefiltert.length} von ${alle.length} Einträgen`}
      </p>

      {gruppen.length === 0 && <p className="hinweis">Nichts gefunden. Versuch es mit einem anderen Wort oder setz die Filter zurück.</p>}
      {gruppen.map(([b, eintraege]) => (
        <section key={b} id={`k-${b}`} className="komp-gruppe" aria-labelledby={`k-${b}-titel`}>
          <h2 id={`k-${b}-titel`}>{b === '#' ? '0–9 und Zeichen' : b}</h2>
          <ul className="karte komp-liste">
            {eintraege.map((e) => (
              <li key={e.nr}>
                <div className="komp-kopf">
                  {e.typ === 'befehl' ? (
                    <code>
                      <Treffer text={e.titel} suche={suche} />
                    </code>
                  ) : (
                    <strong>
                      <Treffer text={e.titel} suche={suche} />
                    </strong>
                  )}
                  <span className={`pille ${TYP_FARBE[e.typ]}`}>{TYP_TEXT[e.typ]}</span>
                </div>
                {e.typ === 'merksatz' ? (
                  <p className="komp-merksatz">
                    <Icon name="hilfe" />
                    <span>
                      <Treffer text={e.text} suche={suche} />
                    </span>
                  </p>
                ) : (
                  e.text && (
                    <p className="leise">
                      <Treffer text={e.text} suche={suche} />
                    </p>
                  )
                )}
                {e.tabelle && <TabelleAnsicht t={e.tabelle} />}
                {e.loesung && (
                  <details className="klapp">
                    <summary>Lösungsweg</summary>
                    <ol>
                      {e.loesung.map((l, i) => (
                        <li key={i}>
                          <Inline text={l} />
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
                {e.abschnitte && e.abschnitte.length > 0 && (
                  <p className="lern-marken">
                    {e.abschnitte.map((a) => (
                      <span key={a} className="pille grau">
                        {a}
                      </span>
                    ))}
                  </p>
                )}
                <p className="klein komp-weg">
                  <Link zu={`/lernen/${e.feld}#${e.typ === 'zusatz' ? 'z' : 'u'}-${e.sub}`}>
                    {e.typ === 'zusatz' ? 'Zum Zusatzwissen' : 'Zum Cheatsheet'}: {e.feldTitel} › {e.typ === 'zusatz' ? e.titel : e.subTitel}
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <PaketFuss p={daten.paket} />
    </>
  );
}
