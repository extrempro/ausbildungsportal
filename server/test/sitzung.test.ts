import assert from 'node:assert/strict';
import { test } from 'node:test';
import { beendeEigeneSitzung, beginneSitzung, eigeneSitzungen, geraetAus, HOECHST_MS, LEERLAUF_MS, pruefeSitzung, sitzungsEnde } from '../sitzung';
import { koerper, konto, neueDb, ruf, sitzung, umgebung } from './hilfe';

test('Sitzungsende: nach 8 Stunden Leerlauf – kurz vor der festen Grenze von 24 Stunden diese (WCAG 2.2.1: die Oberfläche warnt vorher)', async () => {
  const db = await neueDb();
  const anna = konto(db, 'azubi', 'Anna');
  const start = new Date('2026-11-10T08:00:00Z');
  const token = beginneSitzung(db, anna.id, start);
  assert.deepEqual(sitzungsEnde(db, token), { ende: new Date(start.getTime() + LEERLAUF_MS).toISOString(), fest: false });
  // jede Anfrage verschiebt das Ende – bis die feste Grenze näher ist
  for (const stunde of [7, 14, 20]) assert.ok(pruefeSitzung(db, token, new Date(start.getTime() + stunde * 3_600_000)));
  assert.deepEqual(sitzungsEnde(db, token), { ende: new Date(start.getTime() + HOECHST_MS).toISOString(), fest: true });
  assert.equal(sitzungsEnde(db, 'gibt-es-nicht'), null);
  assert.equal(sitzungsEnde(db, undefined), null);
});

test('Gerätetext: nur Browser und System, ohne Version', () => {
  const faelle: [string, string][] = [
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1', 'Safari · iPhone'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0', 'Edge · Windows'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36', 'Chrome · Mac'],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0', 'Firefox · Linux'],
    ['Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36 OPR/90.0', 'Opera · Android'],
    ['Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/142.0 Mobile/15E148 Safari/604.1', 'Chrome · iPad'],
    ['curl/8.11', ''],
  ];
  for (const [kennung, text] of faelle) assert.equal(geraetAus(kennung), text, kennung);
  assert.equal(geraetAus(undefined), '');
});

test('Angemeldete Geräte: nur eigene Sitzungen, andere einzeln oder alle abmelden, die aktuelle bleibt', async () => {
  const db = await neueDb();
  const anna = konto(db, 'azubi', 'Anna');
  const ben = konto(db, 'azubi', 'Ben');
  const jetzt = new Date('2026-11-21T08:00:00Z');
  const hier = beginneSitzung(db, anna.id, jetzt, 'Firefox · Windows');
  const handy = beginneSitzung(db, anna.id, jetzt, 'Safari · iPhone');
  beginneSitzung(db, anna.id, jetzt, 'Edge · Windows');
  const fremd = beginneSitzung(db, ben.id, jetzt, 'Chrome · Android');

  const liste = eigeneSitzungen(db, anna.id, hier, jetzt);
  assert.equal(liste.length, 3);
  assert.deepEqual([liste[0].geraet, liste[0].diese], ['Firefox · Windows', true]);
  assert.ok(liste.every((s) => /^[0-9a-f]{16}$/.test(s.id)));

  // fremde Sitzung, die aktuelle und Unsinn: nichts passiert
  const bens = eigeneSitzungen(db, ben.id, fremd, jetzt)[0].id;
  assert.equal(beendeEigeneSitzung(db, anna.id, bens, hier), false);
  assert.equal(beendeEigeneSitzung(db, anna.id, liste[0].id, hier), false);
  assert.equal(beendeEigeneSitzung(db, anna.id, "' OR 1=1 --", hier), false);
  assert.ok(pruefeSitzung(db, fremd, jetzt));

  // ein Gerät einzeln abmelden
  const handyId = liste.find((s) => s.geraet === 'Safari · iPhone')!.id;
  assert.equal(beendeEigeneSitzung(db, anna.id, handyId, hier), true);
  assert.equal(pruefeSitzung(db, handy, jetzt), null);
  assert.equal(eigeneSitzungen(db, anna.id, hier, jetzt).length, 2);

  // abgelaufene Sitzungen stehen nicht in der Liste
  assert.equal(eigeneSitzungen(db, anna.id, hier, new Date(jetzt.getTime() + HOECHST_MS + 1)).length, 0);
});

test('Angemeldete Geräte über die API: jede Rolle sieht nur die eigenen, fremde Kennung → 404, „überall sonst abmelden“', async () => {
  const u = await umgebung();
  const anna = konto(u.db, 'azubi', 'Anna');
  const petra = konto(u.db, 'ausbilder', 'Petra');
  const hier = sitzung(u, anna);
  const dort = sitzung(u, anna);
  const petras = sitzung(u, petra);

  const liste = koerper(await ruf(u, 'GET', '/api/ich/sitzungen', { cookies: hier })).sitzungen as { id: string; diese: boolean }[];
  assert.equal(liste.length, 2);
  assert.ok(liste[0].diese);
  const petraId = (koerper(await ruf(u, 'GET', '/api/ich/sitzungen', { cookies: petras })).sitzungen as { id: string }[])[0].id;

  // fremde Sitzung und die eigene aktuelle: 404, nichts passiert
  assert.equal((await ruf(u, 'DELETE', `/api/ich/sitzungen/${petraId}`, { cookies: hier })).status, 404);
  assert.equal((await ruf(u, 'DELETE', `/api/ich/sitzungen/${liste[0].id}`, { cookies: hier })).status, 404);
  assert.equal((await ruf(u, 'GET', '/api/ich', { cookies: petras })).status, 200);
  // ohne passende Herkunft: abgelehnt
  assert.equal((await ruf(u, 'POST', '/api/ich/sitzungen/andere-abmelden', { cookies: hier, origin: 'https://boese.example' })).status, 403);

  const nachher = koerper(await ruf(u, 'POST', '/api/ich/sitzungen/andere-abmelden', { cookies: hier })).sitzungen as unknown[];
  assert.equal(nachher.length, 1);
  assert.equal((await ruf(u, 'GET', '/api/ich', { cookies: dort })).status, 401, 'das andere Gerät ist abgemeldet');
  assert.equal((await ruf(u, 'GET', '/api/ich', { cookies: hier })).status, 200, 'dieses Gerät bleibt angemeldet');
  assert.equal((await ruf(u, 'GET', '/api/ich', { cookies: petras })).status, 200, 'fremde Sitzungen bleiben');
  assert.ok(u.db.prepare("SELECT 1 FROM protokoll WHERE aktion = 'abmeldung' AND detail = 'alle anderen Geräte abgemeldet'").get());
});
