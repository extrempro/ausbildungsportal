import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashePasswort, pruefePasswort, pruefeRegeln, zufallsPasswort } from '../passwort';

const SCHNELL = { N: 2 ** 12, r: 8, p: 1 };

test('Hash enthält Parameter und Salt, nie das Passwort', async () => {
  const hash = await hashePasswort('Ein-langes-Passwort-42', SCHNELL);
  assert.match(hash, /^scrypt\$4096\$8\$1\$[\w-]+\$[\w-]+$/);
  assert.ok(!hash.includes('Passwort'));
  assert.notEqual(hash, await hashePasswort('Ein-langes-Passwort-42', SCHNELL), 'jedes Mal ein neues Salt');
});

test('richtiges Passwort stimmt, falsches nicht', async () => {
  const hash = await hashePasswort('Ein-langes-Passwort-42', SCHNELL);
  assert.equal(await pruefePasswort(hash, 'Ein-langes-Passwort-42'), true);
  assert.equal(await pruefePasswort(hash, 'Ein-langes-Passwort-43'), false);
  assert.equal(await pruefePasswort(hash, ''), false);
});

test('Standard-Parameter entsprechen der OWASP-Empfehlung', async () => {
  const hash = await hashePasswort('Ein-langes-Passwort-42');
  assert.ok(hash.startsWith('scrypt$131072$8$1$'));
  assert.equal(await pruefePasswort(hash, 'Ein-langes-Passwort-42'), true);
});

test('kaputte oder fremde Hashes werden abgelehnt statt zu werfen', async () => {
  for (const h of ['', 'klartext', 'scrypt$x$8$1$aa$bb', 'bcrypt$1$2$3$4$5', 'scrypt$1048577$8$1$aa$bb']) {
    assert.equal(await pruefePasswort(h, 'egal'), false, h);
  }
});

test('gleichzeitige Prüfungen liefern jeweils das richtige Ergebnis', async () => {
  const hash = await hashePasswort('Ein-langes-Passwort-42', SCHNELL);
  const ergebnisse = await Promise.all(['Ein-langes-Passwort-42', 'falsch', 'Ein-langes-Passwort-42', ''].map((p) => pruefePasswort(hash, p)));
  assert.deepEqual(ergebnisse, [true, false, true, false]);
});

test('Passwortregeln', () => {
  assert.equal(pruefeRegeln('Kurz-1234', 'chef'), 'Das Passwort braucht mindestens 14 Zeichen');
  assert.match(pruefeRegeln('mein-chef-ist-der-beste', 'chef') ?? '', /Benutzernamen/);
  assert.match(pruefeRegeln('aaaaaaaaaaaaaaaaaa', 'chef') ?? '', /verschiedenen Zeichen/);
  assert.match(pruefeRegeln('passwortpasswort', 'chef') ?? '', /erraten/);
  assert.match(pruefeRegeln('Administrator2026!', 'chef') ?? '', /erraten/);
  assert.equal(pruefeRegeln(12345678901234, 'chef'), 'Passwort fehlt');
  assert.equal(pruefeRegeln('Korrekt-Pferd-Batterie-Klammer', 'chef'), null);
});

test('Zufallspasswort ist lang genug und besteht die eigenen Regeln', () => {
  const p = zufallsPasswort();
  assert.equal(p.length, 20);
  assert.equal(pruefeRegeln(p, 'admin'), null);
  assert.notEqual(p, zufallsPasswort());
});
