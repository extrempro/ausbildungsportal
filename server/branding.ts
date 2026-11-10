import { Fehler, koerper } from './api-basis';
import type { Route } from './api-basis';
import type { DB } from './db';
import { protokolliere } from './protokoll';

/**
 * Erscheinungsbild: das Logo des Betriebs, das der Super-Admin hinterlegt – je eines für die helle und die dunkle Darstellung.
 * Fehlt das dunkle, wird auch dort das helle gezeigt.
 * Es steht in der Kopfzeile und auf der Anmeldeseite – deshalb ist das Lesen ohne Anmeldung möglich.
 * Gespeichert wird es als Data-URL in den Einstellungen (klein genug, kein Dateisystem nötig).
 */
const SCHLUESSEL = { hell: 'branding_logo', dunkel: 'branding_logo_dunkel' } as const;
type Schema = keyof typeof SCHLUESSEL;

function schemaAus(x: unknown): Schema {
  if (x === undefined || x === null || x === '' || x === 'hell') return 'hell';
  if (x === 'dunkel') return 'dunkel';
  throw new Fehler(400, 'Unbekannte Darstellung – erlaubt sind hell und dunkel');
}
export const MAX_LOGO = 150 * 1024;

/** Nur Rasterbilder – kein SVG, das Skripte oder fremde Inhalte enthalten könnte. Geprüft wird der Dateianfang, nicht die Angabe des Browsers. */
function bildTyp(b: Buffer): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

export function leseLogo(db: DB, schema: Schema = 'hell'): string | null {
  return (db.prepare('SELECT wert FROM einstellungen WHERE schluessel = ?').get(SCHLUESSEL[schema]) as { wert: string } | undefined)?.wert ?? null;
}

function beide(db: DB) {
  return { logo: leseLogo(db, 'hell'), logoDunkel: leseLogo(db, 'dunkel') };
}

export const BRANDING_ROUTEN: Route[] = [
  {
    m: 'GET',
    p: '/api/branding',
    wer: 'offen',
    h: (c) => ({ status: 200, body: beide(c.k.db) }),
  },
  {
    m: 'PUT',
    p: '/api/branding/logo',
    wer: ['admin'],
    h: (c) => {
      const schema = schemaAus(koerper(c).schema);
      const roh = koerper(c).daten;
      const m = typeof roh === 'string' ? /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(roh) : null;
      if (!m) throw new Fehler(400, 'Bitte ein Bild im Format PNG, JPEG oder WebP wählen');
      const bild = Buffer.from(m[1], 'base64');
      if (bild.length > MAX_LOGO) throw new Fehler(400, `Das Logo ist zu groß (höchstens ${MAX_LOGO / 1024} KB)`);
      const typ = bildTyp(bild);
      if (!typ) throw new Fehler(400, 'Die Datei ist kein gültiges PNG-, JPEG- oder WebP-Bild');
      const logo = `data:${typ};base64,${bild.toString('base64')}`;
      c.k.db.prepare('INSERT INTO einstellungen (schluessel, wert) VALUES (?, ?) ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert').run(SCHLUESSEL[schema], logo);
      protokolliere(c.k.db, c.k.jetzt(), 'konto', 'logo_geaendert', c.b, null, schema === 'dunkel' ? 'dunkle Darstellung' : 'helle Darstellung');
      return { status: 200, body: beide(c.k.db) };
    },
  },
  {
    m: 'DELETE',
    p: '/api/branding/logo',
    wer: ['admin'],
    h: (c) => {
      const schema = schemaAus(c.a.query.get('schema'));
      c.k.db.prepare('DELETE FROM einstellungen WHERE schluessel = ?').run(SCHLUESSEL[schema]);
      protokolliere(c.k.db, c.k.jetzt(), 'konto', 'logo_entfernt', c.b, null, schema === 'dunkel' ? 'dunkle Darstellung' : 'helle Darstellung');
      return { status: 200, body: beide(c.k.db) };
    },
  },
];
