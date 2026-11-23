import { merkeAktivitaet } from './aktivitaet';
import { Fehler, idAus, koerper, text } from './api-basis';
import type { Ctx, Route } from './api-basis';
import type { DB } from './db';
import { transaktion } from './db';
import { heute } from './datum';
import { gueltigesDatum, montagVon, plusTage } from './kalender';
import { protokolliere } from './protokoll';
import { sichtbareAzubis } from './rechte';
import type { BenutzerZeile } from './typen';

/**
 * Klassen an der Berufsschule und ihre Schulblöcke.
 *
 * - Klassen gehören zu einer Berufsschule (Stammdaten, Ausbilder). Ein Azubi gehört zu einer Klasse – die ganze Ausbildung.
 * - Schulblöcke pflegen Ausbilder einmal an der Klasse (Planung → Schulblöcke). Im Plan jedes Azubis der Klasse steht dazu
 *   ein Eintrag „Schule“, verknüpft über `plan_eintrag.schulblock_id`. Ändert sich ein Block, ändert er sich bei allen.
 * - Wird der Eintrag im Plan eines Azubis einzeln geändert oder gelöscht, ist das eine Ausnahme (`schulblock_ausnahme`):
 *   Für diesen Azubi folgt der Block der Klasse nicht mehr.
 * - Wer etwas Neues erfährt: neue Blöcke als „neuer Eintrag im Ausbildungsplan“, Änderungen und Wegfall als
 *   „Schulblock geändert“ – in der Glocke, per Teams und E-Mail wie jeder Plan-Eintrag.
 */

export interface Klasse {
  id: number;
  berufsschule_id: number;
  name: string;
  beruf_id: number | null;
}

interface BlockZeile {
  id: number;
  klasse_id: number;
  von: string;
  bis: string;
  titel: string;
  text: string;
  geaendert: string;
}

const MAX_KLASSEN_JE_SCHULE = 200;
const MAX_BLOECKE_JE_KLASSE = 100;
const MAX_WOCHEN = 26;

export function alleKlassen(db: DB): Klasse[] {
  return db.prepare('SELECT * FROM klasse ORDER BY name COLLATE NOCASE').all() as unknown as Klasse[];
}

export function klasseVon(db: DB, id: number | null): Klasse | null {
  if (!id) return null;
  return (db.prepare('SELECT * FROM klasse WHERE id = ?').get(id) as Klasse | undefined) ?? null;
}

function pruefeKlasse(db: DB, body: Record<string, unknown>): { berufsschuleId: number; name: string; berufId: number | null } {
  const berufsschuleId = Number(body.berufsschuleId);
  if (!Number.isInteger(berufsschuleId) || !db.prepare('SELECT 1 FROM berufsschule WHERE id = ?').get(berufsschuleId)) throw new Fehler(400, 'Diese Berufsschule gibt es nicht');
  const name = text(body.name, 40, 'Name der Klasse');
  const roh = body.berufId;
  const berufId = roh === null || roh === undefined || roh === '' ? null : Number(roh);
  if (berufId !== null && (!Number.isInteger(berufId) || !db.prepare('SELECT 1 FROM beruf WHERE id = ?').get(berufId))) throw new Fehler(400, 'Diesen Beruf gibt es nicht');
  return { berufsschuleId, name, berufId };
}

function freitext(x: unknown, max: number, feld: string): string {
  const s = typeof x === 'string' ? x.replace(/\r\n?/g, '\n').trim() : '';
  if (s.length > max) throw new Fehler(400, `${feld} ist zu lang (höchstens ${max} Zeichen)`);
  if (/[\u0000-\u0009\u000b-\u001f\u007f]/.test(s)) throw new Fehler(400, `${feld} enthält unzulässige Zeichen`);
  return s;
}

function pruefeBlock(body: Record<string, unknown>): { von: string; bis: string; titel: string; text: string } {
  if (!gueltigesDatum(body.von)) throw new Fehler(400, 'Beginn fehlt oder ist kein gültiges Datum');
  const bisRoh = body.bis === undefined || body.bis === null || body.bis === '' ? body.von : body.bis;
  if (!gueltigesDatum(bisRoh)) throw new Fehler(400, 'Ende ist kein gültiges Datum');
  const von = montagVon(body.von);
  const bis = montagVon(bisRoh);
  if (bis < von) throw new Fehler(400, 'Das Ende liegt vor dem Beginn');
  if (bis > plusTage(von, 7 * (MAX_WOCHEN - 1))) throw new Fehler(400, `Ein Schulblock darf höchstens ${MAX_WOCHEN} Wochen umfassen`);
  const titel = body.titel === undefined || body.titel === null || String(body.titel).trim() === '' ? 'Berufsschule' : text(body.titel, 120, 'Titel');
  return { von, bis, titel, text: freitext(body.text, 2000, 'Beschreibung') };
}

/**
 * Bringt die Schulblöcke im Plan eines Azubis auf den Stand seiner Klasse: fehlende anlegen, geänderte nachziehen,
 * Blöcke anderer Klassen entfernen. Ausnahmen bleiben, wie sie sind. Meldet in der Glocke, was sich für den Azubi ändert.
 */
export function gleicheSchulbloeckeAb(db: DB, jetzt: Date, wer: Pick<BenutzerZeile, 'id' | 'anzeigename'>, azubiId: number): { neu: number; geaendert: number } {
  const klasseId = (db.prepare('SELECT klasse_id FROM azubi_profil WHERE benutzer_id = ?').get(azubiId) as { klasse_id: number | null } | undefined)?.klasse_id ?? null;
  const bloecke = klasseId
    ? (db.prepare('SELECT * FROM schulblock WHERE klasse_id = ? AND id NOT IN (SELECT schulblock_id FROM schulblock_ausnahme WHERE azubi_id = ?) ORDER BY von').all(klasseId, azubiId) as unknown as BlockZeile[])
    : [];
  const vorhanden = db.prepare('SELECT id, schulblock_id, von, bis, titel, text FROM plan_eintrag WHERE azubi_id = ? AND schulblock_id IS NOT NULL').all(azubiId) as unknown as {
    id: number;
    schulblock_id: number;
    von: string;
    bis: string;
    titel: string;
    text: string;
  }[];
  const zuBlock = new Map(vorhanden.map((v) => [v.schulblock_id, v]));
  const gewollt = new Set(bloecke.map((b) => b.id));
  const zeit = jetzt.toISOString();
  let neu = 0;
  let geaendert = 0;
  let ersteNeu: string | null = null;
  let ersteGeaendert: string | null = null;
  const titelNeu: string[] = [];
  // nicht mehr gültig (andere Klasse, Block gelöscht oder jetzt Ausnahme): weg – das ist eine Änderung für den Azubi
  for (const v of vorhanden) {
    if (gewollt.has(v.schulblock_id)) continue;
    db.prepare('DELETE FROM plan_eintrag WHERE id = ?').run(v.id);
    geaendert++;
    ersteGeaendert ??= v.von;
  }
  for (const b of bloecke) {
    const v = zuBlock.get(b.id);
    if (!v) {
      db.prepare(
        `INSERT INTO plan_eintrag (azubi_id, art, von, bis, titel, text, erstellt_von, geaendert_von, geaendert, schulblock_id) VALUES (?, 'schule', ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(azubiId, b.von, b.bis, b.titel, b.text, wer.id, wer.id, zeit, b.id);
      neu++;
      ersteNeu ??= b.von;
      titelNeu.push(b.titel);
    } else if (v.von !== b.von || v.bis !== b.bis || v.titel !== b.titel || v.text !== b.text) {
      db.prepare('UPDATE plan_eintrag SET von = ?, bis = ?, titel = ?, text = ?, geaendert_von = ?, geaendert = ? WHERE id = ?').run(b.von, b.bis, b.titel, b.text, wer.id, zeit, v.id);
      geaendert++;
      ersteGeaendert ??= b.von;
    }
  }
  if (neu > 0) merkeAktivitaet(db, jetzt, 'plan_neu', azubiId, wer, ersteNeu, neu === 1 ? titelNeu[0] : `${neu} Schulblöcke`, neu);
  if (geaendert > 0) merkeAktivitaet(db, jetzt, 'schule_geaendert', azubiId, wer, ersteGeaendert, '', geaendert);
  return { neu, geaendert };
}

function azubisDerKlasse(db: DB, klasseId: number): number[] {
  return (db.prepare("SELECT p.benutzer_id AS id FROM azubi_profil p JOIN benutzer b ON b.id = p.benutzer_id WHERE p.klasse_id = ? AND b.status = 'aktiv'").all(klasseId) as unknown as { id: number }[]).map((z) => z.id);
}

function gleicheKlasseAb(c: Ctx, klasseId: number): number {
  const ids = azubisDerKlasse(c.k.db, klasseId);
  for (const id of ids) gleicheSchulbloeckeAb(c.k.db, c.k.jetzt(), c.b, id);
  return ids.length;
}

function holeKlasse(db: DB, x: unknown): Klasse {
  const k = klasseVon(db, idAus(String(x)));
  if (!k) throw new Fehler(404, 'Diese Klasse gibt es nicht');
  return k;
}

function holeBlock(db: DB, x: unknown): BlockZeile {
  const b = db.prepare('SELECT * FROM schulblock WHERE id = ?').get(idAus(String(x))) as BlockZeile | undefined;
  if (!b) throw new Fehler(404, 'Diesen Schulblock gibt es nicht');
  return b;
}

/** Seite „Schulblöcke“: je Klasse die Blöcke und wer in der Klasse ist (Namen nur der Azubis, die man sehen darf). */
function uebersicht(c: Ctx) {
  const { db } = c.k;
  const sichtbar = new Set(sichtbareAzubis(db, c.b, heute(c.k.jetzt())));
  const schulen = db.prepare('SELECT id, name, ort, bundesland FROM berufsschule ORDER BY name COLLATE NOCASE').all() as unknown as { id: number; name: string; ort: string; bundesland: string }[];
  return {
    schulen: schulen.map((s) => ({
      ...s,
      klassen: (db.prepare('SELECT * FROM klasse WHERE berufsschule_id = ? ORDER BY name COLLATE NOCASE').all(s.id) as unknown as Klasse[]).map((k) => {
        const azubis = db
          .prepare("SELECT b.id, b.anzeigename FROM azubi_profil p JOIN benutzer b ON b.id = p.benutzer_id WHERE p.klasse_id = ? AND b.status = 'aktiv' ORDER BY b.anzeigename COLLATE NOCASE")
          .all(k.id) as unknown as { id: number; anzeigename: string }[];
        return {
          id: k.id,
          name: k.name,
          berufId: k.beruf_id,
          anzahlAzubis: azubis.length,
          azubis: azubis.filter((a) => sichtbar.has(a.id)).map((a) => ({ id: a.id, name: a.anzeigename })),
          bloecke: (db.prepare('SELECT * FROM schulblock WHERE klasse_id = ? ORDER BY von, bis, id').all(k.id) as unknown as BlockZeile[]).map((b) => ({
            id: b.id,
            von: b.von,
            bis: b.bis,
            titel: b.titel,
            text: b.text,
            // wie viele Azubis den Block einzeln geändert oder gelöscht haben
            ausnahmen: (db.prepare('SELECT COUNT(*) AS n FROM schulblock_ausnahme WHERE schulblock_id = ?').get(b.id) as { n: number }).n,
          })),
        };
      }),
    })),
  };
}

const AUSBILDER: Route['wer'] = ['ausbilder'];

export const KLASSEN_ROUTEN: Route[] = [
  {
    m: 'POST',
    p: '/api/stammdaten/klassen',
    wer: AUSBILDER,
    h: (c) => {
      const { db } = c.k;
      const k = pruefeKlasse(db, koerper(c));
      if ((db.prepare('SELECT COUNT(*) AS n FROM klasse WHERE berufsschule_id = ?').get(k.berufsschuleId) as { n: number }).n >= MAX_KLASSEN_JE_SCHULE) throw new Fehler(409, `Höchstens ${MAX_KLASSEN_JE_SCHULE} Klassen je Berufsschule`);
      if (db.prepare('SELECT 1 FROM klasse WHERE berufsschule_id = ? AND name = ? COLLATE NOCASE').get(k.berufsschuleId, k.name)) throw new Fehler(409, `Die Klasse „${k.name}“ gibt es an dieser Schule schon`);
      const r = db.prepare('INSERT INTO klasse (berufsschule_id, name, beruf_id) VALUES (?, ?, ?)').run(k.berufsschuleId, k.name, k.berufId);
      protokolliere(db, c.k.jetzt(), 'fach', 'stammdaten_geaendert', c.b, null, `Klasse angelegt: ${k.name}`);
      return { status: 201, body: { klasse: klasseVon(db, Number(r.lastInsertRowid)) } };
    },
  },
  {
    m: 'PATCH',
    p: '/api/stammdaten/klassen/:id',
    wer: AUSBILDER,
    h: (c) => {
      const { db } = c.k;
      const alt = holeKlasse(db, c.p.id);
      const k = pruefeKlasse(db, { berufsschuleId: alt.berufsschule_id, ...koerper(c) });
      if (k.berufsschuleId !== alt.berufsschule_id) throw new Fehler(400, 'Eine Klasse bleibt an ihrer Berufsschule');
      if (db.prepare('SELECT 1 FROM klasse WHERE berufsschule_id = ? AND name = ? COLLATE NOCASE AND id != ?').get(k.berufsschuleId, k.name, alt.id)) throw new Fehler(409, `Die Klasse „${k.name}“ gibt es an dieser Schule schon`);
      db.prepare('UPDATE klasse SET name = ?, beruf_id = ? WHERE id = ?').run(k.name, k.berufId, alt.id);
      protokolliere(db, c.k.jetzt(), 'fach', 'stammdaten_geaendert', c.b, null, `Klasse geändert: ${alt.name} → ${k.name}`);
      return { status: 200, body: { klasse: klasseVon(db, alt.id) } };
    },
  },
  {
    m: 'DELETE',
    p: '/api/stammdaten/klassen/:id',
    wer: AUSBILDER,
    h: (c) => {
      const { db } = c.k;
      const k = holeKlasse(db, c.p.id);
      const n = (db.prepare('SELECT COUNT(*) AS n FROM azubi_profil WHERE klasse_id = ?').get(k.id) as { n: number }).n;
      if (n > 0) throw new Fehler(409, `Zur Klasse „${k.name}“ gehören noch ${n === 1 ? 'ein Azubi' : `${n} Azubis`}. Trag ${n === 1 ? 'ihn' : 'sie'} erst in eine andere Klasse ein.`);
      db.prepare('DELETE FROM klasse WHERE id = ?').run(k.id);
      protokolliere(db, c.k.jetzt(), 'fach', 'stammdaten_geaendert', c.b, null, `Klasse gelöscht: ${k.name}`);
      return { status: 200, body: { ok: true } };
    },
  },

  { m: 'GET', p: '/api/schulbloecke', wer: AUSBILDER, h: (c) => ({ status: 200, body: uebersicht(c) }) },
  {
    m: 'POST',
    p: '/api/schulbloecke',
    wer: AUSBILDER,
    h: (c) => {
      const { db } = c.k;
      const body = koerper(c);
      const k = holeKlasse(db, body.klasseId);
      if ((db.prepare('SELECT COUNT(*) AS n FROM schulblock WHERE klasse_id = ?').get(k.id) as { n: number }).n >= MAX_BLOECKE_JE_KLASSE) throw new Fehler(409, `Höchstens ${MAX_BLOECKE_JE_KLASSE} Schulblöcke je Klasse`);
      const b = pruefeBlock(body);
      let azubis = 0;
      transaktion(db, () => {
        db.prepare('INSERT INTO schulblock (klasse_id, von, bis, titel, text, geaendert, geaendert_von) VALUES (?, ?, ?, ?, ?, ?, ?)').run(k.id, b.von, b.bis, b.titel, b.text, c.k.jetzt().toISOString(), c.b.id);
        azubis = gleicheKlasseAb(c, k.id);
        protokolliere(db, c.k.jetzt(), 'fach', 'schulblock_geaendert', c.b, null, `${k.name}: ${b.titel} ab ${b.von} angelegt`);
      });
      return { status: 201, body: { ...uebersicht(c), azubis } };
    },
  },
  {
    m: 'PUT',
    p: '/api/schulbloecke/:id',
    wer: AUSBILDER,
    h: (c) => {
      const { db } = c.k;
      const alt = holeBlock(db, c.p.id);
      const k = klasseVon(db, alt.klasse_id)!;
      const b = pruefeBlock(koerper(c));
      let azubis = 0;
      transaktion(db, () => {
        db.prepare('UPDATE schulblock SET von = ?, bis = ?, titel = ?, text = ?, geaendert = ?, geaendert_von = ? WHERE id = ?').run(b.von, b.bis, b.titel, b.text, c.k.jetzt().toISOString(), c.b.id, alt.id);
        azubis = gleicheKlasseAb(c, k.id);
        protokolliere(db, c.k.jetzt(), 'fach', 'schulblock_geaendert', c.b, null, `${k.name}: ${alt.titel} ab ${alt.von} geändert`);
      });
      return { status: 200, body: { ...uebersicht(c), azubis } };
    },
  },
  {
    m: 'DELETE',
    p: '/api/schulbloecke/:id',
    wer: AUSBILDER,
    h: (c) => {
      const { db } = c.k;
      const alt = holeBlock(db, c.p.id);
      const k = klasseVon(db, alt.klasse_id)!;
      let azubis = 0;
      transaktion(db, () => {
        // wer den Block im Plan hat, erfährt vom Wegfall; die Einträge im Plan gehen mit dem Block (ON DELETE CASCADE)
        const betroffen = (db.prepare('SELECT azubi_id AS id FROM plan_eintrag WHERE schulblock_id = ?').all(alt.id) as unknown as { id: number }[]).map((z) => z.id);
        db.prepare('DELETE FROM schulblock WHERE id = ?').run(alt.id);
        for (const id of betroffen) merkeAktivitaet(db, c.k.jetzt(), 'schule_geaendert', id, c.b, alt.von, '', 1);
        azubis = betroffen.length;
        protokolliere(db, c.k.jetzt(), 'fach', 'schulblock_geaendert', c.b, null, `${k.name}: ${alt.titel} ab ${alt.von} gelöscht`);
      });
      return { status: 200, body: { ...uebersicht(c), azubis } };
    },
  },
];

/** Für die Ansicht eines Plan-Eintrags: zu welcher Klasse er gehört – oder null */
export function klasseDesBlocks(db: DB, schulblockId: number | null): string | null {
  if (!schulblockId) return null;
  return (db.prepare('SELECT k.name FROM schulblock s JOIN klasse k ON k.id = s.klasse_id WHERE s.id = ?').get(schulblockId) as { name: string } | undefined)?.name ?? null;
}

/** Ein verknüpfter Eintrag wird im Plan des Azubis einzeln geändert oder gelöscht: ab jetzt eine Ausnahme. */
export function machAusnahme(db: DB, eintrag: { schulblock_id?: number | null; azubi_id: number; id: number }): void {
  if (!eintrag.schulblock_id) return;
  db.prepare('INSERT OR IGNORE INTO schulblock_ausnahme (schulblock_id, azubi_id) VALUES (?, ?)').run(eintrag.schulblock_id, eintrag.azubi_id);
  db.prepare('UPDATE plan_eintrag SET schulblock_id = NULL WHERE id = ?').run(eintrag.id);
}

