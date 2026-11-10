import type { DB } from './db';
import type { BenutzerZeile, Rolle } from './typen';

/**
 * Zentrale Rechteprüfung. Jede Route fragt hier nach – keine verstreuten Einzelprüfungen.
 * Der Super-Admin (Rolle admin) verwaltet ausschließlich Konten und sieht keine Azubi-Daten.
 * Ausbilder verwalten und löschen nur Konten von Azubis und Ausbildungsbeauftragten.
 */
type Wer = Pick<BenutzerZeile, 'id' | 'rolle'>;

const VOM_AUSBILDER_VERWALTET: Rolle[] = ['azubi', 'beauftragter'];

/** Darf ein Konto mit dieser Rolle anlegen bzw. einem Konto diese Rolle geben. */
export function darfRolleVergeben(wer: Wer, rolle: Rolle): boolean {
  if (wer.rolle === 'admin') return true;
  if (wer.rolle === 'ausbilder') return VOM_AUSBILDER_VERWALTET.includes(rolle);
  return false;
}

/** Darf das Konto in der Kontenliste sehen. */
export function darfKontoSehen(wer: Wer, ziel: Pick<BenutzerZeile, 'rolle'>): boolean {
  if (wer.rolle === 'admin') return true;
  if (wer.rolle === 'ausbilder') return ziel.rolle !== 'admin';
  return false;
}

/** Darf das Konto ändern, sperren oder die Entra-Verknüpfung lösen. */
export function darfKontoVerwalten(wer: Wer, ziel: Pick<BenutzerZeile, 'rolle'>): boolean {
  if (wer.rolle === 'admin') return true;
  if (wer.rolle === 'ausbilder') return VOM_AUSBILDER_VERWALTET.includes(ziel.rolle);
  return false;
}

/** Darf das Konto löschen: Super-Admin alle, Ausbilder die Konten von Azubis und Beauftragten. */
export function darfKontoLoeschen(wer: Wer, ziel: Pick<BenutzerZeile, 'rolle'>): boolean {
  return darfKontoVerwalten(wer, ziel);
}

function istAzubi(db: DB, id: number): boolean {
  return !!db.prepare("SELECT 1 FROM benutzer WHERE id = ? AND rolle = 'azubi'").get(id);
}

/**
 * Darf Plan und Berichte dieses Azubis sehen.
 * Azubi: nur sich selbst. Ausbilder: alle. Beauftragte: zugewiesene, ab Beginn der Zuweisung
 * (auch danach – abgezeichnete Wochen bleiben einsehbar). Super-Admin: nie.
 */
export function darfAzubiSehen(db: DB, wer: Wer, azubiId: number, heute: string): boolean {
  if (!Number.isInteger(azubiId) || !istAzubi(db, azubiId)) return false;
  if (wer.rolle === 'azubi') return wer.id === azubiId;
  if (wer.rolle === 'ausbilder') return true;
  if (wer.rolle === 'beauftragter') {
    return !!db
      .prepare('SELECT 1 FROM zuweisung WHERE azubi_id = ? AND beauftragter_id = ? AND (von IS NULL OR von <= ?)')
      .get(azubiId, wer.id, heute);
  }
  return false;
}

/** Darf Azubi-Stammdaten, Plan und Zuweisungen dieses Azubis bearbeiten. */
export function darfAzubiVerwalten(db: DB, wer: Wer, azubiId: number): boolean {
  return wer.rolle === 'ausbilder' && Number.isInteger(azubiId) && istAzubi(db, azubiId);
}

function plusTage(datum: string, tage: number): string {
  const d = new Date(`${datum}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

/**
 * Darf den Bericht der Woche (montag = JJJJ-MM-TT) abzeichnen oder zurückgeben.
 * Ausbilder: immer. Beauftragte: nur, wenn die Woche im Zeitraum ihrer Zuweisung liegt.
 */
export function darfAbzeichnen(db: DB, wer: Wer, azubiId: number, montag: string): boolean {
  if (!Number.isInteger(azubiId) || !istAzubi(db, azubiId) || !/^\d{4}-\d{2}-\d{2}$/.test(montag)) return false;
  if (wer.rolle === 'ausbilder') return true;
  if (wer.rolle === 'beauftragter') {
    const sonntag = plusTage(montag, 6);
    return !!db
      .prepare(
        `SELECT 1 FROM zuweisung WHERE azubi_id = ? AND beauftragter_id = ?
           AND (von IS NULL OR von <= ?) AND (bis IS NULL OR bis >= ?)`,
      )
      .get(azubiId, wer.id, sonntag, montag);
  }
  return false;
}

/** IDs aller Azubis, die das Konto sehen darf. */
export function sichtbareAzubis(db: DB, wer: Wer, heute: string): number[] {
  let zeilen: { id: number }[] = [];
  if (wer.rolle === 'ausbilder') {
    zeilen = db.prepare("SELECT id FROM benutzer WHERE rolle = 'azubi' ORDER BY anzeigename").all() as unknown as { id: number }[];
  } else if (wer.rolle === 'beauftragter') {
    zeilen = db
      .prepare(
        `SELECT DISTINCT b.id FROM benutzer b JOIN zuweisung z ON z.azubi_id = b.id
          WHERE b.rolle = 'azubi' AND z.beauftragter_id = ? AND (z.von IS NULL OR z.von <= ?) ORDER BY b.anzeigename`,
      )
      .all(wer.id, heute) as unknown as { id: number }[];
  } else if (wer.rolle === 'azubi') {
    zeilen = [{ id: wer.id }];
  }
  return zeilen.map((z) => z.id);
}
