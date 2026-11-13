import type { Config } from './config';
import type { DB } from './db';
import type { Entra } from './entra';
import type { Mail } from './smtp';
import type { BenutzerZeile, Rolle } from './typen';

/**
 * Die gesamte API als Funktion Anfrage → Antwort, unabhängig vom Webserver.
 * Jede Route nennt in `wer`, wer sie aufrufen darf; geprüft wird das an genau einer Stelle (behandle).
 */
export interface Anfrage {
  methode: string;
  pfad: string;
  query: URLSearchParams;
  /** Header-Namen klein geschrieben */
  headers: Record<string, string | undefined>;
  cookies: Record<string, string>;
  body: unknown;
  ip: string;
}

export interface Antwort {
  status: number;
  body?: unknown;
  cookies?: string[];
  redirect?: string;
  /** statt JSON: Text mit eigenem Inhaltstyp (Kalender-Abo) */
  text?: { typ: string; inhalt: string; dateiname?: string };
  /** statt JSON: eine Datei zum Herunterladen (Berichtsheft als PDF) */
  datei?: { typ: string; inhalt: Buffer; dateiname: string };
  /** statt JSON: ein Bild zum Anzeigen (Profilbild); der Browser darf es kurz zwischenspeichern – die Adresse wechselt mit dem Bild */
  bild?: { typ: string; inhalt: Buffer };
  /** wann die Sitzung ohne weitere Anfrage endet – geht als Kopfzeile „X-Sitzung-Ende“ mit (ISO-Zeit, bei fester Grenze mit „;fest“) */
  sitzungEnde?: string;
}

export interface Kontext {
  db: DB;
  cfg: Config;
  entra: Entra | null;
  version: string;
  log: (text: string) => void;
  jetzt: () => Date;
  /** Hash eines Zufallspassworts – damit die Prüfung bei unbekanntem Konto gleich lange dauert */
  dummyHash: string;
  /** Anmeldeversuche je IP */
  versuche: Map<string, { anzahl: number; bis: number }>;
  /** Adressen, für die der Hinweis auf eine unpassende APP_URL schon im Log steht */
  gemeldeteHerkunft: Set<string>;
  /** schickt JSON an eine fremde Adresse (Teams-Webhook); in Tests ersetzt */
  sende: (url: string, body: unknown) => Promise<{ ok: boolean; status: number }>;
  /** schickt eine Mail über den eingerichteten Mailserver; wirft MailFehler. In Tests ersetzt */
  mail: (m: Mail) => Promise<void>;
}

export class Fehler extends Error {
  constructor(
    public status: number,
    text: string,
    public code = '',
  ) {
    super(text);
  }
}

export interface Ctx {
  k: Kontext;
  a: Anfrage;
  /** angemeldetes Konto; bei offenen Routen null */
  b: BenutzerZeile;
  token: string | undefined;
  p: Record<string, string>;
}

export interface Route {
  m: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  p: string;
  /** 'offen' = ohne Anmeldung, 'alle' = jedes angemeldete Konto, sonst die erlaubten Rollen */
  wer: 'offen' | 'alle' | Rolle[];
  /** auch erreichbar, solange der Passwortwechsel noch aussteht */
  trotzWechsel?: boolean;
  /**
   * Höchstzahl der Aufrufe je IP in 15 Minuten. Knapp bei der Passwort-Anmeldung (Raten erschweren),
   * großzügig bei der Microsoft-Anmeldung – dort teilen sich oft viele Nutzer eine IP.
   */
  begrenzt?: number;
  h: (c: Ctx) => Antwort | Promise<Antwort>;
}

// ---------- Hilfen für Routen ----------

export function istObjekt(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export function text(x: unknown, max: number, feld: string, pflicht = true): string {
  const s = typeof x === 'string' ? x.trim() : '';
  if (!s && pflicht) throw new Fehler(400, `${feld} fehlt`);
  if (s.length > max) throw new Fehler(400, `${feld} ist zu lang`);
  if (/[\u0000-\u001f\u007f]/.test(s)) throw new Fehler(400, `${feld} enthält unzulässige Zeichen`);
  return s;
}

export function koerper(c: Ctx): Record<string, unknown> {
  if (!istObjekt(c.a.body)) throw new Fehler(400, 'Anfrage ohne gültige Daten');
  return c.a.body;
}

export function idAus(s: string): number {
  return /^\d{1,12}$/.test(s) ? Number(s) : NaN;
}

export function datumOderNull(x: unknown, feld: string): string | null {
  if (x === null || x === undefined || x === '') return null;
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x) || Number.isNaN(Date.parse(`${x}T00:00:00Z`))) {
    throw new Fehler(400, `${feld} ist kein gültiges Datum`);
  }
  return x;
}

export function holeBenutzer(db: DB, id: number): BenutzerZeile | undefined {
  if (!Number.isInteger(id)) return undefined;
  return db.prepare('SELECT * FROM benutzer WHERE id = ?').get(id) as BenutzerZeile | undefined;
}
