import { useEffect, useState, useSyncExternalStore } from 'react';
import { Icon } from './icons';

/**
 * Ansicht der Seite:
 * - „Volle Breite“: die Seite nutzt am großen Bildschirm die ganze Breite statt höchstens 1200 px. Für alle Seiten;
 *   merkt sich der Browser (hängt vom Bildschirm ab, nicht vom Konto).
 * - „Lesemodus“: Kopfzeile, Menüs und Seitenleisten treten zurück, der Text steht mittig und etwas größer.
 *   Nur auf Leseseiten (Lernen, Anleitungen, Lerninhalte, Handbuch); endet mit Escape, mit dem Knopf oder beim Verlassen.
 * Beides wirkt über Attribute am <html>-Element – das Stylesheet macht den Rest.
 */
const SCHLUESSEL = 'ansicht-breit';
interface Zustand {
  breit: boolean;
  lesen: boolean;
}
function gemerkt(): boolean {
  try {
    return localStorage.getItem(SCHLUESSEL) === '1';
  } catch {
    return false;
  }
}
let zustand: Zustand = { breit: gemerkt(), lesen: false };
const hoerer = new Set<() => void>();
function wende(): void {
  const wurzel = document.documentElement;
  if (zustand.breit) wurzel.dataset.breite = 'voll';
  else delete wurzel.dataset.breite;
  if (zustand.lesen) wurzel.dataset.lesemodus = 'an';
  else delete wurzel.dataset.lesemodus;
}
wende();
function setze(neu: Partial<Zustand>): void {
  zustand = { ...zustand, ...neu };
  wende();
  for (const h of hoerer) h();
}
export function setzeBreit(breit: boolean): void {
  try {
    localStorage.setItem(SCHLUESSEL, breit ? '1' : '0');
  } catch {
    // ohne Speicher gilt es nur bis zum Neuladen
  }
  setze({ breit });
}
export function setzeLesemodus(lesen: boolean): void {
  setze({ lesen });
  // der Text bleibt, wo er war – nur oben neu ansetzen, wenn die Kopfzeile verschwindet, ist nicht nötig
}
export function useAnsicht(): Zustand {
  return useSyncExternalStore(
    (f) => {
      hoerer.add(f);
      return () => hoerer.delete(f);
    },
    () => zustand,
  );
}

/** Seiten, auf denen es den Lesemodus gibt */
export const LESESEITE = /^\/(lernen\/(?!ueben)[a-z0-9-]+|anleitungen\/[a-z0-9-]+|lerninhalte\/[a-z0-9-]+\/[a-z0-9-]+|handbuch)$/;

/** Ab dieser Fensterbreite macht „Volle Breite“ einen Unterschied (Seite 1200 px + Rand) */
const AB = '(min-width: 1300px)';
export function useBreitesFenster(): boolean {
  const [ja, setJa] = useState(() => window.matchMedia(AB).matches);
  useEffect(() => {
    const m = window.matchMedia(AB);
    const neu = () => setJa(m.matches);
    m.addEventListener('change', neu);
    return () => m.removeEventListener('change', neu);
  }, []);
  return ja;
}

/** Knöpfe über Leseseiten: Volle Breite (nur am großen Bildschirm) und Lesemodus */
export function AnsichtKnoepfe() {
  const { breit, lesen } = useAnsicht();
  const gross = useBreitesFenster();
  if (lesen) return null;
  return (
    <div className="ansicht-knoepfe nicht-drucken" role="group" aria-label="Ansicht">
      {gross && (
        <button type="button" className="knopf schlicht klein" aria-pressed={breit} onClick={() => setzeBreit(!breit)}>
          <Icon name="breit" groesse={18} />
          {breit ? 'Normale Breite' : 'Volle Breite'}
        </button>
      )}
      <button type="button" className="knopf schlicht klein" onClick={() => setzeLesemodus(true)}>
        <Icon name="lesen" groesse={18} />
        Lesemodus
      </button>
    </div>
  );
}

/** Im Lesemodus: der Weg zurück – oben rechts, immer sichtbar */
export function LesemodusEnde() {
  const { lesen } = useAnsicht();
  useEffect(() => {
    if (!lesen) return;
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role=dialog], [role=alertdialog]')) setzeLesemodus(false);
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [lesen]);
  if (!lesen) return null;
  return (
    <button type="button" className="knopf schlicht klein lesemodus-ende nicht-drucken" onClick={() => setzeLesemodus(false)}>
      <Icon name="zu" groesse={18} />
      Lesemodus beenden
    </button>
  );
}
