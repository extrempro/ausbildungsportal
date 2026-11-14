import { useEffect, useState, useSyncExternalStore } from 'react';
import { Icon } from './icons';

/**
 * Ansicht der Seite:
 * - „Volle Breite“: die Seite nutzt am großen Bildschirm die ganze Breite statt höchstens 1200 px. Für alle Seiten;
 *   merkt sich der Browser (hängt vom Bildschirm ab, nicht vom Konto).
 * - „Lesemodus“: Kopfzeile, Menüs und Seitenleisten treten zurück, der Text steht mittig und etwas größer.
 *   Nur auf Leseseiten (Lernen, Anleitungen, Lerninhalte, Handbuch); endet mit Escape, mit dem Knopf oder beim Verlassen.
 * - „Navigation einklappen“: Die Navigation links im Lernmodul und im Handbuch wird am PC zur schmalen Leiste.
 *   Merkt sich der Browser ebenfalls.
 * Breite und Lesemodus wirken über Attribute am <html>-Element – das Stylesheet macht den Rest.
 */
const SCHLUESSEL = 'ansicht-breit';
const SCHLUESSEL_NAVI = 'ansicht-navi-zu';
interface Zustand {
  breit: boolean;
  lesen: boolean;
  naviZu: boolean;
}
function gemerkt(schluessel: string): boolean {
  try {
    return localStorage.getItem(schluessel) === '1';
  } catch {
    return false;
  }
}
function merke(schluessel: string, ja: boolean): void {
  try {
    localStorage.setItem(schluessel, ja ? '1' : '0');
  } catch {
    // ohne Speicher gilt es nur bis zum Neuladen
  }
}
let zustand: Zustand = { breit: gemerkt(SCHLUESSEL), lesen: false, naviZu: gemerkt(SCHLUESSEL_NAVI) };
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
  merke(SCHLUESSEL, breit);
  setze({ breit });
}
export function setzeNaviZu(naviZu: boolean): void {
  merke(SCHLUESSEL_NAVI, naviZu);
  setze({ naviZu });
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
  const { lesen } = useAnsicht();
  if (lesen) return null;
  // „Volle Breite“ steht für alle Seiten in der Kopfzeile; hier nur, was die Leseseiten zusätzlich haben
  return (
    <div className="ansicht-knoepfe nicht-drucken" role="group" aria-label="Ansicht">
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

/** Knopf oben in der Navigation links (Lernmodul, Handbuch): einklappen zur schmalen Leiste bzw. wieder ausklappen */
export function NaviKnopf({ was }: { was: string }) {
  const { naviZu } = useAnsicht();
  const text = naviZu ? `${was} ausklappen` : `${was} einklappen`;
  return (
    <button type="button" className="navi-knopf" aria-expanded={!naviZu} aria-label={text} title={text} onClick={() => setzeNaviZu(!naviZu)}>
      <Icon name={naviZu ? 'navi-auf' : 'navi-zu'} groesse={20} />
    </button>
  );
}
