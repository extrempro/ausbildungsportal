import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

/**
 * Die Führung zeigt auf echte Stellen im Portal. Wird dort eine Klasse umbenannt oder eine Seite verschoben,
 * zeigt die Führung ins Leere – das fiel bisher erst beim Durchspielen auf. Dieser Test meldet es sofort.
 * (Ob eine Station an der richtigen Stelle steht und der Text noch stimmt, zeigt nur der Browser.)
 */
const src = join(import.meta.dirname, '..', '..', 'src');
const fuehrung = readFileSync(join(src, 'fuehrung.tsx'), 'utf8');
const app = readFileSync(join(src, 'App.tsx'), 'utf8');

function quelltext(dir: string): string {
  let out = '';
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) out += quelltext(join(dir, e.name));
    else if (/\.(tsx|ts)$/.test(e.name) && e.name !== 'fuehrung.tsx') out += readFileSync(join(dir, e.name), 'utf8');
  }
  return out;
}
const rest = quelltext(src);

test('Führung: jede Station zeigt auf eine Seite und auf Stellen, die es im Portal gibt', () => {
  const pfade = [...fuehrung.matchAll(/pfad: '([^']+)'/g)].map((m) => m[1]);
  assert.ok(pfade.length >= 20, 'Stationen nicht gefunden – sucht der Test noch richtig?');
  for (const p of new Set(pfade)) {
    assert.ok(p === '/' || app.includes(`pfad === '${p}'`) || app.includes(`zu: '${p}'`), `Die Führung geht zur Seite „${p}“ – die App kennt sie nicht`);
  }
  // Klassen, Kennungen und Menüpunkte aus allen „ziel“-Listen
  const listen = [...fuehrung.matchAll(/ziel: \[([^\]]*)\]/g)].map((m) => m[1]).join(',') + fuehrung.slice(fuehrung.indexOf('const MENUE'), fuehrung.indexOf('const ENDE')) + fuehrung.slice(fuehrung.indexOf('const GLOCKE'), fuehrung.indexOf('const AZUBI'));
  const klassen = new Set([...listen.matchAll(/\.([a-z][\w-]*)/g)].map((m) => m[1]));
  const kennungen = new Set([...listen.matchAll(/#([a-z][\w-]*)/g)].map((m) => m[1]));
  const ziele = new Set([...listen.matchAll(/href="([^"]+)"/g)].map((m) => m[1]));
  const menues = new Set([...listen.matchAll(/aria-controls="([^"]+)"/g)].map((m) => m[1]));
  assert.ok(klassen.size >= 10, 'Klassen nicht gefunden – sucht der Test noch richtig?');
  for (const k of klassen) assert.ok(new RegExp(`[\\s"'\`]${k}[\\s"'\`$]`).test(rest), `Die Führung zeigt auf die Klasse „.${k}“ – die gibt es im Quelltext nicht mehr`);
  for (const k of kennungen) assert.ok(rest.includes(`id="${k}"`), `Die Führung zeigt auf „#${k}“ – diese Kennung gibt es nicht mehr`);
  for (const z of ziele) assert.ok(app.includes(`zu: '${z}'`), `Die Führung zeigt auf den Menüpunkt „${z}“ – den gibt es nicht mehr`);
  for (const m of menues) assert.ok(app.includes(m.replace('menue-', "'")) || rest.includes(m) || app.includes('`menue-${g.id}`'), `Die Führung zeigt auf das Menü „${m}“ – das gibt es nicht mehr`);
});

test('Führung: jede Station hat Titel und Text, kurz genug für die Karte', () => {
  const stationen = [...fuehrung.matchAll(/titel: (?:'([^']+)'|[^,]+),\s*text: (?:'((?:[^'\\]|\\.)*)'|rolle === [^?]+\? '((?:[^'\\]|\\.)*)' : '((?:[^'\\]|\\.)*)')/g)];
  assert.ok(stationen.length >= 25, `nur ${stationen.length} Stationen gefunden`);
  for (const m of stationen) {
    for (const text of [m[2], m[3], m[4]].filter(Boolean)) {
      assert.ok(text.length <= 260, `Station „${m[1] ?? '(je Rolle)'}“: Text hat ${text.length} Zeichen – höchstens 260, sonst wird die Karte am Handy zu hoch`);
    }
  }
});
