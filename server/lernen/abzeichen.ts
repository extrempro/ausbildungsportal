/**
 * Abzeichen im Lernmodul: sechs Stufen je Themenfeld.
 * - Holz, Stein, Bronze belohnen die Beschäftigung mit dem Stoff (Ampel, Zusatzwissen).
 * - Silber, Gold, Meister hängen am Quiz: Silber = Quiz zur Hälfte der Unterthemen bestanden, Gold = alle,
 *   Meister = alle noch einmal fehlerfrei, frühestens eine Woche nach dem Bestehen.
 * - Gezählt werden nur Unterthemen, für die es ein Quiz gibt. Hat ein Themenfeld gar kein Quiz, ist dort Bronze die höchste Stufe.
 * Ein Unterthema zählt als „bearbeitet“, sobald seine Ampel auf Gelb oder Grün steht. Rot ist der Anfangszustand.
 */
export const STUFEN = ['Holz', 'Stein', 'Bronze', 'Silber', 'Gold', 'Meister'] as const;
/** höchste Stufe überhaupt; in einem Themenfeld ohne Quiz ist bei OHNE_QUIZ Schluss */
export const HOECHSTE_STUFE = 6;
export const OHNE_QUIZ = 3;

export interface FeldStand {
  unterthemen: number;
  bearbeitet: number;
  zusatz: number;
  zusatzGelesen: number;
  /** Unterthemen, für die es ein Quiz gibt */
  quiz: number;
  quizBestanden: number;
  quizMeister: number;
}

export const hoechsteVon = (s: FeldStand): number => (s.quiz > 0 ? HOECHSTE_STUFE : OHNE_QUIZ);

/** Stufe, die der aktuelle Lernstand hergibt (0 = noch kein Abzeichen). */
export function stufeVon(s: FeldStand): number {
  if (s.unterthemen === 0 || s.bearbeitet === 0) return 0;
  if (s.bearbeitet >= s.unterthemen && s.zusatzGelesen >= s.zusatz) {
    if (s.quiz === 0) return 3;
    if (s.quizMeister >= s.quiz) return 6;
    if (s.quizBestanden >= s.quiz) return 5;
    if (s.quizBestanden >= Math.ceil(s.quiz / 2)) return 4;
    return 3;
  }
  if (s.bearbeitet >= Math.ceil(s.unterthemen / 2)) return 2;
  return 1;
}

const mz = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;

/** Was bis zur nächsten Stufe fehlt – als Satz und als Anteil (0–100) des Wegs dorthin. */
export function naechste(stufe: number, s: FeldStand): { fehlt: string; fortschritt: number } {
  if (stufe >= HOECHSTE_STUFE) return { fehlt: 'Höchste Stufe erreicht.', fortschritt: 100 };
  if (stufe >= OHNE_QUIZ && s.quiz === 0) return { fehlt: 'Höchste Stufe in diesem Themenfeld – hier gibt es kein Quiz.', fortschritt: 100 };
  if (stufe >= 3) {
    // ab hier zählt das Quiz – vorausgesetzt, Ampel und Zusatzwissen stehen weiter wie für Bronze
    const bronze = s.bearbeitet >= s.unterthemen && s.zusatzGelesen >= s.zusatz;
    const vorweg = bronze ? '' : ' Dafür müssen auch wieder alle Ampeln auf Gelb oder Grün stehen und das Zusatzwissen gelesen sein.';
    if (stufe === 3) {
      const ziel = Math.ceil(s.quiz / 2);
      return { fehlt: `Noch ${mz(Math.max(1, ziel - s.quizBestanden), 'Quiz', 'Quiz')} bestehen bis Silber.${vorweg}`, fortschritt: Math.round((Math.min(s.quizBestanden, ziel) / ziel) * 100) };
    }
    if (stufe === 4) return { fehlt: `Noch ${mz(Math.max(1, s.quiz - s.quizBestanden), 'Quiz', 'Quiz')} bestehen bis Gold.${vorweg}`, fortschritt: Math.round((Math.min(s.quizBestanden, s.quiz) / s.quiz) * 100) };
    return { fehlt: `Noch ${mz(Math.max(1, s.quiz - s.quizMeister), 'Quiz', 'Quiz')} fehlerfrei wiederholen bis Meister – frühestens eine Woche nach dem Bestehen.${vorweg}`, fortschritt: Math.round((Math.min(s.quizMeister, s.quiz) / s.quiz) * 100) };
  }
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
export function rangVon(stufen: number[], hoechste = HOECHSTE_STUFE): { stufe: number; noetig: number; naechste: { stufe: number; haben: number } | null } {
  const noetig = Math.max(1, Math.ceil(stufen.length / 2));
  let stufe = 0;
  for (let s = 1; s <= STUFEN.length; s++) if (stufen.filter((x) => x >= s).length >= noetig) stufe = s;
  const ziel = stufe + 1;
  return { stufe, noetig, naechste: stufe >= hoechste || stufen.length === 0 ? null : { stufe: ziel, haben: stufen.filter((x) => x >= ziel).length } };
}
