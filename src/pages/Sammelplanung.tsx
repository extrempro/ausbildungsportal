import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { api, ART_TEXT, datum, PLAN_ARTEN, ROLLE_TEXT, zeit } from '../api';
import type { PlanArt, Planvorlage, Rolle } from '../api';
import { Link } from '../router';

/**
 * Sammelplanung: ein Eintrag oder ein Baustein für mehrere Azubis auf einmal –
 * gedacht für das, was wirklich bei mehreren gleich ist (Schulblöcke, gemeinsame Unterweisungen, Einführungswochen).
 */
interface SammelAzubi {
  id: number;
  anzeigename: string;
  beruf: string;
  berufsschule: string;
  ausbildungsjahr: number | null;
  phase: string;
  beginn: string | null;
  ende: string | null;
}
interface Daten {
  heute: string;
  azubis: SammelAzubi[];
  bausteine: Planvorlage[];
  personen: { id: number; anzeigename: string; rolle: Rolle }[];
  letzte: Lauf[];
}
/** Ein früherer Lauf der Sammelplanung und was davon noch im Plan steht */
interface Lauf {
  id: number;
  zeit: string;
  name: string;
  titel: string;
  azubis: number;
  eintraege: number;
  vorhanden: number;
  unveraendert: number;
}
interface Zurueck {
  entfernt: number;
  geblieben: { azubi: string; titel: string }[];
  letzte: Lauf[];
}
interface Ergebnis {
  laufId: number | null;
  letzte: Lauf[];
  eingetragen: number;
  ergebnis: { id: number; anzeigename: string; ok: boolean; anzahl: number; grund: string }[];
}

const jahrText = (a: SammelAzubi) => (a.ausbildungsjahr ? `${a.ausbildungsjahr}. Ausbildungsjahr` : a.phase === 'vor' ? 'beginnt noch' : a.phase === 'beendet' ? 'beendet' : 'ohne Ausbildungsbeginn');

export function Sammelplanung() {
  const [d, setD] = useState<Daten | null>(null);
  const [fehler, setFehler] = useState('');
  const [gewaehlt, setGewaehlt] = useState<Set<number>>(new Set());
  const [weise, setWeise] = useState<'eintrag' | 'baustein'>('eintrag');
  const [art, setArt] = useState<PlanArt>('schule');
  const [von, setVon] = useState('');
  const [bis, setBis] = useState('');
  const [titel, setTitel] = useState('');
  const [text, setText] = useState('');
  const [zustaendigId, setZustaendigId] = useState('');
  const [baustein, setBaustein] = useState('');
  const [ab, setAb] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [letzte, setLetzte] = useState<Lauf[]>([]);
  const [zurueck, setZurueck] = useState<{ titel: string; r: Zurueck } | null>(null);

  useEffect(() => {
    api<Daten>('GET', '/api/plan/sammel').then(
      (r) => {
        setD(r);
        setLetzte(r.letzte);
      },
      (e: Error) => setFehler(e.message),
    );
  }, []);

  // Schnellauswahl: alle, je Ausbildungsjahr, je Berufsschule, je Beruf (nur was es mehr als einmal gibt)
  const gruppen = useMemo(() => {
    if (!d) return [];
    const liste: { name: string; ids: number[] }[] = [];
    const sammle = (wert: (a: SammelAzubi) => string) => {
      const m = new Map<string, number[]>();
      for (const a of d.azubis) {
        const k = wert(a);
        if (k) m.set(k, [...(m.get(k) ?? []), a.id]);
      }
      return [...m.entries()].sort((x, y) => x[0].localeCompare(y[0], 'de'));
    };
    for (const [name, ids] of sammle((a) => (a.ausbildungsjahr ? `${a.ausbildungsjahr}. Ausbildungsjahr` : ''))) liste.push({ name, ids });
    const schulen = sammle((a) => a.berufsschule);
    if (schulen.length > 1) for (const [name, ids] of schulen) liste.push({ name, ids });
    const berufe = sammle((a) => a.beruf);
    if (berufe.length > 1) for (const [name, ids] of berufe) liste.push({ name, ids });
    return liste;
  }, [d]);

  if (fehler && !d) return <p className="hinweis fehler">{fehler}</p>;
  if (!d) return <p className="leise">Lädt …</p>;

  const schalte = (ids: number[]) => {
    const neu = new Set(gewaehlt);
    const alleDrin = ids.every((id) => neu.has(id));
    for (const id of ids) {
      if (alleDrin) neu.delete(id);
      else neu.add(id);
    }
    setGewaehlt(neu);
    setErgebnis(null);
  };
  const gewaehlterBaustein = d.bausteine.find((b) => String(b.id) === baustein);
  const mitPerson = art === 'einsatz' || art === 'aufgabe';
  const bereit = gewaehlt.size > 0 && (weise === 'eintrag' ? !!von && !!titel.trim() : !!baustein && !!ab);

  const sende = async (e: FormEvent) => {
    e.preventDefault();
    setLaeuft(true);
    setFehler('');
    setErgebnis(null);
    try {
      const azubiIds = [...gewaehlt];
      const body = weise === 'eintrag' ? { azubiIds, eintrag: { art, von, bis: bis || von, titel, text, zustaendigId: mitPerson && zustaendigId ? Number(zustaendigId) : null } } : { azubiIds, vorlageId: Number(baustein), ab };
      const r = await api<Ergebnis>('POST', '/api/plan/sammel', body);
      setErgebnis(r);
      setLetzte(r.letzte);
      setZurueck(null);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLaeuft(false);
    }
  };

  const nimmZurueck = async (l: Lauf) => {
    const bleibt = l.vorhanden - l.unveraendert;
    const frage =
      `Sammelplanung „${l.titel.replace(/[„“]/g, '')}“ vom ${zeit(l.zeit)} zurücknehmen?\n\n` +
      (l.unveraendert === 0 ? 'Alle Einträge wurden seitdem geändert – es wird nichts entfernt.' : `${l.unveraendert === 1 ? '1 Eintrag wird' : `${l.unveraendert} Einträge werden`} aus den Plänen entfernt.`) +
      (bleibt > 0 ? `\n${bleibt === 1 ? '1 Eintrag wurde' : `${bleibt} Einträge wurden`} seitdem geändert oder abgehakt und ${bleibt === 1 ? 'bleibt' : 'bleiben'} stehen.` : '');
    if (!window.confirm(frage)) return;
    setFehler('');
    try {
      const r = await api<Zurueck>('DELETE', `/api/plan/sammel/${l.id}`);
      setLetzte(r.letzte);
      setZurueck({ titel: l.titel, r });
      if (ergebnis?.laufId === l.id) setErgebnis(null);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Fehler');
    }
  };
  const laufVonEben = ergebnis?.laufId ? letzte.find((l) => l.id === ergebnis.laufId) : undefined;

  return (
    <>
      <p className="klein">
        <Link zu="/uebersicht">← Übersicht</Link>
      </p>
      <h1>Sammelplanung</h1>
      <p className="leise">
        Trage etwas in die Pläne mehrerer Azubis auf einmal ein – zum Beispiel einen Schulblock für eine Klasse oder die Einführungswoche für den neuen Jahrgang. Danach ist es in jedem Plan ein eigener Eintrag, den du dort einzeln ändern oder löschen kannst.
      </p>
      {d.azubis.length === 0 ? (
        <p className="karte leise">Es gibt noch keine Azubis.</p>
      ) : (
        <form onSubmit={sende} className="sammel">
          <section className="karte">
            <h2>
              <span className="ablauf-nr">1</span> Für wen?
            </h2>
            <div className="sammel-gruppen" role="group" aria-label="Schnellauswahl">
              <button type="button" className="knopf schlicht klein" aria-pressed={gewaehlt.size === d.azubis.length} onClick={() => schalte(d.azubis.map((a) => a.id))}>
                Alle ({d.azubis.length})
              </button>
              {gruppen.map((g) => (
                <button key={g.name} type="button" className="knopf schlicht klein" aria-pressed={g.ids.every((id) => gewaehlt.has(id))} onClick={() => schalte(g.ids)}>
                  {g.name} ({g.ids.length})
                </button>
              ))}
            </div>
            <ul className="sammel-azubis">
              {d.azubis.map((a) => (
                <li key={a.id}>
                  <label className="haken">
                    <input type="checkbox" checked={gewaehlt.has(a.id)} onChange={() => schalte([a.id])} />
                    <span>
                      <strong>{a.anzeigename}</strong>
                      <span className="leise klein">
                        {[jahrText(a), a.beruf, a.berufsschule].filter(Boolean).join(' · ')}
                        {a.beginn && a.ende ? ` · ${datum(a.beginn)}–${datum(a.ende)}` : ''}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="leise klein" aria-live="polite">
              {gewaehlt.size === 0 ? 'Noch niemand ausgewählt.' : `${gewaehlt.size} von ${d.azubis.length} ausgewählt.`}
            </p>
          </section>

          <section className="karte">
            <h2>
              <span className="ablauf-nr">2</span> Was?
            </h2>
            <div role="group" aria-label="Was soll eingetragen werden?" className="umschalter">
              <button type="button" aria-pressed={weise === 'eintrag'} onClick={() => setWeise('eintrag')}>
                Einzelner Eintrag
              </button>
              <button type="button" aria-pressed={weise === 'baustein'} onClick={() => setWeise('baustein')}>
                Baustein
              </button>
            </div>
            {weise === 'eintrag' ? (
              <div className="sammel-felder">
                <label>
                  Art
                  <select value={art} onChange={(e) => setArt(e.target.value as PlanArt)}>
                    {PLAN_ARTEN.map((a) => (
                      <option key={a} value={a}>
                        {ART_TEXT[a]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Von (Tag in der ersten Woche)
                  <input type="date" value={von} required onChange={(e) => setVon(e.target.value)} />
                </label>
                <label>
                  Bis (leer = nur diese Woche)
                  <input type="date" value={bis} min={von || undefined} onChange={(e) => setBis(e.target.value)} />
                </label>
                <label className="ganz">
                  Titel
                  <input value={titel} maxLength={120} required placeholder={art === 'schule' ? 'z. B. Berufsschule Block 2' : 'z. B. Einführungswoche'} onChange={(e) => setTitel(e.target.value)} />
                </label>
                <label className="ganz">
                  Beschreibung (freiwillig)
                  <textarea rows={2} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
                </label>
                {mitPerson && (
                  <label>
                    Zuständig (freiwillig)
                    <select value={zustaendigId} onChange={(e) => setZustaendigId(e.target.value)}>
                      <option value="">niemand</option>
                      {d.personen.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.anzeigename} ({ROLLE_TEXT[p.rolle]})
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <p className="leise klein ganz">Einträge gelten immer für ganze Wochen. Wer in dem Zeitraum nicht in der Ausbildung ist, wird ausgelassen.</p>
              </div>
            ) : d.bausteine.length === 0 ? (
              <p className="leise">
                Es gibt noch keine Bausteine. <Link zu="/verwaltung/vorlagen">Baustein anlegen</Link>
              </p>
            ) : (
              <div className="sammel-felder">
                <label>
                  Baustein
                  <select value={baustein} required onChange={(e) => setBaustein(e.target.value)}>
                    <option value="">– Baustein wählen –</option>
                    {d.bausteine.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.titel}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Ab der Woche vom
                  <input type="date" value={ab} required onChange={(e) => setAb(e.target.value)} />
                </label>
                {gewaehlterBaustein && (
                  <p className="leise klein ganz">
                    „{gewaehlterBaustein.titel}“ hat {gewaehlterBaustein.eintraege.length === 1 ? '1 Eintrag' : `${gewaehlterBaustein.eintraege.length} Einträge`}: {gewaehlterBaustein.eintraege.map((x) => x.titel).join(', ')}. Woche 1 des Bausteins ist die gewählte Woche.
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="karte">
            <h2>
              <span className="ablauf-nr">3</span> Eintragen
            </h2>
            {fehler && (
              <p className="hinweis fehler" role="alert">
                {fehler}
              </p>
            )}
            <button type="submit" className="knopf" disabled={!bereit || laeuft}>
              {laeuft ? 'Trägt ein …' : gewaehlt.size === 1 ? 'Bei 1 Azubi eintragen' : `Bei ${gewaehlt.size} Azubis eintragen`}
            </button>
            {!bereit && <p className="leise klein">Wähle mindestens einen Azubi und fülle Schritt 2 aus.</p>}
            {ergebnis && (
              <div role="status" className="sammel-ergebnis">
                <p className={`hinweis ${ergebnis.eingetragen > 0 ? 'gut' : 'fehler'}`}>
                  {ergebnis.eingetragen === 0 ? 'Bei niemandem eingetragen.' : `Bei ${ergebnis.eingetragen} von ${ergebnis.ergebnis.length} eingetragen.`}
                  {ergebnis.eingetragen > 0 && ' Ein zweiter Klick würde alles noch einmal eintragen.'}
                </p>
                {laufVonEben && (
                  <p>
                    <button type="button" className="knopf schlicht klein gefahr" onClick={() => void nimmZurueck(laufVonEben)}>
                      Das war ein Versehen – zurücknehmen
                    </button>
                  </p>
                )}
                <ul>
                  {ergebnis.ergebnis.map((x) => (
                    <li key={x.id} className={x.ok ? 'ok' : 'aus'}>
                      <span className={`pille ${x.ok ? 'gruen' : 'gelb'}`}>{x.ok ? 'eingetragen' : 'ausgelassen'}</span>
                      <Link zu={`/azubis/${x.id}/plan`}>{x.anzeigename}</Link>
                      {!x.ok && <span className="leise klein">{x.grund}</span>}
                      {x.ok && x.anzahl > 1 && <span className="leise klein">{x.anzahl} Einträge</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </form>
      )}

      {zurueck && (
        <div className={`hinweis ${zurueck.r.entfernt > 0 ? 'gut' : ''}`} role="status">
          <p>
            Zurückgenommen – {zurueck.titel}: {zurueck.r.entfernt === 1 ? '1 Eintrag' : `${zurueck.r.entfernt} Einträge`} entfernt.
            {zurueck.r.geblieben.length > 0 && ' Diese Einträge wurden seitdem geändert oder abgehakt und stehen noch im Plan:'}
          </p>
          {zurueck.r.geblieben.length > 0 && (
            <ul>
              {zurueck.r.geblieben.map((g, i) => (
                <li key={i}>
                  {g.azubi}: {g.titel}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {letzte.length > 0 && (
        <section className="karte" aria-label="Zuletzt eingetragen">
          <h2>Zuletzt eingetragen</h2>
          <p className="leise klein">
            Die letzten Sammelplanungen der vergangenen 30 Tage. „Zurücknehmen“ entfernt die Einträge wieder aus den Plänen – außer denen, die seitdem jemand geändert oder abgehakt hat.
          </p>
          <ul className="sammel-letzte">
            {letzte.map((l) => (
              <li key={l.id}>
                <span>
                  <strong>{l.titel}</strong>
                  <span className="leise klein">
                    {zeit(l.zeit)} · {l.name} · {l.azubis === 1 ? '1 Azubi' : `${l.azubis} Azubis`}, {l.eintraege === 1 ? '1 Eintrag' : `${l.eintraege} Einträge`}
                    {l.vorhanden !== l.eintraege && ` · noch ${l.vorhanden} im Plan`}
                    {l.vorhanden !== l.unveraendert && ` · ${l.vorhanden - l.unveraendert} seitdem geändert`}
                  </span>
                </span>
                <button type="button" className="knopf schlicht klein gefahr" onClick={() => void nimmZurueck(l)}>
                  Zurücknehmen
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
