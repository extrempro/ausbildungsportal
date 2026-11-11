import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import type { Rolle } from './api';
import { Icon } from './icons';
import { geheZu } from './router';

/**
 * Interaktive Führung: wenige Schritte je Rolle, jeder hebt ein echtes Element der Seite hervor.
 * Freiwillig, jederzeit abbrechbar (Escape) und beliebig oft neu startbar (Menü, Handbuch).
 */
interface Schritt {
  titel: string;
  text: string;
  /** Seite, auf der der Schritt spielt */
  pfad?: string;
  /** Kandidaten für das hervorgehobene Element – das erste sichtbare gewinnt (PC und Handy haben verschiedene Navigation) */
  ziel?: string[];
}

const MENUE = ['.menue.ich .menue-knopf', '.tabs button'];
const ENDE: Schritt = {
  titel: 'Das war es schon',
  text: 'Handbuch, Konto und diese Führung findest du jederzeit hier im Menü – am PC an deinem Namen, auf dem Handy unter „Mehr“. Dort steht auch „Fehler melden“, falls einmal etwas nicht funktioniert.',
  ziel: MENUE,
};

const GLOCKE = (text: string): Schritt => ({ titel: 'Was gibt es Neues?', text, pfad: '/', ziel: ['.glocke-knopf'] });

const AZUBI: Schritt[] = [
  { titel: 'Willkommen im Ausbildungsportal', text: 'Ich zeige dir in einer Minute das Wichtigste: deinen Ausbildungsplan und das Berichtsheft. Du kannst jederzeit abbrechen.', pfad: '/' },
  { titel: 'Dein Ausbildungsplan', text: 'Das ist deine Startseite. Hier steht, was diese Woche ansteht: Berufsschule, Abteilung, Aufgaben.', pfad: '/', ziel: ['.wochenkarte.hervor', 'main h1'] },
  { titel: 'Auf einen Blick', text: 'Wie lange noch bis zur Prüfung? Fehlen Berichte? Sind Aufgaben offen? Das steht hier.', pfad: '/', ziel: ['.kennzahlen'] },
  { titel: 'Alle Wochen', text: 'Darunter steht jede Woche deiner Ausbildung. Mit dem „+“ trägst du eigene Aufgaben und Notizen ein. Erledigte Aufgaben hakst du ab.', pfad: '/', ziel: ['li.kw.heute', '.plan-jahr'] },
  { titel: 'Das Berichtsheft', text: 'Für jede Woche schreibst du einen Bericht: Was hast du gemacht, und wie viele Stunden? Hier geht es dorthin.', pfad: '/', ziel: ['.haupt-nav a[href="/berichtsheft"]', '.tabs a[href="/berichtsheft"]'] },
  { titel: 'Einen Bericht schreiben', text: 'Bei jeder Woche steht ein Knopf. „Schreiben“ öffnet die Woche. Dort trägst du ein, speicherst als Entwurf oder reichst ein.', pfad: '/berichtsheft', ziel: ['table.stapel tbody tr td.aktion a', 'main h1'] },
  { titel: 'Deine Unterschrift', text: 'Unterschreibe hier einmal mit Finger, Stift oder Maus. Die Unterschrift kommt unter jeden Bericht, den du einreichst.', pfad: '/konto', ziel: ['.unterschrift-feld', '.signatur-feld.gross', 'main h1'] },
  GLOCKE('Die Glocke zeigt, wenn jemand etwas in deinen Plan eingetragen hat oder ein Bericht abgezeichnet oder zurückgegeben wurde. Die Zahl sagt, wie viel neu ist.'),
  ENDE,
];

const betreuung = (rolle: 'ausbilder' | 'beauftragter'): Schritt[] => [
  { titel: 'Willkommen im Ausbildungsportal', text: 'Eine kurze Führung durch deine Bereiche – etwa eine Minute. Du kannst jederzeit abbrechen.', pfad: '/' },
  { titel: 'Was ist zu tun?', text: 'Die Kacheln zeigen, wie viele Berichte auf deine Unterschrift warten, und führen direkt dorthin.', pfad: '/', ziel: ['.kacheln'] },
  {
    titel: rolle === 'ausbilder' ? 'Deine Azubis' : 'Die dir zugewiesenen Azubis',
    text: 'Jede Karte zeigt den Stand der Ausbildung und der Berichte. Darunter geht es zu Profil, Ausbildungsplan und Berichtsheft.',
    pfad: '/',
    ziel: ['.azubi-karte', 'main h1'],
  },
  { titel: 'Berichte abzeichnen', text: 'Hier stehen alle eingereichten Berichte, nach Azubi geordnet. „Lesen“ klappt einen Bericht auf; darunter zeichnest du ab oder gibst ihn mit einem Kommentar zurück.', pfad: '/abzeichnen', ziel: ['.abz-gruppe', 'main h1'] },
  { titel: 'Wer ist wann wo?', text: 'Die Übersicht zeigt diese und die nächste Woche und darunter den Zeitstrahl: Schule, Einsätze und Urlaub aller Azubis.', pfad: '/uebersicht', ziel: ['.ue-oben', 'main h1'] },
  { titel: 'Deine Unterschrift', text: 'Ohne hinterlegte Unterschrift lässt sich nichts abzeichnen. Unterschreibe hier einmal.', pfad: '/konto', ziel: ['.unterschrift-feld', '.signatur-feld.gross', 'main h1'] },
  GLOCKE('Die Glocke zeigt, wenn ein Bericht eingereicht wurde oder ein Azubi etwas in seinen Plan eingetragen hat. Ein Klick führt direkt dorthin.'),
  ...(rolle === 'ausbilder'
    ? [
        {
          titel: 'Planung',
          text: 'Was mehrere Azubis betrifft: In der Sammelplanung trägst du etwa einen Schulblock für alle auf einmal ein. Planbausteine sind Stationen, die du in jeden Plan ab der passenden Woche einfügst.',
          pfad: '/',
          ziel: ['button[aria-controls="menue-planung"]', '.tabs button'],
        },
        { titel: 'Verwaltung', text: 'Konten anlegen und Stammdaten pflegen (Betrieb, Berufe, Berufsschulen) – unter „Verwaltung“ bzw. „Mehr“.', pfad: '/', ziel: ['button[aria-controls="menue-verwaltung"]', '.tabs button'] },
      ]
    : []),
  ENDE,
];

const ADMIN: Schritt[] = [
  { titel: 'Willkommen', text: 'Als Super-Admin betreibst du das Portal: Konten, Protokoll, Fehlermeldungen und Logo. Eine kurze Führung.', pfad: '/verwaltung/konten' },
  { titel: 'Konten', text: 'Hier legst du Konten an, sperrst oder löschst sie. Die Anmeldung der anderen läuft über Microsoft.', pfad: '/verwaltung/konten', ziel: ['main form', 'main h1'] },
  { titel: 'Protokoll', text: 'Anmeldungen und Änderungen – ohne Inhalte von Berichten und Plänen. Nur du siehst es.', pfad: '/verwaltung/protokoll', ziel: ['main table', 'main h1'] },
  { titel: 'Fehlermeldungen', text: 'Was Nutzer über „Fehler melden“ schicken, landet hier. Die Zahl am Menüpunkt zeigt die offenen Meldungen.', pfad: '/verwaltung/meldungen', ziel: ['.meldung', '.meldung-teams', 'main h1'] },
  { titel: 'Erscheinungsbild', text: 'Das Logo des Betriebs, je eines für die helle und die dunkle Darstellung.', pfad: '/verwaltung/erscheinungsbild', ziel: ['.logo-vorschau', 'main h1'] },
  ENDE,
];

export function schritteFuer(rolle: Rolle): Schritt[] {
  return rolle === 'azubi' ? AZUBI : rolle === 'admin' ? ADMIN : betreuung(rolle);
}

function sichtbar(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
}

/** Platz, den die Karte am unteren Rand eines schmalen Bildschirms braucht */
const KARTE_PLATZ = 320;

interface Rahmen {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function Fuehrung({ rolle, onEnde }: { rolle: Rolle; onEnde: () => void }) {
  // einmal je Rolle – sonst entstünden bei jedem Rendern neue Schritte und der laufende Schritt begänne von vorn
  const schritte = useMemo(() => schritteFuer(rolle), [rolle]);
  const [nr, setNr] = useState(0);
  const [rahmen, setRahmen] = useState<Rahmen | null>(null);
  const [bereit, setBereit] = useState(false);
  const karte = useRef<HTMLDivElement>(null);
  const ziel = useRef<Element | null>(null);
  const vorher = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const s = schritte[nr];
  const letzter = nr === schritte.length - 1;

  const beende = useCallback(() => {
    onEnde();
    vorher.current?.focus();
  }, [onEnde]);

  const miss = useCallback(() => {
    const el = ziel.current;
    if (!el || !el.isConnected) return setRahmen(null);
    const r = el.getBoundingClientRect();
    // nie größer als das Fenster, mit etwas Luft um das Element
    const top = Math.max(4, r.top - 6);
    const left = Math.max(4, r.left - 6);
    let hoehe = Math.min(window.innerHeight - top - 4, r.height + 12);
    // schmale Bildschirme: Die Karte steht unten. Hohe Elemente werden nur so weit umrandet, dass die Karte sie nicht verdeckt.
    if (window.innerWidth < 700 && top < window.innerHeight / 2) hoehe = Math.max(64, Math.min(hoehe, window.innerHeight - top - KARTE_PLATZ));
    setRahmen({ top, left, width: Math.min(window.innerWidth - left - 4, r.width + 12), height: hoehe });
  }, []);

  // Schritt vorbereiten: zur Seite wechseln, auf das Element warten, es in den Blick holen
  useEffect(() => {
    let abgebrochen = false;
    let versuche = 0;
    setBereit(false);
    ziel.current = null;
    if (s.pfad && window.location.pathname !== s.pfad) geheZu(s.pfad);
    const suche = () => {
      if (abgebrochen) return;
      const el = (s.ziel ?? []).flatMap((sel) => [...document.querySelectorAll(sel)]).find(sichtbar) ?? null;
      // ohne Ziel (oder wenn es nach drei Sekunden nicht da ist) steht die Karte in der Mitte
      if (!el && s.ziel && versuche++ < 30) return void window.setTimeout(suche, 100);
      ziel.current = el;
      if (el) {
        const r = el.getBoundingClientRect();
        // hohe Elemente an den oberen Rand holen (unter die Kopfzeile), damit unten Platz für die Karte bleibt
        if (window.innerWidth < 700 && r.height > window.innerHeight * 0.4) {
          const kopf = document.querySelector('.leiste')?.getBoundingClientRect().height ?? 56;
          window.scrollTo(0, window.scrollY + r.top - kopf - 14);
        } else el.scrollIntoView({ block: 'center', behavior: 'auto' });
      } else window.scrollTo(0, 0);
      window.setTimeout(() => {
        if (abgebrochen) return;
        miss();
        setBereit(true);
      }, 60);
    };
    window.setTimeout(suche, 80);
    return () => {
      abgebrochen = true;
    };
  }, [nr, s, miss]);

  // beim Scrollen und bei Größenänderung nachführen
  useEffect(() => {
    let bild = 0;
    const neu = () => {
      if (!bild) {
        bild = requestAnimationFrame(() => {
          bild = 0;
          miss();
        });
      }
    };
    window.addEventListener('scroll', neu, { passive: true });
    window.addEventListener('resize', neu);
    return () => {
      cancelAnimationFrame(bild);
      window.removeEventListener('scroll', neu);
      window.removeEventListener('resize', neu);
    };
  }, [miss]);

  // Tastatur: Escape beendet, Pfeile blättern, Tab bleibt in der Karte
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') beende();
      else if (e.key === 'ArrowRight' && !letzter) setNr((n) => n + 1);
      else if (e.key === 'ArrowLeft' && nr > 0) setNr((n) => n - 1);
      else if (e.key === 'Tab' && karte.current) {
        const knoepfe = [...karte.current.querySelectorAll<HTMLElement>('button')];
        const erstes = knoepfe[0];
        const letztes = knoepfe[knoepfe.length - 1];
        if (!karte.current.contains(document.activeElement)) {
          e.preventDefault();
          erstes?.focus();
        } else if (e.shiftKey && document.activeElement === erstes) {
          e.preventDefault();
          letztes?.focus();
        } else if (!e.shiftKey && document.activeElement === letztes) {
          e.preventDefault();
          erstes?.focus();
        }
      }
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [beende, letzter, nr]);

  // der Fokus liegt auf der Karte, damit Bildschirmleser den Schritt vorlesen
  useLayoutEffect(() => {
    if (bereit) karte.current?.querySelector<HTMLElement>('.fuehrung-weiter')?.focus({ preventScroll: true });
  }, [bereit, nr]);

  // Lage der Karte: auf schmalen Bildschirmen oben oder unten am Rand, sonst unter oder über dem Element
  let lage: React.CSSProperties = {};
  const schmal = window.innerWidth < 700;
  if (!rahmen) {
    lage = schmal ? { left: 12, right: 12, bottom: 90 } : { top: '30%', left: '50%', transform: 'translateX(-50%)' };
  } else if (schmal) {
    lage = rahmen.top + rahmen.height / 2 > window.innerHeight / 2 ? { left: 12, right: 12, top: 12 } : { left: 12, right: 12, bottom: 12 };
  } else {
    const breite = 380;
    const links = Math.max(12, Math.min(window.innerWidth - breite - 12, rahmen.left));
    const platzUnten = window.innerHeight - (rahmen.top + rahmen.height);
    const platzRechts = window.innerWidth - (rahmen.left + rahmen.width);
    // passt die Karte weder unter noch über das Element, steht sie daneben
    if (platzUnten <= 230 && rahmen.top < 230 && platzRechts > breite + 24) lage = { left: rahmen.left + rahmen.width + 12, top: Math.max(12, rahmen.top), width: breite };
    else
      lage = platzUnten > 230 || rahmen.top < 230 ? { left: links, top: Math.min(window.innerHeight - 220, rahmen.top + rahmen.height + 12), width: breite } : { left: links, bottom: window.innerHeight - rahmen.top + 12, width: breite };
  }

  return (
    <div className="fuehrung">
      {/* fängt Klicks auf die Seite ab, solange die Führung läuft */}
      <div className="fuehrung-sperre" />
      {rahmen && bereit ? <div className="fuehrung-ring" style={rahmen} /> : <div className="fuehrung-dunkel" />}
      {bereit && (
        <div key={nr} ref={karte} className="fuehrung-karte" role="dialog" aria-modal="true" aria-labelledby="fuehrung-titel" aria-describedby="fuehrung-text" style={lage}>
          {/* farbiger Kopf: so ist die Karte auf jeder Seite sofort als „die Führung“ zu erkennen */}
          <div className="fuehrung-kopf">
            <Icon name="fuehrung" groesse={18} />
            <span>Führung</span>
            <span className="fuehrung-zaehler" aria-live="polite">
              Schritt {nr + 1} von {schritte.length}
            </span>
          </div>
          <div className="fuehrung-fortschritt" aria-hidden="true">
            <span style={{ width: `${((nr + 1) / schritte.length) * 100}%` }} />
          </div>
          <h2 id="fuehrung-titel">{s.titel}</h2>
          <p id="fuehrung-text">{s.text}</p>
          <div className="fuehrung-knoepfe">
            <button type="button" className="knopf schlicht klein" onClick={beende}>
              {letzter ? 'Schließen' : 'Führung beenden'}
            </button>
            <span className="fuehrung-rechts">
              {nr > 0 && (
                <button type="button" className="knopf schlicht klein" onClick={() => setNr(nr - 1)}>
                  Zurück
                </button>
              )}
              {letzter ? (
                <button type="button" className="knopf klein fuehrung-weiter" onClick={beende}>
                  Fertig
                </button>
              ) : (
                <button type="button" className="knopf klein fuehrung-weiter" onClick={() => setNr(nr + 1)}>
                  Weiter
                </button>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
