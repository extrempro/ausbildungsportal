/**
 * Unterschrift ohne Zeichnen (WCAG 2.1.1 / 2.5.7): schreibt einen Namen als Linienzug in einer einfachen, selbst
 * gezeichneten Schreibschrift – für alle, die keine Maus, keinen Finger und keinen Stift führen können.
 * Das Ergebnis ist ein Pfad aus „M x y L x y …“ in der Fläche 600 × 200 – genau wie eine gezeichnete Unterschrift
 * (`src/unterschrift.tsx`); der Server prüft beide gleich.
 *
 * Buchstaben: Linienzüge auf einem Raster, Grundlinie y = 0, Kleinbuchstaben bis 6, Großbuchstaben bis 10, Unterlängen
 * bis −4.5. Mehrere Züge je Zeichen (z. B. i-Punkt, t-Strich). Danach werden die Ecken gerundet und die Schrift leicht
 * nach rechts geneigt – das wirkt handschriftlich.
 */
type Zug = [number, number][];

const PUNKTE = (x1: number, x2: number): Zug[] => [
  [
    [x1, 8],
    [x1 + 0.2, 8.6],
  ],
  [
    [x2, 8],
    [x2 + 0.2, 8.6],
  ],
];
const PUNKTE_GROSS = (x1: number, x2: number): Zug[] =>
  PUNKTE(x1, x2).map((z) => z.map(([x, y]) => [x, y + 3.6] as [number, number]));

const KLEIN: Record<string, Zug[]> = {
  a: [[[5, 5], [3, 6], [1, 5], [0, 3], [1, 1], [3, 0], [5, 1], [5, 6], [5, 1], [6, 0]]],
  b: [[[0, 10], [0, 0], [0, 3], [2, 5.5], [4, 5.5], [5, 3], [4, 0.8], [2, 0], [0, 1]]],
  c: [[[5, 5], [3, 6], [1, 5], [0, 3], [1, 1], [3, 0], [5, 1]]],
  d: [[[5, 3], [3, 5.5], [1, 5], [0, 3], [1, 1], [3, 0], [5, 1], [5, 10], [5, 1], [6, 0]]],
  e: [[[0, 3], [5, 3], [5, 4], [4, 5.5], [2, 6], [0, 4.5], [0, 2], [1, 0.5], [3, 0], [5, 1]]],
  f: [
    [[4.5, 9.5], [3, 10.5], [2, 9.8], [1.5, 8], [1.5, -3.5]],
    [[0, 6], [4, 6]],
  ],
  g: [[[5, 5], [3, 6], [1, 5], [0, 3], [1, 1], [3, 0], [5, 1], [5, 6], [5, -2], [4, -4], [2, -4.5], [0, -3.5]]],
  h: [[[0, 10], [0, 0], [0, 3], [2, 5.5], [4, 5.5], [5, 4], [5, 0]]],
  i: [[[0, 6], [0, 1], [1, 0]], [[0, 8], [0.2, 8.6]]],
  j: [[[1.5, 6], [1.5, -3], [0.5, -4.5], [-1, -4]], [[1.5, 8], [1.7, 8.6]]],
  k: [[[0, 10], [0, 0]], [[4, 6], [0.2, 2.5], [4, 0]]],
  l: [[[0, 10], [0, 1], [1, 0]]],
  m: [[[0, 6], [0, 0], [0, 4], [1.5, 6], [3, 5], [3, 0], [3, 4], [4.5, 6], [6, 5], [6, 0]]],
  n: [[[0, 6], [0, 0], [0, 4], [2, 6], [4, 5], [4, 0]]],
  o: [[[3, 6], [1, 5], [0, 3], [1, 1], [3, 0], [5, 1], [6, 3], [5, 5], [3, 6]]],
  p: [[[0, 6], [0, -4.5], [0, 3], [2, 6], [4, 5.5], [5, 3], [4, 0.5], [2, 0], [0, 1.5]]],
  q: [[[5, 5], [3, 6], [1, 5], [0, 3], [1, 1], [3, 0], [5, 1], [5, 6], [5, -4.5], [6, -3.5]]],
  r: [[[0, 6], [0, 0], [0, 3.5], [2, 6], [4, 6]]],
  s: [[[4.5, 5.5], [2.5, 6], [0.5, 5], [1, 3.5], [4, 2.5], [4.5, 1], [2.5, 0], [0, 0.5]]],
  t: [[[1.5, 9], [1.5, 1], [2.5, 0], [4, 0.5]], [[0, 6], [3.5, 6]]],
  u: [[[0, 6], [0, 1.5], [1.5, 0], [3.5, 0.5], [4.5, 2], [4.5, 6], [4.5, 0]]],
  v: [[[0, 6], [2.5, 0], [5, 6]]],
  w: [[[0, 6], [1.5, 0], [3, 4.5], [4.5, 0], [6, 6]]],
  x: [[[0, 6], [4, 0]], [[4, 6], [0, 0]]],
  y: [[[0, 6], [2.5, 0]], [[5, 6], [1, -4], [-0.5, -4.5]]],
  z: [[[0, 6], [4.5, 6], [0, 0], [4.5, 0]]],
  ß: [[[0, -3], [0, 8], [1.5, 10], [3.5, 9.5], [4, 8], [2.5, 6], [4.5, 4.5], [4.5, 1.5], [3, 0], [1.5, 0.3]]],
};

const GROSS: Record<string, Zug[]> = {
  A: [[[0, 0], [3.5, 10], [7, 0]], [[1.3, 4], [5.7, 4]]],
  B: [
    [[0, 0], [0, 10], [3.5, 10], [5, 8.8], [5, 6.3], [3.5, 5.2], [0, 5.2]],
    [[3.5, 5.2], [5.5, 4], [5.5, 1.3], [3.8, 0], [0, 0]],
  ],
  C: [[[6, 8.5], [4.5, 10], [2, 9.7], [0.3, 7.5], [0, 5], [0.5, 2.3], [2.3, 0.2], [4.5, 0], [6, 1.3]]],
  D: [[[0, 0], [0, 10], [3, 10], [5.3, 8.5], [6, 5], [5.3, 1.5], [3, 0], [0, 0]]],
  E: [[[5, 10], [0, 10], [0, 0], [5, 0]], [[0, 5.2], [4, 5.2]]],
  F: [[[5, 10], [0, 10], [0, 0]], [[0, 5.2], [4, 5.2]]],
  G: [[[6, 8.5], [4.5, 10], [2, 9.7], [0.3, 7.5], [0, 5], [0.5, 2.3], [2.3, 0.2], [4.5, 0], [6, 1.3], [6, 4.5], [3.5, 4.5]]],
  H: [[[0, 10], [0, 0]], [[5.5, 10], [5.5, 0]], [[0, 5.2], [5.5, 5.2]]],
  I: [[[1, 10], [1, 0]]],
  J: [[[4, 10], [4, 2], [3, 0.2], [1.5, 0], [0, 1.5]]],
  K: [[[0, 10], [0, 0]], [[5, 10], [0.3, 4.5]], [[1.8, 6], [5.2, 0]]],
  L: [[[0, 10], [0, 0], [5, 0]]],
  M: [[[0, 0], [0, 10], [3.5, 3], [7, 10], [7, 0]]],
  N: [[[0, 0], [0, 10], [5.5, 0], [5.5, 10]]],
  O: [[[3.5, 10], [1, 8.8], [0, 5], [1, 1.2], [3.5, 0], [6, 1.2], [7, 5], [6, 8.8], [3.5, 10]]],
  P: [[[0, 0], [0, 10], [3.5, 10], [5.2, 8.7], [5.2, 6.3], [3.5, 5], [0, 5]]],
  Q: [[[3.5, 10], [1, 8.8], [0, 5], [1, 1.2], [3.5, 0], [6, 1.2], [7, 5], [6, 8.8], [3.5, 10]], [[4.5, 2], [7, -0.5]]],
  R: [[[0, 0], [0, 10], [3.5, 10], [5.2, 8.7], [5.2, 6.3], [3.5, 5], [0, 5]], [[2.5, 5], [5.5, 0]]],
  S: [[[5.5, 8.8], [4, 10], [1.8, 10], [0.3, 8.7], [0.6, 6.5], [5, 4], [5.5, 1.7], [4, 0.1], [1.5, 0], [0, 1.3]]],
  T: [[[0, 10], [6, 10]], [[3, 10], [3, 0]]],
  U: [[[0, 10], [0, 2.5], [1.3, 0.3], [3, 0], [4.7, 0.3], [6, 2.5], [6, 10]]],
  V: [[[0, 10], [3.2, 0], [6.4, 10]]],
  W: [[[0, 10], [2, 0], [4, 7], [6, 0], [8, 10]]],
  X: [[[0, 10], [6, 0]], [[6, 10], [0, 0]]],
  Y: [[[0, 10], [3, 5], [6, 10]], [[3, 5], [3, 0]]],
  Z: [[[0, 10], [6, 10], [0, 0], [6, 0]]],
};

const ZEICHEN: Record<string, Zug[]> = {
  ...KLEIN,
  ...GROSS,
  ä: [...KLEIN.a, ...PUNKTE(1.5, 3.8)],
  ö: [...KLEIN.o, ...PUNKTE(1.8, 4)],
  ü: [...KLEIN.u, ...PUNKTE(1, 3.4)],
  Ä: [...GROSS.A, ...PUNKTE_GROSS(2.2, 4.6)],
  Ö: [...GROSS.O, ...PUNKTE_GROSS(2.2, 4.6)],
  Ü: [...GROSS.U, ...PUNKTE_GROSS(1.8, 4.2)],
  '-': [[[0, 4], [3, 4]]],
  '.': [[[0, 0], [0.2, 0.5]]],
  "'": [[[0.5, 10], [0, 8]]],
};

/** Buchstaben mit Akzent (é, à, ç …) werden zum Grundbuchstaben – die Unterschrift bleibt lesbar */
const grund = (z: string) => (ZEICHEN[z] ? z : z.normalize('NFD').replace(/[̀-ͯ]/g, ''));

/** Ecken runden (Chaikin): Aus jedem Abschnitt werden zwei Punkte bei einem und drei Vierteln. Anfang und Ende bleiben. */
function rund(z: Zug): Zug {
  if (z.length < 3) return z;
  const aus: Zug = [z[0]];
  for (let i = 0; i < z.length - 1; i++) {
    const [a, b] = [z[i], z[i + 1]];
    aus.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
  }
  aus.push(z[z.length - 1]);
  return aus;
}

const BREITE = 600;
const GRUNDLINIE = 150;
const NEIGUNG = 0.22;

/** Der Name als Unterschriftspfad – oder '' wenn darin kein schreibbarer Buchstabe vorkommt. */
export function unterschriftAusName(name: string): string {
  const zuege: Zug[] = [];
  let x = 0;
  for (const roh of name.trim().replace(/\s+/g, ' ')) {
    if (roh === ' ') {
      x += 3.5;
      continue;
    }
    const z = ZEICHEN[grund(roh)] ?? ZEICHEN[grund(roh).toLowerCase()];
    if (!z) continue;
    const breite = Math.max(...z.flat().map(([px]) => px));
    for (const zug of z) zuege.push(zug.map(([px, py]) => [px + x, py] as [number, number]));
    x += breite + 1.6;
  }
  if (!zuege.length) return '';
  // so groß wie möglich: höchstens 520 breit, Oberlänge bis Unterlänge (−4.5 … 12) höchstens 120 hoch
  const massstab = Math.min(9, 520 / (x + 10 * NEIGUNG), 120 / 16.5);
  const gesamt = (x + 10 * NEIGUNG) * massstab;
  const links = (BREITE - gesamt) / 2;
  const r = (v: number) => Math.round(v * 10) / 10;
  return zuege
    .map(rund)
    .map((zug) => zug.map(([px, py]) => [r(links + (px + py * NEIGUNG) * massstab), r(GRUNDLINIE - py * massstab)] as const))
    .map((zug) => `M${zug[0][0]} ${zug[0][1]} ${zug.slice(1).map(([px, py]) => `L${px} ${py}`).join(' ')}`)
    .join(' ');
}
