// Übernommen aus dem FISI-Lernkompass (https://github.com/extrempro/fisi-lernkompass, MIT), dort server/content/.
// Das Inhaltsformat ist dasselbe – ein Inhaltspaket aus dem Lernkompass lässt sich unverändert einbinden.
import { createHash } from 'node:crypto';
import type {
  Abbildung,
  Befehl,
  Bild,
  Begriff,
  Link,
  Meldung,
  Pruefungsfrage,
  Tabelle,
  TextAbschnitt,
  UnterthemaInhalt,
  VergleichKarte,
  Zusatz,
} from './typen';

export const ID_MUSTER = /^[a-z0-9-]+$/;
const ID_IN_UEBERSCHRIFT = /\s*\{#([^}]*)\}\s*$/;
const KEIN_HINWEIS = '<!-- kein-hinweis -->';
const MERKSATZ_MAX = 200;
const BILD_ZEILE = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/;
export const BILD_DATEI = /^[a-z0-9-]+\.svg$/;

/** Liest eine Bildzeile "![Beschreibung](datei.svg)"; null, wenn die Zeile keine Bildzeile ist. */
function bildZeile(z: Zeile, fehler: (t: string, n?: number) => void): Bild | null | false {
  const m = BILD_ZEILE.exec(z.text.trim());
  if (!m) return false;
  const alt = m[1].trim();
  const datei = m[2].trim();
  if (!BILD_DATEI.test(datei)) {
    fehler(`Bild "${datei}": nur SVG-Dateien aus content/bilder/ (Name a–z, 0–9, -, Endung .svg)`, z.nr);
    return null;
  }
  if (!alt) {
    fehler(`Bild "${datei}" ohne Beschreibung – Format "![Beschreibung](${datei})"`, z.nr);
    return null;
  }
  return { alt, datei, svg: '' };
}

export interface ParsedThema {
  titel: string;
  worum: string;
  unterthemen: UnterthemaInhalt[];
  fehler: string[];
  links: Link[];
  zusatz: Zusatz[];
}

export interface Zeile {
  text: string;
  nr: number; // 1-basiert, bezogen auf die ganze Datei
}

export interface Abschnitt {
  ueberschrift: string;
  nr: number;
  zeilen: Zeile[];
}

/** Zerlegt Zeilen an Überschriften eines bestimmten Levels ("## " oder "### "). */
export function zerlege(zeilen: Zeile[], prefix: string): { vorher: Zeile[]; abschnitte: Abschnitt[] } {
  const vorher: Zeile[] = [];
  const abschnitte: Abschnitt[] = [];
  let aktuell: Abschnitt | null = null;
  let imCode = false;
  for (const z of zeilen) {
    if (z.text.trimStart().startsWith('```')) imCode = !imCode;
    if (!imCode && z.text.startsWith(prefix)) {
      aktuell = { ueberschrift: z.text.slice(prefix.length).trim(), nr: z.nr, zeilen: [] };
      abschnitte.push(aktuell);
    } else if (aktuell) {
      aktuell.zeilen.push(z);
    } else {
      vorher.push(z);
    }
  }
  return { vorher, abschnitte };
}

/** Listenpunkte ("- " oder "* "), eingerückte Folgezeilen werden angehängt. */
export function listenpunkte(zeilen: Zeile[]): { text: string; nr: number }[] {
  const punkte: { text: string; nr: number }[] = [];
  for (const z of zeilen) {
    const m = /^\s*[-*]\s+(.*)$/.exec(z.text);
    if (m) {
      punkte.push({ text: m[1].trim(), nr: z.nr });
    } else if (punkte.length && /^\s{2,}\S/.test(z.text)) {
      punkte[punkte.length - 1].text += ' ' + z.text.trim();
    }
  }
  return punkte;
}

/** Absätze: zusammenhängende, nicht leere Zeilen (ohne Kommentare), zu einem Text verbunden. */
export function absaetze(zeilen: Zeile[]): string[] {
  const out: string[] = [];
  let akt: string[] = [];
  for (const z of zeilen) {
    const t = z.text.trim();
    if (!t || t.startsWith('<!--')) {
      if (akt.length) out.push(akt.join(' '));
      akt = [];
    } else {
      akt.push(t);
    }
  }
  if (akt.length) out.push(akt.join(' '));
  return out;
}

function tabellenZellen(zeile: string): string[] {
  let t = zeile.trim();
  t = t.replace(/\\\|/g, '\u0000');
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  return t.split('|').map((c) => c.replace(/\u0000/g, '|').trim());
}

function hashInhalt(zeilen: Zeile[]): string {
  const norm = zeilen
    .map((z) => z.text)
    .filter((t) => t.trim() !== KEIN_HINWEIS)
    .map((t) => t.replace(/\s+/g, ' ').trim())
    .filter((t) => t.length > 0)
    .join('\n');
  return createHash('sha1').update(norm).digest('hex').slice(0, 16);
}

export function trenneId(ueberschrift: string): { titel: string; id: string | null } {
  const m = ID_IN_UEBERSCHRIFT.exec(ueberschrift);
  if (!m) return { titel: ueberschrift.trim(), id: null };
  return { titel: ueberschrift.slice(0, m.index).trim(), id: m[1].trim() };
}

/**
 * Liest den Kopf zwischen zwei Zeilen „---“: einfache Zeilen „schluessel: wert“ (mehr braucht das Format nicht).
 * Ersetzt die Bibliothek gray-matter aus dem Lernkompass.
 */
export function frontmatter(raw: string): { data: Record<string, unknown>; content: string } {
  const text = raw.replace(/^\uFEFF/, '');
  const m = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!m) return { data: {}, content: text };
  const data: Record<string, unknown> = {};
  for (const zeile of m[1].split(/\r?\n/)) {
    if (!zeile.trim() || zeile.trim().startsWith('#')) continue;
    const z = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(zeile);
    if (!z) throw new Error(`Zeile „${zeile.trim()}“ ist nicht in der Form „schluessel: wert“`);
    data[z[1]] = z[2].trim().replace(/^(["'])(.*)\1$/, '$2');
  }
  return { data, content: text.slice(m[0].length) };
}

export function parseThemaMarkdown(raw: string, datei: string): { thema: ParsedThema; meldungen: Meldung[] } {
  const meldungen: Meldung[] = [];
  const fehler = (text: string, zeile?: number) => meldungen.push({ level: 'fehler', datei, zeile, text });
  const warnung = (text: string, zeile?: number) => meldungen.push({ level: 'warnung', datei, zeile, text });

  let fm: { data: Record<string, unknown>; content: string };
  try {
    fm = frontmatter(raw);
  } catch (e) {
    fehler(`Frontmatter nicht lesbar: ${(e as Error).message}`, 1);
    fm = { data: {}, content: raw };
  }
  const offset = raw.length >= fm.content.length ? raw.slice(0, raw.length - fm.content.length).split('\n').length - 1 : 0;
  const zeilen: Zeile[] = fm.content.split(/\r?\n/).map((text, i) => ({ text, nr: i + 1 + offset }));

  const titel = typeof fm.data.titel === 'string' ? fm.data.titel.trim() : '';
  if (!titel) fehler('Im Frontmatter fehlt "titel"', 1);

  const { vorher, abschnitte } = zerlege(zeilen, '## ');
  const worum = absaetze(vorher).join(' ');
  if (!worum) warnung('Kein Einleitungsabsatz ("Worum geht\'s") vor dem ersten Unterthema');

  const thema: ParsedThema = { titel, worum, unterthemen: [], fehler: [], links: [], zusatz: [] };
  const ids = new Map<string, number>();

  const pruefeId = (id: string | null, name: string, nr: number): string | null => {
    if (!id) {
      fehler(`"${name}" hat keine ID ({#…})`, nr);
      return null;
    }
    if (!ID_MUSTER.test(id)) {
      fehler(`ID "${id}" enthält ungültige Zeichen (erlaubt: a–z, 0–9, -)`, nr);
      return null;
    }
    if (ids.has(id)) {
      fehler(`ID "${id}" kommt doppelt vor (zuerst in Zeile ${ids.get(id)})`, nr);
      return null;
    }
    ids.set(id, nr);
    return id;
  };

  for (const a of abschnitte) {
    const { titel: name, id } = trenneId(a.ueberschrift);

    if (name === 'Häufige Fehler') {
      thema.fehler = listenpunkte(a.zeilen).map((p) => p.text);
      continue;
    }

    if (name === 'Links') {
      for (const p of listenpunkte(a.zeilen)) {
        const m = /^\[([^\]]+)\]\(([^)\s]+)\)\s*(?:[–-]\s*(.*))?$/.exec(p.text);
        if (!m) {
          fehler(`Link nicht im Format "[Titel](https://…) – Beschreibung"`, p.nr);
          continue;
        }
        if (!m[2].startsWith('https://')) warnung(`Link "${m[1]}" beginnt nicht mit https://`, p.nr);
        thema.links.push({ titel: m[1], url: m[2], info: (m[3] || '').trim() });
      }
      continue;
    }

    if (name.startsWith('Zusatz:')) {
      const zid = pruefeId(id, name, a.nr);
      if (!zid) continue;
      thema.zusatz.push(parseZusatz(zid, name.slice('Zusatz:'.length).trim(), a, fehler, warnung));
      continue;
    }

    const uid = pruefeId(id, name, a.nr);
    if (!uid) continue;
    thema.unterthemen.push(parseUnterthema(uid, name, a, fehler, warnung));
  }

  if (!thema.unterthemen.length) fehler('Keine Unterthemen gefunden');
  const leer = thema.unterthemen.filter((u) => !u.hatInhalt).length;
  if (leer > 0) warnung(`${leer} von ${thema.unterthemen.length} Unterthemen ohne Inhalt (Gerüst)`);

  return { thema, meldungen };
}

function parseUnterthema(
  id: string,
  titel: string,
  a: Abschnitt,
  fehler: (t: string, z?: number) => void,
  warnung: (t: string, z?: number) => void,
): UnterthemaInhalt {
  const u: UnterthemaInhalt = {
    id,
    titel,
    begriffe: [],
    tabellen: [],
    befehle: [],
    merksatz: null,
    frage: null,
    abbildungen: [],
    hatInhalt: false,
    hash: hashInhalt(a.zeilen),
    keinHinweis: a.zeilen.some((z) => z.text.trim() === KEIN_HINWEIS),
  };

  const { vorher, abschnitte } = zerlege(a.zeilen, '### ');
  if (absaetze(vorher).length) {
    warnung(`Text vor dem ersten Unterabschnitt von "${titel}" wird nicht angezeigt`, vorher.find((z) => z.text.trim())?.nr);
  }

  for (const s of abschnitte) {
    const name = s.ueberschrift;
    if (name === 'Kernbegriffe') {
      for (const p of listenpunkte(s.zeilen)) {
        const m = /^\*\*(.+?):\*\*\s*(.*)$/.exec(p.text) || /^\*\*(.+?)\*\*:\s*(.*)$/.exec(p.text);
        if (!m) {
          fehler(`Kernbegriff nicht im Format "- **Begriff:** Erklärung"`, p.nr);
          continue;
        }
        u.begriffe.push({ begriff: m[1].trim(), erklaerung: m[2].trim() } satisfies Begriff);
      }
    } else if (name.startsWith('Tabelle:')) {
      const t = parseTabelle(name.slice('Tabelle:'.length).trim(), s, fehler);
      if (t) u.tabellen.push(t);
    } else if (name === 'Befehle') {
      for (const p of listenpunkte(s.zeilen)) {
        const m = /^`([^`]+)`\s*(?:[–-]\s*(.*))?$/.exec(p.text);
        if (!m) {
          fehler('Befehl nicht im Format "- `befehl` – Erklärung"', p.nr);
          continue;
        }
        u.befehle.push({ befehl: m[1], info: (m[2] || '').trim() } satisfies Befehl);
      }
    } else if (name === 'Merksatz') {
      const text = absaetze(s.zeilen).join(' ');
      if (!text) fehler('Merksatz ist leer', s.nr);
      else {
        if (text.length > MERKSATZ_MAX) warnung(`Merksatz ist sehr lang (${text.length} Zeichen)`, s.nr);
        u.merksatz = text;
      }
    } else if (name === 'Prüfungsfrage') {
      const frageZeilen: Zeile[] = [];
      const loesung: string[] = [];
      for (const z of s.zeilen) {
        const m = /^\s*\d+\.\s+(.*)$/.exec(z.text);
        if (m) loesung.push(m[1].trim());
        else if (!loesung.length) frageZeilen.push(z);
        else if (/^\s{2,}\S/.test(z.text)) loesung[loesung.length - 1] += ' ' + z.text.trim();
      }
      const frage = absaetze(frageZeilen).join(' ');
      if (!frage) fehler('Prüfungsfrage ohne Fragetext', s.nr);
      if (!loesung.length) fehler('Prüfungsfrage ohne nummerierte Lösungsschritte', s.nr);
      if (frage && loesung.length) u.frage = { frage, loesung } satisfies Pruefungsfrage;
    } else if (name.startsWith('Abbildung:')) {
      const abb: Abbildung = { titel: name.slice('Abbildung:'.length).trim(), bilder: [] };
      if (!abb.titel) fehler('Abbildung ohne Titel ("### Abbildung: Titel")', s.nr);
      for (const z of s.zeilen) {
        if (!z.text.trim() || z.text.trim().startsWith('<!--')) continue;
        const b = bildZeile(z, fehler);
        if (b === false) fehler('In einer Abbildung sind nur Bildzeilen erlaubt: "![Beschreibung](datei.svg)"', z.nr);
        else if (b) abb.bilder.push(b);
      }
      if (!abb.bilder.length) fehler(`Abbildung "${abb.titel}" enthält kein Bild`, s.nr);
      else u.abbildungen.push(abb);
    } else {
      fehler(
        `Unbekannte Überschrift "### ${name}" (erlaubt: Kernbegriffe, Tabelle: …, Befehle, Merksatz, Prüfungsfrage, Abbildung: …)`,
        s.nr,
      );
    }
  }

  u.hatInhalt = !!(
    u.begriffe.length ||
    u.tabellen.length ||
    u.befehle.length ||
    u.merksatz ||
    u.frage ||
    u.abbildungen.length
  );
  return u;
}

export function parseTabelle(titel: string, s: Abschnitt, fehler: (t: string, z?: number) => void): Tabelle | null {
  const zeilen = s.zeilen.filter((z) => z.text.trim().startsWith('|'));
  if (zeilen.length < 2) {
    fehler(`Tabelle "${titel}" hat keine Kopf- und Trennzeile`, s.nr);
    return null;
  }
  const kopf = tabellenZellen(zeilen[0].text);
  const trenner = tabellenZellen(zeilen[1].text);
  if (!trenner.every((c) => /^:?-{3,}:?$/.test(c))) {
    fehler(`Tabelle "${titel}": zweite Zeile muss die Trennzeile (| --- | --- |) sein`, zeilen[1].nr);
    return null;
  }
  const out: string[][] = [];
  zeilen.slice(2).forEach((z, i) => {
    const zellen = tabellenZellen(z.text);
    if (zellen.length !== kopf.length) {
      fehler(`Tabelle "${titel}": Zeile ${i + 1} hat ${zellen.length} statt ${kopf.length} Spalten`, z.nr);
      return;
    }
    out.push(zellen);
  });
  if (!titel) fehler('Tabelle ohne Titel ("### Tabelle: Titel")', s.nr);
  return { titel, kopf, zeilen: out };
}

function parseZusatz(
  id: string,
  titel: string,
  a: Abschnitt,
  fehler: (t: string, z?: number) => void,
  warnung: (t: string, z?: number) => void,
): Zusatz {
  const z: Zusatz = { id, titel, typ: 'text', zu: [], intro: '', szenarien: [], absaetze: [], abschnitte: [] };
  const { vorher, abschnitte } = zerlege(a.zeilen, '### ');

  let alt: 'vergleich' | 'checkliste' | null = null;
  const textZeilen: Zeile[] = [];
  for (const l of vorher) {
    const t = l.text.trim();
    const ablauf = /^ablauf:\s*(\S+)\s*$/.exec(t);
    const typ = /^typ:\s*(\S+)\s*$/.exec(t);
    const zu = /^zu:\s*(.+)$/.exec(t);
    if (ablauf) {
      z.typ = 'ablauf';
      z.ablaufDatei = ablauf[1];
    } else if (typ) {
      if (typ[1] === 'text') z.typ = 'text';
      else if (typ[1] === 'vergleich' || typ[1] === 'checkliste') {
        alt = typ[1];
        warnung(
          `Zusatz "${titel}": "typ: ${typ[1]}" ist veraltet – besser "typ: text" mit ` +
            (typ[1] === 'vergleich' ? '"### Vergleich: …" und Karten als "#### …"' : '"### Checkliste: …"-Abschnitten'),
          l.nr,
        );
      } else fehler(`Unbekannter Zusatz-Typ "${typ[1]}" (erlaubt: text, oder "ablauf: datei.json")`, l.nr);
    } else if (zu) {
      for (const ref of zu[1].split(',').map((x) => x.trim()).filter(Boolean)) {
        if (!/^([a-z0-9-]+\.)?[a-z0-9-]+$/.test(ref)) fehler(`"zu: ${ref}" ist keine gültige Unterthema-ID`, l.nr);
        else z.zu.push(ref);
      }
    } else {
      textZeilen.push(l);
    }
  }
  const texte = absaetze(textZeilen);
  z.intro = texte[0] || '';
  z.absaetze = texte.slice(1);

  if (z.typ === 'ablauf') {
    if (abschnitte.length) fehler(`Zusatz "${titel}": Unterabschnitte (###) sind beim Ablauf nicht erlaubt`, abschnitte[0].nr);
    return z;
  }

  if (alt === 'vergleich') {
    // altes Format: jede ###-Überschrift ist eine Karte
    if (!abschnitte.length) fehler(`Zusatz "${titel}": Vergleich ohne Karten`, a.nr);
    z.abschnitte.push({ ...leererAbschnitt('vergleich', ''), karten: abschnitte.map((k) => parseKarte(k, fehler)) });
  } else if (alt === 'checkliste') {
    // altes Format: jede ###-Überschrift ist ein Bereich
    for (const b of abschnitte) z.abschnitte.push(parseTextAbschnitt(b, fehler, 'checkliste', b.ueberschrift));
  } else {
    for (const b of abschnitte) {
      const vgl = /^Vergleich:\s*(.*)$/.exec(b.ueberschrift);
      const chk = /^Checkliste:\s*(.*)$/.exec(b.ueberschrift);
      if (vgl) {
        const teil = zerlege(b.zeilen, '#### ');
        const abs = parseTextAbschnitt({ ...b, zeilen: teil.vorher }, fehler, 'vergleich', vgl[1].trim(), true);
        abs.karten = teil.abschnitte.map((k) => parseKarte(k, fehler));
        if (!abs.karten.length) fehler(`Vergleich "${abs.titel}": keine Karten (#### Kartentitel)`, b.nr);
        z.abschnitte.push(abs);
      } else if (chk) {
        z.abschnitte.push(parseTextAbschnitt(b, fehler, 'checkliste', chk[1].trim()));
      } else {
        z.abschnitte.push(parseTextAbschnitt(b, fehler, 'text', b.ueberschrift));
      }
    }
  }
  return z;
}

function leererAbschnitt(art: TextAbschnitt['art'], titel: string): TextAbschnitt {
  return { art, titel, absaetze: [], bilder: [], tabelle: null, punkte: [], schritte: [], karten: [] };
}

/**
 * Abschnitt eines Text-Zusatzes: Absätze, Bildzeilen, höchstens eine Tabelle,
 * Listenpunkte (- …) und nummerierte Schritte (1. …) – angezeigt in dieser Reihenfolge.
 */
function parseTextAbschnitt(
  b: Abschnitt,
  fehler: (t: string, z?: number) => void,
  art: TextAbschnitt['art'] = 'text',
  titel = b.ueberschrift,
  leerErlaubt = false,
): TextAbschnitt {
  const a = leererAbschnitt(art, titel);
  const text: Zeile[] = [];
  const tabelle: Zeile[] = [];
  let letzte: 'punkt' | 'schritt' | null = null;
  for (const z of b.zeilen) {
    const t = z.text;
    const punkt = /^\s*[-*]\s+(.*)$/.exec(t);
    const schritt = /^\s*\d+\.\s+(.*)$/.exec(t);
    if (t.trim().startsWith('|')) {
      tabelle.push(z);
      letzte = null;
    } else if (punkt) {
      a.punkte.push(punkt[1].trim());
      letzte = 'punkt';
    } else if (schritt) {
      a.schritte.push(schritt[1].trim());
      letzte = 'schritt';
    } else if (letzte && /^\s{2,}\S/.test(t)) {
      const liste = letzte === 'punkt' ? a.punkte : a.schritte;
      liste[liste.length - 1] += ' ' + t.trim();
    } else {
      const bild = bildZeile(z, fehler);
      if (bild === false) {
        text.push(z);
        if (!t.trim()) letzte = null;
      } else if (bild) a.bilder.push(bild);
    }
  }
  a.absaetze = absaetze(text);
  if (tabelle.length) a.tabelle = parseTabelle(a.titel, { ueberschrift: a.titel, nr: b.nr, zeilen: tabelle }, fehler);
  if (!leerErlaubt && !a.absaetze.length && !a.bilder.length && !a.tabelle && !a.punkte.length && !a.schritte.length) {
    fehler(`Abschnitt "${a.titel}" ist leer`, b.nr);
  }
  return a;
}

function parseKarte(k: Abschnitt, fehler: (t: string, z?: number) => void): VergleichKarte {
  const karte: VergleichKarte = { titel: k.ueberschrift, schema: '', bild: null, kurz: '', plus: '', minus: '', beispiel: '' };
  let imCode = false;
  const code: string[] = [];
  const rest: Zeile[] = [];
  for (const z of k.zeilen) {
    if (z.text.trimStart().startsWith('```')) {
      imCode = !imCode;
      continue;
    }
    if (imCode) {
      code.push(z.text);
      continue;
    }
    const b = bildZeile(z, fehler);
    if (b === false) rest.push(z);
    else if (b) {
      if (karte.bild) fehler(`Karte "${karte.titel}": nur ein Bild pro Karte`, z.nr);
      else karte.bild = b;
    }
  }
  karte.schema = code.join('\n');
  const felder: Record<string, 'kurz' | 'plus' | 'minus' | 'beispiel'> = { Kurz: 'kurz', Plus: 'plus', Minus: 'minus', Beispiel: 'beispiel' };
  for (const p of listenpunkte(rest)) {
    const m = /^\*\*(Kurz|Plus|Minus|Beispiel):\*\*\s*(.*)$/.exec(p.text);
    if (!m) {
      fehler(`Karte "${karte.titel}": Zeile nicht im Format "- **Kurz|Plus|Minus|Beispiel:** Text"`, p.nr);
      continue;
    }
    karte[felder[m[1]]] = m[2].trim();
  }
  if (!karte.kurz) fehler(`Karte "${karte.titel}": "**Kurz:**" fehlt`, k.nr);
  return karte;
}
