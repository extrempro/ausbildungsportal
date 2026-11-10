import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';

/** Zeichenfläche in festen Koordinaten; die Anzeige skaliert. Aus dem FISI-Lernkompass übernommen. */
const BREITE = 600;
const HOEHE = 200;

/** Zeigt eine gespeicherte Unterschrift (nur Pfaddaten, kein HTML). */
export function UnterschriftBild({ pfad, titel }: { pfad: string; titel?: string }) {
  return (
    <svg viewBox={`0 0 ${BREITE} ${HOEHE}`} className="unterschrift-bild" role="img" aria-label={titel ?? 'Unterschrift'} preserveAspectRatio="xMidYMid meet">
      <path d={pfad} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Feld zum Unterschreiben mit Finger, Stift oder Maus.
 * Liefert den Pfad als „M x y L x y …“ (nur Zahlen und M/L – so prüft ihn auch der Server).
 */
export function UnterschriftFeld({ onAendern }: { onAendern: (pfad: string) => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const [striche, setStriche] = useState<[number, number][][]>([]);
  const zeichnet = useRef(false);

  const punkt = (e: PointerEvent): [number, number] => {
    const r = svg.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * BREITE;
    const y = ((e.clientY - r.top) / r.height) * HOEHE;
    return [Math.round(Math.max(0, Math.min(BREITE, x)) * 10) / 10, Math.round(Math.max(0, Math.min(HOEHE, y)) * 10) / 10];
  };
  const alsPfad = (l: [number, number][][]) =>
    l
      .filter((s) => s.length > 1)
      .map((s) => `M${s[0][0]} ${s[0][1]} ${s.slice(1).map((p) => `L${p[0]} ${p[1]}`).join(' ')}`)
      .join(' ');

  // nach jedem fertigen Strich (und beim Löschen) den Pfad melden
  useEffect(() => {
    if (!zeichnet.current) onAendern(alsPfad(striche));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [striche]);

  const start = (e: PointerEvent) => {
    e.preventDefault();
    svg.current?.setPointerCapture(e.pointerId);
    zeichnet.current = true;
    setStriche((l) => [...l, [punkt(e)]]);
  };
  const bewegen = (e: PointerEvent) => {
    if (!zeichnet.current) return;
    const p = punkt(e);
    setStriche((l) => {
      const letzter = l[l.length - 1];
      const v = letzter[letzter.length - 1];
      if (Math.hypot(p[0] - v[0], p[1] - v[1]) < 1.5) return l; // kleine Zitterer weglassen
      return [...l.slice(0, -1), [...letzter, p]];
    });
  };
  const ende = () => {
    if (!zeichnet.current) return;
    zeichnet.current = false;
    setStriche((l) => l.slice());
  };

  return (
    <div>
      <svg
        ref={svg}
        viewBox={`0 0 ${BREITE} ${HOEHE}`}
        role="img"
        aria-label="Hier mit Finger, Stift oder Maus unterschreiben"
        className="unterschrift-feld"
        onPointerDown={start}
        onPointerMove={bewegen}
        onPointerUp={ende}
        onPointerCancel={ende}
      >
        <line x1={40} y1={160} x2={560} y2={160} className="unterschrift-linie" />
        <path d={alsPfad(striche)} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <button type="button" className="knopf schlicht" onClick={() => setStriche([])} disabled={striche.length === 0}>
        Feld leeren
      </button>
    </div>
  );
}
