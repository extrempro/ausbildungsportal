import { join } from 'node:path';
import { Fehler, koerper } from './api-basis';
import type { Ctx, Kontext, Route } from './api-basis';
import { merkeAktivitaet } from './aktivitaet';
import type { DB } from './db';
import { transaktion } from './db';
import { heute } from './datum';
import { ferienZwischen, ladeFerien } from './ferien';
import { gueltigesDatum, montagVon, plusTage } from './kalender';
import { gleicheSchulbloeckeAb, klasseVon } from './klassen';
import type { Klasse } from './klassen';
import { protokolliere } from './protokoll';
import { dienstBereit, eigeneAuftraege, holeAuftrag, lies, loescheAuftrag, montagDerKw, neuerAuftrag, pruefePdf, raeumeAuf, standDes, stehtImText, zweistellig } from './import-dienst';
import type { Auftrag } from './import-dienst';

/**
 * Plan der Berufsschule einlesen (Planung → Schulblöcke → „Plan der Schule einlesen“).
 *
 * - Text einfügen: Das Portal sucht selbst nach Zeiträumen und Klassen (Muster) – sofort, ohne Dienst.
 * - PDF (auch gescannt) und, wenn der Dienst läuft, auch eingefügter Text: Auftrag an den Dienst „import“ (import/lesen.sh)
 *   über den Arbeitsordner data/import. Der Dienst liest den Text (Texterkennung bei Scans) und macht mit einem lokalen
 *   Sprachmodell einen Vorschlag. Liefert das Modell nichts, sucht das Portal im gelesenen Text nach Mustern.
 * - Alles landet in einer Vorschau, die das Portal selbst prüft (Datum, Klasse, schon vorhanden, Ferien, Urlaub).
 *   Gespeichert wird erst, was der Ausbilder übernimmt. Aufträge (mit Datei und Text) werden danach gelöscht, sonst nach 24 Stunden.
 */

const MAX_TEXT = 40_000;
const MAX_ZEILEN = 300;

export interface Roh {
  /** Name der Klasse, wie er im Plan steht – leer, wenn keiner dabei war */
  klasse: string;
  von: string;
  bis: string;
  titel: string;
  /** Jahr ergänzt, Texterkennung oder Ähnliches – bitte genau ansehen */
  unsicher: boolean;
  /** nur das Sprachmodell hat diesen Zeitraum gefunden, die Muster nicht */
  nurModell?: boolean;
}

// ---------- Muster ----------

const norm = (s: string) => s.toLowerCase().replace(/[\s\-_./]/g, '');
const iso = (j: number, m: number, t: number) => `${j}-${String(m).padStart(2, '0')}-${String(t).padStart(2, '0')}`;
function gueltig(j: number, m: number, t: number): string | null {
  const s = iso(j, m, t);
  return gueltigesDatum(s) ? s : null;
}

const DATUM = String.raw`(\d{1,2})\.\s?(\d{1,2})\.(?:\s?(\d{4}|\d{2})(?!\d))?`;
const STRICH = String.raw`\s*(?:-|–|—|bis)\s*`;
// beim ersten Datum darf der Punkt nach dem Monat fehlen („15.03 - 19.03.2027“)
const ZEITRAUM = new RegExp(`${DATUM.replace(String.raw`(\d{1,2})\.(?:`, String.raw`(\d{1,2})\.?(?:`)}${STRICH}${DATUM}`, 'g');
const KW = /KW\s*(\d{1,2})(?:\s*(?:-|–|—|bis)\s*(\d{1,2}))?(?:\s*[/ ]\s*(\d{4}))?/gi;
const KLASSE_ALLGEMEIN = /\b([A-Za-zÄÖÜäöü]{2,5})[\s-]?(\d{2})[\s-]?([A-Za-z])\b/;
const KEIN_UNTERRICHT = /ferien|feiertag|prüfung|pruefung|praktikum|betriebsphase|frei\b/i;

/** Zeiträume und Kalenderwochen in einer Zeile */
interface Fund {
  von: string;
  bis: string;
  unsicher: boolean;
  /** Spalte, an der der Zeitraum in der Zeile beginnt – für Pläne als Tabelle */
  spalte: number;
}
/** Zeitraum aller Daten mit Jahr im Plan (z. B. das Schuljahr) – daran richtet sich das Jahr von Daten ohne Jahr */
interface Spanne {
  von: string;
  bis: string;
}

function zeitraeumeIn(zeile: string, kontextJahr: number, spanne?: Spanne): Fund[] {
  const ergebnis: Fund[] = [];
  for (const m of zeile.matchAll(ZEITRAUM)) {
    const j2 = m[6] ? Number(zweistellig(m[6])) : null;
    const j1 = m[3] ? Number(zweistellig(m[3])) : null;
    // ohne jedes Jahr: das Jahr, mit dem der Zeitraum in die Spanne des Plans fällt (Schuljahr über den Jahreswechsel)
    let jahrOhne = kontextJahr;
    if (!j1 && !j2 && spanne) {
      const passt = [kontextJahr, kontextJahr + 1, kontextJahr - 1].find((j) => {
        const v = gueltig(j, Number(m[5]), Number(m[4]));
        return v && v >= plusTage(spanne.von, -45) && v <= plusTage(spanne.bis, 45);
      });
      if (passt) jahrOhne = passt;
    }
    const jahrBis = j2 ?? j1 ?? jahrOhne;
    // ohne Jahr beim Beginn: das Jahr des Endes – liegt der Beginn dann nach dem Ende, war es das Jahr davor
    let jahrVon = j1 ?? jahrBis;
    if (!j1 && (Number(m[2]) > Number(m[5]) || (Number(m[2]) === Number(m[5]) && Number(m[1]) > Number(m[4])))) jahrVon = jahrBis - 1;
    const von = gueltig(jahrVon, Number(m[2]), Number(m[1]));
    const bis = gueltig(jahrBis, Number(m[5]), Number(m[4]));
    if (!von || !bis || bis < von) continue;
    ergebnis.push({ von, bis, unsicher: !j2 && !j1, spalte: m.index ?? 0 });
  }
  for (const m of zeile.matchAll(KW)) {
    const jahr = m[3] ? Number(m[3]) : kontextJahr;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (a < 1 || a > 53 || b < a || b > 53) continue;
    ergebnis.push({ von: montagDerKw(jahr, a), bis: plusTage(montagDerKw(jahr, b), 4), unsicher: !m[3], spalte: m.index ?? 0 });
  }
  return ergebnis;
}

const zeichen = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Muster für einen Klassennamen: Leerzeichen, Bindestriche und Punkte dazwischen sind egal, davor und danach kein Buchstabe und keine Ziffer */
function klassenMuster(name: string): RegExp | null {
  const teile = [...name.replace(/[\s\-_./]/g, '')];
  return teile.length ? new RegExp(`(?<![\\p{L}\\d])${teile.map(zeichen).join('[\\s\\-_./]?')}(?![\\p{L}\\d])`, 'giu') : null;
}

/** Angelegte Klassen mit ihrer Spalte in der Zeile */
function klassenMitSpalte(zeile: string, bekannt: Pick<Klasse, 'name'>[]): { klasse: string; spalte: number }[] {
  const funde: { klasse: string; spalte: number; ende: number }[] = [];
  for (const k of bekannt) {
    const re = klassenMuster(k.name);
    if (!re) continue;
    for (const m of zeile.matchAll(re)) {
      const spalte = m.index ?? 0;
      // längere Namen zuerst: was schon zu einer anderen Klasse gehört, zählt nicht doppelt
      if (funde.some((f) => spalte < f.ende && spalte + m[0].length > f.spalte)) continue;
      funde.push({ klasse: k.name, spalte, ende: spalte + m[0].length });
    }
  }
  return funde.sort((a, b) => a.spalte - b.spalte).map(({ klasse, spalte }) => ({ klasse, spalte }));
}

const BLOCKNAME = /^[A-ZÄÖÜ]{1,2}\d{1,2}(?:\.\d{1,2})?$/;
/** sieht aus wie (ein Teil von) einem Klassennamen: „VT6a“, „FI-25a“, „25a“, „FI“ */
const KLASSENARTIG = /^(?:\p{L}{0,5}-?\d{1,2}\p{L}{0,2}|\p{L}{1,3})$/u;

/**
 * Eine Zeile einer Tabelle mit Klassen: mindestens drei Zellen, fast nur Klassennamen, mindestens eine angelegte Klasse.
 * Die Zellen sind alle Klassennamen der Zeile – auch die nicht angelegten, damit ein Zeitraum nicht der falschen Spalte zufällt.
 */
interface Zelle {
  klasse: string | null;
  spalte: number;
  /** Mitte der Zelle in der Zeile – Texte darunter (Themen) stehen meist mittig */
  mitte: number;
}
function klassenReihe(zeile: string, bekannt: Pick<Klasse, 'name'>[]): Zelle[] | null {
  const woerter = [...zeile.matchAll(/\S+/g)].map((m) => ({ wort: m[0], spalte: m.index ?? 0 }));
  if (woerter.length < 3 || woerter.filter((w) => KLASSENARTIG.test(w.wort)).length < woerter.length * 0.8) return null;
  const bekannte = klassenMitSpalte(zeile, bekannt).map((k) => ({ ...k, ende: k.spalte + (zeile.slice(k.spalte).match(klassenMuster(k.klasse) ?? /$/)?.[0].length ?? 0) }));
  if (!bekannte.length) return null;
  const zellen: Zelle[] = bekannte.map((k) => ({ klasse: k.klasse, spalte: k.spalte, mitte: (k.spalte + k.ende) / 2 }));
  for (const w of woerter) {
    if (!KLASSENARTIG.test(w.wort) || bekannte.some((k) => w.spalte >= k.spalte && w.spalte < k.ende)) continue;
    // „FI 25c“: der zweite Teil gehört zur Zelle davor
    const davor = zellen.filter((z) => z.spalte < w.spalte).sort((a, b) => b.spalte - a.spalte)[0];
    if (davor && !davor.klasse && w.spalte - davor.spalte <= 4) continue;
    zellen.push({ klasse: null, spalte: w.spalte, mitte: w.spalte + w.wort.length / 2 });
  }
  return zellen.length >= 3 ? zellen.sort((a, b) => a.spalte - b.spalte) : null;
}
const median = (l: number[]) => [...l].sort((a, b) => a - b)[Math.floor(l.length / 2)] ?? 0;

/**
 * Plan als Tabelle: je Block eine Spalte, darin die Zeiträume, darunter Zeilen mit den Klassen, die den Block haben
 * (der Text kommt aus pdftotext -layout, die Spalten bleiben an ihrer Stelle). Jeder Zeitraum gehört in jeder
 * Klassenzeile zu der Klasse, die in seiner Spalte steht. Eine Kopfzeile mit Blocknamen („A1  B1  C1 …“) gibt den Titel.
 */
function ausTabelle(zeilen: string[], bekannt: Pick<Klasse, 'name'>[], zeitraeume: (zeile: string) => Fund[]): Roh[] | null {
  const reihen = zeilen.flatMap((z, i) => {
    const zellen = klassenReihe(z, bekannt);
    return zellen ? [{ zeile: i, zellen }] : [];
  });
  if (!reihen.length) return null;
  const weiteVon = (zellen: Zelle[]) => Math.max(4, median(zellen.slice(1).map((r, i) => r.spalte - zellen[i].spalte)) * 0.6);
  // Thema je Klasse und Block: der Text unter der Klassenzeile (bis zur nächsten Zeile mit Team, Ausbildungsjahr, Tagen,
  // Datum oder Klassen), Stück für Stück der Zelle zugeordnet, über deren Mitte er steht
  const themen = new Map<Zelle, string>();
  for (const r of reihen) {
    const weite = weiteVon(r.zellen);
    for (const zeile of zeilen.slice(r.zeile + 1, r.zeile + 9)) {
      if (!zeile.trim()) continue;
      if (/\bTeam\b|Ausbildungsjahr|\bTage\b/i.test(zeile) || zeitraeume(zeile).length || klassenReihe(zeile, bekannt)) break;
      for (const m of zeile.matchAll(/\S+(?: \S+)*/g)) {
        const mitte = (m.index ?? 0) + m[0].length / 2;
        const z = [...r.zellen].sort((a, b) => Math.abs(a.mitte - mitte) - Math.abs(b.mitte - mitte))[0];
        if (!z || Math.abs(z.mitte - mitte) > weite) continue;
        const bisher = themen.get(z) ?? '';
        // „Prüfungs-“ + „vorbereitung“ = „Prüfungsvorbereitung“, „Video/Netzwerk/“ + „Software“ ohne Leerzeichen
        const neu = !bisher ? m[0] : /-$/.test(bisher) && /^\p{Ll}/u.test(m[0]) ? bisher.slice(0, -1) + m[0] : /[/-]$/.test(bisher) ? bisher + m[0] : `${bisher} ${m[0]}`;
        themen.set(z, neu.slice(0, 100));
      }
    }
  }
  const kopf = zeilen
    .map((z) => [...z.matchAll(/\S+/g)].map((m) => ({ name: m[0], spalte: m.index ?? 0 })))
    .find((t) => t.length >= 3 && t.every((x) => BLOCKNAME.test(x.name)));
  const ergebnis: Roh[] = [];
  const naechste = <T extends { spalte: number }>(liste: T[], spalte: number, weite: number): T | undefined => {
    const t = [...liste].sort((a, b) => Math.abs(a.spalte - spalte) - Math.abs(b.spalte - spalte))[0];
    return t && Math.abs(t.spalte - spalte) <= weite ? t : undefined;
  };
  for (const zeile of zeilen) {
    if (KEIN_UNTERRICHT.test(zeile)) continue;
    for (const f of zeitraeume(zeile)) {
      for (const { zellen } of reihen) {
        // höchstens gut eine halbe Spaltenbreite daneben
        const weite = weiteVon(zellen);
        const k = naechste(zellen, f.spalte, weite);
        if (!k?.klasse) continue;
        const block = kopf ? naechste(kopf, f.spalte, weite) : undefined;
        const thema = themen.get(k);
        const titel = [block ? `Block ${block.name}` : '', thema ?? ''].filter(Boolean).join(' – ') || 'Berufsschule';
        ergebnis.push({ klasse: k.klasse, von: f.von, bis: f.bis, titel: titel.slice(0, 120), unsicher: f.unsicher });
      }
    }
  }
  return ergebnis;
}

/**
 * Ein Zeitraum, der ganz in einem anderen derselben Klasse liegt, ist meist ein Termin im Block (z. B. „Praktische
 * Zwischenprüfung 20.03. - 24.03.“ im Block 20.03. - 31.03.) – kein eigener Schulblock. Doppelte fallen auch weg.
 */
function ohneEnthaltene(roh: Roh[]): Roh[] {
  return roh.filter((r, i) => !roh.some((x, j) => j !== i && x.klasse === r.klasse && x.von <= r.von && x.bis >= r.bis && (x.von !== r.von || x.bis !== r.bis || j < i)));
}

/** Die angelegten Klassen, die in einer Zeile stehen – auch mehrere („FI 25a, FI 25b“), in ihrer Schreibweise im Portal */
function klassenIn(zeile: string, bekannt: Pick<Klasse, 'name'>[]): string[] {
  let kurz = norm(zeile);
  const gefunden: string[] = [];
  for (const k of bekannt) {
    const n = norm(k.name);
    if (!n || !kurz.includes(n)) continue;
    gefunden.push(k.name);
    kurz = kurz.split(n).join('|');
  }
  return gefunden;
}

/**
 * Sucht im Text eines Schulplans nach Zeiträumen der **angelegten** Klassen. Andere Namen (z. B. „Block 2“ oder eine
 * Klasse, die es im Portal noch nicht gibt) gelten nicht als Klasse. Zeilen über Ferien, Feiertage, Prüfungen und
 * Praktika zählen nicht.
 *
 * Zwei Aufbauten kommen vor – welcher gilt, entscheidet, was zuerst im Plan steht:
 * - **Klasse zuerst** (eine Zeile je Klasse, oder die Klasse als Überschrift): Zeiträume ohne Klasse gehören zur zuletzt
 *   genannten. Steht in der Zeile ein anderer Klassenname, gehört sie zu keiner angelegten Klasse.
 * - **Block zuerst** (Zeiträume eines Blocks, darunter die Klassen, die ihn haben): Die Klassen bekommen die Zeiträume
 *   darüber, bis wieder Zeiträume kommen.
 * Ohne angelegte Klasse im Text kommen die Zeiträume ohne Klasse in die Vorschau – zum Zuordnen.
 */
export function erkenneBloecke(text: string, klassen: Pick<Klasse, 'name'>[], heuteIso: string): Roh[] {
  const jahre = [...text.matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1]));
  const kontextJahr = jahre[0] ?? Number(heuteIso.slice(0, 4));
  const bekannt = [...klassen].sort((a, b) => b.name.length - a.name.length);
  const roheZeilen = text.replace(/\r/g, '').split(/[\n\f]/);
  const mitJahr = roheZeilen.flatMap((z) => zeitraeumeIn(z, kontextJahr)).filter((f) => !f.unsicher);
  const spanne = mitJahr.length ? { von: mitJahr.map((f) => f.von).sort()[0], bis: mitJahr.map((f) => f.bis).sort().at(-1) as string } : undefined;
  const lies = (z: string) => zeitraeumeIn(z, kontextJahr, spanne);
  // Klassen in mehreren Spalten nebeneinander: ein Plan als Tabelle
  const tabelle = ausTabelle(roheZeilen, bekannt, lies);
  if (tabelle) return ohneEnthaltene(tabelle);
  const zeilen = roheZeilen
    .filter((z) => z.trim())
    .map((z) => ({ klassen: klassenIn(z, bekannt), zeitraeume: KEIN_UNTERRICHT.test(z) ? [] : lies(z), fremd: KLASSE_ALLGEMEIN.test(z) }));
  const erste = zeilen.find((z) => (z.klassen.length > 0) !== (z.zeitraeume.length > 0));
  const blockZuerst = !!erste && erste.zeitraeume.length > 0;
  const ergebnis: Roh[] = [];
  const trage = (ks: string[], zs: Fund[]) => {
    for (const z of zs) for (const k of ks.length ? ks : ['']) ergebnis.push({ klasse: k, von: z.von, bis: z.bis, titel: 'Berufsschule', unsicher: z.unsicher });
  };
  let letzte: string[] = [];
  let offen: { zeitraeume: Fund[]; klassen: string[] } = { zeitraeume: [], klassen: [] };
  for (const z of zeilen) {
    if (z.klassen.length && z.zeitraeume.length) {
      trage(z.klassen, z.zeitraeume);
      letzte = z.klassen;
    } else if (blockZuerst) {
      if (z.zeitraeume.length) {
        if (offen.klassen.length) {
          trage(offen.klassen, offen.zeitraeume);
          offen = { zeitraeume: [], klassen: [] };
        }
        offen.zeitraeume.push(...z.zeitraeume);
      } else if (z.klassen.length) offen.klassen.push(...z.klassen);
    } else if (z.klassen.length) letzte = z.klassen;
    else if (z.zeitraeume.length) {
      // ein anderer Klassenname in der Zeile: Das ist nicht die zuletzt genannte angelegte Klasse
      if (z.fremd) letzte = [];
      else trage(letzte, z.zeitraeume);
    }
  }
  if (blockZuerst) trage(offen.klassen, offen.zeitraeume);
  // stehen angelegte Klassen im Plan, gehört ein Zeitraum ohne Klasse zu einer anderen
  return ohneEnthaltene(ergebnis.some((r) => r.klasse) ? ergebnis.filter((r) => r.klasse) : ergebnis);
}

/** Nur angelegte Klassen – in ihrer Schreibweise im Portal; andere Zeilen fallen weg (Zeilen ohne Klasse bleiben). */
export function nurAngelegte(roh: Roh[], klassen: Pick<Klasse, 'name'>[]): Roh[] {
  return roh.flatMap((r) => {
    if (!r.klasse) return [r];
    const k = klassen.find((x) => norm(x.name) === norm(r.klasse));
    return k ? [{ ...r, klasse: k.name }] : [];
  });
}

/** Antwort des Sprachmodells: nur, was in die feste Form passt */
export function ausModell(json: unknown): Roh[] {
  const bloecke = (json as { bloecke?: unknown })?.bloecke;
  if (!Array.isArray(bloecke)) return [];
  return bloecke.slice(0, MAX_ZEILEN).flatMap((b): Roh[] => {
    const x = (b ?? {}) as Record<string, unknown>;
    if (!gueltigesDatum(x.von) || !gueltigesDatum(x.bis)) return [];
    const klasse = typeof x.klasse === 'string' ? x.klasse.trim().slice(0, 40) : '';
    const titel = typeof x.titel === 'string' && x.titel.trim() ? x.titel.trim().slice(0, 80) : 'Berufsschule';
    return [{ klasse, von: x.von, bis: x.bis, titel, unsicher: false }];
  });
}

/**
 * Muster zuerst, das Sprachmodell ergänzt: Findet es denselben Zeitraum, übernimmt die Vorschau seinen Titel und seine
 * Schreibweise der Klasse; was nur das Modell gefunden hat, kommt als „bitte prüfen“ dazu – aber nur, wenn beide Daten
 * so im Text stehen.
 */
export function zusammenfuehren(muster: Roh[], modell: Roh[], text: string): Roh[] {
  const ergebnis = muster.map((r) => ({ ...r }));
  for (const m of modell) {
    const gleich = ergebnis.find((r) => r.von === m.von && r.bis === m.bis && (!r.klasse || !m.klasse || norm(r.klasse) === norm(m.klasse)));
    if (gleich) {
      if (m.titel && m.titel !== 'Berufsschule') gleich.titel = m.titel;
      if (!gleich.klasse && m.klasse) gleich.klasse = m.klasse;
      continue;
    }
    // denselben Zeitraum haben die Muster schon einer Klasse zugeordnet (z. B. über die Spalte einer Tabelle) – das gilt
    if (muster.some((r) => r.von === m.von && r.bis === m.bis)) continue;
    if (!stehtImText(text, m.von) || !stehtImText(text, m.bis)) continue;
    ergebnis.push({ ...m, unsicher: true, nurModell: true });
  }
  return ergebnis;
}

// ---------- Vorschau ----------

export interface Zeile {
  klasseText: string;
  klasseId: number | null;
  von: string;
  bis: string;
  titel: string;
  hinweise: string[];
  unsicher: boolean;
  /** schon vorhanden oder nicht zuzuordnen – anfangs nicht angehakt */
  vorgewaehlt: boolean;
  /** Blöcke der Klasse, die sich mit diesem Zeitraum überschneiden (nicht genau gleich) – lassen sich ersetzen */
  ueberschneidung: { id: number; von: string; bis: string; titel: string }[];
  /** so viele Azubis der Klasse haben in diesen Wochen schon einen eigenen Eintrag „Berufsschule“ (ohne Klasse) */
  eigeneEintraege: number;
}

const tt = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;

/** Blöcke der Klasse, die sich mit dem Zeitraum überschneiden, aber nicht genau gleich sind (Wochen über ihren Montag) */
function ueberschneidendeBloecke(db: DB, klasseId: number, von: string, bis: string): { id: number; von: string; bis: string; titel: string }[] {
  const v = montagVon(von);
  const b = montagVon(bis);
  return db.prepare('SELECT id, von, bis, titel FROM schulblock WHERE klasse_id = ? AND von <= ? AND bis >= ? AND NOT (von = ? AND bis = ?) ORDER BY von').all(klasseId, b, v, v, b) as unknown as { id: number; von: string; bis: string; titel: string }[];
}

/** Aktive Azubis der Klasse mit einem eigenen Eintrag „Berufsschule“ (nicht von der Klasse) in diesen Wochen – je Azubi die Einträge */
function azubisMitEigenemEintrag(db: DB, klasseId: number, von: string, bis: string): { azubi: number; eintraege: number[] }[] {
  const zeilen = db
    .prepare(
      `SELECT e.azubi_id AS azubi, e.id FROM plan_eintrag e JOIN azubi_profil p ON p.benutzer_id = e.azubi_id JOIN benutzer b ON b.id = e.azubi_id
        WHERE p.klasse_id = ? AND b.status = 'aktiv' AND e.art = 'schule' AND e.schulblock_id IS NULL AND e.von <= ? AND e.bis >= ?`,
    )
    .all(klasseId, montagVon(bis), montagVon(von)) as unknown as { azubi: number; id: number }[];
  const je = new Map<number, number[]>();
  for (const z of zeilen) je.set(z.azubi, [...(je.get(z.azubi) ?? []), z.id]);
  return [...je].map(([azubi, eintraege]) => ({ azubi, eintraege }));
}

/** Prüft die gefundenen Zeiträume gegen Klassen, vorhandene Blöcke, Ferien und genehmigten Urlaub. */
export function vorschau(k: Kontext, schuleId: number, roh: Roh[]): Zeile[] {
  const { db } = k;
  const schule = db.prepare('SELECT bundesland FROM berufsschule WHERE id = ?').get(schuleId) as { bundesland: string } | undefined;
  const klassen = db.prepare('SELECT * FROM klasse WHERE berufsschule_id = ?').all(schuleId) as unknown as Klasse[];
  const ferien = schule ? ladeFerien(k.cfg.contentDir, schule.bundesland, k.log) : null;
  const tag = heute(k.jetzt());
  const frueheste = plusTage(tag, -366);
  const spaeteste = plusTage(tag, 366 * 3);
  const gesehen = new Set<string>();
  const zeilen: Zeile[] = [];
  for (const r of roh) {
    const passend = r.klasse ? klassen.find((x) => norm(x.name) === norm(r.klasse)) : klassen.length === 1 ? klassen[0] : undefined;
    const schluessel = `${passend?.id ?? norm(r.klasse)}|${r.von}|${r.bis}`;
    if (gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    const hinweise: string[] = [];
    let ok = true;
    if (r.von < frueheste || r.bis > spaeteste) {
      hinweise.push('liegt weit in der Vergangenheit oder Zukunft – bitte prüfen');
      ok = false;
    }
    if (montagVon(r.bis) > plusTage(montagVon(r.von), 7 * 25)) {
      hinweise.push('länger als 26 Wochen – so lässt sich der Block nicht übernehmen');
      ok = false;
    }
    if (!passend) hinweise.push('keine Klasse erkannt – bitte zuordnen');
    let ueberschneidung: Zeile['ueberschneidung'] = [];
    let eigeneEintraege = 0;
    if (passend) {
      const vorhanden = db.prepare('SELECT 1 FROM schulblock WHERE klasse_id = ? AND von = ? AND bis = ?').get(passend.id, montagVon(r.von), montagVon(r.bis));
      if (vorhanden) {
        hinweise.push('schon vorhanden');
        ok = false;
      } else {
        ueberschneidung = ueberschneidendeBloecke(db, passend.id, r.von, r.bis);
        if (ueberschneidung.length) {
          hinweise.push(`überschneidet sich mit ${ueberschneidung.map((b) => `„${b.titel}“ (${tt(b.von)}–${tt(plusTage(b.bis, 4))})`).join(', ')}`);
          ok = false;
        }
      }
      eigeneEintraege = azubisMitEigenemEintrag(db, passend.id, r.von, r.bis).length;
      if (eigeneEintraege > 0) hinweise.push(`${eigeneEintraege === 1 ? 'ein Azubi hat' : `${eigeneEintraege} Azubis haben`} in diesen Wochen schon einen eigenen Eintrag „Berufsschule“`);
      const urlaub = (
        db
          .prepare(
            `SELECT COUNT(DISTINCT u.azubi_id) AS n FROM urlaub_antrag u JOIN azubi_profil p ON p.benutzer_id = u.azubi_id
              WHERE p.klasse_id = ? AND u.status = 'genehmigt' AND u.von <= ? AND u.bis >= ?`,
          )
          .get(passend.id, r.bis, r.von) as { n: number }
      ).n;
      if (urlaub > 0) hinweise.push(`${urlaub === 1 ? 'ein Azubi hat' : `${urlaub} Azubis haben`} dort genehmigten Urlaub`);
    }
    const inFerien = ferien ? ferienZwischen(ferien, r.von, r.bis) : [];
    if (inFerien.length) hinweise.push(`liegt teils in den ${inFerien.map((f) => f.name).join(', ')} – bitte prüfen`);
    if (r.nurModell) {
      hinweise.push('nur vom Sprachmodell gefunden – bitte mit dem Plan vergleichen');
      ok = false;
    } else if (r.unsicher) hinweise.push('Jahr ergänzt oder per Texterkennung gelesen – bitte prüfen');
    zeilen.push({ klasseText: r.klasse, klasseId: passend?.id ?? null, von: r.von, bis: r.bis, titel: r.titel, hinweise, unsicher: r.unsicher || inFerien.length > 0, vorgewaehlt: ok && !!passend, ueberschneidung, eigeneEintraege });
    if (zeilen.length >= MAX_ZEILEN) break;
  }
  return zeilen.sort((a, b) => a.klasseText.localeCompare(b.klasseText) || a.von.localeCompare(b.von));
}

// ---------- Aufträge an den Dienst ----------

function stand(c: Ctx, a: Auftrag) {
  const st = standDes(c.k, a);
  const schuleId = Number(lies(join(a.ordner, 'schule')));
  if (st.status !== 'fertig') return { id: a.id, schuleId, ...st };
  const vomModell = st.modell ? ausModell(st.modell) : [];
  // die Muster des Portals zuerst – das Sprachmodell ergänzt nur (es verrechnet sich gelegentlich bei Daten)
  const klassen = c.k.db.prepare('SELECT * FROM klasse WHERE berufsschule_id = ?').all(schuleId) as unknown as Klasse[];
  const text = st.text.slice(0, MAX_TEXT);
  const muster = erkenneBloecke(text, klassen, heute(c.k.jetzt()));
  // auch beim Sprachmodell nur angelegte Klassen; Zeilen ohne Klasse nur, wenn die Muster keine Klasse gefunden haben
  const modell = nurAngelegte(vomModell, klassen).filter((r) => r.klasse || !muster.some((m) => m.klasse));
  let roh = zusammenfuehren(muster, modell, text);
  // bei Texterkennung ist alles etwas unsicherer
  if (st.quelle === 'texterkennung') roh = roh.map((r) => ({ ...r, unsicher: true }));
  return { id: a.id, status: 'fertig' as const, schuleId, quelle: st.quelle, modell: vomModell.length > 0, zeilen: vorschau(c.k, schuleId, roh) };
}

function schuleAus(c: Ctx, x: unknown): number {
  const id = Number(x);
  if (!Number.isInteger(id) || !c.k.db.prepare('SELECT 1 FROM berufsschule WHERE id = ?').get(id)) throw new Fehler(400, 'Bitte die Berufsschule wählen');
  return id;
}

const AUSBILDER: Route['wer'] = ['ausbilder'];

export const SCHULPLAN_ROUTEN: Route[] = [
  {
    m: 'GET',
    p: '/api/schulbloecke/einlesen',
    wer: AUSBILDER,
    h: (c) => {
      raeumeAuf(c.k);
      return { status: 200, body: { dienst: dienstBereit(c.k), auftraege: eigeneAuftraege(c.k, c.b.id, 'schulplan').map((a) => stand(c, a)) } };
    },
  },
  {
    // PDF (application/pdf, ?schule=…) oder JSON { schuleId, text }
    m: 'POST',
    p: '/api/schulbloecke/einlesen',
    wer: AUSBILDER,
    h: (c) => {
      raeumeAuf(c.k);
      const pdf = Buffer.isBuffer(c.a.body) ? c.a.body : null;
      const body = pdf ? {} : koerper(c);
      const schuleId = schuleAus(c, pdf ? c.a.query.get('schule') : body.schuleId);
      let text = '';
      if (pdf) {
        pruefePdf(c.k, pdf, 'PDFs liest der Dienst „import“ – er läuft gerade nicht. Kopiere den Text aus der PDF und füge ihn ein, oder bitte den Betreiber, den Dienst zu starten.');
      } else {
        text = typeof body.text === 'string' ? body.text.replace(/\r\n?/g, '\n').trim() : '';
        if (!text) throw new Fehler(400, 'Bitte den Text aus dem Plan der Schule einfügen');
        if (text.length > MAX_TEXT) throw new Fehler(400, `Der Text ist zu lang (höchstens ${MAX_TEXT.toLocaleString('de-DE')} Zeichen)`);
        // ohne Dienst: gleich selbst nach Mustern suchen
        if (!dienstBereit(c.k)) {
          const klassen = c.k.db.prepare('SELECT * FROM klasse WHERE berufsschule_id = ?').all(schuleId) as unknown as Klasse[];
          return { status: 200, body: { status: 'fertig', quelle: 'text', modell: false, zeilen: vorschau(c.k, schuleId, erkenneBloecke(text, klassen, heute(c.k.jetzt()))) } };
        }
      }
      // das Sprachmodell soll nur die angelegten Klassen zuordnen – es bekommt ihre Namen vor den Text
      const namen = (c.k.db.prepare('SELECT name FROM klasse WHERE berufsschule_id = ? ORDER BY name').all(schuleId) as { name: string }[]).map((k) => k.name);
      const id = neuerAuftrag(c.k, c.b.id, 'schulplan', pdf ? { pdf } : { text }, { schule: String(schuleId), 'klassen.txt': namen.join('\n') });
      return { status: 202, body: { id, status: 'laeuft', fortschritt: 0 } };
    },
  },
  { m: 'GET', p: '/api/schulbloecke/einlesen/:id', wer: AUSBILDER, h: (c) => ({ status: 200, body: stand(c, holeAuftrag(c.k, c.b.id, 'schulplan', c.p.id)) }) },
  {
    m: 'DELETE',
    p: '/api/schulbloecke/einlesen/:id',
    wer: AUSBILDER,
    h: (c) => {
      loescheAuftrag(c.k, c.b.id, 'schulplan', holeAuftrag(c.k, c.b.id, 'schulplan', c.p.id).id);
      return { status: 200, body: { ok: true } };
    },
  },
  {
    // Übernehmen, was der Ausbilder in der Vorschau angehakt hat – in einem Zug; danach ist der Auftrag weg
    m: 'POST',
    p: '/api/schulbloecke/uebernehmen',
    wer: AUSBILDER,
    h: (c) => {
      const { db } = c.k;
      const body = koerper(c);
      const zeilen = body.zeilen;
      if (!Array.isArray(zeilen) || zeilen.length === 0 || zeilen.length > MAX_ZEILEN) throw new Fehler(400, 'Keine Schulblöcke zum Übernehmen gewählt');
      const ersetzt = new Set<number>();
      const eigeneEntfernen = body.eigeneEntfernen === true;
      const neu = zeilen.map((z, i) => {
        const x = (z ?? {}) as Record<string, unknown>;
        const klasse = klasseVon(db, Number(x.klasseId));
        if (!klasse) throw new Fehler(400, `Zeile ${i + 1}: Bitte eine Klasse wählen`);
        if (!gueltigesDatum(x.von) || !gueltigesDatum(x.bis)) throw new Fehler(400, `Zeile ${i + 1}: Datum fehlt oder ist ungültig`);
        const von = montagVon(x.von);
        const bis = montagVon(x.bis);
        if (bis < von) throw new Fehler(400, `Zeile ${i + 1}: Das Ende liegt vor dem Beginn`);
        if (bis > plusTage(von, 7 * 25)) throw new Fehler(400, `Zeile ${i + 1}: höchstens 26 Wochen`);
        const titel = typeof x.titel === 'string' && x.titel.trim() ? x.titel.trim().slice(0, 120) : 'Berufsschule';
        if (/[\u0000-\u001f\u007f]/.test(titel)) throw new Fehler(400, `Zeile ${i + 1}: Der Titel enthält unzulässige Zeichen`);
        // vorhandene Blöcke derselben Klasse ersetzen (sie überschneiden sich mit diesem Zeitraum)
        const ersetzenRoh = Array.isArray(x.ersetzen) ? x.ersetzen : [];
        if (ersetzenRoh.length > 20) throw new Fehler(400, `Zeile ${i + 1}: zu viele Blöcke zum Ersetzen`);
        const ersetzen = ersetzenRoh.map((id) => {
          const b = db.prepare('SELECT id FROM schulblock WHERE id = ? AND klasse_id = ?').get(Number(id), klasse.id) as { id: number } | undefined;
          if (!b) throw new Fehler(400, `Zeile ${i + 1}: Der Block zum Ersetzen gehört nicht zu dieser Klasse`);
          if (ersetzt.has(b.id)) throw new Fehler(400, `Zeile ${i + 1}: Derselbe Block soll zweimal ersetzt werden`);
          ersetzt.add(b.id);
          return b.id;
        });
        return { klasse, von, bis, titel, ersetzen };
      });
      const jetzt = c.k.jetzt();
      const klassen = new Set<number>();
      let angelegt = 0;
      let ersetztAnzahl = 0;
      // eigene Einträge „Berufsschule“ der Azubis, die der neue Block ersetzt: je Azubi die erste Woche und die Anzahl
      const entfernt = new Map<number, { montag: string; anzahl: number }>();
      transaktion(db, () => {
        for (const z of neu) {
          if (z.ersetzen.length) {
            // der erste überschneidende Block bekommt den neuen Zeitraum, die übrigen fallen weg – bei allen Azubis der Klasse
            db.prepare('UPDATE schulblock SET von = ?, bis = ?, titel = ?, geaendert = ?, geaendert_von = ? WHERE id = ?').run(z.von, z.bis, z.titel, jetzt.toISOString(), c.b.id, z.ersetzen[0]);
            for (const id of z.ersetzen.slice(1)) db.prepare('DELETE FROM schulblock WHERE id = ?').run(id);
            ersetztAnzahl += z.ersetzen.length;
          } else if (db.prepare('SELECT 1 FROM schulblock WHERE klasse_id = ? AND von = ? AND bis = ?').get(z.klasse.id, z.von, z.bis)) continue;
          else {
            db.prepare('INSERT INTO schulblock (klasse_id, von, bis, titel, text, geaendert, geaendert_von) VALUES (?, ?, ?, ?, ?, ?, ?)').run(z.klasse.id, z.von, z.bis, z.titel, '', jetzt.toISOString(), c.b.id);
            angelegt++;
          }
          klassen.add(z.klasse.id);
          if (eigeneEntfernen) {
            for (const { azubi, eintraege } of azubisMitEigenemEintrag(db, z.klasse.id, z.von, z.bis)) {
              for (const id of eintraege) db.prepare('DELETE FROM plan_eintrag WHERE id = ?').run(id);
              const vorher = entfernt.get(azubi);
              entfernt.set(azubi, { montag: vorher && vorher.montag < z.von ? vorher.montag : z.von, anzahl: (vorher?.anzahl ?? 0) + eintraege.length });
            }
          }
        }
        // der Azubi erfährt, dass Einträge in seinem Plan weggefallen sind
        for (const [azubi, e] of entfernt) merkeAktivitaet(db, jetzt, 'schule_geaendert', azubi, c.b, e.montag, '', e.anzahl);
        const azubis = new Set<number>();
        for (const id of klassen) {
          for (const a of db.prepare("SELECT p.benutzer_id AS id FROM azubi_profil p JOIN benutzer b ON b.id = p.benutzer_id WHERE p.klasse_id = ? AND b.status = 'aktiv'").all(id) as unknown as { id: number }[]) azubis.add(a.id);
        }
        for (const id of azubis) gleicheSchulbloeckeAb(db, jetzt, c.b, id);
        const entfernteEintraege = [...entfernt.values()].reduce((n, e) => n + e.anzahl, 0);
        protokolliere(db, jetzt, 'fach', 'schulblock_geaendert', c.b, null, `Plan der Schule eingelesen: ${angelegt} Schulblöcke übernommen${ersetztAnzahl ? `, ${ersetztAnzahl} ersetzt` : ''}${entfernteEintraege ? `, ${entfernteEintraege} eigene Einträge „Berufsschule“ entfernt` : ''}`);
      });
      loescheAuftrag(c.k, c.b.id, 'schulplan', body.auftrag);
      const azubis = (db.prepare(`SELECT COUNT(*) AS n FROM azubi_profil p JOIN benutzer b ON b.id = p.benutzer_id WHERE b.status = 'aktiv' AND p.klasse_id IN (${[...klassen].map(() => '?').join(',') || 'NULL'})`).get(...klassen) as { n: number }).n;
      return { status: 200, body: { angelegt, ersetzt: ersetztAnzahl, entfernt: [...entfernt.values()].reduce((n, e) => n + e.anzahl, 0), azubis } };
    },
  },
];
