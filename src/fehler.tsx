import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from './api';

/**
 * „Fehler melden“: kurzer Text vom Menschen, dazu automatisch ein paar technische Angaben,
 * damit sich das Problem nachstellen lässt. Lesen kann die Meldungen nur der Super-Admin.
 */
const MAX_TEXT = 2000;
const letzteFehler: string[] = [];

/** Merkt sich die letzten Fehlermeldungen des Browsers auf dieser Seite (nur im Speicher, höchstens fünf). */
export function merkeBrowserFehler(): void {
  const merke = (text: string) => {
    letzteFehler.push(`${new Date().toLocaleTimeString('de-DE')} ${text}`.slice(0, 280));
    if (letzteFehler.length > 5) letzteFehler.shift();
  };
  window.addEventListener('error', (e) => merke(e.message || 'Fehler ohne Text'));
  window.addEventListener('unhandledrejection', (e) => merke(String((e.reason as Error | undefined)?.message ?? e.reason)));
}

export function FehlerMelden({ version, onZu }: { version: string; onZu: () => void }) {
  const [text, setText] = useState('');
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [fertig, setFertig] = useState(false);
  const flaeche = useRef<HTMLElement>(null);
  // wohin der Fokus nach dem Schließen zurückgeht – beim ersten Rendern gemerkt, bevor das Textfeld ihn bekommt
  const vorher = useRef<HTMLElement | null>(document.activeElement as HTMLElement | null);
  const seite = window.location.pathname;
  const fenster = `${window.innerWidth} × ${window.innerHeight}`;
  const technik = letzteFehler.join('\n');

  useEffect(() => {
    document.body.classList.add('dialog-offen');
    const zurueck = vorher.current;
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onZu();
      if (e.key !== 'Tab' || !flaeche.current) return;
      const ziele = [...flaeche.current.querySelectorAll<HTMLElement>('button, textarea, summary, a[href]')].filter((el) => !el.hasAttribute('disabled'));
      const erstes = ziele[0];
      const letztes = ziele.at(-1);
      if (e.shiftKey && document.activeElement === erstes) {
        e.preventDefault();
        letztes?.focus();
      } else if (!e.shiftKey && document.activeElement === letztes) {
        e.preventDefault();
        erstes?.focus();
      }
    };
    window.addEventListener('keydown', taste);
    return () => {
      window.removeEventListener('keydown', taste);
      document.body.classList.remove('dialog-offen');
      zurueck?.focus?.();
    };
  }, [onZu]);

  const sende = async (e: FormEvent) => {
    e.preventDefault();
    setLaeuft(true);
    setFehler('');
    try {
      await api('POST', '/api/fehlermeldungen', { text, seite, fenster, technik });
      setFertig(true);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Die Meldung konnte nicht gesendet werden');
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <div className="dialog-hintergrund" onMouseDown={(e) => e.target === e.currentTarget && onZu()}>
      <section ref={flaeche} className="karte dialog melden" role="dialog" aria-modal="true" aria-labelledby="melden-titel">
        <h2 id="melden-titel">Fehler melden</h2>
        {fertig ? (
          <>
            <p className="hinweis gut" role="status">
              Danke! Deine Meldung ist angekommen.
            </p>
            <p className="leise">Der Betreiber des Portals sieht sie und kümmert sich darum. Eine Antwort bekommst du hier im Portal nicht – wenn es eilt, sprich bitte zusätzlich deinen Ausbilder an.</p>
            <div className="knopfzeile">
              <button type="button" className="knopf" autoFocus onClick={onZu}>
                Schließen
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={sende}>
            <p className="leise">Etwas funktioniert nicht oder sieht falsch aus? Beschreibe es kurz. Die Meldung geht an den Betreiber des Portals.</p>
            <label htmlFor="melden-text">Was ist passiert?</label>
            <textarea
              id="melden-text"
              rows={6}
              value={text}
              maxLength={MAX_TEXT}
              required
              minLength={10}
              autoFocus
              aria-describedby="melden-hilfe"
              placeholder={'Zum Beispiel: Ich wollte meinen Bericht einreichen. Nach dem Klick auf „Einreichen“ passiert nichts.'}
              onChange={(e) => setText(e.target.value)}
            />
            <p id="melden-hilfe" className="leise klein">
              Hilfreich ist: Was wolltest du tun? Was ist stattdessen passiert? Bitte schreibe keine Inhalte aus Berichten und keine Passwörter hinein. {text.length} von {MAX_TEXT} Zeichen.
            </p>
            <details className="melden-technik">
              <summary>Das wird automatisch mitgeschickt</summary>
              <dl>
                <dt>Dein Name und deine Rolle</dt>
                <dd>damit man nachfragen kann</dd>
                <dt>Seite</dt>
                <dd>{seite}</dd>
                <dt>Version</dt>
                <dd>{version}</dd>
                <dt>Fenstergröße</dt>
                <dd>{fenster}</dd>
                <dt>Browser</dt>
                <dd>{navigator.userAgent}</dd>
                <dt>Letzte Fehlermeldungen des Browsers</dt>
                <dd>{technik ? <pre>{technik}</pre> : 'keine'}</dd>
              </dl>
            </details>
            {fehler && (
              <p className="hinweis fehler" role="alert">
                {fehler}
              </p>
            )}
            <div className="knopfzeile">
              <button type="submit" className="knopf" disabled={laeuft || text.trim().length < 10}>
                {laeuft ? 'Sendet …' : 'Meldung senden'}
              </button>
              <button type="button" className="knopf schlicht" onClick={onZu}>
                Abbrechen
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
