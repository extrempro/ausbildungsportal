/**
 * Abzeichen im Lernmodul: sechs Stufen je Themenfeld.
 * - Holz, Stein, Bronze belohnen die Beschäftigung mit dem Stoff (Ampel, Zusatzwissen).
 * - Silber, Gold, Meister sind für bestandene Übungen vorgesehen. Die gibt es noch nicht – diese Stufen sind deshalb nicht erreichbar.
 * Ein Unterthema zählt als „bearbeitet“, sobald seine Ampel auf Gelb oder Grün steht. Rot ist der Anfangszustand.
 */
export const STUFEN = ['Holz', 'Stein', 'Bronze', 'Silber', 'Gold', 'Meister'] as const;
/** höchste Stufe, die sich im Moment erreichen lässt */
export const HOECHSTE_STUFE = 3;

export interface FeldStand {
  unterthemen: number;
  bearbeitet: number;
  zusatz: number;
  zusatzGelesen: number;
}

/** Stufe, die der aktuelle Lernstand hergibt (0 = noch kein Abzeichen). */
export function stufeVon(s: FeldStand): number {
  if (s.unterthemen === 0 || s.bearbeitet === 0) return 0;
  if (s.bearbeitet >= s.unterthemen && s.zusatzGelesen >= s.zusatz) return 3;
  if (s.bearbeitet >= Math.ceil(s.unterthemen / 2)) return 2;
  return 1;
}

const mz = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;

/** Was bis zur nächsten Stufe fehlt – als Satz und als Anteil (0–100) des Wegs dorthin. */
export function naechste(stufe: number, s: FeldStand): { fehlt: string; fortschritt: number } {
  if (stufe >= HOECHSTE_STUFE) return { fehlt: 'Höchste Stufe, die es im Moment gibt. Silber, Gold und Meister kommen mit den Übungen.', fortschritt: 100 };
  if (stufe === 0) return { fehlt: 'Stell bei einem Unterthema die Ampel auf Gelb oder Grün – dann bekommst du Holz.', fortschritt: 0 };
  if (stufe === 1) {
    const ziel = Math.ceil(s.unterthemen / 2);
    const offen = Math.max(1, ziel - s.bearbeitet);
    return { fehlt: `Noch ${mz(offen, 'Unterthema', 'Unterthemen')} bis Stein.`, fortschritt: Math.round((Math.min(s.bearbeitet, ziel) / ziel) * 100) };
  }
  const themen = Math.max(0, s.unterthemen - s.bearbeitet);
  const zusatz = Math.max(0, s.zusatz - s.zusatzGelesen);
  const teile = [themen ? mz(themen, 'Unterthema', 'Unterthemen') : '', zusatz ? `${zusatz}× Zusatzwissen` : ''].filter(Boolean);
  const gesamt = s.unterthemen + s.zusatz;
  return { fehlt: `Noch ${teile.join(' und ') || '1 Unterthema'} bis Bronze.`, fortschritt: Math.round(((Math.min(s.bearbeitet, s.unterthemen) + Math.min(s.zusatzGelesen, s.zusatz)) / gesamt) * 100) };
}

/**
 * Gesamtrang: die höchste Stufe, die in mindestens der Hälfte der Themenfelder erreicht ist.
 * `stufen` enthält je Themenfeld die erreichte Stufe (0 = keine).
 */
export function rangVon(stufen: number[]): { stufe: number; noetig: number; naechste: { stufe: number; haben: number } | null } {
  const noetig = Math.max(1, Math.ceil(stufen.length / 2));
  let stufe = 0;
  for (let s = 1; s <= STUFEN.length; s++) if (stufen.filter((x) => x >= s).length >= noetig) stufe = s;
  const ziel = stufe + 1;
  return { stufe, noetig, naechste: stufe >= HOECHSTE_STUFE || stufen.length === 0 ? null : { stufe: ziel, haben: stufen.filter((x) => x >= ziel).length } };
}
