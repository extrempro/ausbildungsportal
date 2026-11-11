// Darstellung übernommen aus dem FISI-Lernkompass (https://github.com/extrempro/fisi-lernkompass, MIT), dort src/zusatz/.
import { useEffect, useState } from 'react';
import { Icon } from '../icons';
import { Link } from '../router';
import { Grafik, Inline, TabelleAnsicht } from './teile';
import type { Bild, Tabelle } from './teile';

export interface Verweis {
  feld: string;
  feldTitel: string;
  id: string;
  titel: string;
}

interface VergleichKarte {
  titel: string;
  schema: string;
  bild: Bild | null;
  kurz: string;
  plus: string;
  minus: string;
  beispiel: string;
}

interface TextAbschnitt {
  art: 'text' | 'checkliste' | 'vergleich';
  titel: string;
  absaetze: string[];
  bilder: Bild[];
  tabelle: Tabelle | null;
  punkte: string[];
  schritte: string[];
  karten: VergleichKarte[];
}

interface AblaufTabelle {
  titel: string;
  kopf: string[];
  zeilen: string[][];
  neu?: number[];
}

interface AblaufSchritt {
  titel: string;
  text: string;
  aktiv: number[];
  position: number;
  paket: string;
  blockiert?: boolean;
  regel?: number;
  hinweis?: string;
  zeilen: [string, string, string, boolean][];
  ziele?: number[];
  tabelle?: AblaufTabelle;
}

interface AblaufSzenario {
  id: string;
  label: string;
  merksatz: string;
  geraete: { name: string; sub: string }[];
  regeln?: [string, string, string, string, string][];
  spalten?: [string, string, string];
  zeilenTitel?: string;
  schritte: AblaufSchritt[];
}

export interface Zusatz {
  id: string;
  titel: string;
  typ: 'ablauf' | 'text';
  /** Unterthemen, die dieses Zusatzwissen vertieft */
  zu: Verweis[];
  intro: string;
  absaetze: string[];
  abschnitte: TextAbschnitt[];
  szenarien: AblaufSzenario[];
  gelesen: boolean;
}

/** Zusatzwissen eines Themenfelds – freiwillig, zählt nicht zur Ampel; nur ein Haken „Gelesen“. */
export function ZusatzBereich({ feld, zusatz, setzeGelesen }: { feld: string; zusatz: Zusatz[]; setzeGelesen: (z: Zusatz, gelesen: boolean) => Promise<void> }) {
  if (!zusatz.length) return null;
  return (
    <section className="zusatz-bereich" aria-labelledby="zusatz-titel">
      <div className="zusatz-kopf">
        <h2 id="zusatz-titel">
          <Icon name="stern" /> Zusatzwissen
        </h2>
        <span className="pille grau">Freiwillig · zählt nicht zur Ampel</span>
      </div>
      {zusatz.map((z) => (
        <ZusatzKarte key={`${feld}.${z.id}`} feld={feld} z={z} setzeGelesen={setzeGelesen} />
      ))}
    </section>
  );
}

function ZusatzKarte({ feld, z, setzeGelesen }: { feld: string; z: Zusatz; setzeGelesen: (z: Zusatz, gelesen: boolean) => Promise<void> }) {
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState('');
  return (
    <article id={`z-${z.id}`} className={`karte zusatz ${z.gelesen ? 'gelesen' : ''}`}>
      <div className="zusatz-titelzeile">
        <div>
          <h3>{z.titel}</h3>
          {z.intro && (
            <p className="leise">
              <Inline text={z.intro} />
            </p>
          )}
        </div>
        <label className="zusatz-gelesen">
          <input
            type="checkbox"
            checked={z.gelesen}
            disabled={laeuft}
            onChange={(e) => {
              setLaeuft(true);
              setFehler('');
              setzeGelesen(z, e.target.checked)
                .catch((f: unknown) => setFehler(f instanceof Error ? f.message : 'Das hat nicht geklappt.'))
                .finally(() => setLaeuft(false));
            }}
          />
          Gelesen
        </label>
      </div>
      {fehler && (
        <p className="hinweis fehler" role="alert">
          {fehler}
        </p>
      )}
      {z.zu.length > 0 && (
        <p className="zusatz-vertieft klein">
          Vertieft:
          {z.zu.map((v) =>
            v.feld === feld ? (
              <a key={`${v.feld}.${v.id}`} href={`#u-${v.id}`}>
                {v.titel}
              </a>
            ) : (
              <Link key={`${v.feld}.${v.id}`} zu={`/lernen/${v.feld}#u-${v.id}`}>
                {v.feldTitel} › {v.titel}
              </Link>
            ),
          )}
        </p>
      )}
      <details className="klapp lern-zusatz-inhalt">
        <summary>{z.typ === 'ablauf' ? 'Ablauf Schritt für Schritt' : 'Zusatzwissen lesen'}</summary>
        <div className="zusatz-inhalt">
          {z.absaetze.map((a, i) => (
            <p key={i}>
              <Inline text={a} />
            </p>
          ))}
          {z.typ === 'ablauf' && z.szenarien.length > 0 && <Ablauf szenarien={z.szenarien} />}
          {z.typ === 'text' && z.abschnitte.map((a, i) => <Abschnitt key={`${i}-${a.titel}`} a={a} />)}
        </div>
      </details>
    </article>
  );
}

/** Abschnitt mit Text, Grafiken, Tabelle, Listen und Schritten; „Checkliste“ zeigt Haken, „Vergleich“ Karten. */
function Abschnitt({ a }: { a: TextAbschnitt }) {
  return (
    <section className="zusatz-abschnitt">
      {a.titel && <h4>{a.titel}</h4>}
      {a.absaetze.map((t, i) => (
        <p key={i} className={a.art === 'checkliste' ? 'leise' : undefined}>
          <Inline text={t} />
        </p>
      ))}
      {a.bilder.length > 0 && (
        <div className="lern-grafiken">
          {a.bilder.map((b) => (
            <Grafik key={b.datei} bild={b} />
          ))}
        </div>
      )}
      {a.tabelle && <TabelleAnsicht t={a.tabelle} />}
      {a.punkte.length > 0 && (
        <ul className={a.art === 'checkliste' ? 'zusatz-haken' : 'punkte'}>
          {a.punkte.map((p, i) => (
            <li key={i}>
              {a.art === 'checkliste' && <Icon name="haken" />}
              <span>
                <Inline text={p} />
              </span>
            </li>
          ))}
        </ul>
      )}
      {a.schritte.length > 0 && (
        <ol className="zusatz-schritte">
          {a.schritte.map((p, i) => (
            <li key={i}>
              <Inline text={p} />
            </li>
          ))}
        </ol>
      )}
      {a.karten.length > 0 && (
        <div className="zusatz-vergleich">
          {a.karten.map((k) => (
            <div key={k.titel} className="zusatz-vergleich-karte">
              <strong>{k.titel}</strong>
              {k.bild ? <Grafik bild={k.bild} /> : k.schema ? <pre aria-hidden="true">{k.schema}</pre> : null}
              <p>
                <Inline text={k.kurz} />
              </p>
              {k.plus && (
                <p>
                  <strong className="plus">+</strong> <span className="nur-vorleser">Vorteil: </span>
                  <span className="leise">
                    <Inline text={k.plus} />
                  </span>
                </p>
              )}
              {k.minus && (
                <p>
                  <strong className="minus">−</strong> <span className="nur-vorleser">Nachteil: </span>
                  <span className="leise">
                    <Inline text={k.minus} />
                  </span>
                </p>
              )}
              {k.beispiel && (
                <p>
                  <strong>Beispiel:</strong>{' '}
                  <span className="leise">
                    <Inline text={k.beispiel} />
                  </span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Zeit je Schritt beim Abspielen */
const TEMPO = { langsam: 9000, mittel: 6000, schnell: 3500 } as const;
type Tempo = keyof typeof TEMPO;

/** Ablauf Schritt für Schritt: Geräte in einer Reihe, ein Paket wandert, daneben steht, was im Paket steht. */
function Ablauf({ szenarien }: { szenarien: AblaufSzenario[] }) {
  const [szIndex, setSzIndex] = useState(0);
  const [schritt, setSchritt] = useState(0);
  const [spielt, setSpielt] = useState(false);
  const [tempo, setTempo] = useState<Tempo>('mittel');

  const sz = szenarien[Math.min(szIndex, szenarien.length - 1)];
  const n = sz.schritte.length;
  const i = Math.min(schritt, n - 1);
  const s = sz.schritte[i];
  const m = sz.geraete.length;
  const aktiv = (j: number) => s.aktiv.includes(j);
  const links = (p: number) => `calc(60px + ${p} * (100% - 120px) / ${Math.max(1, m - 1)})`;

  useEffect(() => {
    if (!spielt) return;
    const t = setInterval(() => setSchritt((alt) => Math.min(alt + 1, n - 1)), TEMPO[tempo]);
    return () => clearInterval(t);
  }, [spielt, n, tempo]);
  // am letzten Schritt von selbst anhalten
  useEffect(() => {
    if (spielt && i >= n - 1) setSpielt(false);
  }, [spielt, i, n]);

  const gehe = (ziel: number) => {
    setSpielt(false);
    setSchritt(Math.max(0, Math.min(n - 1, ziel)));
  };
  const beschreibung =
    `Geräte: ${sz.geraete.map((g) => g.name).join(', ')}. Beteiligt in diesem Schritt: ${s.aktiv.map((j) => sz.geraete[j]?.name).join(', ')}` +
    (s.blockiert ? '. Das Paket wird verworfen.' : '.') +
    (s.ziele?.length ? ` Kopien gehen an: ${s.ziele.map((j) => sz.geraete[j]?.name).join(', ')}.` : '');

  return (
    <div className="lernablauf">
      {szenarien.length > 1 && (
        <div className="filter" role="group" aria-label="Ablauf wählen">
          {szenarien.map((x, k) => (
            <button
              key={x.id}
              type="button"
              className="knopf schlicht"
              aria-pressed={k === szIndex}
              onClick={() => {
                setSpielt(false);
                setSzIndex(k);
                setSchritt(0);
              }}
            >
              {x.label}
            </button>
          ))}
        </div>
      )}

      <div className="lernablauf-rahmen">
        <div className="lernablauf-buehne">
          <div className="lernablauf-geraete" role="img" aria-label={beschreibung}>
            {sz.geraete.map((g, j) => (
              <div key={g.name} className="lernablauf-glied">
                {j > 0 && <span className={`lernablauf-leitung ${aktiv(j) && aktiv(j - 1) ? 'an' : ''}`} />}
                <div className={`lernablauf-geraet ${aktiv(j) ? 'an' : ''}`}>
                  <strong>{g.name}</strong>
                  <span>{g.sub}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="lernablauf-bahn" aria-hidden="true">
            <span className="lernablauf-linie" />
            {sz.geraete.map((g, j) => (
              <span key={g.name} className="lernablauf-halt" style={{ left: links(j) }} />
            ))}
            {(s.ziele ?? []).map((z, k) => (
              <span key={`${i}-${k}`} className="lernablauf-paket kopie" style={{ left: links(z) }}>
                {s.paket}
              </span>
            ))}
            <span className={`lernablauf-paket ${s.blockiert ? 'blockiert' : ''}`} style={{ left: links(s.position) }}>
              {s.blockiert ? '✕ ' : ''}
              {s.paket}
            </span>
          </div>
        </div>
      </div>

      <div className="lernablauf-erklaerung" aria-live="polite">
        <div className="lernablauf-schritt">
          <span className="lernablauf-zaehler">
            Schritt {i + 1} von {n}
          </span>
          <strong>{s.titel}</strong>
          <p>{s.text}</p>
        </div>
        {s.zeilen.length > 0 ? (
          <div className="tabelle-rahmen">
            <table className="lern-tabelle">
              <caption>{sz.zeilenTitel ?? 'Was im Paket steht'}</caption>
              <thead>
                <tr>
                  <th scope="col">{sz.spalten?.[0] ? sz.spalten[0] : <span className="nur-vorleser">Feld</span>}</th>
                  <th scope="col">{sz.spalten?.[1] ?? 'Quelle'}</th>
                  <th scope="col">{sz.spalten?.[2] ?? 'Ziel'}</th>
                </tr>
              </thead>
              <tbody>
                {s.zeilen.map(([label, q, z, hl]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    <td className={`mono ${hl ? 'hervor' : ''}`}>{q}</td>
                    <td className={`${sz.spalten ? '' : 'mono'} ${hl ? 'hervor' : ''}`}>{z}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : s.tabelle ? (
          <ZustandsTabelle t={s.tabelle} />
        ) : null}
      </div>

      {s.tabelle && s.zeilen.length > 0 && <ZustandsTabelle t={s.tabelle} />}

      {sz.regeln && sz.regeln.length > 0 && (
        <div className="tabelle-rahmen">
          <table className="lern-tabelle">
            <caption>Firewall-Regelwerk (von oben nach unten)</caption>
            <thead>
              <tr>
                {['Nr.', 'Quelle', 'Ziel', 'Port', 'Aktion', 'Prüfung'].map((k) => (
                  <th key={k} scope="col">
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sz.regeln.map((r, j) => {
                const geprueft = typeof s.regel === 'number';
                const greift = geprueft && j === s.regel;
                const erlaubt = r[4] === 'erlauben';
                return (
                  <tr key={r[0]} className={greift ? (erlaubt ? 'lernablauf-erlaubt' : 'lernablauf-verboten') : undefined}>
                    {r.map((zelle, k) => (
                      <td key={k}>{zelle}</td>
                    ))}
                    <td className={greift ? 'hervor-neutral' : 'leise'}>{greift ? (erlaubt ? '✓ greift' : '✕ greift') : geprueft && j < (s.regel ?? 0) ? 'passt nicht' : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {s.hinweis && <p className="leise klein lernablauf-hinweis">{s.hinweis}</p>}
        </div>
      )}

      <div className="lernablauf-steuerung">
        <div className="aktionen links">
          <button type="button" className="knopf schlicht" onClick={() => gehe(i - 1)} disabled={i === 0}>
            ← Schritt zurück
          </button>
          <button
            type="button"
            className="knopf schlicht"
            aria-pressed={spielt}
            onClick={() => {
              if (spielt) return setSpielt(false);
              if (i >= n - 1) setSchritt(0);
              setSpielt(true);
            }}
          >
            {spielt ? 'Ablauf anhalten' : 'Ablauf abspielen'}
          </button>
          <label className="lernablauf-tempo">
            Tempo
            <select value={tempo} onChange={(e) => setTempo(e.target.value as Tempo)}>
              <option value="langsam">langsam</option>
              <option value="mittel">mittel</option>
              <option value="schnell">schnell</option>
            </select>
          </label>
        </div>
        {i < n - 1 ? (
          <button type="button" className="knopf" onClick={() => gehe(i + 1)}>
            Nächster Schritt →
          </button>
        ) : (
          <button type="button" className="knopf" onClick={() => gehe(0)}>
            Ablauf von vorn zeigen
          </button>
        )}
      </div>

      <div className="lern-merksatz">
        <Icon name="hilfe" />
        <div>
          <strong>Merksatz</strong>
          <p>{sz.merksatz}</p>
        </div>
      </div>
    </div>
  );
}

/** Zustand in einem Schritt (MAC-, NAT-, ARP-Tabelle …); neue Zeilen sind hervorgehoben. */
function ZustandsTabelle({ t }: { t: AblaufTabelle }) {
  return (
    <div className="tabelle-rahmen">
      <table className="lern-tabelle">
        <caption>{t.titel}</caption>
        <thead>
          <tr>
            {t.kopf.map((k) => (
              <th key={k} scope="col">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.zeilen.length === 0 && (
            <tr>
              <td colSpan={t.kopf.length} className="leise">
                – noch leer –
              </td>
            </tr>
          )}
          {t.zeilen.map((z, j) => {
            const neu = t.neu?.includes(j);
            return (
              <tr key={j} className={neu ? 'lernablauf-erlaubt' : undefined}>
                {z.map((c, k) => (
                  <td key={k} className={k > 0 ? 'mono' : undefined}>
                    {c}
                    {neu && k === z.length - 1 && <span className="nur-vorleser"> (neu)</span>}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
