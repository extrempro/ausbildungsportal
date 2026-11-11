import { deflateSync, inflateSync } from 'node:zlib';

/**
 * Kleiner PDF-Schreiber ohne fremde Bibliothek – gerade so viel, wie das Berichtsheft braucht:
 * Text in Helvetica (normal und fett), Linien, Strichzüge (Unterschriften), Bilder (PNG, JPEG) und mehrere Seiten.
 *
 * Maße in Punkt (1 pt = 1/72 Zoll), Ursprung oben links – wie man eine Seite liest. Umgerechnet wird beim Schreiben.
 * Die Schriften sind die Standardschriften jedes PDF-Betrachters und deshalb nicht eingebettet; der Zeichensatz ist
 * Windows-1252 (alle deutschen Zeichen). Was darin nicht vorkommt, etwa Emojis, wird zu „?“.
 */
export const A4 = { breite: 595.28, hoehe: 841.89 };

// ---------- Zeichensatz ----------
const CP1252: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e,
  0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};
// Zeichen, die es in Windows-1252 nicht gibt, aber einen guten Ersatz haben
const ERSATZ: Record<number, string> = { 0x2011: '-', 0x2012: '-', 0x2212: '-', 0x00a0: ' ', 0x202f: ' ', 0x2009: ' ', 0x2192: '->', 0x2190: '<-', 0x2713: 'x', 0x2714: 'x', 0x2264: '<=', 0x2265: '>=' };

/** Text → Bytes in Windows-1252. Steuerzeichen werden zu Leerzeichen, Unbekanntes zu „?“. */
export function alsCp1252(text: string): number[] {
  const out: number[] = [];
  for (const zeichen of text) {
    const c = zeichen.codePointAt(0)!;
    if (c < 0x20 || c === 0x7f) out.push(0x20);
    else if (c < 0x80 || (c >= 0xa0 && c <= 0xff)) out.push(c);
    else if (CP1252[c] !== undefined) out.push(CP1252[c]);
    else if (ERSATZ[c] !== undefined) for (const e of ERSATZ[c]) out.push(e.charCodeAt(0));
    else if (c >= 0xfe00 && c <= 0xfe0f) continue; // Variantenwähler hinter Emojis
    else out.push(0x3f);
  }
  return out;
}

// ---------- Zeichenbreiten (Helvetica, in Tausendstel der Schriftgröße) ----------
// Zeichen 32–126 in der Reihenfolge des Zeichensatzes
const NORMAL = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const FETT = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
// Sonderzeichen oberhalb von 127: [normal, fett]
const SONDER: Record<number, [number, number]> = {
  0x80: [556, 556], 0x82: [222, 278], 0x84: [333, 500], 0x85: [1000, 1000], 0x8b: [333, 333], 0x91: [222, 278], 0x92: [222, 278], 0x93: [333, 500], 0x94: [333, 500], 0x95: [350, 350], 0x96: [556, 556], 0x97: [1000, 1000], 0x9b: [333, 333],
  0xa0: [278, 278], 0xa7: [556, 556], 0xab: [556, 556], 0xb0: [400, 400], 0xb7: [278, 278], 0xbb: [556, 556], 0xd7: [584, 584], 0xdf: [611, 611], 0xe6: [889, 889], 0xc6: [1000, 1000], 0xf8: [611, 611], 0xd8: [778, 778],
};
// Buchstaben mit Akzent sind so breit wie ihr Grundbuchstabe
const GRUND = 'AAAAAA_CEEEEIIIIDNOOOOO_OUUUUY__aaaaaa_ceeeeiiiidnooooo_ouuuuy_y';

function zeichenBreite(b: number, fett: boolean): number {
  const tafel = fett ? FETT : NORMAL;
  if (b >= 32 && b <= 126) return tafel[b - 32];
  const s = SONDER[b];
  if (s) return s[fett ? 1 : 0];
  if (b >= 0xc0) {
    const g = GRUND[b - 0xc0];
    if (g !== '_') return tafel[g.charCodeAt(0) - 32];
  }
  return 556;
}

/** Breite eines Textes in Punkt. */
export function textBreite(text: string, groesse: number, fett = false): number {
  let summe = 0;
  for (const b of alsCp1252(text)) summe += zeichenBreite(b, fett);
  return (summe * groesse) / 1000;
}

/** Bricht einen Text so um, dass keine Zeile breiter ist als `breite`. Zeilenumbrüche im Text bleiben; überlange Wörter werden geteilt. */
export function umbruch(text: string, breite: number, groesse: number, fett = false): string[] {
  const zeilen: string[] = [];
  for (const absatz of text.replace(/\r\n?/g, '\n').split('\n')) {
    let zeile = '';
    for (let wort of absatz.split(/[ \t]+/).filter(Boolean)) {
      while (textBreite(wort, groesse, fett) > breite) {
        // ein Wort, das allein nicht passt: so viele Zeichen wie möglich in die Zeile
        let n = 1;
        const frei = breite - (zeile ? textBreite(`${zeile} `, groesse, fett) : 0);
        while (n < wort.length && textBreite(wort.slice(0, n + 1), groesse, fett) <= frei) n++;
        if (zeile && textBreite(wort.slice(0, n), groesse, fett) > frei) {
          zeilen.push(zeile);
          zeile = '';
          continue;
        }
        zeilen.push(zeile ? `${zeile} ${wort.slice(0, n)}` : wort.slice(0, n));
        zeile = '';
        wort = wort.slice(n);
      }
      if (!wort) continue;
      const mit = zeile ? `${zeile} ${wort}` : wort;
      if (textBreite(mit, groesse, fett) <= breite) zeile = mit;
      else {
        zeilen.push(zeile);
        zeile = wort;
      }
    }
    zeilen.push(zeile);
  }
  return zeilen;
}

// ---------- Bilder ----------
interface Bild {
  breite: number;
  hoehe: number;
  /** Einträge des Bild-Objekts (ohne Länge) und seine Daten */
  kopf: string;
  daten: Buffer;
  /** Durchsichtigkeit als eigenes Graustufenbild */
  maske?: Buffer;
}

function jpeg(b: Buffer): Bild | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marke = b[i + 1];
    const laenge = b.readUInt16BE(i + 2);
    // SOF0–SOF2: Höhe, Breite, Zahl der Farbkanäle
    if (marke >= 0xc0 && marke <= 0xc2) {
      const kanaele = b[i + 9];
      const farbe = kanaele === 1 ? '/DeviceGray' : kanaele === 3 ? '/DeviceRGB' : kanaele === 4 ? '/DeviceCMYK' : null;
      if (!farbe) return null;
      return { breite: b.readUInt16BE(i + 7), hoehe: b.readUInt16BE(i + 5), kopf: `/ColorSpace ${farbe} /BitsPerComponent 8 /Filter /DCTDecode${kanaele === 4 ? ' /Decode [1 0 1 0 1 0 1 0]' : ''}`, daten: b };
    }
    i += 2 + laenge;
  }
  return null;
}

/** PNG entpacken: liefert Farbwerte (RGB oder Grau, 8 Bit) und – wenn vorhanden – die Durchsichtigkeit. */
function png(b: Buffer): Bild | null {
  let i = 8;
  let kopf: { breite: number; hoehe: number; tiefe: number; art: number; verschraenkt: number } | null = null;
  const teile: Buffer[] = [];
  let palette: Buffer | null = null;
  let durchsicht: Buffer | null = null;
  while (i + 12 <= b.length) {
    const laenge = b.readUInt32BE(i);
    const typ = b.subarray(i + 4, i + 8).toString('latin1');
    const inhalt = b.subarray(i + 8, i + 8 + laenge);
    if (typ === 'IHDR') kopf = { breite: inhalt.readUInt32BE(0), hoehe: inhalt.readUInt32BE(4), tiefe: inhalt[8], art: inhalt[9], verschraenkt: inhalt[12] };
    else if (typ === 'PLTE') palette = inhalt;
    else if (typ === 'tRNS') durchsicht = inhalt;
    else if (typ === 'IDAT') teile.push(inhalt);
    else if (typ === 'IEND') break;
    i += 12 + laenge;
  }
  if (!kopf || kopf.verschraenkt !== 0 || kopf.breite < 1 || kopf.hoehe < 1 || kopf.breite * kopf.hoehe > 4_000_000) return null;
  const kanaele = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[kopf.art];
  if (!kanaele || ![1, 2, 4, 8, 16].includes(kopf.tiefe) || (kopf.art === 3 && !palette)) return null;
  const roh = inflateSync(Buffer.concat(teile));
  const bytesJePixel = Math.max(1, (kanaele * kopf.tiefe) / 8);
  const zeilenLaenge = Math.ceil((kopf.breite * kanaele * kopf.tiefe) / 8);
  if (roh.length < (zeilenLaenge + 1) * kopf.hoehe) return null;
  // Zeilenfilter rückgängig machen
  const bild = Buffer.alloc(zeilenLaenge * kopf.hoehe);
  for (let y = 0; y < kopf.hoehe; y++) {
    const filter = roh[y * (zeilenLaenge + 1)];
    const ein = y * (zeilenLaenge + 1) + 1;
    const aus = y * zeilenLaenge;
    for (let x = 0; x < zeilenLaenge; x++) {
      const links = x >= bytesJePixel ? bild[aus + x - bytesJePixel] : 0;
      const oben = y > 0 ? bild[aus + x - zeilenLaenge] : 0;
      const obenLinks = y > 0 && x >= bytesJePixel ? bild[aus + x - zeilenLaenge - bytesJePixel] : 0;
      let v = roh[ein + x];
      if (filter === 1) v += links;
      else if (filter === 2) v += oben;
      else if (filter === 3) v += (links + oben) >> 1;
      else if (filter === 4) {
        const p = links + oben - obenLinks;
        const pa = Math.abs(p - links);
        const pb = Math.abs(p - oben);
        const pc = Math.abs(p - obenLinks);
        v += pa <= pb && pa <= pc ? links : pb <= pc ? oben : obenLinks;
      }
      bild[aus + x] = v & 0xff;
    }
  }
  /** ein Wert (Kanal k des Pixels n in Zeile y) als 8 Bit bzw. als Palettennummer */
  const wert = (y: number, n: number, k: number): number => {
    const start = y * zeilenLaenge;
    if (kopf!.tiefe === 8) return bild[start + n * kanaele + k];
    if (kopf!.tiefe === 16) return bild[start + (n * kanaele + k) * 2];
    const bit = n * kopf!.tiefe;
    const v = (bild[start + (bit >> 3)] >> (8 - kopf!.tiefe - (bit & 7))) & ((1 << kopf!.tiefe) - 1);
    return kopf!.art === 3 ? v : Math.round((v * 255) / ((1 << kopf!.tiefe) - 1));
  };
  const grau = kopf.art === 0 || kopf.art === 4;
  const farben = Buffer.alloc(kopf.breite * kopf.hoehe * (grau ? 1 : 3));
  const hatMaske = kopf.art === 4 || kopf.art === 6 || (kopf.art === 3 && !!durchsicht);
  const maske = hatMaske ? Buffer.alloc(kopf.breite * kopf.hoehe, 255) : null;
  for (let y = 0; y < kopf.hoehe; y++) {
    for (let x = 0; x < kopf.breite; x++) {
      const n = y * kopf.breite + x;
      if (kopf.art === 3) {
        const p = wert(y, x, 0);
        farben[n * 3] = palette![p * 3] ?? 0;
        farben[n * 3 + 1] = palette![p * 3 + 1] ?? 0;
        farben[n * 3 + 2] = palette![p * 3 + 2] ?? 0;
        if (maske && durchsicht && p < durchsicht.length) maske[n] = durchsicht[p];
      } else if (grau) {
        farben[n] = wert(y, x, 0);
        if (maske) maske[n] = wert(y, x, 1);
      } else {
        farben[n * 3] = wert(y, x, 0);
        farben[n * 3 + 1] = wert(y, x, 1);
        farben[n * 3 + 2] = wert(y, x, 2);
        if (maske) maske[n] = wert(y, x, 3);
      }
    }
  }
  return { breite: kopf.breite, hoehe: kopf.hoehe, kopf: `/ColorSpace ${grau ? '/DeviceGray' : '/DeviceRGB'} /BitsPerComponent 8 /Filter /FlateDecode`, daten: deflateSync(farben), maske: maske ? deflateSync(maske) : undefined };
}

/** Liest ein PNG oder JPEG. Anderes (z. B. WebP) oder Beschädigtes ergibt null – das Dokument entsteht dann ohne dieses Bild. */
function leseBild(b: Buffer): Bild | null {
  try {
    if (b.length > 8 && b[0] === 0x89 && b.subarray(1, 4).toString('latin1') === 'PNG') return png(b);
    if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8) return jpeg(b);
  } catch {
    // beschädigte Datei
  }
  return null;
}

// ---------- Dokument ----------
export type Farbe = [number, number, number];
export const SCHWARZ: Farbe = [0, 0, 0];
export const GRAU: Farbe = [0.36, 0.4, 0.46];

const z = (n: number) => (Math.round(n * 100) / 100).toString();

export class PdfSeite {
  readonly befehle: string[] = [];
  constructor(private readonly dok: PdfDokument) {}

  text(x: number, y: number, text: string, o: { groesse?: number; fett?: boolean; farbe?: Farbe; rechts?: boolean; mitte?: boolean } = {}): void {
    const groesse = o.groesse ?? 10;
    const breite = o.rechts || o.mitte ? textBreite(text, groesse, o.fett) : 0;
    const links = o.rechts ? x - breite : o.mitte ? x - breite / 2 : x;
    const hex = alsCp1252(text).map((b) => b.toString(16).padStart(2, '0')).join('');
    if (!hex) return;
    const [r, g, b] = o.farbe ?? SCHWARZ;
    // y ist die Grundlinie der Zeile
    this.befehle.push(`BT ${z(r)} ${z(g)} ${z(b)} rg /${o.fett ? 'F2' : 'F1'} ${z(groesse)} Tf ${z(links)} ${z(A4.hoehe - y)} Td <${hex}> Tj ET`);
  }

  linie(x1: number, y1: number, x2: number, y2: number, o: { dicke?: number; farbe?: Farbe } = {}): void {
    const [r, g, b] = o.farbe ?? SCHWARZ;
    this.befehle.push(`q ${z(r)} ${z(g)} ${z(b)} RG ${z(o.dicke ?? 0.5)} w ${z(x1)} ${z(A4.hoehe - y1)} m ${z(x2)} ${z(A4.hoehe - y2)} l S Q`);
  }

  /**
   * Strichzug im Format „M10 10 L20 20 …“ (so sind die Unterschriften gespeichert), eingepasst in ein Feld.
   * `masse` ist die Zeichenfläche, auf die sich die Zahlen beziehen.
   */
  strichzug(pfad: string, masse: { breite: number; hoehe: number }, feld: { x: number; y: number; breite: number; hoehe: number }, dicke = 1): void {
    const faktor = Math.min(feld.breite / masse.breite, feld.hoehe / masse.hoehe);
    const dx = feld.x + (feld.breite - masse.breite * faktor) / 2;
    const dy = feld.y + (feld.hoehe - masse.hoehe * faktor) / 2;
    const out: string[] = [];
    // nur M und L mit Zahlen – alles andere hat der Server beim Speichern der Unterschrift schon abgelehnt
    if (!/^(?:\s*[ML]\s*-?\d+(?:\.\d+)?[\s,]+-?\d+(?:\.\d+)?)+\s*$/.test(pfad)) return;
    for (const m of pfad.matchAll(/([ML])\s*(-?\d+(?:\.\d+)?)[\s,]+(-?\d+(?:\.\d+)?)/g)) {
      out.push(`${z(dx + Number(m[2]) * faktor)} ${z(A4.hoehe - (dy + Number(m[3]) * faktor))} ${m[1] === 'M' ? 'm' : 'l'}`);
    }
    if (out.length) this.befehle.push(`q 0 0 0 RG ${z(dicke)} w 1 J 1 j ${out.join(' ')} S Q`);
  }

  /** Bild in ein Feld einpassen (Seitenverhältnis bleibt), mittig. `deckkraft` < 1 macht es blass. */
  bild(nummer: number, feld: { x: number; y: number; breite: number; hoehe: number }, deckkraft = 1): void {
    const b = this.dok.bilder[nummer];
    if (!b) return;
    const faktor = Math.min(feld.breite / b.breite, feld.hoehe / b.hoehe);
    const w = b.breite * faktor;
    const h = b.hoehe * faktor;
    const x = feld.x + (feld.breite - w) / 2;
    const y = feld.y + (feld.hoehe - h) / 2;
    this.befehle.push(`q ${deckkraft < 1 ? `/${this.dok.deckkraft(deckkraft)} gs ` : ''}${z(w)} 0 0 ${z(h)} ${z(x)} ${z(A4.hoehe - y - h)} cm /Im${nummer} Do Q`);
  }
}

export class PdfDokument {
  readonly seiten: PdfSeite[] = [];
  readonly bilder: Bild[] = [];
  private readonly stufen: number[] = [];

  constructor(private readonly angaben: { titel: string; verfasser?: string; erstellt: Date }) {}

  seite(): PdfSeite {
    const s = new PdfSeite(this);
    this.seiten.push(s);
    return s;
  }

  /** Nimmt ein Bild auf; liefert seine Nummer oder null, wenn es sich nicht lesen lässt (dann einfach weglassen). */
  bild(daten: Buffer): number | null {
    const b = leseBild(daten);
    if (!b) return null;
    this.bilder.push(b);
    return this.bilder.length - 1;
  }

  /** Name des Grafikzustands für eine Deckkraft */
  deckkraft(wert: number): string {
    let i = this.stufen.indexOf(wert);
    if (i < 0) i = this.stufen.push(wert) - 1;
    return `GS${i}`;
  }

  ausgabe(): Buffer {
    const objekte: Buffer[] = [];
    const neu = (inhalt: string | Buffer): number => {
      objekte.push(typeof inhalt === 'string' ? Buffer.from(inhalt, 'latin1') : inhalt);
      return objekte.length;
    };
    const strom = (kopf: string, daten: Buffer) => Buffer.concat([Buffer.from(`<< ${kopf} /Length ${daten.length} >>\nstream\n`, 'latin1'), daten, Buffer.from('\nendstream', 'latin1')]);
    const klartext = (s: string) => `<${alsCp1252(s).map((b) => b.toString(16).padStart(2, '0')).join('')}>`;

    // 1 Katalog, 2 Seitenbaum – die Nummern stehen fest, der Inhalt folgt am Ende
    neu('');
    neu('');
    const f1 = neu('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const f2 = neu('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const bildNr = this.bilder.map((b) => {
      const maske = b.maske ? neu(strom(`/Type /XObject /Subtype /Image /Width ${b.breite} /Height ${b.hoehe} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`, b.maske)) : 0;
      return neu(strom(`/Type /XObject /Subtype /Image /Width ${b.breite} /Height ${b.hoehe} ${b.kopf}${maske ? ` /SMask ${maske} 0 R` : ''}`, b.daten));
    });
    // Seiteninhalte zuerst vollständig sammeln: Erst hier steht fest, welche Deckkraft-Stufen gebraucht werden
    const inhalte = this.seiten.map((s) => neu(strom('/Filter /FlateDecode', deflateSync(Buffer.from(s.befehle.join('\n'), 'latin1')))));
    const mittel = `<< /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >>${bildNr.length ? ` /XObject << ${bildNr.map((n, i) => `/Im${i} ${n} 0 R`).join(' ')} >>` : ''}${
      this.stufen.length ? ` /ExtGState << ${this.stufen.map((w, i) => `/GS${i} << /ca ${z(w)} /CA ${z(w)} >>`).join(' ')} >>` : ''
    } >>`;
    const seitenNr = inhalte.map((inhalt) => neu(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.breite} ${A4.hoehe}] /Resources ${mittel} /Contents ${inhalt} 0 R >>`));
    const d = this.angaben.erstellt;
    const zwei = (n: number) => String(n).padStart(2, '0');
    const zeit = `D:${d.getUTCFullYear()}${zwei(d.getUTCMonth() + 1)}${zwei(d.getUTCDate())}${zwei(d.getUTCHours())}${zwei(d.getUTCMinutes())}${zwei(d.getUTCSeconds())}Z`;
    const info = neu(`<< /Title ${klartext(this.angaben.titel)}${this.angaben.verfasser ? ` /Author ${klartext(this.angaben.verfasser)}` : ''} /Producer (Ausbildungsportal) /Creator (Ausbildungsportal) /CreationDate (${zeit}) >>`);
    objekte[0] = Buffer.from('<< /Type /Catalog /Pages 2 0 R /Lang (de-DE) >>', 'latin1');
    objekte[1] = Buffer.from(`<< /Type /Pages /Kids [${seitenNr.map((n) => `${n} 0 R`).join(' ')}] /Count ${seitenNr.length} >>`, 'latin1');

    const teile: Buffer[] = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
    let laenge = teile[0].length;
    const stellen: number[] = [];
    objekte.forEach((o, i) => {
      stellen.push(laenge);
      const t = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, 'latin1'), o, Buffer.from('\nendobj\n', 'latin1')]);
      teile.push(t);
      laenge += t.length;
    });
    const tafel = `xref\n0 ${objekte.length + 1}\n0000000000 65535 f \n${stellen.map((s) => `${String(s).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objekte.length + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${laenge}\n%%EOF\n`;
    teile.push(Buffer.from(tafel, 'latin1'));
    return Buffer.concat(teile);
  }
}
