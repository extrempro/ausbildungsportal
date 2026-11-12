import assert from 'node:assert/strict';
import { test } from 'node:test';
import { naechstesTeilAm, stufeAm } from '../begleiter';
import type { BenutzerZeile } from '../typen';
import { admin, koerper, konto, ohneWechsel, ruf, sitzung, umgebung, zuweisen } from './hilfe';

test('Stufen: neun Teile gleichmäßig über die Ausbildungszeit, das letzte am Ende – nur die Zeit zählt', () => {
  // drei Jahre: alle vier Monate
  const [b, e] = ['2024-08-01', '2027-07-31'];
  assert.equal(stufeAm(b, e, '2024-07-31'), 0, 'vor dem Beginn');
  assert.equal(stufeAm(b, e, '2024-08-01'), 0);
  assert.equal(stufeAm(b, e, '2024-11-30'), 0);
  assert.equal(stufeAm(b, e, '2024-12-01'), 1, 'nach vier Monaten');
  assert.equal(stufeAm(b, e, '2025-08-01'), 3, 'nach einem Jahr');
  assert.equal(stufeAm(b, e, '2026-08-01'), 6, 'nach zwei Jahren');
  assert.equal(stufeAm(b, e, '2027-07-30'), 8, 'kurz vor dem Ende fehlt nur der Abschlusshut');
  assert.equal(stufeAm(b, e, '2027-07-31'), 9, 'am letzten Tag');
  assert.equal(stufeAm(b, e, '2030-01-01'), 9);
  // zwei Jahre: kürzere Abstände, trotzdem alle neun Teile
  assert.equal(stufeAm('2025-08-01', '2027-07-31', '2025-10-20'), 0);
  assert.equal(stufeAm('2025-08-01', '2027-07-31', '2025-10-22'), 1, 'nach knapp drei Monaten');
  assert.equal(stufeAm('2025-08-01', '2027-07-31', '2027-07-31'), 9);
  // dreieinhalb Jahre
  assert.equal(stufeAm('2024-08-01', '2028-01-31', '2024-12-21'), 1, 'nach gut viereinhalb Monaten');
  assert.equal(stufeAm('2024-08-01', '2028-01-31', '2024-12-20'), 0);
  // ohne Zeiten kein Zubehör
  assert.equal(stufeAm(null, e, '2026-01-01'), 0);
  assert.equal(stufeAm(b, null, '2026-01-01'), 0);
  assert.equal(stufeAm(e, b, '2026-01-01'), 0, 'Ende vor Beginn');
  // der Tag des nächsten Teils ist genau der, an dem die Stufe steigt
  for (const tag of ['2024-08-01', '2025-03-15', '2026-11-12', '2027-07-01']) {
    const n = naechstesTeilAm(b, e, tag)!;
    assert.equal(stufeAm(b, e, n), stufeAm(b, e, tag) + 1, tag);
    assert.equal(stufeAm(b, e, new Date(Date.parse(n) - 86_400_000).toISOString().slice(0, 10)), stufeAm(b, e, tag), tag);
  }
  assert.equal(naechstesTeilAm(b, e, '2027-07-01'), '2027-07-31', 'der Abschlusshut kommt am letzten Tag');
  assert.equal(naechstesTeilAm(b, e, '2027-08-01'), null);
  assert.equal(naechstesTeilAm(null, null, '2026-01-01'), null);
});

async function welt() {
  const u = await umgebung();
  ohneWechsel(u.db, admin(u.db).id);
  const ausbilder = konto(u.db, 'ausbilder', 'Petra Lang');
  const bea = konto(u.db, 'beauftragter', 'Bea Auft');
  const anna = konto(u.db, 'azubi', 'Anna Azubi');
  const ben = konto(u.db, 'azubi', 'Ben Beispiel');
  const als = (wer: BenutzerZeile) => sitzung(u, wer);
  const tag = (d: number) => new Date(u.uhr.jetzt.getTime() + d * 86_400_000).toISOString().slice(0, 10);
  // Anna ist seit gut 20 Monaten dabei (von 36)
  assert.equal((await ruf(u, 'PUT', `/api/azubis/${anna.id}/profil`, { cookies: als(ausbilder), body: { ausbildungsbeginn: tag(-620), vertragsende: tag(475), ausbilderId: ausbilder.id } })).status, 200);
  zuweisen(u.db, anna, bea);
  return { u, ausbilder, bea, anna, ben, als, chef: admin(u.db) };
}

test('Begleiter: aussuchen, benennen, ausschalten – und die Teile kommen mit der Zeit', async () => {
  const w = await welt();
  const c = w.als(w.anna);
  const hol = async (wer = w.anna) => koerper(await ruf(w.u, 'GET', '/api/begleiter', { cookies: w.als(wer) }));
  assert.deepEqual(await hol(), { erlaubt: true, gefragt: false, an: false, figur: '', name: '', stufe: 5, gezeigt: 0, naechstesAm: (await hol()).naechstesAm, ohneZeit: false });
  assert.match((await hol()).naechstesAm, /^\d{4}-\d\d-\d\d$/);

  // einschalten braucht Figur und Namen
  const setze = (body: Record<string, unknown>, wer = w.anna) => ruf(w.u, 'PUT', '/api/begleiter', { cookies: w.als(wer), body });
  assert.equal((await setze({ an: true })).status, 400);
  assert.equal((await setze({ an: true, figur: 'kaktus', name: 'Kalle' })).status, 400, 'unbekannte Figur');
  assert.equal((await setze({ an: true, figur: 'biber', name: '' })).status, 400);
  assert.equal((await setze({ an: true, figur: 'biber', name: 'x'.repeat(21) })).status, 400);
  assert.equal((await setze({ figur: 'biber' })).status, 400, '„an“ fehlt');
  const neu = koerper(await setze({ an: true, figur: 'biber', name: ' Bruno ' }));
  assert.deepEqual([neu.an, neu.gefragt, neu.figur, neu.name, neu.stufe, neu.gezeigt], [true, true, 'biber', 'Bruno', 5, 0]);

  // die Animation wird je Stufe einmal gezeigt; mehr als die erreichte Stufe geht nicht
  const feier = (stufe: unknown) => ruf(w.u, 'POST', '/api/begleiter/gefeiert', { cookies: c, body: { stufe } });
  assert.equal(koerper(await feier(3)).gezeigt, 3);
  assert.equal(koerper(await feier(2)).gezeigt, 3, 'geht nicht zurück');
  assert.equal(koerper(await feier(9)).gezeigt, 5, 'höchstens die erreichte Stufe');
  assert.equal((await feier(10)).status, 400);
  assert.equal((await feier('x')).status, 400);

  // Figur und Name ändern, ausschalten, wieder einschalten: nichts geht verloren
  assert.equal(koerper(await setze({ an: true, figur: 'pinguin' })).figur, 'pinguin');
  const aus = koerper(await setze({ an: false }));
  assert.deepEqual([aus.an, aus.gefragt, aus.figur, aus.name, aus.gezeigt], [false, true, 'pinguin', 'Bruno', 5]);
  assert.equal(koerper(await setze({ an: true })).an, true);

  // ablehnen: gefragt, aber aus – und ohne Figur
  const nein = koerper(await setze({ an: false }, w.ben));
  assert.deepEqual([nein.an, nein.gefragt, nein.figur], [false, true, '']);
  assert.equal((await ruf(w.u, 'POST', '/api/begleiter/gefeiert', { cookies: w.als(w.ben), body: { stufe: 0 } })).status, 200);
  // Ben hat keinen Ausbildungsbeginn: Stufe 0, kein nächstes Teil
  assert.deepEqual([(await hol(w.ben)).stufe, (await hol(w.ben)).naechstesAm, (await hol(w.ben)).ohneZeit], [0, null, true]);
});

test('Begleiter ist privat: nur der Azubi selbst – Ausbilder, Beauftragte und Super-Admin sehen nichts davon', async () => {
  const w = await welt();
  await ruf(w.u, 'PUT', '/api/begleiter', { cookies: w.als(w.anna), body: { an: true, figur: 'fuchs', name: 'Geheimfuchs' } });
  for (const wer of [w.ausbilder, w.bea, w.chef]) {
    assert.equal((await ruf(w.u, 'GET', '/api/begleiter', { cookies: w.als(wer) })).status, 403, wer.rolle);
    assert.equal((await ruf(w.u, 'PUT', '/api/begleiter', { cookies: w.als(wer), body: { an: false } })).status, 403, wer.rolle);
  }
  assert.equal((await ruf(w.u, 'GET', '/api/begleiter')).status, 401);
  for (const pfad of [`/api/azubis/${w.anna.id}/profil`, `/api/azubis/${w.anna.id}/plan`, '/api/azubis', '/api/aktivitaeten']) {
    assert.equal(JSON.stringify((await ruf(w.u, 'GET', pfad, { cookies: w.als(w.ausbilder) })).body).includes('Geheimfuchs'), false, pfad);
  }
  assert.equal(JSON.stringify((await ruf(w.u, 'GET', '/api/protokoll', { cookies: w.als(w.chef) })).body).includes('Geheimfuchs'), false, 'auch nicht im Protokoll');
  // jeder Azubi hat seinen eigenen
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/begleiter', { cookies: w.als(w.ben) })).name, '');
});

test('Super-Admin schaltet den Begleiter für das ganze Portal aus und wieder ein', async () => {
  const w = await welt();
  await ruf(w.u, 'PUT', '/api/begleiter', { cookies: w.als(w.anna), body: { an: true, figur: 'eule', name: 'Uhu' } });
  const schalter = (wer: BenutzerZeile, an?: boolean) => ruf(w.u, an === undefined ? 'GET' : 'PUT', '/api/begleiter/einstellung', { cookies: w.als(wer), body: an === undefined ? undefined : { an } });
  assert.deepEqual(koerper(await schalter(w.chef)), { an: true }, 'anfangs an');
  for (const wer of [w.ausbilder, w.bea, w.anna]) {
    assert.equal((await schalter(wer)).status, 403, wer.rolle);
    assert.equal((await schalter(wer, false)).status, 403, wer.rolle);
  }
  assert.equal((await ruf(w.u, 'PUT', '/api/begleiter/einstellung', { cookies: w.als(w.chef), body: {} })).status, 400);
  assert.deepEqual(koerper(await schalter(w.chef, false)), { an: false });
  const anna = koerper(await ruf(w.u, 'GET', '/api/begleiter', { cookies: w.als(w.anna) }));
  assert.deepEqual([anna.erlaubt, anna.an, anna.name], [false, true, 'Uhu'], 'die Wahl bleibt gespeichert, die Oberfläche zeigt nichts');
  assert.equal((await ruf(w.u, 'PUT', '/api/begleiter', { cookies: w.als(w.ben), body: { an: true, figur: 'biber', name: 'Bo' } })).status, 409);
  assert.equal((await ruf(w.u, 'PUT', '/api/begleiter', { cookies: w.als(w.ben), body: { an: false } })).status, 200, 'ablehnen geht immer');
  assert.deepEqual(koerper(await schalter(w.chef, true)), { an: true });
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/begleiter', { cookies: w.als(w.anna) })).erlaubt, true);
});
