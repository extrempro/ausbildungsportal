import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { api, sitzung } from './api';
import { melde, useFensterFokus } from './dialoge';
import { HandbuchLink } from './handbuchLink';

/**
 * Zeitbegrenzung (WCAG 2.2.1): Das Portal meldet nach 8 Stunden ohne Anfrage ab, spätestens nach 24 Stunden.
 * - Fünf Minuten vorher erscheint ein Fenster; „Angemeldet bleiben“ verlängert (nur bei Leerlauf möglich).
 * - Wer abgemeldet wird, während auf der Seite ungespeicherte Eingaben stehen, verliert sie nicht: Die Seite bleibt stehen,
 *   man meldet sich in einem neuen Tab an und speichert danach hier (AbgemeldetFenster).
 * Gespeichert wird dafür nichts – auch nicht im Browser.
 */
const WARNUNG_MS = 5 * 60 * 1000;

const rest = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function SitzungsWarnung() {
  const s = useSyncExternalStore(sitzung.abonniere, sitzung.lies);
  const [jetzt, setJetzt] = useState(() => Date.now());
  // „Verstanden“ bei der festen Grenze: nicht noch einmal zeigen
  const [gesehen, setGesehen] = useState<number | null>(null);
  const geprueft = useRef<number | null>(null);

  useEffect(() => {
    if (!s) return;
    const bis = s.ende - WARNUNG_MS - Date.now();
    // bis zur Warnung ein einziger Wecker; im Fenster jede Sekunde (der Rest wird angezeigt)
    const t = bis > 1000 ? window.setTimeout(() => setJetzt(Date.now()), Math.min(bis, 2 ** 30)) : window.setInterval(() => setJetzt(Date.now()), 1000);
    // ein Tab im Hintergrund wird gebremst – beim Zurückkommen gleich neu rechnen
    const sichtbar = () => document.visibilityState === 'visible' && setJetzt(Date.now());
    document.addEventListener('visibilitychange', sichtbar);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', sichtbar);
    };
  }, [s, jetzt]);

  // abgelaufen: einmal nachfragen – der Server antwortet dann „nicht angemeldet“, und die App zeigt die Anmeldung
  // (oder, bei ungespeicherten Eingaben, das AbgemeldetFenster)
  useEffect(() => {
    if (!s || jetzt < s.ende || geprueft.current === s.ende) return;
    geprueft.current = s.ende;
    void api('GET', '/api/ich').catch(() => undefined);
  }, [s, jetzt]);

  if (!s) return null;
  const uebrig = s.ende - jetzt;
  if (uebrig > WARNUNG_MS || uebrig <= 0 || gesehen === s.ende) return null;
  return <Warnung uebrig={uebrig} fest={s.fest} onVerstanden={() => setGesehen(s.ende)} />;
}

function Warnung({ uebrig, fest, onVerstanden }: { uebrig: number; fest: boolean; onVerstanden: () => void }) {
  const flaeche = useRef<HTMLElement>(null);
  const [laeuft, setLaeuft] = useState(false);
  const bleiben = async () => {
    setLaeuft(true);
    try {
      // jede Anfrage verlängert; die Antwort nennt das neue Ende, dann verschwindet das Fenster von selbst
      await api('GET', '/api/ich');
      melde('Du bleibst angemeldet.');
    } catch {
      // abgelaufen – das übernimmt die App
    } finally {
      setLaeuft(false);
    }
  };
  // Escape heißt hier „weitermachen“ – bei Leerlauf also angemeldet bleiben
  useFensterFokus(flaeche, () => (fest ? onVerstanden() : void bleiben()));
  return (
    <div className="dialog-hintergrund">
      <section ref={flaeche} className="karte dialog" role="alertdialog" aria-modal="true" aria-labelledby="sitzung-kopf" aria-describedby="sitzung-text">
        <h2 id="sitzung-kopf">Du wirst gleich abgemeldet</h2>
        <p id="sitzung-text">
          {fest
            ? 'Aus Sicherheitsgründen endet jede Anmeldung nach 24 Stunden. Speichere jetzt, was du gerade eingibst – danach meldest du dich neu an.'
            : 'Hier ist seit fast acht Stunden nichts passiert. Aus Sicherheitsgründen meldet dich das Portal gleich ab.'}{' '}
          <HandbuchLink kapitel="bedienung">Bedienung</HandbuchLink>
        </p>
        <p className="sitzung-rest" aria-hidden="true">
          noch <strong>{rest(uebrig)}</strong> Minuten
        </p>
        <div className="aktionen links">
          {fest ? (
            <button type="button" className="knopf" data-start-fokus onClick={onVerstanden}>
              Verstanden
            </button>
          ) : (
            <button type="button" className="knopf" data-start-fokus disabled={laeuft} onClick={() => void bleiben()}>
              Angemeldet bleiben
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

/** Abgemeldet, während ungespeicherte Eingaben auf der Seite stehen: nichts wegwerfen, in einem neuen Tab anmelden. */
export function AbgemeldetFenster({ anmeldeSeite, onVerwerfen, onWieder }: { anmeldeSeite: string; onVerwerfen: () => void; onWieder: () => void }) {
  const flaeche = useRef<HTMLElement>(null);
  const [hinweis, setHinweis] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const pruefe = async () => {
    setLaeuft(true);
    setHinweis('');
    try {
      await api('GET', '/api/ich');
      onWieder();
    } catch {
      setHinweis('Du bist noch nicht wieder angemeldet. Melde dich zuerst im neuen Tab an.');
    } finally {
      setLaeuft(false);
    }
  };
  // Escape schließt hier nicht: Ohne Anmeldung lässt sich nichts speichern, und Verwerfen soll eine bewusste Wahl sein
  useFensterFokus(flaeche, () => undefined);
  return (
    <div className="dialog-hintergrund">
      <section ref={flaeche} className="karte dialog" role="alertdialog" aria-modal="true" aria-labelledby="abgemeldet-kopf" aria-describedby="abgemeldet-text">
        <h2 id="abgemeldet-kopf">Deine Anmeldung ist abgelaufen</h2>
        <div id="abgemeldet-text">
          <p>Was du eingegeben hast, steht noch auf dieser Seite – es ist aber noch nicht gespeichert. So rettest du es:</p>
          <ol className="ablauf-liste">
            {['Melde dich in einem neuen Tab an.', 'Komm hierher zurück und wähle „Ich bin wieder angemeldet“.', 'Speichere deine Eingaben wie gewohnt.'].map((schritt, i) => (
              <li key={i}>
                <span className="ablauf-nr">{i + 1}</span>
                <span>{schritt}</span>
              </li>
            ))}
          </ol>
        </div>
        {hinweis && (
          <p className="hinweis fehler" role="alert">
            {hinweis}
          </p>
        )}
        <div className="aktionen links">
          <a className="knopf" href={anmeldeSeite} target="_blank" rel="noopener" data-start-fokus>
            In neuem Tab anmelden
          </a>
          <button type="button" className="knopf schlicht" disabled={laeuft} onClick={() => void pruefe()}>
            Ich bin wieder angemeldet
          </button>
          <button type="button" className="knopf schlicht gefahr" onClick={onVerwerfen}>
            Eingaben verwerfen
          </button>
        </div>
      </section>
    </div>
  );
}
