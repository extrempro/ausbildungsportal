/**
 * Die Pflanzen im Pflanzenregal – selbst gezeichnet (keine fremden Vorlagen), als SVG im Feld 120 × 150.
 * Farben kommen aus den Variablen --pf-… in src/index.css (je Art und je Seltenheit des Topfs).
 *
 * Eine Pflanze wächst stufenlos: Höhe, Blattgröße und Zahl der Blätter folgen aus Stufe und Wuchs. Hat sie Durst,
 * hängen die Blätter etwas, unter 20 % Feuchte deutlich und werden fahl – eingehen kann sie nicht.
 */

type Form = 'herz' | 'schwert' | 'feder' | 'orchidee' | 'farn' | 'ranke';

/** Blattlagen je Form: [x, y, Winkel, Länge, Breite] – von unten nach oben, in der Reihenfolge, in der sie wachsen. */
const LAGEN: Record<Form, [number, number, number, number, number][]> = {
  herz: [[60, 92, -150, 14, 9], [60, 84, -30, 14, 9], [60, 72, -160, 16, 10], [60, 64, -20, 16, 10], [60, 52, -145, 15, 9], [60, 44, -35, 15, 9], [60, 34, -90, 12, 8]],
  schwert: [[56, 100, -100, 30, 6], [64, 100, -80, 32, 6], [52, 100, -115, 26, 6], [68, 100, -65, 27, 6], [58, 100, -92, 40, 6], [62, 100, -86, 38, 6], [60, 100, -90, 46, 5]],
  feder: [[60, 90, -140, 18, 7], [60, 88, -40, 18, 7], [60, 74, -150, 20, 7], [60, 72, -30, 20, 7], [60, 58, -140, 18, 6], [60, 56, -40, 18, 6], [60, 42, -90, 14, 6]],
  orchidee: [[58, 100, -170, 22, 8], [62, 100, -10, 22, 8], [56, 98, -160, 18, 7], [64, 98, -20, 18, 7], [58, 96, -175, 14, 6], [62, 96, -5, 14, 6], [60, 96, -90, 8, 4]],
  farn: [[60, 96, -160, 20, 5], [60, 96, -20, 20, 5], [60, 84, -150, 22, 5], [60, 84, -30, 22, 5], [60, 70, -140, 20, 5], [60, 70, -40, 20, 5], [60, 56, -90, 16, 5]],
  // Ranken: zwei Blätter oben auf der Erde, der Rest hängt links und rechts über den Topfrand
  ranke: [[54, 98, -145, 12, 7], [66, 98, -35, 12, 7], [32, 108, 120, 12, 7], [88, 108, 60, 12, 7], [27, 122, 115, 12, 7], [93, 122, 65, 12, 7], [24, 138, 105, 11, 6]],
};

const ART: Record<string, { form: Form; bluete?: boolean }> = {
  efeutute: { form: 'herz' },
  bogenhanf: { form: 'schwert' },
  gluecksfeder: { form: 'feder' },
  gummibaum: { form: 'herz' },
  usambara: { form: 'herz', bluete: true },
  flamingo: { form: 'herz', bluete: true },
  friedenslilie: { form: 'schwert', bluete: true },
  efeuranke: { form: 'ranke' },
  erbsenranke: { form: 'ranke' },
  tradeskantie: { form: 'ranke' },
  orchidee: { form: 'orchidee', bluete: true },
  maranta: { form: 'herz' },
  schildfarn: { form: 'farn' },
  mondfarn: { form: 'farn' },
  silberranke: { form: 'ranke' },
  glutfarn: { form: 'farn' },
  sternorchidee: { form: 'orchidee', bluete: true },
  bericht: { form: 'herz' },
};

export const SELTENHEIT: Record<string, string> = { gewoehnlich: 'gewöhnlich', selten: 'selten', besonders: 'besonders', legendaer: 'legendär' };

export interface PflanzenBild {
  art: string;
  seltenheit: string;
  /** 0 (Keimling, frisch) bis 3 (Prachtstück) */
  wuchs: number;
  feuchte: number;
}

/** Stufenloser Wuchs aus Stufe (1–4) und Fortschritt (0–100). */
export const wuchsVon = (stufe: number, wuchs: number) => Math.min(3, stufe - 1 + (stufe < 4 ? wuchs / 100 : 0));

export function Pflanze({ art, seltenheit, wuchs: f, feuchte, groesse = 110 }: PflanzenBild & { groesse?: number }) {
  const a = ART[art] ?? ART.efeutute;
  const lagen = LAGEN[a.form];
  const welk = feuchte < 20;
  const durstig = !welk && feuchte < 50;
  const haengen = welk ? 38 : durstig ? 12 : 0;
  const sichtbar = Math.min(7, 3 + Math.floor((f * 4) / 3 + 0.0001));
  const gross = 0.85 + 0.05 * f;
  const hoehe = a.form === 'ranke' ? 10 + 4 * f : 34 + 14 * f;
  const spitzeX = welk && a.form !== 'ranke' ? 66 : 60;
  const ranke = a.form === 'ranke';
  const topf = (
    <>
      <path className="pf-topf" d="M34 104 L86 104 L80 136 L40 136Z" />
      <rect className="pf-topfrand" x="31" y="98" width="58" height="9" rx="3" />
    </>
  );
  return (
    <svg className={`pf pf-${art} pf-s-${seltenheit}${welk ? ' pf-welk' : ''}`} viewBox="0 0 120 150" width={groesse} height={(groesse * 150) / 120} aria-hidden="true">
      {ranke && topf}
      {ranke ? (
        <path className="pf-stiel" d={`M34 102 Q ${28 - f} ${110 + 4 * f} ${25 - f} ${108 + 10 * f} M86 102 Q ${92 + f} ${110 + 4 * f} ${95 + f} ${108 + 10 * f}`} fill="none" strokeWidth="2.5" strokeLinecap="round" />
      ) : (
        <path className="pf-stiel" d={`M60 104 L${spitzeX} ${104 - hoehe}`} fill="none" strokeWidth="4" strokeLinecap="round" />
      )}
      {lagen.map(([x, y0, w, l, b], i) => {
        if (i >= sichtbar) return null;
        // Ranken hängen nach unten – sie wachsen in die Länge; alle anderen in die Höhe
        const y = ranke ? (i < 2 ? y0 : 100 + (y0 - 100) * (0.7 + 0.1 * f)) : 104 - (104 - y0) * (0.7 + 0.15 * f);
        let winkel = w;
        if (w > -100 && w < -80) winkel = w + (welk ? 25 : 0);
        else if (w < -90 || w > 90) winkel = w - haengen;
        else winkel = w + haengen;
        return <ellipse key={i} className={i % 2 ? 'pf-blatt2' : 'pf-blatt'} cx={(l * gross).toFixed(1)} cy="0" rx={(l * gross).toFixed(1)} ry={(b * gross).toFixed(1)} transform={`translate(${x} ${y.toFixed(1)}) rotate(${winkel})`} />;
      })}
      {a.bluete && f >= 2 && !welk && (
        <>
          <circle className="pf-bluete" cx={spitzeX} cy={104 - hoehe - 2} r="7" />
          <circle className="pf-bluete" cx="52" cy={104 - hoehe + 10} r="5.5" />
          {f >= 2.6 && <circle className="pf-bluete" cx="68" cy={104 - hoehe + 16} r="5" />}
        </>
      )}
      {!ranke && topf}
    </svg>
  );
}
