import { useEffect, useState } from 'react';
import { api, plusTage } from '../api';
import type { Uebersicht } from '../api';
import { Link } from '../router';

const WOCHEN = 26;

/** Alle sichtbaren Azubis nebeneinander: Schule, Einsatz und Urlaub je Kalenderwoche. */
export function UebersichtSeite() {
  const [von, setVon] = useState('');
  const [d, setD] = useState<Uebersicht | null>(null);
  const [fehler, setFehler] = useState('');

  useEffect(() => {
    api<Uebersicht>('GET', `/api/uebersicht?wochen=${WOCHEN}${von ? `&von=${von}` : ''}`).then(setD, (e: Error) => setFehler(e.message));
  }, [von]);

  if (fehler) return <p className="hinweis fehler">{fehler}</p>;
  if (!d) return <p className="leise">Lädt …</p>;
  const start = d.wochen[0].montag;

  return (
    <>
      <h1>Übersicht</h1>
      <p className="leise">
        Schulblöcke und Einsätze aus den Ausbildungsplänen, Urlaub aus den Berichten – {WOCHEN} Wochen ab dem {start.slice(8, 10)}.{start.slice(5, 7)}.{start.slice(0, 4)}.
      </p>
      <div className="filter nicht-drucken">
        <button type="button" className="knopf schlicht" onClick={() => setVon(plusTage(start, -7 * 13))}>
          ← 13 Wochen
        </button>
        <button type="button" className="knopf schlicht" onClick={() => setVon('')}>
          Heute
        </button>
        <button type="button" className="knopf schlicht" onClick={() => setVon(plusTage(start, 7 * 13))}>
          13 Wochen →
        </button>
        <span className="legende rechts">
          <span className="ue schule">Schule</span>
          <span className="ue einsatz">Einsatz</span>
          <span className="ue urlaub">Urlaub</span>
        </span>
      </div>
      {d.azubis.length === 0 ? (
        <p className="karte leise">Keine Azubis vorhanden.</p>
      ) : (
        <div className="karte tabelle-rahmen">
          <table className="uebersicht">
            <thead>
              <tr>
                <th className="fest">Azubi</th>
                {d.wochen.map((w) => (
                  <th key={w.montag} className={w.montag <= d.heute && plusTage(w.montag, 6) >= d.heute ? 'heute' : undefined}>
                    KW {w.kw}
                    <div className="leise klein">
                      {w.montag.slice(8, 10)}.{w.montag.slice(5, 7)}.
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.azubis.map((a) => (
                <tr key={a.id}>
                  <th scope="row" className="fest">
                    <Link zu={`/azubis/${a.id}/plan`}>{a.anzeigename}</Link>
                    {a.beruf && <div className="leise klein">{a.beruf}</div>}
                  </th>
                  {a.wochen.map((z, i) => (
                    <td key={d.wochen[i].montag} className={`${z.inAusbildung ? '' : 'ausserhalb'}${d.wochen[i].montag <= d.heute && plusTage(d.wochen[i].montag, 6) >= d.heute ? ' heute' : ''}`}>
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
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="leise klein">Graue Felder liegen außerhalb der Ausbildung. Urlaub erscheint erst, wenn der Azubi ihn im Bericht der Woche eingetragen hat.</p>
    </>
  );
}
