import { merkeErinnerung } from './aktivitaet';
import { Fehler, holeBenutzer, idAus, koerper, text } from './api-basis';
import type { Ctx, Route } from './api-basis';
import type { DB } from './db';
import { heute } from './datum';
import { gueltigesDatum, montagVon, plusTage } from './kalender';
import { sichtbareAzubis } from './rechte';
import { wochenText } from './wunsch';

/**
 * Erinnerungen von Ausbildungsbeauftragten und Ausbildern zu einem Azubi – z. B. „Arbeitsplatz vorbereiten“ eine Woche,
 * bevor der Azubi in die Abteilung kommt.
 * - Privat: Jede Erinnerung sieht nur die Person, die sie angelegt hat. Fremde Erinnerungen gibt es für niemanden (404).
 * - Anlegen lässt sie sich nur zu Azubis, die man gerade sieht (rechte.ts: sichtbareAzubis).
 * - Bezug auf einen Einsatz: Der Tag ist Beginn des Einsatzes minus `tage_vorher` und wandert mit, wenn der Einsatz verschoben wird.
 *   Wird der Einsatz gelöscht, bleibt der zuletzt errechnete Tag stehen.
 * - Fällig (Tag erreicht, nicht erledigt): einmal je Tag ein persönlicher Eintrag in der Glocke – Teams und E-Mail ohne Inhalt.
 */
interface ErinnerungZeile {
  id: number;
  benutzer_id: number;
  azubi_id: number;
  einsatz_id: number | null;
  tage_vorher: number | null;
  datum: string;
  text: string;
  erledigt: string | null;
  gemeldet: string | null;
  gemeldet_fuer: string | null;
  erstellt: string;
}

/** so viele Erinnerungen darf eine Person höchstens haben */
const MAX_ERINNERUNGEN = 300;
const MAX_TAGE_VORHER = 90;
/** erledigte Erinnerungen bleiben so lange in der Liste, dann werden sie gelöscht */
const ERLEDIGT_TAGE = 90;

/** Tage der Erinnerungen mit Einsatz auf den Stand der Einsätze bringen (Einsatz verschoben → Erinnerung wandert mit). */
function gleicheTageAb(db: DB): void {
  db.exec(`UPDATE erinnerung SET datum = (SELECT date(p.von, '-' || erinnerung.tage_vorher || ' days') FROM plan_eintrag p WHERE p.id = erinnerung.einsatz_id)
            WHERE einsatz_id IS NOT NULL AND tage_vorher IS NOT NULL
              AND datum != (SELECT date(p.von, '-' || erinnerung.tage_vorher || ' days') FROM plan_eintrag p WHERE p.id = erinnerung.einsatz_id)`);
}

/**
 * Fällige Erinnerungen in die Glocke stellen – je Erinnerung und Tag einmal; wandert der Tag, wird neu gemeldet, sobald er erreicht ist.
 * Läuft bei der stündlichen Pflege und bei jedem Aufruf der Liste. Gibt die Zahl der neu gemeldeten zurück.
 */
export function meldeFaelligeErinnerungen(db: DB, jetzt: Date): number {
  gleicheTageAb(db);
  const tag = heute(jetzt);
  db.prepare('DELETE FROM erinnerung WHERE erledigt IS NOT NULL AND erledigt < ?').run(new Date(jetzt.getTime() - ERLEDIGT_TAGE * 86_400_000).toISOString());
  const faellig = db
    .prepare(
      `SELECT e.*, a.anzeigename AS azubi_name FROM erinnerung e JOIN benutzer a ON a.id = e.azubi_id JOIN benutzer b ON b.id = e.benutzer_id
        WHERE e.erledigt IS NULL AND e.datum <= ? AND (e.gemeldet_fuer IS NULL OR e.gemeldet_fuer != e.datum) AND b.status = 'aktiv'`,
    )
    .all(tag) as unknown as (ErinnerungZeile & { azubi_name: string })[];
  for (const e of faellig) {
    merkeErinnerung(db, jetzt, e.benutzer_id, `${e.azubi_name}: ${e.text}`);
    db.prepare('UPDATE erinnerung SET gemeldet = ?, gemeldet_fuer = datum WHERE id = ?').run(jetzt.toISOString(), e.id);
  }
  return faellig.length;
}

function hole(db: DB, id: number): ErinnerungZeile | undefined {
  return Number.isInteger(id) ? (db.prepare('SELECT * FROM erinnerung WHERE id = ?').get(id) as ErinnerungZeile | undefined) : undefined;
}

/** Eigene Erinnerung holen – fremde gibt es nicht. */
function eigene(c: Ctx): ErinnerungZeile {
  const z = hole(c.k.db, idAus(c.p.id));
  if (!z || z.benutzer_id !== c.b.id) throw new Fehler(404, 'Nicht gefunden');
  return z;
}

function ansicht(db: DB, z: ErinnerungZeile, tag: string) {
  const azubi = holeBenutzer(db, z.azubi_id);
  const einsatz = z.einsatz_id ? (db.prepare('SELECT titel, von, bis FROM plan_eintrag WHERE id = ?').get(z.einsatz_id) as { titel: string; von: string; bis: string } | undefined) : undefined;
  return {
    id: z.id,
    azubi: { id: z.azubi_id, anzeigename: azubi?.anzeigename ?? '' },
    datum: z.datum,
    text: z.text,
    einsatz: einsatz ? { titel: einsatz.titel, von: einsatz.von, zeitraum: wochenText(einsatz.von, einsatz.bis) } : null,
    tageVorher: z.tage_vorher,
    erledigt: z.erledigt,
    faellig: !z.erledigt && z.datum <= tag,
  };
}

export const ERINNERUNG_ROUTEN: Route[] = [
  {
    // eigene Erinnerungen; dazu die Azubis, die ich sehe, mit ihren kommenden Einsätzen zur Auswahl
    m: 'GET',
    p: '/api/erinnerungen',
    wer: ['ausbilder', 'beauftragter'],
    h: (c) => {
      const { db } = c.k;
      meldeFaelligeErinnerungen(db, c.k.jetzt());
      const tag = heute(c.k.jetzt());
      const zeilen = db.prepare('SELECT * FROM erinnerung WHERE benutzer_id = ? ORDER BY erledigt IS NOT NULL, datum, id LIMIT 500').all(c.b.id) as unknown as ErinnerungZeile[];
      const erinnerungen = zeilen.map((z) => ansicht(db, z, tag));
      const ids = sichtbareAzubis(db, c.b, tag);
      const azubis = ids.map((id) => {
        const b = holeBenutzer(db, id)!;
        const einsaetze = (db.prepare("SELECT id, titel, von, bis FROM plan_eintrag WHERE azubi_id = ? AND art = 'einsatz' AND bis >= ? ORDER BY von LIMIT 50").all(id, montagVon(tag)) as unknown as {
          id: number;
          titel: string;
          von: string;
          bis: string;
        }[]).map((e) => ({ id: e.id, titel: e.titel, von: e.von, zeitraum: wochenText(e.von, e.bis) }));
        return { id, anzeigename: b.anzeigename, einsaetze };
      });
      return { status: 200, body: { heute: tag, faellig: erinnerungen.filter((e) => e.faellig).length, erinnerungen, azubis } };
    },
  },

  {
    m: 'POST',
    p: '/api/erinnerungen',
    wer: ['ausbilder', 'beauftragter'],
    h: (c) => {
      const { db } = c.k;
      const body = koerper(c);
      const tag = heute(c.k.jetzt());
      const azubiId = Number(body.azubiId);
      if (!Number.isInteger(azubiId) || !sichtbareAzubis(db, c.b, tag).includes(azubiId)) throw new Fehler(400, 'Bitte einen Azubi wählen');
      const inhalt = text(body.text, 200, 'Woran erinnert werden soll');
      let einsatzId: number | null = null;
      let tageVorher: number | null = null;
      let datum: string;
      if (body.einsatzId !== undefined && body.einsatzId !== null && body.einsatzId !== '') {
        const e = db.prepare("SELECT id, von FROM plan_eintrag WHERE id = ? AND azubi_id = ? AND art = 'einsatz'").get(Number(body.einsatzId), azubiId) as { id: number; von: string } | undefined;
        if (!e) throw new Fehler(400, 'Diesen Einsatz gibt es bei diesem Azubi nicht');
        const t = Number(body.tageVorher ?? 0);
        if (!Number.isInteger(t) || t < 0 || t > MAX_TAGE_VORHER) throw new Fehler(400, `„Tage vorher“ muss zwischen 0 und ${MAX_TAGE_VORHER} liegen`);
        einsatzId = e.id;
        tageVorher = t;
        datum = plusTage(e.von, -t);
      } else {
        if (!gueltigesDatum(body.datum)) throw new Fehler(400, 'Der Tag fehlt oder ist kein gültiges Datum');
        if (body.datum < tag) throw new Fehler(400, 'Der Tag liegt in der Vergangenheit');
        datum = body.datum;
      }
      const anzahl = (db.prepare('SELECT COUNT(*) AS n FROM erinnerung WHERE benutzer_id = ?').get(c.b.id) as { n: number }).n;
      if (anzahl >= MAX_ERINNERUNGEN) throw new Fehler(409, `Du hast schon ${MAX_ERINNERUNGEN} Erinnerungen – lösch bitte erst erledigte`);
      const r = db
        .prepare('INSERT INTO erinnerung (benutzer_id, azubi_id, einsatz_id, tage_vorher, datum, text, erstellt) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(c.b.id, azubiId, einsatzId, tageVorher, datum, inhalt, c.k.jetzt().toISOString());
      return { status: 201, body: { erinnerung: ansicht(db, hole(db, Number(r.lastInsertRowid))!, tag) } };
    },
  },

  {
    // abhaken oder wieder öffnen
    m: 'PUT',
    p: '/api/erinnerungen/:id/erledigt',
    wer: ['ausbilder', 'beauftragter'],
    h: (c) => {
      const { db } = c.k;
      const z = eigene(c);
      const erledigt = koerper(c).erledigt === true;
      db.prepare('UPDATE erinnerung SET erledigt = ? WHERE id = ?').run(erledigt ? c.k.jetzt().toISOString() : null, z.id);
      return { status: 200, body: { erinnerung: ansicht(db, hole(db, z.id)!, heute(c.k.jetzt())) } };
    },
  },

  {
    m: 'DELETE',
    p: '/api/erinnerungen/:id',
    wer: ['ausbilder', 'beauftragter'],
    h: (c) => {
      const z = eigene(c);
      c.k.db.prepare('DELETE FROM erinnerung WHERE id = ?').run(z.id);
      return { status: 200, body: { ok: true } };
    },
  },
];
