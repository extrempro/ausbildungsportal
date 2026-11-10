import type { DB } from './db';
import type { BenutzerZeile } from './typen';

/** 'konto' = Anmeldung und Kontenverwaltung (sieht auch der Super-Admin), 'fach' = alles zu Azubi-Daten. */
export type Bereich = 'konto' | 'fach';

export interface ProtokollEintrag {
  id: number;
  zeit: string;
  bereich: Bereich;
  aktion: string;
  benutzer_id: number | null;
  benutzer_name: string;
  ziel_id: number | null;
  ziel_name: string;
  detail: string;
}

type Person = Pick<BenutzerZeile, 'id' | 'anzeigename'> | null;

/** Schreibt einen Eintrag. Ins Detail gehören nie Passwörter, Tokens oder Berichtsinhalte. */
export function protokolliere(
  db: DB,
  jetzt: Date,
  bereich: Bereich,
  aktion: string,
  wer: Person,
  ziel: Person = null,
  detail = '',
): void {
  db.prepare(
    `INSERT INTO protokoll (zeit, bereich, aktion, benutzer_id, benutzer_name, ziel_id, ziel_name, detail)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(jetzt.toISOString(), bereich, aktion, wer?.id ?? null, wer?.anzeigename ?? '', ziel?.id ?? null, ziel?.anzeigename ?? '', detail.slice(0, 300));
}

export function leseProtokoll(db: DB, nurKonto: boolean, limit: number): ProtokollEintrag[] {
  const n = Math.min(Math.max(Math.trunc(limit) || 100, 1), 500);
  const sql = `SELECT * FROM protokoll ${nurKonto ? "WHERE bereich = 'konto'" : ''} ORDER BY id DESC LIMIT ?`;
  return db.prepare(sql).all(n) as unknown as ProtokollEintrag[];
}
