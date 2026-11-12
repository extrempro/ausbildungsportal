import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../icons';
import { Link } from '../router';
import { useLern } from './basis';
import { AMPEL_FARBE, AMPEL_REIHE, AMPEL_TEXT, zusammenfassung } from './ampel';
import type { LernStatus, Zaehlung } from './ampel';

/** Einfache Auszeichnung aus den Inhaltsdateien: `Code`, **fett**, [Link](https://…). */
export function Inline({ text }: { text: string }) {
  const teile: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  let ende = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > ende) teile.push(text.slice(ende, m.index));
    const t = m[0];
    if (t.startsWith('`')) teile.push(<code key={i++}>{t.slice(1, -1)}</code>);
    else if (t.startsWith('**')) teile.push(<strong key={i++}>{t.slice(2, -2)}</strong>);
    else {
      const l = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t)!;
      teile.push(
        <a key={i++} href={l[2]} target="_blank" rel="noopener noreferrer">
          {l[1]}
        </a>,
      );
    }
    ende = m.index + t.length;
  }
  if (ende < text.length) teile.push(text.slice(ende));
  return <>{teile}</>;
}

/** Bereiche des Lernmoduls – steht oben auf den Hauptseiten unter „Lernen“. */
export function LernReiter() {
  const { basis, lesen, azubi } = useLern();
  // Azubi: die Reiter des eigenen Lernmoduls und – wenn es eins gibt – das Paket für alle Berufe
  if (azubi) {
    return (
      <nav className="lern-reiter" aria-label="Bereiche unter Lernen">
        {azubi.lernen && (
          <>
            <Link zu="/lernen">Themenfelder</Link>
            <Link zu="/lernen/kompendium">Kompendium</Link>
            <Link zu="/lernen/ueben" aktivAb="/lernen/ueben">
              Üben
            </Link>
          </>
        )}
        {azubi.allgemein && (
          <Link zu="/anleitungen" aktivAb="/anleitungen">
            {azubi.allgemein}
          </Link>
        )}
      </nav>
    );
  }
  return (
    <nav className="lern-reiter" aria-label="Bereiche im Lernmodul">
      <Link zu={basis}>Themenfelder</Link>
      <Link zu={`${basis}/kompendium`}>Kompendium</Link>
      {!lesen && (
        <Link zu={`${basis}/ueben`} aktivAb={`${basis}/ueben`}>
          Üben
        </Link>
      )}
    </nav>
  );
}

export function StatusPille({ status }: { status: LernStatus }) {
  return <span className={`pille ${AMPEL_FARBE[status]}`}>{AMPEL_TEXT[status]}</span>;
}

/** Balken aus drei Teilen: sicher, in Arbeit, offen – mit Text für Vorleseprogramme. */
export function StapelBalken({ z }: { z: Zaehlung }) {
  const breite = (x: number) => (z.n ? `${(x / z.n) * 100}%` : '0%');
  return (
    <div className="lern-balken" role="img" aria-label={`${z.n} Unterthemen: ${zusammenfassung(z)}`}>
      <span className="gruen" style={{ width: breite(z.g) }} />
      <span className="gelb" style={{ width: breite(z.y) }} />
      <span className="rot" style={{ width: breite(z.r) }} />
    </div>
  );
}

/** Die Ampel als drei Knöpfe; der gewählte ist farbig und per aria-pressed erkennbar. */
export function AmpelSchalter({ titel, status, gesperrt, onChange }: { titel: string; status: LernStatus; gesperrt?: boolean; onChange: (s: LernStatus) => void }) {
  return (
    <div className="ampel-schalter" role="group" aria-label={`Mein Stand bei „${titel}“`}>
      {AMPEL_REIHE.map((s) => (
        <button key={s} type="button" className={`ampel-knopf ${s}`} aria-pressed={status === s} disabled={gesperrt} onClick={() => status !== s && onChange(s)}>
          <span className="ampel-punkt" aria-hidden="true" />
          {AMPEL_TEXT[s]}
        </button>
      ))}
    </div>
  );
}

export interface Bild {
  alt: string;
  datei: string;
  svg: string;
}

const svgBreite = (svg: string) => Number(/viewBox="\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)/.exec(svg)?.[1]) || 0;

/**
 * Eine Grafik aus dem Inhaltspaket. Die SVG ist vom Server bereinigt und wird direkt eingebettet,
 * damit sie über die .sv-Klassen die Farben von Hell und Dunkel übernimmt. Ein Klick zeigt sie groß.
 */
export function Grafik({ bild }: { bild: Bild }) {
  const [gross, setGross] = useState(false);
  const knopf = useRef<HTMLButtonElement>(null);
  if (!bild.svg) return <p className="hinweis">Die Grafik „{bild.datei}“ ließ sich nicht laden.</p>;
  return (
    <figure className="lern-grafik" style={{ maxWidth: svgBreite(bild.svg) ? Math.round(svgBreite(bild.svg) * 1.4) : undefined }}>
      <button ref={knopf} type="button" className="lern-grafik-knopf" aria-label={`Grafik vergrößern: ${bild.alt}`} title="Zum Vergrößern anklicken" onClick={() => setGross(true)}>
        <span className="sv-figur" aria-hidden="true" dangerouslySetInnerHTML={{ __html: bild.svg }} />
      </button>
      <figcaption>{bild.alt}</figcaption>
      {gross && (
        <Lupe
          bild={bild}
          onZu={() => {
            setGross(false);
            knopf.current?.focus();
          }}
        />
      )}
    </figure>
  );
}

function Lupe({ bild, onZu }: { bild: Bild; onZu: () => void }) {
  useEffect(() => {
    const taste = (e: KeyboardEvent) => e.key === 'Escape' && onZu();
    window.addEventListener('keydown', taste);
    const vorher = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', taste);
      document.body.style.overflow = vorher;
    };
  }, [onZu]);
  return createPortal(
    <div className="dialog-hintergrund lern-lupe" role="dialog" aria-modal="true" aria-label={bild.alt} onClick={onZu}>
      <div className="lern-lupe-inhalt" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="knopf schlicht lern-lupe-zu" autoFocus aria-label="Großansicht schließen" onClick={onZu}>
          <Icon name="zu" />
        </button>
        <div className="sv-figur sv-lupe" role="img" aria-label={bild.alt} dangerouslySetInnerHTML={{ __html: bild.svg }} />
        <p className="leise klein">{bild.alt}</p>
      </div>
    </div>,
    document.body,
  );
}

export interface Tabelle {
  titel: string;
  kopf: string[];
  zeilen: string[][];
}

export function TabelleAnsicht({ t }: { t: Tabelle }) {
  return (
    <div className="tabelle-rahmen">
      <table className="lern-tabelle">
        <thead>
          <tr>
            {t.kopf.map((k, i) => (
              <th key={i} scope="col">
                <Inline text={k} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.zeilen.map((z, i) => (
            <tr key={i}>
              {z.map((zelle, j) => (
                <td key={j}>
                  <Inline text={zelle} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
