// Sammellogik übernommen aus dem FISI-Lernkompass (https://github.com/extrempro/fisi-lernkompass, MIT), dort src/lib/kompendium.ts.
import type { Tabelle, Themenfeld } from './typen';

export type EintragTyp = 'begriff' | 'befehl' | 'tabelle' | 'merksatz' | 'frage';

/** Ein Eintrag im Kompendium: ein Baustein aus einem Cheatsheet, einzeln nachschlagbar. */
export interface Eintrag {
  typ: EintragTyp;
  titel: string;
  text: string;
  tabelle?: Tabelle;
  loesung?: string[];
  /** Kennung des Themenfelds und des Unterthemas – für den Link zum Cheatsheet */
  feld: string;
  sub: string;
  subTitel: string;
}

const sortTitel = (s: string) => s.replace(/[`*]/g, '').replace(/^[^\p{L}\p{N}]+/u, '');

/** Sammelt alle Bausteine aus allen Cheatsheets, sortiert nach Titel. */
export function sammleEintraege(felder: Themenfeld[]): Eintrag[] {
  const out: Eintrag[] = [];
  for (const f of felder) {
    for (const u of f.unterthemen) {
      const basis = { feld: f.id, sub: u.id, subTitel: u.titel };
      for (const b of u.begriffe) out.push({ typ: 'begriff', titel: b.begriff, text: b.erklaerung, ...basis });
      for (const b of u.befehle) out.push({ typ: 'befehl', titel: b.befehl, text: b.info, ...basis });
      for (const t of u.tabellen) out.push({ typ: 'tabelle', titel: t.titel, text: '', tabelle: t, ...basis });
      if (u.merksatz) out.push({ typ: 'merksatz', titel: u.titel, text: u.merksatz, ...basis });
      if (u.frage) out.push({ typ: 'frage', titel: u.frage.frage, text: '', loesung: u.frage.loesung, ...basis });
    }
  }
  return out.sort((a, b) => sortTitel(a.titel).localeCompare(sortTitel(b.titel), 'de', { sensitivity: 'base', numeric: true }));
}
