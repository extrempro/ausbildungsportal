import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, datum, plusTage } from '../api';
import { Avatar } from '../avatar';
import { Ladefehler, melde, rueckfrage } from '../dialoge';
import { HandbuchLink } from '../handbuchLink';
import { Link, useUngespeichert } from '../router';

/**
 * Einsatzwünsche.
 * - Azubi (/einsatzwuensche): Einsatz in einer Abteilung für einige Wochen wünschen, eigene Wünsche sehen und zurückziehen.
 * - Ausbilder (/planung/einsatzwuensche): offene Wünsche genehmigen (Zeitraum anpassbar) oder mit Begründung ablehnen.
 * Genehmigt steht der Einsatz im Ausbildungsplan. Beauftragte sehen Wünsche nicht.
 */
export type WunschStatus = 'offen' | 'genehmigt' | 'abgelehnt' | 'zurueckgezogen';

export interface Wunsch {
  id: number;
  azubi: { id: number; anzeigename: string };
  abteilung: { id: number | null; name: string };
  von: string;
  bis: string;
  zeitraum: string;
  grund: string;
  status: WunschStatus;
  erstellt: string;
  entschieden: string | null;
  entschiedenVon: string;
  begruendung: string;
  imPlan: boolean;
  hinweise: string[];
  rechte: { zurueckziehen: boolean; entscheiden: boolean };
}

const STAND: Record<WunschStatus, { text: string; farbe: string }> = {
  offen: { text: 'Wartet auf Entscheidung', farbe: 'gelb' },
  genehmigt: { text: 'Genehmigt', farbe: 'gruen' },
  abgelehnt: { text: 'Abgelehnt', farbe: 'rot' },
  zurueckgezogen: { text: 'Zurückgezogen', farbe: 'grau' },
};

/** Tage einer Woche als Zeitraum: Montag bis Sonntag der letzten Woche */
const wochenZeitraum = (von: string, bis: string) => `${datum(von)} – ${datum(plusTage(bis, 6))}`;

// ---------- Azubi ----------

interface AzubiDaten {
  azubi: { id: number; anzeigename: string };
  heute: string;
  beginn: string | null;
  ende: string | null;
  abteilungen: { id: number; name: string }[];
  wuensche: Wunsch[];
}

export function WuenscheAzubi({ azubiId }: { azubiId: number }) {
  const [d, setD] = useState<AzubiDaten | null>(null);
  const [fehler, setFehler] = useState('');
  const lade = useCallback(async () => {
    try {
      setD(await api<AzubiDaten>('GET', `/api/azubis/${azubiId}/wuensche`));
      setFehler('');
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Fehler');
    }
  }, [azubiId]);
  useEffect(() => void lade(), [lade]);

  if (fehler && !d) return <Ladefehler titel="Einsatz wünschen" text={fehler} />;
  if (!d) return <p className="leise">Lädt …</p>;
  return (
    <>
      <p className="klein nicht-drucken">
        <Link zu="/">← Ausbildungsplan</Link>
      </p>
      <h1>Einsatz wünschen</h1>
      <p className="leise">
        Du möchtest eine Abteilung kennenlernen? Wünsch dir einen Einsatz dort. Dein Ausbilder entscheidet – genehmigt er, steht der Einsatz in deinem Ausbildungsplan.{' '}
        <HandbuchLink kapitel="einsatzwunsch">Einen Einsatz wünschen</HandbuchLink>
      </p>
      <WunschFormular d={d} onGestellt={lade} />
      <section className="karte">
        <h2>Deine Wünsche</h2>
        {d.wuensche.length === 0 ? (
          <p className="leise">Du hast dir noch keinen Einsatz gewünscht.</p>
        ) : (
          <ul className="antrag-liste">
            {d.wuensche.map((w) => (
              <WunschKarte key={w.id} w={w} mitName={false} onGeaendert={lade} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function WunschFormular({ d, onGestellt }: { d: AzubiDaten; onGestellt: () => Promise<void> }) {
  const [abteilung, setAbteilung] = useState('');
  const [von, setVon] = useState('');
  const [bis, setBis] = useState('');
  const [grund, setGrund] = useState('');
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  useUngespeichert(abteilung !== '' || von !== '' || bis !== '' || grund.trim() !== '');

  if (d.abteilungen.length === 0) {
    return (
      <section className="karte">
        <h2>Neuer Wunsch</h2>
        <p className="hinweis" role="note">
          Im Portal sind noch keine Abteilungen angelegt. Sobald dein Ausbilder sie in den Stammdaten einträgt, kannst du dir hier einen Einsatz wünschen.
        </p>
      </section>
    );
  }

  const sende = async (e: FormEvent) => {
    e.preventDefault();
    setLaeuft(true);
    setFehler('');
    try {
      await api('POST', `/api/azubis/${d.azubi.id}/wuensche`, { abteilungId: Number(abteilung), von, bis, grund });
      setAbteilung('');
      setVon('');
      setBis('');
      setGrund('');
      melde('Wunsch abgeschickt. Dein Ausbilder sieht ihn jetzt.');
      await onGestellt();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLaeuft(false);
    }
  };

  const min = d.heute > (d.beginn ?? '') ? d.heute : (d.beginn ?? d.heute);
  const verkehrt = von !== '' && bis !== '' && bis < von;
  return (
    <section className="karte">
      <h2>Neuer Wunsch</h2>
      <form onSubmit={sende}>
        <label>
          Abteilung
          <select value={abteilung} required onChange={(e) => setAbteilung(e.target.value)}>
            <option value="">– bitte wählen –</option>
            {d.abteilungen.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <div className="reihe">
          <label>
            Ab der Woche mit diesem Tag
            <input type="date" value={von} min={min} max={d.ende ?? undefined} required onChange={(e) => setVon(e.target.value)} />
          </label>
          <label>
            Bis zur Woche mit diesem Tag (leer = eine Woche)
            <input type="date" value={bis} min={von || min} max={d.ende ?? undefined} onChange={(e) => setBis(e.target.value)} />
          </label>
        </div>
        <label>
          Warum? (freiwillig)
          <textarea value={grund} onChange={(e) => setGrund(e.target.value)} maxLength={500} rows={2} placeholder="z. B. Ich möchte lernen, wie Bestellungen ablaufen." />
        </label>
        <p className="leise klein">Gewünscht wird in ganzen Wochen. Den Wunsch und deinen Grund sieht nur dein Ausbilder – die Ausbildungsbeauftragten nicht.</p>
        {verkehrt && (
          <p className="hinweis fehler" role="alert">
            Das Ende liegt vor dem Beginn.
          </p>
        )}
        {fehler && (
          <p className="hinweis fehler" role="alert">
            {fehler}
          </p>
        )}
        <p className="aktionen links">
          <button className="knopf" disabled={laeuft || verkehrt}>
            Wunsch absenden
          </button>
        </p>
      </form>
    </section>
  );
}

// ---------- Karte (beide Rollen) ----------

function WunschKarte({ w, mitName, onGeaendert }: { w: Wunsch; mitName: boolean; onGeaendert: () => Promise<void> | void }) {
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [ablehnen, setAblehnen] = useState(false);
  const [begruendung, setBegruendung] = useState('');
  const [von, setVon] = useState(w.von);
  const [bis, setBis] = useState(plusTage(w.bis, 6));
  useUngespeichert((ablehnen && begruendung.trim() !== '') || von !== w.von || bis !== plusTage(w.bis, 6));
  const stand = STAND[w.status];

  const sende = async (aktion: string, body: unknown, fertig: string) => {
    setLaeuft(true);
    setFehler('');
    try {
      await api('POST', `/api/wuensche/${w.id}/${aktion}`, body);
      setAblehnen(false);
      setBegruendung('');
      melde(fertig);
      await onGeaendert();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLaeuft(false);
    }
  };
  const genehmige = async () => {
    const geaendert = von !== w.von || bis !== plusTage(w.bis, 6);
    const frage = `Einsatz in der Abteilung ${w.abteilung.name} für ${w.azubi.anzeigename} genehmigen?\n\n${geaendert ? `Angepasster Zeitraum: Wochen vom ${datum(von)} bis ${datum(bis)}.` : `Zeitraum: ${w.zeitraum}.`} Der Einsatz steht danach im Ausbildungsplan, die Beauftragten der Abteilung sind für diese Zeit zugewiesen.`;
    if (await rueckfrage(frage, { ja: 'Einsatz genehmigen' })) await sende('genehmigen', geaendert ? { von, bis } : {}, `Einsatz genehmigt – er steht jetzt im Plan von ${w.azubi.anzeigename}.`);
  };
  const zieheZurueck = async () => {
    if (await rueckfrage(`Wunsch für ${w.abteilung.name} (${w.zeitraum}) zurückziehen?\n\nDu kannst jederzeit einen neuen Wunsch stellen.`, { ja: 'Wunsch zurückziehen', gefahr: true })) await sende('zurueckziehen', {}, 'Wunsch zurückgezogen.');
  };
  const lehneAb = (e: FormEvent) => {
    e.preventDefault();
    void sende('ablehnen', { begruendung }, 'Wunsch abgelehnt.');
  };

  return (
    <li className="karte antrag">
      <div className="antrag-kopf">
        <h3>
          {mitName ? (
            <span className="wunsch-wer">
              <Avatar name={w.azubi.anzeigename} />
              <span>
                <Link zu={`/azubis/${w.azubi.id}/plan#kw-${w.von}`}>{w.azubi.anzeigename}</Link> wünscht sich <strong>{w.abteilung.name}</strong>
              </span>
            </span>
          ) : (
            w.abteilung.name
          )}
        </h3>
        <span className={`pille ${stand.farbe}`}>{stand.text}</span>
      </div>
      <p className="antrag-zeile">
        <strong>{w.zeitraum}</strong>
        <span className="leise">
          {' '}
          · {wochenZeitraum(w.von, w.bis)} · gewünscht am {datum(w.erstellt.slice(0, 10))}
        </span>
      </p>
      {w.grund && <p className="antrag-bemerkung">„{w.grund}“</p>}
      {w.status === 'genehmigt' && (
        <p className="antrag-zeile leise">
          Genehmigt von {w.entschiedenVon || 'deinem Ausbilder'} am {datum(w.entschieden?.slice(0, 10))}.{w.imPlan ? ' Der Einsatz steht im Ausbildungsplan.' : ' Der Einsatz wurde inzwischen aus dem Plan genommen.'}
        </p>
      )}
      {w.status === 'abgelehnt' && (
        <p className="hinweis" role="note">
          <strong>Abgelehnt von {w.entschiedenVon || 'deinem Ausbilder'}:</strong> {w.begruendung}
        </p>
      )}
      {w.hinweise.length > 0 && (
        <ul className="hinweis antrag-hinweise" role="note" aria-label="Hinweise zu diesem Wunsch">
          {w.hinweise.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      )}
      {w.rechte.entscheiden && !ablehnen && (
        <div className="reihe">
          <label>
            Ab der Woche mit diesem Tag
            <input type="date" value={von} required onChange={(e) => setVon(e.target.value)} />
          </label>
          <label>
            Bis zur Woche mit diesem Tag
            <input type="date" value={bis} min={von} required onChange={(e) => setBis(e.target.value)} />
          </label>
        </div>
      )}
      {fehler && (
        <p className="hinweis fehler" role="alert">
          {fehler}
        </p>
      )}
      {ablehnen ? (
        <form onSubmit={lehneAb} className="antrag-grund">
          <label>
            Warum lehnst du den Wunsch ab?
            <textarea value={begruendung} onChange={(e) => setBegruendung(e.target.value)} maxLength={500} rows={3} required autoFocus />
          </label>
          <p className="leise klein">{w.azubi.anzeigename} liest diese Begründung.</p>
          <p className="aktionen links">
            <button className="knopf rot" disabled={laeuft || begruendung.trim() === ''}>
              Wunsch ablehnen
            </button>
            <button
              type="button"
              className="knopf schlicht"
              onClick={() => {
                setAblehnen(false);
                setBegruendung('');
              }}
            >
              Abbrechen
            </button>
          </p>
        </form>
      ) : (
        (w.rechte.entscheiden || w.rechte.zurueckziehen) && (
          <p className="aktionen links">
            {w.rechte.entscheiden && (
              <>
                <button type="button" className="knopf" disabled={laeuft || !von || !bis || bis < von} onClick={() => void genehmige()}>
                  Einsatz genehmigen
                </button>
                <button type="button" className="knopf schlicht gefahr" disabled={laeuft} onClick={() => setAblehnen(true)}>
                  Wunsch ablehnen
                </button>
              </>
            )}
            {w.rechte.zurueckziehen && (
              <button type="button" className="knopf schlicht gefahr" disabled={laeuft} onClick={() => void zieheZurueck()}>
                Wunsch zurückziehen
              </button>
            )}
          </p>
        )
      )}
    </li>
  );
}

// ---------- Ausbilder ----------

export function WuenscheListe({ onGeaendert }: { onGeaendert: (offen: number) => void }) {
  const [d, setD] = useState<{ offen: number; wuensche: Wunsch[]; entschieden: Wunsch[] } | null>(null);
  const [fehler, setFehler] = useState('');
  const lade = useCallback(async () => {
    try {
      const r = await api<{ offen: number; wuensche: Wunsch[]; entschieden: Wunsch[] }>('GET', '/api/wuensche');
      setD(r);
      setFehler('');
      onGeaendert(r.offen);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Fehler');
    }
  }, [onGeaendert]);
  useEffect(() => void lade(), [lade]);

  if (fehler && !d) return <Ladefehler titel="Einsatzwünsche" text={fehler} />;
  if (!d) return <p className="leise">Lädt …</p>;
  return (
    <>
      <h1>Einsatzwünsche</h1>
      <p className="leise">
        Azubis wünschen sich Einsätze in Abteilungen. Du entscheidest: Genehmigt steht der Einsatz im Ausbildungsplan, die Beauftragten der Abteilung sind dann zugewiesen. Den Zeitraum kannst du vorher anpassen.{' '}
        <HandbuchLink kapitel="einsatzwuensche">Einsatzwünsche entscheiden</HandbuchLink>
      </p>
      <section className="karte">
        <h2>Wartet auf dich</h2>
        {d.wuensche.length === 0 ? (
          <p className="leise">Im Moment wartet kein Wunsch auf dich.</p>
        ) : (
          <ul className="antrag-liste">
            {d.wuensche.map((w) => (
              <WunschKarte key={w.id} w={w} mitName onGeaendert={lade} />
            ))}
          </ul>
        )}
      </section>
      {d.entschieden.length > 0 && (
        <details className="karte">
          <summary>Entschieden in den letzten 90 Tagen ({d.entschieden.length})</summary>
          <ul className="antrag-liste">
            {d.entschieden.map((w) => (
              <WunschKarte key={w.id} w={w} mitName onGeaendert={lade} />
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
