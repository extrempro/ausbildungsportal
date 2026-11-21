import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sichererLog } from '../start';

test('Server-Log: Eingaben mit Zeilenumbruch oder Steuerzeichen erzeugen keine eigene Log-Zeile (ASVS 5.0, 16.4.1)', () => {
  const zeilen: string[] = [];
  const log = sichererLog((t) => zeilen.push(t));
  // z. B. der Parameter „error“ beim Rücksprung von Microsoft – frei wählbar von jedem, der eine Anmeldung beginnt
  log('Entra meldet: x\r\nSuper-Admin „chef“ angelegt.\rStartpasswort: 123 Zeile\u001b[31mrot');
  assert.equal(zeilen.length, 1);
  const teile = zeilen[0].split('\n');
  assert.equal(teile[0], 'Entra meldet: x');
  for (const t of teile.slice(1)) assert.ok(t.startsWith('    '), `eingerückt: ${JSON.stringify(t)}`);
  assert.ok(!zeilen[0].includes('\r') && !zeilen[0].includes('\u001b') && !zeilen[0].includes(' '));
  // Stacktraces bleiben lesbar
  log('Fehler bei GET /api/x: Error: kaputt\n    at f (a.ts:1:1)');
  assert.equal(zeilen[1], 'Fehler bei GET /api/x: Error: kaputt\n        at f (a.ts:1:1)');
  // gewöhnliche Meldungen unverändert
  log('Ausbildungsportal 0.74.3 gestartet.');
  assert.equal(zeilen[2], 'Ausbildungsportal 0.74.3 gestartet.');
});
