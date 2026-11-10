import { plusTage } from './kalender';

/**
 * Gesetzliche Feiertage der 16 Bundesländer, berechnet – keine Pflege nötig.
 * Feiertage, die nur in Teilen eines Landes gelten (z. B. Mariä Himmelfahrt in Bayern), sind mit
 * teilweise = true gekennzeichnet; ob sie am eigenen Ort gelten, weiß die App nicht.
 */
export const BUNDESLAENDER: Record<string, string> = {
  BW: 'Baden-Württemberg',
  BY: 'Bayern',
  BE: 'Berlin',
  BB: 'Brandenburg',
  HB: 'Bremen',
  HH: 'Hamburg',
  HE: 'Hessen',
  MV: 'Mecklenburg-Vorpommern',
  NI: 'Niedersachsen',
  NW: 'Nordrhein-Westfalen',
  RP: 'Rheinland-Pfalz',
  SL: 'Saarland',
  SN: 'Sachsen',
  ST: 'Sachsen-Anhalt',
  SH: 'Schleswig-Holstein',
  TH: 'Thüringen',
};

export function istBundesland(x: unknown): x is string {
  return typeof x === 'string' && Object.hasOwn(BUNDESLAENDER, x);
}

export interface Feiertag {
  datum: string;
  name: string;
  /** gilt nur in Teilen des Bundeslands */
  teilweise?: boolean;
}

/** Ostersonntag nach der Gaußschen Osterformel (gregorianischer Kalender). */
export function ostersonntag(jahr: number): string {
  const a = jahr % 19;
  const b = Math.floor(jahr / 100);
  const c = jahr % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31);
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return `${jahr}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`;
}

/** Buß- und Bettag: der Mittwoch vor dem 23. November. */
export function bussUndBettag(jahr: number): string {
  const tag23 = new Date(Date.UTC(jahr, 10, 23)).getUTCDay(); // 0 = Sonntag … 3 = Mittwoch
  const zurueck = ((tag23 - 3 + 7) % 7) || 7;
  return plusTage(`${jahr}-11-23`, -zurueck);
}

export function feiertage(land: string, jahr: number): Feiertag[] {
  const ostern = ostersonntag(jahr);
  const in_ = (...laender: string[]) => laender.includes(land);
  const liste: Feiertag[] = [
    { datum: `${jahr}-01-01`, name: 'Neujahr' },
    { datum: plusTage(ostern, -2), name: 'Karfreitag' },
    { datum: plusTage(ostern, 1), name: 'Ostermontag' },
    { datum: `${jahr}-05-01`, name: 'Tag der Arbeit' },
    { datum: plusTage(ostern, 39), name: 'Christi Himmelfahrt' },
    { datum: plusTage(ostern, 50), name: 'Pfingstmontag' },
    { datum: `${jahr}-10-03`, name: 'Tag der Deutschen Einheit' },
    { datum: `${jahr}-12-25`, name: '1. Weihnachtstag' },
    { datum: `${jahr}-12-26`, name: '2. Weihnachtstag' },
  ];
  if (in_('BW', 'BY', 'ST')) liste.push({ datum: `${jahr}-01-06`, name: 'Heilige Drei Könige' });
  if ((land === 'BE' && jahr >= 2019) || (land === 'MV' && jahr >= 2023)) liste.push({ datum: `${jahr}-03-08`, name: 'Internationaler Frauentag' });
  if (land === 'BB') {
    liste.push({ datum: ostern, name: 'Ostersonntag' }, { datum: plusTage(ostern, 49), name: 'Pfingstsonntag' });
  }
  // einmalige Feiertage in Berlin: 75. und 80. Jahrestag des Kriegsendes
  if (land === 'BE' && (jahr === 2020 || jahr === 2025)) liste.push({ datum: `${jahr}-05-08`, name: 'Tag der Befreiung' });
  if (in_('BW', 'BY', 'HE', 'NW', 'RP', 'SL')) liste.push({ datum: plusTage(ostern, 60), name: 'Fronleichnam' });
  if (in_('SN', 'TH')) liste.push({ datum: plusTage(ostern, 60), name: 'Fronleichnam', teilweise: true });
  if (land === 'BY') liste.push({ datum: `${jahr}-08-08`, name: 'Augsburger Friedensfest (nur Stadt Augsburg)', teilweise: true });
  if (land === 'SL') liste.push({ datum: `${jahr}-08-15`, name: 'Mariä Himmelfahrt' });
  if (land === 'BY') liste.push({ datum: `${jahr}-08-15`, name: 'Mariä Himmelfahrt', teilweise: true });
  if (land === 'TH' && jahr >= 2019) liste.push({ datum: `${jahr}-09-20`, name: 'Weltkindertag' });
  // Reformationstag: in den ostdeutschen Ländern (außer Berlin) schon lange, in vier Nordländern seit 2018, 2017 einmalig überall
  if (in_('BB', 'MV', 'SN', 'ST', 'TH') || (in_('HB', 'HH', 'NI', 'SH') && jahr >= 2018) || jahr === 2017) {
    liste.push({ datum: `${jahr}-10-31`, name: 'Reformationstag' });
  }
  if (in_('BW', 'BY', 'NW', 'RP', 'SL')) liste.push({ datum: `${jahr}-11-01`, name: 'Allerheiligen' });
  if (land === 'SN') liste.push({ datum: bussUndBettag(jahr), name: 'Buß- und Bettag' });
  return liste.sort((x, y) => x.datum.localeCompare(y.datum));
}

/** Alle Feiertage eines Bundeslands zwischen zwei Daten (einschließlich). */
export function feiertageZwischen(land: string, von: string, bis: string): Feiertag[] {
  const ergebnis: Feiertag[] = [];
  for (let j = Number(von.slice(0, 4)); j <= Number(bis.slice(0, 4)); j++) {
    ergebnis.push(...feiertage(land, j).filter((f) => f.datum >= von && f.datum <= bis));
  }
  return ergebnis;
}
