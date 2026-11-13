import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { RefObject } from 'react';
import { neueVersion } from './api';
import { Icon } from './icons';

/**
 * Einheitliche Rückfragen, Rückmeldungen und Ladefehler für alle Seiten.
 * - rueckfrage(): eigenes Fenster statt des Browser-Dialogs – sieht auf jedem Gerät gleich aus und nennt die Folgen.
 * - melde(): kurze Bestätigung an immer derselben Stelle (unten), bleibt einige Sekunden und lässt sich schließen.
 * - Ladefehler: Überschrift bleibt stehen, der Fehler wird vorgelesen, „Erneut versuchen“ lädt neu.
 */
/** Was in einem Fenster mit Tab erreichbar ist – sichtbar, nicht gesperrt, nicht aus der Tab-Folge genommen. */
function fokusZiele(flaeche: HTMLElement): HTMLElement[] {
  return [...flaeche.querySelectorAll<HTMLElement>('button, input, select, textarea, summary, a[href], [tabindex]')].filter(
    (el) => !el.hasAttribute('disabled') && el.tabIndex >= 0 && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden',
  );
}

/**
 * Der eine Baustein für Fenster (role="dialog", WCAG 2.4.3): Beim Öffnen steht der Fokus im Fenster (auf dem Feld mit
 * `autoFocus` bzw. `data-start-fokus`, sonst dem ersten Bedienelement), Tab und Umschalt+Tab bleiben darin, Escape schließt,
 * und nach dem Schließen steht der Fokus wieder dort, wo er vorher war. `sperren`: Die Seite dahinter rollt nicht mit.
 * `flaeche` ist das Fenster selbst oder ein Element darin (dann gilt das umgebende role="dialog").
 */
export function useFensterFokus(flaeche: RefObject<HTMLElement | null>, schliesse: () => void, o: { sperren?: boolean } = {}): void {
  const zuletzt = useRef(schliesse);
  zuletzt.current = schliesse;
  // schon beim ersten Rendern merken – danach kann autoFocus den Fokus bereits ins Fenster gelegt haben
  const vorherRef = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  useEffect(() => {
    const vorher = vorherRef.current;
    if (o.sperren) document.body.classList.add('dialog-offen');
    // erst nach dem Zeichnen – autoFocus im Fenster hat dann schon gegriffen
    // die Fläche ist das Fenster selbst – oder das Fenster, in dem das übergebene Element steht
    const fenster = () => flaeche.current?.closest<HTMLElement>('[role=dialog],[role=alertdialog]') ?? flaeche.current;
    const start = requestAnimationFrame(() => {
      const f = fenster();
      if (!f || f.contains(document.activeElement)) return;
      (f.querySelector<HTMLElement>('[data-start-fokus]') ?? fokusZiele(f)[0] ?? f).focus();
    });
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        zuletzt.current();
        return;
      }
      const f = fenster();
      if (e.key !== 'Tab' || !f) return;
      const ziele = fokusZiele(f);
      if (!ziele.length) return;
      const erstes = ziele[0];
      const letztes = ziele[ziele.length - 1];
      const drin = f.contains(document.activeElement);
      if (!drin || (e.shiftKey && document.activeElement === erstes) || (!e.shiftKey && document.activeElement === letztes)) {
        e.preventDefault();
        (e.shiftKey ? letztes : erstes).focus();
      }
    };
    window.addEventListener('keydown', taste);
    return () => {
      cancelAnimationFrame(start);
      window.removeEventListener('keydown', taste);
      if (o.sperren) document.body.classList.remove('dialog-offen');
      vorher?.focus?.();
    };
    // ein Fenster öffnet einmal und schließt einmal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

interface Frage {
  text: string;
  ja: string;
  gefahr: boolean;
  antwort: (ja: boolean) => void;
}
interface Meldung {
  id: number;
  text: string;
}

let frage: Frage | null = null;
let meldungen: Meldung[] = [];
let zaehler = 0;
const hoerer = new Set<() => void>();
const sage = () => hoerer.forEach((h) => h());
const abonniere = (h: () => void) => {
  hoerer.add(h);
  return () => hoerer.delete(h);
};

/**
 * Fragt nach, bevor etwas Folgenreiches passiert. Der erste Absatz ist die Frage, weitere Absätze (durch Leerzeile getrennt) nennen die Folgen.
 * gefahr: für Endgültiges (Löschen) – der Knopf ist rot und der Fokus steht auf „Abbrechen“.
 */
export function rueckfrage(text: string, o: { ja?: string; gefahr?: boolean } = {}): Promise<boolean> {
  return new Promise((antwort) => {
    // eine zweite Frage, während die erste noch offen ist, gilt als „Nein“ auf die erste
    frage?.antwort(false);
    frage = { text, ja: o.ja ?? 'Ja, fortfahren', gefahr: o.gefahr ?? false, antwort };
    sage();
  });
}

const DAUER_MS = 8000;
export function melde(text: string): void {
  const id = ++zaehler;
  meldungen = [...meldungen.slice(-2), { id, text }];
  sage();
  window.setTimeout(() => schliesseMeldung(id), DAUER_MS);
}
function schliesseMeldung(id: number): void {
  if (!meldungen.some((m) => m.id === id)) return;
  meldungen = meldungen.filter((m) => m.id !== id);
  sage();
}

function FrageFenster({ f }: { f: Frage }) {
  const flaeche = useRef<HTMLElement>(null);
  const vorher = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const antworte = (ja: boolean) => {
    frage = null;
    sage();
    f.antwort(ja);
  };
  useEffect(() => {
    const zurueck = vorher.current;
    // in der Einfangphase: Ein Fenster darunter (z. B. der Plan-Eintrag) bekommt Escape und Tab nicht mit
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        antworte(false);
      }
      if (e.key !== 'Tab' || !flaeche.current) return;
      e.stopPropagation();
      const ziele = [...flaeche.current.querySelectorAll<HTMLElement>('button')];
      const i = ziele.indexOf(document.activeElement as HTMLElement);
      e.preventDefault();
      ziele[(i + (e.shiftKey ? -1 : 1) + ziele.length) % ziele.length]?.focus();
    };
    window.addEventListener('keydown', taste, true);
    return () => {
      window.removeEventListener('keydown', taste, true);
      zurueck?.focus?.();
    };
    // das Fenster gehört zu genau einer Frage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [kopf, ...rest] = f.text.split('\n\n');
  return (
    <div className="dialog-hintergrund frage-hintergrund" onMouseDown={(e) => e.target === e.currentTarget && antworte(false)}>
      <section ref={flaeche} className="karte dialog frage-dialog" role="alertdialog" aria-modal="true" aria-labelledby="frage-kopf" aria-describedby={rest.length ? 'frage-text' : undefined}>
        <h2 id="frage-kopf">{kopf}</h2>
        {rest.length > 0 && (
          <div id="frage-text">
            {rest.map((absatz, i) => (
              <p key={i}>{absatz}</p>
            ))}
          </div>
        )}
        <div className="aktionen links">
          <button type="button" className={`knopf frage-ja${f.gefahr ? ' rot' : ''}`} autoFocus={!f.gefahr} onClick={() => antworte(true)}>
            {f.ja}
          </button>
          <button type="button" className="knopf schlicht frage-nein" autoFocus={f.gefahr} onClick={() => antworte(false)}>
            Abbrechen
          </button>
        </div>
      </section>
    </div>
  );
}

/** Einmal in der App eingebunden: zeigt die offene Rückfrage und die Rückmeldungen. */
export function Dialoge() {
  const f = useSyncExternalStore(abonniere, () => frage);
  const liste = useSyncExternalStore(abonniere, () => meldungen);
  const version = useSyncExternalStore(neueVersion.abonniere, neueVersion.lies);
  return (
    <>
      {f && <FrageFenster key={f.text} f={f} />}
      {/* immer im Dokument, damit Bildschirmleser neue Meldungen ansagen */}
      <div className="meldungen nicht-drucken" role="status" aria-live="polite">
        {/* bleibt stehen, bis neu geladen oder „Später“ gewählt wird – anders als die kurzen Bestätigungen */}
        {version && (
          <div className="meldung-zeile update">
            <Icon name="versionen" />
            <span>
              <strong>Das Portal wurde aktualisiert (Version {version}).</strong> Bitte lade die Seite neu, damit alles richtig funktioniert. Speichere vorher, was du gerade eingibst.
            </span>
            <span className="update-knoepfe">
              <button type="button" className="knopf klein" onClick={() => window.location.reload()}>
                Seite neu laden
              </button>
              <button type="button" className="knopf schlicht klein" onClick={neueVersion.spaeter}>
                Später
              </button>
            </span>
          </div>
        )}
        {liste.map((m) => (
          <div key={m.id} className="meldung-zeile">
            <Icon name="abzeichnen" />
            <span>{m.text}</span>
            <button type="button" aria-label="Meldung schließen" onClick={() => schliesseMeldung(m.id)}>
              <Icon name="zu" groesse={18} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

/** Seite konnte nicht geladen werden: Überschrift bleibt, der Fehler wird als solcher angesagt. */
export function Ladefehler({ titel, text }: { titel: string; text: string }) {
  return (
    <>
      <h1>{titel}</h1>
      <p className="hinweis fehler" role="alert">
        {text}
      </p>
      <p>
        <button type="button" className="knopf schlicht" onClick={() => window.location.reload()}>
          Erneut versuchen
        </button>
      </p>
    </>
  );
}
