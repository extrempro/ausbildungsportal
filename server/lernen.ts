import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Fehler } from './api-basis';
import type { Ctx, Kontext, Route } from './api-basis';
import type { DB } from './db';
import { transaktion } from './db';
import { ladeInhalte, unterthemaIndex } from './lernen/store';
import type { Inhalte } from './lernen/store';
import type { BenutzerZeile } from './typen';

/**
 * Lernmodul: Lerninhalte (Cheatsheets) je Ausbildungsberuf mit eigenem Lernstand je Azubi.
 *
 * - Inhalte liegen als Dateien in LERN_DIR, ein Unterordner je Inhaltspaket – im Format des FISI-Lernkompass
 *   (themenfelder.json, themen/<id>.md, bilder/, meta.json). Ein Beruf schaltet ein Paket ein (beruf.lernpaket).
 * - Der Lernstand (Ampel, Lernpunkt, Notiz) ist privat: Nur der Azubi selbst liest und schreibt ihn. Für Ausbilder,
 *   Beauftragte und den Super-Admin gibt es keine Route, die ihn liefert – auch keine Zusammenfassung.
 */

export type Status = 'rot' | 'gelb' | 'gruen';
const STATI: Status[] = ['rot', 'gelb', 'gruen'];
const PAKET_ID = /^[a-z0-9][a-z0-9-]{0,30}$/;
const UNTERTHEMA_ID = /^[a-z0-9-]+\.[a-z0-9-]+$/;
const TEXT_MAX = 2000;
/** so oft wird höchstens nachgesehen, ob sich die Dateien geändert haben */
const PRUEF_ABSTAND_MS = 15_000;

export interface Paket {
  id: string;
  titel: string;
  /** Herkunft und Lizenz der Inhalte – aus paket.json, für den Hinweis unter den Inhalten */
  quelle: string;
  lizenz: string;
  inhalte: Inhalte;
  /** zum Erkennen von Änderungen */
  marke: string;
}

interface Lager {
  geprueft: number;
  pakete: Map<string, Paket>;
}
const LAGER = new Map<string, Lager>();

function marke(ordner: string): string {
  // meta.json wird bei jeder Inhaltspflege angefasst (Inhaltsstand); dazu die Themenliste
  return ['meta.json', 'themenfelder.json', 'paket.json', 'themen']
    .map((d) => {
      const p = join(ordner, d);
      return existsSync(p) ? statSync(p).mtimeMs : 0;
    })
    .join(':');
}

/** Alle Inhaltspakete aus LERN_DIR; liest neu ein, wenn sich Dateien geändert haben. */
export function lernpakete(k: Kontext): Map<string, Paket> {
  const dir = k.cfg.lernDir;
  let lager = LAGER.get(dir);
  const jetzt = Date.now();
  if (lager && jetzt - lager.geprueft < PRUEF_ABSTAND_MS) return lager.pakete;
  lager ??= { geprueft: 0, pakete: new Map() };
  lager.geprueft = jetzt;
  LAGER.set(dir, lager);

  const ordner = existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((e) => (e.isDirectory() || e.isSymbolicLink()) && PAKET_ID.test(e.name)) : [];
  const gefunden = new Set<string>();
  for (const e of ordner) {
    const pfad = join(dir, e.name);
    if (!existsSync(join(pfad, 'themenfelder.json'))) continue;
    gefunden.add(e.name);
    const m = marke(pfad);
    const alt = lager.pakete.get(e.name);
    if (alt && alt.marke === m) continue;
    let inhalte: Inhalte;
    try {
      inhalte = ladeInhalte(pfad, alt?.inhalte);
    } catch (f) {
      // z. B. Datei ohne Leserecht: als Fehler des Pakets zeigen statt die ganze Seite scheitern zu lassen
      inhalte = alt?.inhalte ?? { themenfelder: [], meta: { stand: '' }, umbenennungen: {}, meldungen: [] };
      inhalte = { ...inhalte, meldungen: [{ level: 'fehler', datei: e.name, text: `Inhalte nicht lesbar: ${(f as Error).message}` }] };
    }
    let info: { titel?: unknown; quelle?: unknown; lizenz?: unknown } = {};
    try {
      if (existsSync(join(pfad, 'paket.json'))) info = JSON.parse(readFileSync(join(pfad, 'paket.json'), 'utf8')) as typeof info;
    } catch (f) {
      k.log(`Lernpaket „${e.name}“: paket.json nicht lesbar – ${(f as Error).message}`);
    }
    const text = (x: unknown) => (typeof x === 'string' ? x.trim().slice(0, 200) : '');
    const paket: Paket = { id: e.name, titel: text(info.titel) || e.name, quelle: text(info.quelle), lizenz: text(info.lizenz), inhalte, marke: m };
    lager.pakete.set(e.name, paket);
    const fehler = inhalte.meldungen.filter((x) => x.level === 'fehler');
    k.log(`Lernpaket „${paket.titel}“ (${e.name}) geladen: ${inhalte.themenfelder.length} Themenfelder, Stand ${inhalte.meta.stand || 'unbekannt'}${fehler.length ? `, ${fehler.length} Fehler` : ''}`);
    for (const f of fehler.slice(0, 10)) k.log(`  ✖ ${f.datei}${f.zeile ? `:${f.zeile}` : ''}  ${f.text}`);
    uebernimmAenderungen(k.db, paket);
  }
  for (const id of [...lager.pakete.keys()]) if (!gefunden.has(id)) lager.pakete.delete(id);
  return lager.pakete;
}

/** Nur für Tests: vergisst den Zwischenspeicher. */
export function vergissLernpakete(): void {
  LAGER.clear();
}

/**
 * Nach dem Einlesen: Lernstand umbenannter Unterthemen mitnehmen (umbenennungen.json) und bei reinen
 * Korrekturen (<!-- kein-hinweis -->) den neuen Inhaltsstand stillschweigend übernehmen.
 */
function uebernimmAenderungen(db: DB, p: Paket): void {
  transaktion(db, () => {
    for (const [alt, neu] of Object.entries(p.inhalte.umbenennungen)) {
      db.prepare(
        `UPDATE lern_status SET unterthema_id = ?
          WHERE paket = ? AND unterthema_id = ?
            AND NOT EXISTS (SELECT 1 FROM lern_status n WHERE n.azubi_id = lern_status.azubi_id AND n.paket = lern_status.paket AND n.unterthema_id = ?)`,
      ).run(neu, p.id, alt, neu);
    }
    for (const [id, info] of unterthemaIndex(p.inhalte)) {
      if (info.keinHinweis) db.prepare('UPDATE lern_status SET inhalt_hash = ? WHERE paket = ? AND unterthema_id = ? AND inhalt_hash IS NOT NULL').run(info.hash, p.id, id);
    }
  });
}

/**
 * Häufigste Ursache für ein leeres Paket in einem Satz: Unterordner fehlen (ohne -r kopiert) oder sind nicht lesbar.
 */
function diagnose(k: Kontext, p: Paket): string | null {
  if (p.inhalte.themenfelder.length > 0) return null;
  const themen = join(k.cfg.lernDir, p.id, 'themen');
  if (!existsSync(themen) && existsSync(join(k.cfg.lernDir, p.id, 'content', 'themen'))) return `Die Inhalte liegen eine Ebene zu tief: im Unterordner „content“. Sie gehören direkt in lerninhalte/${p.id} (dort: cp -a content/. . und danach rm -r content).`;
  if (!existsSync(themen)) return 'Der Unterordner „themen“ fehlt oder ist für das Portal nicht lesbar. Wurde der Ordner mit seinen Unterordnern kopiert (cp -r bzw. scp -r)? Stimmen die Leserechte (chmod -R a+rX)?';
  try {
    if (readdirSync(themen).filter((f) => f.endsWith('.md')).length === 0) return 'Der Unterordner „themen“ ist leer – dort gehört je Themenfeld eine Datei .md hinein.';
  } catch {
    return 'Der Unterordner „themen“ lässt sich nicht lesen – bitte die Leserechte prüfen (chmod -R a+rX).';
  }
  return null;
}

/** Kurzangaben aller Pakete – für die Auswahl am Beruf (Stammdaten). */
export function paketListe(k: Kontext) {
  return [...lernpakete(k).values()]
    .map((p) => ({
      id: p.id,
      titel: p.titel,
      stand: p.inhalte.meta.stand,
      themenfelder: p.inhalte.themenfelder.length,
      unterthemen: p.inhalte.themenfelder.reduce((n, f) => n + f.unterthemen.length, 0),
      fehler: p.inhalte.meldungen.filter((m) => m.level === 'fehler').length,
      // die ersten Fehler im Klartext – damit man nicht erst ins Log sehen muss
      meldungen: [...(diagnose(k, p) ? [diagnose(k, p)!] : []), ...p.inhalte.meldungen.filter((m) => m.level === 'fehler').slice(0, 5).map((m) => `${m.datei}${m.zeile ? `:${m.zeile}` : ''} – ${m.text}`)],
    }))
    .sort((a, b) => a.titel.localeCompare(b.titel, 'de'));
}

/** Das Paket, das für diesen Azubi eingeschaltet ist (über seinen Ausbildungsberuf) – oder null. */
export function paketVon(k: Kontext, wer: Pick<BenutzerZeile, 'id' | 'rolle'>): Paket | null {
  if (wer.rolle !== 'azubi') return null;
  const z = k.db.prepare('SELECT b.lernpaket AS p FROM azubi_profil a JOIN beruf b ON b.id = a.beruf_id WHERE a.benutzer_id = ?').get(wer.id) as { p: string | null } | undefined;
  return z?.p ? (lernpakete(k).get(z.p) ?? null) : null;
}

interface StatusZeile {
  unterthema_id: string;
  status: Status;
  luecke: string;
  notiz: string;
  inhalt_hash: string | null;
  geaendert: string;
}

function standVon(db: DB, azubiId: number, paket: string): Map<string, StatusZeile> {
  const zeilen = db.prepare('SELECT unterthema_id, status, luecke, notiz, inhalt_hash, geaendert FROM lern_status WHERE azubi_id = ? AND paket = ?').all(azubiId, paket) as unknown as StatusZeile[];
  return new Map(zeilen.map((z) => [z.unterthema_id, z]));
}

function meinPaket(c: Ctx): Paket {
  const p = paketVon(c.k, c.b);
  if (!p) throw new Fehler(404, 'Für deinen Ausbildungsberuf ist kein Lernmodul eingeschaltet');
  return p;
}

const aktualisiert = (s: StatusZeile | undefined, hash: string) => !!s && s.status !== 'rot' && s.inhalt_hash !== null && s.inhalt_hash !== hash;

function paketKopf(p: Paket) {
  return { id: p.id, titel: p.titel, stand: p.inhalte.meta.stand, quelle: p.quelle, lizenz: p.lizenz };
}

export const LERN_ROUTEN: Route[] = [
  {
    // Übersicht: alle Themenfelder mit dem eigenen Stand je Unterthema – ohne die Inhalte selbst
    m: 'GET',
    p: '/api/lernen',
    wer: ['azubi'],
    h: (c) => {
      const p = meinPaket(c);
      const stand = standVon(c.k.db, c.b.id, p.id);
      return {
        status: 200,
        body: {
          paket: paketKopf(p),
          themenfelder: p.inhalte.themenfelder.map((f) => ({
            id: f.id,
            titel: f.titel,
            icon: f.icon,
            lernfelder: f.lernfelder,
            pruefung: f.pruefung,
            unterthemen: f.unterthemen.map((u) => {
              const s = stand.get(`${f.id}.${u.id}`);
              return { id: u.id, titel: u.titel, status: s?.status ?? 'rot', lernpunkt: !!s && s.status === 'gelb' && s.luecke.trim() !== '', inhaltAktualisiert: aktualisiert(s, u.hash) };
            }),
          })),
        },
      };
    },
  },

  {
    // Ein Themenfeld mit allen Inhalten (Cheatsheet) und dem eigenen Stand
    m: 'GET',
    p: '/api/lernen/thema/:id',
    wer: ['azubi'],
    h: (c) => {
      const p = meinPaket(c);
      const f = p.inhalte.themenfelder.find((x) => x.id === c.p.id);
      if (!f) throw new Fehler(404, 'Dieses Themenfeld gibt es nicht');
      const stand = standVon(c.k.db, c.b.id, p.id);
      return {
        status: 200,
        body: {
          paket: paketKopf(p),
          thema: {
            id: f.id,
            titel: f.titel,
            icon: f.icon,
            lernfelder: f.lernfelder,
            pruefung: f.pruefung,
            worum: f.worum,
            fehler: f.fehler,
            links: f.links,
            unterthemen: f.unterthemen.map((u) => {
              const s = stand.get(`${f.id}.${u.id}`);
              const { hash: _hash, keinHinweis: _k, ...inhalt } = u;
              return { ...inhalt, status: s?.status ?? 'rot', luecke: s?.luecke ?? '', notiz: s?.notiz ?? '', geaendert: s?.geaendert ?? null, inhaltAktualisiert: aktualisiert(s, u.hash) };
            }),
          },
        },
      };
    },
  },

  {
    // Eigenen Stand zu einem Unterthema ändern: Ampel, Lernpunkt, Notiz; „bestaetigen“ nimmt den Hinweis „Inhalt aktualisiert“ weg
    m: 'PATCH',
    p: '/api/lernen/unterthema/:id',
    wer: ['azubi'],
    h: (c) => {
      const p = meinPaket(c);
      const id = c.p.id;
      const info = UNTERTHEMA_ID.test(id) ? unterthemaIndex(p.inhalte).get(id) : undefined;
      if (!info) throw new Fehler(404, 'Dieses Unterthema gibt es nicht');
      const roh = c.a.body && typeof c.a.body === 'object' ? (c.a.body as Record<string, unknown>) : {};
      const text = (x: unknown, feld: string) => {
        if (typeof x !== 'string') throw new Fehler(400, `${feld} muss Text sein`);
        if (x.length > TEXT_MAX) throw new Fehler(400, `${feld} ist zu lang (höchstens ${TEXT_MAX} Zeichen)`);
        return x.trim();
      };
      const { db } = c.k;
      const alt = db.prepare('SELECT unterthema_id, status, luecke, notiz, inhalt_hash, geaendert FROM lern_status WHERE azubi_id = ? AND paket = ? AND unterthema_id = ?').get(c.b.id, p.id, id) as StatusZeile | undefined;
      const neu: StatusZeile = alt ? { ...alt } : { unterthema_id: id, status: 'rot', luecke: '', notiz: '', inhalt_hash: null, geaendert: '' };
      let geaendert = false;
      if (roh.status !== undefined) {
        if (!STATI.includes(roh.status as Status)) throw new Fehler(400, 'Unbekannter Status');
        neu.status = roh.status as Status;
        neu.inhalt_hash = info.hash; // wer den Stand setzt, hat den aktuellen Inhalt vor sich
        geaendert = true;
      }
      if (roh.luecke !== undefined) {
        neu.luecke = text(roh.luecke, 'Der Lernpunkt');
        geaendert = true;
      }
      if (roh.notiz !== undefined) {
        neu.notiz = text(roh.notiz, 'Die Notiz');
        geaendert = true;
      }
      if (roh.bestaetigen === true) {
        neu.inhalt_hash = info.hash;
        geaendert = true;
      }
      if (!geaendert) throw new Fehler(400, 'Nichts zu ändern');
      neu.geaendert = c.k.jetzt().toISOString().slice(0, 10);
      db.prepare(
        `INSERT INTO lern_status (azubi_id, paket, unterthema_id, status, luecke, notiz, inhalt_hash, geaendert) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(azubi_id, paket, unterthema_id) DO UPDATE SET status = excluded.status, luecke = excluded.luecke, notiz = excluded.notiz, inhalt_hash = excluded.inhalt_hash, geaendert = excluded.geaendert`,
      ).run(c.b.id, p.id, id, neu.status, neu.luecke, neu.notiz, neu.inhalt_hash, neu.geaendert);
      return { status: 200, body: { id, status: neu.status, luecke: neu.luecke, notiz: neu.notiz, geaendert: neu.geaendert, inhaltAktualisiert: false } };
    },
  },
];
