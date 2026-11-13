import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { rueckfrage } from './dialoge';
import type { ReactNode } from 'react';

/**
 * Kleine Seitensteuerung über die History-API.
 * Die Seite richtet sich nach `pfad`, nicht direkt nach der Adresszeile: So kann der Router einen Schritt
 * über die Zurück-Taste des Browsers erst anhalten und nachfragen, bevor die Seite wechselt.
 * Jeder Eintrag im Verlauf trägt eine laufende Nummer – daran ist zu erkennen, wie weit zurück oder vor es ging.
 */
let pfad = window.location.pathname;
let nummer: number = typeof window.history.state?.i === 'number' ? window.history.state.i : 0;
window.history.replaceState({ i: nummer }, '');
const hoerer = new Set<() => void>();
const sage = () => hoerer.forEach((h) => h());

function abonniere(fn: () => void): () => void {
  hoerer.add(fn);
  return () => hoerer.delete(fn);
}

export function usePfad(): string {
  return useSyncExternalStore(abonniere, () => pfad);
}

/**
 * Ungespeicherte Eingaben: Solange irgendein Formular welche meldet, fragt jeder Seitenwechsel nach –
 * im Portal mit dem eigenen Fenster, beim Schließen des Tabs oder Neuladen mit dem des Browsers.
 */
const offen = new Set<symbol>();
const ALT = Symbol('alt');
/** für Stellen, die den Zustand selbst führen (Bericht) */
export function setzeUngespeichert(aktiv: boolean): void {
  if (aktiv) offen.add(ALT);
  else offen.delete(ALT);
}
/** Meldet ungespeicherte Eingaben, solange „aktiv“ wahr ist und das Formular angezeigt wird. */
export function useUngespeichert(aktiv: boolean): void {
  useEffect(() => {
    if (!aktiv) return;
    const marke = Symbol('formular');
    offen.add(marke);
    return () => void offen.delete(marke);
  }, [aktiv]);
}
/**
 * Für Formulare, deren Felder der Browser hält: `merke` an onInput des Formulars hängen, `gespeichert` nach dem Speichern rufen.
 */
export function useEingaben(): { merke: () => void; gespeichert: () => void } {
  const [geaendert, setGeaendert] = useState(false);
  useUngespeichert(geaendert);
  return useMemo(() => ({ merke: () => setGeaendert(true), gespeichert: () => setGeaendert(false) }), []);
}
window.addEventListener('beforeunload', (e) => {
  if (offen.size > 0) e.preventDefault();
});

const VERLASSEN = 'Seite verlassen?\n\nDeine Eingaben auf dieser Seite sind noch nicht gespeichert und gehen dabei verloren.';
const fragVerlassen = () => rueckfrage(VERLASSEN, { ja: 'Verlassen, ohne zu speichern', gefahr: true });

function wechsle(ziel: string): void {
  offen.clear();
  if (ziel !== window.location.pathname + window.location.search) window.history.pushState({ i: ++nummer }, '', ziel);
  pfad = window.location.pathname;
  sage();
  window.scrollTo(0, 0);
}

/** `gespeichert`: Die Eingaben der Seite sind gerade gespeichert worden – nicht nach ungespeicherten fragen. */
export function geheZu(ziel: string, gespeichert = false): void {
  if (!gespeichert && offen.size > 0 && ziel !== window.location.pathname) {
    void fragVerlassen().then((ja) => ja && wechsle(ziel));
    return;
  }
  wechsle(ziel);
}

// Sprungmarken (#…) legen eigene Einträge ohne Nummer an – sie bekommen die der Seite, auf der sie liegen
window.addEventListener('hashchange', () => {
  if (typeof window.history.state?.i !== 'number') window.history.replaceState({ i: nummer }, '');
});

/**
 * Zurück- und Vor-Taste des Browsers. Gibt es ungespeicherte Eingaben, geht der Verlauf erst wieder dorthin zurück,
 * wo das Formular steht (die Seite hat davon nichts gemerkt), dann wird gefragt. Erst nach „Verlassen“ folgt der Schritt wirklich.
 */
let ruecksprung = false;
window.addEventListener('popstate', (e: PopStateEvent) => {
  if (ruecksprung) {
    ruecksprung = false;
    return;
  }
  const neu: unknown = (e.state as { i?: unknown } | null)?.i;
  const ziel = window.location.pathname;
  if (offen.size > 0 && ziel !== pfad && typeof neu === 'number' && neu !== nummer) {
    const schritte = neu - nummer;
    ruecksprung = true;
    window.history.go(-schritte);
    void fragVerlassen().then((ja) => {
      if (!ja) return;
      offen.clear();
      window.history.go(schritte);
    });
    return;
  }
  if (typeof neu === 'number') nummer = neu;
  pfad = ziel;
  sage();
});

/** aktivAb: der Link gilt auch auf Unterseiten als aktiv (z. B. /azubis/12 für „Azubis“). titel/vorlesen: für Links ohne lesbaren Text (Tooltip, Name für den Vorleser). */
export function Link({ zu, children, className, aktivAb, auch, titel, vorlesen }: { zu: string; children: ReactNode; className?: string; aktivAb?: string; /** zweiter Bereich, in dem der Link ebenfalls als aktiv gilt */ auch?: string; titel?: string; vorlesen?: string }) {
  const pfad = usePfad();
  const aktiv = pfad === zu || (!!aktivAb && pfad.startsWith(`${aktivAb}/`)) || (!!auch && (pfad === auch || pfad.startsWith(`${auch}/`)));
  return (
    <a
      href={zu}
      className={className}
      title={titel}
      aria-label={vorlesen}
      aria-current={aktiv ? 'page' : undefined}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        geheZu(zu);
      }}
    >
      {children}
    </a>
  );
}
