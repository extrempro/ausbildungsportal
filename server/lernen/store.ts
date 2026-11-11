// Übernommen aus dem FISI-Lernkompass (https://github.com/extrempro/fisi-lernkompass, MIT), dort server/content/.
// Das Inhaltsformat ist dasselbe – ein Inhaltspaket aus dem Lernkompass lässt sich unverändert einbinden.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { BILD_DATEI, ID_MUSTER, parseThemaMarkdown } from './parse';
import type { AblaufSzenario, Bild, KatalogEintrag, Meldung, Meta, Themenfeld, Zusatz } from './typen';

export interface Inhalte {
  themenfelder: Themenfeld[];
  meta: Meta;
  umbenennungen: Record<string, string>;
  meldungen: Meldung[];
}

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

function leseJson<T>(pfad: string, datei: string, meldungen: Meldung[]): T | null {
  if (!existsSync(pfad)) {
    meldungen.push({ level: 'fehler', datei, text: 'Datei fehlt' });
    return null;
  }
  try {
    return JSON.parse(readFileSync(pfad, 'utf8')) as T;
  } catch (e) {
    meldungen.push({ level: 'fehler', datei, text: `Ungültiges JSON: ${(e as Error).message}` });
    return null;
  }
}

/**
 * Liest alle Inhalte aus dem Inhaltsordner.
 * `vorher` ist der zuletzt gültige Stand: Hat eine Themen-Datei Fehler, wird – falls vorhanden –
 * ihre letzte gültige Fassung weiterverwendet.
 */
export function ladeInhalte(dir: string, vorher?: Inhalte | null): Inhalte {
  const meldungen: Meldung[] = [];

  const meta = leseJson<Meta>(join(dir, 'meta.json'), 'meta.json', meldungen) ?? { stand: '' };
  if (!meta.stand || !DATUM.test(meta.stand)) {
    meldungen.push({ level: 'fehler', datei: 'meta.json', text: '"stand" fehlt oder ist kein Datum im Format JJJJ-MM-TT' });
  }

  const katalog = leseJson<KatalogEintrag[]>(join(dir, 'themenfelder.json'), 'themenfelder.json', meldungen) ?? [];
  const umbenennungen =
    (existsSync(join(dir, 'umbenennungen.json'))
      ? leseJson<Record<string, string>>(join(dir, 'umbenennungen.json'), 'umbenennungen.json', meldungen)
      : {}) ?? {};

  const themenDir = join(dir, 'themen');
  const dateien = existsSync(themenDir) ? readdirSync(themenDir).filter((f) => f.endsWith('.md')) : [];
  const katalogIds = new Set<string>();

  const themenfelder: Themenfeld[] = [];
  for (const eintrag of katalog) {
    const datei = `themen/${eintrag.id}.md`;
    if (!eintrag.id || !ID_MUSTER.test(eintrag.id)) {
      meldungen.push({ level: 'fehler', datei: 'themenfelder.json', text: `Ungültige Themenfeld-ID "${eintrag.id}"` });
      continue;
    }
    if (katalogIds.has(eintrag.id)) {
      meldungen.push({ level: 'fehler', datei: 'themenfelder.json', text: `Themenfeld "${eintrag.id}" doppelt` });
      continue;
    }
    katalogIds.add(eintrag.id);

    const pfad = join(dir, datei);
    if (!existsSync(pfad)) {
      meldungen.push({ level: 'fehler', datei, text: 'Markdown-Datei zum Katalogeintrag fehlt' });
      const alt = vorher?.themenfelder.find((t) => t.id === eintrag.id);
      if (alt) themenfelder.push(alt);
      continue;
    }

    const { thema, meldungen: m } = parseThemaMarkdown(readFileSync(pfad, 'utf8'), datei);
    const zusatz = thema.zusatz.map((z) => ({
      ...ladeAblauf(dir, z, datei, m),
      zu: z.zu.map((ref) => (ref.includes('.') ? ref : `${eintrag.id}.${ref}`)),
    }));
    const bilder = new BildCache(dir, datei, m);
    for (const u of thema.unterthemen) for (const a of u.abbildungen) a.bilder.forEach((b) => bilder.fuelle(b));
    for (const z of zusatz) {
      for (const a of z.abschnitte) {
        a.bilder.forEach((b) => bilder.fuelle(b));
        for (const k of a.karten) if (k.bild) bilder.fuelle(k.bild);
      }
    }
    meldungen.push(...m);

    const feld: Themenfeld = {
      id: eintrag.id,
      titel: thema.titel || eintrag.id,
      icon: eintrag.icon || 'book-open',
      lernfelder: eintrag.lernfelder || [],
      pruefung: eintrag.pruefung || [],
      worum: thema.worum,
      unterthemen: thema.unterthemen,
      fehler: thema.fehler,
      links: thema.links,
      zusatz,
    };

    const hatFehler = m.some((x) => x.level === 'fehler');
    const alt = vorher?.themenfelder.find((t) => t.id === eintrag.id);
    themenfelder.push(hatFehler && alt ? alt : feld);
  }

  for (const f of dateien) {
    const id = f.replace(/\.md$/, '');
    if (!katalogIds.has(id)) {
      meldungen.push({ level: 'fehler', datei: `themen/${f}`, text: 'Kein Eintrag in themenfelder.json' });
    }
  }

  pruefeUmbenennungen(umbenennungen, themenfelder, meldungen);
  pruefeUngenutzteBilder(dir, themenfelder, meldungen);
  pruefeZuVerweise(themenfelder, meldungen);

  return { themenfelder, meta, umbenennungen, meldungen };
}

/**
 * Entfernt aus einer SVG alles Ausführbare: <script>, <foreignObject>, Event-Attribute (on…),
 * javascript:-Links und externe Verweise. Die Grafiken werden direkt ins HTML eingebettet,
 * damit sie die Farben von Hell- und Dunkelmodus übernehmen.
 */
export function bereinigeSvg(roh: string): string {
  let s = roh.replace(/^\uFEFF/, '');
  s = s.replace(/<\?xml[^>]*\?>/gi, '').replace(/<!DOCTYPE[^>]*>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<script[\s\S]*?<\/script\s*>/gi, '').replace(/<script[^>]*\/>/gi, '');
  s = s.replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, '');
  s = s.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  s = s.replace(/\s(?:xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, '');
  s = s.replace(/javascript:/gi, '');
  return s.trim();
}

class BildCache {
  private static cache = new Map<string, { mtime: number; svg: string }>();
  constructor(
    private dir: string,
    private datei: string,
    private meldungen: Meldung[],
  ) {}

  fuelle(b: Bild): void {
    const pfad = join(this.dir, 'bilder', b.datei);
    if (!existsSync(pfad)) {
      this.meldungen.push({ level: 'fehler', datei: this.datei, text: `Bild "bilder/${b.datei}" fehlt` });
      return;
    }
    const mtime = statSync(pfad).mtimeMs;
    const alt = BildCache.cache.get(pfad);
    if (alt && alt.mtime === mtime) {
      b.svg = alt.svg;
      return;
    }
    const svg = bereinigeSvg(readFileSync(pfad, 'utf8'));
    if (!/^<svg[\s>]/i.test(svg) || !/viewBox=/.test(svg)) {
      this.meldungen.push({
        level: 'fehler',
        datei: `bilder/${b.datei}`,
        text: 'Keine gültige SVG (muss mit <svg …> beginnen und eine viewBox haben)',
      });
      return;
    }
    BildCache.cache.set(pfad, { mtime, svg });
    b.svg = svg;
  }
}

/** "zu: …" im Zusatzwissen muss auf vorhandene Unterthemen zeigen. */
function pruefeZuVerweise(felder: Themenfeld[], meldungen: Meldung[]): void {
  const vorhanden = new Set(felder.flatMap((f) => f.unterthemen.map((u) => `${f.id}.${u.id}`)));
  for (const f of felder) {
    for (const z of f.zusatz) {
      for (const ref of z.zu) {
        if (!vorhanden.has(ref)) {
          meldungen.push({
            level: 'fehler',
            datei: `themen/${f.id}.md`,
            text: `Zusatz "${z.titel}": "zu: ${ref}" – dieses Unterthema gibt es nicht`,
          });
        }
      }
    }
  }
}

function pruefeUngenutzteBilder(dir: string, felder: Themenfeld[], meldungen: Meldung[]): void {
  const ordner = join(dir, 'bilder');
  if (!existsSync(ordner)) return;
  const genutzt = new Set<string>();
  for (const f of felder) {
    for (const u of f.unterthemen) for (const a of u.abbildungen) for (const b of a.bilder) genutzt.add(b.datei);
    for (const z of f.zusatz) {
      for (const a of z.abschnitte) {
        for (const b of a.bilder) genutzt.add(b.datei);
        for (const k of a.karten) if (k.bild) genutzt.add(k.bild.datei);
      }
    }
  }
  for (const d of readdirSync(ordner)) {
    if (!d.endsWith('.svg')) continue;
    if (!BILD_DATEI.test(d)) {
      meldungen.push({ level: 'fehler', datei: `bilder/${d}`, text: 'Dateiname ungültig (erlaubt: a–z, 0–9, -, Endung .svg)' });
    } else if (!genutzt.has(d)) {
      meldungen.push({ level: 'warnung', datei: `bilder/${d}`, text: 'Bild wird nirgends verwendet' });
    }
  }
}

function ladeAblauf(dir: string, z: Zusatz, datei: string, meldungen: Meldung[]): Zusatz {
  if (z.typ !== 'ablauf' || !z.ablaufDatei) return z;
  const rel = `zusatz/${z.ablaufDatei}`;
  const daten = leseJson<{ szenarien: AblaufSzenario[] }>(join(dir, rel), rel, meldungen);
  if (!daten) {
    meldungen.push({ level: 'fehler', datei, text: `Zusatz "${z.titel}": Ablauf-Datei ${rel} nicht lesbar` });
    return z;
  }
  const fehler = (text: string) => meldungen.push({ level: 'fehler', datei: rel, text });
  if (!Array.isArray(daten.szenarien) || !daten.szenarien.length) {
    fehler('"szenarien" fehlt oder ist leer');
    return z;
  }
  daten.szenarien.forEach((s, si) => {
    const wo = `Szenario ${si + 1} (${s.id || 'ohne id'})`;
    if (!s.id || !s.label) fehler(`${wo}: "id" und "label" sind Pflicht`);
    const n = Array.isArray(s.geraete) ? s.geraete.length : 0;
    if (n < 2) fehler(`${wo}: mindestens zwei Geräte nötig`);
    if (s.spalten !== undefined && (!Array.isArray(s.spalten) || s.spalten.length !== 3 || s.spalten.some((x) => typeof x !== 'string'))) {
      fehler(`${wo}: "spalten" muss genau drei Texte enthalten`);
    }
    const r = Array.isArray(s.regeln) ? s.regeln.length : 0;
    if (!Array.isArray(s.schritte) || !s.schritte.length) {
      fehler(`${wo}: keine Schritte`);
      return;
    }
    s.schritte.forEach((st, i) => {
      const w = `${wo}, Schritt ${i + 1}`;
      if (!st.titel || !st.text) fehler(`${w}: "titel" und "text" sind Pflicht`);
      if (!Array.isArray(st.aktiv) || st.aktiv.some((a) => !Number.isInteger(a) || a < 0 || a >= n)) {
        fehler(`${w}: "aktiv" verweist auf ein Gerät außerhalb 0–${n - 1}`);
      }
      if (typeof st.position !== 'number' || st.position < 0 || st.position > n - 1) {
        fehler(`${w}: "position" muss zwischen 0 und ${n - 1} liegen`);
      }
      if (st.regel !== undefined && (!Number.isInteger(st.regel) || st.regel < 0 || st.regel >= r)) {
        fehler(`${w}: "regel" verweist auf eine Regel außerhalb 0–${r - 1}`);
      }
      if (!Array.isArray(st.zeilen)) fehler(`${w}: "zeilen" fehlt`);
      else if (st.zeilen.some((z) => !Array.isArray(z) || z.length !== 4)) fehler(`${w}: jede Zeile in "zeilen" braucht vier Werte [Feld, Quelle, Ziel, hervorheben]`);
      if (st.ziele !== undefined && (!Array.isArray(st.ziele) || st.ziele.some((a) => !Number.isInteger(a) || a < 0 || a >= n))) {
        fehler(`${w}: "ziele" verweist auf ein Gerät außerhalb 0–${n - 1}`);
      }
      if (st.tabelle !== undefined) {
        const t = st.tabelle;
        if (!t || !t.titel || !Array.isArray(t.kopf) || !Array.isArray(t.zeilen)) fehler(`${w}: "tabelle" braucht titel, kopf und zeilen`);
        else {
          if (t.zeilen.some((z) => !Array.isArray(z) || z.length !== t.kopf.length)) fehler(`${w}: Tabelle "${t.titel}" – jede Zeile braucht ${t.kopf.length} Spalten`);
          if (t.neu !== undefined && (!Array.isArray(t.neu) || t.neu.some((x) => !Number.isInteger(x) || x < 0 || x >= t.zeilen.length))) {
            fehler(`${w}: Tabelle "${t.titel}" – "neu" verweist auf eine Zeile, die es nicht gibt`);
          }
        }
      }
    });
  });
  return { ...z, szenarien: daten.szenarien };
}

function pruefeUmbenennungen(map: Record<string, string>, felder: Themenfeld[], meldungen: Meldung[]): void {
  const vorhanden = new Set<string>();
  for (const f of felder) {
    for (const u of f.unterthemen) vorhanden.add(`${f.id}.${u.id}`);
    for (const z of f.zusatz) vorhanden.add(`${f.id}.${z.id}`);
  }
  for (const [alt, neu] of Object.entries(map)) {
    const wo = { level: 'fehler' as const, datei: 'umbenennungen.json' };
    if (!vorhanden.has(neu)) meldungen.push({ ...wo, text: `Ziel-ID "${neu}" (von "${alt}") existiert nicht` });
    if (neu in map) meldungen.push({ ...wo, text: `Kette oder Kreis: "${alt}" → "${neu}" → "${map[neu]}"` });
    if (alt === neu) meldungen.push({ ...wo, text: `"${alt}" verweist auf sich selbst` });
  }
}

/** Alle Lernstand-IDs mit Hash, z. B. "netzwerkgrundlagen.subnetting". */
export function unterthemaIndex(inhalte: Inhalte): Map<string, { hash: string; keinHinweis: boolean }> {
  const m = new Map<string, { hash: string; keinHinweis: boolean }>();
  for (const f of inhalte.themenfelder) {
    for (const u of f.unterthemen) m.set(`${f.id}.${u.id}`, { hash: u.hash, keinHinweis: u.keinHinweis });
  }
  return m;
}

export function zusatzIds(inhalte: Inhalte): Set<string> {
  const s = new Set<string>();
  for (const f of inhalte.themenfelder) for (const z of f.zusatz) s.add(`${f.id}.${z.id}`);
  return s;
}

export function inhaltsStand(inhalte: Inhalte) {
  let mitInhalt = 0;
  let geruest = 0;
  let befuellt = 0;
  for (const f of inhalte.themenfelder) {
    const n = f.unterthemen.filter((u) => u.hatInhalt).length;
    mitInhalt += n;
    geruest += f.unterthemen.length - n;
    if (n > 0) befuellt++;
  }
  return {
    stand: inhalte.meta.stand,
    themenfelder: inhalte.themenfelder.length,
    befuellt,
    unterthemenMitInhalt: mitInhalt,
    unterthemenGeruest: geruest,
  };
}
