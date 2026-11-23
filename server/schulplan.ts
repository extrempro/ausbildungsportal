import { randomBytes } from 'node:crypto';
import { accessSync, constants, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Fehler, koerper } from './api-basis';
import type { Ctx, Kontext, Route } from './api-basis';
import { transaktion } from './db';
import { heute } from './datum';
import { ferienZwischen, ladeFerien } from './ferien';
import { gueltigesDatum, montagVon, plusTage } from './kalender';
import { gleicheSchulbloeckeAb, klasseVon } from './klassen';
import type { Klasse } from './klassen';
import { protokolliere } from './protokoll';

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

const MAX_PDF = 10 * 1024 * 1024;
const MAX_TEXT = 40_000;
const MAX_ZEILEN = 300;
const MAX_AUFTRAEGE_JE_PERSON = 3;
const AUFBEWAHRUNG_MS = 24 * 3600_000;
/** so lange gilt das Lebenszeichen des Dienstes – ein großer Auftrag kann einige Minuten dauern */
const BEREIT_MS = 15 * 60_000;
const ID = /^[0-9a-f]{32}$/;

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
const zweistellig = (j: string) => (j.length === 2 ? `20${j}` : j);
const iso = (j: number, m: number, t: number) => `${j}-${String(m).padStart(2, '0')}-${String(t).padStart(2, '0')}`;
function gueltig(j: number, m: number, t: number): string | null {
  const s = iso(j, m, t);
  return gueltigesDatum(s) ? s : null;
}

/** Montag der ISO-Kalenderwoche */
function montagDerKw(jahr: number, kw: number): string {
  const vierter = new Date(Date.UTC(jahr, 0, 4));
  const montag1 = new Date(vierter.getTime() - ((vierter.getUTCDay() + 6) % 7) * 86_400_000);
  return new Date(montag1.getTime() + (kw - 1) * 7 * 86_400_000).toISOString().slice(0, 10);
}

const DATUM = String.raw`(\d{1,2})\.\s?(\d{1,2})\.(?:\s?(\d{4}|\d{2})(?!\d))?`;
const STRICH = String.raw`\s*(?:-|–|—|bis)\s*`;
const ZEITRAUM = new RegExp(`${DATUM}${STRICH}${DATUM}`, 'g');
const KW = /KW\s*(\d{1,2})(?:\s*(?:-|–|—|bis)\s*(\d{1,2}))?(?:\s*[/ ]\s*(\d{4}))?/gi;
const KLASSE_ALLGEMEIN = /\b([A-Za-zÄÖÜäöü]{2,5})[\s-]?(\d{2})[\s-]?([A-Za-z])\b/;
const KEIN_UNTERRICHT = /ferien|feiertag|prüfung|pruefung|praktikum|betriebsphase|frei\b/i;

/**
 * Sucht im Text eines Schulplans nach Zeiträumen und Klassen. Zeilen über Ferien, Feiertage, Prüfungen und Praktika
 * zählen nicht. Steht in einer Zeile keine Klasse, gilt die zuletzt genannte.
 */
export function erkenneBloecke(text: string, klassen: Pick<Klasse, 'name'>[], heuteIso: string): Roh[] {
  const jahre = [...text.matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1]));
  const kontextJahr = jahre[0] ?? Number(heuteIso.slice(0, 4));
  const bekannt = [...klassen].sort((a, b) => b.name.length - a.name.length);
  const ergebnis: Roh[] = [];
  let letzteKlasse = '';
  for (const zeile of text.replace(/\r/g, '').split('\n')) {
    if (!zeile.trim()) continue;
    const kurz = norm(zeile);
    const k = bekannt.find((x) => norm(x.name) && kurz.includes(norm(x.name)));
    const allgemein = KLASSE_ALLGEMEIN.exec(zeile);
    const klasse = k?.name ?? (allgemein ? allgemein[0].trim() : '');
    if (klasse) letzteKlasse = klasse;
    if (KEIN_UNTERRICHT.test(zeile)) continue;
    for (const m of zeile.matchAll(ZEITRAUM)) {
      const j2 = m[6] ? Number(zweistellig(m[6])) : null;
      const j1 = m[3] ? Number(zweistellig(m[3])) : null;
      const jahrBis = j2 ?? j1 ?? kontextJahr;
      // ohne Jahr beim Beginn: das Jahr des Endes – liegt der Beginn dann nach dem Ende, war es das Jahr davor
      let jahrVon = j1 ?? jahrBis;
      if (!j1 && (Number(m[2]) > Number(m[5]) || (Number(m[2]) === Number(m[5]) && Number(m[1]) > Number(m[4])))) jahrVon = jahrBis - 1;
      const von = gueltig(jahrVon, Number(m[2]), Number(m[1]));
      const bis = gueltig(jahrBis, Number(m[5]), Number(m[4]));
      if (!von || !bis || bis < von) continue;
      ergebnis.push({ klasse: klasse || letzteKlasse, von, bis, titel: 'Berufsschule', unsicher: !j2 && !j1 });
    }
    for (const m of zeile.matchAll(KW)) {
      const jahr = m[3] ? Number(m[3]) : kontextJahr;
      const a = Number(m[1]);
      const b = m[2] ? Number(m[2]) : a;
      if (a < 1 || a > 53 || b < a || b > 53) continue;
      ergebnis.push({ klasse: klasse || letzteKlasse, von: montagDerKw(jahr, a), bis: plusTage(montagDerKw(jahr, b), 4), titel: 'Berufsschule', unsicher: !m[3] });
    }
  }
  return ergebnis;
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
 * Steht ein Datum so im Text? (Tag und Monat, mit oder ohne führende Null – oder die Kalenderwoche.)
 * Sprachmodelle erfinden gelegentlich Daten; was so nicht im Plan steht, kommt nicht in die Vorschau.
 */
function stehtImText(text: string, datum: string): boolean {
  const t = Number(datum.slice(8, 10));
  const m = Number(datum.slice(5, 7));
  if (new RegExp(`(^|\\D)0?${t}\\.\\s?0?${m}\\.`).test(text)) return true;
  // Kalenderwoche des Montags dieser Woche
  const montag = new Date(`${montagVon(datum)}T00:00:00Z`);
  const donnerstag = new Date(montag.getTime() + 3 * 86_400_000);
  const kw = Math.floor((donnerstag.getTime() - Date.UTC(donnerstag.getUTCFullYear(), 0, 1)) / 86_400_000 / 7) + 1;
  return new RegExp(`KW\\s*(\\d{1,2}\\s*(-|–|—|bis)\\s*)?0?${kw}(\\D|$)`, 'i').test(text) || new RegExp(`KW\\s*0?${kw}(\\D|$)`, 'i').test(text);
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
    if (!passend) hinweise.push(r.klasse ? `Klasse „${r.klasse}“ gibt es an dieser Schule nicht – zuordnen oder anlegen` : 'keine Klasse erkannt – bitte zuordnen');
    if (passend) {
      const vorhanden = db.prepare('SELECT 1 FROM schulblock WHERE klasse_id = ? AND von = ? AND bis = ?').get(passend.id, montagVon(r.von), montagVon(r.bis));
      if (vorhanden) {
        hinweise.push('schon vorhanden');
        ok = false;
      }
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
    zeilen.push({ klasseText: r.klasse, klasseId: passend?.id ?? null, von: r.von, bis: r.bis, titel: r.titel, hinweise, unsicher: r.unsicher || inFerien.length > 0, vorgewaehlt: ok && !!passend });
    if (zeilen.length >= MAX_ZEILEN) break;
  }
  return zeilen.sort((a, b) => a.klasseText.localeCompare(b.klasseText) || a.von.localeCompare(b.von));
}

// ---------- Aufträge an den Dienst ----------

export function importOrdner(k: Kontext): string {
  return join(k.cfg.dataDir, 'import');
}

/**
 * Beim Start: den Austauschordner selbst anlegen – sonst legt ihn Docker für den Dienst „import“ als root an,
 * und weder der Dienst noch die App dürfen dort schreiben. Gehört er schon root, steht im Log, was zu tun ist.
 */
export function bereiteImportOrdner(dataDir: string, warne: (text: string) => void = console.warn): void {
  const ordner = join(dataDir, 'import');
  try {
    mkdirSync(ordner, { recursive: true });
    accessSync(ordner, constants.W_OK);
  } catch {
    warne(`WARNUNG: In ${ordner} darf die App nicht schreiben – PDFs lesen (Dienst „import“) geht so nicht. Auf dem Server im Ordner des Portals: sudo chown -R 1000:1000 data/import`);
  }
}

export function dienstBereit(k: Kontext): boolean {
  try {
    return k.jetzt().getTime() - statSync(join(importOrdner(k), '.bereit')).mtimeMs < BEREIT_MS;
  } catch {
    return false;
  }
}

function lies(pfad: string): string | null {
  try {
    return readFileSync(pfad, 'utf8');
  } catch {
    return null;
  }
}

/** Alte Aufträge (älter als 24 Stunden) löschen – samt Datei und Text */
function raeumeAuf(k: Kontext): void {
  const ordner = importOrdner(k);
  if (!existsSync(ordner)) return;
  for (const name of readdirSync(ordner)) {
    if (!ID.test(name)) continue;
    try {
      if (k.jetzt().getTime() - statSync(join(ordner, name)).mtimeMs > AUFBEWAHRUNG_MS) rmSync(join(ordner, name), { recursive: true, force: true });
    } catch {
      // schon weg
    }
  }
}

interface Auftrag {
  id: string;
  wer: number;
  schuleId: number;
}

function eigeneAuftraege(k: Kontext, wer: number): Auftrag[] {
  const ordner = importOrdner(k);
  if (!existsSync(ordner)) return [];
  return readdirSync(ordner)
    .filter((n) => ID.test(n))
    .map((id) => ({ id, wer: Number(lies(join(ordner, id, 'wer'))), schuleId: Number(lies(join(ordner, id, 'schule'))) }))
    .filter((a) => a.wer === wer);
}

function holeAuftrag(c: Ctx): Auftrag {
  const id = String(c.p.id ?? '');
  const a = ID.test(id) ? eigeneAuftraege(c.k, c.b.id).find((x) => x.id === id) : undefined;
  if (!a) throw new Fehler(404, 'Diesen Auftrag gibt es nicht (mehr)');
  return a;
}

function stand(c: Ctx, a: Auftrag) {
  const d = join(importOrdner(c.k), a.id);
  const fehler = lies(join(d, 'fehler'));
  if (fehler) return { id: a.id, status: 'fehler' as const, fehler: fehler.trim().slice(0, 200) };
  const fertig = lies(join(d, 'fertig'));
  if (!fertig) return { id: a.id, status: 'laeuft' as const, fortschritt: Number(lies(join(d, 'fortschritt'))) || 0, dienst: dienstBereit(c.k) };
  const modell = /modell=ja/.test(fertig);
  const quelle = /quelle=texterkennung/.test(fertig) ? 'texterkennung' : /quelle=pdf/.test(fertig) ? 'pdf' : 'text';
  let vomModell: Roh[] = [];
  if (modell) {
    try {
      vomModell = ausModell(JSON.parse(lies(join(d, 'ergebnis.json')) ?? '{}'));
    } catch {
      vomModell = [];
    }
  }
  // die Muster des Portals zuerst – das Sprachmodell ergänzt nur (es verrechnet sich gelegentlich bei Daten)
  const klassen = c.k.db.prepare('SELECT * FROM klasse WHERE berufsschule_id = ?').all(a.schuleId) as unknown as Klasse[];
  const text = (lies(join(d, 'text.txt')) ?? '').slice(0, MAX_TEXT);
  let roh = zusammenfuehren(erkenneBloecke(text, klassen, heute(c.k.jetzt())), vomModell, text);
  const ausModellGenutzt = vomModell.length > 0;
  // bei Texterkennung ist alles etwas unsicherer
  if (quelle === 'texterkennung') roh = roh.map((r) => ({ ...r, unsicher: true }));
  return { id: a.id, status: 'fertig' as const, quelle, modell: ausModellGenutzt, zeilen: vorschau(c.k, a.schuleId, roh) };
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
      return { status: 200, body: { dienst: dienstBereit(c.k), auftraege: eigeneAuftraege(c.k, c.b.id).map((a) => stand(c, a)) } };
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
        if (pdf.length === 0 || pdf.length > MAX_PDF) throw new Fehler(400, 'Die PDF ist leer oder größer als 10 MB');
        if (!pdf.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Fehler(400, 'Das ist keine PDF-Datei');
        if (!dienstBereit(c.k)) throw new Fehler(409, 'PDFs liest der Dienst „import“ – er läuft gerade nicht. Kopiere den Text aus der PDF und füge ihn ein, oder bitte den Betreiber, den Dienst zu starten.');
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
      if (eigeneAuftraege(c.k, c.b.id).length >= MAX_AUFTRAEGE_JE_PERSON) throw new Fehler(409, 'Du hast schon mehrere Pläne in Arbeit. Übernimm oder verwirf erst einen.');
      const id = randomBytes(16).toString('hex');
      const d = join(importOrdner(c.k), id);
      mkdirSync(d, { recursive: true, mode: 0o700 });
      writeFileSync(join(d, 'wer'), String(c.b.id));
      writeFileSync(join(d, 'schule'), String(schuleId));
      writeFileSync(join(d, 'art'), 'schulplan');
      if (pdf) writeFileSync(join(d, 'eingang.pdf'), pdf);
      else writeFileSync(join(d, 'eingang.txt'), text);
      writeFileSync(join(d, 'auftrag'), '');
      return { status: 202, body: { id, status: 'laeuft', fortschritt: 0 } };
    },
  },
  { m: 'GET', p: '/api/schulbloecke/einlesen/:id', wer: AUSBILDER, h: (c) => ({ status: 200, body: stand(c, holeAuftrag(c)) }) },
  {
    m: 'DELETE',
    p: '/api/schulbloecke/einlesen/:id',
    wer: AUSBILDER,
    h: (c) => {
      const a = holeAuftrag(c);
      rmSync(join(importOrdner(c.k), a.id), { recursive: true, force: true });
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
        return { klasse, von, bis, titel };
      });
      const jetzt = c.k.jetzt();
      const klassen = new Set<number>();
      let angelegt = 0;
      transaktion(db, () => {
        for (const z of neu) {
          if (db.prepare('SELECT 1 FROM schulblock WHERE klasse_id = ? AND von = ? AND bis = ?').get(z.klasse.id, z.von, z.bis)) continue;
          db.prepare('INSERT INTO schulblock (klasse_id, von, bis, titel, text, geaendert, geaendert_von) VALUES (?, ?, ?, ?, ?, ?, ?)').run(z.klasse.id, z.von, z.bis, z.titel, '', jetzt.toISOString(), c.b.id);
          klassen.add(z.klasse.id);
          angelegt++;
        }
        const azubis = new Set<number>();
        for (const id of klassen) {
          for (const a of db.prepare("SELECT p.benutzer_id AS id FROM azubi_profil p JOIN benutzer b ON b.id = p.benutzer_id WHERE p.klasse_id = ? AND b.status = 'aktiv'").all(id) as unknown as { id: number }[]) azubis.add(a.id);
        }
        for (const id of azubis) gleicheSchulbloeckeAb(db, jetzt, c.b, id);
        protokolliere(db, jetzt, 'fach', 'schulblock_geaendert', c.b, null, `Plan der Schule eingelesen: ${angelegt} Schulblöcke übernommen`);
      });
      const id = typeof body.auftrag === 'string' && ID.test(body.auftrag) ? body.auftrag : null;
      if (id && eigeneAuftraege(c.k, c.b.id).some((a) => a.id === id)) rmSync(join(importOrdner(c.k), id), { recursive: true, force: true });
      const azubis = (db.prepare(`SELECT COUNT(*) AS n FROM azubi_profil p JOIN benutzer b ON b.id = p.benutzer_id WHERE b.status = 'aktiv' AND p.klasse_id IN (${[...klassen].map(() => '?').join(',') || 'NULL'})`).get(...klassen) as { n: number }).n;
      return { status: 200, body: { angelegt, azubis } };
    },
  },
];
