// Ampel-Logik des Lernmoduls – übernommen aus dem FISI-Lernkompass (src/lib/ampel.ts).

export type LernStatus = 'rot' | 'gelb' | 'gruen';

export const AMPEL_TEXT: Record<LernStatus, string> = { rot: 'Offen', gelb: 'In Arbeit', gruen: 'Sicher' };
export const AMPEL_FARBE: Record<LernStatus, string> = { rot: 'rot', gelb: 'gelb', gruen: 'gruen' };
/** Faustregeln zur Selbsteinschätzung */
export const AMPEL_REGEL: Record<LernStatus, string> = {
  rot: '„Davon habe ich noch nichts gemacht.“',
  gelb: '„Ich kenne es, brauche aber noch das Cheatsheet.“',
  gruen: '„Ich kann es ohne Hilfe erklären und anwenden.“',
};
export const AMPEL_REIHE: LernStatus[] = ['rot', 'gelb', 'gruen'];

export interface Zaehlung {
  g: number;
  y: number;
  r: number;
  n: number;
}

export function zaehle(unterthemen: { status: LernStatus }[]): Zaehlung {
  const z = { g: 0, y: 0, r: 0, n: unterthemen.length };
  for (const u of unterthemen) {
    if (u.status === 'gruen') z.g++;
    else if (u.status === 'gelb') z.y++;
    else z.r++;
  }
  return z;
}

export function summe(felder: { unterthemen: { status: LernStatus }[] }[]): Zaehlung {
  return felder.reduce(
    (acc, f) => {
      const z = zaehle(f.unterthemen);
      return { g: acc.g + z.g, y: acc.y + z.y, r: acc.r + z.r, n: acc.n + z.n };
    },
    { g: 0, y: 0, r: 0, n: 0 },
  );
}

/** Ampel eines Themenfelds: Sicher ab 80 % sicher und nichts offen; Offen, wenn alles offen ist; sonst In Arbeit. */
export function ampelVon(z: Zaehlung): LernStatus {
  if (z.n === 0 || z.r === z.n) return 'rot';
  if (z.r === 0 && z.g / z.n >= 0.8) return 'gruen';
  return 'gelb';
}

/** Sicher = 1 Punkt, In Arbeit = ½, Offen = 0. */
export function prozent(z: Zaehlung): number {
  return z.n ? Math.round(((z.g + 0.5 * z.y) / z.n) * 100) : 0;
}

export function zusammenfassung(z: Zaehlung): string {
  return `${z.g} sicher · ${z.y} in Arbeit · ${z.r} offen`;
}
