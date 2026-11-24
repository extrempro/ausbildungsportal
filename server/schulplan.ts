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
const ZEITRAUM = new RegExp(`${DATUM}${STRICH}${DATUM}`, 'g');
const KW = /KW\s*(\d{1,2})(?:\s*(?:-|–|—|bis)\s*(\d{1,2}))?(?:\s*[/ ]\s*(\d{4}))?/gi;
const KLASSE_ALLGEMEIN = /\b([A-Za-zÄÖÜäöü]{2,5})[\s-]?(\d{2})[\s-]?([A-Za-z])\b/;
const KEIN_UNTERRICHT = /ferien|feiertag|prüfung|pruefung|praktikum|betriebsphase|frei\b/i;

/** Zeiträume und Kalenderwochen in einer Zeile */
function zeitraeumeIn(zeile: string, kontextJahr: number): { von: string; bis: string; unsicher: boolean }[] {
  const ergebnis: { von: string; bis: string; unsicher: boolean }[] = [];
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
    ergebnis.push({ von, bis, unsicher: !j2 && !j1 });
  }
  for (const m of zeile.matchAll(KW)) {
    const jahr = m[3] ? Number(m[3]) : kontextJahr;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (a < 1 || a > 53 || b < a || b > 53) continue;
    ergebnis.push({ von: montagDerKw(jahr, a), bis: plusTage(montagDerKw(jahr, b), 4), unsicher: !m[3] });
  }
  return ergebnis;
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
  const zeilen = text
    .replace(/\r/g, '')
    .split(/[\n\f]/)
    .filter((z) => z.trim())
    .map((z) => ({ klassen: klassenIn(z, bekannt), zeitraeume: KEIN_UNTERRICHT.test(z) ? [] : zeitraeumeIn(z, kontextJahr), fremd: KLASSE_ALLGEMEIN.test(z) }));
  const erste = zeilen.find((z) => (z.klassen.length > 0) !== (z.zeitraeume.length > 0));
  const blockZuerst = !!erste && erste.zeitraeume.length > 0;
  const ergebnis: Roh[] = [];
  const trage = (ks: string[], zs: { von: string; bis: string; unsicher: boolean }[]) => {
    for (const z of zs) for (const k of ks.length ? ks : ['']) ergebnis.push({ klasse: k, von: z.von, bis: z.bis, titel: 'Berufsschule', unsicher: z.unsicher });
  };
  let letzte: string[] = [];
  let offen: { zeitraeume: { von: string; bis: string; unsicher: boolean }[]; klassen: string[] } = { zeitraeume: [], klassen: [] };
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
  return ergebnis.some((r) => r.klasse) ? ergebnis.filter((r) => r.klasse) : ergebnis;
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
    if (!passend) hinweise.push('keine Klasse erkannt – bitte zuordnen');
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

function stand(c: Ctx, a: Auftrag) {
  const st = standDes(c.k, a);
  if (st.status !== 'fertig') return { id: a.id, ...st };
  const vomModell = st.modell ? ausModell(st.modell) : [];
  // die Muster des Portals zuerst – das Sprachmodell ergänzt nur (es verrechnet sich gelegentlich bei Daten)
  const schuleId = Number(lies(join(a.ordner, 'schule')));
  const klassen = c.k.db.prepare('SELECT * FROM klasse WHERE berufsschule_id = ?').all(schuleId) as unknown as Klasse[];
  const text = st.text.slice(0, MAX_TEXT);
  const muster = erkenneBloecke(text, klassen, heute(c.k.jetzt()));
  // auch beim Sprachmodell nur angelegte Klassen; Zeilen ohne Klasse nur, wenn die Muster keine Klasse gefunden haben
  const modell = nurAngelegte(vomModell, klassen).filter((r) => r.klasse || !muster.some((m) => m.klasse));
  let roh = zusammenfuehren(muster, modell, text);
  // bei Texterkennung ist alles etwas unsicherer
  if (st.quelle === 'texterkennung') roh = roh.map((r) => ({ ...r, unsicher: true }));
  return { id: a.id, status: 'fertig' as const, quelle: st.quelle, modell: vomModell.length > 0, zeilen: vorschau(c.k, schuleId, roh) };
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
      loescheAuftrag(c.k, c.b.id, 'schulplan', body.auftrag);
      const azubis = (db.prepare(`SELECT COUNT(*) AS n FROM azubi_profil p JOIN benutzer b ON b.id = p.benutzer_id WHERE b.status = 'aktiv' AND p.klasse_id IN (${[...klassen].map(() => '?').join(',') || 'NULL'})`).get(...klassen) as { n: number }).n;
      return { status: 200, body: { angelegt, azubis } };
    },
  },
];
