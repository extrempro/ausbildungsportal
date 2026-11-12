import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api, datum, h } from '../api';
import { Ladefehler, melde } from '../dialoge';
import { HandbuchLink } from '../handbuchLink';
import { useUngespeichert } from '../router';

/**
 * Planer für das Prüfungsvorhaben (Abschlussprojekt, Gesellenstück …) – nur für den Azubi selbst.
 * Was hier steht, kommt aus dem Inhaltspaket des Berufs (planer.md); gespeichert werden nur die Eintragungen.
 */
interface Termin {
  id: string;
  label: string;
  hinweis: string;
}
interface Punkt {
  id: string;
  text: string;
  hilfe: string;
}
interface Checkliste {
  art: 'checkliste';
  id: string;
  titel: string;
  gruppen: { titel: string; punkte: Punkt[] }[];
}
interface Zeitplanung {
  art: 'zeitplanung';
  titel: string;
  hoechststunden: number | null;
  hinweis: string;
}
interface Fragen {
  art: 'fragen';
  id: string;
  titel: string;
  einleitung: string;
  timerMinuten: number | null;
  fragen: { id: string; text: string }[];
}
interface Inhalt {
  titel: string;
  untertitel: string;
  einleitung: string;
  nameFeld: string;
  nameBeispiel: string;
  auftraggeberFeld: string;
  auftraggeberBeispiel: string;
  termineEinleitung: string;
  termine: Termin[];
  abschnitte: (Checkliste | Zeitplanung | Fragen)[];
  links: { titel: string; url: string; info: string }[];
}
interface Phase {
  name: string;
  soll: number;
  ist: number;
}
interface Daten {
  name: string;
  auftraggeber: string;
  termine: Record<string, string>;
  haken: Record<string, true>;
  phasen: Phase[];
  phasenVorschlag: boolean;
  antworten: Record<string, string>;
  notizen: string;
}
interface Antwort {
  planer: Inhalt;
  daten: Daten;
}
type Sende = (methode: string, pfad: string, body: unknown, meldung?: string) => Promise<void>;

const heute = () => new Date().toLocaleDateString('sv-SE');
const tageBis = (tag: string) => Math.round((Date.parse(tag) - Date.parse(heute())) / 86_400_000);
const punkteVon = (c: Checkliste) => c.gruppen.flatMap((g) => g.punkte);
const erledigt = (c: Checkliste, d: Daten) => punkteVon(c).filter((p) => d.haken[`${c.id}.${p.id}`]).length;

export function Planer() {
  const [d, setD] = useState<Antwort | null>(null);
  const [ladefehler, setLadefehler] = useState('');

  useEffect(() => {
    api<Antwort>('GET', '/api/planer')
      .then(setD)
      .catch((e: Error) => setLadefehler(e.message));
  }, []);

  // jede Änderung liefert den ganzen Stand zurück; Fehler zeigt der Abschnitt, der gespeichert hat
  const sende: Sende = useCallback(async (methode, pfad, body, meldung) => {
    setD(await api<Antwort>(methode, pfad, body));
    if (meldung) melde(meldung);
  }, []);

  if (ladefehler) return <Ladefehler titel="Planer" text={ladefehler} />;
  if (!d) return <p className="leise">Lädt …</p>;
  const { planer: p, daten } = d;
  const listen = p.abschnitte.filter((a): a is Checkliste => a.art === 'checkliste');
  const zeit = p.abschnitte.find((a): a is Zeitplanung => a.art === 'zeitplanung');
  const geplant = daten.phasen.reduce((n, x) => n + x.soll, 0);
  const naechster = p.termine
    .map((t) => ({ ...t, tag: daten.termine[t.id] ?? '' }))
    .filter((t) => t.tag && t.tag >= heute())
    .sort((a, b) => a.tag.localeCompare(b.tag))[0];

  return (
    <>
      <h1>{p.titel}</h1>
      <p className="leise">
        {p.einleitung || 'Hier planst du dein Prüfungsvorhaben Schritt für Schritt.'} Was du einträgst, siehst nur du – außer den Terminen: Sie stehen auch in deinem Ausbildungsplan.{' '}
        <HandbuchLink kapitel="planer">So funktioniert der Planer</HandbuchLink>
      </p>

      <div className="planer-oben">
        <section className="karte">
          {p.untertitel && <p className="planer-untertitel">{p.untertitel}</p>}
          <Angaben p={p} daten={daten} sende={sende} />
          {(listen.length > 0 || zeit) && (
            <div className="planer-stand">
              {listen.map((c) => (
                <Stand key={c.id} label={c.titel} wert={erledigt(c, daten)} gesamt={punkteVon(c).length} />
              ))}
              {zeit && (zeit.hoechststunden !== null ? <Stand label="Stunden geplant" wert={geplant} gesamt={zeit.hoechststunden} einheit="h" /> : <Stand label="Stunden geplant" wert={geplant} gesamt={null} einheit="h" />)}
            </div>
          )}
        </section>
        <section className="karte planer-naechstes">
          <h2>Als Nächstes</h2>
          {naechster ? (
            <>
              <p className="planer-naechstes-was">{naechster.label}</p>
              <p className="planer-naechstes-tage">
                {tageBis(naechster.tag) === 0 ? 'Heute' : tageBis(naechster.tag)} {tageBis(naechster.tag) !== 0 && <span>{tageBis(naechster.tag) === 1 ? 'Tag' : 'Tage'}</span>}
              </p>
              <p className="leise klein">
                {datum(naechster.tag)}
                {naechster.hinweis ? ` · ${naechster.hinweis}` : ''}
              </p>
            </>
          ) : (
            <p className="leise klein">{p.termine.length > 0 ? 'Trag unten deine Termine ein. Dann steht hier, was als Nächstes ansteht.' : 'Für diesen Planer gibt es keine Termine.'}</p>
          )}
          {p.links.length > 0 && (
            <ul className="planer-links">
              {p.links.map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer">
                    {l.titel}
                  </a>
                  {l.info && <span className="leise klein"> – {l.info}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {p.termine.length > 0 && <Termine p={p} daten={daten} sende={sende} />}

      {p.abschnitte.map((a) =>
        a.art === 'checkliste' ? (
          <ChecklisteKarte key={a.id} c={a} daten={daten} sende={sende} />
        ) : a.art === 'zeitplanung' ? (
          <ZeitKarte key="zeit" z={a} daten={daten} sende={sende} />
        ) : (
          <FragenKarte key={a.id} f={a} daten={daten} sende={sende} />
        ),
      )}

      <Klappe titel="Notizen" zusatz={daten.notizen ? 'nur für dich' : 'noch leer'} anfangsOffen={daten.notizen !== ''}>
        <TextMitSpeichern label="Notizen (nur für dich)" platzhalter="Ideen, offene Fragen, Links …" wert={daten.notizen} zeilen={6} max={20000} knopf="Notizen speichern" onSpeichern={(text) => sende('PUT', '/api/planer/notizen', { text }, 'Notizen gespeichert.')} />
      </Klappe>
    </>
  );
}

function Fehler({ text }: { text: string }) {
  return text ? (
    <p className="hinweis fehler" role="alert">
      {text}
    </p>
  ) : null;
}

/** Karte zum Aufklappen, die sich merkt, was der Nutzer zuletzt wollte – auch wenn sich die Daten ändern. */
function Klappe({ titel, zusatz, anfangsOffen, children }: { titel: string; zusatz?: string; anfangsOffen: boolean; children: ReactNode }) {
  const [offen, setOffen] = useState(anfangsOffen);
  return (
    <details className="karte" open={offen} onToggle={(e) => setOffen(e.currentTarget.open)}>
      <summary>
        <span className="planer-kopf">
          <span>{titel}</span>
          {zusatz && <span className="planer-zusatz">{zusatz}</span>}
        </span>
      </summary>
      {children}
    </details>
  );
}

function Stand({ label, wert, gesamt, einheit }: { label: string; wert: number; gesamt: number | null; einheit?: string }) {
  const zuViel = gesamt !== null && wert > gesamt;
  const e = einheit ? ` ${einheit}` : '';
  return (
    <div className="planer-stand-feld">
      <span className="leise klein">{label}</span>
      <strong className={zuViel ? 'planer-zu-viel' : undefined}>
        {h(wert)}
        {e}
        {gesamt !== null && ` von ${h(gesamt)}${e}`}
        {zuViel && ' – zu viel'}
      </strong>
      {gesamt !== null && (
        <div className="balken" aria-hidden="true">
          <span style={{ width: `${gesamt > 0 ? Math.min(100, (wert / gesamt) * 100) : 0}%` }} />
        </div>
      )}
    </div>
  );
}

function Angaben({ p, daten, sende }: { p: Inhalt; daten: Daten; sende: Sende }) {
  const [name, setName] = useState(daten.name);
  const [auftraggeber, setAuftraggeber] = useState(daten.auftraggeber);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState('');
  const offen = name.trim() !== daten.name || auftraggeber.trim() !== daten.auftraggeber;
  useUngespeichert(offen);
  return (
    <form
      className="planer-angaben"
      onSubmit={(e) => {
        e.preventDefault();
        setLaeuft(true);
        setFehler('');
        sende('PUT', '/api/planer/angaben', { name, auftraggeber }, 'Angaben gespeichert.')
          .catch((x: Error) => setFehler(x.message))
          .finally(() => setLaeuft(false));
      }}
    >
      <label>
        {p.nameFeld}
        <input value={name} maxLength={300} placeholder={p.nameBeispiel} onChange={(e) => setName(e.target.value)} />
      </label>
      {p.auftraggeberFeld && (
        <label>
          {p.auftraggeberFeld}
          <input value={auftraggeber} maxLength={300} placeholder={p.auftraggeberBeispiel} onChange={(e) => setAuftraggeber(e.target.value)} />
        </label>
      )}
      <Fehler text={fehler} />
      <div className="aktionen links">
        <button className="knopf" disabled={!offen || laeuft}>
          Angaben speichern
        </button>
      </div>
    </form>
  );
}

function Termine({ p, daten, sende }: { p: Inhalt; daten: Daten; sende: Sende }) {
  const [werte, setWerte] = useState<Record<string, string>>(() => Object.fromEntries(p.termine.map((t) => [t.id, daten.termine[t.id] ?? ''])));
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState('');
  const offen = p.termine.some((t) => (werte[t.id] ?? '') !== (daten.termine[t.id] ?? ''));
  useUngespeichert(offen);
  const eingetragen = p.termine.filter((t) => daten.termine[t.id]).length;
  return (
    <Klappe titel="Termine" zusatz={`${eingetragen} von ${p.termine.length} eingetragen`} anfangsOffen>
      <p className="leise klein">
        {p.termineEinleitung} Die Termine stehen auch in deinem Ausbildungsplan. Dort sehen sie auch deine Ausbilder und Ausbildungsbeauftragten – sie bekommen eine Nachricht, wenn du Termine änderst.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setLaeuft(true);
          setFehler('');
          sende('PUT', '/api/planer/termine', { termine: werte }, 'Termine gespeichert.')
            .catch((x: Error) => setFehler(x.message))
            .finally(() => setLaeuft(false));
        }}
      >
        <div className="raster">
          {p.termine.map((t) => (
            <div key={t.id}>
              <label>
                {t.label}
                <input type="date" min="2000-01-01" max="2099-12-31" aria-describedby={t.hinweis ? `planer-termin-${t.id}` : undefined} value={werte[t.id] ?? ''} onChange={(e) => setWerte({ ...werte, [t.id]: e.target.value })} />
              </label>
              {t.hinweis && (
                <p className="planer-feldhinweis" id={`planer-termin-${t.id}`}>
                  {t.hinweis}
                </p>
              )}
            </div>
          ))}
        </div>
        <Fehler text={fehler} />
        <div className="aktionen links">
          <button className="knopf" disabled={!offen || laeuft}>
            Termine speichern
          </button>
        </div>
      </form>
    </Klappe>
  );
}

function ChecklisteKarte({ c, daten, sende }: { c: Checkliste; daten: Daten; sende: Sende }) {
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fehler, setFehler] = useState('');
  const fertig = erledigt(c, daten);
  const gesamt = punkteVon(c).length;
  return (
    <Klappe titel={c.titel} zusatz={`${fertig} von ${gesamt} erledigt`} anfangsOffen={fertig < gesamt}>
      <Fehler text={fehler} />
      <div className="planer-gruppen">
        {c.gruppen.map((g, i) => (
          <div key={g.titel || i}>
            {g.titel && <h3>{g.titel}</h3>}
            <ul className="planer-punkte">
              {g.punkte.map((x) => {
                const id = `${c.id}.${x.id}`;
                const an = !!daten.haken[id];
                return (
                  <li key={x.id}>
                    <label className="haken planer-punkt">
                      <input
                        type="checkbox"
                        // der Haken springt sofort um; scheitert das Speichern, springt er zurück und der Fehler steht oben
                        checked={laeuft === id ? !an : an}
                        disabled={laeuft !== null}
                        onChange={() => {
                          setLaeuft(id);
                          setFehler('');
                          sende('PATCH', '/api/planer/haken', { id, an: !an })
                            .catch((e: Error) => setFehler(e.message))
                            .finally(() => setLaeuft(null));
                        }}
                      />
                      <span>
                        <span className={an ? 'planer-erledigt' : undefined}>{x.text}</span>
                        {an && <span className="nur-vorleser"> (erledigt)</span>}
                        {x.hilfe && <span className="planer-hilfe">{x.hilfe}</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </Klappe>
  );
}

const zahl = (v: string) => Math.max(0, Math.min(2000, Number(v.replace(',', '.')) || 0));

function ZeitKarte({ z, daten, sende }: { z: Zeitplanung; daten: Daten; sende: Sende }) {
  const [phasen, setPhasen] = useState<Phase[]>(daten.phasen);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState('');
  const geaendert = JSON.stringify(phasen) !== JSON.stringify(daten.phasen);
  useUngespeichert(geaendert);
  const soll = phasen.reduce((n, x) => n + x.soll, 0);
  const ist = phasen.reduce((n, x) => n + x.ist, 0);
  const max = z.hoechststunden;
  const setze = (i: number, x: Partial<Phase>) => setPhasen(phasen.map((p, j) => (j === i ? { ...p, ...x } : p)));
  return (
    <Klappe titel={z.titel} zusatz={`${h(soll)} ${max !== null ? `von ${h(max)} ` : ''}Stunden geplant · ${h(ist)} tatsächlich`} anfangsOffen>
      {z.hinweis && <p className="leise klein">{z.hinweis}</p>}
      {daten.phasenVorschlag && <p className="hinweis">Das ist ein Vorschlag. Pass die Phasen und Stunden an dein Vorhaben an und speichere sie.</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setLaeuft(true);
          setFehler('');
          sende('PUT', '/api/planer/phasen', { phasen }, 'Zeitplanung gespeichert.')
            .catch((x: Error) => setFehler(x.message))
            .finally(() => setLaeuft(false));
        }}
      >
        <table className="stapel planer-zeit">
          <thead>
            <tr>
              <th>Phase</th>
              <th>Geplant (Stunden)</th>
              <th>Tatsächlich (Stunden)</th>
              <th>
                <span className="nur-vorleser">Entfernen</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {phasen.map((p, i) => (
              <tr key={i}>
                <td data-label="Phase">
                  <input aria-label={`Name der Phase ${i + 1}`} value={p.name} maxLength={120} required onChange={(e) => setze(i, { name: e.target.value })} />
                </td>
                <td data-label="Geplant (Stunden)">
                  <input type="number" min={0} max={2000} step={0.25} aria-label={`Geplante Stunden: ${p.name}`} value={p.soll || ''} onChange={(e) => setze(i, { soll: zahl(e.target.value) })} />
                </td>
                <td data-label="Tatsächlich (Stunden)">
                  <input type="number" min={0} max={2000} step={0.25} aria-label={`Tatsächliche Stunden: ${p.name}`} value={p.ist || ''} onChange={(e) => setze(i, { ist: zahl(e.target.value) })} />
                </td>
                <td>
                  <button type="button" className="knopf schlicht klein" aria-label={`Phase „${p.name}“ entfernen`} onClick={() => setPhasen(phasen.filter((_, j) => j !== i))}>
                    Entfernen
                  </button>
                </td>
              </tr>
            ))}
            <tr className="planer-summe">
              <td data-label="">Summe</td>
              <td data-label="Geplant (Stunden)" className={max !== null && soll > max ? 'planer-zu-viel' : undefined}>
                {h(soll)}
              </td>
              <td data-label="Tatsächlich (Stunden)" className={max !== null && ist > max ? 'planer-zu-viel' : undefined}>
                {h(ist)}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
        {max !== null && soll > max && (
          <p className="hinweis" role="status">
            {h(soll - max)} Stunden zu viel geplant – höchstens {h(max)} Stunden sind erlaubt.
          </p>
        )}
        <Fehler text={fehler} />
        <div className="aktionen links">
          <button className="knopf" disabled={(!geaendert && !daten.phasenVorschlag) || laeuft}>
            Zeitplanung speichern
          </button>
          <button type="button" className="knopf schlicht" disabled={phasen.length >= 20} onClick={() => setPhasen([...phasen, { name: '', soll: 0, ist: 0 }])}>
            Phase hinzufügen
          </button>
        </div>
      </form>
    </Klappe>
  );
}

function FragenKarte({ f, daten, sende }: { f: Fragen; daten: Daten; sende: Sende }) {
  const [aktiv, setAktiv] = useState<string | null>(null);
  const notiert = f.fragen.filter((x) => daten.antworten[`${f.id}.${x.id}`]).length;
  return (
    <Klappe titel={f.titel} zusatz={f.fragen.length > 0 ? `${notiert} von ${f.fragen.length} mit Stichworten` : undefined} anfangsOffen={false}>
      {f.einleitung && <p className="leise klein">{f.einleitung}</p>}
      <div className={f.timerMinuten !== null && f.fragen.length > 0 ? 'planer-fragen mit-uhr' : 'planer-fragen'}>
        {f.timerMinuten !== null && <Uhr minuten={f.timerMinuten} />}
        {f.fragen.length > 0 && (
          <div>
            <div className="aktionen links">
              <button
                type="button"
                className="knopf schlicht"
                onClick={() => {
                  const rest = f.fragen.filter((x) => x.id !== aktiv);
                  setAktiv(rest[Math.floor(Math.random() * rest.length)]?.id ?? null);
                }}
              >
                Zufällige Frage öffnen
              </button>
            </div>
            {f.fragen.map((x) => {
              const id = `${f.id}.${x.id}`;
              const text = daten.antworten[id] ?? '';
              return (
                <details className="klapp" key={x.id} open={aktiv === x.id} onToggle={(e) => (e.currentTarget.open ? setAktiv(x.id) : aktiv === x.id && setAktiv(null))}>
                  <summary>
                    {x.text}
                    {text && <span className="pille gruen planer-notiert">Stichworte notiert</span>}
                  </summary>
                  <TextMitSpeichern label="Deine Stichworte (nur für dich)" platzhalter="Was würdest du antworten?" wert={text} zeilen={3} max={3000} knopf="Stichworte speichern" onSpeichern={(t) => sende('PUT', '/api/planer/antwort', { id, text: t }, 'Stichworte gespeichert.')} />
                </details>
              );
            })}
          </div>
        )}
      </div>
    </Klappe>
  );
}

/** Uhr zum Üben eines Vortrags: zählt herunter, warnt in den letzten zwei Minuten und zeigt, wie weit überzogen wurde. */
function Uhr({ minuten }: { minuten: number }) {
  const dauer = minuten * 60;
  const [rest, setRest] = useState(dauer);
  const [laeuft, setLaeuft] = useState(false);
  useEffect(() => {
    if (!laeuft) return;
    const t = window.setInterval(() => setRest((r) => r - 1), 1000);
    return () => window.clearInterval(t);
  }, [laeuft]);
  const ueber = rest < 0;
  const abs = Math.abs(rest);
  const anzeige = `${ueber ? '+' : ''}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
  const stand = ueber ? 'Zeit überschritten' : rest <= 120 && rest < dauer ? 'Zum Schluss kommen' : laeuft ? 'läuft' : rest === dauer ? 'bereit' : 'angehalten';
  return (
    <div className="planer-uhr">
      <h3>Vortrag üben ({minuten} Minuten)</h3>
      <div className={`planer-uhr-zeit ${ueber ? 'ueber' : rest <= 120 && rest < dauer ? 'knapp' : ''}`} role="timer" aria-label={`Restzeit ${anzeige}, ${stand}`}>
        <strong>{anzeige}</strong>
        <span>{stand}</span>
      </div>
      <div className="aktionen links">
        <button type="button" className="knopf" onClick={() => setLaeuft(!laeuft)}>
          {laeuft ? 'Uhr anhalten' : rest === dauer ? 'Uhr starten' : 'Uhr weiterlaufen lassen'}
        </button>
        <button
          type="button"
          className="knopf schlicht"
          disabled={rest === dauer && !laeuft}
          onClick={() => {
            setLaeuft(false);
            setRest(dauer);
          }}
        >
          Uhr zurücksetzen
        </button>
      </div>
    </div>
  );
}

/** Textfeld mit eigenem Speichern-Knopf; fragt beim Verlassen nach, solange etwas ungespeichert ist. */
function TextMitSpeichern({ label, platzhalter, wert, zeilen, max, knopf, onSpeichern }: { label: string; platzhalter: string; wert: string; zeilen: number; max: number; knopf: string; onSpeichern: (text: string) => Promise<void> }) {
  const [text, setText] = useState(wert);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState('');
  const offen = text.trim() !== wert.trim();
  useUngespeichert(offen);
  return (
    <form
      className="lern-text"
      onSubmit={(e) => {
        e.preventDefault();
        setLaeuft(true);
        setFehler('');
        onSpeichern(text)
          .catch((x: Error) => setFehler(x.message))
          .finally(() => setLaeuft(false));
      }}
    >
      <label>
        {label}
        <textarea rows={zeilen} maxLength={max} value={text} placeholder={platzhalter} onChange={(e) => setText(e.target.value)} />
      </label>
      <Fehler text={fehler} />
      <div className="aktionen links">
        <button className="knopf schlicht" disabled={!offen || laeuft}>
          {knopf}
        </button>
      </div>
    </form>
  );
}
