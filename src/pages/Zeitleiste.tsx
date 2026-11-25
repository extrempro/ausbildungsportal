import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { api, datum, plusTage } from '../api';
import type { PlanAntwort, UrlaubAntrag } from '../api';
import { Ladefehler } from '../dialoge';
import { HandbuchLink } from '../handbuchLink';
import { Link } from '../router';
import { AzubiReiter, ZurueckZuAzubis } from '../azubiReiter';

/**
 * Zeitleiste eines Azubis (/azubis/12/zeitleiste) – nur für Ausbilder.
 * Die ganze Ausbildung als Wasserfall: je Zeile ein Einsatz, Schulblock, Urlaub oder eine Prüfung, der Reihe nach.
 * Reine Ansicht aus Ausbildungsplan und Urlaub – nichts Neues wird gespeichert. Einsatzwünsche stehen hier nicht;
 * ein genehmigter Wunsch ist ein Einsatz wie jeder andere. Ein Klick auf eine Zeile öffnet die Woche im Ausbildungsplan.
 */
type Art = 'einsatz' | 'schule' | 'urlaub' | 'pruefung';

interface Zeile {
  schluessel: string;
  art: Art;
  titel: string;
  von: string;
  /** erster Tag nach dem Ende (für die Breite) */
  nach: string;
  zeitraum: string;
  /** Woche im Ausbildungsplan */
  montag: string;
}

const ART_TEXT: Record<Art, string> = { einsatz: 'Einsatz', schule: 'Schulblock', urlaub: 'Urlaub', pruefung: 'Prüfung' };
const STUFEN = [
  // am Handy kürzer, damit die vier Stufen in eine Zeile passen
  { name: 'Ganze Ausbildung', kurz: 'Alles', faktor: 1 },
  { name: '1 Jahr', kurz: '', faktor: 3 },
  { name: 'Halbjahr', kurz: '', faktor: 6 },
  { name: 'Quartal', kurz: '', faktor: 12 },
];
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
function montagVon(iso: string): string {
  const tag = new Date(ms(iso)).getUTCDay();
  return plusTage(iso, -((tag + 6) % 7));
}

export function Zeitleiste({ azubiId }: { azubiId: number }) {
  const [plan, setPlan] = useState<PlanAntwort | null>(null);
  const [urlaub, setUrlaub] = useState<UrlaubAntrag[]>([]);
  const [fehler, setFehler] = useState('');
  const [zeigen, setZeigen] = useState<Record<'einsatz' | 'schule' | 'urlaub', boolean>>({ einsatz: true, schule: true, urlaub: true });
  const [stufe, setStufe] = useState(0);
  const rahmen = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<PlanAntwort>('GET', `/api/azubis/${azubiId}/plan`).then(setPlan, (e: Error) => setFehler(e.message));
    api<{ antraege: UrlaubAntrag[] }>('GET', `/api/azubis/${azubiId}/urlaub`).then((r) => setUrlaub(r.antraege), () => {});
  }, [azubiId]);

  // Zeitraum: Ausbildung, erweitert um Einträge davor oder danach
  const bereich = useMemo(() => {
    if (!plan) return null;
    let start = plan.beginn ? montagVon(plan.beginn) : null;
    let ende = plan.ende ? plusTage(plan.ende, 1) : null;
    for (const e of plan.eintraege) {
      if (e.art !== 'schule' && e.art !== 'einsatz') continue;
      if (!start || e.von < start) start = e.von;
      if (!ende || plusTage(e.bis, 7) > ende) ende = plusTage(e.bis, 7);
    }
    if (!start || !ende) return null;
    return { start, ende, laenge: ms(ende) - ms(start) };
  }, [plan]);

  const zeilen = useMemo((): Zeile[] => {
    if (!plan) return [];
    const liste: Zeile[] = [];
    for (const e of plan.eintraege) {
      if (e.art !== 'schule' && e.art !== 'einsatz') continue;
      const titel = e.art === 'einsatz' && e.abteilung && e.abteilung !== e.titel ? `${e.titel} (${e.abteilung})` : e.titel;
      liste.push({ schluessel: `p${e.id}`, art: e.art, titel, von: e.von, nach: plusTage(e.bis, 7), zeitraum: `${datum(e.von)} – ${datum(plusTage(e.bis, 6))}`, montag: e.von });
    }
    for (const a of urlaub) {
      if (a.status !== 'genehmigt') continue;
      liste.push({ schluessel: `u${a.id}`, art: 'urlaub', titel: 'Urlaub', von: a.von, nach: plusTage(a.bis, 1), zeitraum: a.von === a.bis ? datum(a.von) : `${datum(a.von)} – ${datum(a.bis)}`, montag: montagVon(a.von) });
    }
    for (const p of plan.pruefungen) {
      if (p.planer) continue;
      liste.push({ schluessel: `x${p.datum}${p.bezeichnung}`, art: 'pruefung', titel: p.bezeichnung || 'Prüfung', von: p.datum, nach: plusTage(p.datum, 1), zeitraum: datum(p.datum), montag: montagVon(p.datum) });
    }
    return liste.sort((a, b) => a.von.localeCompare(b.von) || a.nach.localeCompare(b.nach));
  }, [plan, urlaub]);

  const faktor = STUFEN[stufe].faktor;
  const anteil = (iso: string) => (bereich ? Math.max(0, Math.min(1, (ms(iso) - ms(bereich.start)) / bereich.laenge)) : 0);
  const heuteAnteil = plan && bereich && plan.heute >= bereich.start && plan.heute < bereich.ende ? anteil(plan.heute) : null;

  // nach dem Zoomen „heute“ (oder den Anfang) in die Mitte holen
  useLayoutEffect(() => {
    const r = rahmen.current;
    if (!r) return;
    const innen = r.firstElementChild as HTMLElement | null;
    if (!innen) return;
    const name = parseFloat(getComputedStyle(innen).getPropertyValue('--zl-name')) || 0;
    const ziel = heuteAnteil === null ? 0 : name + heuteAnteil * (innen.scrollWidth - name) - (r.clientWidth + name) / 2;
    r.scrollLeft = Math.max(0, ziel);
  }, [stufe, heuteAnteil, bereich]);

  if (fehler && !plan) return <Ladefehler titel="Zeitleiste" text={fehler} />;
  if (!plan) return <p className="leise">Lädt …</p>;

  // Achse: Ausbildungsjahre und Monate
  const jahre: { name: string; anteil: number }[] = [];
  let letztesJahr: number | null = null;
  for (const w of plan.wochen) {
    if (w.ausbildungsjahr !== null && w.ausbildungsjahr !== letztesJahr) {
      jahre.push({ name: `${w.ausbildungsjahr}. Ausbildungsjahr`, anteil: anteil(w.montag) });
      letztesJahr = w.ausbildungsjahr;
    }
  }
  const monate: { schluessel: string; name: string; anteil: number; beschriftet: boolean }[] = [];
  if (bereich) {
    const d = new Date(ms(bereich.start));
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 1);
    for (let i = 0; i < 80 && d.getTime() < ms(bereich.ende); i++, d.setUTCMonth(d.getUTCMonth() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      const m = d.getUTCMonth();
      monate.push({
        schluessel: iso,
        name: faktor >= 3 ? `${MONATE[m]} ${d.getUTCFullYear()}` : `${MONATE[m].slice(0, 3)}${m === 0 ? ` ${String(d.getUTCFullYear()).slice(2)}` : ''}`,
        anteil: anteil(iso),
        // ganze Ausbildung: nur jedes Quartal beschriften, sonst wird es zu eng
        beschriftet: (faktor > 1 || m % 3 === 0) && anteil(iso) < 0.97,
      });
    }
  }
  const sichtbar = zeilen.filter((z) => z.art === 'pruefung' || zeigen[z.art]);
  const breite: CSSProperties = { minWidth: faktor === 1 ? undefined : `calc(var(--zl-name) + ${faktor * 900}px)` };
  const links = (a: number): CSSProperties => ({ left: `calc(var(--zl-name) + (100% - var(--zl-name)) * ${a})` });

  return (
    <>
      <ZurueckZuAzubis id={azubiId} />
      <h1>Zeitleiste von {plan.azubi.anzeigename}</h1>
      <AzubiReiter id={azubiId} name={plan.azubi.anzeigename} />
      <p className="leise">
        Die ganze Ausbildung auf einen Blick: je Zeile ein Einsatz, Schulblock, Urlaub oder eine Prüfung, der Reihe nach. Ein Klick auf eine Zeile öffnet die Woche im Ausbildungsplan.{' '}
        <HandbuchLink kapitel="zeitleiste">Die Zeitleiste</HandbuchLink>
      </p>

      {plan.beginnFehlt && <p className="hinweis">Für diesen Azubi ist noch kein Ausbildungsbeginn eingetragen. Er steht im Profil – erst dann zeigt die Zeitleiste die ganze Ausbildung.</p>}

      <section className="karte zl-karte" aria-label="Zeitleiste">
        <div className="zl-steuerung">
          <fieldset className="zl-zeigen">
            <legend className="nur-vorleser">Zeigen</legend>
            <span aria-hidden="true" className="zl-titel">
              Zeigen:
            </span>
            {(['einsatz', 'schule', 'urlaub'] as const).map((art) => (
              <label key={art} className="zl-schalter">
                <input type="checkbox" checked={zeigen[art]} onChange={(e) => setZeigen({ ...zeigen, [art]: e.target.checked })} />
                <span className={`zl-farbe ${art}`} aria-hidden="true" />
                {art === 'einsatz' ? 'Einsätze' : art === 'schule' ? 'Schulblöcke' : 'Urlaub'}
              </label>
            ))}
            <span className="zl-schalter">
              <span className="zl-farbe pruefung" aria-hidden="true" />
              Prüfung
            </span>
            {heuteAnteil !== null && (
              <span className="zl-schalter">
                <span className="zl-farbe heute" aria-hidden="true" />
                heute
              </span>
            )}
          </fieldset>
          <div className="zl-zoom">
            <span className="zl-titel" id="zl-zoom-titel">
              Zoom:
            </span>
            <div role="group" aria-labelledby="zl-zoom-titel" className="umschalter">
              {STUFEN.map((s, i) => (
                <button key={s.name} type="button" aria-pressed={stufe === i} aria-label={s.name} onClick={() => setStufe(i)}>
                  {s.kurz ? (
                    <>
                      <span className="nur-breit">{s.name}</span>
                      <span className="nur-schmal">{s.kurz}</span>
                    </>
                  ) : (
                    s.name
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {sichtbar.length === 0 ? (
          <p className="leise">Noch nichts eingetragen – Einsätze und Schulblöcke kommen über den Ausbildungsplan, Urlaub über einen Antrag.</p>
        ) : (
          <div className="zl-rahmen" ref={rahmen} tabIndex={0} aria-label="Zeitleiste, seitlich verschiebbar">
            <div className="zl-innen" style={breite}>
              <div className="zl-achse" aria-hidden="true">
                <div className="zl-name">{plan.beginn && plan.ende ? `${datum(plan.beginn).slice(3)} – ${datum(plan.ende).slice(3)}` : ''}</div>
                <div className="zl-spur">
                  {jahre.map((j) => (
                    <span key={j.name} className="zl-jahr" style={{ left: `${j.anteil * 100}%` }}>
                      {j.name}
                    </span>
                  ))}
                  {monate.map((m) => (
                    <span key={m.schluessel} className="zl-monat" style={{ left: `${m.anteil * 100}%` }}>
                      {m.beschriftet ? m.name : ''}
                    </span>
                  ))}
                </div>
              </div>
              {jahre.map((j) => (
                <span key={j.name} className="zl-linie" style={links(j.anteil)} aria-hidden="true" />
              ))}
              {heuteAnteil !== null && <span className="zl-heute" style={links(heuteAnteil)} aria-hidden="true" />}
              <ol className="zl-zeilen">
                {sichtbar.map((z) => {
                  const a = anteil(z.von);
                  const b = Math.max(anteil(z.nach) - a, 0.002);
                  return (
                    <li key={z.schluessel} className="zl-zeile">
                      <div className="zl-name">
                        <strong>{z.titel}</strong>
                        <span className="leise klein">
                          <span className="nur-vorleser">{ART_TEXT[z.art]}, </span>
                          {z.zeitraum}
                        </span>
                      </div>
                      <div className="zl-spur">
                        <Link
                          zu={`/azubis/${azubiId}/plan#kw-${z.montag}`}
                          className="zl-ziel"
                          titel={`${ART_TEXT[z.art]}: ${z.titel}, ${z.zeitraum}`}
                          vorlesen={`${ART_TEXT[z.art]} ${z.titel}, ${z.zeitraum} – Woche im Ausbildungsplan öffnen`}
                        >
                          {z.art === 'pruefung' ? (
                            <span className="zl-balken pruefung" style={{ left: `${a * 100}%` }} />
                          ) : (
                            <span className={`zl-balken ${z.art}`} style={{ left: `${a * 100}%`, width: `${b * 100}%` }}>
                              {b * faktor > 0.05 ? z.titel : ''}
                            </span>
                          )}
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        )}
        <p className="leise klein zl-fuss">Die Namen links bleiben stehen, wenn du seitlich schiebst. Zu sehen ist genehmigter Urlaub; Einsatzwünsche erscheinen erst, wenn sie genehmigt sind.</p>
      </section>
    </>
  );
}
