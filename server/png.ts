import { crc32, deflateSync } from 'node:zlib';

/**
 * Kleine PNG-Bilder ohne Zusatzpaket – für das Umriss-Symbol der Teams-App (32 × 32, weiß auf durchsichtig).
 * Gezeichnet wird das Zeichen des Portals (Doktorhut wie in public/favicon.svg) mit vierfacher Abtastung, damit die Kanten weich sind.
 */
function stueck(art: string, daten: Buffer): Buffer {
  const laenge = Buffer.alloc(4);
  laenge.writeUInt32BE(daten.length);
  const inhalt = Buffer.concat([Buffer.from(art, 'ascii'), daten]);
  const pruef = Buffer.alloc(4);
  pruef.writeUInt32BE(crc32(inhalt));
  return Buffer.concat([laenge, inhalt, pruef]);
}

/** PNG in RGBA aus einer Funktion je Bildpunkt */
export function png(breite: number, hoehe: number, punkt: (x: number, y: number) => [number, number, number, number]): Buffer {
  const roh = Buffer.alloc((breite * 4 + 1) * hoehe);
  for (let y = 0; y < hoehe; y++) {
    for (let x = 0; x < breite; x++) {
      const o = y * (breite * 4 + 1) + 1 + x * 4;
      const [r, g, b, a] = punkt(x, y);
      roh[o] = r;
      roh[o + 1] = g;
      roh[o + 2] = b;
      roh[o + 3] = a;
    }
  }
  const kopf = Buffer.alloc(13);
  kopf.writeUInt32BE(breite, 0);
  kopf.writeUInt32BE(hoehe, 4);
  kopf[8] = 8; // Bittiefe
  kopf[9] = 6; // RGBA
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), stueck('IHDR', kopf), stueck('IDAT', deflateSync(roh)), stueck('IEND', Buffer.alloc(0))]);
}

/** Breite und Höhe eines PNG – oder null, wenn es keins ist */
export function pngGroesse(b: Buffer): { breite: number; hoehe: number } | null {
  if (b.length < 24 || !b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) || b.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { breite: b.readUInt32BE(16), hoehe: b.readUInt32BE(20) };
}

type Punkt = [number, number];
/** Flächen des Zeichens im Maßstab 64 × 64 (wie favicon.svg) */
const HUT: Punkt[] = [
  [32, 17],
  [9, 28],
  [32, 39],
  [55, 28],
];
const BAND: Punkt[] = [
  [19, 34],
  [19, 43],
  [25, 47.5],
  [32, 48.5],
  [39, 47.5],
  [45, 43],
  [45, 34],
  [32, 40],
];

function innen(p: Punkt, flaeche: Punkt[]): boolean {
  let drin = false;
  for (let i = 0, j = flaeche.length - 1; i < flaeche.length; j = i++) {
    const [xi, yi] = flaeche[i];
    const [xj, yj] = flaeche[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) drin = !drin;
  }
  return drin;
}

function gedeckt(x: number, y: number): boolean {
  // Quaste: senkrechter Strich und Kugel rechts
  if (Math.abs(x - 51) <= 1.6 && y >= 29 && y <= 42) return true;
  if ((x - 51) ** 2 + (y - 45) ** 2 <= 9) return true;
  return innen([x, y], HUT) || innen([x, y], BAND);
}

/** Umriss-Symbol: das Zeichen des Portals weiß auf durchsichtigem Grund */
export function umrissSymbol(groesse = 32): Buffer {
  const n = 4;
  return png(groesse, groesse, (x, y) => {
    let treffer = 0;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) if (gedeckt(((x + (i + 0.5) / n) * 64) / groesse, ((y + (j + 0.5) / n) * 64) / groesse)) treffer++;
    return [255, 255, 255, Math.round((255 * treffer) / (n * n))];
  });
}
