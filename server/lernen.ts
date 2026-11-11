import { sammleEintraege } from './lernen/kompendium';
import type { Eintrag } from './lernen/kompendium';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Fehler } from './api-basis';
import type { Ctx, Kontext, Route } from './api-basis';
import type { DB } from './db';
import { transaktion } from './db';
import { hoechsteVon, HOECHSTE_STUFE, naechste, OHNE_QUIZ, rangVon, STUFEN, stufeVon } from './lernen/abzeichen';
import { bewerte, frageMitLoesung, frageOhneLoesung, ihkNote } from './lernen/pruefung';
import type { Uebungssatz } from './lernen/pruefung';
import { FAECHER, kartenVon, MEISTER_TAGE, mische, naechstesFach, optionenFuer, QUIZ_BESTANDEN, quizFragen, zufall } from './lernen/ueben';
import type { FeldStand } from './lernen/abzeichen';
import { ladeInhalte, unterthemaIndex, zusatzIds } from './lernen/store';
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
  /** woher das Paket kommt: vom Betreiber als Ordner eingebunden oder über das Portal eingereicht und übernommen */
  herkunft: 'ordner' | 'portal';
  /** Ordner des Pakets – für die Unterlagen (dokumente/) */
  pfad: string;
}

/** Hier liegen Pakete, die über das Portal eingereicht und vom Super-Admin übernommen wurden. Sie gehen vor gleichnamige aus LERN_DIR. */
export function portalLernDir(cfg: Pick<Kontext['cfg'], 'dataDir'>): string {
  return join(cfg.dataDir, 'lerninhalte');
}

interface Lager {
  geprueft: number;
  pakete: Map<string, Paket>;
}
const LAGER = new Map<string, Lager>();

function marke(ordner: string): string {
  // meta.json wird bei jeder Inhaltspflege angefasst (Inhaltsstand); dazu die Themenliste
  return ['meta.json', 'themenfelder.json', 'paket.json', 'themen', 'pruefung', 'dokumente.json', 'dokumente']
    .map((d) => {
      const p = join(ordner, d);
      return existsSync(p) ? statSync(p).mtimeMs : 0;
    })
    .join(':');
}

/** Alle Inhaltspakete aus LERN_DIR und aus dem Portal-Ordner; liest neu ein, wenn sich Dateien geändert haben. */
export function lernpakete(k: Kontext): Map<string, Paket> {
  const dir = `${k.cfg.lernDir}|${portalLernDir(k.cfg)}`;
  let lager = LAGER.get(dir);
  const jetzt = Date.now();
  if (lager && jetzt - lager.geprueft < PRUEF_ABSTAND_MS) return lager.pakete;
  lager ??= { geprueft: 0, pakete: new Map() };
  lager.geprueft = jetzt;
  LAGER.set(dir, lager);

  // erst die Ordner des Betreibers, dann die über das Portal übernommenen – bei gleichem Namen gilt das übernommene Paket
  const ordner = new Map<string, { name: string; pfad: string; herkunft: Paket['herkunft'] }>();
  for (const [wurzel, herkunft] of [[k.cfg.lernDir, 'ordner'], [portalLernDir(k.cfg), 'portal']] as const) {
    if (!existsSync(wurzel)) continue;
    for (const e of readdirSync(wurzel, { withFileTypes: true })) {
      if (!(e.isDirectory() || e.isSymbolicLink()) || !PAKET_ID.test(e.name) || !existsSync(join(wurzel, e.name, 'themenfelder.json'))) continue;
      ordner.set(e.name, { name: e.name, pfad: join(wurzel, e.name), herkunft });
    }
  }
  const gefunden = new Set<string>();
  for (const e of ordner.values()) {
    const pfad = e.pfad;
    gefunden.add(e.name);
    const m = `${e.herkunft}:${marke(pfad)}`;
    const alt = lager.pakete.get(e.name);
    if (alt && alt.marke === m) continue;
    let inhalte: Inhalte;
    try {
      inhalte = ladeInhalte(pfad, alt?.inhalte);
    } catch (f) {
      // z. B. Datei ohne Leserecht: als Fehler des Pakets zeigen statt die ganze Seite scheitern zu lassen
      inhalte = alt?.inhalte ?? { themenfelder: [], meta: { stand: '' }, umbenennungen: {}, meldungen: [], pruefung: [], dokumente: [] };
      inhalte = { ...inhalte, meldungen: [{ level: 'fehler', datei: e.name, text: `Inhalte nicht lesbar: ${(f as Error).message}` }] };
    }
    let info: { titel?: unknown; quelle?: unknown; lizenz?: unknown } = {};
    try {
      if (existsSync(join(pfad, 'paket.json'))) info = JSON.parse(readFileSync(join(pfad, 'paket.json'), 'utf8')) as typeof info;
    } catch (f) {
      k.log(`Lernpaket „${e.name}“: paket.json nicht lesbar – ${(f as Error).message}`);
    }
    const text = (x: unknown) => (typeof x === 'string' ? x.trim().slice(0, 200) : '');
    const paket: Paket = { id: e.name, titel: text(info.titel) || e.name, quelle: text(info.quelle), lizenz: text(info.lizenz), inhalte, marke: m, herkunft: e.herkunft, pfad };
    lager.pakete.set(e.name, paket);
    const fehler = inhalte.meldungen.filter((x) => x.level === 'fehler');
    k.log(`Lernpaket „${paket.titel}“ (${e.name}) geladen: ${inhalte.themenfelder.length} Themenfelder, Stand ${inhalte.meta.stand || 'unbekannt'}${fehler.length ? `, ${fehler.length} Fehler` : ''}`);
    for (const f of fehler.slice(0, 10)) k.log(`  ✖ ${f.datei}${f.zeile ? `:${f.zeile}` : ''}  ${f.text}`);
    uebernimmAenderungen(k.db, paket);
  }
  for (const id of [...lager.pakete.keys()]) if (!gefunden.has(id)) lager.pakete.delete(id);
  return lager.pakete;
}

/** Beim nächsten Zugriff sofort nach geänderten Paketen sehen (nach einer Übernahme über das Portal). */
export function pruefeLernpaketeSofort(): void {
  for (const l of LAGER.values()) l.geprueft = 0;
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
      db.prepare(
        `UPDATE lern_zusatz SET zusatz_id = ?
          WHERE paket = ? AND zusatz_id = ?
            AND NOT EXISTS (SELECT 1 FROM lern_zusatz n WHERE n.azubi_id = lern_zusatz.azubi_id AND n.paket = lern_zusatz.paket AND n.zusatz_id = ?)`,
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
      herkunft: p.herkunft,
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

/** Kennungen ('themenfeld.zusatz') des Zusatzwissens, das dieser Azubi als gelesen abgehakt hat. */
function gelesenVon(db: DB, azubiId: number, paket: string): Set<string> {
  return new Set((db.prepare('SELECT zusatz_id FROM lern_zusatz WHERE azubi_id = ? AND paket = ?').all(azubiId, paket) as { zusatz_id: string }[]).map((z) => z.zusatz_id));
}

interface Verweis {
  feld: string;
  feldTitel: string;
  id: string;
  titel: string;
}

/** Unterthema ('themenfeld.unterthema') → Zusatzwissen, das es vertieft. Je Inhaltsstand einmal berechnet. */
const VERTIEFUNG = new WeakMap<Inhalte, Map<string, Verweis[]>>();
function vertiefungen(inhalte: Inhalte): Map<string, Verweis[]> {
  let m = VERTIEFUNG.get(inhalte);
  if (m) return m;
  m = new Map();
  for (const f of inhalte.themenfelder) for (const z of f.zusatz) for (const ref of z.zu) m.set(ref, [...(m.get(ref) ?? []), { feld: f.id, feldTitel: f.titel, id: z.id, titel: z.titel }]);
  VERTIEFUNG.set(inhalte, m);
  return m;
}

/** 'themenfeld.unterthema' → Titel und Ziel des Unterthemas (für „Vertieft: …“ am Zusatzwissen). */
function unterthemaVerweis(inhalte: Inhalte, ref: string): Verweis | null {
  const [feld, id] = ref.split('.');
  const f = inhalte.themenfelder.find((x) => x.id === feld);
  const u = f?.unterthemen.find((x) => x.id === id);
  return f && u ? { feld: f.id, feldTitel: f.titel, id: u.id, titel: u.titel } : null;
}

interface AbzeichenStand {
  /** je Themenfeld: erreichte Stufe (0 = keine), wann, und was bis zur nächsten fehlt */
  felder: Map<string, { stufe: number; name: string | null; erreicht: string | null; fehlt: string; fortschritt: number; hoechste: number }>;
  rang: { stufe: number; name: string | null; noetig: number; felder: number; hoechste: number; naechste: { stufe: number; name: string; haben: number } | null };
  /** in diesem Aufruf neu erreichte Stufen */
  neu: { feld: string; feldTitel: string; stufe: number; name: string }[];
}

/**
 * Gleicht die Abzeichen mit dem Lernstand ab: Wer eine höhere Stufe erreicht hat, bekommt sie gutgeschrieben.
 * Eine erreichte Stufe bleibt – auch wenn die Ampel zurückgestellt wird oder neue Inhalte dazukommen.
 */
function abzeichenVon(c: Ctx, p: Paket): AbzeichenStand {
  const { db } = c.k;
  const stand = standVon(db, c.b.id, p.id);
  const gelesen = gelesenVon(db, c.b.id, p.id);
  const alt = new Map((db.prepare('SELECT feld_id, stufe, erreicht FROM lern_abzeichen WHERE azubi_id = ? AND paket = ?').all(c.b.id, p.id) as unknown as { feld_id: string; stufe: number; erreicht: string }[]).map((z) => [z.feld_id, { stufe: z.stufe, erreicht: z.erreicht }]));
  const heute = c.k.jetzt().toISOString().slice(0, 10);
  const quiz = quizFragen(p.inhalte);
  const quizStand = new Map((db.prepare('SELECT unterthema_id, bestanden_am, meister_am FROM lern_quiz WHERE azubi_id = ? AND paket = ?').all(c.b.id, p.id) as unknown as { unterthema_id: string; bestanden_am: string | null; meister_am: string | null }[]).map((z) => [z.unterthema_id, z]));
  let mitQuiz = 0;
  const felder: AbzeichenStand['felder'] = new Map();
  const neu: AbzeichenStand['neu'] = [];
  for (const f of p.inhalte.themenfelder) {
    const s: FeldStand = {
      unterthemen: f.unterthemen.length,
      bearbeitet: f.unterthemen.filter((u) => (stand.get(`${f.id}.${u.id}`)?.status ?? 'rot') !== 'rot').length,
      zusatz: f.zusatz.length,
      zusatzGelesen: f.zusatz.filter((z) => gelesen.has(`${f.id}.${z.id}`)).length,
      quiz: f.unterthemen.filter((u) => quiz.has(`${f.id}.${u.id}`)).length,
      quizBestanden: f.unterthemen.filter((u) => quiz.has(`${f.id}.${u.id}`) && quizStand.get(`${f.id}.${u.id}`)?.bestanden_am).length,
      quizMeister: f.unterthemen.filter((u) => quiz.has(`${f.id}.${u.id}`) && quizStand.get(`${f.id}.${u.id}`)?.meister_am).length,
    };
    if (s.quiz > 0) mitQuiz++;
    let hat = alt.get(f.id) ?? { stufe: 0, erreicht: null as string | null };
    const jetzt = stufeVon(s);
    if (jetzt > hat.stufe) {
      db.prepare('INSERT INTO lern_abzeichen (azubi_id, paket, feld_id, stufe, erreicht) VALUES (?, ?, ?, ?, ?) ON CONFLICT(azubi_id, paket, feld_id) DO UPDATE SET stufe = excluded.stufe, erreicht = excluded.erreicht').run(c.b.id, p.id, f.id, jetzt, heute);
      hat = { stufe: jetzt, erreicht: heute };
      neu.push({ feld: f.id, feldTitel: f.titel, stufe: jetzt, name: STUFEN[jetzt - 1] });
    }
    felder.set(f.id, { stufe: hat.stufe, name: hat.stufe ? STUFEN[hat.stufe - 1] : null, erreicht: hat.erreicht, ...naechste(hat.stufe, s), hoechste: hoechsteVon(s) });
  }
  // der Rang kann nur so hoch steigen, wie genug Themenfelder ein Quiz haben
  const noetig = Math.max(1, Math.ceil(felder.size / 2));
  const hoechste = mitQuiz >= noetig ? HOECHSTE_STUFE : OHNE_QUIZ;
  const r = rangVon([...felder.values()].map((x) => x.stufe), hoechste);
  return { felder, neu, rang: { stufe: r.stufe, name: r.stufe ? STUFEN[r.stufe - 1] : null, noetig: r.noetig, felder: felder.size, hoechste, naechste: r.naechste && { ...r.naechste, name: STUFEN[r.naechste.stufe - 1] } } };
}

/** Für die Antwort nach dem Speichern: ein neu erreichtes Abzeichen und, falls er gestiegen ist, der neue Rang. */
function nachSpeichern(c: Ctx, p: Paket, rangVorher: number) {
  const a = abzeichenVon(c, p);
  return { abzeichen: a.neu[0] ?? null, rang: a.rang.stufe > rangVorher ? { stufe: a.rang.stufe, name: a.rang.name } : null };
}
function rangJetzt(c: Ctx, p: Paket): number {
  const hat = new Map((c.k.db.prepare('SELECT feld_id, stufe FROM lern_abzeichen WHERE azubi_id = ? AND paket = ?').all(c.b.id, p.id) as unknown as { feld_id: string; stufe: number }[]).map((z) => [z.feld_id, z.stufe]));
  return rangVon(p.inhalte.themenfelder.map((f) => hat.get(f.id) ?? 0)).stufe;
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

/** je geladenem Inhaltsstand einmal gesammelt; neu geladene Inhalte sind ein neues Objekt */
const KOMPENDIUM = new WeakMap<Inhalte, Eintrag[]>();

type Themenfeld = Inhalte['themenfelder'][number];
type FeldAbzeichen = AbzeichenStand['felder'] extends Map<string, infer T> ? T : never;
const OHNE_ABZEICHEN: FeldAbzeichen = { stufe: 0, name: null, erreicht: null, fehlt: '', fortschritt: 0, hoechste: 0 };

/** Übersicht eines Pakets: Themenfelder mit Unterthemen und Zusatzwissen – mit dem Stand eines Azubis oder (Leseansicht) ohne. */
function uebersicht(p: Paket, stand: Map<string, StatusZeile>, gelesen: Set<string>, abz: AbzeichenStand['felder'] | null) {
  return p.inhalte.themenfelder.map((f) => ({
    abzeichen: abz?.get(f.id) ?? OHNE_ABZEICHEN,
    zusatz: f.zusatz.map((z) => ({ id: z.id, titel: z.titel, gelesen: gelesen.has(`${f.id}.${z.id}`) })),
    id: f.id,
    titel: f.titel,
    icon: f.icon,
    lernfelder: f.lernfelder,
    pruefung: f.pruefung,
    unterthemen: f.unterthemen.map((u) => {
      const s = stand.get(`${f.id}.${u.id}`);
      return { id: u.id, titel: u.titel, status: s?.status ?? 'rot', lernpunkt: !!s && s.status === 'gelb' && s.luecke.trim() !== '', inhaltAktualisiert: aktualisiert(s, u.hash) };
    }),
  }));
}

/** Ein Themenfeld mit allen Inhalten (Cheatsheet) – mit dem Stand eines Azubis oder (Leseansicht) ohne. */
function themaAnsicht(p: Paket, f: Themenfeld, stand: Map<string, StatusZeile>, gelesen: Set<string>, abzeichen: FeldAbzeichen) {
  const vertieft = vertiefungen(p.inhalte);
  return {
    abzeichen,
    // Zusatzwissen: zählt nicht zur Ampel, nur ein Haken „gelesen“
    zusatz: f.zusatz.map(({ ablaufDatei: _a, zu, ...z }) => ({
      ...z,
      zu: zu.map((ref) => unterthemaVerweis(p.inhalte, ref)).filter((v): v is Verweis => v !== null),
      gelesen: gelesen.has(`${f.id}.${z.id}`),
    })),
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
      return { ...inhalt, vertiefung: vertieft.get(`${f.id}.${u.id}`) ?? [], status: s?.status ?? 'rot', luecke: s?.luecke ?? '', notiz: s?.notiz ?? '', geaendert: s?.geaendert ?? null, inhaltAktualisiert: aktualisiert(s, u.hash) };
    }),
  };
}

interface QuizZeile {
  unterthema_id: string;
  versuche: number;
  letzte_richtig: number;
  letzte_gesamt: number;
  zuletzt: string;
  bestanden_am: string | null;
  meister_am: string | null;
}

/** Stand eines Quiz für die Anzeige: offen → bestanden → Meister; dazu, ab wann die Meister-Runde zählt. */
function quizAnsicht(id: string, titel: string, fragen: number, z: QuizZeile | undefined, heute: string) {
  const meisterAb = z?.bestanden_am ? new Date(new Date(`${z.bestanden_am}T00:00:00Z`).getTime() + MEISTER_TAGE * 86_400_000).toISOString().slice(0, 10) : null;
  return {
    id,
    titel,
    fragen,
    stand: z?.meister_am ? 'meister' : z?.bestanden_am ? 'bestanden' : 'offen',
    versuche: z?.versuche ?? 0,
    zuletzt: z ? { richtig: z.letzte_richtig, gesamt: z.letzte_gesamt, am: z.zuletzt } : null,
    /** ab diesem Tag zählt eine fehlerfreie Runde für „Meister“ */
    meisterAb,
    meisterMoeglich: !!meisterAb && !z?.meister_am && meisterAb <= heute,
  };
}

function quizVon(p: Paket, id: string) {
  const fragen = UNTERTHEMA_ID.test(id) ? quizFragen(p.inhalte).get(id) : undefined;
  if (!fragen) throw new Fehler(404, 'Zu diesem Unterthema gibt es kein Quiz');
  const [feld, unterthema] = id.split('.');
  const f = p.inhalte.themenfelder.find((x) => x.id === feld)!;
  return { fragen, feld, unterthema, feldTitel: f.titel, titel: f.unterthemen.find((u) => u.id === unterthema)!.titel };
}

function kompendium(p: Paket) {
  let eintraege = KOMPENDIUM.get(p.inhalte);
  if (!eintraege) KOMPENDIUM.set(p.inhalte, (eintraege = sammleEintraege(p.inhalte.themenfelder)));
  return { paket: paketKopf(p), themenfelder: p.inhalte.themenfelder.map((f) => ({ id: f.id, titel: f.titel })), eintraege };
}

/** Leseansicht für Ausbilder und Beauftragte: das Paket aus der Adresse – jedes gültige Paket auf dem Server. */
function lesePaket(c: Ctx): Paket {
  const p = PAKET_ID.test(c.p.paket ?? '') ? lernpakete(c.k).get(c.p.paket) : undefined;
  if (!p) throw new Fehler(404, 'Dieses Lernmodul gibt es nicht');
  return p;
}
const BETREUUNG: ('ausbilder' | 'beauftragter')[] = ['ausbilder', 'beauftragter'];

// ---------- Prüfung: Übungssätze und Unterlagen ----------

interface PruefZeile {
  satz_id: string;
  versuche: number;
  letzte_punkte: number;
  letzte_gesamt: number;
  beste_prozent: number;
  zuletzt: string;
}

/** Übersicht „Prüfung“: Übungssätze (mit eigenem Stand des Azubis) und die Unterlagen, die diese Rolle sehen darf. */
function pruefungAnsicht(p: Paket, betreuung: boolean, stand: Map<string, PruefZeile>) {
  return {
    paket: paketKopf(p),
    saetze: p.inhalte.pruefung.map((s) => {
      const z = stand.get(s.id);
      return {
        id: s.id,
        titel: s.titel,
        gruppe: s.gruppe,
        beschreibung: s.beschreibung,
        fragen: s.fragen.length,
        probetest: s.umfasst.length > 0,
        stand: z ? { versuche: z.versuche, punkte: z.letzte_punkte, gesamt: z.letzte_gesamt, besteProzent: z.beste_prozent, am: z.zuletzt } : null,
      };
    }),
    dokumente: p.inhalte.dokumente.filter((d) => betreuung || !d.nurBetreuung).map((d) => ({ datei: d.datei, titel: d.titel, gruppe: d.gruppe, nurBetreuung: d.nurBetreuung, groesse: d.groesse })),
  };
}

function satzVon(p: Paket, id: string): Uebungssatz {
  const s = p.inhalte.pruefung.find((x) => x.id === id);
  if (!s) throw new Fehler(404, 'Diesen Übungssatz gibt es nicht');
  return s;
}

const satzKopf = (s: Uebungssatz) => ({ id: s.id, titel: s.titel, gruppe: s.gruppe, beschreibung: s.beschreibung, probetest: s.umfasst.length > 0 });

/** Eine Unterlage als PDF – nur, wenn sie in dokumente.json steht und diese Rolle sie sehen darf. */
function dokumentDatei(p: Paket, datei: string, betreuung: boolean) {
  const d = p.inhalte.dokumente.find((x) => x.datei === datei);
  if (!d || (d.nurBetreuung && !betreuung)) throw new Fehler(404, 'Diese Unterlage gibt es nicht');
  let inhalt: Buffer;
  try {
    inhalt = readFileSync(join(p.pfad, 'dokumente', d.datei));
  } catch {
    throw new Fehler(404, 'Diese Unterlage ist gerade nicht lesbar');
  }
  const name = `${d.gruppe ? `${d.gruppe} – ` : ''}${d.titel}.pdf`.replace(/[\\/:*?"<>|]/g, '-');
  return { status: 200, datei: { typ: 'application/pdf', inhalt, dateiname: name } };
}

export const LERN_ROUTEN: Route[] = [
  {
    // Übersicht: alle Themenfelder mit dem eigenen Stand je Unterthema – ohne die Inhalte selbst
    m: 'GET',
    p: '/api/lernen',
    wer: ['azubi'],
    h: (c) => {
      const p = meinPaket(c);
      // wer schon vor den Abzeichen gelernt hat, bekommt sie hier still gutgeschrieben
      const abz = abzeichenVon(c, p);
      return { status: 200, body: { paket: paketKopf(p), rang: abz.rang, themenfelder: uebersicht(p, standVon(c.k.db, c.b.id, p.id), gelesenVon(c.k.db, c.b.id, p.id), abz.felder) } };
    },
  },

  {
    // Kompendium: alle Bausteine aus allen Cheatsheets zum Nachschlagen – nur Inhalte, kein Lernstand
    m: 'GET',
    p: '/api/lernen/kompendium',
    wer: ['azubi'],
    h: (c) => {
      const p = meinPaket(c);
      return { status: 200, body: kompendium(p) };
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
      return { status: 200, body: { paket: paketKopf(p), thema: themaAnsicht(p, f, standVon(c.k.db, c.b.id, p.id), gelesenVon(c.k.db, c.b.id, p.id), abzeichenVon(c, p).felder.get(f.id)!) } };
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
      const rangVorher = rangJetzt(c, p);
      db.prepare(
        `INSERT INTO lern_status (azubi_id, paket, unterthema_id, status, luecke, notiz, inhalt_hash, geaendert) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(azubi_id, paket, unterthema_id) DO UPDATE SET status = excluded.status, luecke = excluded.luecke, notiz = excluded.notiz, inhalt_hash = excluded.inhalt_hash, geaendert = excluded.geaendert`,
      ).run(c.b.id, p.id, id, neu.status, neu.luecke, neu.notiz, neu.inhalt_hash, neu.geaendert);
      return { status: 200, body: { id, status: neu.status, luecke: neu.luecke, notiz: neu.notiz, geaendert: neu.geaendert, inhaltAktualisiert: false, ...nachSpeichern(c, p, rangVorher) } };
    },
  },

  {
    // Zusatzwissen als gelesen abhaken oder den Haken wieder entfernen
    m: 'PATCH',
    p: '/api/lernen/zusatz/:id',
    wer: ['azubi'],
    h: (c) => {
      const p = meinPaket(c);
      const id = c.p.id;
      if (!UNTERTHEMA_ID.test(id) || !zusatzIds(p.inhalte).has(id)) throw new Fehler(404, 'Dieses Zusatzwissen gibt es nicht');
      const gelesen = (c.a.body as { gelesen?: unknown } | null)?.gelesen;
      if (typeof gelesen !== 'boolean') throw new Fehler(400, 'gelesen muss wahr oder falsch sein');
      const rangVorher = rangJetzt(c, p);
      if (gelesen) c.k.db.prepare('INSERT INTO lern_zusatz (azubi_id, paket, zusatz_id, geaendert) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING').run(c.b.id, p.id, id, c.k.jetzt().toISOString().slice(0, 10));
      else c.k.db.prepare('DELETE FROM lern_zusatz WHERE azubi_id = ? AND paket = ? AND zusatz_id = ?').run(c.b.id, p.id, id);
      return { status: 200, body: { id, gelesen, ...nachSpeichern(c, p, rangVorher) } };
    },
  },

  // ---------- Üben: Karteikarten und Quiz – privat wie der übrige Lernstand ----------
  {
    // Übersicht: je Themenfeld die Zahl der Karten (und wie viele heute dran sind) und die Quiz mit ihrem Stand
    m: 'GET',
    p: '/api/lernen/ueben',
    wer: ['azubi'],
    h: (c) => {
      const p = meinPaket(c);
      const heute = c.k.jetzt().toISOString().slice(0, 10);
      const karten = kartenVon(p.inhalte);
      const stand = new Map((c.k.db.prepare('SELECT karte_id, fach, faellig FROM lern_karte WHERE azubi_id = ? AND paket = ?').all(c.b.id, p.id) as unknown as { karte_id: string; fach: number; faellig: string }[]).map((z) => [z.karte_id, z]));
      const quiz = quizFragen(p.inhalte);
      const qs = new Map((c.k.db.prepare('SELECT * FROM lern_quiz WHERE azubi_id = ? AND paket = ?').all(c.b.id, p.id) as unknown as QuizZeile[]).map((z) => [z.unterthema_id, z]));
      return {
        status: 200,
        body: {
          paket: paketKopf(p),
          faecher: FAECHER,
          themenfelder: p.inhalte.themenfelder.map((f) => {
            const ks = karten.filter((k) => k.feld === f.id);
            return {
              id: f.id,
              titel: f.titel,
              karten: ks.length,
              faellig: ks.filter((k) => (stand.get(k.id)?.faellig ?? '') <= heute).length,
              sicher: ks.filter((k) => (stand.get(k.id)?.fach ?? 0) >= 4).length,
              quiz: f.unterthemen
                .filter((u) => quiz.has(`${f.id}.${u.id}`))
                .map((u) => quizAnsicht(`${f.id}.${u.id}`, u.titel, quiz.get(`${f.id}.${u.id}`)!.length, qs.get(`${f.id}.${u.id}`), heute)),
              ohneQuiz: f.unterthemen.filter((u) => !quiz.has(`${f.id}.${u.id}`)).length,
            };
          }),
        },
      };
    },
  },
  {
    // Eine Runde Karteikarten: zuerst die fälligen (nie gesehene zählen dazu), niedrige Fächer vorn; „alle=1“ übt auch nicht fällige
    m: 'GET',
    p: '/api/lernen/karten',
    wer: ['azubi'],
    h: (c) => {
      const p = meinPaket(c);
      const feld = c.a.query.get('feld') ?? '';
      if (feld && !p.inhalte.themenfelder.some((f) => f.id === feld)) throw new Fehler(404, 'Dieses Themenfeld gibt es nicht');
      const heute = c.k.jetzt().toISOString().slice(0, 10);
      const stand = new Map((c.k.db.prepare('SELECT karte_id, fach, faellig FROM lern_karte WHERE azubi_id = ? AND paket = ?').all(c.b.id, p.id) as unknown as { karte_id: string; fach: number; faellig: string }[]).map((z) => [z.karte_id, z]));
      const alle = kartenVon(p.inhalte).filter((k) => !feld || k.feld === feld);
      const dran = alle.filter((k) => c.a.query.get('alle') === '1' || (stand.get(k.id)?.faellig ?? '') <= heute);
      const r = zufall(Number(c.a.query.get('runde')) || c.k.jetzt().getTime());
      const runde = dran
        .map((k) => ({ k, fach: stand.get(k.id)?.fach ?? 0, z: r() }))
        .sort((a, b) => a.fach - b.fach || a.z - b.z)
        .slice(0, 20);
      return { status: 200, body: { feldTitel: feld ? p.inhalte.themenfelder.find((f) => f.id === feld)!.titel : 'Alle Themenfelder', gesamt: alle.length, faellig: dran.length, karten: runde.map(({ k, fach }) => ({ ...k, fach })) } };
    },
  },
  {
    m: 'PATCH',
    p: '/api/lernen/karte',
    wer: ['azubi'],
    h: (c) => {
      const p = meinPaket(c);
      const body = c.a.body && typeof c.a.body === 'object' ? (c.a.body as Record<string, unknown>) : {};
      if (typeof body.id !== 'string' || !kartenVon(p.inhalte).some((k) => k.id === body.id)) throw new Fehler(404, 'Diese Karte gibt es nicht');
      if (typeof body.gewusst !== 'boolean') throw new Fehler(400, 'gewusst muss wahr oder falsch sein');
      const alt = (c.k.db.prepare('SELECT fach FROM lern_karte WHERE azubi_id = ? AND paket = ? AND karte_id = ?').get(c.b.id, p.id, body.id) as { fach: number } | undefined)?.fach ?? 0;
      const neu = naechstesFach(alt, body.gewusst);
      const jetzt = c.k.jetzt();
      const faellig = new Date(jetzt.getTime() + neu.tage * 86_400_000).toISOString().slice(0, 10);
      c.k.db
        .prepare('INSERT INTO lern_karte (azubi_id, paket, karte_id, fach, faellig, zuletzt) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(azubi_id, paket, karte_id) DO UPDATE SET fach = excluded.fach, faellig = excluded.faellig, zuletzt = excluded.zuletzt')
        .run(c.b.id, p.id, body.id, neu.fach, faellig, jetzt.toISOString().slice(0, 10));
      return { status: 200, body: { id: body.id, fach: neu.fach, faellig } };
    },
  },
  {
    // Quiz zu einem Unterthema: zu jeder Erklärung den passenden Begriff aus vier Möglichkeiten wählen
    m: 'GET',
    p: '/api/lernen/quiz/:id',
    wer: ['azubi'],
    h: (c) => {
      const p = meinPaket(c);
      const q = quizVon(p, c.p.id);
      const r = zufall(c.k.jetzt().getTime());
      const zeile = c.k.db.prepare('SELECT * FROM lern_quiz WHERE azubi_id = ? AND paket = ? AND unterthema_id = ?').get(c.b.id, p.id, c.p.id) as QuizZeile | undefined;
      return {
        status: 200,
        body: {
          ...quizAnsicht(c.p.id, q.titel, q.fragen.length, zeile, c.k.jetzt().toISOString().slice(0, 10)),
          feld: q.feld,
          feldTitel: q.feldTitel,
          bestehenAb: Math.ceil(q.fragen.length * QUIZ_BESTANDEN),
          // Reihenfolge und Antwortmöglichkeiten wechseln von Runde zu Runde
          fragen: q.fragen
            .map((f) => ({ f, z: r() }))
            .sort((a, b) => a.z - b.z)
            .map(({ f }) => ({ id: f.id, text: f.text, optionen: optionenFuer(p.inhalte, q.feld, q.unterthema, f, r), richtig: f.begriff })),
        },
      };
    },
  },
  {
    // Ergebnis einer Runde: Der Server zählt selbst nach – gewertet wird nur eine vollständige Runde
    m: 'POST',
    p: '/api/lernen/quiz/:id',
    wer: ['azubi'],
    h: (c) => {
      const p = meinPaket(c);
      const q = quizVon(p, c.p.id);
      const antworten = (c.a.body as { antworten?: unknown } | null)?.antworten;
      if (!antworten || typeof antworten !== 'object') throw new Fehler(400, 'Die Antworten fehlen');
      const a = antworten as Record<string, unknown>;
      if (q.fragen.some((f) => typeof a[f.id] !== 'string')) throw new Fehler(400, 'Die Runde ist nicht vollständig – jede Frage braucht eine Antwort');
      const falsch = q.fragen.filter((f) => a[f.id] !== f.begriff).map((f) => f.id);
      const gesamt = q.fragen.length;
      const richtig = gesamt - falsch.length;
      const bestanden = richtig >= Math.ceil(gesamt * QUIZ_BESTANDEN);
      const jetzt = c.k.jetzt();
      const heute = jetzt.toISOString().slice(0, 10);
      const alt = c.k.db.prepare('SELECT * FROM lern_quiz WHERE azubi_id = ? AND paket = ? AND unterthema_id = ?').get(c.b.id, p.id, c.p.id) as QuizZeile | undefined;
      const bestandenAm = alt?.bestanden_am ?? (bestanden ? heute : null);
      // Meister: fehlerfrei, und das Bestehen liegt mindestens eine Woche zurück
      const reif = !!alt?.bestanden_am && alt.bestanden_am <= new Date(jetzt.getTime() - MEISTER_TAGE * 86_400_000).toISOString().slice(0, 10);
      const meisterAm = alt?.meister_am ?? (reif && falsch.length === 0 ? heute : null);
      const rangVorher = rangJetzt(c, p);
      c.k.db
        .prepare(
          `INSERT INTO lern_quiz (azubi_id, paket, unterthema_id, versuche, letzte_richtig, letzte_gesamt, zuletzt, bestanden_am, meister_am) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)
           ON CONFLICT(azubi_id, paket, unterthema_id) DO UPDATE SET versuche = versuche + 1, letzte_richtig = excluded.letzte_richtig, letzte_gesamt = excluded.letzte_gesamt, zuletzt = excluded.zuletzt, bestanden_am = excluded.bestanden_am, meister_am = excluded.meister_am`,
        )
        .run(c.b.id, p.id, c.p.id, richtig, gesamt, heute, bestandenAm, meisterAm);
      const neu = c.k.db.prepare('SELECT * FROM lern_quiz WHERE azubi_id = ? AND paket = ? AND unterthema_id = ?').get(c.b.id, p.id, c.p.id) as unknown as QuizZeile;
      return { status: 200, body: { richtig, gesamt, bestanden, falsch, neuBestanden: bestanden && !alt?.bestanden_am, neuMeister: !!meisterAm && !alt?.meister_am, ...quizAnsicht(c.p.id, q.titel, gesamt, neu, heute), ...nachSpeichern(c, p, rangVorher) } };
    },
  },

  // ---------- Prüfung: Übungssätze mit Auswertung und Unterlagen – Ergebnisse privat wie der übrige Lernstand ----------
  {
    m: 'GET',
    p: '/api/lernen/pruefung',
    wer: ['azubi'],
    h: (c) => {
      const p = meinPaket(c);
      const stand = new Map((c.k.db.prepare('SELECT * FROM lern_pruefung WHERE azubi_id = ? AND paket = ?').all(c.b.id, p.id) as unknown as PruefZeile[]).map((z) => [z.satz_id, z]));
      return { status: 200, body: pruefungAnsicht(p, false, stand) };
    },
  },
  {
    // ein Übungssatz zum Bearbeiten: ohne Lösungen, die Antworten einer Auswahl in neuer Reihenfolge
    m: 'GET',
    p: '/api/lernen/pruefung/:id',
    wer: ['azubi'],
    h: (c) => {
      const p = meinPaket(c);
      const s = satzVon(p, c.p.id);
      const r = zufall(c.k.jetzt().getTime());
      return {
        status: 200,
        body: {
          ...satzKopf(s),
          fragen: s.fragen.map((f) => {
            const q = frageOhneLoesung(f);
            return { ...q, optionen: mische(q.optionen, r) };
          }),
        },
      };
    },
  },
  {
    // Auswertung: Der Server bewertet jede Frage, speichert das Ergebnis und gibt erst jetzt die Lösungen heraus
    m: 'POST',
    p: '/api/lernen/pruefung/:id',
    wer: ['azubi'],
    h: (c) => {
      const p = meinPaket(c);
      const s = satzVon(p, c.p.id);
      const antworten = (c.a.body as { antworten?: unknown } | null)?.antworten;
      if (!antworten || typeof antworten !== 'object' || Array.isArray(antworten)) throw new Fehler(400, 'Die Antworten fehlen');
      const a = antworten as Record<string, unknown>;
      const ergebnisse = s.fragen.map((f) => ({ ...frageMitLoesung(f), antwort: a[f.schluessel] ?? null, anteil: bewerte(f, a[f.schluessel]) }));
      const punkte = Math.round(ergebnisse.reduce((n, e) => n + e.anteil, 0) * 100) / 100;
      const gesamt = ergebnisse.length;
      const prozent = Math.round((punkte / gesamt) * 100);
      const heute = c.k.jetzt().toISOString().slice(0, 10);
      c.k.db
        .prepare(
          `INSERT INTO lern_pruefung (azubi_id, paket, satz_id, versuche, letzte_punkte, letzte_gesamt, beste_prozent, zuletzt) VALUES (?, ?, ?, 1, ?, ?, ?, ?)
           ON CONFLICT(azubi_id, paket, satz_id) DO UPDATE SET versuche = versuche + 1, letzte_punkte = excluded.letzte_punkte, letzte_gesamt = excluded.letzte_gesamt, beste_prozent = MAX(beste_prozent, excluded.beste_prozent), zuletzt = excluded.zuletzt`,
        )
        .run(c.b.id, p.id, s.id, punkte, gesamt, prozent, heute);
      const z = c.k.db.prepare('SELECT * FROM lern_pruefung WHERE azubi_id = ? AND paket = ? AND satz_id = ?').get(c.b.id, p.id, s.id) as unknown as PruefZeile;
      return { status: 200, body: { ...satzKopf(s), punkte, gesamt, prozent, note: ihkNote(prozent), versuche: z.versuche, besteProzent: z.beste_prozent, ergebnisse } };
    },
  },
  {
    m: 'GET',
    p: '/api/lernen/dokument/:datei',
    wer: ['azubi'],
    h: (c) => dokumentDatei(meinPaket(c), c.p.datei, false),
  },

  // ---------- Leseansicht für Ausbilder und Beauftragte: dieselben Inhalte, kein Lernstand ----------
  {
    // alle Lernmodule auf dem Server – auch solche, die noch an keinem Beruf eingeschaltet sind
    m: 'GET',
    p: '/api/lerninhalte',
    wer: BETREUUNG,
    h: (c) => {
      const berufe = c.k.db.prepare("SELECT lernpaket, bezeichnung, fachrichtung FROM beruf WHERE lernpaket IS NOT NULL AND lernpaket <> '' ORDER BY bezeichnung COLLATE NOCASE").all() as unknown as { lernpaket: string; bezeichnung: string; fachrichtung: string }[];
      return {
        status: 200,
        body: {
          pakete: [...lernpakete(c.k).values()]
            .sort((a, b) => a.titel.localeCompare(b.titel, 'de'))
            .map((p) => ({
              ...paketKopf(p),
              themenfelder: p.inhalte.themenfelder.length,
              unterthemen: p.inhalte.themenfelder.reduce((n, f) => n + f.unterthemen.length, 0),
              berufe: berufe.filter((b) => b.lernpaket === p.id).map((b) => (b.fachrichtung ? `${b.bezeichnung} (${b.fachrichtung})` : b.bezeichnung)),
            })),
        },
      };
    },
  },
  {
    m: 'GET',
    p: '/api/lerninhalte/:paket',
    wer: BETREUUNG,
    h: (c) => {
      const p = lesePaket(c);
      return { status: 200, body: { paket: paketKopf(p), themenfelder: uebersicht(p, new Map(), new Set(), null) } };
    },
  },
  {
    m: 'GET',
    p: '/api/lerninhalte/:paket/kompendium',
    wer: BETREUUNG,
    h: (c) => ({ status: 200, body: kompendium(lesePaket(c)) }),
  },
  {
    m: 'GET',
    p: '/api/lerninhalte/:paket/thema/:id',
    wer: BETREUUNG,
    h: (c) => {
      const p = lesePaket(c);
      const f = p.inhalte.themenfelder.find((x) => x.id === c.p.id);
      if (!f) throw new Fehler(404, 'Dieses Themenfeld gibt es nicht');
      return { status: 200, body: { paket: paketKopf(p), thema: themaAnsicht(p, f, new Map(), new Set(), OHNE_ABZEICHEN) } };
    },
  },
  {
    // Prüfung in der Leseansicht: alle Übungssätze und alle Unterlagen – auch die Lösungen
    m: 'GET',
    p: '/api/lerninhalte/:paket/pruefung',
    wer: BETREUUNG,
    h: (c) => ({ status: 200, body: pruefungAnsicht(lesePaket(c), true, new Map()) }),
  },
  {
    // ein Übungssatz mit allen Lösungen – zum Vorbereiten und Besprechen
    m: 'GET',
    p: '/api/lerninhalte/:paket/pruefung/:id',
    wer: BETREUUNG,
    h: (c) => {
      const s = satzVon(lesePaket(c), c.p.id);
      return { status: 200, body: { ...satzKopf(s), fragen: s.fragen.map(frageMitLoesung) } };
    },
  },
  {
    m: 'GET',
    p: '/api/lerninhalte/:paket/dokument/:datei',
    wer: BETREUUNG,
    h: (c) => dokumentDatei(lesePaket(c), c.p.datei, true),
  },
];
