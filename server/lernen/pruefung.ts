import { existsSync, openSync, readdirSync, readFileSync, readSync, closeSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { absaetze, frontmatter, ID_MUSTER, listenpunkte, parseTabelle, trenneId, zerlege } from './parse';
import type { Abschnitt, Zeile } from './parse';
import type { Meldung, Tabelle } from './typen';

/**
 * Prüfungsvorbereitung im Lernmodul: Übungssätze mit ausgewerteten Fragen (pruefung/<id>.md)
 * und Unterlagen als PDF (dokumente.json, dokumente/<datei>.pdf).
 *
 * Eine Frage hat genau eine Antwortart:
 * - Auswahl: eine oder mehrere richtige Antworten (`- [x] …` / `- [ ] …`)
 * - Zahl: ein oder mehrere Felder mit Toleranz (`- Beschriftung: 4,35 ± 0,03 A`)
 * - Zuordnung: Paare (`- links → rechts`), rechts dürfen sich Antworten wiederholen
 * Bewertet wird nur auf dem Server; die Lösungen gehen erst mit dem Ergebnis an den Azubi.
 */

export type Antwortart = 'auswahl' | 'zahl' | 'zuordnung';

export interface ZahlFeld {
  text: string;
  wert: number;
  toleranz: number;
  einheit: string;
}

export interface PruefFrage {
  /** eindeutig im Paket: 'satz.frage' */
  schluessel: string;
  id: string;
  titel: string;
  quelle: string;
  /** Unterthemen zum Nachlesen ('themenfeld.unterthema') */
  zu: string[];
  absaetze: string[];
  punkte: string[];
  tabelle: Tabelle | null;
  art: Antwortart;
  optionen: { text: string; richtig: boolean }[];
  mehrfach: boolean;
  felder: ZahlFeld[];
  paare: { links: string; rechts: string }[];
  loesung: { absaetze: string[]; schritte: string[] };
}

export interface Uebungssatz {
  id: string;
  titel: string;
  gruppe: string;
  beschreibung: string;
  /** Probetest: fasst die Fragen dieser Übungssätze zusammen */
  umfasst: string[];
  fragen: PruefFrage[];
}

export interface Dokument {
  datei: string;
  titel: string;
  gruppe: string;
  /** nur für Ausbilder und Beauftragte, z. B. Lösungen */
  nurBetreuung: boolean;
  groesse: number;
}

export const DOKUMENT_DATEI = /^[a-z0-9][a-z0-9._-]{0,80}\.pdf$/;
const ZAHL = String.raw`-?\d{1,3}(?:\.\d{3})+(?:,\d+)?|-?\d+(?:,\d+)?`;
const ZAHL_ZEILE = new RegExp(String.raw`^(?:(.+?):\s*)?(${ZAHL})\s*(?:±\s*(${ZAHL}))?\s*(.*)$`);
const ZUORDNUNG = /^(.+?)\s*(?:→|->)\s*(.+)$/;
const AUSWAHL = /^\[( |x|X)\]\s+(.+)$/;

/** Zahl in deutscher Schreibweise: Punkt trennt Tausender, Komma die Dezimalstellen („4.168,8“). */
const zahl = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));

function parseFrage(satz: string, id: string, titel: string, a: Abschnitt, fehler: (t: string, z?: number) => void): PruefFrage | null {
  const f: PruefFrage = { schluessel: `${satz}.${id}`, id, titel, quelle: '', zu: [], absaetze: [], punkte: [], tabelle: null, art: 'auswahl', optionen: [], mehrfach: false, felder: [], paare: [], loesung: { absaetze: [], schritte: [] } };
  const { vorher, abschnitte } = zerlege(a.zeilen, '### ');
  const text: Zeile[] = [];
  const tabelle: Zeile[] = [];
  for (const z of vorher) {
    const t = z.text.trim();
    const quelle = /^quelle:\s*(.+)$/.exec(t);
    const zu = /^zu:\s*(.+)$/.exec(t);
    if (quelle) f.quelle = quelle[1].trim();
    else if (zu) {
      for (const ref of zu[1].split(',').map((x) => x.trim()).filter(Boolean)) {
        if (!/^[a-z0-9-]+\.[a-z0-9-]+$/.test(ref)) fehler(`"zu: ${ref}" braucht die Form themenfeld.unterthema`, z.nr);
        else f.zu.push(ref);
      }
    } else if (t.startsWith('|')) tabelle.push(z);
    else text.push(z);
  }
  f.punkte = listenpunkte(text).map((p) => p.text);
  f.absaetze = absaetze(text.filter((z) => !/^\s*[-*]\s+/.test(z.text) && !/^\s{2,}\S/.test(z.text)));
  if (tabelle.length) f.tabelle = parseTabelle(titel, { ueberschrift: titel, nr: a.nr, zeilen: tabelle }, fehler);
  if (!f.absaetze.length) fehler(`Frage "${titel}" ohne Fragetext`, a.nr);

  let antwort = 0;
  for (const s of abschnitte) {
    const name = s.ueberschrift;
    if (name === 'Auswahl' || name === 'Zahl' || name === 'Zuordnung') {
      antwort++;
      const punkte = listenpunkte(s.zeilen);
      if (name === 'Auswahl') {
        f.art = 'auswahl';
        for (const p of punkte) {
          const m = AUSWAHL.exec(p.text);
          if (!m) fehler('Auswahl nicht im Format "- [x] richtig" oder "- [ ] falsch"', p.nr);
          else f.optionen.push({ text: m[2].trim(), richtig: m[1] !== ' ' });
        }
        const richtig = f.optionen.filter((o) => o.richtig).length;
        if (f.optionen.length < 2) fehler(`Frage "${titel}": Auswahl braucht mindestens zwei Antworten`, s.nr);
        if (richtig === 0) fehler(`Frage "${titel}": keine Antwort mit [x] als richtig markiert`, s.nr);
        if (new Set(f.optionen.map((o) => o.text)).size !== f.optionen.length) fehler(`Frage "${titel}": eine Antwort steht doppelt`, s.nr);
        f.mehrfach = richtig > 1;
      } else if (name === 'Zahl') {
        f.art = 'zahl';
        for (const p of punkte) {
          const m = ZAHL_ZEILE.exec(p.text);
          if (!m) fehler('Zahl nicht im Format "- Beschriftung: 4,35 ± 0,03 Einheit"', p.nr);
          else f.felder.push({ text: (m[1] ?? '').trim(), wert: zahl(m[2]), toleranz: m[3] ? zahl(m[3]) : 0, einheit: m[4].trim() });
        }
        if (!f.felder.length) fehler(`Frage "${titel}": kein Zahlenfeld`, s.nr);
        if (f.felder.length > 1 && f.felder.some((x) => !x.text)) fehler(`Frage "${titel}": bei mehreren Zahlenfeldern braucht jedes eine Beschriftung`, s.nr);
      } else {
        f.art = 'zuordnung';
        for (const p of punkte) {
          const m = ZUORDNUNG.exec(p.text);
          if (!m) fehler('Zuordnung nicht im Format "- links → rechts"', p.nr);
          else f.paare.push({ links: m[1].trim(), rechts: m[2].trim() });
        }
        if (f.paare.length < 2) fehler(`Frage "${titel}": Zuordnung braucht mindestens zwei Paare`, s.nr);
        if (new Set(f.paare.map((x) => x.rechts)).size < 2) fehler(`Frage "${titel}": Zuordnung braucht mindestens zwei verschiedene Antworten rechts`, s.nr);
      }
    } else if (name === 'Lösung') {
      const schritte: string[] = [];
      const rest: Zeile[] = [];
      for (const z of s.zeilen) {
        const m = /^\s*\d+\.\s+(.*)$/.exec(z.text);
        if (m) schritte.push(m[1].trim());
        else if (schritte.length && /^\s{2,}\S/.test(z.text)) schritte[schritte.length - 1] += ' ' + z.text.trim();
        else rest.push(z);
      }
      f.loesung = { absaetze: absaetze(rest), schritte };
    } else {
      fehler(`Unbekannte Überschrift "### ${name}" (erlaubt: Auswahl, Zahl, Zuordnung, Lösung)`, s.nr);
    }
  }
  if (antwort !== 1) {
    fehler(`Frage "${titel}" braucht genau einen Abschnitt "### Auswahl", "### Zahl" oder "### Zuordnung"`, a.nr);
    return null;
  }
  return f;
}

/** Liest einen Übungssatz (pruefung/<id>.md). */
export function parseUebungssatz(raw: string, id: string, datei: string): { satz: Uebungssatz; meldungen: Meldung[] } {
  const meldungen: Meldung[] = [];
  const fehler = (text: string, zeile?: number) => meldungen.push({ level: 'fehler', datei, zeile, text });
  let fm: { data: Record<string, unknown>; content: string };
  try {
    fm = frontmatter(raw);
  } catch (e) {
    fehler(`Frontmatter nicht lesbar: ${(e as Error).message}`, 1);
    fm = { data: {}, content: raw };
  }
  const offset = raw.length >= fm.content.length ? raw.slice(0, raw.length - fm.content.length).split('\n').length - 1 : 0;
  const zeilen: Zeile[] = fm.content.split(/\r?\n/).map((text, i) => ({ text, nr: i + 1 + offset }));
  const str = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
  const satz: Uebungssatz = {
    id,
    titel: str(fm.data.titel),
    gruppe: str(fm.data.gruppe),
    beschreibung: '',
    umfasst: str(fm.data.umfasst).split(',').map((x) => x.trim()).filter(Boolean),
    fragen: [],
  };
  if (!satz.titel) fehler('Im Frontmatter fehlt "titel"', 1);
  const { vorher, abschnitte } = zerlege(zeilen, '## ');
  satz.beschreibung = absaetze(vorher).join(' ');
  const ids = new Map<string, number>();
  for (const a of abschnitte) {
    const { titel, id: fid } = trenneId(a.ueberschrift);
    if (!fid || !ID_MUSTER.test(fid)) {
      fehler(`Frage "${titel}" braucht eine Kennung ({#…}, nur a–z, 0–9, -)`, a.nr);
      continue;
    }
    if (ids.has(fid)) {
      fehler(`Kennung "${fid}" kommt doppelt vor (zuerst in Zeile ${ids.get(fid)})`, a.nr);
      continue;
    }
    ids.set(fid, a.nr);
    const f = parseFrage(id, fid, titel, a, fehler);
    if (f) satz.fragen.push(f);
  }
  if (satz.umfasst.length && satz.fragen.length) fehler('Ein Probetest („umfasst“) hat keine eigenen Fragen', 1);
  if (!satz.umfasst.length && !satz.fragen.length) fehler('Keine Fragen gefunden');
  return { satz, meldungen };
}

/** Liest alle Übungssätze eines Pakets; Probetests bekommen die Fragen der Sätze, die sie umfassen. */
export function ladeUebungssaetze(dir: string, meldungen: Meldung[]): Uebungssatz[] {
  const ordner = join(dir, 'pruefung');
  if (!existsSync(ordner)) return [];
  const saetze: Uebungssatz[] = [];
  for (const datei of readdirSync(ordner).filter((d) => d.endsWith('.md')).sort()) {
    const id = datei.slice(0, -3);
    const name = `pruefung/${datei}`;
    if (!ID_MUSTER.test(id)) {
      meldungen.push({ level: 'fehler', datei: name, text: 'Dateiname nur aus a–z, 0–9 und Bindestrich' });
      continue;
    }
    const { satz, meldungen: m } = parseUebungssatz(readFileSync(join(ordner, datei), 'utf8'), id, name);
    meldungen.push(...m);
    if (!m.some((x) => x.level === 'fehler')) saetze.push(satz);
  }
  const eigene = new Map(saetze.filter((s) => !s.umfasst.length).map((s) => [s.id, s]));
  for (const s of saetze.filter((x) => x.umfasst.length)) {
    for (const ref of s.umfasst) {
      const ziel = eigene.get(ref);
      if (!ziel) meldungen.push({ level: 'fehler', datei: `pruefung/${s.id}.md`, text: `"umfasst: ${ref}" – diesen Übungssatz gibt es nicht (oder er ist selbst ein Probetest)` });
      else s.fragen.push(...ziel.fragen);
    }
  }
  return saetze.filter((s) => s.fragen.length > 0);
}

/** Liest dokumente.json und prüft, dass jede Datei da und wirklich ein PDF ist. */
export function ladeDokumente(dir: string, meldungen: Meldung[]): Dokument[] {
  const liste = join(dir, 'dokumente.json');
  if (!existsSync(liste)) return [];
  let roh: unknown;
  try {
    roh = JSON.parse(readFileSync(liste, 'utf8'));
  } catch (e) {
    meldungen.push({ level: 'fehler', datei: 'dokumente.json', text: `Ungültiges JSON: ${(e as Error).message}` });
    return [];
  }
  if (!Array.isArray(roh)) {
    meldungen.push({ level: 'fehler', datei: 'dokumente.json', text: 'Erwartet wird eine Liste [ { "datei": …, "titel": … } ]' });
    return [];
  }
  const out: Dokument[] = [];
  const gesehen = new Set<string>();
  for (const e of roh as Record<string, unknown>[]) {
    const datei = typeof e?.datei === 'string' ? e.datei : '';
    const titel = typeof e?.titel === 'string' ? e.titel.trim() : '';
    if (!DOKUMENT_DATEI.test(datei)) {
      meldungen.push({ level: 'fehler', datei: 'dokumente.json', text: `"${datei}": Dateiname nur aus a–z, 0–9, Punkt, Bindestrich, Unterstrich, Endung .pdf` });
      continue;
    }
    if (gesehen.has(datei)) {
      meldungen.push({ level: 'fehler', datei: 'dokumente.json', text: `"${datei}" steht doppelt in der Liste` });
      continue;
    }
    gesehen.add(datei);
    if (!titel) meldungen.push({ level: 'fehler', datei: 'dokumente.json', text: `"${datei}": "titel" fehlt` });
    const pfad = join(dir, 'dokumente', datei);
    if (!existsSync(pfad)) {
      meldungen.push({ level: 'fehler', datei: `dokumente/${datei}`, text: 'Datei fehlt' });
      continue;
    }
    if (!istPdf(pfad)) {
      meldungen.push({ level: 'fehler', datei: `dokumente/${datei}`, text: 'Das ist keine PDF-Datei' });
      continue;
    }
    if (titel) out.push({ datei, titel, gruppe: typeof e.gruppe === 'string' ? e.gruppe.trim() : '', nurBetreuung: e.nurBetreuung === true, groesse: statSync(pfad).size });
  }
  const ordner = join(dir, 'dokumente');
  if (existsSync(ordner)) {
    for (const d of readdirSync(ordner)) if (d.endsWith('.pdf') && !gesehen.has(d)) meldungen.push({ level: 'warnung', datei: `dokumente/${d}`, text: 'Steht nicht in dokumente.json und wird nicht angezeigt' });
  }
  return out;
}

function istPdf(pfad: string): boolean {
  const fd = openSync(pfad, 'r');
  try {
    const kopf = Buffer.alloc(5);
    readSync(fd, kopf, 0, 5, 0);
    return kopf.toString('latin1') === '%PDF-';
  } finally {
    closeSync(fd);
  }
}

/** Die Frage für den Azubi: ohne Lösung, ohne Markierung der richtigen Antworten. */
export function frageOhneLoesung(f: PruefFrage) {
  return {
    schluessel: f.schluessel,
    titel: f.titel,
    quelle: f.quelle,
    absaetze: f.absaetze,
    punkte: f.punkte,
    tabelle: f.tabelle,
    art: f.art,
    mehrfach: f.mehrfach,
    // nr = Stelle in der Datei; danach wertet der Server, auch wenn die Reihenfolge gemischt angezeigt wird
    optionen: f.optionen.map((o, nr) => ({ nr, text: o.text })),
    felder: f.felder.map((x) => ({ text: x.text, einheit: x.einheit })),
    links: f.paare.map((p) => p.links),
    // rechts als Auswahlliste: jede Antwort einmal, alphabetisch – die Reihenfolge verrät nichts
    rechts: [...new Set(f.paare.map((p) => p.rechts))].sort((a, b) => a.localeCompare(b, 'de')),
  };
}

/** Die Frage mit Lösung – nach der Auswertung und in der Leseansicht für Ausbilder. */
export function frageMitLoesung(f: PruefFrage) {
  return {
    ...frageOhneLoesung(f),
    zu: f.zu,
    richtig: f.art === 'auswahl' ? f.optionen.map((o, i) => (o.richtig ? i : -1)).filter((i) => i >= 0) : [],
    werte: f.felder.map((x) => ({ wert: x.wert, toleranz: x.toleranz })),
    zuordnung: f.paare.map((p) => p.rechts),
    loesung: f.loesung,
  };
}

/**
 * Eine eingegebene Zahl lesen, Einheit dahinter erlaubt.
 * Mit Komma gilt die deutsche Schreibweise („4.168,8“, „4,35“). Ohne Komma ist „1.000“ tausend,
 * ein einzelner Punkt sonst das Dezimalzeichen („4.35“, „0.033“).
 */
export function leseZahl(eingabe: string): number | null {
  const m = /^-?[\d.,]*\d/.exec(eingabe.trim().replace(/\s+/g, ''));
  if (!m) return null;
  let z = m[0];
  if (z.includes(',')) z = z.replace(/\./g, '').replace(',', '.');
  else if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(z)) z = z.replace(/\./g, '');
  const n = Number(z);
  return Number.isFinite(n) ? n : null;
}

/** Bewertet eine Antwort: Anteil 0 bis 1. Teilpunkte bei Mehrfachauswahl, mehreren Zahlenfeldern und Zuordnungen. */
export function bewerte(f: PruefFrage, antwort: unknown): number {
  if (f.art === 'auswahl') {
    const gewaehlt = new Set(Array.isArray(antwort) ? antwort.filter((x): x is number => Number.isInteger(x) && x >= 0 && x < f.optionen.length) : []);
    const richtig = f.optionen.filter((o) => o.richtig).length;
    if (!f.mehrfach) return gewaehlt.size === 1 && f.optionen[[...gewaehlt][0]].richtig ? 1 : 0;
    let plus = 0;
    let minus = 0;
    for (const i of gewaehlt) {
      if (f.optionen[i].richtig) plus++;
      else minus++;
    }
    return Math.max(0, (plus - minus) / richtig);
  }
  const liste = Array.isArray(antwort) ? antwort : [];
  if (f.art === 'zahl') {
    let ok = 0;
    f.felder.forEach((x, i) => {
      const z = typeof liste[i] === 'string' ? leseZahl(liste[i] as string) : null;
      if (z !== null && Math.abs(z - x.wert) <= x.toleranz + 1e-9) ok++;
    });
    return ok / f.felder.length;
  }
  let ok = 0;
  f.paare.forEach((p, i) => {
    if (liste[i] === p.rechts) ok++;
  });
  return ok / f.paare.length;
}

/** IHK-Notenschlüssel nach Prozentpunkten. */
export function ihkNote(prozent: number): { note: number; text: string } {
  if (prozent >= 92) return { note: 1, text: 'sehr gut' };
  if (prozent >= 81) return { note: 2, text: 'gut' };
  if (prozent >= 67) return { note: 3, text: 'befriedigend' };
  if (prozent >= 50) return { note: 4, text: 'ausreichend' };
  if (prozent >= 30) return { note: 5, text: 'mangelhaft' };
  return { note: 6, text: 'ungenügend' };
}
