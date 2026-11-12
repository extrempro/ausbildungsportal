import { Fehler, idAus } from './api-basis';
import type { Ctx, Route } from './api-basis';
import { eigenerAzubi, formVon, holeBericht, montagAus, sichtbar } from './berichte';
import type { DB } from './db';
import { gueltigesDatum, plusTage } from './kalender';
import { FACH, sichtbarerAzubi } from './stammdaten';

/**
 * Anhänge an Berichten: Fotos und Dateien zu dem, was der Azubi gemacht hat.
 *
 * - Hochladen und Entfernen kann nur der Azubi selbst, und nur solange der Bericht ein Entwurf ist oder zurückgegeben wurde.
 * - Sehen kann sie, wer den Bericht sehen darf – Entwürfe also nur der Azubi.
 * - Tagesform: ein Anhang gehört zu einem Tag. Wochenform: zum ganzen Bericht.
 * - Erlaubt sind Bilder, PDF und Office-Dateien ohne Makros. Entscheidend ist der Anfang der Datei, nicht nur ihre Endung.
 * - Im Ausdruck und im PDF des Berichtshefts erscheinen Anhänge nicht.
 */
export const MAX_ANHANG = 5 * 1024 * 1024;
export const MAX_ANHAENGE = 12;
export const MAX_ANHAENGE_GESAMT = 30 * 1024 * 1024;

export type AnhangArt = 'bild' | 'pdf' | 'office';

interface Dateityp {
  endungen: string[];
  typ: string;
  art: AnhangArt;
  /** im Browser als Bild anzeigbar (Vorschau) */
  vorschau?: boolean;
  passt: (b: Buffer) => boolean;
}

const beginnt = (b: Buffer, ...bytes: number[]) => b.length >= bytes.length && bytes.every((x, i) => b[i] === x);
const zip = (b: Buffer) => beginnt(b, 0x50, 0x4b, 0x03, 0x04);
const office = (endung: string, typ: string): Dateityp => ({ endungen: [endung], typ, art: 'office', passt: zip });

const TYPEN: Dateityp[] = [
  { endungen: ['jpg', 'jpeg'], typ: 'image/jpeg', art: 'bild', vorschau: true, passt: (b) => beginnt(b, 0xff, 0xd8, 0xff) },
  { endungen: ['png'], typ: 'image/png', art: 'bild', vorschau: true, passt: (b) => beginnt(b, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a) },
  { endungen: ['gif'], typ: 'image/gif', art: 'bild', vorschau: true, passt: (b) => b.subarray(0, 4).toString('latin1') === 'GIF8' },
  { endungen: ['webp'], typ: 'image/webp', art: 'bild', vorschau: true, passt: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
  // Fotos vom iPhone: kein Browser außer Safari zeigt sie an – deshalb nur zum Herunterladen
  { endungen: ['heic', 'heif'], typ: 'image/heic', art: 'bild', passt: (b) => b.subarray(4, 8).toString('latin1') === 'ftyp' },
  { endungen: ['pdf'], typ: 'application/pdf', art: 'pdf', passt: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  office('docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
  office('xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
  office('pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'),
  office('odt', 'application/vnd.oasis.opendocument.text'),
  office('ods', 'application/vnd.oasis.opendocument.spreadsheet'),
  office('odp', 'application/vnd.oasis.opendocument.presentation'),
];
export const ERLAUBTE_ENDUNGEN = TYPEN.flatMap((t) => t.endungen);
const ERLAUBT_TEXT = 'Erlaubt sind Bilder (JPG, PNG, GIF, WebP, HEIC), PDF und Office-Dateien (DOCX, XLSX, PPTX, ODT, ODS, ODP)';

/** Dateiname ohne Pfad und Steuerzeichen, höchstens 120 Zeichen – die Endung bleibt erhalten. */
export function sichererName(roh: string): string {
  const name = (roh.split(/[\\/]/).pop() ?? '').replace(/[\u0000-\u001f\u007f"<>|:*?]/g, '').replace(/\s+/g, ' ').trim().replace(/^\.+/, '');
  if (name.length <= 120) return name;
  const punkt = name.lastIndexOf('.');
  const endung = punkt > 0 ? name.slice(punkt) : '';
  return name.slice(0, 120 - endung.length).trim() + endung;
}

/** Erkennt den Dateityp an Endung UND Dateianfang; wirft mit einem Text, der dem Azubi weiterhilft. */
export function dateitypVon(name: string, daten: Buffer): Dateityp {
  const endung = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
  const typ = TYPEN.find((t) => t.endungen.includes(endung));
  if (!typ) {
    if (['doc', 'xls', 'ppt', 'docm', 'xlsm', 'pptm'].includes(endung)) throw new Fehler(400, `Dieses Office-Format kann Makros enthalten und ist deshalb nicht erlaubt. Speichere die Datei als ${endung[0] === 'd' ? 'DOCX' : endung[0] === 'x' ? 'XLSX' : 'PPTX'} oder als PDF.`);
    throw new Fehler(400, `Dieser Dateityp ist nicht erlaubt. ${ERLAUBT_TEXT}.`);
  }
  if (!typ.passt(daten)) throw new Fehler(400, `Die Datei ist kein gültiges ${endung.toUpperCase()} – ihr Inhalt passt nicht zur Endung.`);
  return typ;
}

export interface Anhang {
  id: number;
  /** Tag in der Tagesform, sonst null */
  tag: string | null;
  name: string;
  art: AnhangArt;
  /** lässt sich im Browser als Bild zeigen */
  vorschau: boolean;
  groesse: number;
}

interface Zeile {
  id: number;
  tag: string | null;
  name: string;
  typ: string;
  groesse: number;
}

const ausZeile = (z: Zeile): Anhang => {
  const t = TYPEN.find((x) => x.typ === z.typ);
  return { id: z.id, tag: z.tag, name: z.name, art: t?.art ?? 'office', vorschau: t?.vorschau === true, groesse: z.groesse };
};

/** Die Anhänge eines Berichts – ohne die Dateien selbst. Wer das aufruft, hat schon geprüft, dass der Bericht sichtbar ist. */
export function anhaengeVon(db: DB, azubiId: number, montag: string): Anhang[] {
  return (db.prepare('SELECT id, tag, name, typ, groesse FROM bericht_anhang WHERE azubi_id = ? AND montag = ? ORDER BY COALESCE(tag, montag), id').all(azubiId, montag) as unknown as Zeile[]).map(ausZeile);
}

/** Der Bericht, an dem der Azubi gerade schreiben darf – sonst der passende Fehler. */
function schreibbarerBericht(c: Ctx) {
  const azubi = eigenerAzubi(c);
  const montag = montagAus(c);
  const z = holeBericht(c.k.db, azubi.id, montag);
  if (!z) throw new Fehler(409, 'Bitte den Bericht zuerst speichern – dann lassen sich Anhänge hinzufügen');
  if (z.status !== 'entwurf' && z.status !== 'zurueck') throw new Fehler(409, z.status === 'abgezeichnet' ? 'Der Bericht ist abgezeichnet und gesperrt' : 'Der Bericht ist eingereicht – zum Ändern zuerst zurückziehen');
  return { azubi, montag, z };
}

export const ANHANG_ROUTEN: Route[] = [
  {
    // die Datei ist der Körper der Anfrage; Name und Tag stehen in der Adresse
    m: 'POST',
    p: '/api/azubis/:id/berichte/:montag/anhaenge',
    wer: ['azubi'],
    h: (c) => {
      const { db } = c.k;
      const { azubi, montag, z } = schreibbarerBericht(c);
      const daten = c.a.body;
      if (!Buffer.isBuffer(daten) || daten.length === 0) throw new Fehler(400, 'Es wurde keine Datei mitgeschickt');
      if (daten.length > MAX_ANHANG) throw new Fehler(413, `Die Datei ist zu groß (höchstens ${MAX_ANHANG / 1024 / 1024} MB)`);
      const name = sichererName(c.a.query.get('name') ?? '');
      if (!name) throw new Fehler(400, 'Der Dateiname fehlt');
      const typ = dateitypVon(name, daten);
      // Tagesform: der Anhang gehört zu einem Tag der Woche; Wochenform: zum ganzen Bericht
      const tagRoh = c.a.query.get('tag');
      let tag: string | null = null;
      if (formVon(z) === 'tag') {
        if (!gueltigesDatum(tagRoh) || tagRoh < montag || tagRoh > plusTage(montag, 6)) throw new Fehler(400, 'Der Tag muss in der Berichtswoche liegen');
        tag = tagRoh;
      } else if (tagRoh) throw new Fehler(400, 'Dieser Bericht hat keine Tage – der Anhang gehört zum ganzen Bericht');
      const stand = db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(groesse), 0) AS summe FROM bericht_anhang WHERE azubi_id = ? AND montag = ?').get(azubi.id, montag) as { n: number; summe: number };
      if (stand.n >= MAX_ANHAENGE) throw new Fehler(409, `Mehr als ${MAX_ANHAENGE} Anhänge je Bericht gehen nicht – entferne zuerst einen`);
      if (stand.summe + daten.length > MAX_ANHAENGE_GESAMT) throw new Fehler(409, `Die Anhänge dieses Berichts wären zusammen größer als ${MAX_ANHAENGE_GESAMT / 1024 / 1024} MB – entferne zuerst einen oder verkleinere die Datei`);
      db.prepare('INSERT INTO bericht_anhang (azubi_id, montag, tag, name, typ, groesse, erstellt, daten) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(azubi.id, montag, tag, name, typ.typ, daten.length, c.k.jetzt().toISOString(), daten);
      return { status: 201, body: { anhaenge: anhaengeVon(db, azubi.id, montag) } };
    },
  },
  {
    m: 'GET',
    p: '/api/azubis/:id/berichte/:montag/anhaenge/:anhang',
    wer: FACH,
    h: (c) => {
      const azubi = sichtbarerAzubi(c);
      const montag = montagAus(c);
      // wer den Bericht nicht sieht (Entwurf eines anderen), sieht auch seine Anhänge nicht
      if (!sichtbar(holeBericht(c.k.db, azubi.id, montag), c.b.rolle === 'azubi' && c.b.id === azubi.id)) throw new Fehler(404, 'Nicht gefunden');
      const z = c.k.db.prepare('SELECT name, typ, daten FROM bericht_anhang WHERE id = ? AND azubi_id = ? AND montag = ?').get(idAus(c.p.anhang), azubi.id, montag) as { name: string; typ: string; daten: Uint8Array } | undefined;
      if (!z) throw new Fehler(404, 'Nicht gefunden');
      const inhalt = Buffer.from(z.daten);
      // Bilder zeigt der Browser an; alles andere wird heruntergeladen und nie im Portal geöffnet
      return TYPEN.find((t) => t.typ === z.typ)?.vorschau ? { status: 200, bild: { typ: z.typ, inhalt } } : { status: 200, datei: { typ: z.typ, inhalt, dateiname: z.name } };
    },
  },
  {
    m: 'DELETE',
    p: '/api/azubis/:id/berichte/:montag/anhaenge/:anhang',
    wer: ['azubi'],
    h: (c) => {
      const { azubi, montag } = schreibbarerBericht(c);
      const r = c.k.db.prepare('DELETE FROM bericht_anhang WHERE id = ? AND azubi_id = ? AND montag = ?').run(idAus(c.p.anhang), azubi.id, montag);
      if (Number(r.changes) === 0) throw new Fehler(404, 'Nicht gefunden');
      return { status: 200, body: { anhaenge: anhaengeVon(c.k.db, azubi.id, montag) } };
    },
  },
];
