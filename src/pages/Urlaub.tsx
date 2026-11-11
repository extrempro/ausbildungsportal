import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, datum, zeit, zeitraum } from '../api';
import type { Konto, UrlaubAntrag, UrlaubKonto, UrlaubStatus } from '../api';
import { Ladefehler, melde, rueckfrage } from '../dialoge';
import { HandbuchLink } from '../handbuchLink';
import { Link, useUngespeichert } from '../router';

/**
 * Urlaub beantragen und entscheiden.
 * - Azubi (/urlaub): Urlaubskonto, Antrag stellen, eigene Anträge.
 * - Ausbilder und Beauftragte (/urlaub): alle Anträge ihrer Azubis, zuerst die, bei denen sie selbst etwas tun müssen.
 * - /azubis/12/urlaub: Urlaubskonto und Anträge eines Azubis.
 * Ablauf: beantragen → Beauftragte bestätigen → Ausbilder genehmigt. Hinweise (Berufsschule, Prüfung, Resturlaub) warnen nur.
 */
const tageText = (n: number) => `${n} ${n === 1 ? 'Arbeitstag' : 'Arbeitstage'}`;

function standVon(a: UrlaubAntrag): { text: string; farbe: string } {
  const fest: Record<Exclude<UrlaubStatus, 'offen'>, { text: string; farbe: string }> = {
    genehmigt: { text: 'Genehmigt', farbe: 'gruen' },
    abgelehnt: { text: 'Abgelehnt', farbe: 'rot' },
    zurueckgezogen: { text: 'Zurückgezogen', farbe: 'grau' },
    storniert: { text: 'Storniert', farbe: 'rot' },
  };
  if (a.status !== 'offen') return fest[a.status];
  return a.stufe === 'beauftragte' ? { text: 'Wartet auf Bestätigung', farbe: 'gelb' } : { text: 'Wartet auf Genehmigung', farbe: 'gelb' };
}

const AKTION_TEXT: Record<string, string> = { beantragt: 'Beantragt', bestaetigt: 'Bestätigt', genehmigt: 'Genehmigt', abgelehnt: 'Abgelehnt', zurueckgezogen: 'Zurückgezogen', storniert: 'Storniert' };

function AntragKarte({ a, mitName, onGeaendert }: { a: UrlaubAntrag; mitName: boolean; onGeaendert: () => Promise<void> | void }) {
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  // Ablehnen und Stornieren brauchen eine Begründung – das Feld erscheint an Ort und Stelle
  const [grundFuer, setGrundFuer] = useState<'ablehnen' | 'stornieren' | null>(null);
  const [grund, setGrund] = useState('');
  useUngespeichert(grundFuer !== null && grund.trim() !== '');
  const stand = standVon(a);
  const wer = mitName ? `Urlaub von ${a.azubi.anzeigename}` : 'Urlaub';
  const wann = `${zeitraum(a.von, a.bis)} (${tageText(a.tage)})`;

  const sende = async (aktion: string, body: unknown, fertig: string) => {
    setLaeuft(true);
    setFehler('');
    try {
      await api('POST', `/api/urlaub/${a.id}/${aktion}`, body);
      setGrundFuer(null);
      setGrund('');
      melde(fertig);
      await onGeaendert();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLaeuft(false);
    }
  };

  const bestaetige = async () => {
    if (await rueckfrage(`${wer} bestätigen?\n\n${wann}. Danach entscheidet der Ausbilder. Die Bestätigung lässt sich nicht zurücknehmen.`, { ja: 'Urlaub bestätigen' })) await sende('bestaetigen', {}, 'Urlaub bestätigt.');
  };
  const genehmige = async () => {
    const fehlt = a.bestaetigungFehlt;
    const frage = fehlt.length
      ? `${wer} genehmigen, obwohl die Bestätigung von ${fehlt.join(', ')} noch aussteht?\n\n${wann}. Der Urlaub steht danach im Jahreskalender und im Berichtsheft. Im Verlauf steht, dass ohne diese Bestätigung entschieden wurde.`
      : `${wer} genehmigen?\n\n${wann}. Der Urlaub steht danach im Jahreskalender und im Berichtsheft.`;
    if (await rueckfrage(frage, { ja: fehlt.length ? 'Trotzdem genehmigen' : 'Urlaub genehmigen' })) await sende('genehmigen', { ohneBestaetigung: fehlt.length > 0 }, 'Urlaub genehmigt.');
  };
  const zieheZurueck = async () => {
    if (await rueckfrage(`Antrag für ${wann} zurückziehen?\n\nDer Antrag ist dann erledigt. Du kannst jederzeit einen neuen stellen.`, { ja: 'Antrag zurückziehen', gefahr: true })) await sende('zurueckziehen', {}, 'Antrag zurückgezogen.');
  };
  const sendeGrund = (e: FormEvent) => {
    e.preventDefault();
    if (grundFuer === 'ablehnen') void sende('ablehnen', { kommentar: grund }, 'Antrag abgelehnt.');
    if (grundFuer === 'stornieren') void sende('stornieren', { kommentar: grund }, 'Urlaub storniert.');
  };

  const entscheidung = a.status === 'abgelehnt' || a.status === 'storniert' ? a.verlauf.at(-1) : undefined;
  const r = a.rechte;
  const etwasZuTun = r.bestaetigen || r.genehmigen || r.ablehnen || r.zurueckziehen || r.stornieren;

  return (
    <li className="karte antrag">
      <div className="antrag-kopf">
        <h3>
          {mitName && (
            <>
              <Link zu={`/azubis/${a.azubi.id}/urlaub`}>{a.azubi.anzeigename}</Link>
              <span className="nur-vorleser">: </span>
            </>
          )}
          <span className="antrag-zeit">{zeitraum(a.von, a.bis)}</span>
        </h3>
        <span className={`pille ${stand.farbe}`}>{stand.text}</span>
      </div>
      <p className="antrag-zeile">
        <strong>{tageText(a.tage)}</strong>
        <span className="leise"> · beantragt am {datum(a.erstellt.slice(0, 10))}</span>
      </p>
      {a.bemerkung && <p className="antrag-bemerkung">„{a.bemerkung}“</p>}

      {a.status === 'offen' && (
        <ol className="antrag-schritte" aria-label="Stand des Antrags">
          {a.bestaetigungen.map((b) => (
            <li key={b.name} className={b.zeit ? 'fertig' : undefined}>
              {b.zeit ? `${b.name} hat am ${datum(b.zeit.slice(0, 10))} bestätigt` : `Bestätigung von ${b.name} steht aus`}
            </li>
          ))}
          <li>{a.stufe === 'ausbilder' ? 'Jetzt entscheidet der Ausbilder' : 'Danach entscheidet der Ausbilder'}</li>
        </ol>
      )}
      {entscheidung?.kommentar && (
        <p className="hinweis" role="note">
          <strong>
            {a.status === 'abgelehnt' ? 'Abgelehnt' : 'Storniert'} von {entscheidung.name}:
          </strong>{' '}
          {entscheidung.kommentar}
        </p>
      )}
      {a.hinweise.length > 0 && (r.bestaetigen || r.genehmigen) && (
        <ul className="hinweis antrag-hinweise" role="note" aria-label="Hinweise zu diesem Antrag">
          {a.hinweise.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      )}

      {fehler && (
        <p className="hinweis fehler" role="alert">
          {fehler}
        </p>
      )}

      {grundFuer ? (
        <form onSubmit={sendeGrund} className="antrag-grund">
          <label>
            {grundFuer === 'ablehnen' ? 'Warum lehnst du den Antrag ab?' : 'Warum wird der Urlaub storniert?'}
            <textarea value={grund} onChange={(e) => setGrund(e.target.value)} maxLength={500} rows={3} required autoFocus />
          </label>
          <p className="leise klein">{a.azubi.anzeigename} liest diese Begründung.</p>
          <p className="aktionen links">
            <button className="knopf gefahr" disabled={laeuft || grund.trim() === ''}>
              {grundFuer === 'ablehnen' ? 'Antrag ablehnen' : 'Urlaub stornieren'}
            </button>
            <button
              type="button"
              className="knopf schlicht"
              onClick={() => {
                setGrundFuer(null);
                setGrund('');
              }}
            >
              Abbrechen
            </button>
          </p>
        </form>
      ) : (
        etwasZuTun && (
          <p className="aktionen links">
            {r.bestaetigen && (
              <button type="button" className="knopf" disabled={laeuft} onClick={() => void bestaetige()}>
                Urlaub bestätigen
              </button>
            )}
            {r.genehmigen && (
              <button type="button" className={`knopf${a.stufe === 'ausbilder' ? '' : ' schlicht'}`} disabled={laeuft} onClick={() => void genehmige()}>
                Urlaub genehmigen
              </button>
            )}
            {r.ablehnen && (
              <button type="button" className="knopf schlicht" disabled={laeuft} onClick={() => setGrundFuer('ablehnen')}>
                Antrag ablehnen …
              </button>
            )}
            {r.zurueckziehen && (
              <button type="button" className="knopf schlicht" disabled={laeuft} onClick={() => void zieheZurueck()}>
                Antrag zurückziehen
              </button>
            )}
            {r.stornieren && (
              <button type="button" className="knopf schlicht" disabled={laeuft} onClick={() => setGrundFuer('stornieren')}>
                Urlaub stornieren …
              </button>
            )}
          </p>
        )
      )}

      <details className="klapp">
        <summary>Verlauf</summary>
        <ul className="antrag-verlauf">
          {a.verlauf.map((v, i) => (
            <li key={i}>
              <strong>{AKTION_TEXT[v.aktion] ?? v.aktion}</strong> von {v.name} <span className="leise">· {zeit(v.zeit)}</span>
              {v.kommentar && <span className="antrag-kommentar">{v.kommentar}</span>}
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}

function KontoKarte({ k, eigenes, onJahr }: { k: UrlaubKonto; eigenes: boolean; onJahr: (jahr: number) => void }) {
  return (
    <section className="karte" aria-label={`Urlaubskonto ${k.jahr}`}>
      <div className="antrag-kopf">
        <h2>Urlaubskonto {k.jahr}</h2>
        <span className="filter" role="group" aria-label="Jahr wählen">
          <button type="button" className="knopf schlicht klein" onClick={() => onJahr(k.jahr - 1)} disabled={k.jahr <= 2000}>
            ← {k.jahr - 1}
          </button>
          <button type="button" className="knopf schlicht klein" onClick={() => onJahr(k.jahr + 1)} disabled={k.jahr >= 2100}>
            {k.jahr + 1} →
          </button>
        </span>
      </div>
      <dl className="urlaub-konto">
        <div>
          <dt>Anspruch</dt>
          <dd>{k.anspruch ?? '–'}</dd>
        </div>
        <div>
          <dt>Genehmigt</dt>
          <dd>{k.genehmigt}</dd>
        </div>
        <div>
          <dt>Beantragt</dt>
          <dd>{k.beantragt}</dd>
        </div>
        <div className={k.frei !== null && k.frei < 0 ? 'minus' : undefined}>
          <dt>Noch frei</dt>
          <dd>{k.frei ?? '–'}</dd>
        </div>
      </dl>
      <p className="leise klein">
        Gezählt werden Arbeitstage: Montag bis Freitag ohne Feiertage.{' '}
        {k.anspruch === null
          ? eigenes
            ? 'Dein Urlaubsanspruch ist noch nicht eingetragen – das macht dein Ausbilder in deinem Profil.'
            : 'Der Urlaubsanspruch ist noch nicht eingetragen – das geht im Profil des Azubis unter „Urlaubstage im Jahr“.'
          : 'Das Portal rechnet nur mit den Tagen dieses Jahres. Resturlaub aus dem Vorjahr kennt es nicht.'}
      </p>
    </section>
  );
}

interface Pruefung {
  tage: number;
  hinweise: string[];
  bestaetiger: string[];
}

function AntragFormular({ azubiId, heute, onGestellt }: { azubiId: number; heute: string; onGestellt: () => Promise<void> }) {
  const [von, setVon] = useState('');
  const [bis, setBis] = useState('');
  const [bemerkung, setBemerkung] = useState('');
  const [pruefung, setPruefung] = useState<Pruefung | null>(null);
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  useUngespeichert(von !== '' || bis !== '' || bemerkung.trim() !== '');

  // Sobald der Zeitraum steht: Arbeitstage zählen und sagen, was auffällt
  useEffect(() => {
    setPruefung(null);
    if (!von || !bis || bis < von) return;
    let aktuell = true;
    api<Pruefung>('GET', `/api/azubis/${azubiId}/urlaub/pruefen?von=${von}&bis=${bis}`).then(
      (p) => aktuell && (setPruefung(p), setFehler('')),
      (err: unknown) => aktuell && setFehler(err instanceof Error ? err.message : 'Fehler'),
    );
    return () => {
      aktuell = false;
    };
  }, [azubiId, von, bis]);

  const sende = async (e: FormEvent) => {
    e.preventDefault();
    setLaeuft(true);
    setFehler('');
    try {
      await api('POST', `/api/azubis/${azubiId}/urlaub`, { von, bis, bemerkung });
      setVon('');
      setBis('');
      setBemerkung('');
      melde('Urlaub beantragt.');
      await onGestellt();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLaeuft(false);
    }
  };

  const verkehrt = von !== '' && bis !== '' && bis < von;
  return (
    <section className="karte urlaub-neu">
      <h2>Urlaub beantragen</h2>
      <form onSubmit={sende}>
        <div className="reihe">
          <label>
            Erster Urlaubstag
            <input
              type="date"
              value={von}
              min={heute}
              required
              onChange={(e) => {
                setVon(e.target.value);
                if (!bis || bis < e.target.value) setBis(e.target.value);
              }}
            />
          </label>
          <label>
            Letzter Urlaubstag
            <input type="date" value={bis} min={von || heute} required onChange={(e) => setBis(e.target.value)} />
          </label>
        </div>
        <label>
          Bemerkung (freiwillig)
          <input value={bemerkung} onChange={(e) => setBemerkung(e.target.value)} maxLength={300} />
        </label>
        <p className="leise klein">Einen Grund musst du nicht nennen. Bitte nichts zu Gesundheit oder Privatem eintragen – die Bemerkung lesen dein Ausbilder und deine Ausbildungsbeauftragten.</p>

        {verkehrt && (
          <p className="hinweis fehler" role="alert">
            Der letzte Urlaubstag liegt vor dem ersten.
          </p>
        )}
        <div aria-live="polite">
          {pruefung && pruefung.tage === 0 && (
            <p className="hinweis" role="note">
              In diesem Zeitraum liegt kein Arbeitstag – dafür brauchst du keinen Urlaub.
            </p>
          )}
          {pruefung && pruefung.tage > 0 && (
            <p className="urlaub-ergebnis">
              <strong>Das sind {tageText(pruefung.tage)}.</strong>{' '}
              {pruefung.bestaetiger.length ? `Zuerst bestätigt ${pruefung.bestaetiger.join(' und ')}, danach entscheidet dein Ausbilder.` : 'Über den Antrag entscheidet dein Ausbilder.'}
            </p>
          )}
          {pruefung && pruefung.hinweise.length > 0 && (
            <ul className="hinweis antrag-hinweise" role="note" aria-label="Hinweise zu diesem Zeitraum">
              {pruefung.hinweise.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          )}
        </div>
        {fehler && (
          <p className="hinweis fehler" role="alert">
            {fehler}
          </p>
        )}
        <p className="aktionen links">
          <button className="knopf" disabled={laeuft || verkehrt || pruefung?.tage === 0}>
            Urlaub beantragen
          </button>
        </p>
      </form>
    </section>
  );
}

interface AzubiDaten {
  azubi: { id: number; anzeigename: string };
  eigenes: boolean;
  heute: string;
  konto: UrlaubKonto;
  antraege: UrlaubAntrag[];
}

/** Urlaubskonto und Anträge eines Azubis – die eigene Seite des Azubis oder die Sicht der Betreuer. */
export function UrlaubAzubi({ azubiId }: { azubiId: number }) {
  const [d, setD] = useState<AzubiDaten | null>(null);
  const [jahr, setJahr] = useState<number | null>(null);
  const [fehler, setFehler] = useState('');

  const lade = useCallback(async () => {
    try {
      setD(await api<AzubiDaten>('GET', `/api/azubis/${azubiId}/urlaub${jahr ? `?jahr=${jahr}` : ''}`));
      setFehler('');
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Fehler');
    }
  }, [azubiId, jahr]);
  useEffect(() => void lade(), [lade]);

  if (fehler && !d) return <Ladefehler titel="Urlaub" text={fehler} />;
  if (!d) return <p className="leise">Lädt …</p>;
  const offen = d.antraege.filter((a) => a.status === 'offen');
  const kommend = d.antraege.filter((a) => a.status === 'genehmigt' && a.bis >= d.heute).reverse();
  const frueher = d.antraege.filter((a) => a.status !== 'offen' && !(a.status === 'genehmigt' && a.bis >= d.heute));

  return (
    <>
      {!d.eigenes && (
        <p className="klein">
          <Link zu="/urlaub">← Alle Urlaubsanträge</Link>
        </p>
      )}
      <h1>{d.eigenes ? 'Urlaub' : `Urlaub von ${d.azubi.anzeigename}`}</h1>
      <p className="leise">
        {d.eigenes
          ? 'Hier beantragst du Urlaub. Erst bestätigen deine Ausbildungsbeauftragten, dann genehmigt dein Ausbilder. Genehmigter Urlaub steht von selbst im Jahreskalender und im Berichtsheft.'
          : 'Urlaubskonto und alle Anträge. Genehmigter Urlaub steht von selbst im Jahreskalender und im Berichtsheft der Woche.'}{' '}
        <HandbuchLink kapitel="urlaub">{d.eigenes ? 'Urlaub beantragen' : 'Urlaubsanträge'}</HandbuchLink>
      </p>

      <KontoKarte k={d.konto} eigenes={d.eigenes} onJahr={setJahr} />
      {d.eigenes && <AntragFormular azubiId={azubiId} heute={d.heute} onGestellt={lade} />}

      <Abschnitt titel="Offene Anträge" liste={offen} leer={d.eigenes ? 'Du hast keinen offenen Antrag.' : 'Kein offener Antrag.'} onGeaendert={lade} />
      <Abschnitt titel="Genehmigter Urlaub" liste={kommend} leer="Kein genehmigter Urlaub in der Zukunft." onGeaendert={lade} />
      {frueher.length > 0 && (
        <details className="karte">
          <summary>
            Frühere und erledigte Anträge ({frueher.length})
          </summary>
          <ul className="antrag-liste">
            {frueher.map((a) => (
              <AntragKarte key={a.id} a={a} mitName={false} onGeaendert={lade} />
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function Abschnitt({ titel, liste, leer, mitName = false, onGeaendert }: { titel: string; liste: UrlaubAntrag[]; leer: string; mitName?: boolean; onGeaendert: () => Promise<void> | void }) {
  return (
    <section>
      <h2 className="abschnitt-titel">
        {titel}
        {liste.length > 0 ? ` (${liste.length})` : ''}
      </h2>
      {liste.length === 0 ? (
        <p className="karte leise">{leer}</p>
      ) : (
        <ul className="antrag-liste">
          {liste.map((a) => (
            <AntragKarte key={a.id} a={a} mitName={mitName} onGeaendert={onGeaendert} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Alle Urlaubsanträge der eigenen Azubis – für Ausbilder und Beauftragte. */
export function UrlaubListe({ konto, onGeaendert }: { konto: Konto; onGeaendert: () => void }) {
  const [d, setD] = useState<{ heute: string; antraege: UrlaubAntrag[] } | null>(null);
  const [fehler, setFehler] = useState('');
  const lade = useCallback(async () => {
    try {
      setD(await api('GET', '/api/urlaub'));
      setFehler('');
      onGeaendert();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Fehler');
    }
  }, [onGeaendert]);
  useEffect(() => void lade(), [lade]);

  if (fehler && !d) return <Ladefehler titel="Urlaubsanträge" text={fehler} />;
  if (!d) return <p className="leise">Lädt …</p>;
  const meins = (a: UrlaubAntrag) => a.rechte.bestaetigen || (a.rechte.genehmigen && a.stufe === 'ausbilder');
  const zuTun = d.antraege.filter(meins);
  const wartet = d.antraege.filter((a) => a.status === 'offen' && !meins(a));
  const kommend = d.antraege.filter((a) => a.status === 'genehmigt' && a.bis >= d.heute);
  const frueher = d.antraege.filter((a) => a.status !== 'offen' && !(a.status === 'genehmigt' && a.bis >= d.heute)).reverse();

  return (
    <>
      <h1>Urlaubsanträge</h1>
      <p className="leise">
        {konto.rolle === 'ausbilder'
          ? 'Die Anträge deiner Azubis. Erst bestätigen die Ausbildungsbeauftragten, dann genehmigst du. Ein Klick auf den Namen zeigt das Urlaubskonto.'
          : 'Die Anträge der dir zugewiesenen Azubis. Du bestätigst, danach genehmigt der Ausbilder. Ein Klick auf den Namen zeigt das Urlaubskonto.'}{' '}
        <HandbuchLink kapitel="urlaub">Urlaubsanträge</HandbuchLink>
      </p>
      <Abschnitt titel={konto.rolle === 'ausbilder' ? 'Wartet auf dich' : 'Wartet auf deine Bestätigung'} liste={zuTun} leer="Im Moment wartet kein Antrag auf dich." mitName onGeaendert={lade} />
      {wartet.length > 0 && <Abschnitt titel={konto.rolle === 'ausbilder' ? 'Wartet noch auf eine Bestätigung' : 'Wartet auf andere'} liste={wartet} leer="" mitName onGeaendert={lade} />}
      <Abschnitt titel="Genehmigter Urlaub" liste={kommend} leer="Kein genehmigter Urlaub in der Zukunft." mitName onGeaendert={lade} />
      {frueher.length > 0 && (
        <details className="karte">
          <summary>
            Frühere und erledigte Anträge der letzten zwölf Monate ({frueher.length})
          </summary>
          <ul className="antrag-liste">
            {frueher.map((a) => (
              <AntragKarte key={a.id} a={a} mitName onGeaendert={lade} />
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
