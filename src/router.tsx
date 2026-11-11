import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { rueckfrage } from './dialoge';
import type { ReactNode } from 'react';

/** Kleine Seitensteuerung über die History-API. */
function abonniere(fn: () => void): () => void {
  window.addEventListener('popstate', fn);
  return () => window.removeEventListener('popstate', fn);
}

export function usePfad(): string {
  return useSyncExternalStore(abonniere, () => window.location.pathname);
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

function wechsle(pfad: string): void {
  offen.clear();
  if (pfad !== window.location.pathname + window.location.search) window.history.pushState(null, '', pfad);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}

export function geheZu(pfad: string): void {
  if (offen.size > 0 && pfad !== window.location.pathname) {
    void rueckfrage('Seite verlassen?\n\nDeine Eingaben auf dieser Seite sind noch nicht gespeichert und gehen dabei verloren.', { ja: 'Verlassen, ohne zu speichern', gefahr: true }).then((ja) => ja && wechsle(pfad));
    return;
  }
  wechsle(pfad);
}

/** aktivAb: der Link gilt auch auf Unterseiten als aktiv (z. B. /azubis/12 für „Azubis“). */
export function Link({ zu, children, className, aktivAb }: { zu: string; children: ReactNode; className?: string; aktivAb?: string }) {
  const pfad = usePfad();
  const aktiv = pfad === zu || (!!aktivAb && pfad.startsWith(`${aktivAb}/`));
  return (
    <a
      href={zu}
      className={className}
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
