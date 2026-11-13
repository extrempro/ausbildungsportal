import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { api, datum } from './api';
import { FIGUR_ART, FIGUR_NAME, FIGUREN, FigurBild, TEIL_NAME, TEILE, teileBis } from './begleiter/figuren';
import type { Figur, Teil } from './begleiter/figuren';
import { melde, useFensterFokus } from './dialoge';
import { HandbuchLink } from './handbuchLink';
import { Link, usePfad } from './router';

/**
 * Begleiter: eine kleine Figur, die Azubis durch das Portal begleitet – ein freiwilliges, lustiges Beiwerk.
 *
 * - Am PC sitzt er unten rechts in der Ecke, auf Tablet und Handy als Kopf in der Kopfzeile (unten ist dort kein Platz).
 * - Er sagt höchstens einen kurzen Satz auf einmal, der von selbst wieder verschwindet, und verdeckt keinen Knopf.
 * - Über die Ausbildungszeit bekommt er neun Teile Zubehör und behält sie. Das hängt nur an der Zeit – es gibt keine
 *   Punkte, keine Serien, keinen Vergleich. Ein neues Teil wird einmal mit einer kurzen Animation gezeigt.
 * - Alles hier sieht nur der Azubi selbst.
 */
export interface BegleiterStand {
  erlaubt: boolean;
  gefragt: boolean;
  an: boolean;
  figur: Figur | '';
  name: string;
  stufe: number;
  gezeigt: number;
  naechstesAm: string | null;
  ohneZeit: boolean;
  /** Arten von Erinnerungen, die der Azubi abgeschaltet hat */
  erinnernAus: string[];
}

/** Eine Erinnerung an etwas, das ansteht (vom Server errechnet, nirgends gespeichert). */
interface Erinnerung {
  art: string;
  schluessel: string;
  text: string;
  zu: string;
  knopf: string;
}

/** Die Arten von Erinnerungen in der Reihenfolge, in der sie unter „Konto“ stehen. */
const ERINNERUNGEN: [string, string][] = [
  ['bericht_woche', 'Der Bericht dieser Woche ist noch nicht eingereicht (ab Donnerstag)'],
  ['bericht_alt', 'Berichte aus vergangenen Wochen fehlen'],
  ['bericht_zurueck', 'Ein Bericht kam zurück'],
  ['unterschrift', 'Deine Unterschrift fehlt'],
  ['schule', 'Nächste Woche ist Berufsschule'],
  ['firmentermin', 'Ein Firmentermin steht an'],
  ['pruefung', 'Ein Termin für deine Prüfung steht an'],
  ['urlaub', 'Dein Urlaub beginnt'],
];

/** Anlässe, zu denen der Begleiter etwas sagt. Die Seiten melden sie über begleiterSagt(). */
export type Anlass = 'bericht_eingereicht' | 'bericht_abgezeichnet' | 'urlaub_beantragt' | 'urlaub_genehmigt' | 'abzeichen';

const SPRUECHE: Record<Anlass, string[]> = {
  bericht_eingereicht: ['Bericht eingereicht – stark! Jetzt ist dein Ausbilder dran.', 'Erledigt! Ein Bericht weniger auf der Liste.', 'Sauber. Der Bericht ist raus.'],
  bericht_abgezeichnet: ['Dein Bericht ist abgezeichnet. Läuft bei dir!', 'Abgezeichnet! Wieder eine Woche im Kasten.'],
  urlaub_beantragt: ['Urlaub beantragt. Ich drück die Daumen!', 'Antrag ist raus. Jetzt heißt es kurz warten.'],
  urlaub_genehmigt: ['Dein Urlaub ist genehmigt. Erhol dich gut!', 'Genehmigt! Zeit, Pläne zu machen.'],
  abzeichen: ['Ein neues Abzeichen – Respekt!', 'Das Abzeichen hast du dir verdient.'],
};
const ANTIPPEN = ['Na, alles klar?', 'Ich bin da, wenn du mich brauchst.', 'Heute schon was gelernt? Ich schon.', 'Kurze Pause ist auch Arbeit.', 'Du machst das gut.', 'Schritt für Schritt.'];

/** Satz zu einer Stufe – am Anteil der Ausbildung ausgerichtet, nicht an Monaten (die Dauer ist je Azubi verschieden). */
const STUFEN_TEXT = ['', 'Der Anfang ist gemacht – du bist angekommen.', 'Du findest dich immer besser zurecht.', 'Ein Drittel geschafft!', 'Fast Halbzeit. Weiter so!', 'Die Hälfte liegt hinter dir.', 'Zwei Drittel geschafft!', 'Der Endspurt kommt in Sicht.', 'Fast geschafft – nur noch ein Teil fehlt.', 'Geschafft! Herzlichen Glückwunsch zum Abschluss.'];
/** Wie das neue Teil ins Bild kommt (Name der Animation in index.css). */
const GAG: Record<Teil, string> = { ausweis: 'bf-baumel', muetze: 'bf-fall', schal: 'bf-wickel', schluessel: 'bf-dreh', brille: 'bf-klapp', becher: 'bf-hoch', guertel: 'bf-schnall', schuhe: 'bf-stampf', hut: 'bf-wurf' };

// ---- kleine Leitung zwischen den Seiten und dem Begleiter ----
let sager: ((a: Anlass) => void) | null = null;
let oeffner: (() => void) | null = null;
/** Meldet dem Begleiter einen Anlass (z. B. nach „Bericht einreichen“). Ohne Begleiter passiert nichts. */
export function begleiterSagt(a: Anlass): void {
  sager?.(a);
}
/** Öffnet die große Ansicht „Mein Begleiter“ (z. B. von der Konto-Seite aus). */
export function oeffneBegleiter(): void {
  oeffner?.();
}

/** Ereignis am Fenster: Die Angaben zum Begleiter haben sich geändert. */
const GEAENDERT = 'begleiter-geaendert';
/** Ereignis am Fenster: Der Begleiter soll seine Angaben neu holen (z. B. nach einer Änderung unter „Konto“). */
const NEU_LADEN = 'begleiter-neu-laden';

const zufall = <T,>(liste: T[]): T => liste[Math.floor(Math.random() * liste.length)];
const heute = () => new Date().toLocaleDateString('sv-SE');
/** Merkt sich Kleinigkeiten nur in diesem Browser (z. B. „heute schon begrüßt“); darf jederzeit fehlen. */
function merke(schluessel: string, wert?: string): string | null {
  try {
    if (wert === undefined) return window.localStorage.getItem(schluessel);
    window.localStorage.setItem(schluessel, wert);
  } catch {
    /* kein Speicher – dann eben nicht */
  }
  return null;
}

/** Schlüssel der Erinnerungen, die in diesem Browser schon gezeigt wurden (die letzten 60). */
function gezeigteErinnerungen(): string[] {
  try {
    const liste = JSON.parse(merke('begleiter-erinnert') ?? '[]') as unknown;
    return Array.isArray(liste) ? liste.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function gruss(name: string): string {
  const jetzt = new Date();
  const stunde = jetzt.getHours();
  const tag = jetzt.getDay();
  const zeit = stunde < 11 ? 'Guten Morgen!' : stunde < 17 ? 'Hallo!' : 'Guten Abend!';
  const dazu = tag === 1 ? 'Auf in die neue Woche.' : tag === 5 ? 'Fast Wochenende.' : tag === 0 || tag === 6 ? 'Am Wochenende hier? Fleißig!' : `${name} ist bereit.`;
  return `${zeit} ${dazu}`;
}

function useBreit(): boolean {
  const [breit, setBreit] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const m = window.matchMedia('(min-width: 1024px)');
    const hoere = () => setBreit(m.matches);
    m.addEventListener('change', hoere);
    return () => m.removeEventListener('change', hoere);
  }, []);
  return breit;
}

/**
 * Der Begleiter des angemeldeten Azubis. Liefert drei Stücke, die die App an ihre Plätze setzt:
 * `kopf` (Kopfzeile, nur schmal), `angebot` (Karte oben im Inhalt) und `rest` (Ecke am PC, Sprechblase, Fenster).
 * `ruhig` = es läuft gerade nichts anderes, das Aufmerksamkeit braucht (Führung, Angebot der Führung).
 */
export function useBegleiter(aktiv: boolean, ruhig: boolean): { kopf: ReactNode; angebot: ReactNode; rest: ReactNode } {
  const [stand, setzeStand] = useState<BegleiterStand | null>(null);
  const setStand = useCallback((neu: BegleiterStand | null) => {
    setzeStand(neu);
    window.dispatchEvent(new Event(GEAENDERT));
  }, []);
  // `zu` und `knopf` hat nur eine Erinnerung: Sie bleibt stehen, bis der Azubi sie schließt oder dem Knopf folgt
  const [blase, setBlase] = useState<{ text: string; nr: number; zu?: string; knopf?: string } | null>(null);
  // null = noch nicht geholt
  const [erinnerungen, setErinnerungen] = useState<Erinnerung[] | null>(null);
  const [laden, setLaden] = useState(0);
  // bleibt das Portal über Nacht offen, soll er am nächsten Tag trotzdem grüßen oder erinnern: bei jedem Seitenwechsel nachsehen
  const pfad = usePfad();
  const [tag, setTag] = useState(heute);
  useEffect(() => setTag(heute()), [pfad]);
  const [fenster, setFenster] = useState<'zu' | 'ansicht' | 'auswahl'>('zu');
  // Animation „neues Teil“: von welcher bis zu welcher Stufe; `nochmal` = nur ansehen, nichts merken
  const [feier, setFeier] = useState<{ von: number; bis: number; nochmal: boolean } | null>(null);
  const [klein, setKlein] = useState(() => merke('begleiter-klein') === '1');
  const breit = useBreit();
  const nr = useRef(0);

  useEffect(() => {
    if (!aktiv) return setzeStand(null);
    api<BegleiterStand>('GET', '/api/begleiter').then(setzeStand, () => setzeStand(null));
  }, [aktiv, laden]);
  useEffect(() => {
    const neu = () => setLaden((n) => n + 1);
    window.addEventListener(NEU_LADEN, neu);
    return () => window.removeEventListener(NEU_LADEN, neu);
  }, []);

  const da = !!stand && stand.erlaubt && stand.an && stand.figur !== '';
  const sage = useCallback((text: string, erinnerung?: { zu: string; knopf: string }) => {
    // nie über ein offenes Fenster oder eine Rückfrage reden
    if (document.querySelector('.dialog-hintergrund')) return;
    nr.current += 1;
    setBlase({ text, nr: nr.current, ...erinnerung });
  }, []);

  // woran er heute erinnern könnte – einmal geholt, sobald er da ist (und neu nach einer Änderung unter „Konto“)
  useEffect(() => {
    if (!da) return setErinnerungen(null);
    api<{ erinnerungen: Erinnerung[] }>('GET', '/api/begleiter/erinnerungen').then((r) => setErinnerungen(r.erinnerungen), () => setErinnerungen([]));
  }, [da, laden, tag]);

  // die Sprechblase verschwindet von selbst – eine Erinnerung bleibt, bis sie geschlossen wird
  useEffect(() => {
    if (!blase || blase.zu) return;
    const t = window.setTimeout(() => setBlase(null), 7000);
    return () => window.clearTimeout(t);
  }, [blase]);

  // Leitung zu den Seiten
  useEffect(() => {
    if (!da) return;
    sager = (a) => sage(zufall(SPRUECHE[a]));
    oeffner = () => setFenster('ansicht');
    return () => {
      sager = null;
      oeffner = null;
    };
  }, [da, sage]);
  // ohne Begleiter öffnet „Mein Begleiter“ die Auswahl
  useEffect(() => {
    if (da || !stand?.erlaubt) return;
    oeffner = () => setFenster('auswahl');
    return () => {
      oeffner = null;
    };
  }, [da, stand?.erlaubt]);

  // neues Teil: einmal feiern, sobald nichts anderes läuft; sonst – einmal am Tag – erinnern oder begrüßen
  useEffect(() => {
    if (!da || !stand || !ruhig || feier || fenster !== 'zu') return;
    if (stand.stufe > stand.gezeigt) return setFeier({ von: stand.gezeigt, bis: stand.stufe, nochmal: false });
    if (erinnerungen === null) return;
    // höchstens eine Erinnerung am Tag, und jede nur einmal; steht keine an, grüßt er nur
    if (merke('begleiter-erinnert-am') !== tag) {
      const schon = gezeigteErinnerungen();
      const e = erinnerungen.find((x) => !schon.includes(x.schluessel));
      if (e) {
        merke('begleiter-erinnert-am', tag);
        merke('begleiter-erinnert', JSON.stringify([...schon, e.schluessel].slice(-60)));
        merke('begleiter-gruss', tag);
        return sage(e.text, { zu: e.zu, knopf: e.knopf });
      }
    }
    if (merke('begleiter-gruss') !== tag) {
      merke('begleiter-gruss', tag);
      sage(gruss(stand.name));
    }
  }, [da, stand, ruhig, feier, fenster, sage, erinnerungen, tag, pfad]);

  const schliesseFeier = useCallback(() => {
    if (feier && !feier.nochmal) {
      // gleich hier merken, dass gefeiert ist – sonst ginge das Fenster sofort wieder auf, bevor der Server geantwortet hat
      setzeStand((alt) => alt && { ...alt, gezeigt: Math.max(alt.gezeigt, feier.bis) });
      api<BegleiterStand>('POST', '/api/begleiter/gefeiert', { stufe: feier.bis }).then(setStand, () => {});
    }
    setFeier(null);
  }, [feier, setStand]);

  if (!stand || !stand.erlaubt) return { kopf: null, angebot: null, rest: null };

  const fensterTeil =
    fenster !== 'zu' ? (
      <BegleiterFenster
        stand={stand}
        auswahl={fenster === 'auswahl' || !da}
        onStand={setStand}
        onZu={() => setFenster('zu')}
        onNochmal={(stufe) => {
          setFenster('zu');
          setFeier({ von: stufe - 1, bis: stufe, nochmal: true });
        }}
      />
    ) : null;

  if (!da) {
    return {
      kopf: null,
      angebot:
        !stand.gefragt && ruhig && fenster === 'zu' ? (
          <aside className="hinweis begleiter-angebot nicht-drucken" aria-label="Begleiter">
            <span className="begleiter-angebot-bild">
              <FigurBild figur="biber" stufe={0} groesse={56} />
            </span>
            <span>
              <strong>Willst du einen Begleiter?</strong> Eine kleine Figur, die dich durch die Ausbildung begleitet. Nur zum Spaß – du kannst sie jederzeit ausschalten.
            </span>
            <span className="fuehrung-rechts">
              <button type="button" className="knopf klein" onClick={() => setFenster('auswahl')}>
                Begleiter aussuchen
              </button>
              <button type="button" className="knopf schlicht klein" onClick={() => api<BegleiterStand>('PUT', '/api/begleiter', { an: false }).then(setStand, () => {})}>
                Nein danke
              </button>
            </span>
          </aside>
        ) : null,
      rest: fensterTeil,
    };
  }

  const figur = stand.figur as Figur;
  const oeffne = () => {
    setBlase(null);
    setFenster('ansicht');
  };
  const sprich = blase?.zu ? (
    // Erinnerung: bleibt stehen, mit Knopf zur passenden Seite
    <div className={`begleiter-blase erinnerung${breit ? '' : ' oben'}`} key={blase.nr}>
      {!breit && <FigurBild figur={figur} stufe={stand.stufe} groesse={36} nurKopf />}
      <span>
        {blase.text}
        <span className="begleiter-blase-knoepfe">
          <span onClick={() => setBlase(null)}>
            <Link zu={blase.zu} className="knopf klein">
              {blase.knopf}
            </Link>
          </span>
          <button type="button" className="knopf schlicht klein" onClick={() => setBlase(null)}>
            Schließen
          </button>
        </span>
      </span>
    </div>
  ) : blase ? (
    <button type="button" className={`begleiter-blase${breit ? '' : ' oben'}`} key={blase.nr} onClick={() => setBlase(null)} aria-label={`${stand.name} sagt: ${blase.text} – schließen`}>
      {!breit && <FigurBild figur={figur} stufe={stand.stufe} groesse={36} nurKopf />}
      <span>{blase.text}</span>
    </button>
  ) : null;

  return {
    kopf: breit ? null : (
      <button type="button" className="begleiter-kopf nicht-drucken" onClick={oeffne} aria-label={`Dein Begleiter ${stand.name} – öffnen`} title={stand.name}>
        <FigurBild figur={figur} stufe={stand.stufe} groesse={34} nurKopf />
      </button>
    ),
    angebot: null,
    rest: (
      <>
        {/* was der Begleiter sagt, wird vorgelesen – die Figur selbst ist stumm */}
        <div className="nur-vorleser" role="status">
          {blase ? `${stand.name} sagt: ${blase.text}` : ''}
        </div>
        {breit ? (
          <aside className={`begleiter-ecke nicht-drucken${klein ? ' klein' : ''}`} aria-label="Dein Begleiter">
            {sprich}
            <button type="button" className="begleiter-figur" onClick={oeffne} aria-label={`Dein Begleiter ${stand.name} – öffnen`} title={`${stand.name} – antippen zum Öffnen`}>
              <FigurBild figur={figur} stufe={stand.stufe} groesse={klein ? 40 : 84} nurKopf={klein} />
            </button>
            <button
              type="button"
              className="begleiter-falten"
              aria-label={klein ? `${stand.name} groß zeigen` : `${stand.name} klein machen`}
              title={klein ? 'Groß zeigen' : 'Klein machen'}
              onClick={() => {
                merke('begleiter-klein', klein ? '0' : '1');
                setKlein(!klein);
              }}
            >
              {klein ? '+' : '–'}
            </button>
          </aside>
        ) : (
          sprich && <div className="begleiter-oben nicht-drucken">{sprich}</div>
        )}
        {fensterTeil}
        {feier && fenster === 'zu' && <BegleiterFeier stand={stand} von={feier.von} bis={feier.bis} nochmal={feier.nochmal} onZu={schliesseFeier} />}
      </>
    ),
  };
}

/** Fenster des Begleiters: Fokus auf `erstes`, Tab bleibt im Fenster, Escape schließt, danach zurück (useFensterFokus). */
function useFenster(onZu: () => void, erstes: React.RefObject<HTMLElement | null>) {
  useFensterFokus(erstes, onZu);
  useEffect(() => {
    erstes.current?.focus();
  }, [erstes]);
}

/** Fenster „neues Teil“: Das Teil kommt mit einem kleinen Gag ins Bild. Erscheint je Stufe einmal; Antippen schließt. */
function BegleiterFeier({ stand, von, bis, nochmal, onZu }: { stand: BegleiterStand; von: number; bis: number; nochmal: boolean; onZu: () => void }) {
  const knopf = useRef<HTMLButtonElement>(null);
  useFenster(onZu, knopf);
  const mehrere = bis - von > 1;
  const teil = TEILE[bis - 1];
  const konfetti = useRef(
    Array.from({ length: 24 }, (_, i) => {
      const w = (i / 24) * Math.PI * 2;
      const d = 90 + Math.random() * 90;
      return { x: Math.round(Math.cos(w) * d), y: Math.round(Math.sin(w) * d * 0.8 + 40), r: Math.round(Math.random() * 720 - 360), f: i % 6 };
    }),
  ).current;
  return (
    <div className="dialog-hintergrund" onMouseDown={(e) => e.target === e.currentTarget && onZu()}>
      <section className="karte dialog bf-feier" role="dialog" aria-modal="true" aria-labelledby="bf-feier-kopf" aria-describedby="bf-feier-text" style={{ ['--bf-gag' as string]: mehrere ? 'bf-fall' : GAG[teil] }}>
        <div className="bf-buehne" aria-hidden="true">
          <span className="bf-strahlen" />
          <span className={mehrere ? 'bf-huepf bf-alle' : 'bf-huepf'}>
            <FigurBild figur={stand.figur as Figur} stufe={bis} neu={mehrere ? undefined : teil} groesse={180} />
          </span>
          <span className="bf-konfetti">
            {konfetti.map((k, i) => (
              <i key={i} className={`bf-k${k.f}`} style={{ ['--x' as string]: `${k.x}px`, ['--y' as string]: `${k.y}px`, ['--r' as string]: `${k.r}deg` }} />
            ))}
          </span>
        </div>
        <p className="bf-band">{nochmal ? 'Noch einmal angesehen' : `Neu für ${stand.name}`}</p>
        <h2 id="bf-feier-kopf">{mehrere ? `${stand.name} hat schon ${bis} Teile` : TEIL_NAME[teil]}</h2>
        <p id="bf-feier-text">{mehrere ? `Du bist schon eine Weile dabei – deshalb gibt es gleich alles auf einmal: ${teileBis(bis).map((t) => TEIL_NAME[t]).join(', ')}.` : STUFEN_TEXT[bis]}</p>
        <ol className="bf-punkte" aria-label={`Teil ${bis} von ${TEILE.length}`}>
          {TEILE.map((t, i) => (
            <li key={t} className={i < von ? 'da' : i < bis ? 'neu' : undefined} />
          ))}
        </ol>
        <p className="aktionen">
          <button ref={knopf} type="button" className="knopf" onClick={onZu}>
            {bis === TEILE.length ? 'Danke!' : 'Weiter geht’s'}
          </button>
        </p>
      </section>
    </div>
  );
}

/** Große Ansicht „Mein Begleiter“: Figur groß, gesammelte Teile, Figur und Namen ändern, ausschalten. */
function BegleiterFenster({ stand, auswahl, onStand, onZu, onNochmal }: { stand: BegleiterStand; auswahl: boolean; onStand: (s: BegleiterStand) => void; onZu: () => void; onNochmal: (stufe: number) => void }) {
  const zu = useRef<HTMLButtonElement>(null);
  useFenster(onZu, zu);
  const [aendern, setAendern] = useState(auswahl);
  const [figur, setFigur] = useState<Figur | ''>(stand.figur);
  const [name, setName] = useState(stand.name);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState('');
  const da = stand.an && stand.figur !== '';
  // bei jedem Öffnen ein anderer Satz
  const spruch = useRef(zufall(ANTIPPEN)).current;

  const sende = (body: Record<string, unknown>, meldung: string, danach?: () => void) => {
    setLaeuft(true);
    setFehler('');
    api<BegleiterStand>('PUT', '/api/begleiter', body)
      .then((s) => {
        onStand(s);
        melde(meldung);
        danach?.();
      })
      .catch((e: Error) => setFehler(e.message))
      .finally(() => setLaeuft(false));
  };
  const speichere = (e: FormEvent) => {
    e.preventDefault();
    if (!figur) return setFehler('Bitte such dir eine Figur aus.');
    if (!name.trim()) return setFehler('Bitte gib deinem Begleiter einen Namen.');
    sende({ an: true, figur, name }, da ? 'Begleiter gespeichert.' : `${name.trim()} begleitet dich ab jetzt.`, da ? () => setAendern(false) : onZu);
  };

  return (
    <div className="dialog-hintergrund" onMouseDown={(e) => e.target === e.currentTarget && onZu()}>
      <section className="karte dialog begleiter-fenster" role="dialog" aria-modal="true" aria-labelledby="begleiter-kopf">
        <div className="dialog-kopf">
          <h2 id="begleiter-kopf">{da && !aendern ? `Dein Begleiter ${stand.name}` : da ? 'Begleiter ändern' : 'Such dir einen Begleiter aus'}</h2>
          <button ref={zu} type="button" className="knopf schlicht klein" onClick={onZu}>
            Schließen
          </button>
        </div>

        {da && !aendern ? (
          <>
            <div className="begleiter-gross">
              <FigurBild figur={stand.figur as Figur} stufe={stand.stufe} groesse={170} />
              <div>
                <p className="begleiter-spruch">„{spruch}“</p>
                <p className="begleiter-stand">
                  <strong>
                    {stand.stufe} von {TEILE.length} Teilen
                  </strong>
                </p>
                <p className="leise klein">
                  {stand.ohneZeit
                    ? 'In deinem Profil fehlt noch der Ausbildungsbeginn. Sobald dein Ausbilder ihn einträgt, bekommt dein Begleiter nach und nach Zubehör.'
                    : stand.naechstesAm
                      ? `Das nächste Teil kommt am ${datum(stand.naechstesAm)}. Die Teile verteilen sich gleichmäßig über deine Ausbildungszeit – das letzte gibt es zum Abschluss.`
                      : 'Dein Begleiter hat alles beisammen. Herzlichen Glückwunsch!'}
                </p>
              </div>
            </div>
            <h3>Gesammelte Teile</h3>
            <ol className="begleiter-teile">
              {TEILE.map((t, i) => (
                <li key={t} className={i < stand.stufe ? 'da' : undefined}>
                  <span>
                    {i + 1}. {i < stand.stufe ? TEIL_NAME[t] : 'Überraschung'}
                    {t === 'muetze' && stand.stufe === TEILE.length && <span className="leise klein"> – macht Platz für den Abschlusshut</span>}
                  </span>
                  {i < stand.stufe ? (
                    <button type="button" className="knopf schlicht klein" onClick={() => onNochmal(i + 1)} aria-label={`${TEIL_NAME[t]} noch einmal ansehen`}>
                      Ansehen
                    </button>
                  ) : (
                    <span className="leise klein">kommt noch</span>
                  )}
                </li>
              ))}
            </ol>
            {fehler && (
              <p className="hinweis fehler" role="alert">
                {fehler}
              </p>
            )}
            <p className="leise klein">
              {stand.name} erinnert dich höchstens einmal am Tag an etwas, das ansteht – zum Beispiel an einen fehlenden Bericht. Woran, stellst du unter{' '}
              <span onClick={onZu}>
                <Link zu="/konto">Konto</Link>
              </span>{' '}
              ein.
            </p>
            <p className="aktionen links">
              <button type="button" className="knopf schlicht" onClick={() => setAendern(true)}>
                Figur oder Namen ändern
              </button>
              <button type="button" className="knopf schlicht" disabled={laeuft} onClick={() => sende({ an: false }, 'Begleiter ausgeschaltet. Unter „Konto“ holst du ihn zurück.', onZu)}>
                Begleiter ausschalten
              </button>
            </p>
          </>
        ) : (
          <form onSubmit={speichere}>
            <fieldset className="begleiter-wahl">
              <legend>Welche Figur soll dich begleiten?</legend>
              {FIGUREN.map((f) => (
                <label key={f} className={figur === f ? 'gewaehlt' : undefined}>
                  <input type="radio" name="figur" value={f} checked={figur === f} onChange={() => setFigur(f)} />
                  <FigurBild figur={f} stufe={0} groesse={72} />
                  <strong>{FIGUR_NAME[f]}</strong>
                  <span className="leise klein">{FIGUR_ART[f]}</span>
                </label>
              ))}
            </fieldset>
            <label>
              Wie soll dein Begleiter heißen?
              <input value={name} maxLength={20} placeholder="z. B. Bruno" onChange={(e) => setName(e.target.value)} />
            </label>
            {fehler && (
              <p className="hinweis fehler" role="alert">
                {fehler}
              </p>
            )}
            <p className="aktionen links">
              <button className="knopf" disabled={laeuft}>
                {da ? 'Begleiter speichern' : 'Begleiter einschalten'}
              </button>
              {da ? (
                <button type="button" className="knopf schlicht" onClick={() => setAendern(false)}>
                  Abbrechen
                </button>
              ) : (
                !stand.gefragt && (
                  <button type="button" className="knopf schlicht" disabled={laeuft} onClick={() => sende({ an: false }, 'In Ordnung. Unter „Konto“ kannst du es dir anders überlegen.', onZu)}>
                    Nein danke
                  </button>
                )
              )}
            </p>
          </form>
        )}
        <p className="leise klein">
          Deinen Begleiter siehst nur du. Er bekommt mit der Zeit Zubehör – ganz gleich, wie viel du im Portal machst. <HandbuchLink kapitel="begleiter">Dein Begleiter</HandbuchLink>
        </p>
      </section>
    </div>
  );
}

/** Abschnitt auf der Konto-Seite: Begleiter ein- und ausschalten, große Ansicht öffnen. */
export function BegleiterKonto() {
  const [stand, setStand] = useState<BegleiterStand | null>(null);
  const [fehler, setFehler] = useState('');
  const lade = useCallback(() => {
    api<BegleiterStand>('GET', '/api/begleiter').then(setStand, (e: Error) => setFehler(e.message));
  }, []);
  useEffect(lade, [lade]);
  // ändert sich der Begleiter im Fenster, stimmt auch dieser Abschnitt wieder
  useEffect(() => {
    window.addEventListener(GEAENDERT, lade);
    return () => window.removeEventListener(GEAENDERT, lade);
  }, [lade]);
  if (!stand) return fehler ? <p className="hinweis fehler" role="alert">{fehler}</p> : null;
  const da = stand.an && stand.figur !== '';
  return (
    <section className="karte" id="begleiter">
      <h2>Begleiter</h2>
      {!stand.erlaubt ? (
        <p className="leise">Der Begleiter ist in diesem Portal ausgeschaltet. Das hat der Betreiber des Portals so eingestellt.</p>
      ) : (
        <>
          <p className="leise">
            {da ? `${stand.name} (${FIGUR_NAME[stand.figur as Figur]}) begleitet dich. ${stand.stufe} von ${TEILE.length} Teilen gesammelt.` : 'Eine kleine Figur, die dich durch die Ausbildung begleitet – nur zum Spaß. Du hast gerade keinen Begleiter.'}{' '}
            <HandbuchLink kapitel="begleiter">Dein Begleiter</HandbuchLink>
          </p>
          <p className="aktionen links">
            <button
              type="button"
              className="knopf schlicht"
              onClick={oeffneBegleiter}
            >
              {da ? 'Begleiter öffnen' : 'Begleiter aussuchen'}
            </button>
          </p>
          {da && (
            <fieldset className="begleiter-erinnern">
              <legend>Woran soll {stand.name} dich erinnern?</legend>
              <p className="leise klein">Höchstens eine Erinnerung am Tag, jede nur einmal. Ein Haken wird sofort gespeichert. Ans Lernen erinnert dich dein Begleiter nie.</p>
              {fehler && (
                <p className="hinweis fehler" role="alert">
                  {fehler}
                </p>
              )}
              {ERINNERUNGEN.map(([art, text]) => (
                <label className="haken" key={art}>
                  <input
                    type="checkbox"
                    checked={!stand.erinnernAus.includes(art)}
                    onChange={(e) => {
                      const aus = e.target.checked ? stand.erinnernAus.filter((a) => a !== art) : [...stand.erinnernAus, art];
                      const vorher = stand;
                      setFehler('');
                      // der Haken springt sofort um; scheitert das Speichern, springt er zurück und der Fehler steht darüber
                      setStand({ ...stand, erinnernAus: aus });
                      api<BegleiterStand>('PUT', '/api/begleiter', { an: true, erinnernAus: aus }).then(
                        (s) => {
                          setStand(s);
                          window.dispatchEvent(new Event(NEU_LADEN));
                        },
                        (err: Error) => {
                          setStand(vorher);
                          setFehler(err.message);
                        },
                      );
                    }}
                  />
                  {text}
                </label>
              ))}
            </fieldset>
          )}
        </>
      )}
    </section>
  );
}

/** Schalter des Super-Admins: Begleiter für das ganze Portal an oder aus. */
export function BegleiterSchalter() {
  const [an, setAn] = useState<boolean | null>(null);
  const [fehler, setFehler] = useState('');
  useEffect(() => {
    api<{ an: boolean }>('GET', '/api/begleiter/einstellung').then((r) => setAn(r.an), (e: Error) => setFehler(e.message));
  }, []);
  return (
    <section className="karte">
      <h2>Begleiter für Azubis</h2>
      <p className="leise">
        Azubis können sich eine kleine Figur aussuchen, die sie durch das Portal begleitet und mit der Ausbildungszeit Zubehör bekommt. Reines Beiwerk – ohne Punkte und ohne Vergleich. Was ein Azubi wählt, siehst du nicht.{' '}
        <HandbuchLink kapitel="begleiter-schalter">Begleiter ein- oder ausschalten</HandbuchLink>
      </p>
      {fehler && (
        <p className="hinweis fehler" role="alert">
          {fehler}
        </p>
      )}
      <label className="haken">
        <input
          type="checkbox"
          checked={an === true}
          disabled={an === null}
          onChange={(e) => {
            const neu = e.target.checked;
            setFehler('');
            // der Haken springt sofort um; scheitert das Speichern, springt er zurück und der Fehler steht darüber
            setAn(neu);
            api<{ an: boolean }>('PUT', '/api/begleiter/einstellung', { an: neu }).then(
              (r) => {
                setAn(r.an);
                melde(r.an ? 'Begleiter eingeschaltet.' : 'Begleiter für alle ausgeschaltet.');
              },
              (err: Error) => {
                setAn(!neu);
                setFehler(err.message);
              },
            );
          }}
        />
        Azubis dürfen einen Begleiter haben
      </label>
      <p className="leise klein">Ausgeschaltet verschwindet der Begleiter bei allen Azubis. Ihre Wahl bleibt gespeichert und ist nach dem Einschalten wieder da.</p>
    </section>
  );
}
