import { Ladefehler, melde, rueckfrage } from '../dialoge';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, datum, plusTage } from '../api';
import { EintragFelder } from '../eintragFelder';
import type { EintragWerte } from '../eintragFelder';
import { Link, useUngespeichert } from '../router';
import { HandbuchLink } from '../handbuchLink';

/**
 * Planung → Schulblöcke (Ausbilder): Schulblöcke einmal an der Klasse pflegen. Jeder Azubi der Klasse hat sie im Plan;
 * ändert sich ein Block, ändert er sich bei allen – außer bei denen, die ihn im eigenen Plan einzeln geändert haben.
 */
interface Block {
  id: number;
  von: string;
  bis: string;
  titel: string;
  text: string;
  ausnahmen: number;
}
interface KlasseDaten {
  id: number;
  name: string;
  berufId: number | null;
  anzahlAzubis: number;
  azubis: { id: number; name: string }[];
  bloecke: Block[];
}
interface Daten {
  schulen: { id: number; name: string; ort: string; bundesland: string; klassen: KlasseDaten[] }[];
}
interface Antwort extends Daten {
  azubis: number;
}

const LEER: EintragWerte = { art: 'schule', titel: 'Berufsschule', von: '', bis: '', text: '', zustaendigId: null, unteraufgaben: [] };

/** KW nach ISO 8601 zu einem Montag */
function kw(montag: string): number {
  const d = new Date(`${montag}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 3);
  return Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86_400_000 / 7) + 1;
}

const zeitraum = (b: Pick<Block, 'von' | 'bis'>) => `${datum(b.von)} – ${datum(plusTage(b.bis, 4))}`;
const wochen = (b: Pick<Block, 'von' | 'bis'>) => (b.von === b.bis ? `KW ${kw(b.von)}` : `KW ${kw(b.von)}–${kw(b.bis)}`);
const azubiText = (n: number) => (n === 1 ? 'einem Azubi' : `${n} Azubis`);

/** Formular für einen Block – neu an einer Klasse oder ein vorhandener zum Ändern */
function BlockFormular({ start, knopf, onSpeichern, onAbbrechen }: { start: EintragWerte; knopf: string; onSpeichern: (w: EintragWerte) => Promise<void>; /** zum Ändern: Abbrechen und Fokus gleich im Formular */ onAbbrechen?: () => void }) {
  const [wert, setWert] = useState(start);
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  useUngespeichert(JSON.stringify(wert) !== JSON.stringify(start));
  const sende = async (e: FormEvent) => {
    e.preventDefault();
    setLaeuft(true);
    setFehler('');
    try {
      await onSpeichern(wert);
      setWert(start);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLaeuft(false);
    }
  };
  return (
    <form className="reihe" onSubmit={sende}>
      <EintragFelder wert={wert} setze={(teil) => setWert((alt) => ({ ...alt, ...teil }))} arten={['schule']} personen={[]} autoFokus={!!onAbbrechen} />
      {fehler && (
        <p className="hinweis fehler ganz" role="alert">
          {fehler}
        </p>
      )}
      <div className="aktionen links ganz">
        <button className="knopf" disabled={laeuft}>
          {knopf}
        </button>
        {onAbbrechen && (
          <button type="button" className="knopf schlicht" onClick={onAbbrechen}>
            Abbrechen
          </button>
        )}
      </div>
    </form>
  );
}

function KlasseKarte({ k, onNeu }: { k: KlasseDaten; onNeu: (a: Antwort, text: string) => void }) {
  const [bearbeite, setBearbeite] = useState<number | null>(null);
  const [fehler, setFehler] = useState('');
  const ohneNamen = k.anzahlAzubis - k.azubis.length;

  const neu = async (w: EintragWerte) => {
    const a = await api<Antwort>('POST', '/api/schulbloecke', { klasseId: k.id, von: w.von, bis: w.bis, titel: w.titel, text: w.text });
    onNeu(a, a.azubis > 0 ? `Schulblock eingetragen – er steht jetzt im Plan von ${azubiText(a.azubis)}.` : 'Schulblock eingetragen. In der Klasse ist noch niemand.');
  };
  const aendere = (b: Block) => async (w: EintragWerte) => {
    const a = await api<Antwort>('PUT', `/api/schulbloecke/${b.id}`, { von: w.von, bis: w.bis, titel: w.titel, text: w.text });
    setBearbeite(null);
    onNeu(a, a.azubis > 0 ? `Schulblock geändert – bei ${azubiText(a.azubis)} im Plan.` : 'Schulblock geändert.');
  };
  const loesche = async (b: Block) => {
    if (!(await rueckfrage(`Schulblock „${b.titel}“ (${zeitraum(b)}) der Klasse ${k.name} löschen?\n\nEr verschwindet aus dem Plan aller Azubis der Klasse.`, { ja: 'Schulblock löschen', gefahr: true }))) return;
    try {
      const a = await api<Antwort>('DELETE', `/api/schulbloecke/${b.id}`);
      setFehler('');
      onNeu(a, 'Schulblock gelöscht.');
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Fehler');
    }
  };

  return (
    <details className="karte" open={k.bloecke.length > 0 || undefined}>
      <summary>
        <span>
          <strong>{k.name}</strong>{' '}
          <span className="leise klein">
            · {k.bloecke.length === 1 ? '1 Schulblock' : `${k.bloecke.length} Schulblöcke`} · {k.anzahlAzubis === 1 ? '1 Azubi' : `${k.anzahlAzubis} Azubis`}
          </span>
        </span>
      </summary>
      <p className="leise klein">
        {k.anzahlAzubis === 0
          ? 'Zu dieser Klasse gehört noch niemand. Die Klasse trägst du im Profil eines Azubis ein.'
          : `In der Klasse: ${k.azubis.map((a) => a.name).join(', ')}${ohneNamen > 0 ? `${k.azubis.length ? ' und ' : ''}${ohneNamen === 1 ? 'ein weiterer Azubi' : `${ohneNamen} weitere Azubis`}` : ''}.`}
      </p>
      {k.bloecke.length > 0 && (
        <ul className="liste">
          {k.bloecke.map((b) =>
            bearbeite === b.id ? (
              <li key={b.id}>
                <BlockFormular start={{ ...LEER, von: b.von, bis: b.bis, titel: b.titel, text: b.text }} knopf="Schulblock speichern" onSpeichern={aendere(b)} onAbbrechen={() => setBearbeite(null)} />
              </li>
            ) : (
              <li key={b.id}>
                <div>
                  <strong>{b.titel}</strong> <span className="leise">· {wochen(b)}</span>
                  <br />
                  <span className="klein">{zeitraum(b)}</span>
                  {b.text && <span className="klein leise mehrzeilig"> · {b.text}</span>}
                  {b.ausnahmen > 0 && <span className="klein leise"> · bei {azubiText(b.ausnahmen)} im eigenen Plan abweichend</span>}
                </div>
                <div className="aktionen links">
                  <button type="button" className="knopf schlicht klein" onClick={() => setBearbeite(b.id)}>
                    Schulblock ändern
                  </button>
                  <button type="button" className="knopf schlicht klein gefahr" onClick={() => void loesche(b)}>
                    Schulblock löschen
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
      {fehler && (
        <p className="hinweis fehler" role="alert">
          {fehler}
        </p>
      )}
      <h3>Schulblock hinzufügen</h3>
      <BlockFormular start={LEER} knopf="Schulblock eintragen" onSpeichern={neu} />
    </details>
  );
}

export function Schulbloecke() {
  const [d, setD] = useState<Daten | null>(null);
  const [fehler, setFehler] = useState('');
  const lade = useCallback(() => api<Daten>('GET', '/api/schulbloecke').then(setD, (e: Error) => setFehler(e.message)), []);
  useEffect(() => void lade(), [lade]);
  const neu = (a: Antwort, text: string) => {
    setD(a);
    melde(text);
  };

  const klassen = d?.schulen.reduce((n, s) => n + s.klassen.length, 0) ?? 0;
  if (!d && fehler) return <Ladefehler titel="Schulblöcke" text={fehler} />;
  return (
    <>
      <h1>Schulblöcke</h1>
      <p className="leise">
        Schulblöcke trägst du einmal an der Klasse ein – sie stehen dann im Plan jedes Azubis der Klasse. Verschiebt die Schule einen Block, änderst du ihn hier, und er ändert sich bei allen. Die Azubis erfahren es über die Glocke.{' '}
        <HandbuchLink kapitel="schulbloecke">Schulblöcke der Klassen</HandbuchLink>
      </p>
      <div className="aktionen links">
        <Link zu="/planung/schulbloecke/einlesen" className="knopf">
          Plan der Schule einlesen
        </Link>
      </div>
      {!d && <p className="leise">Lädt …</p>}
      {d && klassen === 0 && (
        <p className="hinweis">
          Es gibt noch keine Klassen. Lege sie unter <Link zu="/verwaltung/stammdaten">Stammdaten</Link> bei der Berufsschule an und trag im Profil jedes Azubis seine Klasse ein.
        </p>
      )}
      {d?.schulen
        .filter((s) => s.klassen.length > 0)
        .map((s) => (
          <section key={s.id}>
            <h2>{[s.name, s.ort].filter(Boolean).join(', ')}</h2>
            {s.klassen.map((k) => (
              <KlasseKarte key={k.id} k={k} onNeu={neu} />
            ))}
          </section>
        ))}
    </>
  );
}
