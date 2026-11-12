import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import type { Rolle } from './api';
import { Icon } from './icons';
import { geheZu } from './router';

/**
 * Interaktive Führung: wenige Schritte je Rolle, jeder hebt ein echtes Element der Seite hervor.
 * Freiwillig, jederzeit abbrechbar (Escape) und beliebig oft neu startbar (Menü, Handbuch).
 */
/** Bereiche, die nicht jedes Konto hat */
export type Bereich = 'lernen' | 'planer';

interface Schritt {
  titel: string;
  text: string;
  /** Seite, auf der der Schritt spielt */
  pfad?: string;
  /** Kandidaten für das hervorgehobene Element – das erste sichtbare gewinnt (PC und Handy haben verschiedene Navigation) */
  ziel?: string[];
  /** Der Schritt gehört zu einem Bereich, den nicht jeder hat. Er kommt nur vor, wenn das Konto den Bereich hat – sonst zeigte die Führung etwas, das es nicht gibt. */
  braucht?: Bereich;
}

const MENUE = ['.menue.ich .menue-knopf', '.tabs button'];
const ENDE: Schritt = {
  titel: 'Das war es schon',
  text: 'Handbuch, Konto und diese Führung findest du jederzeit hier im Menü – am PC an deinem Namen, auf dem Handy unter „Mehr“. Dort steht auch „Fehler melden“, falls einmal etwas nicht funktioniert.',
  ziel: MENUE,
};

const GLOCKE = (text: string): Schritt => ({ titel: 'Was gibt es Neues?', text, pfad: '/', ziel: ['.glocke-knopf'] });

const AZUBI: Schritt[] = [
  { titel: 'Willkommen im Ausbildungsportal', text: 'Ich zeige dir kurz das Wichtigste: deinen Ausbildungsplan, das Berichtsheft und was es sonst noch gibt. Du kannst jederzeit abbrechen.', pfad: '/' },
  { titel: 'Dein Ausbildungsplan', text: 'Das ist deine Startseite. Hier steht, was diese Woche ansteht: Berufsschule, Abteilung, Aufgaben.', pfad: '/', ziel: ['.wochenkarte.hervor', 'main h1'] },
  { titel: 'Auf einen Blick', text: 'Wie lange noch bis zur Prüfung? Fehlen Berichte? Sind Aufgaben offen? Das steht hier.', pfad: '/', ziel: ['.kennzahlen'] },
  { titel: 'Alle Wochen', text: 'Darunter steht jede Woche deiner Ausbildung. Mit dem „+“ trägst du eigene Aufgaben, Notizen und Termine ein – zum Beispiel eine JAV-Sitzung. Erledigte Aufgaben hakst du ab.', pfad: '/', ziel: ['li.kw.heute', '.plan-jahr'] },
  { titel: 'Das Berichtsheft', text: 'Für jede Woche schreibst du einen Bericht: Was hast du gemacht, und wie viele Stunden? Hier geht es dorthin.', pfad: '/', ziel: ['.haupt-nav a[href="/berichtsheft"]', '.tabs a[href="/berichtsheft"]'] },
  { titel: 'Einen Bericht schreiben', text: 'Bei jeder Woche steht ein Knopf. „Schreiben“ öffnet die Woche. Dort trägst du ein, speicherst als Entwurf oder reichst ein.', pfad: '/berichtsheft', ziel: ['table.stapel tbody tr td.aktion a', 'main h1'] },
  { titel: 'Deine Unterschrift', text: 'Unterschreibe hier einmal mit Finger, Stift oder Maus. Die Unterschrift kommt unter jeden Bericht, den du einreichst.', pfad: '/konto', ziel: ['.unterschrift-feld', '.signatur-feld.gross', 'main h1'] },
  { titel: 'Urlaub beantragen', text: 'Hier beantragst du deinen Urlaub und siehst, wie viele Tage noch frei sind. Erst bestätigen deine Ausbildungsbeauftragten, dann genehmigt dein Ausbilder.', pfad: '/urlaub', ziel: ['.urlaub-neu', 'main h1'] },
  {
    titel: 'Lernen',
    text: 'Zu deinem Beruf gibt es Spickzettel, Karteikarten und Quiz. Du markierst selbst, was du schon sicher kannst. Dein Lernstand ist privat – nur du siehst ihn.',
    pfad: '/',
    ziel: ['.haupt-nav a[href="/lernen"]', '.tabs a[href="/lernen"]'],
    braucht: 'lernen',
  },
  {
    titel: 'Planer für deine Prüfung',
    text: 'Hier planst du dein Prüfungsvorhaben: Termine, Checklisten, Zeitplanung. Was du einträgst, siehst nur du – nur die Termine stehen auch im Ausbildungsplan. Am Handy findest du ihn unter „Mehr“.',
    pfad: '/',
    ziel: ['.haupt-nav a[href="/planer"]', '.tabs button'],
    braucht: 'planer',
  },
  GLOCKE('Die Glocke zeigt, wenn jemand etwas in deinen Plan eingetragen hat oder ein Bericht abgezeichnet oder zurückgegeben wurde. Die Zahl sagt, wie viel neu ist.'),
  {
    titel: 'Nachrichten per Teams oder E-Mail',
    text: 'Willst du Neuigkeiten nicht nur an der Glocke sehen? Hier stellst du ein, ob du zusätzlich eine Nachricht per Teams oder E-Mail bekommst – getrennt für Plan, Berichtsheft und Urlaub.',
    pfad: '/konto',
    ziel: ['#benachrichtigungen', 'main h1'],
  },
  ENDE,
];

const betreuung = (rolle: 'ausbilder' | 'beauftragter'): Schritt[] => [
  { titel: 'Willkommen im Ausbildungsportal', text: 'Eine kurze Führung durch deine Bereiche. Du kannst jederzeit abbrechen.', pfad: '/' },
  { titel: 'Was ist zu tun?', text: 'Die Kacheln zeigen, wie viele Berichte auf deine Unterschrift und wie viele Urlaubsanträge auf dich warten, und führen direkt dorthin.', pfad: '/', ziel: ['.kacheln'] },
  {
    titel: rolle === 'ausbilder' ? 'Deine Azubis' : 'Die dir zugewiesenen Azubis',
    text: 'Jede Karte zeigt den Stand der Ausbildung und der Berichte. Darunter geht es zu Profil, Ausbildungsplan und Berichtsheft.',
    pfad: '/',
    // gibt es (noch) keine Karte, wird der ganze Bereich „Azubis“ gezeigt – nicht die Begrüßung
    ziel: ['.start-azubis .azubi-karte', '.start-azubis'],
  },
  { titel: 'Berichte abzeichnen', text: 'Hier stehen alle eingereichten Berichte, nach Azubi geordnet. „Lesen“ klappt einen Bericht auf; darunter zeichnest du ab oder gibst ihn mit einem Kommentar zurück.', pfad: '/abzeichnen', ziel: ['.abz-gruppe', 'main h1'] },
  {
    titel: 'Urlaubsanträge',
    text: rolle === 'ausbilder' ? 'Hier genehmigst du Urlaub oder lehnst ihn ab. Vorher bestätigen die Ausbildungsbeauftragten, dass der Urlaub in ihre Abteilung passt.' : 'Hier bestätigst du Urlaubsanträge für die Zeit, in der ein Azubi bei dir ist. Genehmigen kann danach der Ausbilder.',
    pfad: '/urlaub',
    ziel: ['main h1'],
  },
  { titel: 'Wer ist wann wo?', text: 'Der Jahreskalender zeigt das ganze Jahr: je Azubi eine Zeile mit Schule, Einsätzen und Urlaub. Ein Klick auf den Namen zeigt das Jahr dieses Azubis Tag für Tag.', pfad: '/jahreskalender', ziel: ['.jk-rahmen', 'main h1'] },
  { titel: 'Deine Unterschrift', text: 'Ohne hinterlegte Unterschrift lässt sich nichts abzeichnen. Unterschreibe hier einmal.', pfad: '/konto', ziel: ['.unterschrift-feld', '.signatur-feld.gross', 'main h1'] },
  GLOCKE('Die Glocke zeigt, wenn ein Bericht eingereicht wurde, ein Urlaubsantrag wartet oder ein Azubi etwas in seinen Plan eingetragen hat. Ein Klick führt direkt dorthin.'),
  {
    titel: 'Nachrichten per Teams oder E-Mail',
    text: 'Hier stellst du ein, ob du Neuigkeiten zusätzlich per Teams oder E-Mail bekommst – getrennt für Plan, Berichtsheft und Urlaub. Die Nachrichten nennen keine Namen und keine Inhalte.',
    pfad: '/konto',
    ziel: ['#benachrichtigungen', 'main h1'],
  },
  {
    titel: 'Lerninhalte',
    text: rolle === 'ausbilder' ? 'Hier siehst du die Lernmodule der Berufe so, wie die Azubis sie sehen, und reichst eigene Lerninhalte ein. Den Lernstand der Azubis siehst du nicht.' : 'Hier siehst du die Lernmodule der Berufe so, wie die Azubis sie sehen. Den Lernstand der Azubis siehst du nicht.',
    pfad: '/lerninhalte',
    ziel: ['main h1'],
  },
  ...(rolle === 'ausbilder'
    ? [
        {
          titel: 'Planung',
          text: 'Was mehrere Azubis betrifft: In der Sammelplanung trägst du etwa einen Schulblock für alle auf einmal ein. Planbausteine sind Stationen, die du in jeden Plan ab der passenden Woche einfügst.',
          pfad: '/',
          ziel: ['button[aria-controls="menue-planung"]', '.tabs button'],
        },
        { titel: 'Verwaltung', text: 'Konten anlegen und Stammdaten pflegen (Betrieb, Berufe, Berufsschulen, Abteilungen, Firmentermine) – unter „Verwaltung“ bzw. „Mehr“.', pfad: '/', ziel: ['button[aria-controls="menue-verwaltung"]', '.tabs button'] },
      ]
    : []),
  ENDE,
];

const ADMIN: Schritt[] = [
  { titel: 'Willkommen', text: 'Als Super-Admin betreibst du das Portal: Konten, Protokoll, Fehlermeldungen, Lerninhalte und Erscheinungsbild. Eine kurze Führung.', pfad: '/verwaltung/konten' },
  { titel: 'Konten', text: 'Hier legst du Konten an, sperrst oder löschst sie. Die Anmeldung der anderen läuft über Microsoft.', pfad: '/verwaltung/konten', ziel: ['main form', 'main h1'] },
  { titel: 'Protokoll', text: 'Anmeldungen und Änderungen – ohne Inhalte von Berichten und Plänen. Nur du siehst es.', pfad: '/verwaltung/protokoll', ziel: ['main table', 'main h1'] },
  { titel: 'Fehlermeldungen', text: 'Was Nutzer über „Fehler melden“ schicken, landet hier. Die Zahl am Menüpunkt zeigt die offenen Meldungen.', pfad: '/verwaltung/meldungen', ziel: ['.meldung', '.meldung-teams', 'main h1'] },
  { titel: 'Lerninhalte', text: 'Ausbilder reichen Lerninhalte für einen Beruf ein. Du prüfst sie hier und lädst sie hoch oder gibst sie mit einer Rückmeldung zurück.', pfad: '/verwaltung/lerninhalte', ziel: ['main h1'] },
  { titel: 'Erscheinungsbild', text: 'Das Logo des Betriebs, je eines für die helle und die dunkle Darstellung. Darunter schaltest du den Begleiter der Azubis für das ganze Portal ein oder aus.', pfad: '/verwaltung/erscheinungsbild', ziel: ['.logo-vorschau', 'main h1'] },
  ENDE,
];

/** Wie die Seite im Menü heißt – die Karte nennt sie, damit ein Wechsel der Seite auffällt. */
function seitenName(pfad: string | undefined, rolle: Rolle): string {
  switch (pfad) {
    case '/':
      return rolle === 'azubi' ? 'Ausbildungsplan' : 'Start';
    case '/berichtsheft':
      return 'Berichtsheft';
    case '/konto':
      return 'Mein Konto';
    case '/abzeichnen':
      return 'Abzeichnen';
    case '/jahreskalender':
      return 'Jahreskalender';
    case '/verwaltung/konten':
      return 'Konten';
    case '/verwaltung/protokoll':
      return 'Protokoll';
    case '/verwaltung/meldungen':
      return 'Fehlermeldungen';
    case '/verwaltung/erscheinungsbild':
      return 'Erscheinungsbild';
    case '/urlaub':
      return 'Urlaub';
    case '/lerninhalte':
    case '/verwaltung/lerninhalte':
      return 'Lerninhalte';
    default:
      return '';
  }
}

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

export function Fuehrung({ rolle, bereiche, onEnde }: { rolle: Rolle; bereiche: Bereich[]; onEnde: () => void }) {
  // einmal je Rolle – sonst entstünden bei jedem Rendern neue Schritte und der laufende Schritt begänne von vorn
  // Schritte zu Bereichen, die es für dieses Konto nicht gibt, fallen weg (die App sagt, welche es gibt)
  const hat = bereiche.join(',');
  const schritte = useMemo(() => schritteFuer(rolle).filter((x) => !x.braucht || hat.split(',').includes(x.braucht)), [rolle, hat]);
  const [nr, setNr] = useState(0);
  const [rahmen, setRahmen] = useState<Rahmen | null>(null);
  const [bereit, setBereit] = useState(false);
  // nach einem Wechsel der Seite: der Menüpunkt der neuen Seite, zusätzlich umrandet
  const [menue, setMenue] = useState<Rahmen | null>(null);
  const menuePfad = useRef<string | null>(null);
  const karte = useRef<HTMLDivElement>(null);
  const ziel = useRef<Element | null>(null);
  const vorher = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const s = schritte[nr];
  const letzter = nr === schritte.length - 1;
  const seite = seitenName(s.pfad, rolle);
  // Der Schritt spielt auf einer anderen Seite als der vorige: Das sagt die Karte deutlich.
  const gewechselt = nr > 0 && !!s.pfad && schritte[nr - 1].pfad !== s.pfad;
  menuePfad.current = gewechselt ? (s.pfad ?? null) : null;

  const beende = useCallback(() => {
    onEnde();
    vorher.current?.focus();
  }, [onEnde]);

  const miss = useCallback(() => {
    const punkt = menuePfad.current ? ([...document.querySelectorAll(`.haupt-nav a[href="${menuePfad.current}"], .tabs a[href="${menuePfad.current}"]`)].find(sichtbar) ?? null) : null;
    const pr = punkt?.getBoundingClientRect();
    setMenue(pr ? { top: pr.top - 3, left: pr.left - 3, width: pr.width + 6, height: pr.height + 6 } : null);
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
        // (am PC ebenso, wenn mittig weder darüber noch darunter Platz für die Karte bliebe)
        if (window.innerWidth < 700 ? r.height > window.innerHeight * 0.4 : (window.innerHeight - r.height) / 2 < 340) {
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

  // Höhe der Karte messen, damit sie nie über den Bildschirmrand hinausragt
  const [hoehe, setHoehe] = useState(300);
  useLayoutEffect(() => {
    const gemessen = karte.current?.offsetHeight;
    if (bereit && gemessen && Math.abs(gemessen - hoehe) > 2) setHoehe(gemessen);
  }, [bereit, nr, hoehe]);

  // Lage der Karte: auf schmalen Bildschirmen oben oder unten am Rand, sonst unter oder über dem Element
  let lage: React.CSSProperties = {};
  const schmal = window.innerWidth < 700;
  if (!rahmen) {
    lage = schmal ? { left: 12, right: 12, bottom: 90 } : { top: '30%', left: '50%', transform: 'translateX(-50%)' };
  } else if (schmal) {
    lage = rahmen.top + rahmen.height / 2 > window.innerHeight / 2 ? { left: 12, right: 12, top: 12 } : { left: 12, right: 12, bottom: 12 };
  } else {
    const breite = 380;
    // die Karte ist je nach Text verschieden hoch – gemessen wird nach dem ersten Zeichnen (siehe unten)
    const h = hoehe + 12;
    const links = Math.max(12, Math.min(window.innerWidth - breite - 12, rahmen.left));
    const oben = Math.max(12, Math.min(window.innerHeight - h, rahmen.top));
    const platzUnten = window.innerHeight - (rahmen.top + rahmen.height);
    const platzRechts = window.innerWidth - (rahmen.left + rahmen.width);
    if (platzUnten >= h + 12) lage = { left: links, top: rahmen.top + rahmen.height + 12, width: breite };
    else if (rahmen.top >= h + 12) lage = { left: links, bottom: window.innerHeight - rahmen.top + 12, width: breite };
    else if (platzRechts >= breite + 24) lage = { left: rahmen.left + rahmen.width + 12, top: oben, width: breite };
    else if (rahmen.left >= breite + 24) lage = { left: rahmen.left - breite - 12, top: oben, width: breite };
    // das Gezeigte füllt fast den ganzen Bildschirm: die Karte liegt unten rechts darüber, aber vollständig im Bild
    else lage = { right: 24, bottom: 24, width: breite };
  }

  return (
    <div className="fuehrung">
      {/* fängt Klicks auf die Seite ab, solange die Führung läuft */}
      <div className="fuehrung-sperre" />
      {rahmen && bereit ? <div className="fuehrung-ring" style={rahmen} /> : <div className="fuehrung-dunkel" />}
      {menue && bereit && <div className="fuehrung-menuepunkt" style={menue} />}
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
          {seite && (
            <p className={`fuehrung-seite${gewechselt ? ' neu' : ''}`}>
              {gewechselt ? (
                <>
                  <span aria-hidden="true">→</span> Neue Seite: <strong>{seite}</strong>
                </>
              ) : (
                <>
                  Seite: <strong>{seite}</strong>
                </>
              )}
            </p>
          )}
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
