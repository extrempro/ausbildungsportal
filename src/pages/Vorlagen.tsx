import { Ladefehler, melde, rueckfrage } from '../dialoge';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ART_TEXT, berufName, PLAN_ARTEN } from '../api';
import type { PlanArt, Planvorlage, VorlageEintrag } from '../api';
import { Link, useUngespeichert } from '../router';
import { HandbuchLink } from '../handbuchLink';

interface Berufe {
  id: number;
  bezeichnung: string;
  fachrichtung: string;
}
interface Zeile extends Omit<VorlageEintrag, 'unteraufgaben'> {
  /** eine Unteraufgabe je Zeile */
  unteraufgaben: string;
}
type Meldung = { text: string; fehler: boolean } | null;

// ---------- Export und Import ----------
// Eine Datei enthält eine oder mehrere Vorlagen. Der Beruf steht als Name darin, weil die Nummern je Installation verschieden sind.
const FORMAT = 'ausbildungsportal-planvorlagen';
const MAX_DATEI = 1_000_000;

interface DateiVorlage {
  titel: string;
  beruf: string | null;
  eintraege: VorlageEintrag[];
}

function alsDatei(vorlagen: Planvorlage[], berufe: Berufe[]): string {
  const inhalt: DateiVorlage[] = vorlagen.map((v) => ({
    titel: v.titel,
    beruf: berufName(berufe.find((b) => b.id === v.berufId)) || null,
    eintraege: v.eintraege,
  }));
  return JSON.stringify({ format: FORMAT, version: 1, vorlagen: inhalt }, null, 2);
}

function ladeHerunter(name: string, inhalt: string): void {
  const url = URL.createObjectURL(new Blob([inhalt], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function dateiname(titel: string): string {
  const kurz = titel
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `baustein-${kurz || 'ohne-titel'}.json`;
}

/** Liest eine Export-Datei; wirft einen verständlichen Fehler, wenn sie nicht passt. Die genaue Prüfung macht der Server. */
function ausDatei(text: string): DateiVorlage[] {
  let roh: unknown;
  try {
    roh = JSON.parse(text);
  } catch {
    throw new Error('Die Datei lässt sich nicht lesen. Bitte eine Datei wählen, die hier mit „Exportieren“ erzeugt wurde.');
  }
  const d = roh as { format?: unknown; vorlagen?: unknown };
  if (typeof roh !== 'object' || roh === null || d.format !== FORMAT || !Array.isArray(d.vorlagen)) throw new Error('Das ist keine Baustein-Datei aus dem Ausbildungsportal.');
  if (d.vorlagen.length === 0) throw new Error('Die Datei enthält keine Bausteine.');
  if (d.vorlagen.length > 50) throw new Error('Die Datei enthält mehr als 50 Bausteine.');
  return d.vorlagen.map((v: unknown, i) => {
    const x = v as Partial<DateiVorlage>;
    if (typeof v !== 'object' || v === null || typeof x.titel !== 'string' || !Array.isArray(x.eintraege)) throw new Error(`Baustein ${i + 1} in der Datei ist unvollständig.`);
    return { titel: x.titel, beruf: typeof x.beruf === 'string' ? x.beruf : null, eintraege: x.eintraege };
  });
}

// ---------- Darstellung ----------
const letzteWoche = (eintraege: Pick<VorlageEintrag, 'abWoche' | 'wochen'>[]) => eintraege.reduce((max, e) => Math.max(max, e.abWoche + e.wochen - 1), 0);
const wochen = (e: Pick<VorlageEintrag, 'abWoche' | 'wochen'>) => (e.wochen > 1 ? `Woche ${e.abWoche}–${e.abWoche + e.wochen - 1}` : `Woche ${e.abWoche}`);
const sortiert = <T extends Pick<VorlageEintrag, 'abWoche'>>(liste: T[]) => [...liste].sort((a, b) => a.abWoche - b.abWoche);

/** Zeitstrahl: je Art eine Zeile, die Balken zeigen die Wochen. Die gleiche Auskunft steht als Text im Ablauf. */
function Zeitstrahl({ eintraege }: { eintraege: VorlageEintrag[] }) {
  const ende = letzteWoche(eintraege);
  if (ende === 0) return null;
  return (
    <div className="vorlage-strahl" aria-hidden="true">
      {PLAN_ARTEN.filter((art) => eintraege.some((e) => e.art === art)).map((art) => (
        <div key={art} className="vorlage-strahl-zeile">
          <span className={`legende-art ${art}`}>{ART_TEXT[art]}</span>
          <div className="vorlage-strahl-bahn">
            {eintraege
              .filter((e) => e.art === art)
              .map((e, i) => (
                <i key={i} className={`legende-art ${art}`} title={`${wochen(e)}: ${e.titel}`} style={{ left: `${((e.abWoche - 1) / ende) * 100}%`, width: `${(e.wochen / ende) * 100}%` }} />
              ))}
          </div>
        </div>
      ))}
      <div className="vorlage-strahl-zeile leise klein">
        <span />
        <div className="vorlage-strahl-skala">
          <span>Woche 1</span>
          <span>Woche {ende}</span>
        </div>
      </div>
    </div>
  );
}

function VorlageFormular({ vorlage, berufe, onFertig }: { vorlage: Planvorlage | null; berufe: Berufe[]; onFertig: (meldung?: string) => Promise<void> }) {
  const [titel, setTitel] = useState(vorlage?.titel ?? '');
  const [berufId, setBerufId] = useState<number | null>(vorlage?.berufId ?? null);
  const [zeilen, setZeilen] = useState<Zeile[]>(sortiert(vorlage?.eintraege ?? []).map((e) => ({ ...e, unteraufgaben: e.unteraufgaben.join('\n') })));
  const [meldung, setMeldung] = useState<Meldung>(null);
  // Vergleichsstand: was davon abweicht, ist noch nicht gespeichert
  const stand = () => JSON.stringify([titel, berufId, zeilen]);
  const [gespeichert, setGespeichert] = useState(stand);
  useUngespeichert(stand() !== gespeichert);
  // „Beginnt in Woche“ braucht es erst, wenn ein Baustein mehrere Einträge hat (oder einer nicht in Woche 1 beginnt)
  const mitVersatz = zeilen.length > 1 || zeilen.some((z) => z.abWoche !== 1);
  const aendere = (i: number, teil: Partial<Zeile>) => setZeilen(zeilen.map((z, j) => (j === i ? { ...z, ...teil } : z)));

  const speichere = async () => {
    const geordnet = sortiert(zeilen);
    const body = { titel, berufId, eintraege: geordnet.map((z) => ({ ...z, unteraufgaben: z.art === 'aufgabe' ? z.unteraufgaben.split('\n').map((t) => t.trim()).filter(Boolean) : [] })) };
    try {
      if (vorlage) await api('PUT', `/api/planvorlagen/${vorlage.id}`, body);
      else await api('POST', '/api/planvorlagen', body);
      await onFertig();
      if (vorlage) {
        setZeilen(geordnet);
        setGespeichert(JSON.stringify([titel, berufId, geordnet]));
        setMeldung(null);
        melde('Gespeichert. Pläne, in die dieser Baustein schon eingefügt wurde, ändern sich dadurch nicht.');
      } else {
        setTitel('');
        setZeilen([]);
        setGespeichert(JSON.stringify(['', berufId, []]));
        setMeldung(null);
        melde('Baustein angelegt.');
      }
    } catch (e) {
      setMeldung({ text: e instanceof Error ? e.message : 'Fehler', fehler: true });
    }
  };

  return (
    <>
      <div className="reihe">
        <label>
          Titel des Bausteins
          <input value={titel} maxLength={120} placeholder="z. B. IT-Support" onChange={(e) => setTitel(e.target.value)} />
        </label>
        <label>
          Beruf
          <select value={berufId ?? ''} onChange={(e) => setBerufId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">für alle Berufe</option>
            {berufe.map((b) => (
              <option key={b.id} value={b.id}>
                {berufName(b)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <h3 className="vorlage-zwischen">Einträge ({zeilen.length})</h3>
      {zeilen.length === 0 && <p className="leise">Noch keine Einträge. Mit „Eintrag hinzufügen“ legst du fest, was zum Baustein gehört – zum Beispiel einen Einsatz über 8 Wochen und eine Aufgabe in der ersten Woche.</p>}
      {zeilen.map((z, i) => (
        <fieldset className={`abschnitt vorlage-eintrag ${z.art}`} key={i}>
          <legend>
            <span className={`legende-art ${z.art}`}>{ART_TEXT[z.art]}</span> {mitVersatz ? wochen(z) : z.wochen === 1 ? '1 Woche' : `${z.wochen} Wochen`}
            {z.titel && ` · ${z.titel}`}
          </legend>
          <div className="reihe">
            <label>
              Art
              <select value={z.art} onChange={(e) => aendere(i, { art: e.target.value as PlanArt })}>
                {PLAN_ARTEN.map((a) => (
                  <option key={a} value={a}>
                    {ART_TEXT[a]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Dauer in Wochen
              <input type="number" min={1} max={160} value={z.wochen} onChange={(e) => aendere(i, { wochen: Number(e.target.value) })} />
            </label>
            {/* Nur bei mehreren Einträgen von Bedeutung: der wievielten Woche nach dem Einfügen dieser Eintrag beginnt */}
            {mitVersatz && (
              <label>
                Beginnt in Woche
                <input type="number" min={1} max={260} value={z.abWoche} aria-describedby={`versatz-${i}`} onChange={(e) => aendere(i, { abWoche: Number(e.target.value) })} />
                <span id={`versatz-${i}`} className="leise klein">
                  {z.abWoche === 1 ? 'gleich in der Woche, in der du den Baustein einfügst' : `${z.abWoche - 1} ${z.abWoche === 2 ? 'Woche' : 'Wochen'} nach dem Einfügen`}
                </span>
              </label>
            )}
            <label className="ganz">
              Titel
              <input value={z.titel} maxLength={120} onChange={(e) => aendere(i, { titel: e.target.value })} />
            </label>
            <label className="ganz">
              Beschreibung
              <textarea rows={2} maxLength={2000} value={z.text} onChange={(e) => aendere(i, { text: e.target.value })} />
            </label>
            {z.art === 'aufgabe' && (
              <label className="ganz">
                Unteraufgaben (eine je Zeile)
                <textarea rows={3} value={z.unteraufgaben} onChange={(e) => aendere(i, { unteraufgaben: e.target.value })} />
              </label>
            )}
          </div>
          <button type="button" className="knopf schlicht klein gefahr" onClick={() => setZeilen(zeilen.filter((_, j) => j !== i))}>
            Eintrag entfernen
          </button>
        </fieldset>
      ))}
      <p className="vorlage-mehr">
        <button
          type="button"
          className="knopf schlicht"
          disabled={zeilen.length >= 100}
          onClick={() => {
            // der erste Eintrag ist meist die Station selbst, weitere sind Aufgaben oder Notizen dazu – alle beginnen in Woche 1
            setZeilen([...zeilen, zeilen.length === 0 ? { art: 'einsatz', abWoche: 1, wochen: 4, titel: '', text: '', unteraufgaben: '' } : { art: 'aufgabe', abWoche: 1, wochen: 1, titel: '', text: '', unteraufgaben: '' }]);
          }}
        >
          Eintrag hinzufügen
        </button>
      </p>
      {meldung && (
        <p className={`hinweis ${meldung.fehler ? 'fehler' : 'gut'}`} role={meldung.fehler ? 'alert' : 'status'}>
          {meldung.text}
        </p>
      )}
      <div className="aktionen links">
        <button type="button" className="knopf" disabled={!titel.trim()} onClick={() => void speichere()}>
          {vorlage ? 'Baustein speichern' : 'Baustein anlegen'}
        </button>
      </div>
      {mitVersatz && <p className="leise klein">„Beginnt in Woche“ zählt ab der Woche, in der du den Baustein in einen Plan einfügst. Beim Speichern werden die Einträge danach geordnet.</p>}
    </>
  );
}

/** Planvorlagen: Abläufe in Wochen ab Ausbildungsbeginn, die sich in den Plan eines Azubis übernehmen lassen. */
export function Vorlagen() {
  const [d, setD] = useState<{ vorlagen: Planvorlage[]; berufe: Berufe[] } | null>(null);
  const [fehler, setFehler] = useState('');
  const [meldung, setMeldung] = useState<Meldung>(null);
  const datei = useRef<HTMLInputElement>(null);
  const lade = useCallback(async (text?: string) => {
    setD(await api('GET', '/api/planvorlagen'));
    if (text) melde(text);
  }, []);
  useEffect(() => {
    lade().catch((e: Error) => setFehler(e.message));
  }, [lade]);

  if (fehler) return <Ladefehler titel="Planbausteine" text={fehler} />;
  if (!d) return <p className="leise">Lädt …</p>;

  const zeigeFehler = (e: unknown) => setMeldung({ text: e instanceof Error ? e.message : 'Fehler', fehler: true });
  /** Titel, den es noch nicht gibt – sonst wären zwei Vorlagen in der Auswahl nicht zu unterscheiden. */
  const freierTitel = (titel: string, zusatz: string, vergeben: string[]) => {
    if (!vergeben.includes(titel)) return titel;
    let n = 1;
    let neu = `${titel} (${zusatz})`;
    while (vergeben.includes(neu)) neu = `${titel} (${zusatz} ${++n})`;
    return neu.slice(0, 120);
  };

  const dupliziere = async (v: Planvorlage) => {
    try {
      const titel = freierTitel(v.titel, 'Kopie', [v.titel, ...d.vorlagen.map((x) => x.titel)]);
      await api('POST', '/api/planvorlagen', { titel, berufId: v.berufId, eintraege: v.eintraege });
      await lade(`„${titel}“ angelegt.`);
    } catch (e) {
      zeigeFehler(e);
    }
  };
  const loesche = async (v: Planvorlage) => {
    if (!(await rueckfrage(`Baustein „${v.titel}“ löschen?\n\nSchon eingefügte Einträge in Plänen bleiben erhalten.\n\nTipp: vorher exportieren, falls du ihn später noch einmal brauchst.`, { ja: 'Baustein löschen', gefahr: true }))) return;
    try {
      await api('DELETE', `/api/planvorlagen/${v.id}`);
      await lade(`Baustein „${v.titel}“ gelöscht.`);
    } catch (e) {
      zeigeFehler(e);
    }
  };
  const importiere = async (f: File) => {
    setMeldung(null);
    try {
      if (f.size > MAX_DATEI) throw new Error('Die Datei ist zu groß (höchstens 1 MB).');
      const neue = ausDatei(await f.text());
      const vergeben = d.vorlagen.map((v) => v.titel);
      const hinweise: string[] = [];
      let anzahl = 0;
      for (const v of neue) {
        const beruf = v.beruf ? d.berufe.find((b) => berufName(b) === v.beruf) : undefined;
        if (v.beruf && !beruf) hinweise.push(`Der Beruf „${v.beruf}“ ist hier nicht angelegt – „${v.titel}“ gilt deshalb für alle Berufe.`);
        const titel = freierTitel(v.titel.trim() || 'Baustein ohne Titel', 'Import', vergeben);
        if (titel !== v.titel) hinweise.push(`„${v.titel}“ gab es schon – importiert als „${titel}“.`);
        try {
          await api('POST', '/api/planvorlagen', { titel, berufId: beruf?.id ?? null, eintraege: v.eintraege });
        } catch (e) {
          throw new Error(`„${v.titel}“ konnte nicht importiert werden: ${e instanceof Error ? e.message : 'Fehler'}${anzahl ? ` (${anzahl} davor wurden importiert)` : ''}`);
        }
        vergeben.push(titel);
        anzahl++;
      }
      await lade([`${anzahl === 1 ? 'Ein Baustein' : `${anzahl} Bausteine`} importiert.`, ...hinweise].join(' '));
    } catch (e) {
      await lade().catch(() => {});
      zeigeFehler(e);
    } finally {
      if (datei.current) datei.current.value = '';
    }
  };

  return (
    <>
      <h1>Planbausteine</h1>
      <p className="leise">
        Ein Baustein ist ein Stück Ausbildung, das immer wieder vorkommt – zum Beispiel die Station „IT-Support“ mit 8 Wochen Einsatz und den Aufgaben dazu. Du legst ihn einmal an und fügst ihn in jeden Plan dort ein, wo er passt.{' '}
        <HandbuchLink kapitel="planung">Sammelplanung und Bausteine</HandbuchLink>
      </p>
      <ol className="ablauf-liste abz-hilfe">
        <li>
          <span className="ablauf-nr">1</span>
          <span>
            <strong>Baustein anlegen</strong>
            <br />
            <span className="leise klein">Titel und, wenn er nur für einen Beruf gilt, den Beruf wählen.</span>
          </span>
        </li>
        <li>
          <span className="ablauf-nr">2</span>
          <span>
            <strong>Einträge planen</strong>
            <br />
            <span className="leise klein">Meist ein Einsatz mit seiner Dauer, dazu bei Bedarf Aufgaben oder Notizen. Wann der Baustein beginnt, legst du erst beim Einfügen fest.</span>
          </span>
        </li>
        <li>
          <span className="ablauf-nr">3</span>
          <span>
            <strong>In Pläne einfügen</strong>
            <br />
            <span className="leise klein">
              Im Ausbildungsplan eines Azubis unter „Baustein einfügen“ mit der Startwoche – oder für mehrere Azubis auf einmal in der <Link zu="/planung/sammelplanung">Sammelplanung</Link>.
            </span>
          </span>
        </li>
      </ol>

      <div className="vorlage-leiste">
        <a className="knopf" href="#neue-vorlage">
          Neuer Baustein
        </a>
        <button type="button" className="knopf schlicht" onClick={() => datei.current?.click()}>
          Importieren
        </button>
        <button type="button" className="knopf schlicht" disabled={d.vorlagen.length === 0} onClick={() => ladeHerunter('planbausteine.json', alsDatei(d.vorlagen, d.berufe))}>
          Alle exportieren
        </button>
        <input ref={datei} type="file" accept="application/json,.json" hidden aria-label="Datei mit Bausteinen zum Importieren" onChange={(e) => e.target.files?.[0] && void importiere(e.target.files[0])} />
      </div>
      <p className="leise klein">
        Exportieren speichert Bausteine als Datei – zur Sicherung oder um sie in ein anderes Ausbildungsportal zu übernehmen. Importieren legt die Bausteine aus einer solchen Datei zusätzlich an; vorhandene werden nie überschrieben. Die Datei enthält keine Daten von Azubis.
      </p>
      {meldung && (
        <p className={`hinweis ${meldung.fehler ? 'fehler' : 'gut'}`} role={meldung.fehler ? 'alert' : 'status'}>
          {meldung.text}
        </p>
      )}

      <h2>Vorhandene Bausteine ({d.vorlagen.length})</h2>
      {d.vorlagen.length === 0 && <p className="karte leise">Noch kein Baustein. Lege unten den ersten an oder importiere eine Datei.</p>}
      {d.vorlagen.map((v) => {
        const ende = letzteWoche(v.eintraege);
        return (
          <details className="karte vorlage" key={v.id}>
            <summary>
              <span className="vorlage-titel">{v.titel}</span>
              <span className="vorlage-angaben">
                <span className="pille grau">{berufName(d.berufe.find((b) => b.id === v.berufId)) || 'alle Berufe'}</span>
                <span className="pille grau">{v.eintraege.length === 1 ? '1 Eintrag' : `${v.eintraege.length} Einträge`}</span>
                {ende > 0 && <span className="pille grau">{ende === 1 ? '1 Woche' : `${ende} Wochen`}</span>}
              </span>
              <span className="vorlage-auf leise klein">Ansehen und bearbeiten</span>
            </summary>
            <Zeitstrahl eintraege={v.eintraege} />
            {v.eintraege.length > 0 && (
              <>
                <h3 className="vorlage-zwischen">Ablauf</h3>
                <ul className="vorlage-ablauf">
                  {sortiert(v.eintraege).map((e, i) => (
                    <li key={i}>
                      <span className="vorlage-wochen">{v.eintraege.length === 1 && e.abWoche === 1 ? (e.wochen === 1 ? '1 Woche' : `${e.wochen} Wochen`) : wochen(e)}</span>
                      <span className={`legende-art ${e.art}`}>{ART_TEXT[e.art]}</span>
                      <span>
                        {e.titel}
                        {e.unteraufgaben.length > 0 && <span className="leise klein"> · {e.unteraufgaben.length} Unteraufgaben</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="aktionen links vorlage-knoepfe">
              <button type="button" className="knopf schlicht klein" onClick={() => ladeHerunter(dateiname(v.titel), alsDatei([v], d.berufe))}>
                Exportieren
              </button>
              <button type="button" className="knopf schlicht klein" onClick={() => void dupliziere(v)}>
                Duplizieren
              </button>
              <button type="button" className="knopf schlicht klein gefahr" onClick={() => void loesche(v)}>
                Baustein löschen
              </button>
            </div>
            <h3 className="vorlage-zwischen">Bearbeiten</h3>
            <VorlageFormular vorlage={v} berufe={d.berufe} onFertig={lade} />
          </details>
        );
      })}
      <section className="karte" id="neue-vorlage">
        <h2>Neuer Baustein</h2>
        <VorlageFormular key={d.vorlagen.length} vorlage={null} berufe={d.berufe} onFertig={lade} />
      </section>
    </>
  );
}
