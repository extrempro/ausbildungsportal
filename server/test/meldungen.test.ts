import assert from 'node:assert/strict';
import { test } from 'node:test';
import { admin, koerper, konto, ohneWechsel, ruf, sitzung, umgebung } from './hilfe';

test('Fehler melden: jedes Konto kann melden, nur der Super-Admin liest, erledigt und löscht', async () => {
  const u = await umgebung();
  const chef = admin(u.db);
  ohneWechsel(u.db, chef.id);
  const azubi = konto(u.db, 'azubi', 'Anna Azubi');
  const ausbilder = konto(u.db, 'ausbilder', 'Petra Lang');
  const cA = sitzung(u, azubi);
  const cC = sitzung(u, chef);

  assert.equal((await ruf(u, 'POST', '/api/fehlermeldungen', { body: { text: 'Ohne Anmeldung geht nichts' } })).status, 401);
  for (const falsch of [undefined, '', 'zu kurz', 'x'.repeat(2001)]) assert.equal((await ruf(u, 'POST', '/api/fehlermeldungen', { cookies: cA, body: { text: falsch } })).status, 400);

  const a = await ruf(u, 'POST', '/api/fehlermeldungen', { cookies: cA, body: { text: 'Der Knopf „Einreichen“\r\nreagiert nicht.\u0007', seite: '/berichtsheft/2026-11-02', fenster: '390 × 800', technik: 'TypeError: x is undefined', version: '9.9.9', name: 'Jemand anders' } });
  assert.equal(a.status, 201);
  assert.equal((await ruf(u, 'POST', '/api/fehlermeldungen', { cookies: sitzung(u, ausbilder), body: { text: 'Die Übersicht lädt sehr langsam.' } })).status, 201);

  for (const c of [cA, sitzung(u, ausbilder)]) assert.equal((await ruf(u, 'GET', '/api/fehlermeldungen', { cookies: c })).status, 403, 'andere Rollen sehen keine Meldungen');
  const l = koerper(await ruf(u, 'GET', '/api/fehlermeldungen', { cookies: cC }));
  assert.equal(l.offen, 2);
  const m = l.meldungen[1];
  assert.deepEqual([m.name, m.rolle, m.seite, m.fenster, m.technik, m.status], ['Anna Azubi', 'azubi', '/berichtsheft/2026-11-02', '390 × 800', 'TypeError: x is undefined', 'offen']);
  assert.equal(m.text, 'Der Knopf „Einreichen“\nreagiert nicht.', 'Zeilenumbruch bleibt, Steuerzeichen nicht');
  assert.equal(m.version, u.k.version, 'Name und Version kommen vom Server, nicht aus der Anfrage');

  const e = koerper(await ruf(u, 'PATCH', `/api/fehlermeldungen/${m.id}`, { cookies: cC, body: { status: 'erledigt' } }));
  assert.equal(e.offen, 1);
  assert.deepEqual(e.meldungen.map((x: any) => x.status), ['offen', 'erledigt'], 'offene zuerst');
  assert.ok(e.meldungen[1].erledigtAm);
  assert.equal((await ruf(u, 'PATCH', `/api/fehlermeldungen/${m.id}`, { cookies: cC, body: { status: 'egal' } })).status, 400);
  assert.equal((await ruf(u, 'PATCH', `/api/fehlermeldungen/${m.id}`, { cookies: cA, body: { status: 'offen' } })).status, 403);
  assert.equal((await ruf(u, 'DELETE', '/api/fehlermeldungen/9999', { cookies: cC })).status, 404);
  assert.equal(koerper(await ruf(u, 'DELETE', `/api/fehlermeldungen/${m.id}`, { cookies: cC })).meldungen.length, 1);

  u.db.prepare('DELETE FROM benutzer WHERE id = ?').run(ausbilder.id);
  assert.equal(koerper(await ruf(u, 'GET', '/api/fehlermeldungen', { cookies: cC })).meldungen[0].name, 'Petra Lang', 'die Meldung bleibt, wenn das Konto gelöscht wird');
});

test('Fehler melden: höchstens zehn Meldungen je Konto in 24 Stunden', async () => {
  const u = await umgebung();
  const azubi = konto(u.db, 'azubi');
  const cookies = sitzung(u, azubi);
  for (let i = 0; i < 10; i++) assert.equal((await ruf(u, 'POST', '/api/fehlermeldungen', { cookies, body: { text: `Meldung Nummer ${i} zum Testen` } })).status, 201);
  assert.equal((await ruf(u, 'POST', '/api/fehlermeldungen', { cookies, body: { text: 'Das ist die elfte Meldung' } })).status, 429);
  u.uhr.jetzt = new Date(u.uhr.jetzt.getTime() + 25 * 3_600_000);
  assert.equal((await ruf(u, 'POST', '/api/fehlermeldungen', { cookies: sitzung(u, azubi), body: { text: 'Am nächsten Tag geht es wieder' } })).status, 201);
});
