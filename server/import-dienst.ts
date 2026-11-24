import { randomBytes } from 'node:crypto';
import { accessSync, closeSync, constants, existsSync, fstatSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Fehler } from './api-basis';
import type { Kontext } from './api-basis';
import { montagVon } from './kalender';

/**
 * Austausch mit dem Dienst „import“ (import/lesen.sh) über den Arbeitsordner data/import – gemeinsam für alle Importe
 * (Plan der Schule, alte Berichte). Je Auftrag ein Ordner mit zufälliger Kennung; darin u. a. `art`, `wer`,
 * `eingang.pdf` oder `eingang.txt` und zuletzt `auftrag`. Der Dienst schreibt `text.txt`, `ergebnis.json`, `fertig`
 * oder `fehler`, bei alten Berichten zusätzlich die einzelnen Seiten (`seite-1.pdf` …).
 * Aufträge gehören der Person, die sie angelegt hat, und werden nach 24 Stunden gelöscht – samt Datei und Text.
 */
export type ImportArt = 'schulplan' | 'berichtsheft';

export const MAX_PDF = 10 * 1024 * 1024;
const AUFBEWAHRUNG_MS = 24 * 3600_000;
/** so lange gilt das Lebenszeichen des Dienstes – ein großer Auftrag kann einige Minuten dauern */
const BEREIT_MS = 15 * 60_000;
export const AUFTRAG_ID = /^[0-9a-f]{32}$/;

export function importOrdner(k: Kontext): string {
  return join(k.cfg.dataDir, 'import');
}

/**
 * Beim Start: den Austauschordner selbst anlegen – sonst legt ihn Docker für den Dienst „import“ als root an,
 * und weder der Dienst noch die App dürfen dort schreiben. Gehört er schon root, steht im Log, was zu tun ist.
 */
export function bereiteImportOrdner(dataDir: string, warne: (text: string) => void = console.warn): void {
  const ordner = join(dataDir, 'import');
  try {
    mkdirSync(ordner, { recursive: true });
    accessSync(ordner, constants.W_OK);
  } catch {
    warne(`WARNUNG: In ${ordner} darf die App nicht schreiben – PDFs lesen (Dienst „import“) geht so nicht. Auf dem Server im Ordner des Portals: sudo chown -R 1000:1000 data/import`);
  }
}

export function dienstBereit(k: Kontext): boolean {
  try {
    return k.jetzt().getTime() - statSync(join(importOrdner(k), '.bereit')).mtimeMs < BEREIT_MS;
  } catch {
    return false;
  }
}

/**
 * Liest eine Datei, die der Dienst „import“ geschrieben hat – nur eine echte Datei, keinen Verweis (Symlink) und nur bis `max` Bytes.
 * Der Dienst verarbeitet fremde PDFs; wäre er übernommen, könnte er sonst über einen Verweis Dateien der App
 * (z. B. die Datenbank) in eine Vorschau schleusen. Sonst null.
 */
export function liesRoh(pfad: string, max = 8 * 1024 * 1024): Buffer | null {
  let fd: number | null = null;
  try {
    fd = openSync(pfad, constants.O_RDONLY | constants.O_NOFOLLOW);
    const s = fstatSync(fd);
    if (!s.isFile() || s.size > max) return null;
    return readFileSync(fd);
  } catch {
    return null;
  } finally {
    if (fd !== null) closeSync(fd);
  }
}

export function lies(pfad: string): string | null {
  return liesRoh(pfad)?.toString('utf8') ?? null;
}

/** Ordner eines Auftrags – nur ein echter Ordner, kein Verweis darauf */
function istOrdner(pfad: string): boolean {
  try {
    return lstatSync(pfad).isDirectory();
  } catch {
    return false;
  }
}

/** Alte Aufträge (älter als 24 Stunden) löschen – samt Datei und Text */
export function raeumeAuf(k: Kontext): void {
  const ordner = importOrdner(k);
  if (!existsSync(ordner)) return;
  for (const name of readdirSync(ordner)) {
    if (!AUFTRAG_ID.test(name)) continue;
    try {
      if (k.jetzt().getTime() - statSync(join(ordner, name)).mtimeMs > AUFBEWAHRUNG_MS) rmSync(join(ordner, name), { recursive: true, force: true });
    } catch {
      // schon weg
    }
  }
}

export interface Auftrag {
  id: string;
  ordner: string;
  wer: number;
}

/** Die Aufträge einer Person für eine Art – fremde Aufträge gibt es für sie nicht. */
export function eigeneAuftraege(k: Kontext, wer: number, art: ImportArt): Auftrag[] {
  const ordner = importOrdner(k);
  if (!existsSync(ordner)) return [];
  return readdirSync(ordner)
    .filter((n) => AUFTRAG_ID.test(n) && istOrdner(join(ordner, n)))
    .map((id) => ({ id, ordner: join(ordner, id), wer: Number(lies(join(ordner, id, 'wer'))), art: (lies(join(ordner, id, 'art')) ?? '').trim() }))
    .filter((a) => a.wer === wer && a.art === art)
    .map(({ id, ordner: o, wer: w }) => ({ id, ordner: o, wer: w }));
}

export function holeAuftrag(k: Kontext, wer: number, art: ImportArt, id: unknown): Auftrag {
  const s = String(id ?? '');
  const a = AUFTRAG_ID.test(s) ? eigeneAuftraege(k, wer, art).find((x) => x.id === s) : undefined;
  if (!a) throw new Fehler(404, 'Diesen Auftrag gibt es nicht (mehr)');
  return a;
}

export function loescheAuftrag(k: Kontext, wer: number, art: ImportArt, id: unknown): void {
  const s = typeof id === 'string' ? id : '';
  const a = AUFTRAG_ID.test(s) ? eigeneAuftraege(k, wer, art).find((x) => x.id === s) : undefined;
  if (a) rmSync(a.ordner, { recursive: true, force: true });
}

/** Prüft eine hochgeladene PDF – der Dienst muss laufen. */
export function pruefePdf(k: Kontext, pdf: Buffer, ohneDienst: string): void {
  if (pdf.length === 0 || pdf.length > MAX_PDF) throw new Fehler(400, 'Die PDF ist leer oder größer als 10 MB');
  if (!pdf.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Fehler(400, 'Das ist keine PDF-Datei');
  if (!dienstBereit(k)) throw new Fehler(409, ohneDienst);
}

/** Legt einen Auftrag an; `auftrag` kommt zuletzt, erst dann fängt der Dienst an. */
export function neuerAuftrag(k: Kontext, wer: number, art: ImportArt, eingang: { pdf: Buffer } | { text: string }, extra: Record<string, string> = {}, max = 3): string {
  if (eigeneAuftraege(k, wer, art).length >= max) throw new Fehler(409, 'Du hast schon mehrere Dateien in Arbeit. Übernimm oder verwirf erst eine.');
  const id = randomBytes(16).toString('hex');
  const d = join(importOrdner(k), id);
  mkdirSync(d, { recursive: true, mode: 0o700 });
  writeFileSync(join(d, 'wer'), String(wer));
  writeFileSync(join(d, 'art'), art);
  for (const [name, wert] of Object.entries(extra)) writeFileSync(join(d, name), wert);
  if ('pdf' in eingang) writeFileSync(join(d, 'eingang.pdf'), eingang.pdf);
  else writeFileSync(join(d, 'eingang.txt'), eingang.text);
  writeFileSync(join(d, 'auftrag'), '');
  return id;
}

export type Quelle = 'pdf' | 'texterkennung' | 'text';

/** Was der Dienst gemeldet hat: läuft noch, Fehler oder fertig (mit Quelle und ob das Sprachmodell etwas geliefert hat). */
export function standDes(k: Kontext, a: Auftrag):
  | { status: 'laeuft'; fortschritt: number; dienst: boolean }
  | { status: 'fehler'; fehler: string }
  | { status: 'fertig'; quelle: Quelle; modell: unknown; text: string } {
  const fehler = lies(join(a.ordner, 'fehler'));
  if (fehler) return { status: 'fehler', fehler: fehler.trim().slice(0, 200) };
  const fertig = lies(join(a.ordner, 'fertig'));
  if (!fertig) return { status: 'laeuft', fortschritt: Number(lies(join(a.ordner, 'fortschritt'))) || 0, dienst: dienstBereit(k) };
  const quelle: Quelle = /quelle=texterkennung/.test(fertig) ? 'texterkennung' : /quelle=pdf/.test(fertig) ? 'pdf' : 'text';
  let modell: unknown = null;
  if (/modell=ja/.test(fertig)) {
    try {
      modell = JSON.parse(lies(join(a.ordner, 'ergebnis.json')) ?? 'null');
    } catch {
      modell = null;
    }
  }
  return { status: 'fertig', quelle, modell, text: lies(join(a.ordner, 'text.txt')) ?? '' };
}

// ---------- gemeinsame Muster ----------

export const zweistellig = (j: string) => (j.length === 2 ? `20${j}` : j);

/** Montag der ISO-Kalenderwoche */
export function montagDerKw(jahr: number, kw: number): string {
  const vierter = new Date(Date.UTC(jahr, 0, 4));
  const montag1 = new Date(vierter.getTime() - ((vierter.getUTCDay() + 6) % 7) * 86_400_000);
  return new Date(montag1.getTime() + (kw - 1) * 7 * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Steht ein Datum so im Text? (Tag und Monat, mit oder ohne führende Null – oder die Kalenderwoche.)
 * Sprachmodelle erfinden gelegentlich Daten; was so nicht im Text steht, kommt nicht in die Vorschau.
 */
export function stehtImText(text: string, datum: string): boolean {
  const t = Number(datum.slice(8, 10));
  const m = Number(datum.slice(5, 7));
  if (new RegExp(`(^|\\D)0?${t}\\.\\s?0?${m}\\.`).test(text)) return true;
  // Kalenderwoche des Montags dieser Woche
  const montag = new Date(`${montagVon(datum)}T00:00:00Z`);
  const donnerstag = new Date(montag.getTime() + 3 * 86_400_000);
  const kw = Math.floor((donnerstag.getTime() - Date.UTC(donnerstag.getUTCFullYear(), 0, 1)) / 86_400_000 / 7) + 1;
  return new RegExp(`KW\\s*(\\d{1,2}\\s*(-|–|—|bis)\\s*)?0?${kw}(\\D|$)`, 'i').test(text) || new RegExp(`(KW|Kalenderwoche)\\s*0?${kw}(\\D|$)`, 'i').test(text);
}
