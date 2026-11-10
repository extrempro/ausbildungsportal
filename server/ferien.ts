import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gueltigesDatum } from './kalender';

/**
 * Schulferien je Bundesland aus content/ferien/<Kürzel>.json (z. B. HH.json).
 * Die Dateien werden von Hand gepflegt; fehlt die Datei eines Landes, gibt es dafür keine Ferien.
 */
export interface Ferienzeit {
  name: string;
  von: string;
  bis: string;
}

export interface Ferien {
  /** false = für dieses Bundesland ist keine Datei hinterlegt */
  vorhanden: boolean;
  quelle: string;
  stand: string;
  hinweis: string;
  zeiten: Ferienzeit[];
}

const LEER: Ferien = { vorhanden: false, quelle: '', stand: '', hinweis: '', zeiten: [] };
const cache = new Map<string, { mtime: number; wert: Ferien }>();

/** Liest und prüft eine Feriendatei. Fehlerhafte Einträge werden ausgelassen und in `fehler` gemeldet. */
export function leseFerienDatei(pfad: string, fehler: string[] = []): Ferien {
  let roh: unknown;
  try {
    roh = JSON.parse(readFileSync(pfad, 'utf8'));
  } catch (e) {
    fehler.push(`Ungültiges JSON: ${(e as Error).message}`);
    return LEER;
  }
  const r = (typeof roh === 'object' && roh !== null && !Array.isArray(roh) ? roh : {}) as Record<string, unknown>;
  const text = (k: string) => (typeof r[k] === 'string' ? (r[k] as string) : '');
  if (!Array.isArray(r.ferien)) {
    fehler.push('"ferien" muss eine Liste sein');
    return LEER;
  }
  const zeiten: Ferienzeit[] = [];
  r.ferien.forEach((x: unknown, i: number) => {
    const f = (typeof x === 'object' && x !== null ? x : {}) as Record<string, unknown>;
    const wo = `Eintrag ${i + 1}`;
    if (typeof f.name !== 'string' || !f.name.trim()) return void fehler.push(`${wo}: "name" fehlt`);
    if (!gueltigesDatum(f.von) || !gueltigesDatum(f.bis)) return void fehler.push(`${wo} (${f.name}): "von" und "bis" müssen Daten JJJJ-MM-TT sein`);
    if (f.bis < f.von) return void fehler.push(`${wo} (${f.name}): "bis" liegt vor "von"`);
    zeiten.push({ name: f.name.trim(), von: f.von, bis: f.bis });
  });
  zeiten.sort((a, b) => a.von.localeCompare(b.von));
  return { vorhanden: true, quelle: text('quelle'), stand: text('stand'), hinweis: text('hinweis'), zeiten };
}

/** Ferien eines Bundeslands; geänderte Dateien werden ohne Neustart übernommen. */
export function ladeFerien(contentDir: string, land: string, log: (t: string) => void = () => {}): Ferien {
  if (!/^[A-Z]{2}$/.test(land)) return LEER;
  const pfad = join(contentDir, 'ferien', `${land}.json`);
  if (!existsSync(pfad)) return LEER;
  const mtime = statSync(pfad).mtimeMs;
  const bekannt = cache.get(pfad);
  if (bekannt && bekannt.mtime === mtime) return bekannt.wert;
  const fehler: string[] = [];
  const wert = leseFerienDatei(pfad, fehler);
  for (const f of fehler) log(`Ferien ${land}.json: ${f}`);
  cache.set(pfad, { mtime, wert });
  return wert;
}

export function ferienZwischen(f: Ferien, von: string, bis: string): Ferienzeit[] {
  return f.zeiten.filter((z) => z.von <= bis && z.bis >= von);
}
