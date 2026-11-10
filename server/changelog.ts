import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface ChangelogEintrag {
  version: string;
  datum: string;
  gruppen: { titel: string; punkte: string[] }[];
}

/**
 * Liest CHANGELOG.md im Format
 *   ## [0.6.0] – 2026-11-10
 *   ### Neu
 *   - Punkt
 * (aus dem FISI-Lernkompass übernommen)
 */
export function parseChangelog(text: string): ChangelogEintrag[] {
  const eintraege: ChangelogEintrag[] = [];
  let akt: ChangelogEintrag | null = null;
  for (const zeile of text.split(/\r?\n/)) {
    const v = /^##\s+\[([^\]]+)\]\s*(?:[–-]\s*(\S+))?/.exec(zeile);
    if (v) {
      akt = { version: v[1], datum: v[2] || '', gruppen: [] };
      eintraege.push(akt);
      continue;
    }
    if (!akt) continue;
    const g = /^###\s+(.+)$/.exec(zeile);
    if (g) {
      akt.gruppen.push({ titel: g[1].trim(), punkte: [] });
      continue;
    }
    const p = /^\s*[-*]\s+(.+)$/.exec(zeile);
    if (p) {
      if (!akt.gruppen.length) akt.gruppen.push({ titel: '', punkte: [] });
      akt.gruppen[akt.gruppen.length - 1].punkte.push(p[1].trim());
    }
  }
  return eintraege;
}

let cache: ChangelogEintrag[] | null = null;

/** Versionshinweise der laufenden App; die Datei ändert sich nur mit einem Update, also einmal lesen. */
export function leseChangelog(pfad = fileURLToPath(new URL('../CHANGELOG.md', import.meta.url))): ChangelogEintrag[] {
  if (!cache) cache = existsSync(pfad) ? parseChangelog(readFileSync(pfad, 'utf8')) : [];
  return cache;
}
