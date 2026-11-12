import { begleiterSagt } from '../begleiter';
import { useCallback, useEffect, useState } from 'react';
import { api, datum } from '../api';
import { Ladefehler } from '../dialoge';
import { HandbuchLink } from '../handbuchLink';
import { AbzeichenFeier } from '../lernen/abzeichen';
import type { Erfolg } from '../lernen/abzeichen';
import { Inline, LernReiter } from '../lernen/teile';
import { Link, useUngespeichert } from '../router';
import { PaketFuss } from './Lernen';
import type { LernPaket } from './Lernen';

/**
 * Üben im Lernmodul: Karteikarten (Lernkartei) und Quiz je Unterthema.
 * Beides entsteht aus den Kernbegriffen und Prüfungsfragen der Cheatsheets. Privat wie der übrige Lernstand.
 */
interface QuizStand {
  id: string;
  titel: string;
  fragen: number;
  stand: 'offen' | 'bestanden' | 'meister';
  versuche: number;
  zuletzt: { richtig: number; gesamt: number; am: string } | null;
  meisterAb: string | null;
  meisterMoeglich: boolean;
}
interface Feld {
  id: string;
  titel: string;
  karten: number;
  faellig: number;
  sicher: number;
  quiz: QuizStand[];
  ohneQuiz: number;
}
const QUIZ_PILLE: Record<QuizStand['stand'], { text: string; farbe: string }> = { offen: { text: 'Offen', farbe: 'grau' }, bestanden: { text: 'Bestanden', farbe: 'gruen' }, meister: { text: 'Meister', farbe: 'violett' } };

/** Übersicht: je Themenfeld Karteikarten und die Quiz mit ihrem Stand. */
export function LernUeben() {
  const [d, setD] = useState<{ paket: LernPaket; themenfelder: Feld[] } | null>(null);
  const [fehler, setFehler] = useState('');
  useEffect(() => {
    api<{ paket: LernPaket; themenfelder: Feld[] }>('GET', '/api/lernen/ueben').then(setD, (e: Error) => setFehler(e.message));
  }, []);
  if (fehler) return <Ladefehler titel="Üben" text={fehler} />;
  if (!d) return <p className="leise">Lädt …</p>;
  const faellig = d.themenfelder.reduce((n, f) => n + f.faellig, 0);
  return (
    <>
      <h1>Üben</h1>
      <LernReiter />
      <p className="leise">
        Karteikarten zum Wiederholen und ein Quiz zu jedem Unterthema. Bestandene Quiz bringen dir die Abzeichen Silber, Gold und Meister. <strong>Deine Ergebnisse siehst nur du.</strong> <HandbuchLink kapitel="ueben">Üben mit Karteikarten und Quiz</HandbuchLink>
      </p>
      <section className="karte ueben-alle">
        <div>
          <h2>Karteikarten aus allen Themenfeldern</h2>
          <p className="leise">{faellig === 0 ? 'Heute ist keine Karte dran. Du kannst trotzdem üben.' : `${faellig} ${faellig === 1 ? 'Karte ist' : 'Karten sind'} heute dran. Eine Runde hat höchstens 20 Karten.`}</p>
        </div>
        <Link zu="/lernen/ueben/karten/alle" className="knopf">
          Karteikarten üben
        </Link>
      </section>
      <ul className="ueben-felder">
        {d.themenfelder.map((f) => (
          <li key={f.id} className="karte">
            <div className="antrag-kopf">
              <h2>{f.titel}</h2>
              <Link zu={`/lernen/ueben/karten/${f.id}`} className="knopf schlicht" aria-label={`Karteikarten üben: ${f.titel}`}>
                Karteikarten üben
              </Link>
            </div>
            <p className="leise klein">
              {f.karten} Karten · {f.faellig} heute dran · {f.sicher} sitzen sicher
            </p>
            {f.quiz.length === 0 ? (
              <p className="leise">Zu diesem Themenfeld gibt es noch kein Quiz – dafür braucht ein Unterthema mindestens drei Kernbegriffe.</p>
            ) : (
              <ul className="ueben-quiz">
                {f.quiz.map((q) => (
                  <li key={q.id}>
                    <span className="ueben-quiz-titel">
                      <strong>{q.titel}</strong>
                      <span className="leise klein">
                        {q.fragen} Fragen
                        {q.zuletzt && ` · zuletzt ${q.zuletzt.richtig} von ${q.zuletzt.gesamt} am ${datum(q.zuletzt.am)}`}
                        {q.stand === 'bestanden' && q.meisterAb && (q.meisterMoeglich ? ' · fehlerfrei zählt jetzt für „Meister“' : ` · für „Meister“ ab ${datum(q.meisterAb)} fehlerfrei wiederholen`)}
                      </span>
                    </span>
                    <span className={`pille ${QUIZ_PILLE[q.stand].farbe}`}>{QUIZ_PILLE[q.stand].text}</span>
                    <Link zu={`/lernen/ueben/quiz/${q.id}`} className="knopf schlicht klein" aria-label={`Quiz starten: ${q.titel}`}>
                      {q.versuche ? 'Quiz wiederholen' : 'Quiz starten'}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {f.quiz.length > 0 && f.ohneQuiz > 0 && (
              <p className="leise klein">
                {f.ohneQuiz} {f.ohneQuiz === 1 ? 'Unterthema hat' : 'Unterthemen haben'} kein Quiz und {f.ohneQuiz === 1 ? 'zählt' : 'zählen'} bei den Abzeichen nicht mit.
              </p>
            )}
          </li>
        ))}
      </ul>
      <PaketFuss p={d.paket} />
    </>
  );
}

interface Karte {
  id: string;
  art: 'begriff' | 'frage';
  feldTitel: string;
  unterthemaTitel: string;
  vorne: string;
  hinten: string[];
  fach: number;
}

/** Eine Runde Karteikarten: Karte ansehen, umdrehen, selbst bewerten. */
export function LernKarten({ feld }: { feld: string }) {
  const [d, setD] = useState<{ feldTitel: string; gesamt: number; faellig: number; karten: Karte[] } | null>(null);
  const [fehler, setFehler] = useState('');
  const [nr, setNr] = useState(0);
  const [offen, setOffen] = useState(false);
  const [gewusst, setGewusst] = useState(0);
  const [laeuft, setLaeuft] = useState(false);
  const [alle, setAlle] = useState(false);
  const lade = useCallback(
    (auchNichtFaellige: boolean) => {
      setD(null);
      setNr(0);
      setGewusst(0);
      setOffen(false);
      setAlle(auchNichtFaellige);
      api<{ feldTitel: string; gesamt: number; faellig: number; karten: Karte[] }>('GET', `/api/lernen/karten?${feld === 'alle' ? '' : `feld=${encodeURIComponent(feld)}&`}${auchNichtFaellige ? 'alle=1' : ''}`).then(setD, (e: Error) => setFehler(e.message));
    },
    [feld],
  );
  useEffect(() => lade(false), [lade]);

  if (fehler && !d) return <Ladefehler titel="Karteikarten" text={fehler} />;
  if (!d) return <p className="leise">Lädt …</p>;
  const k = d.karten[nr];
  const merke = async (wusste: boolean) => {
    setLaeuft(true);
    setFehler('');
    try {
      await api('PATCH', '/api/lernen/karte', { id: k.id, gewusst: wusste });
      if (wusste) setGewusst((n) => n + 1);
      setOffen(false);
      setNr((n) => n + 1);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Das hat nicht geklappt.');
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <>
      <p className="klein">
        <Link zu="/lernen/ueben">← Üben</Link>
      </p>
      <h1>Karteikarten: {d.feldTitel}</h1>
      <p className="leise">
        Lies die Vorderseite, überleg dir die Antwort und dreh die Karte um. Dann sagst du ehrlich, ob du es wusstest. <HandbuchLink kapitel="ueben">Üben mit Karteikarten und Quiz</HandbuchLink>
      </p>
      {d.karten.length === 0 ? (
        <section className="karte">
          <p>{d.gesamt === 0 ? 'Zu diesem Themenfeld gibt es noch keine Karten.' : 'Heute ist keine Karte dran – alle kommen an einem späteren Tag wieder.'}</p>
          {d.gesamt > 0 && (
            <p className="aktionen links">
              <button type="button" className="knopf" onClick={() => lade(true)}>
                Trotzdem üben
              </button>
            </p>
          )}
        </section>
      ) : !k ? (
        <section className="karte ueben-ergebnis" aria-live="polite">
          <h2>Runde fertig</h2>
          <p>
            <strong>
              {gewusst} von {d.karten.length} gewusst.
            </strong>{' '}
            Gewusste Karten kommen später wieder, die anderen sind sofort wieder dran.
          </p>
          <p className="aktionen links">
            <button type="button" className="knopf" onClick={() => lade(alle)}>
              Nächste Runde
            </button>
            <Link zu="/lernen/ueben" className="knopf schlicht">
              Zurück zu „Üben“
            </Link>
          </p>
        </section>
      ) : (
        <section className="karte ueben-karte" aria-live="polite">
          <p className="leise klein ueben-kopfzeile">
            <span>
              Karte {nr + 1} von {d.karten.length}
            </span>
            <span>
              {k.feldTitel} · {k.unterthemaTitel} · {k.fach === 0 ? 'neu' : `Fach ${k.fach} von 5`}
            </span>
          </p>
          <p className="ueben-art">{k.art === 'begriff' ? 'Was bedeutet …' : 'Prüfungsfrage'}</p>
          <p className="ueben-vorne">
            <Inline text={k.vorne} />
          </p>
          {offen ? (
            <>
              <div className="ueben-hinten">
                {k.hinten.length === 1 ? (
                  <p>
                    <Inline text={k.hinten[0]} />
                  </p>
                ) : (
                  <ol>
                    {k.hinten.map((h, i) => (
                      <li key={i}>
                        <Inline text={h} />
                      </li>
                    ))}
                  </ol>
                )}
              </div>
              {fehler && (
                <p className="hinweis fehler" role="alert">
                  {fehler}
                </p>
              )}
              <p className="aktionen links">
                <button type="button" className="knopf" disabled={laeuft} onClick={() => void merke(true)}>
                  Gewusst
                </button>
                <button type="button" className="knopf schlicht" disabled={laeuft} onClick={() => void merke(false)}>
                  Nicht gewusst
                </button>
              </p>
            </>
          ) : (
            <p className="aktionen links">
              <button type="button" className="knopf" onClick={() => setOffen(true)} autoFocus>
                Karte umdrehen
              </button>
            </p>
          )}
        </section>
      )}
    </>
  );
}

interface Frage {
  id: string;
  text: string;
  optionen: string[];
  richtig: string;
}
interface QuizDaten extends Omit<QuizStand, 'fragen'> {
  feld: string;
  feldTitel: string;
  bestehenAb: number;
  fragen: Frage[];
}
interface Ergebnis extends Erfolg {
  richtig: number;
  gesamt: number;
  bestanden: boolean;
  neuMeister: boolean;
  stand: QuizStand['stand'];
  meisterAb: string | null;
}

/** Quiz zu einem Unterthema: Frage für Frage, mit Rückmeldung nach jeder Antwort; am Ende wertet der Server. */
export function LernQuiz({ id }: { id: string }) {
  const [q, setQ] = useState<QuizDaten | null>(null);
  const [fehler, setFehler] = useState('');
  const [nr, setNr] = useState(0);
  const [antworten, setAntworten] = useState<Record<string, string>>({});
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [erfolg, setErfolg] = useState<Erfolg | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const lade = useCallback(() => {
    setQ(null);
    setNr(0);
    setAntworten({});
    setErgebnis(null);
    api<QuizDaten>('GET', `/api/lernen/quiz/${encodeURIComponent(id)}`).then(setQ, (e: Error) => setFehler(e.message));
  }, [id]);
  useEffect(() => lade(), [lade]);
  const schliesse = useCallback(() => {
    setErfolg(null);
    window.setTimeout(() => begleiterSagt('abzeichen'), 300);
  }, []);
  // mitten in der Runde nachfragen, bevor die Seite verlassen wird
  useUngespeichert(Object.keys(antworten).length > 0 && !ergebnis);

  if (fehler && !q) return <Ladefehler titel="Quiz" text={fehler} />;
  if (!q) return <p className="leise">Lädt …</p>;
  const f = q.fragen[nr];
  const gewaehlt = f ? antworten[f.id] : undefined;
  const letzte = nr === q.fragen.length - 1;

  const weiter = async () => {
    if (!letzte) return setNr((n) => n + 1);
    setLaeuft(true);
    setFehler('');
    try {
      const r = await api<Ergebnis>('POST', `/api/lernen/quiz/${encodeURIComponent(id)}`, { antworten });
      setErgebnis(r);
      if (r.abzeichen || r.rang) setErfolg({ abzeichen: r.abzeichen, rang: r.rang });
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Das hat nicht geklappt.');
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <>
      <p className="klein">
        <Link zu="/lernen/ueben">← Üben</Link>
      </p>
      <h1>Quiz: {q.titel}</h1>
      <p className="leise">
        {q.feldTitel} · {q.fragen.length} Fragen · bestanden ab {q.bestehenAb} richtigen Antworten. Zu jeder Erklärung suchst du den passenden Begriff. <HandbuchLink kapitel="ueben">Üben mit Karteikarten und Quiz</HandbuchLink>
      </p>
      {ergebnis ? (
        <section className="karte ueben-ergebnis" aria-live="polite">
          <h2>{ergebnis.bestanden ? (ergebnis.richtig === ergebnis.gesamt ? 'Fehlerfrei!' : 'Bestanden') : 'Noch nicht bestanden'}</h2>
          <p>
            <strong>
              {ergebnis.richtig} von {ergebnis.gesamt} richtig.
            </strong>{' '}
            {ergebnis.neuMeister
              ? 'Diese Runde zählt für „Meister“.'
              : ergebnis.stand === 'meister'
                ? 'Dieses Quiz hast du schon auf „Meister“.'
                : ergebnis.stand === 'bestanden' && ergebnis.meisterAb
                  ? `Für „Meister“ wiederholst du es ab dem ${datum(ergebnis.meisterAb)} fehlerfrei.`
                  : `Zum Bestehen brauchst du ${q.bestehenAb}. Sieh dir das Cheatsheet noch einmal an und versuch es wieder.`}
          </p>
          <p className="aktionen links">
            <button type="button" className={`knopf${ergebnis.bestanden ? ' schlicht' : ''}`} onClick={lade}>
              Quiz wiederholen
            </button>
            <Link zu="/lernen/ueben" className={`knopf${ergebnis.bestanden ? '' : ' schlicht'}`}>
              Zurück zu „Üben“
            </Link>
            <Link zu={`/lernen/${q.feld}#u-${q.id.split('.')[1]}`} className="knopf schlicht">
              Cheatsheet ansehen
            </Link>
          </p>
        </section>
      ) : (
        <section className="karte ueben-karte">
          <p className="leise klein ueben-kopfzeile">
            <span>
              Frage {nr + 1} von {q.fragen.length}
            </span>
          </p>
          <p className="ueben-art">Welcher Begriff ist gemeint?</p>
          <p className="ueben-vorne" id="quiz-frage">
            <Inline text={f.text} />
          </p>
          <div className="ueben-optionen" role="group" aria-labelledby="quiz-frage">
            {f.optionen.map((o) => {
              const zustand = gewaehlt === undefined ? '' : o === f.richtig ? ' richtig' : o === gewaehlt ? ' falsch' : '';
              return (
                <button key={o} type="button" className={`knopf schlicht ueben-option${zustand}`} disabled={gewaehlt !== undefined} aria-pressed={gewaehlt === o} onClick={() => setAntworten((a) => ({ ...a, [f.id]: o }))}>
                  {o}
                  {gewaehlt !== undefined && o === f.richtig && <span className="ueben-marke"> – richtig</span>}
                  {gewaehlt === o && o !== f.richtig && <span className="ueben-marke"> – deine Antwort</span>}
                </button>
              );
            })}
          </div>
          <div aria-live="polite">{gewaehlt !== undefined && <p className={`hinweis${gewaehlt === f.richtig ? ' gut' : ''}`}>{gewaehlt === f.richtig ? 'Richtig.' : `Nicht ganz. Gesucht war „${f.richtig}“.`}</p>}</div>
          {fehler && (
            <p className="hinweis fehler" role="alert">
              {fehler}
            </p>
          )}
          <p className="aktionen links">
            <button type="button" className="knopf" disabled={gewaehlt === undefined || laeuft} onClick={() => void weiter()}>
              {letzte ? 'Quiz auswerten' : 'Nächste Frage'}
            </button>
          </p>
        </section>
      )}
      {erfolg && <AbzeichenFeier erfolg={erfolg} onZu={schliesse} />}
    </>
  );
}
