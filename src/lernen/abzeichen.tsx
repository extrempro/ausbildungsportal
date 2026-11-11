import { useEffect, useId, useRef } from 'react';
import { HandbuchLink } from '../handbuchLink';

/**
 * Abzeichen im Lernmodul: ein Schild mit aufgeschlagenem Buch in sechs Stufen – eigene Zeichnung, reines SVG.
 * Mit jeder Stufe wechselt das Material und es kommt ein Zeichen dazu (Winkel, Lorbeer, Krone, Strahlen),
 * damit sich die Stufen nicht nur durch die Farbe unterscheiden. Die Regeln stehen in server/lernen/abzeichen.ts.
 */
export interface FeldAbzeichen {
  stufe: number;
  name: string | null;
  erreicht: string | null;
  fehlt: string;
  fortschritt: number;
  /** höchste Stufe, die in diesem Themenfeld erreichbar ist (ohne Quiz: Bronze) */
  hoechste: number;
}
export interface Rang {
  stufe: number;
  name: string | null;
  noetig: number;
  felder: number;
  /** höchster Rang, der mit diesem Lernmodul erreichbar ist */
  hoechste: number;
  naechste: { stufe: number; name: string; haben: number } | null;
}
/** Antwort nach dem Speichern: ein neu erreichtes Abzeichen und, falls gestiegen, der neue Rang */
export interface Erfolg {
  abzeichen: { feld: string; feldTitel: string; stufe: number; name: string } | null;
  rang: { stufe: number; name: string | null } | null;
}

interface Stufe {
  name: string;
  a: string;
  b: string;
  rand: string;
  zeichen: string;
  wofuer: string;
}
export const STUFEN: Stufe[] = [
  { name: 'Holz', a: '#c58a4f', b: '#8f5a2b', rand: '#5c3818', zeichen: '#fff4e2', wofuer: 'Bei einem Unterthema steht die Ampel auf Gelb oder Grün.' },
  { name: 'Stein', a: '#aab2bc', b: '#6f7884', rand: '#434b55', zeichen: '#f5f7f9', wofuer: 'Bei der Hälfte der Unterthemen steht die Ampel auf Gelb oder Grün.' },
  { name: 'Bronze', a: '#e0a066', b: '#a35f28', rand: '#6c3c16', zeichen: '#fff3e6', wofuer: 'Bei allen Unterthemen steht die Ampel auf Gelb oder Grün und das Zusatzwissen ist gelesen.' },
  { name: 'Silber', a: '#eef2f6', b: '#a3aebb', rand: '#586371', zeichen: '#27303b', wofuer: 'Wie Bronze, dazu das Quiz zur Hälfte der Unterthemen bestanden.' },
  { name: 'Gold', a: '#fbd960', b: '#d99c12', rand: '#855e05', zeichen: '#4b3400', wofuer: 'Wie Bronze, dazu das Quiz zu allen Unterthemen bestanden.' },
  { name: 'Meister', a: '#22b8cf', b: '#7c3aed', rand: '#35267f', zeichen: '#ffffff', wofuer: 'Alle Quiz noch einmal fehlerfrei – frühestens eine Woche nach dem Bestehen.' },
];

const FORM = 'M60 8 L104 22 V68 C104 98 84 120 60 132 C36 120 16 98 16 68 V22 Z';

/**
 * Das Schild einer Stufe (1–6). Stufe 0 zeigt das Holz-Schild grau: noch kein Abzeichen.
 * `text` ist die Beschreibung für Vorleseprogramme; ohne sie ist das Bild Schmuck neben einem Text, der dasselbe sagt.
 */
export function Schild({ stufe, groesse = 56, gesperrt = false, text }: { stufe: number; groesse?: number; gesperrt?: boolean; text?: string }) {
  const id = useId();
  const t = Math.max(1, Math.min(6, stufe)) - 1;
  const s = STUFEN[t];
  const grau = gesperrt || stufe < 1;
  const strahlen = t === 5 ? Array.from({ length: 16 }, (_, i) => (i / 16) * Math.PI * 2) : [];
  const blaetter = t >= 3 ? [-1, 1].flatMap((seite) => Array.from({ length: 6 }, (_, i) => ({ seite, i }))) : [];
  return (
    <svg className={`schild${grau ? ' gesperrt' : ''}`} viewBox="-12 -16 144 162" width={groesse} height={(groesse * 162) / 144} role={text ? 'img' : undefined} aria-label={text} aria-hidden={text ? undefined : true} focusable="false">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={s.a} />
          {t === 5 && <stop offset=".5" stopColor="#4f6ef7" />}
          <stop offset="1" stopColor={s.b} />
        </linearGradient>
        <clipPath id={`${id}c`}>
          <path d={FORM} />
        </clipPath>
      </defs>
      {strahlen.map((w, i) => (
        <line key={i} x1={60 + Math.cos(w) * 60} y1={68 + Math.sin(w) * 66} x2={60 + Math.cos(w) * 70} y2={68 + Math.sin(w) * 78} stroke={i % 2 ? s.a : s.b} strokeWidth="3" strokeLinecap="round" />
      ))}
      {blaetter.map(({ seite, i }) => {
        const w = ((205 - i * 17) * Math.PI) / 180;
        const x = 60 + seite * -Math.cos(w) * 54;
        const y = 74 - Math.sin(w) * 60;
        return <ellipse key={`${seite}${i}`} cx={x} cy={y} rx="8" ry="3.6" transform={`rotate(${seite * (i * 17 - 60)} ${x} ${y})`} fill={t === 5 ? s.a : s.b} stroke={s.rand} strokeWidth="1.2" />;
      })}
      {t >= 4 && <path d="M42 9 L45 -9 L54 0 L60 -12 L66 0 L75 -9 L78 9 Z" fill={s.a} stroke={s.rand} strokeWidth="2.5" strokeLinejoin="round" />}
      <path d={FORM} fill={s.rand} />
      <g transform="translate(60 70) scale(.87) translate(-60 -70)">
        <path d={FORM} fill={`url(#${id}g)`} />
        <g clipPath={`url(#${id}c)`}>
          {t === 0 && <path d="M10 40 C40 30 70 52 112 38 M10 66 C44 56 78 80 112 64 M10 94 C46 84 72 106 112 92" fill="none" stroke={s.rand} strokeWidth="2.5" opacity=".3" />}
          {t === 1 && (
            <g fill={s.rand} opacity=".28">
              <circle cx="34" cy="34" r="3" />
              <circle cx="86" cy="44" r="2.4" />
              <circle cx="30" cy="80" r="2.2" />
              <circle cx="88" cy="88" r="3.2" />
              <circle cx="70" cy="112" r="2" />
              <circle cx="48" cy="104" r="2.6" />
            </g>
          )}
          {t >= 2 && <path d="M-10 60 L70 -10 L92 -10 L-10 82 Z" fill="#ffffff" opacity={t === 5 ? 0.16 : 0.3} />}
        </g>
      </g>
      <path d="M58.5 48 C52 43 43 42 36 44.5 V68 C43 65.5 52 66.5 58.5 71 Z M61.5 48 C68 43 77 42 84 44.5 V68 C77 65.5 68 66.5 61.5 71 Z" fill={s.zeichen} />
      {Array.from({ length: Math.min(t, 3) }, (_, i) => (
        <path key={i} d={`M47 ${81 + i * 9} L60 ${88 + i * 9} L73 ${81 + i * 9}`} fill="none" stroke={s.zeichen} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

/** Alle sechs Stufen mit dem, was man dafür tun muss – erreichte farbig, die übrigen grau. */
export function StufenLeiter({ erreicht, hoechste }: { erreicht: number; hoechste: number }) {
  return (
    <ol className="abz-leiter">
      {STUFEN.map((s, i) => {
        const hat = i < erreicht;
        return (
          <li key={s.name} className={hat ? 'erreicht' : undefined}>
            <Schild stufe={i + 1} groesse={64} gesperrt={!hat} />
            <span>
              <strong>{s.name}</strong>
              <span className="leise klein"> · {hat ? 'erreicht' : i >= hoechste ? 'in diesem Lernmodul nicht erreichbar (zu wenige Quiz)' : 'offen'}</span>
              <span className="abz-wofuer">{s.wofuer}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Fenster nach einem neuen Abzeichen: zeigt das Schild groß. Escape, der Knopf oder ein Klick daneben schließen es. */
export function AbzeichenFeier({ erfolg, onZu }: { erfolg: Erfolg; onZu: () => void }) {
  const knopf = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const vorher = document.activeElement as HTMLElement | null;
    knopf.current?.focus();
    const taste = (e: KeyboardEvent) => e.key === 'Escape' && onZu();
    document.addEventListener('keydown', taste);
    return () => {
      document.removeEventListener('keydown', taste);
      vorher?.focus?.();
    };
  }, [onZu]);
  const a = erfolg.abzeichen;
  const stufe = a?.stufe ?? erfolg.rang?.stufe ?? 1;
  return (
    <div className="dialog-hintergrund" onMouseDown={(e) => e.target === e.currentTarget && onZu()}>
      <section className="karte dialog abz-feier" role="dialog" aria-modal="true" aria-labelledby="abz-feier-kopf" aria-describedby="abz-feier-text">
        <div className="abz-feier-bild">
          <Schild stufe={stufe} groesse={148} />
        </div>
        <h2 id="abz-feier-kopf">{a ? `Neues Abzeichen: ${a.name}` : `Neuer Rang: ${erfolg.rang?.name}`}</h2>
        <p id="abz-feier-text">
          {a && (
            <>
              Du hast im Themenfeld „{a.feldTitel}“ die Stufe {a.name} erreicht.
            </>
          )}
          {erfolg.rang && (
            <>
              {a ? ' ' : ''}
              Dein Rang ist jetzt <strong>{erfolg.rang.name}</strong>.
            </>
          )}
        </p>
        <p className="leise klein">
          Abzeichen siehst nur du. <HandbuchLink kapitel="abzeichen">Abzeichen sammeln</HandbuchLink>
        </p>
        <p className="aktionen links">
          <button ref={knopf} type="button" className="knopf" onClick={onZu}>
            Weiter lernen
          </button>
        </p>
      </section>
    </div>
  );
}
