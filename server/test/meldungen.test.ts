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

// kleinstes gültiges PNG (1 × 1 Pixel)
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

test('Fehler melden mit Bildschirmfoto: nur echte Bilder, das Bild steht nicht in der Liste und nur der Super-Admin holt es', async () => {
  const u = await umgebung();
  const chef = admin(u.db);
  ohneWechsel(u.db, chef.id);
  const azubi = konto(u.db, 'azubi');
  const cA = sitzung(u, azubi);
  const cC = sitzung(u, chef);
  const text = 'Die Seite sieht so aus wie im Bild.';
  for (const falsch of ['kein bild', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', 'data:image/png;base64,QUJDREVGR0hJSktMTU5P', `data:image/png;base64,${Buffer.alloc(151 * 1024).toString('base64')}`, 42]) {
    assert.equal((await ruf(u, 'POST', '/api/fehlermeldungen', { cookies: cA, body: { text, bild: falsch } })).status, 400, String(falsch).slice(0, 40));
  }
  assert.equal((await ruf(u, 'POST', '/api/fehlermeldungen', { cookies: cA, body: { text, bild: PNG } })).status, 201);
  assert.equal((await ruf(u, 'POST', '/api/fehlermeldungen', { cookies: cA, body: { text: 'Und eine Meldung ohne Bild.' } })).status, 201);
  const l = koerper(await ruf(u, 'GET', '/api/fehlermeldungen', { cookies: cC }));
  assert.deepEqual(l.meldungen.map((m: any) => m.hatBild), [false, true]);
  assert.ok(!JSON.stringify(l).includes('iVBOR'), 'die Liste enthält keine Bilddaten');
  const [ohne, mit] = l.meldungen;
  assert.equal(koerper(await ruf(u, 'GET', `/api/fehlermeldungen/${mit.id}/bild`, { cookies: cC })).bild, PNG);
  assert.equal((await ruf(u, 'GET', `/api/fehlermeldungen/${ohne.id}/bild`, { cookies: cC })).status, 404);
  assert.equal((await ruf(u, 'GET', `/api/fehlermeldungen/${mit.id}/bild`, { cookies: cA })).status, 403);
  await ruf(u, 'DELETE', `/api/fehlermeldungen/${mit.id}`, { cookies: cC });
  assert.equal((u.db.prepare('SELECT COUNT(*) AS n FROM fehlermeldung WHERE bild IS NOT NULL').get() as { n: number }).n, 0, 'das Bild wird mit der Meldung gelöscht');
});

test('Teams-Benachrichtigung: Karte ohne Namen, Text nur auf Wunsch; ein Ausfall stört die Meldung nicht', async () => {
  const gesendet: { url: string; body: any }[] = [];
  let antwort: () => Promise<{ ok: boolean; status: number }> = async () => ({ ok: true, status: 202 });
  const sende = async (url: string, body: unknown) => {
    gesendet.push({ url, body });
    return antwort();
  };
  const tick = () => new Promise((r) => setImmediate(r));
  const WEBHOOK = 'https://example.test/workflows/geheim';

  // ohne Einstellung: nichts geht hinaus
  const ohne = await umgebung({}, null, sende);
  ohneWechsel(ohne.db, admin(ohne.db).id);
  assert.equal((await ruf(ohne, 'POST', '/api/fehlermeldungen', { cookies: sitzung(ohne, konto(ohne.db, 'azubi')), body: { text: 'Ohne Webhook passiert nichts.' } })).status, 201);
  await tick();
  assert.equal(gesendet.length, 0);
  assert.equal(koerper(await ruf(ohne, 'GET', '/api/fehlermeldungen', { cookies: sitzung(ohne, admin(ohne.db)) })).webhook, false);
  assert.equal((await ruf(ohne, 'POST', '/api/fehlermeldungen/webhook-test', { cookies: sitzung(ohne, admin(ohne.db)) })).status, 409);

  // mit Einstellung, ohne Text
  const u = await umgebung({ FEHLER_WEBHOOK_URL: WEBHOOK }, null, sende);
  const chef = admin(u.db);
  ohneWechsel(u.db, chef.id);
  const azubi = konto(u.db, 'azubi', 'Anna Azubi');
  assert.equal((await ruf(u, 'POST', '/api/fehlermeldungen', { cookies: sitzung(u, azubi), body: { text: 'Geheimer Inhalt der Meldung', seite: '/berichtsheft', bild: PNG } })).status, 201);
  await tick();
  assert.equal(gesendet.length, 1);
  assert.equal(gesendet[0].url, WEBHOOK);
  const karte = gesendet[0].body.attachments[0];
  assert.equal(karte.contentType, 'application/vnd.microsoft.card.adaptive');
  const roh = JSON.stringify(gesendet[0].body);
  assert.ok(roh.includes('Nr. 1') && roh.includes('/berichtsheft') && roh.includes('"Azubi"'));
  // der Link ins Portal: genau diese Adresse, nicht nur ein Teil davon
  const links = roh.match(/https?:\/\/[^"\\]+/g) ?? [];
  const insPortal = links.map((l) => new URL(l)).filter((l) => l.hostname === 'portal.test');
  assert.deepEqual(insPortal.map((l) => l.href), ['https://portal.test/verwaltung/meldungen']);
  assert.ok(!roh.includes('Anna') && !roh.includes('Geheimer Inhalt') && !roh.includes('iVBOR'), 'kein Name, kein Text, kein Bild');
  assert.ok(roh.length < 28_000, 'unter der Größengrenze von Teams');

  // Ausfall: Meldung wird trotzdem gespeichert, im Log steht der Grund ohne die Adresse
  antwort = async () => ({ ok: false, status: 400 });
  assert.equal((await ruf(u, 'POST', '/api/fehlermeldungen', { cookies: sitzung(u, azubi), body: { text: 'Teams antwortet mit einem Fehler.' } })).status, 201);
  antwort = async () => {
    throw new Error('ENOTFOUND');
  };
  assert.equal((await ruf(u, 'POST', '/api/fehlermeldungen', { cookies: sitzung(u, azubi), body: { text: 'Teams ist gar nicht erreichbar.' } })).status, 201);
  await tick();
  assert.equal(koerper(await ruf(u, 'GET', '/api/fehlermeldungen', { cookies: sitzung(u, chef) })).meldungen.length, 3);
  const log = u.logs.join('\n');
  assert.ok(log.includes('Status 400') && log.includes('nicht erreichbar') && !log.includes('geheim'));

  // Test-Knopf des Super-Admins
  assert.equal((await ruf(u, 'POST', '/api/fehlermeldungen/webhook-test', { cookies: sitzung(u, chef) })).status, 502);
  antwort = async () => ({ ok: true, status: 202 });
  assert.equal((await ruf(u, 'POST', '/api/fehlermeldungen/webhook-test', { cookies: sitzung(u, chef) })).status, 200);
  assert.ok(JSON.stringify(gesendet.at(-1)!.body).includes('Test:'));
  assert.equal((await ruf(u, 'POST', '/api/fehlermeldungen/webhook-test', { cookies: sitzung(u, azubi) })).status, 403);

  // mit Text
  const t = await umgebung({ FEHLER_WEBHOOK_URL: WEBHOOK, FEHLER_WEBHOOK_MIT_TEXT: 'true' }, null, sende);
  assert.equal((await ruf(t, 'POST', '/api/fehlermeldungen', { cookies: sitzung(t, konto(t.db, 'azubi', 'Ben Azubi')), body: { text: 'Dieser Text darf mit nach Teams.' } })).status, 201);
  await tick();
  const mitText = JSON.stringify(gesendet.at(-1)!.body);
  assert.ok(mitText.includes('Dieser Text darf mit nach Teams.') && !mitText.includes('Ben'));
});

test('FEHLER_WEBHOOK_URL muss eine https-Adresse sein', async () => {
  await assert.rejects(umgebung({ FEHLER_WEBHOOK_URL: 'http://example.test/x' }), /https/);
  await assert.rejects(umgebung({ FEHLER_WEBHOOK_URL: 'kein link' }), /https/);
});
