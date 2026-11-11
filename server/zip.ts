import { deflateRawSync, inflateRawSync } from 'node:zlib';

/**
 * Liest eine ZIP-Datei – ohne fremde Bibliothek, nur so viel wie das Portal braucht (eingereichte Lerninhalte).
 * Vorsicht ist hier wichtiger als Vollständigkeit:
 * - feste Obergrenzen für Zahl und Größe der Dateien; entpackt wird nie mehr, als das Verzeichnis ankündigt
 * - keine verschlüsselten Archive, kein ZIP64, nur „gespeichert“ und „deflate“
 * - Namen mit „..“, absolutem Pfad oder Steuerzeichen werden abgelehnt; Verweise (Symlinks) gibt es nach dem Lesen nicht mehr,
 *   weil nur Inhalte zurückgegeben werden
 */
export interface ZipDatei {
  /** Pfad im Archiv mit „/“ */
  name: string;
  daten: Buffer;
}
export interface ZipGrenzen {
  maxDateien: number;
  /** größte einzelne Datei, entpackt */
  maxDatei: number;
  /** alle Dateien zusammen, entpackt */
  maxGesamt: number;
}
export class ZipFehler extends Error {}

const ENDE = 0x06054b50;
const EINTRAG = 0x02014b50;
const LOKAL = 0x04034b50;

export function leseZip(buf: Buffer, g: ZipGrenzen): ZipDatei[] {
  if (buf.length < 22 || buf.readUInt32LE(0) !== LOKAL) throw new ZipFehler('Das ist keine ZIP-Datei');
  // das Ende-Verzeichnis steht am Schluss, davor höchstens ein Kommentar von 65 535 Bytes
  let ende = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === ENDE) {
      ende = i;
      break;
    }
  }
  if (ende < 0) throw new ZipFehler('Die ZIP-Datei ist unvollständig oder beschädigt');
  const anzahl = buf.readUInt16LE(ende + 10);
  const groesse = buf.readUInt32LE(ende + 12);
  const start = buf.readUInt32LE(ende + 16);
  if (anzahl === 0xffff || start === 0xffffffff) throw new ZipFehler('Dieses ZIP-Format (ZIP64) wird nicht unterstützt');
  if (anzahl > g.maxDateien * 3) throw new ZipFehler(`Die ZIP-Datei enthält zu viele Einträge (höchstens ${g.maxDateien} Dateien)`);
  if (start + groesse > buf.length) throw new ZipFehler('Die ZIP-Datei ist beschädigt');

  const dateien: ZipDatei[] = [];
  let gesamt = 0;
  let p = start;
  for (let n = 0; n < anzahl; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== EINTRAG) throw new ZipFehler('Die ZIP-Datei ist beschädigt');
    const schalter = buf.readUInt16LE(p + 8);
    const verfahren = buf.readUInt16LE(p + 10);
    const gepackt = buf.readUInt32LE(p + 20);
    const entpackt = buf.readUInt32LE(p + 24);
    const nameLaenge = buf.readUInt16LE(p + 28);
    const extraLaenge = buf.readUInt16LE(p + 30);
    const kommentarLaenge = buf.readUInt16LE(p + 32);
    const lokal = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLaenge).toString('utf8').replace(/\\/g, '/');
    p += 46 + nameLaenge + extraLaenge + kommentarLaenge;

    if (name.endsWith('/')) continue; // Ordner
    if (schalter & 1) throw new ZipFehler('Die ZIP-Datei ist mit einem Passwort geschützt');
    if (gepackt === 0xffffffff || entpackt === 0xffffffff || lokal === 0xffffffff) throw new ZipFehler('Dieses ZIP-Format (ZIP64) wird nicht unterstützt');
    // eslint-disable-next-line no-control-regex
    if (!name || name.startsWith('/') || /^[A-Za-z]:/.test(name) || name.split('/').some((t) => t === '..' || t === '.' || t === '') || /[\x00-\x1f\x7f]/.test(name)) throw new ZipFehler(`Unzulässiger Dateiname im Archiv: ${name.slice(0, 80)}`);
    if (name.startsWith('__MACOSX/') || name.split('/').at(-1) === '.DS_Store' || name.split('/').at(-1) === 'Thumbs.db') continue;
    if (verfahren !== 0 && verfahren !== 8) throw new ZipFehler(`„${name.slice(0, 80)}“ ist mit einem nicht unterstützten Verfahren gepackt`);
    if (entpackt > g.maxDatei) throw new ZipFehler(`„${name.slice(0, 80)}“ ist zu groß (höchstens ${Math.round(g.maxDatei / 1024 / 1024)} MB je Datei)`);
    gesamt += entpackt;
    if (gesamt > g.maxGesamt) throw new ZipFehler(`Der Inhalt ist entpackt zu groß (höchstens ${Math.round(g.maxGesamt / 1024 / 1024)} MB)`);
    if (dateien.length >= g.maxDateien) throw new ZipFehler(`Die ZIP-Datei enthält zu viele Dateien (höchstens ${g.maxDateien})`);

    if (lokal + 30 > buf.length || buf.readUInt32LE(lokal) !== LOKAL) throw new ZipFehler('Die ZIP-Datei ist beschädigt');
    const anfang = lokal + 30 + buf.readUInt16LE(lokal + 26) + buf.readUInt16LE(lokal + 28);
    if (anfang + gepackt > buf.length) throw new ZipFehler('Die ZIP-Datei ist beschädigt');
    const roh = buf.subarray(anfang, anfang + gepackt);
    let daten: Buffer;
    try {
      // nie mehr entpacken als angekündigt – schützt vor Archiven, die sich riesig aufblähen
      daten = verfahren === 0 ? Buffer.from(roh) : inflateRawSync(roh, { maxOutputLength: Math.max(1, entpackt) });
    } catch {
      throw new ZipFehler(`„${name.slice(0, 80)}“ lässt sich nicht entpacken`);
    }
    if (daten.length !== entpackt) throw new ZipFehler(`„${name.slice(0, 80)}“ ist beschädigt`);
    dateien.push({ name, daten });
  }
  return dateien;
}

/** Baut eine ZIP-Datei (auf Wunsch gepackt) – für Tests und kleine Beispiele. */
export function baueZip(dateien: { name: string; daten: Buffer | string }[], packen = false): Buffer {
  const lokalTeile: Buffer[] = [];
  const verzeichnis: Buffer[] = [];
  let versatz = 0;
  for (const d of dateien) {
    const klar = typeof d.daten === 'string' ? Buffer.from(d.daten, 'utf8') : d.daten;
    const daten = packen ? deflateRawSync(klar) : klar;
    const name = Buffer.from(d.name, 'utf8');
    const crc = crc32(klar);
    const lokal = Buffer.alloc(30);
    lokal.writeUInt32LE(LOKAL, 0);
    lokal.writeUInt16LE(20, 4);
    lokal.writeUInt16LE(0x0800, 6); // Namen in UTF-8
    lokal.writeUInt16LE(packen ? 8 : 0, 8);
    lokal.writeUInt32LE(crc, 14);
    lokal.writeUInt32LE(daten.length, 18);
    lokal.writeUInt32LE(klar.length, 22);
    lokal.writeUInt16LE(name.length, 26);
    const eintrag = Buffer.alloc(46);
    eintrag.writeUInt32LE(EINTRAG, 0);
    eintrag.writeUInt16LE(20, 4);
    eintrag.writeUInt16LE(20, 6);
    eintrag.writeUInt16LE(0x0800, 8);
    eintrag.writeUInt16LE(packen ? 8 : 0, 10);
    eintrag.writeUInt32LE(crc, 16);
    eintrag.writeUInt32LE(daten.length, 20);
    eintrag.writeUInt32LE(klar.length, 24);
    eintrag.writeUInt16LE(name.length, 28);
    eintrag.writeUInt32LE(versatz, 42);
    lokalTeile.push(lokal, name, daten);
    verzeichnis.push(eintrag, name);
    versatz += 30 + name.length + daten.length;
  }
  const vz = Buffer.concat(verzeichnis);
  const ende = Buffer.alloc(22);
  ende.writeUInt32LE(ENDE, 0);
  ende.writeUInt16LE(dateien.length, 8);
  ende.writeUInt16LE(dateien.length, 10);
  ende.writeUInt32LE(vz.length, 12);
  ende.writeUInt32LE(versatz, 16);
  return Buffer.concat([...lokalTeile, vz, ende]);
}

let tabelle: Uint32Array | null = null;
function crc32(b: Buffer): number {
  if (!tabelle) {
    tabelle = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tabelle[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const x of b) c = tabelle[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
