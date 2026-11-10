import { behandle, cookieName } from '../api';
import type { Anfrage, Antwort, Kontext } from '../api';
import { loadConfig } from '../config';
import type { Config } from '../config';
import { migrate } from '../db';
import type { DB } from '../db';
import type { Entra } from '../entra';
import { beginneSitzung } from '../sitzung';
import { DatabaseSync } from '../sqlite';
import { erzeugeKontext } from '../start';
import type { BenutzerZeile, Rolle } from '../typen';

export const APP = 'https://portal.test';

export async function neueDb(): Promise<DB> {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  await migrate(db, null, undefined, () => {});
  return db;
}

export interface Umgebung {
  db: DB;
  k: Kontext;
  cfg: Config;
  uhr: { jetzt: Date };
  logs: string[];
}

export async function umgebung(env: Record<string, string> = {}, entra: Entra | null = null): Promise<Umgebung> {
  const db = await neueDb();
  const cfg = loadConfig({ APP_URL: APP, ADMIN_BENUTZER: 'chef', ADMIN_PASSWORT: 'Start-Passwort-2026!', ...env }, []);
  const uhr = { jetzt: new Date('2026-11-10T09:00:00Z') };
  const logs: string[] = [];
  const k = await erzeugeKontext(db, cfg, { log: (t) => logs.push(t), jetzt: () => uhr.jetzt, entra });
  return { db, k, cfg, uhr, logs };
}

let zaehler = 0;

/** Legt ein Entra-Konto direkt in der Datenbank an. */
export function konto(db: DB, rolle: Exclude<Rolle, 'admin'>, name = ''): BenutzerZeile {
  zaehler++;
  const anzeigename = name || `${rolle} ${zaehler}`;
  const r = db
    .prepare("INSERT INTO benutzer (anmeldung, anmeldename, entra_oid, anzeigename, rolle, erstellt) VALUES ('entra', ?, ?, ?, ?, ?)")
    .run(`${rolle}${zaehler}@firma.test`, `oid-${zaehler}`, anzeigename, rolle, '2026-01-01T00:00:00.000Z');
  return db.prepare('SELECT * FROM benutzer WHERE id = ?').get(Number(r.lastInsertRowid)) as unknown as BenutzerZeile;
}

export function admin(db: DB): BenutzerZeile {
  return db.prepare("SELECT * FROM benutzer WHERE rolle = 'admin' ORDER BY id").get() as unknown as BenutzerZeile;
}

/** Erledigt den erzwungenen Passwortwechsel direkt in der Datenbank. */
export function ohneWechsel(db: DB, id: number): void {
  db.prepare('UPDATE benutzer SET passwort_wechsel = 0 WHERE id = ?').run(id);
}

export function sitzung(u: Umgebung, b: BenutzerZeile): Record<string, string> {
  return { [cookieName(u.cfg, 'sitzung')]: beginneSitzung(u.db, b.id, u.uhr.jetzt) };
}

export function zuweisen(db: DB, azubi: BenutzerZeile, beauftragter: BenutzerZeile, von: string | null = null, bis: string | null = null): void {
  db.prepare('INSERT INTO zuweisung (azubi_id, beauftragter_id, von, bis) VALUES (?, ?, ?, ?)').run(azubi.id, beauftragter.id, von, bis);
}

export function ruf(
  u: Umgebung,
  methode: string,
  ziel: string,
  o: { cookies?: Record<string, string>; body?: unknown; origin?: string | null; ip?: string } = {},
): Promise<Antwort> {
  const url = new URL(ziel, APP);
  const headers: Record<string, string | undefined> = {};
  if (o.origin !== null && methode !== 'GET') headers.origin = o.origin ?? APP;
  const a: Anfrage = { methode, pfad: url.pathname, query: url.searchParams, headers, cookies: o.cookies ?? {}, body: o.body, ip: o.ip ?? '10.0.0.1' };
  return behandle(u.k, a);
}

/** Liest Cookies aus einer Antwort (Name → Wert); gelöschte Cookies haben einen leeren Wert. */
export function cookiesAus(a: Antwort): Record<string, string> {
  const r: Record<string, string> = {};
  for (const c of a.cookies ?? []) {
    const [paar] = c.split(';');
    const i = paar.indexOf('=');
    r[paar.slice(0, i)] = paar.slice(i + 1);
  }
  return r;
}

export function koerper(a: Antwort): Record<string, any> {
  return (a.body ?? {}) as Record<string, any>;
}
