import { useEffect, useMemo, useState } from 'react';
import { AnsichtKnoepfe } from '../ansicht';
import { api, datum } from '../api';
import { Ladefehler } from '../dialoge';
import { HandbuchLink } from '../handbuchLink';
import { Link } from '../router';

interface Eintrag {
  art: 'schule' | 'einsatz';
  von: string;
  bis: string;
  titel: string;
}

interface JkAzubi {
  id: number;
  anzeigename: string;
  beruf: string;
  ausbildungsjahr: number | null;
  beginn: string | null;
  ende: string | null;
  eintraege: Eintrag[];
  urlaub: string[];
  /** beantragter, noch nicht entschiedener Urlaub */
  beantragt: { von: string; bis: string }[];
  pruefungen: { tag: string; bezeichnung: string }[];
  termine: { tag: string; zeitVon: string; titel: string }[];
  ferien: { name: string; von: string; bis: string }[];
}

interface Daten {
  jahr: number;
  heute: string;
  eigenes: boolean;
  einzeln: boolean;
  feiertage: { tag: string; name: string }[];
  /** Termine des Betriebs für alle */
  firmentermine: { id: number; titel: string; von: string; bis: string; hinweis: string }[];
  azubis: JkAzubi[];
}

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONATE_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const TAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const TAGE_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const zwei = (n: number) => String(n).padStart(2, '0');
const iso = (jahr: number, monat: number, tag: number) => `${jahr}-${zwei(monat + 1)}-${zwei(tag)}`;
const tageImMonat = (jahr: number, monat: number) => new Date(Date.UTC(jahr, monat + 1, 0)).getUTCDate();
const wochentag = (tag: string) => new Date(`${tag}T00:00:00Z`).getUTCDay();
const tagImJahr = (tag: string) => Math.round((Date.parse(`${tag}T00:00:00Z`) - Date.parse(`${tag.slice(0, 4)}-01-01T00:00:00Z`)) / 86_400_000);

/** Jahreskalender: ein Kalenderjahr auf einen Blick. Für einen Azubi Tag für Tag, für mehrere als Balken je Azubi. */
export function Jahreskalender({ azubiId }: { azubiId?: number }) {
  const [jahr, setJahr] = useState<number | null>(null);
  const [d, setD] = useState<Daten | null>(null);
  const [fehler, setFehler] = useState('');

  useEffect(() => {
    let aktuell = true;
    const frage = [jahr !== null ? `jahr=${jahr}` : '', azubiId ? `azubi=${azubiId}` : ''].filter(Boolean).join('&');
    api<Daten>('GET', `/api/jahreskalender${frage ? `?${frage}` : ''}`).then(
      (r) => aktuell && setD(r),
      (e: Error) => aktuell && setFehler(e.message),
    );
    return () => {
      aktuell = false;
    };
  }, [jahr, azubiId]);

  if (fehler) return <Ladefehler titel="Jahreskalender" text={fehler} />;
  if (!d) return <p className="leise">Lädt …</p>;
  const diesesJahr = Number(d.heute.slice(0, 4));
  const einer = d.einzeln ? d.azubis[0] : null;

  return (
    <>
      {d.eigenes ? (
        <p className="klein nicht-drucken">
          <Link zu="/">← Ausbildungsplan</Link>
        </p>
      ) : (
        einer && (
          <p className="klein nicht-drucken">
            <Link zu="/jahreskalender">← Jahreskalender aller Azubis</Link>
          </p>
        )
      )}
      {/* Lesemodus: Leisten und Menüs weg, der Kalender behält seine Breite (jk-kopf, siehe index.css) */}
      <div className="ansicht-kopf jk-kopf">
        <h1>
          Jahreskalender {d.jahr}
          {einer && !d.eigenes ? ` von ${einer.anzeigename}` : ''}
        </h1>
        <AnsichtKnoepfe />
      </div>
      <p className="leise">
        {d.eigenes
          ? 'Dein Jahr auf einen Blick: Berufsschule, Einsätze, Prüfungen, Urlaub, Feiertage und deine eigenen Termine. Die Monate stehen nebeneinander, die Tage untereinander.'
          : einer
            ? `${einer.beruf ? `${einer.beruf} · ` : ''}Das Jahr auf einen Blick: Berufsschule, Einsätze, Prüfungen, Urlaub und Feiertage. Die Monate stehen nebeneinander, die Tage untereinander.`
            : 'Wer ist wann wo – das ganze Jahr auf einen Blick: je Azubi Berufsschule, Einsätze, Urlaub und Prüfungen. Ein Klick auf den Namen zeigt den Kalender dieses Azubis Tag für Tag.'}{' '}
        <HandbuchLink kapitel="jahreskalender">Den Jahreskalender lesen</HandbuchLink>
      </p>

      <div className="filter nicht-drucken" role="group" aria-label="Jahr wählen">
        <button type="button" className="knopf schlicht" onClick={() => setJahr(d.jahr - 1)} disabled={d.jahr <= 2000}>
          ← {d.jahr - 1}
        </button>
        <button type="button" className="knopf schlicht" aria-pressed={d.jahr === diesesJahr} onClick={() => setJahr(diesesJahr)}>
          Dieses Jahr ({diesesJahr})
        </button>
        <button type="button" className="knopf schlicht" onClick={() => setJahr(d.jahr + 1)} disabled={d.jahr >= 2100}>
          {d.jahr + 1} →
        </button>
        {einer && (
          <Link zu={d.eigenes ? '/' : `/azubis/${einer.id}/plan`} className="knopf schlicht rechts">
            {d.eigenes ? 'Zum Ausbildungsplan' : 'Ausbildungsplan öffnen'}
          </Link>
        )}
      </div>

      <Legende einzeln={!!einer} eigenes={d.eigenes} firma={d.firmentermine.length > 0} />
      {d.firmentermine.length > 0 && (
        // am PC stehen die Firmentermine im Kalender selbst (eigene Zeile mit Titel bzw. beschriftete Tage) – die Liste braucht es
        // nur in der Kartenansicht aller Azubis am Handy, wo im Kalender kein Platz für den Titel ist
        !einer && <section className="karte jk-firma nur-schmal" aria-labelledby="jk-firma-titel">
          <h2 id="jk-firma-titel">Firmentermine {d.jahr}</h2>
          <p className="leise klein">Gelten für alle im Betrieb.</p>
          <ul>
            {d.firmentermine.map((t) => (
              <li key={t.id}>
                <span className="jk-firma-zeit">{t.von === t.bis ? datum(t.von) : `${datum(t.von)} bis ${datum(t.bis)}`}</span>
                <span>
                  <strong>{t.titel}</strong>
                  {t.hinweis ? ` – ${t.hinweis}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {einer ? <JahrEinzeln d={d} a={einer} /> : <JahrAlle d={d} />}
    </>
  );
}

function Legende({ einzeln, eigenes, firma }: { einzeln: boolean; eigenes: boolean; firma: boolean }) {
  return (
    <ul className="jk-legende" aria-label="Bedeutung der Farben">
      <li>
        <span className="jk-farbe schule" /> Berufsschule
      </li>
      <li>
        <span className="jk-farbe einsatz" /> Einsatz
      </li>
      <li>
        <span className="jk-farbe urlaub" /> Urlaub (genehmigt oder laut Berichtsheft)
      </li>
      <li>
        <span className="jk-farbe beantragt" /> Urlaub beantragt
      </li>
      <li>
        <span className="jk-farbe pruefung" /> Prüfung
      </li>
      {einzeln && (
        <li>
          <span className="jk-farbe feiertag" /> Feiertag
        </li>
      )}
      <li>
        <span className="jk-farbe ferien" /> Schulferien
      </li>
      {firma && (
        <li>
          <span className="jk-farbe firma" /> Firmentermin (für alle)
        </li>
      )}
      {eigenes && (
        <li>
          <span className="jk-farbe termin" /> Eigener Termin (siehst nur du)
        </li>
      )}
      <li>
        <span className="jk-farbe aus" /> {einzeln ? 'Wochenende oder nicht in der Ausbildung' : 'Nicht in der Ausbildung'}
      </li>
    </ul>
  );
}

interface TagInfo {
  art: 'pruefung' | 'feiertag' | 'urlaub' | 'beantragt' | 'schule' | 'einsatz' | null;
  /** sichtbare Beschriftung – nur am Anfang eines Blocks, damit die Spalte ruhig bleibt */
  text: string;
  /** vollständige Auskunft für Tooltip und Vorleseprogramme */
  voll: string;
  ferien: string;
  frei: boolean;
  ausserhalb: boolean;
  termine: { zeitVon: string; titel: string }[];
  /** Termine des Betriebs an diesem Tag */
  firma: string[];
  /** Beschriftung zeigen: am ersten Tag, an jedem Montag und am Monatsersten */
  firmaZeigen: boolean;
}

function tagInfo(d: Daten, a: JkAzubi, tag: string, feiertage: Map<string, string>): TagInfo {
  const wt = wochentag(tag);
  const wochenende = wt === 0 || wt === 6;
  const ausserhalb = !a.beginn || !a.ende || tag < a.beginn || tag > a.ende;
  const ferien = a.ferien.find((f) => f.von <= tag && f.bis >= tag)?.name ?? '';
  const termine = a.termine.filter((t) => t.tag === tag);
  const firma = d.firmentermine.filter((t) => t.von <= tag && t.bis >= tag);
  const basis = { ferien, frei: wochenende, ausserhalb, termine, firma: firma.map((t) => t.titel), firmaZeigen: firma.some((t) => t.von === tag) || wt === 1 || tag.endsWith('-01') };
  const pruefung = a.pruefungen.filter((p) => p.tag === tag);
  if (pruefung.length) {
    const text = `Prüfung: ${pruefung.map((p) => p.bezeichnung).join(', ')}`;
    return { ...basis, art: 'pruefung', text, voll: text };
  }
  const feiertag = feiertage.get(tag);
  if (feiertag) return { ...basis, art: 'feiertag', text: feiertag, voll: `Feiertag: ${feiertag}`, frei: true };
  if (a.urlaub.includes(tag)) return { ...basis, art: 'urlaub', text: 'Urlaub', voll: 'Urlaub' };
  if (wochenende) return { ...basis, art: null, text: '', voll: '' };
  const beantragt = a.beantragt.find((u) => u.von <= tag && u.bis >= tag);
  if (beantragt) return { ...basis, art: 'beantragt', text: tag === beantragt.von || wt === 1 ? 'Urlaub?' : '', voll: 'Urlaub beantragt, noch nicht entschieden' };
  // Beschriftung am ersten Tag des Blocks, am Monatsersten und an jedem Montag
  const zeige = (e: Eintrag) => tag === e.von || wt === 1 || tag.endsWith('-01');
  const schule = a.eintraege.find((e) => e.art === 'schule' && e.von <= tag && e.bis >= tag);
  if (schule) return { ...basis, art: 'schule', text: zeige(schule) ? 'Schule' : '', voll: `Berufsschule: ${schule.titel}` };
  const einsatz = a.eintraege.filter((e) => e.art === 'einsatz' && e.von <= tag && e.bis >= tag);
  if (einsatz.length) return { ...basis, art: 'einsatz', text: zeige(einsatz[0]) ? einsatz.map((e) => e.titel).join(', ') : '', voll: `Einsatz: ${einsatz.map((e) => e.titel).join(', ')}` };
  return { ...basis, art: null, text: '', voll: '' };
}

/** Ein Azubi, Tag für Tag: Monate als Spalten, Tage 1–31 als Zeilen. */
function JahrEinzeln({ d, a }: { d: Daten; a: JkAzubi }) {
  const feiertage = useMemo(() => new Map(d.feiertage.map((f) => [f.tag, f.name])), [d.feiertage]);
  return (
    <div className="karte jk-rahmen" tabIndex={0} role="region" aria-label={`Jahreskalender ${d.jahr}, seitlich rollbar`}>
      <table className="jk-tabelle">
        <caption className="nur-vorleser">
          Jahreskalender {d.jahr} von {a.anzeigename}: Monate als Spalten, Tage als Zeilen
        </caption>
        <thead>
          <tr>
            <th scope="col" className="jk-tag">
              <span className="nur-vorleser">Tag</span>
            </th>
            {MONATE.map((m, i) => (
              <th key={m} scope="col" className={d.heute.startsWith(`${d.jahr}-${zwei(i + 1)}`) ? 'jetzt' : undefined}>
                <span className="jk-monat-lang">{m}</span>
                <span className="jk-monat-kurz" aria-hidden="true">
                  {MONATE_KURZ[i]}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 31 }, (_, t) => t + 1).map((t) => (
            <tr key={t}>
              <th scope="row" className="jk-tag">
                {t}
              </th>
              {MONATE.map((m, i) => {
                if (t > tageImMonat(d.jahr, i)) return <td key={m} className="jk-leer" />;
                const tag = iso(d.jahr, i, t);
                const info = tagInfo(d, a, tag, feiertage);
                const wt = wochentag(tag);
                const klassen = ['jk-zelle', info.firma.length ? 'firma' : '', info.art ?? '', info.frei && !info.art ? 'frei' : '', info.ausserhalb ? 'ausserhalb' : '', info.ferien ? 'ferien' : '', tag === d.heute ? 'heute' : ''].filter(Boolean).join(' ');
                const auskunft = [info.voll, info.ferien && `Schulferien: ${info.ferien}`, ...info.firma.map((x) => `Firmentermin: ${x}`), ...info.termine.map((x) => `Termin${x.zeitVon ? ` ${x.zeitVon}` : ''}: ${x.titel}`), info.ausserhalb ? 'nicht in der Ausbildung' : ''].filter(Boolean).join(' · ');
                return (
                  <td key={m} className={klassen} title={`${TAGE_LANG[wt]}, ${datum(tag)}${auskunft ? ` – ${auskunft}` : ''}`}>
                    <span className="jk-wt" aria-hidden="true">
                      {TAGE[wt]}
                    </span>
                    <span className="nur-vorleser">{TAGE_LANG[wt]}</span>
                    {info.text ? <span className="jk-text">{info.text}</span> : info.voll && <span className="nur-vorleser">{info.voll}</span>}
                    {info.ferien && <span className="nur-vorleser">Schulferien</span>}
                    {info.firma.map((x, n) =>
                      info.firmaZeigen ? (
                        <span key={`f${n}`} className="jk-termin firma">
                          {x}
                        </span>
                      ) : (
                        <span key={`f${n}`} className="nur-vorleser">
                          Firmentermin: {x}
                        </span>
                      ),
                    )}
                    {info.termine.map((x, n) => (
                      <span key={n} className="jk-termin">
                        {x.zeitVon ? `${x.zeitVon} ` : ''}
                        {x.titel}
                      </span>
                    ))}
                    {tag === d.heute && <span className="nur-vorleser">heute</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Azubis nach Ausbildungsjahr; wer (noch) nicht in der Ausbildung ist, steht am Ende. */
function gruppen(azubis: JkAzubi[]): { titel: string; azubis: JkAzubi[] }[] {
  const jahre = [...new Set(azubis.map((a) => a.ausbildungsjahr))].sort((x, y) => (x ?? 99) - (y ?? 99));
  return jahre.map((j) => ({ titel: j === null ? 'Ohne laufende Ausbildung' : `${j}. Ausbildungsjahr`, azubis: azubis.filter((a) => a.ausbildungsjahr === j) }));
}

/** Aufeinanderfolgende Tage zu Blöcken zusammenfassen (für Urlaub). */
function bloecke(tage: string[]): { von: string; bis: string }[] {
  const out: { von: string; bis: string }[] = [];
  for (const t of tage) {
    const letzter = out[out.length - 1];
    if (letzter && tagImJahr(t) - tagImJahr(letzter.bis) === 1) letzter.bis = t;
    else out.push({ von: t, bis: t });
  }
  return out;
}

/** Alle Azubis: Monate als Spalten, je Azubi eine Zeile mit Balken. */
function JahrAlle({ d }: { d: Daten }) {
  const tage = tagImJahr(`${d.jahr}-12-31`) + 1;
  const anfang = `${d.jahr}-01-01`;
  const ende = `${d.jahr}-12-31`;
  /** Lage eines Zeitraums auf der Jahresleiste, auf das Jahr begrenzt */
  const lage = (von: string, bis: string) => {
    const a = tagImJahr(von < anfang ? anfang : von);
    const b = tagImJahr(bis > ende ? ende : bis) + 1;
    return { left: `${(a / tage) * 100}%`, width: `${((b - a) / tage) * 100}%` };
  };
  const monate = MONATE.map((m, i) => ({ m, i, ...lage(iso(d.jahr, i, 1), iso(d.jahr, i, tageImMonat(d.jahr, i))) }));
  const heuteDrin = d.heute >= anfang && d.heute <= ende;

  if (d.azubis.length === 0) return <p className="karte leise">Du siehst im Moment keinen Azubi – deshalb ist der Jahreskalender leer.</p>;

  return (
    <>
    <JahrKarten d={d} lage={lage} monate={monate} />
    <div className="karte jk-rahmen nur-breit" tabIndex={0} role="region" aria-label={`Jahreskalender ${d.jahr} aller Azubis, seitlich rollbar`}>
      <table className="jk-alle">
        <caption className="nur-vorleser">Jahreskalender {d.jahr}: je Azubi eine Zeile mit Berufsschule, Einsätzen, Urlaub und Prüfungen</caption>
        <thead>
          <tr>
            <th scope="col" className="jk-name">
              Azubi
            </th>
            <th scope="col">
              <span className="nur-vorleser">Januar bis Dezember {d.jahr}</span>
              <div className="jk-monate" aria-hidden="true">
                {monate.map((x) => (
                  <span key={x.m} style={{ left: x.left, width: x.width }} className={d.heute.startsWith(`${d.jahr}-${zwei(x.i + 1)}`) ? 'jetzt' : undefined}>
                    {MONATE_KURZ[x.i]}
                  </span>
                ))}
              </div>
            </th>
          </tr>
        </thead>
        {d.firmentermine.length > 0 && (
          <tbody>
            <tr className="jk-firma-zeile">
              <th scope="row" className="jk-name">
                Firmentermine
                <span className="leise klein">für alle</span>
              </th>
              <td>
                <div className="jk-bahn" aria-hidden="true">
                  {monate.slice(1).map((x) => (
                    <i key={x.m} className="jk-strich" style={{ left: x.left }} />
                  ))}
                  {d.firmentermine.map((t) => (
                    <b key={t.id} className={`jk-balken firma${parseFloat(lage(t.von, t.bis).left) > 75 ? ' links' : ''}`} style={lage(t.von, t.bis)} title={`Firmentermin: ${t.titel}, ${t.von === t.bis ? datum(t.von) : `${datum(t.von)} bis ${datum(t.bis)}`}`}>
                      <span>{t.titel}</span>
                    </b>
                  ))}
                  {heuteDrin && <i className="jk-heute" style={{ left: lage(d.heute, d.heute).left }} />}
                </div>
                <ul className="nur-vorleser">
                  {d.firmentermine.map((t) => (
                    <li key={t.id}>
                      {t.titel}: {t.von === t.bis ? datum(t.von) : `${datum(t.von)} bis ${datum(t.bis)}`}
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          </tbody>
        )}
        {gruppen(d.azubis).map((g) => (
          <tbody key={g.titel}>
            <tr className="jk-gruppe">
              <th colSpan={2} scope="colgroup">
                {g.titel}
              </th>
            </tr>
            {g.azubis.map((a) => {
              const schule = a.eintraege.filter((e) => e.art === 'schule');
              const einsatz = a.eintraege.filter((e) => e.art === 'einsatz');
              const urlaub = bloecke(a.urlaub);
              const vor = a.beginn && a.beginn > anfang ? lage(anfang, a.beginn > ende ? ende : new Date(Date.parse(`${a.beginn}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)) : null;
              const nach = a.ende && a.ende < ende ? lage(a.ende < anfang ? anfang : new Date(Date.parse(`${a.ende}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10), ende) : null;
              const zeit = (von: string, bis: string) => (von === bis ? datum(von) : `${datum(von)} bis ${datum(bis)}`);
              return (
                <tr key={a.id}>
                  <th scope="row" className="jk-name">
                    <Link zu={`/jahreskalender/${a.id}`}>{a.anzeigename}</Link>
                    {a.beruf && <span className="leise klein">{a.beruf}</span>}
                  </th>
                  <td>
                    <div className="jk-bahn" aria-hidden="true">
                      {monate.slice(1).map((x) => (
                        <i key={x.m} className="jk-strich" style={{ left: x.left }} />
                      ))}
                      {!a.beginn && <i className="jk-aus" style={{ left: 0, width: '100%' }} />}
                      {vor && <i className="jk-aus" style={vor} />}
                      {nach && <i className="jk-aus" style={nach} />}
                      {d.firmentermine.map((t) => (
                        <i key={`f${t.id}`} className="jk-firma-band" style={lage(t.von, t.bis)} title={`Firmentermin: ${t.titel}, ${zeit(t.von, t.bis)}`} />
                      ))}
                      {a.ferien.map((f) => (
                        <i key={f.von} className="jk-ferien" style={lage(f.von, f.bis)} title={`Schulferien: ${f.name}, ${zeit(f.von, f.bis)}`} />
                      ))}
                      {schule.map((e, i) => (
                        <b key={`s${i}`} className="jk-balken schule" style={lage(e.von, e.bis)} title={`Berufsschule: ${e.titel}, ${zeit(e.von, e.bis)}`}>
                          <span>{e.titel}</span>
                        </b>
                      ))}
                      {einsatz.map((e, i) => (
                        <b key={`e${i}`} className="jk-balken einsatz" style={lage(e.von, e.bis)} title={`Einsatz: ${e.titel}, ${zeit(e.von, e.bis)}`}>
                          <span>{e.titel}</span>
                        </b>
                      ))}
                      {urlaub.map((u) => (
                        <b key={u.von} className="jk-balken urlaub" style={lage(u.von, u.bis)} title={`Urlaub: ${zeit(u.von, u.bis)}`} />
                      ))}
                      {a.beantragt.map((u) => (
                        <b key={`b${u.von}`} className="jk-balken urlaub beantragt" style={lage(u.von < anfang ? anfang : u.von, u.bis > ende ? ende : u.bis)} title={`Urlaub beantragt: ${zeit(u.von, u.bis)}`} />
                      ))}
                      {a.pruefungen.map((p, i) => (
                        <b key={`p${i}`} className="jk-pruefung" style={{ left: lage(p.tag, p.tag).left }} title={`Prüfung: ${p.bezeichnung}, ${datum(p.tag)}`} />
                      ))}
                      {heuteDrin && <i className="jk-heute" style={{ left: lage(d.heute, d.heute).left }} />}
                    </div>
                    {/* dieselbe Auskunft als Text – für Vorleseprogramme und wenn Farben nicht reichen */}
                    <ul className="nur-vorleser">
                      {!a.beginn && <li>Ausbildungsbeginn fehlt</li>}
                      {schule.map((e, i) => (
                        <li key={`s${i}`}>
                          Berufsschule {e.titel}: {zeit(e.von, e.bis)}
                        </li>
                      ))}
                      {einsatz.map((e, i) => (
                        <li key={`e${i}`}>
                          Einsatz {e.titel}: {zeit(e.von, e.bis)}
                        </li>
                      ))}
                      {urlaub.map((u) => (
                        <li key={u.von}>Urlaub: {zeit(u.von, u.bis)}</li>
                      ))}
                      {a.beantragt.map((u) => (
                        <li key={`b${u.von}`}>Urlaub beantragt: {zeit(u.von, u.bis)}</li>
                      ))}
                      {a.pruefungen.map((p, i) => (
                        <li key={`p${i}`}>
                          Prüfung {p.bezeichnung}: {datum(p.tag)}
                        </li>
                      ))}
                      {schule.length + einsatz.length + urlaub.length + a.pruefungen.length === 0 && <li>nichts eingetragen</li>}
                    </ul>
                  </td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
    </>
  );
}

interface Zeile {
  art: 'schule' | 'einsatz' | 'urlaub' | 'beantragt' | 'pruefung';
  von: string;
  bis: string;
  titel: string;
}
const ART_NAME: Record<Zeile['art'], string> = { schule: 'Schule', einsatz: 'Einsatz', urlaub: 'Urlaub', beantragt: 'Urlaub?', pruefung: 'Prüfung' };
const kurz = (tag: string) => `${tag.slice(8, 10)}.${tag.slice(5, 7)}.`;

/** Alles, was bei einem Azubi im Jahr ansteht, der Reihe nach. */
function zeilenVon(a: JkAzubi): Zeile[] {
  return [
    ...a.eintraege.map((e) => ({ art: e.art, von: e.von, bis: e.bis, titel: e.titel })),
    ...bloecke(a.urlaub).map((u) => ({ art: 'urlaub' as const, von: u.von, bis: u.bis, titel: '' })),
    ...a.beantragt.map((u) => ({ art: 'beantragt' as const, von: u.von, bis: u.bis, titel: 'beantragt, noch nicht entschieden' })),
    ...a.pruefungen.map((p) => ({ art: 'pruefung' as const, von: p.tag, bis: p.tag, titel: p.bezeichnung })),
  ].sort((x, y) => x.von.localeCompare(y.von) || x.bis.localeCompare(y.bis));
}

function ZeilenListe({ zeilen, heute }: { zeilen: Zeile[]; heute: string }) {
  return (
    <ul className="jk-zeilen">
      {zeilen.map((z, i) => (
        <li key={i} className={z.von <= heute && z.bis >= heute ? 'jetzt' : undefined}>
          <span className={`jk-marke ${z.art}`}>{ART_NAME[z.art]}</span>
          <span className="jk-wann">{z.von === z.bis ? kurz(z.von) : `${kurz(z.von)}–${kurz(z.bis)}`}</span>
          <span className="jk-was">
            {z.titel}
            {z.von <= heute && z.bis >= heute && <span className="leise"> · läuft gerade</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Handy: statt der breiten Tabelle je Azubi eine Karte – oben das Jahr als schmale Leiste zum Überblicken,
 * darunter als Text, was als Nächstes ansteht; das ganze Jahr lässt sich aufklappen.
 */
function JahrKarten({ d, lage, monate }: { d: Daten; lage: (von: string, bis: string) => { left: string; width: string }; monate: { m: string; i: number; left: string; width: string }[] }) {
  const anfang = `${d.jahr}-01-01`;
  const ende = `${d.jahr}-12-31`;
  const laufend = d.heute >= anfang && d.heute <= ende;
  return (
    <div className="nur-schmal jk-karten">
      {gruppen(d.azubis).map((g) => (
        <section key={g.titel} aria-label={g.titel}>
          <h2 className="ueberschrift-klein">{g.titel}</h2>
          {g.azubis.map((a) => {
            const alle = zeilenVon(a);
            // im laufenden Jahr: was heute läuft oder noch kommt; sonst der Anfang des Jahres
            const kommend = (laufend ? alle.filter((z) => z.bis >= d.heute) : alle).slice(0, 3);
            return (
              <article key={a.id} className="karte jk-karte">
                <header>
                  <Link zu={`/jahreskalender/${a.id}`}>{a.anzeigename}</Link>
                  {a.beruf && <span className="leise klein">{a.beruf}</span>}
                </header>
                <div className="jk-mini" aria-hidden="true">
                  <div className="jk-mini-monate">
                    {monate.map((x) => (
                      <span key={x.m} style={{ left: x.left, width: x.width }} className={d.heute.startsWith(`${d.jahr}-${zwei(x.i + 1)}`) ? 'jetzt' : undefined}>
                        {MONATE_KURZ[x.i][0]}
                      </span>
                    ))}
                  </div>
                  <div className="jk-bahn klein">
                    {monate.slice(1).map((x) => (
                      <i key={x.m} className="jk-strich" style={{ left: x.left }} />
                    ))}
                    {!a.beginn && <i className="jk-aus" style={{ left: 0, width: '100%' }} />}
                    {a.beginn && a.beginn > anfang && <i className="jk-aus" style={lage(anfang, a.beginn > ende ? ende : a.beginn)} />}
                    {a.ende && a.ende < ende && <i className="jk-aus" style={lage(a.ende < anfang ? anfang : a.ende, ende)} />}
                    {d.firmentermine.map((t) => (
                      <i key={`f${t.id}`} className="jk-firma-band" style={lage(t.von, t.bis)} />
                    ))}
                    {alle
                      .filter((z) => z.art !== 'pruefung')
                      .map((z, i) => (
                        <b key={i} className={`jk-balken ${z.art === 'beantragt' ? 'urlaub beantragt' : z.art}`} style={lage(z.von, z.bis)} />
                      ))}
                    {a.pruefungen.map((p, i) => (
                      <b key={`p${i}`} className="jk-pruefung" style={{ left: lage(p.tag, p.tag).left }} />
                    ))}
                    {laufend && <i className="jk-heute" style={{ left: lage(d.heute, d.heute).left }} />}
                  </div>
                </div>
                {!a.beginn ? (
                  <p className="leise klein">Ausbildungsbeginn fehlt im Profil.</p>
                ) : alle.length === 0 ? (
                  <p className="leise klein">Für {d.jahr} ist nichts eingetragen.</p>
                ) : (
                  <>
                    <h3 className="jk-karte-titel">{laufend ? 'Jetzt und als Nächstes' : `Anfang ${d.jahr}`}</h3>
                    {kommend.length === 0 ? <p className="leise klein">Bis zum Jahresende steht nichts mehr an.</p> : <ZeilenListe zeilen={kommend} heute={d.heute} />}
                    {alle.length > kommend.length && (
                      <details className="klapp">
                        <summary>
                          Ganzes Jahr ({alle.length} {alle.length === 1 ? 'Eintrag' : 'Einträge'})
                        </summary>
                        <ZeilenListe zeilen={alle} heute={d.heute} />
                      </details>
                    )}
                  </>
                )}
                <p className="klein jk-karte-fuss">
                  <Link zu={`/jahreskalender/${a.id}`}>Tag für Tag ansehen</Link>
                </p>
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}
