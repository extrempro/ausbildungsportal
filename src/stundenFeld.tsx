import { useEffect, useState } from 'react';
import type { KeyboardEvent } from 'react';

/**
 * Eingabe für Stunden – mit Komma oder Punkt, genau auf 3 Minuten (0,05 Stunden): 7,8 h (39 h ÷ 5) geht ebenso wie 7,75.
 * Bewusst kein `type="number"`: Safari (iPhone und Mac) nimmt dort kein Komma an, die deutsche Tastatur am iPhone
 * bietet aber nur das Komma – „1,5“ wurde so zu einer ganzen Zahl. Pfeil hoch/runter ändert um eine Viertelstunde.
 * Früher wurde auf Viertelstunden gerundet – 7,8 h am Tag ließen sich so nicht eintragen.
 */
const ERLAUBT = /^\d{0,4}([.,]\d{0,2})?$/;

const alsText = (n: number, leerBeiNull: boolean) => (leerBeiNull && n === 0 ? '' : String(n).replace('.', ','));
const alsZahl = (t: string) => Number(t.replace(',', '.')) || 0;

export function StundenFeld({
  wert,
  onWert,
  max,
  leerBeiNull = false,
  ...rest
}: {
  wert: number;
  onWert: (n: number) => void;
  max: number;
  /** 0 als leeres Feld zeigen (z. B. im Planer) */
  leerBeiNull?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
  id?: string;
  required?: boolean;
}) {
  const [text, setText] = useState(() => alsText(wert, leerBeiNull));
  // Ändert sich der Wert von außen (Laden, Entfernen einer Zeile …), steht er neu im Feld – was gerade getippt wird, bleibt
  useEffect(() => {
    setText((alt) => (alsZahl(alt) === wert ? alt : alsText(wert, leerBeiNull)));
  }, [wert, leerBeiNull]);

  const setze = (n: number) => {
    const sauber = Math.max(0, Math.min(max, Math.round(n * 20) / 20));
    setText(alsText(sauber, leerBeiNull));
    // nur melden, was sich wirklich ändert – sonst stünde schon nach bloßem Durchklicken „Noch nicht gespeichert“
    if (sauber !== wert) onWert(sauber);
  };
  const taste = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    setze(alsZahl(text) + (e.key === 'ArrowUp' ? 0.25 : -0.25));
  };

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onKeyDown={taste}
      onChange={(e) => {
        const t = e.target.value.trim();
        if (!ERLAUBT.test(t)) return;
        setText(t);
        onWert(Math.min(max, alsZahl(t)));
      }}
      // beim Verlassen auf 3 Minuten (0,05) runden und einheitlich mit Komma zeigen
      onBlur={() => setze(alsZahl(text))}
    />
  );
}
