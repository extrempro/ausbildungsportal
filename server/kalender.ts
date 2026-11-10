/**
 * Rechnen mit Kalenderdaten (JJJJ-MM-TT) und mit der Ausbildungsdauer.
 * Aus dem FISI-Lernkompass übernommen; die Regeldauer ist hier ein Parameter statt fest drei Jahre.
 * Gerechnet wird in UTC, damit die Sommerzeit nichts verschiebt.
 */
function d(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}
function iso(x: Date): string {
  return x.toISOString().slice(0, 10);
}

export function gueltigesDatum(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(d(s).getTime()) && iso(d(s)) === s;
}

export function plusTage(datum: string, n: number): string {
  const x = d(datum);
  x.setUTCDate(x.getUTCDate() + n);
  return iso(x);
}

/** n Monate später; fällt der Tag weg (31.01. + 1 Monat), wird auf das Monatsende gekürzt. */
export function plusMonate(datum: string, n: number): string {
  const x = d(datum);
  const tag = x.getUTCDate();
  x.setUTCDate(1);
  x.setUTCMonth(x.getUTCMonth() + n);
  const letzter = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
  x.setUTCDate(Math.min(tag, letzter));
  return iso(x);
}

/** Ganze Monate zwischen zwei Daten. */
export function monateZwischen(von: string, bis: string): number {
  const a = d(von);
  const b = d(bis);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()) - (b.getUTCDate() < a.getUTCDate() ? 1 : 0);
}

export function tageZwischen(von: string, bis: string): number {
  return Math.round((d(bis).getTime() - d(von).getTime()) / 86_400_000);
}

/** Montag der Woche, in der das Datum liegt. */
export function montagVon(datum: string): string {
  return plusTage(datum, -((d(datum).getUTCDay() + 6) % 7));
}

export function istMontag(datum: unknown): datum is string {
  return gueltigesDatum(datum) && montagVon(datum) === datum;
}

/** ISO-Kalenderwoche (KW 1 ist die Woche mit dem ersten Donnerstag des Jahres). */
export function kalenderwoche(datum: string): { kw: number; jahr: number } {
  const donnerstag = d(plusTage(montagVon(datum), 3));
  const jahr = donnerstag.getUTCFullYear();
  const kw = Math.floor((donnerstag.getTime() - Date.UTC(jahr, 0, 1)) / (7 * 86_400_000)) + 1;
  return { kw, jahr };
}

// ---------- Ausbildungsdauer ----------

/** Nach einer Verkürzung müssen mindestens so viele Monate Ausbildung bleiben. */
export const MINDESTDAUER_MONATE = 12;

export function hoechsteVerkuerzung(regeldauer: number): number {
  return Math.max(0, regeldauer - MINDESTDAUER_MONATE);
}

export interface DauerEingabe {
  ausbildungsbeginn: string;
  vertragsende: string;
  verkuerzung_monate: number;
  /** 'ende' = Ausbildung endet früher; 'anfang' = Monate werden angerechnet, Start in höherem Ausbildungsjahr */
  verkuerzung_art: 'ende' | 'anfang';
}

export interface Dauer {
  beginn: string;
  /** Dauer laut Vertrag in Monaten */
  monate: number;
  verkuerzung: number;
  /** am Anfang angerechnete Monate */
  versatz: number;
  /** letzter Ausbildungstag */
  ende: string;
  /** Ende von Hand eingetragen statt berechnet */
  endeVonHand: boolean;
}

/** Dauer der Ausbildung: Regeldauer des Berufs minus Verkürzung; ein eingetragenes Vertragsende hat Vorrang. */
export function ausbildungsdauer(e: DauerEingabe, regeldauer: number): Dauer | null {
  const beginn = e.ausbildungsbeginn;
  if (!gueltigesDatum(beginn)) return null;
  const verkuerzung = Number.isInteger(e.verkuerzung_monate) ? Math.min(Math.max(e.verkuerzung_monate, 0), hoechsteVerkuerzung(regeldauer)) : 0;
  const monate = regeldauer - verkuerzung;
  const endeVonHand = gueltigesDatum(e.vertragsende) && e.vertragsende > beginn;
  const ende = endeVonHand ? e.vertragsende : plusTage(plusMonate(beginn, monate), -1);
  return { beginn, monate, verkuerzung, versatz: e.verkuerzung_art === 'anfang' ? verkuerzung : 0, ende, endeVonHand };
}

/** Ausbildungsjahr an einem Tag; angerechnete Monate zählen mit. */
export function ausbildungsjahrAm(dauer: Pick<Dauer, 'beginn' | 'versatz'>, datum: string): number {
  const ref = datum < dauer.beginn ? dauer.beginn : datum;
  return Math.floor((monateZwischen(dauer.beginn, ref) + dauer.versatz) / 12) + 1;
}

export interface Ausbildungsstand {
  /** 'offen' = noch kein Ausbildungsbeginn eingetragen */
  phase: 'offen' | 'vor' | 'laufend' | 'beendet';
  ausbildungsjahr: number | null;
  beginn: string | null;
  ende: string | null;
  monate: number | null;
  endeVonHand: boolean;
  /** vor dem Beginn: Tage bis zum ersten Tag; während der Ausbildung: Tage bis zum letzten Tag */
  tage: number | null;
}

export function ausbildungsstand(e: DauerEingabe, regeldauer: number, heute: string): Ausbildungsstand {
  const dauer = ausbildungsdauer(e, regeldauer);
  if (!dauer) return { phase: 'offen', ausbildungsjahr: null, beginn: null, ende: null, monate: null, endeVonHand: false, tage: null };
  const gemeinsam = { beginn: dauer.beginn, ende: dauer.ende, monate: dauer.monate, endeVonHand: dauer.endeVonHand };
  if (heute < dauer.beginn) return { ...gemeinsam, phase: 'vor', ausbildungsjahr: ausbildungsjahrAm(dauer, dauer.beginn), tage: tageZwischen(heute, dauer.beginn) };
  if (heute > dauer.ende) return { ...gemeinsam, phase: 'beendet', ausbildungsjahr: ausbildungsjahrAm(dauer, dauer.ende), tage: null };
  return { ...gemeinsam, phase: 'laufend', ausbildungsjahr: ausbildungsjahrAm(dauer, heute), tage: tageZwischen(heute, dauer.ende) };
}
