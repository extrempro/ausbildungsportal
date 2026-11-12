import { Fehler, idAus, istObjekt, koerper } from './api-basis';
import type { Route } from './api-basis';
import type { DB } from './db';
import { gueltigesDatum, plusTage } from './kalender';
import { protokolliere } from './protokoll';

/**
 * Firmentermine: ganztägige Termine des Betriebs, die für alle gelten – zum Beispiel eine Betriebsschließung
 * oder eine Betriebsversammlung. Der Titel ist freier Text; das Portal leitet nichts daraus ab.
 *
 * - Eintragen, ändern und löschen können nur Ausbilder (in den Stammdaten).
 * - Sehen können sie alle Fachrollen: im Ausbildungsplan in der betroffenen Woche und im Jahreskalender.
 * - Bewusst reine Übersicht: Sie stehen nicht im Berichtsheft, ändern keinen Urlaub und lösen keine Benachrichtigung aus.
 */
export interface Firmentermin {
  id: number;
  titel: string;
  von: string;
  bis: string;
  hinweis: string;
}

const SPALTEN = 'id, titel, von, bis, hinweis';
/** länger als ein Jahr ist ein Tippfehler */
const MAX_TAGE = 366;

export function alleFirmentermine(db: DB): Firmentermin[] {
  return (db.prepare(`SELECT ${SPALTEN} FROM firmentermin ORDER BY von, bis, id`).all() as unknown as Firmentermin[]).map((t) => ({ ...t }));
}

/** Firmentermine, die den Zeitraum berühren (beide Grenzen einschließlich). */
export function firmentermineZwischen(db: DB, von: string, bis: string): Firmentermin[] {
  return (db.prepare(`SELECT ${SPALTEN} FROM firmentermin WHERE von <= ? AND bis >= ? ORDER BY von, bis, id`).all(bis, von) as unknown as Firmentermin[]).map((t) => ({ ...t }));
}

function einzeilig(x: unknown, max: number, feld: string, pflicht: boolean): string {
  const s = typeof x === 'string' ? x.replace(/\s+/g, ' ').trim() : '';
  if (pflicht && !s) throw new Fehler(400, `${feld} fehlt`);
  if (s.length > max) throw new Fehler(400, `${feld} ist zu lang (höchstens ${max} Zeichen)`);
  if (/[\u0000-\u001f\u007f]/.test(s)) throw new Fehler(400, `${feld} enthält unzulässige Zeichen`);
  return s;
}

function pruefe(roh: unknown): Omit<Firmentermin, 'id'> {
  if (!istObjekt(roh)) throw new Fehler(400, 'Angaben zum Firmentermin fehlen');
  const titel = einzeilig(roh.titel, 100, 'Der Titel', true);
  if (!gueltigesDatum(roh.von)) throw new Fehler(400, 'Der erste Tag fehlt oder ist kein gültiges Datum');
  const von = roh.von;
  // ohne „bis“ ist es ein einzelner Tag
  const bis = roh.bis === undefined || roh.bis === null || roh.bis === '' ? von : roh.bis;
  if (!gueltigesDatum(bis)) throw new Fehler(400, 'Der letzte Tag ist kein gültiges Datum');
  if (bis < von) throw new Fehler(400, 'Der letzte Tag liegt vor dem ersten');
  if (bis > plusTage(von, MAX_TAGE)) throw new Fehler(400, 'Der Termin ist länger als ein Jahr – bitte die Daten prüfen');
  return { titel, von, bis, hinweis: einzeilig(roh.hinweis, 200, 'Der Hinweis', false) };
}

const zeitraum = (t: { von: string; bis: string }) => (t.von === t.bis ? t.von : `${t.von} bis ${t.bis}`);

export const FIRMENTERMIN_ROUTEN: Route[] = [
  {
    m: 'POST',
    p: '/api/stammdaten/firmentermine',
    wer: ['ausbilder'],
    h: (c) => {
      const t = pruefe(koerper(c));
      c.k.db.prepare('INSERT INTO firmentermin (titel, von, bis, hinweis, erstellt, erstellt_von) VALUES (?, ?, ?, ?, ?, ?)').run(t.titel, t.von, t.bis, t.hinweis, c.k.jetzt().toISOString(), c.b.id);
      protokolliere(c.k.db, c.k.jetzt(), 'fach', 'stammdaten_geaendert', c.b, null, `Firmentermin angelegt: ${t.titel} (${zeitraum(t)})`);
      return { status: 201, body: { firmentermine: alleFirmentermine(c.k.db) } };
    },
  },
  {
    m: 'PATCH',
    p: '/api/stammdaten/firmentermine/:id',
    wer: ['ausbilder'],
    h: (c) => {
      const id = idAus(c.p.id);
      if (!c.k.db.prepare('SELECT 1 FROM firmentermin WHERE id = ?').get(id)) throw new Fehler(404, 'Firmentermin nicht gefunden');
      const t = pruefe(koerper(c));
      c.k.db.prepare('UPDATE firmentermin SET titel = ?, von = ?, bis = ?, hinweis = ? WHERE id = ?').run(t.titel, t.von, t.bis, t.hinweis, id);
      protokolliere(c.k.db, c.k.jetzt(), 'fach', 'stammdaten_geaendert', c.b, null, `Firmentermin geändert: ${t.titel} (${zeitraum(t)})`);
      return { status: 200, body: { firmentermine: alleFirmentermine(c.k.db) } };
    },
  },
  {
    m: 'DELETE',
    p: '/api/stammdaten/firmentermine/:id',
    wer: ['ausbilder'],
    h: (c) => {
      const id = idAus(c.p.id);
      const t = c.k.db.prepare(`SELECT ${SPALTEN} FROM firmentermin WHERE id = ?`).get(id) as Firmentermin | undefined;
      if (!t) throw new Fehler(404, 'Firmentermin nicht gefunden');
      c.k.db.prepare('DELETE FROM firmentermin WHERE id = ?').run(id);
      protokolliere(c.k.db, c.k.jetzt(), 'fach', 'stammdaten_geaendert', c.b, null, `Firmentermin gelöscht: ${t.titel} (${zeitraum(t)})`);
      return { status: 200, body: { firmentermine: alleFirmentermine(c.k.db) } };
    },
  },
];
