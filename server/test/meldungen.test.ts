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

test('Teams-Benachrichtigung: Antwortet die Person auf eine Rückfrage, kommt eine Karte – ohne Namen, die Antwort nur auf Wunsch', async () => {
  const gesendet: any[] = [];
  const sende = async (_url: string, body: unknown) => {
    gesendet.push(body);
    return { ok: true, status: 202 };
  };
  const tick = () => new Promise((r) => setImmediate(r));
  for (const mitText of [false, true]) {
    gesendet.length = 0;
    const u = await umgebung({ FEHLER_WEBHOOK_URL: 'https://example.test/workflows/geheim', ...(mitText ? { FEHLER_WEBHOOK_MIT_TEXT: 'true' } : {}) }, null, sende);
    const chef = admin(u.db);
    ohneWechsel(u.db, chef.id);
    const anna = konto(u.db, 'azubi', 'Anna Azubi');
    await ruf(u, 'POST', '/api/fehlermeldungen', { cookies: sitzung(u, anna), body: { art: 'idee', text: 'Eine Idee zum Testen.' } });
    const id = (u.db.prepare('SELECT id FROM fehlermeldung').get() as { id: number }).id;
    await ruf(u, 'POST', `/api/fehlermeldungen/${id}/nachricht`, { cookies: sitzung(u, chef), body: { text: 'Wie meinst du das?' } });
    await tick();
    assert.equal(gesendet.length, 1, 'die Rückfrage selbst geht nicht an den Kanal');
    assert.equal((await ruf(u, 'POST', `/api/meine-meldungen/${id}/antwort`, { cookies: sitzung(u, anna), body: { text: 'So und so meine ich das.' } })).status, 201);
    await tick();
    assert.equal(gesendet.length, 2);
    const roh = JSON.stringify(gesendet[1]);
    assert.ok(roh.includes(`Neue Antwort zu Idee Nr. ${id}`) && roh.includes('"Azubi"') && roh.includes('/verwaltung/meldungen'));
    assert.ok(!roh.includes('Anna'), 'kein Name');
    assert.equal(roh.includes('So und so meine ich das.'), mitText, 'die Antwort nur, wenn der Text mit darf');
  }
});

test('FEHLER_WEBHOOK_URL muss eine https-Adresse sein', async () => {
  await assert.rejects(umgebung({ FEHLER_WEBHOOK_URL: 'http://example.test/x' }), /https/);
  await assert.rejects(umgebung({ FEHLER_WEBHOOK_URL: 'kein link' }), /https/);
});

test('Rückfragen: Super-Admin fragt nach, die Person antwortet unter „Meine Meldungen“ – eine Antwort öffnet die Meldung wieder', async () => {
  const u = await umgebung();
  const chef = admin(u.db);
  ohneWechsel(u.db, chef.id);
  const anna = konto(u.db, 'azubi', 'Anna Azubi');
  const ben = konto(u.db, 'azubi', 'Ben Beispiel');
  const cA = sitzung(u, anna);
  const cB = sitzung(u, ben);
  const cC = sitzung(u, chef);
  await ruf(u, 'POST', '/api/fehlermeldungen', { cookies: cA, body: { text: 'Der Knopf reagiert nicht.', technik: 'TypeError' } });
  const id = koerper(await ruf(u, 'GET', '/api/fehlermeldungen', { cookies: cC })).meldungen[0].id;

  for (const falsch of [undefined, '', 'x', 'x'.repeat(2001)]) assert.equal((await ruf(u, 'POST', `/api/fehlermeldungen/${id}/nachricht`, { cookies: cC, body: { text: falsch } })).status, 400);
  assert.equal((await ruf(u, 'POST', '/api/fehlermeldungen/9999/nachricht', { cookies: cC, body: { text: 'Hallo?' } })).status, 404);
  const r = await ruf(u, 'POST', `/api/fehlermeldungen/${id}/nachricht`, { cookies: cC, body: { text: 'Welchen Knopf meinst du?' } });
  assert.equal(r.status, 201);
  assert.deepEqual(koerper(r).meldungen[0].nachrichten.map((n: any) => [n.text, n.vonPerson]), [['Welchen Knopf meinst du?', false]]);

  // Glocke nur für die meldende Person
  const glA = koerper(await ruf(u, 'GET', '/api/aktivitaeten', { cookies: cA }));
  assert.equal(glA.neu, 1);
  assert.deepEqual([glA.gruppen[0].art, glA.gruppen[0].titel], ['meldung_rueckfrage', [`Fehlermeldung Nr. ${id}`]]);
  assert.equal(koerper(await ruf(u, 'GET', '/api/aktivitaeten', { cookies: cB })).neu, 0, 'andere sehen die Rückfrage nicht');

  // „Meine Meldungen“: nur die eigenen, ohne Technik
  const m = koerper(await ruf(u, 'GET', '/api/meine-meldungen', { cookies: cA }));
  assert.equal(m.neu, 1);
  assert.equal(m.meldungen.length, 1);
  assert.equal(m.meldungen[0].technik, undefined);
  assert.equal(koerper(await ruf(u, 'GET', '/api/meine-meldungen', { cookies: cB })).meldungen.length, 0);
  assert.equal((await ruf(u, 'POST', `/api/meine-meldungen/${id}/antwort`, { cookies: cB, body: { text: 'Ich mische mich ein.' } })).status, 404, 'fremde Meldung');
  assert.equal(koerper(await ruf(u, 'POST', '/api/meine-meldungen/gesehen', { cookies: cA })).neu, 0);

  // erledigt → Glocke; Antwort → wieder offen und „neue Antwort“ für den Super-Admin
  await ruf(u, 'PATCH', `/api/fehlermeldungen/${id}`, { cookies: cC, body: { status: 'erledigt' } });
  assert.equal(koerper(await ruf(u, 'GET', '/api/aktivitaeten', { cookies: cA })).gruppen[0].art, 'meldung_erledigt');
  const a = koerper(await ruf(u, 'POST', `/api/meine-meldungen/${id}/antwort`, { cookies: cA, body: { text: 'Den Knopf „Einreichen“.' } }));
  assert.equal(a.meldungen[0].status, 'offen');
  assert.equal(a.meldungen[0].neu, 0, 'die eigene Antwort ist nicht neu');
  const l = koerper(await ruf(u, 'GET', '/api/fehlermeldungen', { cookies: cC }));
  assert.deepEqual([l.meldungen[0].status, l.meldungen[0].antwortNeu, l.meldungen[0].nachrichten.length], ['offen', true, 2]);
  assert.equal(l.meldungen[0].nachrichten[1].vonPerson, true);
  await ruf(u, 'POST', `/api/fehlermeldungen/${id}/nachricht`, { cookies: cC, body: { text: 'Danke, ich schaue es mir an.' } });
  assert.equal(koerper(await ruf(u, 'GET', '/api/fehlermeldungen', { cookies: cC })).meldungen[0].antwortNeu, false);

  // Löschen nimmt das Gespräch mit
  await ruf(u, 'DELETE', `/api/fehlermeldungen/${id}`, { cookies: cC });
  assert.equal((u.db.prepare('SELECT COUNT(*) AS n FROM fehlermeldung_nachricht').get() as { n: number }).n, 0);
});

test('Rückfragen: Ausbilder schreiben nur bei Ideen; Wünsche zu Lerninhalten haben kein Gespräch', async () => {
  const u = await umgebung();
  const chef = admin(u.db);
  ohneWechsel(u.db, chef.id);
  const anna = konto(u.db, 'azubi', 'Anna Azubi');
  const petra = konto(u.db, 'ausbilder', 'Petra Lang');
  const cA = sitzung(u, anna);
  const cP = sitzung(u, petra);
  const cC = sitzung(u, chef);
  await ruf(u, 'POST', '/api/fehlermeldungen', { cookies: cA, body: { text: 'Ein Fehler zum Testen.' } });
  await ruf(u, 'POST', '/api/fehlermeldungen', { cookies: cA, body: { art: 'idee', text: 'Eine Idee zum Testen.' } });
  const [idee, fehler] = (u.db.prepare("SELECT id FROM fehlermeldung ORDER BY id DESC").all() as { id: number }[]).map((z) => z.id);
  u.db.prepare("INSERT INTO fehlermeldung (zeit, benutzer_id, benutzer_name, rolle, text, art, paket, thema, ziel) VALUES ('2026-11-10', NULL, '', 'azubi', 'Bitte besser erklären', 'inhalt', 'p', 't', 'z')").run();
  const inhalt = (u.db.prepare("SELECT id FROM fehlermeldung WHERE art = 'inhalt'").get() as { id: number }).id;

  assert.equal((await ruf(u, 'POST', `/api/rueckmeldungen/${fehler}/nachricht`, { cookies: cP, body: { text: 'Darf ich nicht.' } })).status, 404);
  assert.equal((await ruf(u, 'POST', `/api/rueckmeldungen/${inhalt}/nachricht`, { cookies: cP, body: { text: 'Darf ich nicht.' } })).status, 404);
  assert.equal((await ruf(u, 'POST', `/api/fehlermeldungen/${inhalt}/nachricht`, { cookies: cC, body: { text: 'Darf ich nicht.' } })).status, 404);
  const r = koerper(await ruf(u, 'POST', `/api/rueckmeldungen/${idee}/nachricht`, { cookies: cP, body: { text: 'Wie stellst du dir das vor?' } }));
  assert.equal(r.ideen[0].nachrichten[0].name, 'Petra Lang');
  // der Super-Admin sieht dasselbe Gespräch
  const l = koerper(await ruf(u, 'GET', '/api/fehlermeldungen', { cookies: cC }));
  assert.equal(l.meldungen.find((m: any) => m.id === idee).nachrichten.length, 1);
  assert.equal((u.db.prepare('SELECT COUNT(*) AS n FROM fehlermeldung_nachricht WHERE meldung_id = ?').get(inhalt) as { n: number }).n, 0);
});
