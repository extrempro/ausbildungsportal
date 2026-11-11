import { Ladefehler } from '../dialoge';
import { Fragment, useEffect, useState } from 'react';
import { api, plusTage } from '../api';
import type { Uebersicht } from '../api';
import { Link } from '../router';

type Azubi = Uebersicht['azubis'][number];
type Zelle = Azubi['wochen'][number];

const tagMonat = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
/** Monat einer Woche = Monat ihres Donnerstags (wie bei der Kalenderwoche). */
const monat = (montag: string) => new Date(`${plusTage(montag, 3)}T00:00:00Z`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Azubis nach Ausbildungsjahr; wer (noch) nicht in der Ausbildung ist, steht am Ende. */
function gruppen(azubis: Azubi[]): { titel: string; azubis: Azubi[] }[] {
  const jahre = [...new Set(azubis.map((a) => a.ausbildungsjahr))].sort((x, y) => (x ?? 99) - (y ?? 99));
  return jahre.map((j) => ({ titel: j === null ? 'Ohne laufende Ausbildung' : `${j}. Ausbildungsjahr`, azubis: azubis.filter((a) => a.ausbildungsjahr === j) }));
}

/** Wo ein Azubi in einer Woche ist – als kurze Wörter für die Karten oben. */
function Lage({ z }: { z: Zelle }) {
  if (!z.inAusbildung) return <span className="leise">nicht in der Ausbildung</span>;
  if (!z.schule && z.einsatz.length === 0 && z.urlaubstage === 0) return <span className="leise">nichts geplant</span>;
  return (
    <>
      {z.schule && <span className="ue schule">Berufsschule</span>}
      {z.einsatz.map((t, i) => (
        <span key={i} className="ue einsatz">
          {t}
        </span>
      ))}
      {z.urlaubstage > 0 && (
        <span className="ue urlaub">
          {z.urlaubstage} {z.urlaubstage === 1 ? 'Tag' : 'Tage'} Urlaub
        </span>
      )}
    </>
  );
}

/** Karte „Diese Woche“ bzw. „Nächste Woche“: alle Azubis untereinander mit dem, was ansteht. */
function WochenKarte({ titel, d, index, hervor }: { titel: string; d: Uebersicht; index: number; hervor?: boolean }) {
  const w = d.wochen[index];
  const zeile = (a: Azubi) => a.wochen[index];
  const inSchule = d.azubis.filter((a) => zeile(a).schule).length;
  const imUrlaub = d.azubis.filter((a) => zeile(a).urlaubstage > 0).length;
  return (
    <section className={`karte ue-karte${hervor ? ' hervor' : ''}`} aria-label={titel}>
      <span className="ueberschrift-klein">{titel}</span>
      <h2>
        KW {w.kw} · {tagMonat(w.montag)}–{tagMonat(plusTage(w.montag, 6))}
      </h2>
      <p className="leise klein">
        {inSchule} in der Berufsschule · {imUrlaub} mit Urlaub
      </p>
      <ul className="ue-liste">
        {d.azubis.map((a) => (
          <li key={a.id}>
            <Link zu={`/azubis/${a.id}/plan`}>{a.anzeigename}</Link>
            <span className="ue-lage">
              <Lage z={zeile(a)} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Handy: statt der breiten Tabelle eine Liste der Wochen untereinander.
 * Die laufende und die nächste Woche zeigen alle Azubis, spätere Wochen nur, wer etwas eingetragen hat.
 */
function WochenListe({ d }: { d: Uebersicht }) {
  let letzterMonat = '';
  return (
    <ol className="ue-wochen">
      {d.wochen.map((w, i) => {
        const heute = w.montag <= d.heute && plusTage(w.montag, 6) >= d.heute;
        const naechste = plusTage(w.montag, -7) <= d.heute && w.montag > d.heute;
        const belegt = (z: Zelle) => z.schule || z.einsatz.length > 0 || z.urlaubstage > 0;
        const zeigen = d.azubis.filter((a) => (heute || naechste ? true : belegt(a.wochen[i])));
        const name = monat(w.montag);
        const neuerMonat = name !== letzterMonat;
        letzterMonat = name;
        return (
          <Fragment key={w.montag}>
            {neuerMonat && (
              <li className="ue-monat ueberschrift-klein" aria-hidden="true">
                {name}
              </li>
            )}
            <li className={`karte ue-woche${heute ? ' hervor' : ''}${zeigen.length === 0 ? ' leer' : ''}`}>
              <div className="ue-woche-kopf">
                <strong>KW {w.kw}</strong>
                <span className="leise klein">
                  {tagMonat(w.montag)}–{tagMonat(plusTage(w.montag, 6))}
                </span>
                {heute && <span className="pille voll">Diese Woche</span>}
                {naechste && <span className="pille grau">Nächste Woche</span>}
                {zeigen.length === 0 && <span className="leise klein ue-nichts">nichts geplant</span>}
              </div>
              {zeigen.length > 0 && (
                <ul className="ue-liste">
                  {zeigen.map((a) => (
                    <li key={a.id}>
                      <Link zu={`/azubis/${a.id}/plan`}>{a.anzeigename}</Link>
                      <span className="ue-lage">
                        <Lage z={a.wochen[i]} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

/** Alle sichtbaren Azubis: oben diese und nächste Woche, darunter der Zeitstrahl nach Monaten und Ausbildungsjahren. */
export function UebersichtSeite({ darfPlanen = false }: { darfPlanen?: boolean }) {
  const [von, setVon] = useState('');
  const [anzahl, setAnzahl] = useState(26);
  const [d, setD] = useState<Uebersicht | null>(null);
  const [jetzt, setJetzt] = useState<Uebersicht | null>(null);
  const [fehler, setFehler] = useState('');

  useEffect(() => {
    api<Uebersicht>('GET', `/api/uebersicht?wochen=${anzahl}${von ? `&von=${von}` : ''}`).then(setD, (e: Error) => setFehler(e.message));
  }, [von, anzahl]);
  // die Karten oben zeigen immer die laufende und die nächste Woche – unabhängig vom gewählten Zeitraum
  useEffect(() => {
    api<Uebersicht>('GET', '/api/uebersicht?wochen=2').then(setJetzt, () => {});
  }, []);

  if (fehler) return <Ladefehler titel="Übersicht" text={fehler} />;
  if (!d) return <p className="leise">Lädt …</p>;
  const start = d.wochen[0].montag;
  const istHeute = (montag: string) => montag <= d.heute && plusTage(montag, 6) >= d.heute;
  // Monate als Überschrift über den Kalenderwochen
  const monate: { name: string; wochen: number }[] = [];
  for (const w of d.wochen) {
    const name = monat(w.montag);
    if (monate[monate.length - 1]?.name === name) monate[monate.length - 1].wochen++;
    else monate.push({ name, wochen: 1 });
  }

  return (
    <>
      <h1>Übersicht</h1>
      <p className="leise">Wer ist wann wo? Schulblöcke und Einsätze kommen aus den Ausbildungsplänen, Urlaub aus den Berichten.</p>
      {darfPlanen && (
        <p className="nicht-drucken ue-planen">
          <Link zu="/planung/sammelplanung" className="knopf schlicht">
            Für mehrere Azubis planen
          </Link>
          <span className="leise klein">Schulblock oder Baustein in mehrere Pläne auf einmal eintragen.</span>
        </p>
      )}

      {d.azubis.length === 0 ? (
        <p className="karte leise">Keine Azubis vorhanden.</p>
      ) : (
        <>
          {jetzt && jetzt.azubis.length > 0 && (
            <div className="ue-oben nur-breit">
              <WochenKarte titel="Diese Woche" d={jetzt} index={0} hervor />
              <WochenKarte titel="Nächste Woche" d={jetzt} index={1} />
            </div>
          )}

          <h2 className="abschnitt-titel nur-breit">Zeitstrahl</h2>
          <div className="filter ue-leiste nicht-drucken">
            <div className="ue-blaettern">
              <button type="button" className="knopf schlicht" onClick={() => setVon(plusTage(start, -7 * 13))} aria-label="13 Wochen früher">
                ← Früher
              </button>
              <button type="button" className="knopf schlicht" onClick={() => setVon('')}>
                Heute
              </button>
              <button type="button" className="knopf schlicht" onClick={() => setVon(plusTage(start, 7 * 13))} aria-label="13 Wochen später">
                Später →
              </button>
            </div>
            <div role="group" aria-label="Zeitraum" className="umschalter">
              {[13, 26, 52].map((n) => (
                <button key={n} type="button" aria-pressed={anzahl === n} onClick={() => setAnzahl(n)}>
                  {n} Wochen
                </button>
              ))}
            </div>
            <span className="legende rechts nur-breit" aria-label="Legende">
              <span className="ue schule">Schule</span>
              <span className="ue einsatz">Einsatz</span>
              <span className="ue urlaub">Urlaub</span>
            </span>
          </div>
          {/* Handy: Wochen untereinander statt der breiten Tabelle */}
          <div className="nur-schmal">
            <WochenListe d={d} />
          </div>
          <div className="karte tabelle-rahmen nur-breit">
            <table className="uebersicht">
              <caption className="nur-vorleser">
                Schule, Einsätze und Urlaub je Azubi und Kalenderwoche, {anzahl} Wochen ab dem {tagMonat(start)}
                {start.slice(0, 4)}
              </caption>
              <thead>
                <tr className="monate">
                  <th className="fest" rowSpan={2} scope="col">
                    Azubi
                  </th>
                  {monate.map((m, i) => (
                    <th key={m.name + i} colSpan={m.wochen} scope="colgroup">
                      {m.wochen > 1 ? m.name : m.name.slice(0, 3)}
                    </th>
                  ))}
                </tr>
                <tr>
                  {d.wochen.map((w) => (
                    <th key={w.montag} scope="col" className={`${istHeute(w.montag) ? 'heute' : ''}${monat(w.montag) !== monat(plusTage(w.montag, -7)) ? ' monat-start' : ''}`}>
                      KW {w.kw}
                      <div className="leise klein">{tagMonat(w.montag)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gruppen(d.azubis).map((g) => (
                  <Fragment key={g.titel}>
                    <tr className="gruppe">
                      <th className="fest" scope="rowgroup">
                        {g.titel}
                      </th>
                      <td colSpan={d.wochen.length}>
                        {g.azubis.length} {g.azubis.length === 1 ? 'Azubi' : 'Azubis'}
                      </td>
                    </tr>
                    {g.azubis.map((a) => (
                      <tr key={a.id}>
                        <th scope="row" className="fest">
                          <Link zu={`/azubis/${a.id}/plan`}>{a.anzeigename}</Link>
                          {a.beruf && <div className="leise klein">{a.beruf}</div>}
                        </th>
                        {a.wochen.map((z, i) => {
                          const w = d.wochen[i];
                          return (
                            <td key={w.montag} className={`${z.inAusbildung ? '' : 'ausserhalb'}${istHeute(w.montag) ? ' heute' : ''}${monat(w.montag) !== monat(plusTage(w.montag, -7)) ? ' monat-start' : ''}`}>
                              {z.schule && <span className="ue schule">Schule</span>}
                              {z.einsatz.map((t, j) => (
                                <span key={j} className="ue einsatz" title={t}>
                                  {t}
                                </span>
                              ))}
                              {z.urlaubstage > 0 && (
                                <span className="ue urlaub" title={`${z.urlaubstage} Urlaubstage laut Bericht`}>
                                  {z.urlaubstage} T Urlaub
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p className="leise klein">
            <span className="nur-breit">Graue Felder liegen außerhalb der Ausbildung. </span>Urlaub erscheint erst, wenn der Azubi ihn im Bericht der Woche eingetragen hat. Ein Klick auf den Namen öffnet den Ausbildungsplan.
          </p>
        </>
      )}
    </>
  );
}
