import type { DB } from './db';
import type { BenutzerZeile, Rolle } from './typen';

/**
 * Zentrale Rechteprüfung. Jede Route fragt hier nach – keine verstreuten Einzelprüfungen.
 * Der Super-Admin (Rolle admin) verwaltet ausschließlich Konten und sieht keine Azubi-Daten.
 *
 * Ausbilder und Azubis:
 * - „eigene“ Azubis: der Ausbilder steht im Profil als zuständig. Volle Rechte (Profil, Plan, Zuweisungen, Abzeichnen).
 * - Azubis ohne zuständigen Ausbilder: wie eigene, für jeden Ausbilder – damit niemand unbetreut bleibt, bis jemand übernimmt.
 * - Gesamtsicht (benutzer.alle_azubis, setzt nur der Super-Admin): volle Rechte bei allen Azubis, z. B. für die Ausbildungsleitung.
 * - Vertretung: Ein Ausbilder, der einem Azubi für einen Zeitraum zugewiesen ist, hat dort die Rechte eines Ausbildungsbeauftragten.
 * Konten: Ausbilder verwalten und löschen Konten von Ausbildungsbeauftragten und von Azubis, bei denen sie volle Rechte haben.
 */
type Wer = Pick<BenutzerZeile, 'id' | 'rolle'>;

const VOM_AUSBILDER_VERWALTET: Rolle[] = ['azubi', 'beauftragter'];

/** Darf ein Konto mit dieser Rolle anlegen bzw. einem Konto diese Rolle geben. */
export function darfRolleVergeben(wer: Wer, rolle: Rolle): boolean {
  if (wer.rolle === 'admin') return true;
  if (wer.rolle === 'ausbilder') return VOM_AUSBILDER_VERWALTET.includes(rolle);
  return false;
}

/** Hat das Ausbilder-Konto die Gesamtsicht über alle Azubis? */
export function hatGesamtsicht(db: DB, wer: Wer): boolean {
  return wer.rolle === 'ausbilder' && !!db.prepare('SELECT 1 FROM benutzer WHERE id = ? AND alle_azubis = 1').get(wer.id);
}

/**
 * Zuständiger Ausbilder laut Profil; null, wenn keiner eingetragen ist (oder es noch kein Profil gibt).
 * Ein gesperrtes Konto zählt nicht: Fällt der Ausbilder aus, sollen seine Azubis nicht unsichtbar werden.
 */
export function zustaendiger(db: DB, azubiId: number): number | null {
  const z = db
    .prepare("SELECT a.id FROM azubi_profil p JOIN benutzer a ON a.id = p.ausbilder_id AND a.rolle = 'ausbilder' AND a.status = 'aktiv' WHERE p.benutzer_id = ?")
    .get(azubiId) as { id: number } | undefined;
  return z?.id ?? null;
}

/** Volle Rechte eines Ausbilders bei diesem Azubi: zuständig, Azubi ohne Ausbilder oder Gesamtsicht. */
function istEigener(db: DB, wer: Wer, azubiId: number): boolean {
  if (wer.rolle !== 'ausbilder') return false;
  const a = zustaendiger(db, azubiId);
  return a === null || a === wer.id || hatGesamtsicht(db, wer);
}

/** Zuweisung (Ausbildungsbeauftragte, oder Ausbilder als Vertretung), die am Tag `ab` begonnen hat und – wenn `bis` genannt ist – dann noch läuft. */
function zugewiesen(db: DB, wer: Wer, azubiId: number, ab: string, bis: string | null): boolean {
  if (wer.rolle !== 'beauftragter' && wer.rolle !== 'ausbilder') return false;
  return bis === null
    ? !!db.prepare('SELECT 1 FROM zuweisung WHERE azubi_id = ? AND beauftragter_id = ? AND (von IS NULL OR von <= ?)').get(azubiId, wer.id, ab)
    : !!db.prepare('SELECT 1 FROM zuweisung WHERE azubi_id = ? AND beauftragter_id = ? AND (von IS NULL OR von <= ?) AND (bis IS NULL OR bis >= ?)').get(azubiId, wer.id, ab, bis);
}

function istAzubi(db: DB, id: number): boolean {
  return !!db.prepare("SELECT 1 FROM benutzer WHERE id = ? AND rolle = 'azubi'").get(id);
}

/** Darf das Konto in der Kontenliste sehen. Ausbilder: Ausbilder, Beauftragte und die Azubis, bei denen sie volle Rechte haben. */
export function darfKontoSehen(db: DB, wer: Wer, ziel: Pick<BenutzerZeile, 'id' | 'rolle'>): boolean {
  if (wer.rolle === 'admin') return true;
  if (wer.rolle !== 'ausbilder' || ziel.rolle === 'admin') return false;
  return ziel.rolle !== 'azubi' || istEigener(db, wer, ziel.id);
}

/** Darf das Konto ändern, sperren oder die Entra-Verknüpfung lösen. */
export function darfKontoVerwalten(db: DB, wer: Wer, ziel: Pick<BenutzerZeile, 'id' | 'rolle'>): boolean {
  if (wer.rolle === 'admin') return true;
  if (wer.rolle !== 'ausbilder') return false;
  if (ziel.rolle === 'azubi') return istEigener(db, wer, ziel.id);
  return VOM_AUSBILDER_VERWALTET.includes(ziel.rolle);
}

/** Darf das Konto löschen: Super-Admin alle, Ausbilder die Konten, die sie verwalten dürfen. */
export function darfKontoLoeschen(db: DB, wer: Wer, ziel: Pick<BenutzerZeile, 'id' | 'rolle'>): boolean {
  return darfKontoVerwalten(db, wer, ziel);
}

/**
 * Darf Plan und Berichte dieses Azubis sehen.
 * Azubi: nur sich selbst. Ausbilder: eigene (siehe oben) und – als Vertretung – zugewiesene.
 * Beauftragte: zugewiesene, ab Beginn der Zuweisung (auch danach – abgezeichnete Wochen bleiben einsehbar). Super-Admin: nie.
 */
export function darfAzubiSehen(db: DB, wer: Wer, azubiId: number, heute: string): boolean {
  if (!Number.isInteger(azubiId) || !istAzubi(db, azubiId)) return false;
  if (wer.rolle === 'azubi') return wer.id === azubiId;
  return istEigener(db, wer, azubiId) || zugewiesen(db, wer, azubiId, heute, null);
}

/** Darf Azubi-Stammdaten, Plan und Zuweisungen dieses Azubis bearbeiten (volle Rechte). */
export function darfAzubiVerwalten(db: DB, wer: Wer, azubiId: number): boolean {
  return Number.isInteger(azubiId) && istAzubi(db, azubiId) && istEigener(db, wer, azubiId);
}

/** Wie der Ausbilder zu diesem Azubi steht – für Hinweise in der Oberfläche. */
export function betreuung(db: DB, wer: Wer, azubiId: number): 'eigen' | 'ohne' | 'gesamt' | 'vertretung' | null {
  if (wer.rolle !== 'ausbilder') return null;
  const a = zustaendiger(db, azubiId);
  if (a === wer.id) return 'eigen';
  if (a === null) return 'ohne';
  return hatGesamtsicht(db, wer) ? 'gesamt' : 'vertretung';
}

function plusTage(datum: string, tage: number): string {
  const d = new Date(`${datum}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

/**
 * Darf den Bericht der Woche (montag = JJJJ-MM-TT) abzeichnen oder zurückgeben.
 * Ausbilder bei eigenen Azubis: immer. Beauftragte und vertretende Ausbilder: nur, wenn die Woche im Zeitraum ihrer Zuweisung liegt.
 */
export function darfAbzeichnen(db: DB, wer: Wer, azubiId: number, montag: string): boolean {
  if (!Number.isInteger(azubiId) || !istAzubi(db, azubiId) || !/^\d{4}-\d{2}-\d{2}$/.test(montag)) return false;
  return istEigener(db, wer, azubiId) || zugewiesen(db, wer, azubiId, plusTage(montag, 6), montag);
}

/**
 * Darf im Ausbildungsplan dieses Azubis Einträge dieser Art anlegen.
 * Ausbilder bei eigenen Azubis: alles. Beauftragte und vertretende Ausbilder: nur Aufgaben und Notizen, solange ihre Zuweisung läuft.
 * Azubis: Aufgaben, Notizen und Termine im eigenen Plan. Schulblöcke und Einsätze plant allein der Ausbilder.
 * Termine sind einzelne Tage, die nur der Azubi selbst einträgt; alle, die den Plan sehen, sehen auch sie.
 * Ändern und Löschen: siehe darfPlanEintragAendern.
 */
export function darfPlanBearbeiten(db: DB, wer: Wer, azubiId: number, art: string, heute: string): boolean {
  if (!Number.isInteger(azubiId) || !istAzubi(db, azubiId)) return false;
  // Termine (z. B. JAV-Sitzung) trägt nur der Azubi selbst ein und ändert nur er
  if (art === 'termin') return wer.rolle === 'azubi' && wer.id === azubiId;
  if (wer.rolle === 'azubi') return wer.id === azubiId && (art === 'aufgabe' || art === 'notiz');
  if (istEigener(db, wer, azubiId)) return true;
  return (art === 'aufgabe' || art === 'notiz') && zugewiesen(db, wer, azubiId, heute, heute);
}

/**
 * Darf einen vorhandenen Plan-Eintrag ändern oder löschen.
 * Wie beim Anlegen – Azubis aber nur Einträge, die sie selbst angelegt haben
 * (was Ausbilder oder Beauftragte eingetragen haben, können sie nur abhaken).
 */
export function darfPlanEintragAendern(db: DB, wer: Wer, eintrag: { azubi_id: number; art: string; erstellt_von: number | null }, heute: string): boolean {
  if (!darfPlanBearbeiten(db, wer, eintrag.azubi_id, eintrag.art, heute)) return false;
  return wer.rolle !== 'azubi' || eintrag.erstellt_von === wer.id;
}

/** IDs aller Azubis, die das Konto sehen darf. */
export function sichtbareAzubis(db: DB, wer: Wer, heute: string): number[] {
  let zeilen: { id: number }[] = [];
  if (wer.rolle === 'ausbilder' && hatGesamtsicht(db, wer)) {
    zeilen = db.prepare("SELECT id FROM benutzer WHERE rolle = 'azubi' ORDER BY anzeigename").all() as unknown as { id: number }[];
  } else if (wer.rolle === 'ausbilder' || wer.rolle === 'beauftragter') {
    // Ausbilder: zuständig oder niemand zuständig; dazu – wie bei Beauftragten – alles, was zugewiesen ist
    zeilen = db
      .prepare(
        `SELECT b.id FROM benutzer b
           LEFT JOIN azubi_profil p ON p.benutzer_id = b.id
           LEFT JOIN benutzer a ON a.id = p.ausbilder_id AND a.rolle = 'ausbilder' AND a.status = 'aktiv'
          WHERE b.rolle = 'azubi'
            AND ((? = 'ausbilder' AND (a.id IS NULL OR a.id = ?))
              OR EXISTS (SELECT 1 FROM zuweisung z WHERE z.azubi_id = b.id AND z.beauftragter_id = ? AND (z.von IS NULL OR z.von <= ?)))
          ORDER BY b.anzeigename`,
      )
      .all(wer.rolle, wer.id, wer.id, heute) as unknown as { id: number }[];
  } else if (wer.rolle === 'azubi') {
    zeilen = [{ id: wer.id }];
  }
  return zeilen.map((z) => z.id);
}
