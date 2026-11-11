import { Fehler, holeBenutzer, idAus, istObjekt, koerper, text } from './api-basis';
import type { Route } from './api-basis';
import type { DB } from './db';
import { transaktion } from './db';
import { plusTage } from './kalender';
import { protokolliere } from './protokoll';

/**
 * Abteilungen: Stammdaten mit hinterlegten Beauftragten und freiwilliger Stellvertretung.
 * - Anlegen und Ändern: Ausbilder (wie die übrigen Stammdaten gelten Abteilungen für das ganze Portal).
 * - Hinterlegen lassen sich Ausbildungsbeauftragte und Ausbilder.
 * - Gehört ein Einsatz im Ausbildungsplan zu einer Abteilung, sind Beauftragte und Stellvertretung für die Dauer des Einsatzes
 *   automatisch zugewiesen (Zeilen in `zuweisung` mit einsatz_id). Sie haben damit genau die Rechte einer Zuweisung von Hand:
 *   Plan und Berichte sehen, Berichte der Wochen im Zeitraum abzeichnen, Urlaub bestätigen. Die Stellvertretung ist immer mit zuständig.
 */
interface PersonZeile {
  abteilung_id: number;
  benutzer_id: number;
  art: 'beauftragt' | 'stellvertretung';
  anzeigename: string;
  rolle: string;
  status: string;
}

function personen(db: DB): PersonZeile[] {
  return db.prepare('SELECT p.abteilung_id, p.benutzer_id, p.art, b.anzeigename, b.rolle, b.status FROM abteilung_person p JOIN benutzer b ON b.id = p.benutzer_id ORDER BY b.anzeigename COLLATE NOCASE').all() as unknown as PersonZeile[];
}

export function alleAbteilungen(db: DB) {
  const leute = personen(db);
  const zeilen = db.prepare('SELECT a.id, a.name, (SELECT COUNT(*) FROM plan_eintrag e WHERE e.abteilung_id = a.id) AS einsaetze FROM abteilung a ORDER BY a.name COLLATE NOCASE').all() as unknown as { id: number; name: string; einsaetze: number }[];
  return zeilen.map((a) => {
    const von = (art: PersonZeile['art']) => leute.filter((p) => p.abteilung_id === a.id && p.art === art).map((p) => ({ id: p.benutzer_id, anzeigename: p.anzeigename, aktiv: p.status === 'aktiv' }));
    return { id: a.id, name: a.name, einsaetze: a.einsaetze, beauftragte: von('beauftragt'), stellvertretung: von('stellvertretung') };
  });
}

/**
 * Bringt die automatischen Zuweisungen auf den Stand der Einsätze: für einen Einsatz oder für alle Einsätze einer Abteilung.
 * Gesperrte Konten werden nicht zugewiesen.
 */
export function gleicheZuweisungenAb(db: DB, wo: { einsatzId: number } | { abteilungId: number }): void {
  const einsaetze = (
    'einsatzId' in wo
      ? db.prepare('SELECT id, azubi_id, art, von, bis, abteilung_id FROM plan_eintrag WHERE id = ?').all(wo.einsatzId)
      : db.prepare('SELECT id, azubi_id, art, von, bis, abteilung_id FROM plan_eintrag WHERE abteilung_id = ?').all(wo.abteilungId)
  ) as unknown as { id: number; azubi_id: number; art: string; von: string; bis: string; abteilung_id: number | null }[];
  const einfuegen = db.prepare('INSERT INTO zuweisung (azubi_id, beauftragter_id, von, bis, einsatz_id) VALUES (?, ?, ?, ?, ?)');
  for (const e of einsaetze) {
    db.prepare('DELETE FROM zuweisung WHERE einsatz_id = ?').run(e.id);
    if (e.art !== 'einsatz' || e.abteilung_id === null) continue;
    const leute = db.prepare("SELECT p.benutzer_id AS id FROM abteilung_person p JOIN benutzer b ON b.id = p.benutzer_id AND b.status = 'aktiv' AND b.rolle IN ('beauftragter', 'ausbilder') WHERE p.abteilung_id = ?").all(e.abteilung_id) as { id: number }[];
    // der Plan zählt in Wochen: „bis“ ist der Montag der letzten Woche, die Zuweisung reicht bis zu deren Sonntag
    for (const p of leute) einfuegen.run(e.azubi_id, p.id, e.von, plusTage(e.bis, 6), e.id);
  }
}

/** Abteilung für einen Einsatz prüfen: null bleibt null, eine unbekannte Nummer ist ein Fehler. */
export function abteilungAus(db: DB, x: unknown): { id: number; name: string } | null {
  if (x === null || x === undefined || x === '') return null;
  const a = Number.isInteger(Number(x)) ? (db.prepare('SELECT id, name FROM abteilung WHERE id = ?').get(Number(x)) as { id: number; name: string } | undefined) : undefined;
  if (!a) throw new Fehler(400, 'Diese Abteilung gibt es nicht');
  return { id: a.id, name: a.name };
}

function eingabe(db: DB, roh: Record<string, unknown>) {
  const name = text(roh.name, 80, 'Der Name der Abteilung');
  const ids = (x: unknown, was: string): number[] => {
    if (x === undefined || x === null) return [];
    if (!Array.isArray(x) || x.length > 20) throw new Fehler(400, `${was}: höchstens 20 Personen`);
    return [...new Set(x.map((i) => Number(i)))].map((i) => {
      const b = Number.isInteger(i) ? holeBenutzer(db, i) : undefined;
      if (!b || (b.rolle !== 'beauftragter' && b.rolle !== 'ausbilder')) throw new Fehler(400, `${was}: Hinterlegen lassen sich nur Ausbildungsbeauftragte und Ausbilder`);
      return b.id;
    });
  };
  const beauftragte = ids(roh.beauftragte, 'Beauftragte');
  // wer schon Beauftragte:r ist, braucht keine zweite Rolle in derselben Abteilung
  const stellvertretung = ids(roh.stellvertretung, 'Stellvertretung').filter((i) => !beauftragte.includes(i));
  return { name, beauftragte, stellvertretung };
}

function speichere(db: DB, id: number, e: ReturnType<typeof eingabe>): void {
  db.prepare('DELETE FROM abteilung_person WHERE abteilung_id = ?').run(id);
  const einfuegen = db.prepare('INSERT INTO abteilung_person (abteilung_id, benutzer_id, art) VALUES (?, ?, ?)');
  for (const b of e.beauftragte) einfuegen.run(id, b, 'beauftragt');
  for (const s of e.stellvertretung) einfuegen.run(id, s, 'stellvertretung');
  gleicheZuweisungenAb(db, { abteilungId: id });
}

export const ABTEILUNG_ROUTEN: Route[] = [
  {
    // Abteilungen mit ihren Personen; für Ausbilder dazu, wen man hinterlegen kann
    m: 'GET',
    p: '/api/abteilungen',
    wer: ['ausbilder', 'beauftragter'],
    h: (c) => ({
      status: 200,
      body: {
        abteilungen: alleAbteilungen(c.k.db),
        personen:
          c.b.rolle === 'ausbilder'
            ? (c.k.db.prepare("SELECT id, anzeigename, rolle FROM benutzer WHERE rolle IN ('ausbilder', 'beauftragter') AND status = 'aktiv' ORDER BY anzeigename COLLATE NOCASE").all() as unknown as { id: number; anzeigename: string; rolle: string }[]).map((p) => ({ id: p.id, anzeigename: p.anzeigename, rolle: p.rolle }))
            : [],
      },
    }),
  },
  {
    m: 'POST',
    p: '/api/abteilungen',
    wer: ['ausbilder'],
    h: (c) => {
      const { db } = c.k;
      const e = eingabe(db, koerper(c));
      if (db.prepare('SELECT 1 FROM abteilung WHERE name = ?').get(e.name)) throw new Fehler(409, `Die Abteilung „${e.name}“ gibt es schon`);
      if ((db.prepare('SELECT COUNT(*) AS n FROM abteilung').get() as { n: number }).n >= 200) throw new Fehler(409, 'Es gibt schon 200 Abteilungen');
      const id = transaktion(db, () => {
        const neu = Number(db.prepare('INSERT INTO abteilung (name) VALUES (?)').run(e.name).lastInsertRowid);
        speichere(db, neu, e);
        protokolliere(db, c.k.jetzt(), 'fach', 'abteilung_angelegt', c.b, null, e.name);
        return neu;
      });
      return { status: 201, body: { abteilung: alleAbteilungen(db).find((a) => a.id === id) } };
    },
  },
  {
    // Ändern wirkt sofort auf alle Einsätze dieser Abteilung: Wer neu hinterlegt ist, wird zugewiesen; wer entfernt wurde, verliert die Zuweisung
    m: 'PUT',
    p: '/api/abteilungen/:id',
    wer: ['ausbilder'],
    h: (c) => {
      const { db } = c.k;
      const id = idAus(c.p.id);
      if (!db.prepare('SELECT 1 FROM abteilung WHERE id = ?').get(id)) throw new Fehler(404, 'Nicht gefunden');
      const roh = koerper(c);
      if (!istObjekt(roh)) throw new Fehler(400, 'Angaben fehlen');
      const e = eingabe(db, roh);
      if (db.prepare('SELECT 1 FROM abteilung WHERE name = ? AND id <> ?').get(e.name, id)) throw new Fehler(409, `Die Abteilung „${e.name}“ gibt es schon`);
      transaktion(db, () => {
        db.prepare('UPDATE abteilung SET name = ? WHERE id = ?').run(e.name, id);
        speichere(db, id, e);
        protokolliere(db, c.k.jetzt(), 'fach', 'abteilung_geaendert', c.b, null, e.name);
      });
      return { status: 200, body: { abteilung: alleAbteilungen(db).find((a) => a.id === id) } };
    },
  },
  {
    // Löschen nur, solange kein Einsatz die Abteilung nutzt – sonst verlören Beauftragte unbemerkt ihre Zuweisungen
    m: 'DELETE',
    p: '/api/abteilungen/:id',
    wer: ['ausbilder'],
    h: (c) => {
      const { db } = c.k;
      const id = idAus(c.p.id);
      const a = db.prepare('SELECT name FROM abteilung WHERE id = ?').get(id) as { name: string } | undefined;
      if (!a) throw new Fehler(404, 'Nicht gefunden');
      const n = (db.prepare('SELECT COUNT(*) AS n FROM plan_eintrag WHERE abteilung_id = ?').get(id) as { n: number }).n;
      if (n > 0) throw new Fehler(409, `„${a.name}“ wird in ${n} ${n === 1 ? 'Einsatz' : 'Einsätzen'} verwendet und lässt sich deshalb nicht löschen`);
      db.prepare('DELETE FROM abteilung WHERE id = ?').run(id);
      protokolliere(db, c.k.jetzt(), 'fach', 'abteilung_geloescht', c.b, null, a.name);
      return { status: 200, body: { ok: true } };
    },
  },
];
