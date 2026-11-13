import assert from 'node:assert/strict';
import { test } from 'node:test';
import { unterschriftAusName } from '../../src/unterschriftErzeugen';

/** Die erzeugte Unterschrift muss die Prüfung des Servers bestehen wie eine gezeichnete (berichte.ts: pruefePfad). */
test('Unterschrift aus dem Namen: gültiger Pfad in der Fläche 600 × 200, auch mit Umlauten, Bindestrich und langen Namen', () => {
  for (const name of ['Anna Azubi', 'Jörg Müller-Weiß', 'Zoë Quintero', 'Maximilian Hohenzollern-Sigmaringen', 'Ida Yu']) {
    const pfad = unterschriftAusName(name);
    assert.match(pfad, /^M[ML0-9 .-]+$/, name);
    assert.ok((pfad.match(/L/g) ?? []).length >= 5, `${name}: genug Punkte`);
    assert.ok(pfad.length <= 60_000, `${name}: nicht zu lang`);
    const zahlen = pfad.replace(/[ML]/g, ' ').trim().split(/\s+/).map(Number);
    const xs = zahlen.filter((_, i) => i % 2 === 0);
    const ys = zahlen.filter((_, i) => i % 2 === 1);
    assert.ok(Math.min(...xs) >= 0 && Math.max(...xs) <= 600, `${name}: x im Feld`);
    assert.ok(Math.min(...ys) >= 0 && Math.max(...ys) <= 200, `${name}: y im Feld`);
  }
  assert.equal(unterschriftAusName('1234'), '', 'ohne Buchstaben keine Unterschrift');
  assert.notEqual(unterschriftAusName('Anna Azubi'), unterschriftAusName('Anna Azubu'), 'jeder Name sieht anders aus');
});
