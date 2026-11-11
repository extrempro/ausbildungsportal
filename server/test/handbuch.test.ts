import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

// Verweise aus der Oberfläche ins Handbuch (<HandbuchLink kapitel="…">) müssen auf ein Kapitel zeigen, das es gibt.
// Sonst öffnet sich das Handbuch, ohne zur richtigen Stelle zu springen.

function dateien(ordner: string): string[] {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? dateien(join(ordner, e.name)) : e.name.endsWith('.tsx') ? [join(ordner, e.name)] : []));
}

const handbuch = readFileSync('src/pages/Handbuch.tsx', 'utf8');
const kapitel = new Set([...handbuch.matchAll(/\bid: '([a-z-]+)'/g)].map((m) => m[1]));

test('jeder HandbuchLink zeigt auf ein vorhandenes Kapitel', () => {
  let anzahl = 0;
  for (const datei of dateien('src')) {
    const quelle = readFileSync(datei, 'utf8');
    for (const m of quelle.matchAll(/<HandbuchLink\s+kapitel=(\{[^}]*\}|"[^"]*")/g)) {
      // feste Angabe oder Auswahl je Rolle: alle genannten Kapitel müssen stimmen
      const ids = [...m[1].matchAll(/["']([a-z-]+)["']/g)].map((x) => x[1]).filter((x) => !['azubi', 'ausbilder', 'beauftragter', 'admin'].includes(x));
      assert.ok(ids.length > 0, `${datei}: Kapitel nicht erkennbar in ${m[0]}`);
      for (const id of ids) assert.ok(kapitel.has(id), `${datei}: Kapitel „${id}“ gibt es im Handbuch nicht`);
      anzahl++;
    }
  }
  assert.ok(anzahl >= 15, `nur ${anzahl} Verweise gefunden – sucht der Test noch richtig?`);
});

test('Kapitel-Kennungen sind je Handbuch eindeutig und als Sprungmarke brauchbar', () => {
  for (const id of kapitel) assert.match(id, /^[a-z-]+$/);
  for (const [name, von, bis] of [['Azubi', 'const AZUBI', 'const BETREUUNG'], ['Super-Admin', 'const ADMIN', 'export function Handbuch']] as const) {
    const teil = handbuch.slice(handbuch.indexOf(von), handbuch.indexOf(bis));
    const ids = [...teil.matchAll(/\bid: '([a-z-]+)'/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, `${name}: doppelte Kapitel-Kennung`);
  }
});
