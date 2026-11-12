import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BenutzerZeile } from '../typen';
import { admin, koerper, konto, ohneWechsel, ruf, sitzung, umgebung, zuweisen } from './hilfe';
import type { Umgebung } from './hilfe';

// „heute“ ist in der Testumgebung Dienstag, der 10.11.2026; die laufende Woche beginnt am 09.11.2026.
const WOCHE = '2026-11-02';
const PFAD = 'M10 10 L20 20 L30 10 L40 20 L50 10 L60 20';
const INHALT = { betrieb: [{ text: 'Switch konfiguriert\nVLANs eingerichtet', stunden: 32 }], schule: [], unterweisung: [{ text: 'Brandschutz', stunden: '1,5' }], abwesenheit: [{ tag: '2026-11-06', grund: 'urlaub', stunden: 8, text: '' }] };

interface Welt {
  u: Umgebung;
  admin: BenutzerZeile;
  ausbilder: BenutzerZeile;
  beauftragter: BenutzerZeile;
  azubi: BenutzerZeile;
  ben: BenutzerZeile;
}

/** Zwei Azubis mit Ausbildungsbeginn 01.08.2025, Betrieb in Hamburg; alle haben eine Unterschrift hinterlegt. */
async function welt(mitUnterschrift = true): Promise<Welt> {
  const u = await umgebung();
  ohneWechsel(u.db, admin(u.db).id);
  const w: Welt = { u, admin: admin(u.db), ausbilder: konto(u.db, 'ausbilder'), beauftragter: konto(u.db, 'beauftragter'), azubi: konto(u.db, 'azubi', 'Anna Azubi'), ben: konto(u.db, 'azubi', 'Ben Azubi') };
  const cookies = sitzung(u, w.ausbilder);
  await ruf(u, 'PUT', '/api/stammdaten/betrieb', { cookies, body: { name: 'Muster GmbH', bundesland: 'HH' } });
  for (const a of [w.azubi, w.ben]) await ruf(u, 'PUT', `/api/azubis/${a.id}/profil`, { cookies, body: { ausbildungsbeginn: '2025-08-01', ausbilderId: w.ausbilder.id } });
  if (mitUnterschrift) {
    for (const wer of [w.ausbilder, w.beauftragter, w.azubi, w.ben]) await ruf(u, 'PUT', '/api/ich/unterschrift', { cookies: sitzung(u, wer), body: { pfad: PFAD } });
  }
  return w;
}

const pfad = (a: BenutzerZeile, montag = WOCHE, aktion = '') => `/api/azubis/${a.id}/berichte/${montag}${aktion ? `/${aktion}` : ''}`;
const als = (w: Welt, wer: BenutzerZeile) => sitzung(w.u, wer);
const schreibe = (w: Welt, a: BenutzerZeile = w.azubi, montag = WOCHE, inhalt: unknown = INHALT) => ruf(w.u, 'PUT', pfad(a, montag), { cookies: als(w, a), body: { inhalt } });
const reicheEin = (w: Welt, a: BenutzerZeile = w.azubi, montag = WOCHE) => ruf(w.u, 'POST', pfad(a, montag, 'einreichen'), { cookies: als(w, a) });
const zeichneAb = (w: Welt, wer: BenutzerZeile, berichte: unknown[]) => ruf(w.u, 'POST', '/api/berichte/abzeichnen', { cookies: als(w, wer), body: { berichte } });
const lies = async (w: Welt, wer: BenutzerZeile, a: BenutzerZeile = w.azubi, montag = WOCHE) => koerper(await ruf(w.u, 'GET', pfad(a, montag), { cookies: als(w, wer) }));

test('Unterschrift hinterlegen: nur gültige Pfade, der Super-Admin hat keine', async () => {
  const w = await welt(false);
  const cookies = als(w, w.azubi);
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/ich/unterschrift', { cookies })).pfad, null);
  for (const falsch of ['', 'M1 1 L2 2', '<script>alert(1)</script>', 'M10 10 L20 20 L30 10 L40 20 L50 10 L60 20 Z', 'L10 10 L20 20 L30 10 L40 20 L50 10 L60 20', `M1 1 ${'L1 1 '.repeat(20000)}`, 42]) {
    assert.equal((await ruf(w.u, 'PUT', '/api/ich/unterschrift', { cookies, body: { pfad: falsch } })).status, 400, String(falsch).slice(0, 30));
  }
  assert.equal((await ruf(w.u, 'PUT', '/api/ich/unterschrift', { cookies, body: { pfad: PFAD } })).status, 200);
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/ich/unterschrift', { cookies })).pfad, PFAD);
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/ich/unterschrift', { cookies: als(w, w.ben) })).pfad, null, 'jeder hat seine eigene');
  assert.equal((await ruf(w.u, 'DELETE', '/api/ich/unterschrift', { cookies })).status, 200);
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/ich/unterschrift', { cookies })).pfad, null);
  assert.equal((await ruf(w.u, 'PUT', '/api/ich/unterschrift', { cookies: als(w, w.admin), body: { pfad: PFAD } })).status, 403);
});

test('Azubi schreibt einen Bericht: Entwurf, Summen, Liste der Wochen', async () => {
  const w = await welt();
  const a = await schreibe(w);
  assert.equal(a.status, 200);
  const b = koerper(a);
  assert.deepEqual([b.status, b.kw, b.jahr, b.sonntag, b.ausbildungsjahr, b.soll], ['entwurf', 45, 2026, '2026-11-08', 2, 40]);
  assert.deepEqual(b.summe, { betrieb: 32, unterweisung: 1.5, schule: 0, abwesenheit: 8, gesamt: 41.5 });
  assert.equal(b.inhalt.betrieb[0].text, 'Switch konfiguriert\nVLANs eingerichtet', 'Zeilenumbrüche bleiben erhalten');
  assert.deepEqual(b.rechte, { schreiben: true, einreichen: true, zurueckziehen: false, loeschen: true, abzeichnen: false, oeffnen: false });
  assert.deepEqual(b.kopf, { azubi: 'Anna Azubi', beruf: '', betrieb: 'Muster GmbH', ausbilder: w.ausbilder.anzeigename });

  const liste = koerper(await ruf(w.u, 'GET', `/api/azubis/${w.azubi.id}/berichte`, { cookies: als(w, w.azubi) }));
  assert.equal(liste.eigenes, true);
  assert.equal(liste.wochen[0].montag, '2026-11-09', 'neueste Woche zuerst, bis zur laufenden Woche');
  assert.equal(liste.wochen.at(-1).montag, '2025-07-28', 'ab der Woche des Ausbildungsbeginns');
  assert.equal(liste.wochen.length, 68);
  assert.deepEqual([liste.wochen[1].status, liste.wochen[1].stunden, liste.wochen[0].status], ['entwurf', 41.5, 'fehlt']);
  assert.equal(liste.berichte, undefined);
  const voll = koerper(await ruf(w.u, 'GET', `/api/azubis/${w.azubi.id}/berichte?voll=1`, { cookies: als(w, w.azubi) }));
  assert.equal(voll.berichte.length, 1);
  assert.equal(voll.berichte[0].inhalt.betrieb[0].stunden, 32);
});

test('Eingaben des Berichts werden geprüft', async () => {
  const w = await welt();
  const status = async (inhalt: unknown, montag = WOCHE) => (await schreibe(w, w.azubi, montag, inhalt)).status;
  assert.equal(await status(INHALT, '2026-11-03'), 404, 'kein Montag');
  assert.equal(await status(INHALT, '2026-11-16'), 400, 'kommende Woche');
  assert.equal(await status(INHALT, '2025-07-21'), 400, 'vor der Ausbildung');
  assert.equal(await status({ betrieb: [{ text: 'Erster Tag', stunden: 8 }] }, '2025-07-28'), 200, 'Woche des Ausbildungsbeginns');
  assert.equal(await status(null), 400);
  assert.equal(await status({ betrieb: 'viel gearbeitet' }), 400);
  assert.equal(await status({ betrieb: [{ text: 'x', stunden: 61 }] }), 400);
  assert.equal(await status({ betrieb: [{ text: 'x', stunden: -1 }] }), 400);
  assert.equal(await status({ betrieb: [{ text: 'x', stunden: 'acht' }] }), 400);
  assert.equal(await status({ betrieb: [{ text: 'x'.repeat(2001), stunden: 1 }] }), 400);
  assert.equal(await status({ betrieb: [{ text: 'x\u0007', stunden: 1 }] }), 400);
  assert.equal(await status({ betrieb: Array.from({ length: 31 }, () => ({ text: 'x', stunden: 1 })) }), 400);
  assert.equal(await status({ abwesenheit: [{ tag: '2026-11-09', grund: 'urlaub', stunden: 8 }] }), 400, 'Tag außerhalb der Woche');
  assert.equal(await status({ abwesenheit: [{ tag: '2026-11-03', grund: 'faul', stunden: 8 }] }), 400);
  const ok = koerper(await schreibe(w, w.azubi, WOCHE, { betrieb: [{ text: '', stunden: 0 }, { text: 'A', stunden: 7.6 }] }));
  assert.deepEqual(ok.inhalt.betrieb, [{ text: 'A', stunden: 7.5 }], 'leere Zeilen fallen weg, Stunden auf Viertelstunden');
});

test('ohne Ausbildungsbeginn lässt sich kein Bericht schreiben', async () => {
  const w = await welt();
  const neu = konto(w.u.db, 'azubi');
  const a = await schreibe(w, neu);
  assert.equal(a.status, 409);
  assert.match(koerper(a).fehler, /Ausbildungsbeginn/);
  const liste = koerper(await ruf(w.u, 'GET', `/api/azubis/${neu.id}/berichte`, { cookies: als(w, neu) }));
  assert.deepEqual([liste.beginnFehlt, liste.wochen.length], [true, 0]);
});

test('neue Woche mit Feiertag: Abwesenheit ist vorbelegt, aber noch nichts gespeichert', async () => {
  const w = await welt();
  const b = await lies(w, w.azubi, w.azubi, '2026-05-11'); // Christi Himmelfahrt am Donnerstag, 14.05.2026
  assert.equal(b.status, 'fehlt');
  assert.deepEqual(b.inhalt.abwesenheit, [{ tag: '2026-05-14', grund: 'feiertag', stunden: 8, text: 'Christi Himmelfahrt' }]);
  assert.equal((w.u.db.prepare('SELECT COUNT(*) AS n FROM bericht').get() as { n: number }).n, 0);
  const samstag = await lies(w, w.azubi, w.azubi, '2026-10-26'); // Reformationstag 2026 fällt auf einen Samstag
  assert.deepEqual(samstag.inhalt.abwesenheit, []);
});

test('Einreichen braucht Inhalt und Unterschrift; danach ist der Bericht für den Azubi gesperrt', async () => {
  const w = await welt(false);
  assert.equal((await reicheEin(w)).status, 404, 'noch kein Bericht');
  await schreibe(w, w.azubi, WOCHE, { betrieb: [{ text: 'nur Text', stunden: 0 }] });
  assert.equal((await reicheEin(w)).status, 400, 'keine Stunden');
  await schreibe(w);
  const ohne = await reicheEin(w);
  assert.deepEqual([ohne.status, koerper(ohne).code], [409, 'unterschrift']);
  await ruf(w.u, 'PUT', '/api/ich/unterschrift', { cookies: als(w, w.azubi), body: { pfad: PFAD } });

  const b = koerper(await reicheEin(w));
  assert.equal(b.status, 'eingereicht');
  assert.deepEqual(b.signaturen.map((s: { art: string; name: string; pfad: string }) => [s.art, s.name, s.pfad]), [['azubi', 'Anna Azubi', PFAD]]);
  assert.deepEqual(b.rechte, { schreiben: false, einreichen: false, zurueckziehen: true, loeschen: false, abzeichnen: false, oeffnen: false });
  assert.equal((await schreibe(w)).status, 409);
  assert.equal((await reicheEin(w)).status, 409);
  assert.equal((await ruf(w.u, 'DELETE', pfad(w.azubi), { cookies: als(w, w.azubi) })).status, 409);

  const zurueck = koerper(await ruf(w.u, 'POST', pfad(w.azubi, WOCHE, 'zurueckziehen'), { cookies: als(w, w.azubi) }));
  assert.deepEqual([zurueck.status, zurueck.signaturen.length], ['entwurf', 0]);
  assert.deepEqual(zurueck.verlauf.map((v: { aktion: string }) => v.aktion), ['eingereicht', 'zurueckgezogen']);
  assert.equal((await ruf(w.u, 'DELETE', pfad(w.azubi), { cookies: als(w, w.azubi) })).status, 200, 'Entwurf lässt sich löschen');
});

test('nur der Azubi selbst schreibt und reicht ein', async () => {
  const w = await welt();
  await schreibe(w);
  for (const wer of [w.ausbilder, w.beauftragter, w.admin]) {
    assert.equal((await ruf(w.u, 'PUT', pfad(w.azubi), { cookies: als(w, wer), body: { inhalt: INHALT } })).status, 403, wer.rolle);
    assert.equal((await ruf(w.u, 'POST', pfad(w.azubi, WOCHE, 'einreichen'), { cookies: als(w, wer) })).status, 403, wer.rolle);
  }
  // ein anderer Azubi: sieht aus wie nicht vorhanden
  assert.equal((await ruf(w.u, 'PUT', pfad(w.azubi), { cookies: als(w, w.ben), body: { inhalt: INHALT } })).status, 404);
  assert.equal((await ruf(w.u, 'POST', pfad(w.azubi, WOCHE, 'einreichen'), { cookies: als(w, w.ben) })).status, 404);
  assert.equal((await ruf(w.u, 'GET', pfad(w.azubi), { cookies: als(w, w.ben) })).status, 404);
  assert.equal((await ruf(w.u, 'GET', `/api/azubis/${w.azubi.id}/berichte`, { cookies: als(w, w.ben) })).status, 404);
  assert.equal((await ruf(w.u, 'GET', pfad(w.azubi), { cookies: als(w, w.admin) })).status, 403, 'Super-Admin sieht keine Berichte');
  assert.equal((await ruf(w.u, 'GET', '/api/abzeichnen', { cookies: als(w, w.admin) })).status, 403);
});

test('Ausbilder zeichnet ab: Bericht gesperrt, Unterschrift als Kopie am Bericht', async () => {
  const w = await welt();
  await schreibe(w);
  assert.equal((await zeichneAb(w, w.ausbilder, [{ azubiId: w.azubi.id, montag: WOCHE }])).status, 409, 'Entwurf lässt sich nicht abzeichnen');
  await reicheEin(w);
  const offen = koerper(await ruf(w.u, 'GET', '/api/abzeichnen', { cookies: als(w, w.ausbilder) }));
  assert.deepEqual(offen.offen.map((o: { azubi: string; montag: string; stunden: number }) => [o.azubi, o.montag, o.stunden]), [['Anna Azubi', WOCHE, 41.5]]);
  assert.equal(offen.hatUnterschrift, true);
  assert.equal((await lies(w, w.ausbilder)).rechte.abzeichnen, true);

  assert.equal((await zeichneAb(w, w.ausbilder, [{ azubiId: w.azubi.id, montag: WOCHE }])).status, 200);
  const b = await lies(w, w.azubi);
  assert.equal(b.status, 'abgezeichnet');
  assert.deepEqual(b.signaturen.map((s: { art: string; rolle: string }) => [s.art, s.rolle]), [['azubi', 'azubi'], ['abzeichnung', 'ausbilder']]);
  assert.deepEqual(b.rechte, { schreiben: false, einreichen: false, zurueckziehen: false, loeschen: false, abzeichnen: false, oeffnen: false });
  assert.equal((await schreibe(w)).status, 409, 'abgezeichnet = gesperrt');
  assert.equal((await ruf(w.u, 'POST', pfad(w.azubi, WOCHE, 'zurueckziehen'), { cookies: als(w, w.azubi) })).status, 409);
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/abzeichnen', { cookies: als(w, w.ausbilder) })).offen.length, 0);

  // spätere Änderung der Unterschrift und sogar das Löschen des Kontos verändern den Nachweis nicht
  await ruf(w.u, 'PUT', '/api/ich/unterschrift', { cookies: als(w, w.ausbilder), body: { pfad: `${PFAD} L70 10` } });
  assert.equal((await ruf(w.u, 'DELETE', `/api/konten/${w.ausbilder.id}`, { cookies: als(w, w.admin) })).status, 200);
  const danach = await lies(w, w.azubi);
  assert.deepEqual([danach.status, danach.signaturen[1].name, danach.signaturen[1].pfad], ['abgezeichnet', w.ausbilder.anzeigename, PFAD]);
});

test('Abzeichnen ohne eigene Unterschrift geht nicht', async () => {
  const w = await welt();
  await schreibe(w);
  await reicheEin(w);
  await ruf(w.u, 'DELETE', '/api/ich/unterschrift', { cookies: als(w, w.ausbilder) });
  const a = await zeichneAb(w, w.ausbilder, [{ azubiId: w.azubi.id, montag: WOCHE }]);
  assert.deepEqual([a.status, koerper(a).code], [409, 'unterschrift']);
  assert.equal((await lies(w, w.azubi)).status, 'eingereicht');
});

test('Sammel-Abzeichnen: alles oder nichts, keine Doppelten', async () => {
  const w = await welt();
  for (const montag of [WOCHE, '2026-10-26']) {
    await schreibe(w, w.azubi, montag, { betrieb: [{ text: 'Arbeit', stunden: 40 }] });
    await reicheEin(w, w.azubi, montag);
  }
  await schreibe(w, w.ben, WOCHE, { betrieb: [{ text: 'Arbeit', stunden: 40 }] }); // nur Entwurf
  const gemischt = await zeichneAb(w, w.ausbilder, [{ azubiId: w.azubi.id, montag: WOCHE }, { azubiId: w.ben.id, montag: WOCHE }]);
  assert.equal(gemischt.status, 409);
  assert.equal((await lies(w, w.azubi)).status, 'eingereicht', 'nichts wurde abgezeichnet');
  assert.equal((await zeichneAb(w, w.ausbilder, [{ azubiId: w.azubi.id, montag: WOCHE }, { azubiId: w.azubi.id, montag: WOCHE }])).status, 400);
  assert.equal((await zeichneAb(w, w.ausbilder, [])).status, 400);
  assert.equal((await zeichneAb(w, w.ausbilder, [{ azubiId: w.azubi.id, montag: '2026-11-03' }])).status, 400);
  assert.equal((await zeichneAb(w, w.ausbilder, [{ azubiId: 99999, montag: WOCHE }])).status, 404);
  const beide = await zeichneAb(w, w.ausbilder, [{ azubiId: w.azubi.id, montag: WOCHE }, { azubiId: w.azubi.id, montag: '2026-10-26' }]);
  assert.deepEqual([beide.status, koerper(beide).abgezeichnet], [200, 2]);
});

test('Beauftragte: lesen zugewiesene Azubis, zeichnen nur Wochen in ihrem Zeitraum ab', async () => {
  const w = await welt();
  zuweisen(w.u.db, w.azubi, w.beauftragter, '2026-11-01', null);
  for (const [a, montag] of [[w.azubi, WOCHE], [w.azubi, '2026-10-19'], [w.ben, WOCHE]] as const) {
    await schreibe(w, a, montag, { betrieb: [{ text: 'Arbeit', stunden: 40 }] });
    await reicheEin(w, a, montag);
  }
  const offen = koerper(await ruf(w.u, 'GET', '/api/abzeichnen', { cookies: als(w, w.beauftragter) })).offen;
  assert.deepEqual(offen.map((o: { azubiId: number; montag: string }) => [o.azubiId, o.montag]), [[w.azubi.id, WOCHE]], 'nur die Woche im Zeitraum');
  assert.equal((await lies(w, w.beauftragter, w.azubi, '2026-10-19')).rechte.abzeichnen, false, 'lesen ja, abzeichnen nein');
  assert.equal((await ruf(w.u, 'GET', pfad(w.ben), { cookies: als(w, w.beauftragter) })).status, 404, 'nicht zugewiesener Azubi');
  assert.equal((await ruf(w.u, 'GET', `/api/azubis/${w.ben.id}/berichte`, { cookies: als(w, w.beauftragter) })).status, 404);

  assert.equal((await zeichneAb(w, w.beauftragter, [{ azubiId: w.azubi.id, montag: '2026-10-19' }])).status, 404, 'Woche vor der Zuweisung');
  assert.equal((await zeichneAb(w, w.beauftragter, [{ azubiId: w.ben.id, montag: WOCHE }])).status, 404);
  assert.equal((await ruf(w.u, 'POST', pfad(w.azubi, '2026-10-19', 'zurueckgeben'), { cookies: als(w, w.beauftragter), body: { kommentar: 'x' } })).status, 404);
  assert.equal((await zeichneAb(w, w.beauftragter, [{ azubiId: w.azubi.id, montag: WOCHE }])).status, 200);
  assert.equal((await lies(w, w.azubi)).signaturen[1].rolle, 'beauftragter');
  assert.equal((await ruf(w.u, 'POST', pfad(w.azubi, WOCHE, 'oeffnen'), { cookies: als(w, w.beauftragter), body: { kommentar: 'x' } })).status, 403, 'aufheben dürfen nur Ausbilder');
});

test('Zurückgeben mit Kommentar: Azubi überarbeitet und reicht neu ein', async () => {
  const w = await welt();
  await schreibe(w);
  await reicheEin(w);
  const ziel = pfad(w.azubi, WOCHE, 'zurueckgeben');
  assert.equal((await ruf(w.u, 'POST', ziel, { cookies: als(w, w.ausbilder), body: { kommentar: '  ' } })).status, 400, 'ohne Begründung nicht');
  assert.equal((await ruf(w.u, 'POST', ziel, { cookies: als(w, w.azubi), body: { kommentar: 'x' } })).status, 403);
  const b = koerper(await ruf(w.u, 'POST', ziel, { cookies: als(w, w.ausbilder), body: { kommentar: 'Bitte die Tätigkeiten genauer beschreiben.' } }));
  assert.deepEqual([b.status, b.kommentar, b.signaturen.length], ['zurueck', 'Bitte die Tätigkeiten genauer beschreiben.', 0]);
  assert.equal((await ruf(w.u, 'POST', ziel, { cookies: als(w, w.ausbilder), body: { kommentar: 'nochmal' } })).status, 409);

  const beimAzubi = await lies(w, w.azubi);
  assert.deepEqual([beimAzubi.rechte.schreiben, beimAzubi.rechte.einreichen, beimAzubi.kommentar], [true, true, 'Bitte die Tätigkeiten genauer beschreiben.']);
  assert.equal((await schreibe(w)).status, 200);
  assert.equal(koerper(await reicheEin(w)).status, 'eingereicht');
  assert.equal((await zeichneAb(w, w.ausbilder, [{ azubiId: w.azubi.id, montag: WOCHE }])).status, 200);
  const fertig = await lies(w, w.azubi);
  assert.equal(fertig.kommentar, '', 'Kommentar verschwindet mit dem Abzeichnen');
  assert.deepEqual(fertig.verlauf.map((v: { aktion: string }) => v.aktion), ['eingereicht', 'zurueckgegeben', 'eingereicht', 'abgezeichnet']);
});

test('Abzeichnung aufheben: nur Ausbilder, mit Begründung, Unterschriften fallen weg, steht im Protokoll', async () => {
  const w = await welt();
  await schreibe(w);
  await reicheEin(w);
  const ziel = pfad(w.azubi, WOCHE, 'oeffnen');
  assert.equal((await ruf(w.u, 'POST', ziel, { cookies: als(w, w.ausbilder), body: { kommentar: 'x' } })).status, 409, 'noch nicht abgezeichnet');
  await zeichneAb(w, w.ausbilder, [{ azubiId: w.azubi.id, montag: WOCHE }]);
  assert.equal((await lies(w, w.ausbilder)).rechte.oeffnen, true);
  assert.equal((await ruf(w.u, 'POST', ziel, { cookies: als(w, w.ausbilder), body: {} })).status, 400);
  const b = koerper(await ruf(w.u, 'POST', ziel, { cookies: als(w, w.ausbilder), body: { kommentar: 'Falsche Woche abgezeichnet' } }));
  assert.deepEqual([b.status, b.signaturen.length, b.abgezeichnetAm], ['zurueck', 0, null]);
  assert.equal((await schreibe(w)).status, 200, 'Azubi kann wieder bearbeiten');
  const protokoll = koerper(await ruf(w.u, 'GET', '/api/protokoll', { cookies: als(w, w.admin) })).eintraege as { aktion: string; detail: string; ziel_name: string }[];
  // Einreichen, Abzeichnen, Zurückgeben und Aufheben stehen im Verlauf des Berichts – nicht im Protokoll des Super-Admins
  assert.ok(!protokoll.some((e) => e.aktion.startsWith('bericht_')), 'keine Berichts-Ereignisse im Protokoll');
  assert.ok(!JSON.stringify(protokoll).includes('Switch konfiguriert'), 'keine Berichtsinhalte im Protokoll');
  assert.deepEqual((await lies(w, w.ausbilder)).verlauf.map((v: { aktion: string }) => v.aktion), ['eingereicht', 'abgezeichnet', 'abzeichnung_aufgehoben']);
  assert.equal((await ruf(w.u, 'GET', '/api/protokoll', { cookies: als(w, w.ausbilder) })).status, 403, 'das Protokoll sieht nur der Super-Admin');
});

test('Azubi-Liste nennt je Azubi wartende, zurückgegebene und fehlende Berichte', async () => {
  const w = await welt();
  await schreibe(w);
  await reicheEin(w);
  await schreibe(w, w.azubi, '2026-10-26', { betrieb: [{ text: 'x', stunden: 40 }] });
  await reicheEin(w, w.azubi, '2026-10-26');
  await ruf(w.u, 'POST', pfad(w.azubi, '2026-10-26', 'zurueckgeben'), { cookies: als(w, w.ausbilder), body: { kommentar: 'genauer' } });
  const liste = koerper(await ruf(w.u, 'GET', '/api/azubis', { cookies: als(w, w.ausbilder) })).azubis as { anzeigename: string; berichte: { wartend: number; zurueck: number; fehlend: number } }[];
  const von = (name: string) => liste.find((a) => a.anzeigename === name)!.berichte;
  // Ausbildungsbeginn 01.08.2025, heute 10.11.2026: 67 Wochen sind vorbei (28.07.2025 bis 02.11.2026)
  assert.deepEqual(von('Anna Azubi'), { wartend: 1, zurueck: 1, fehlend: 65 });
  assert.deepEqual(von('Ben Azubi'), { wartend: 0, zurueck: 0, fehlend: 67 });
});

test('Löschen eines Azubi-Kontos entfernt Berichte, Unterschriften und Verlauf', async () => {
  const w = await welt();
  await schreibe(w);
  await reicheEin(w);
  await zeichneAb(w, w.ausbilder, [{ azubiId: w.azubi.id, montag: WOCHE }]);
  assert.equal((await ruf(w.u, 'DELETE', `/api/konten/${w.azubi.id}`, { cookies: als(w, w.ausbilder) })).status, 200);
  for (const tabelle of ['bericht', 'bericht_signatur', 'bericht_verlauf']) {
    assert.equal((w.u.db.prepare(`SELECT COUNT(*) AS n FROM ${tabelle}`).get() as { n: number }).n, 0, tabelle);
  }
  assert.equal((w.u.db.prepare('SELECT COUNT(*) AS n FROM unterschrift WHERE benutzer_id = ?').get(w.azubi.id) as { n: number }).n, 0);
});

test('Berichtsheft als PDF: Deckblatt, Auswahl, einzelne Woche, lange Berichte; dieselben Rechte wie beim Lesen', async () => {
  const { writeFileSync } = await import('node:fs');
  const { inflateSync } = await import('node:zlib');
  const w = await welt();
  const lang = { ...INHALT, abwesenheit: [], betrieb: Array.from({ length: 30 }, (_, i) => ({ text: `Tätigkeit ${i + 1}: Arbeitsplatz „Büro ${i + 1}“ eingerichtet – Monitor, Dockingstation und Drucker angeschlossen, Übergabe an die Fachabteilung mit Einweisung`, stunden: 0.5 })) };
  for (const r of [await schreibe(w, w.azubi, '2026-10-19', lang), await schreibe(w, w.azubi, '2026-10-26', { ...INHALT, abwesenheit: [] }), await schreibe(w)]) assert.equal(r.status, 200, JSON.stringify(r.body));
  await reicheEin(w);
  assert.equal((await zeichneAb(w, w.ausbilder, [{ azubiId: w.azubi.id, montag: WOCHE }])).status, 200);
  // ein kleines Logo: 8×4 Pixel, PNG mit Durchsichtigkeit (blau, zur Hälfte durchsichtig) – hier selbst zusammengesetzt
  const { deflateSync } = await import('node:zlib');
  const stueck = (typ: string, daten: Buffer) => {
    const kopf = Buffer.alloc(8);
    kopf.writeUInt32BE(daten.length, 0);
    kopf.write(typ, 4, 'latin1');
    return Buffer.concat([kopf, daten, Buffer.alloc(4)]); // Prüfsumme: wird beim Lesen nicht verlangt
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(8, 0);
  ihdr.writeUInt32BE(4, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const zeilePng = Buffer.concat([Buffer.from([0]), Buffer.concat(Array.from({ length: 8 }, (_, x) => Buffer.from([29, 78, 216, x < 4 ? 255 : 0])))]);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), stueck('IHDR', ihdr), stueck('IDAT', deflateSync(Buffer.concat([zeilePng, zeilePng, zeilePng, zeilePng]))), stueck('IEND', Buffer.alloc(0))]).toString('base64');
  assert.equal((await ruf(w.u, 'PUT', '/api/branding/logo', { cookies: als(w, w.admin), body: { daten: `data:image/png;base64,${png}` } })).status, 200);

  const hole = (frage = '', wer = w.azubi, a = w.azubi) => ruf(w.u, 'GET', `/api/azubis/${a.id}/berichtsheft.pdf${frage}`, { cookies: als(w, wer) });
  /** Zahl der Seiten und der gesamte Text (aus den Seiteninhalten zurückgelesen) */
  const lies = (pdf: Buffer) => {
    const roh = pdf.toString('latin1');
    assert.ok(roh.startsWith('%PDF-1.4') && roh.trimEnd().endsWith('%%EOF'), 'beginnt und endet wie ein PDF');
    // die Tafel am Ende nennt für jedes Objekt die richtige Stelle
    const tafel = roh.slice(roh.lastIndexOf('xref'));
    const stellen = [...tafel.matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
    stellen.forEach((s, i) => assert.ok(roh.startsWith(`${i + 1} 0 obj`, s), `Objekt ${i + 1} steht an seiner Stelle`));
    assert.equal(Number(/startxref\n(\d+)/.exec(roh)![1]), roh.lastIndexOf('xref\n0 '));
    let text = '';
    for (const m of roh.matchAll(/\/Filter \/FlateDecode \/Length (\d+) >>\nstream\n/g)) {
      const start = m.index! + m[0].length;
      const inhalt = pdf.subarray(start, start + Number(m[1]));
      if (roh.slice(m.index! - 60, m.index!).includes('/Image') || roh.slice(roh.lastIndexOf('obj', m.index!), m.index!).includes('/Subtype /Image')) continue;
      const befehle = inflateSync(inhalt).toString('latin1');
      for (const t of befehle.matchAll(/<([0-9a-f]+)> Tj/g)) text += `${Buffer.from(t[1], 'hex').toString('latin1')}\n`;
    }
    return { seiten: (roh.match(/\/Type \/Page /g) ?? []).length, text, roh };
  };

  const alle = await hole();
  assert.equal(alle.status, 200);
  assert.deepEqual([alle.datei!.typ, alle.datei!.dateiname], ['application/pdf', 'Berichtsheft Anna Azubi 2026-10-19 bis 2026-11-08.pdf']);
  if (process.env.PDF_AUS) writeFileSync(`${process.env.PDF_AUS}/berichtsheft.pdf`, alle.datei!.inhalt);
  const a = lies(alle.datei!.inhalt);
  // Deckblatt + langer Bericht (2 Seiten) + 2 Berichte
  assert.equal(a.seiten, 5);
  for (const erwartet of ['Berichtsheft', 'Anna Azubi', 'Muster GmbH', '19.10.2026 bis 08.11.2026', '3 Wochenberichte: 1 abgezeichnet, 2 nicht abgezeichnet (als solche gekennzeichnet)', 'Woche 43/2026', 'Fortsetzung', 'Tätigkeit 30:', 'Switch konfiguriert', 'VLANs eingerichtet', '06.11.2026 · Urlaub'.replace('·', '\xb7'), 'Summe: 41,5 Stunden', 'Entwurf \x96 noch nicht eingereicht und nicht unterschrieben', 'Seite 5 von 5']) {
    // lange Angaben auf dem Deckblatt laufen über mehrere Zeilen
    assert.ok(a.text.includes(erwartet) || a.text.replace(/\n/g, ' ').includes(erwartet), `im PDF steht: ${erwartet}`);
  }
  assert.ok(a.text.includes('\x84B\xfcro 1\x93'), 'Umlaute und deutsche Anführungszeichen stimmen');
  assert.equal((a.roh.match(/\/Subtype \/Image/g) ?? []).length, 2, 'Logo mit Durchsichtigkeit: Bild und Maske');
  assert.ok(a.roh.includes('/ca 0.14'), 'das Logo steht blass hinter den Unterschriften');
  // beide Unterschriften des abgezeichneten Berichts sind als Strichzug gezeichnet (je 1 Ansatz, 5 Linien)
  const striche = [...a.roh.matchAll(/\/Filter \/FlateDecode \/Length (\d+) >>\nstream\n/g)].map((m) => { try { return inflateSync(alle.datei!.inhalt.subarray(m.index! + m[0].length, m.index! + m[0].length + Number(m[1]))).toString('latin1'); } catch { return ''; } }).join('\n').match(/1 J 1 j (?:[\d.]+ [\d.]+ [ml] ?)+S/g) ?? [];
  assert.deepEqual(striche.map((s) => (s.match(/ l/g) ?? []).length), [5, 5]);

  const nur = lies((await hole('?nur=abgezeichnet&deckblatt=0')).datei!.inhalt);
  assert.equal(nur.seiten, 1);
  assert.ok(!nur.text.includes('Entwurf') && !nur.text.includes('ENTWURF') && nur.text.includes('Woche 45/2026'));
  // nicht abgezeichnete Berichte tragen den Vermerk quer über jede ihrer Seiten: der lange Entwurf zweimal, der kurze einmal
  assert.equal((a.text.match(/^ENTWURF$/gm) ?? []).length, 3);
  const woche = await hole('?woche=2026-10-26');
  assert.equal(woche.datei!.dateiname, 'Ausbildungsnachweis Anna Azubi KW 44-2026.pdf');
  assert.equal(lies(woche.datei!.inhalt).seiten, 1, 'eine einzelne Woche hat kein Deckblatt');
  assert.equal(lies((await hole('?jahr=2')).datei!.inhalt).seiten, 5);

  assert.equal((await hole('?jahr=1')).status, 404);
  assert.equal((await hole('?woche=2026-09-07')).status, 404);
  for (const falsch of ['?woche=2026-10-27', '?woche=x', '?jahr=0', '?jahr=zwei']) assert.equal((await hole(falsch)).status, 400, falsch);
  // Rechte: die Ausbilderin ja; ein anderer Azubi, ein nicht zugewiesener Beauftragter und der Super-Admin nicht
  assert.equal((await hole('', w.ausbilder)).status, 200);
  assert.equal((await hole('', w.ben)).status, 404);
  assert.equal((await hole('', w.beauftragter)).status, 404);
  assert.equal((await hole('', w.admin)).status, 403);
  assert.equal((await ruf(w.u, 'GET', `/api/azubis/${w.azubi.id}/berichtsheft.pdf`)).status, 401);
  // ohne Logo und mit einem Logo, das das PDF nicht aufnehmen kann (WebP), entsteht das Dokument trotzdem
  w.u.db.prepare("UPDATE einstellungen SET wert = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==' WHERE schluessel = 'branding_logo'").run();
  const ohne = lies((await hole()).datei!.inhalt);
  assert.equal([ohne.seiten, (ohne.roh.match(/\/Subtype \/Image/g) ?? []).length].join(), '5,0');
});

test('Entwürfe gehören dem Azubi allein: Ausbilder und Beauftragte sehen sie nirgends – erst nach dem Einreichen', async () => {
  const w = await welt();
  zuweisen(w.u.db, w.azubi, w.beauftragter);
  assert.equal((await schreibe(w)).status, 200);
  const liste = async (wer: BenutzerZeile, frage = '') => koerper(await ruf(w.u, 'GET', `/api/azubis/${w.azubi.id}/berichte${frage}`, { cookies: als(w, wer) }));
  const wocheVon = async (wer: BenutzerZeile) => (await liste(wer)).wochen.find((x: { montag: string }) => x.montag === WOCHE);
  const karte = async () => koerper(await ruf(w.u, 'GET', '/api/azubis', { cookies: als(w, w.ausbilder) })).azubis.find((a: { id: number }) => a.id === w.azubi.id).berichte;
  const fehlendVorher = (await karte()).fehlend;

  // der Azubi selbst sieht seinen Entwurf
  assert.deepEqual([(await wocheVon(w.azubi)).status, (await wocheVon(w.azubi)).stunden], ['entwurf', 41.5]);
  assert.equal((await lies(w, w.azubi)).inhalt.betrieb[0].text, 'Switch konfiguriert\nVLANs eingerichtet');
  assert.equal((await liste(w.azubi, '?voll=1')).berichte.length, 1);

  for (const wer of [w.ausbilder, w.beauftragter]) {
    // in der Liste zählt die Woche als „fehlt“, ohne Stunden
    assert.deepEqual([(await wocheVon(wer)).status, (await wocheVon(wer)).stunden], ['fehlt', 0], wer.rolle);
    // die Einzelansicht zeigt nichts vom Entwurf
    const b = await lies(w, wer);
    assert.equal(b.status, 'fehlt', wer.rolle);
    assert.ok(!JSON.stringify(b).includes('Switch konfiguriert') && !JSON.stringify(b).includes('Brandschutz'), `${wer.rolle}: kein Inhalt des Entwurfs`);
    assert.deepEqual([b.signaturen, b.verlauf], [[], []]);
    // weder im Sammeldruck noch im PDF
    assert.deepEqual((await liste(wer, '?voll=1')).berichte, [], wer.rolle);
    assert.equal((await ruf(w.u, 'GET', `/api/azubis/${w.azubi.id}/berichtsheft.pdf`, { cookies: als(w, wer) })).status, 404, wer.rolle);
    assert.equal((await ruf(w.u, 'GET', `/api/azubis/${w.azubi.id}/berichtsheft.pdf?woche=${WOCHE}`, { cookies: als(w, wer) })).status, 404, wer.rolle);
  }
  // auf der Karte des Azubis zählt der Entwurf wie eine fehlende Woche
  assert.ok(fehlendVorher >= 1);

  // nach dem Einreichen sehen ihn alle; zieht der Azubi zurück, ist er wieder nur seiner
  assert.equal((await reicheEin(w)).status, 200);
  assert.equal((await karte()).fehlend, fehlendVorher - 1);
  for (const wer of [w.ausbilder, w.beauftragter]) {
    assert.equal((await wocheVon(wer)).status, 'eingereicht');
    assert.equal((await lies(w, wer)).inhalt.unterweisung[0].text, 'Brandschutz');
    assert.equal((await ruf(w.u, 'GET', `/api/azubis/${w.azubi.id}/berichtsheft.pdf`, { cookies: als(w, wer) })).status, 200);
  }
  assert.equal((await ruf(w.u, 'POST', pfad(w.azubi, WOCHE, 'zurueckziehen'), { cookies: als(w, w.azubi) })).status, 200);
  assert.equal((await wocheVon(w.ausbilder)).status, 'fehlt');
  assert.deepEqual((await lies(w, w.ausbilder)).verlauf, []);
  assert.ok((await lies(w, w.azubi)).verlauf.length > 0, 'der Azubi sieht den Verlauf weiter');
  // zurückgegeben: bleibt für die Ausbilderin sichtbar
  await reicheEin(w);
  assert.equal((await ruf(w.u, 'POST', pfad(w.azubi, WOCHE, 'zurueckgeben'), { cookies: als(w, w.ausbilder), body: { kommentar: 'Bitte genauer.' } })).status, 200);
  assert.equal((await wocheVon(w.ausbilder)).status, 'zurueck');
});

test('Tagesform: der Betrieb wählt sie; Einträge gehören zu einem Tag; gespeicherte Berichte behalten ihre Form', async () => {
  const { inflateSync } = await import('node:zlib');
  const w = await welt();
  const stamm = { name: 'Muster GmbH', bundesland: 'HH' };
  const betrieb = async () => koerper(await ruf(w.u, 'GET', '/api/stammdaten', { cookies: als(w, w.ausbilder) })).betrieb;
  // Vorgabe ist die Wochenform; nur Ausbilder stellen um; nur die zwei Formen sind erlaubt
  assert.equal((await betrieb()).berichtForm, 'woche');
  assert.equal((await lies(w, w.azubi)).inhalt.form, 'woche');
  assert.equal((await schreibe(w)).status, 200);
  assert.equal((await ruf(w.u, 'PUT', '/api/stammdaten/betrieb', { cookies: als(w, w.ausbilder), body: { ...stamm, berichtForm: 'monat' } })).status, 400);
  assert.equal((await ruf(w.u, 'PUT', '/api/stammdaten/betrieb', { cookies: als(w, w.azubi), body: { ...stamm, berichtForm: 'tag' } })).status, 403);
  assert.equal((await ruf(w.u, 'PUT', '/api/stammdaten/betrieb', { cookies: als(w, w.ausbilder), body: { ...stamm, berichtForm: 'tag' } })).status, 200);
  assert.equal((await betrieb()).berichtForm, 'tag');
  // fehlt die Angabe beim Speichern, bleibt die Form
  await ruf(w.u, 'PUT', '/api/stammdaten/betrieb', { cookies: als(w, w.ausbilder), body: stamm });
  assert.equal((await betrieb()).berichtForm, 'tag');

  // der schon gespeicherte Bericht bleibt ein Wochenbericht – auch beim erneuten Speichern, und ohne Tage
  const alt = koerper(await schreibe(w));
  assert.equal(alt.inhalt.form, 'woche');
  assert.ok(alt.inhalt.betrieb.every((e: { tag?: string }) => e.tag === undefined));

  // eine neue Woche beginnt in der Tagesform
  const NEU = '2026-10-26';
  assert.equal((await lies(w, w.azubi, w.azubi, NEU)).inhalt.form, 'tag');
  const tage = {
    form: 'woche', // was die Anfrage behauptet, zählt nicht
    betrieb: [
      { text: 'Mittwoch: Drucker eingerichtet', stunden: 8, tag: '2026-10-28' },
      { text: 'Montag: Server gepatcht', stunden: '6,5', tag: '2026-10-26' },
      { text: 'Montag: Kabel verlegt', stunden: 1.5, tag: '2026-10-26' },
      { text: '', stunden: 0, tag: '2026-10-27' },
    ],
    unterweisung: [{ text: 'Brandschutz', stunden: 2, tag: '2026-10-27' }],
    schule: [{ text: 'Mathe: Prozentrechnung', stunden: 6, tag: '2026-10-29' }],
    abwesenheit: [{ tag: '2026-10-30', grund: 'krank', stunden: 8, text: '' }],
  };
  const neu = koerper(await schreibe(w, w.azubi, NEU, tage));
  assert.equal(neu.inhalt.form, 'tag');
  // nach Tagen geordnet, Reihenfolge am selben Tag bleibt; leere Zeilen fallen weg
  assert.deepEqual(neu.inhalt.betrieb, [
    { text: 'Montag: Server gepatcht', stunden: 6.5, tag: '2026-10-26' },
    { text: 'Montag: Kabel verlegt', stunden: 1.5, tag: '2026-10-26' },
    { text: 'Mittwoch: Drucker eingerichtet', stunden: 8, tag: '2026-10-28' },
  ]);
  assert.deepEqual([neu.summe.betrieb, neu.summe.unterweisung, neu.summe.schule, neu.summe.abwesenheit, neu.summe.gesamt], [16, 2, 6, 8, 32]);
  // ohne Tag oder mit einem Tag außerhalb der Woche geht es nicht
  for (const falsch of [{ text: 'ohne Tag', stunden: 1 }, { text: 'andere Woche', stunden: 1, tag: '2026-11-02' }, { text: 'kein Datum', stunden: 1, tag: 'Montag' }]) {
    const r = await schreibe(w, w.azubi, NEU, { ...tage, betrieb: [falsch] });
    assert.equal(r.status, 400, falsch.text);
    assert.match(koerper(r).fehler, /Der Tag muss in der Berichtswoche liegen/);
  }
  // Samstag ist erlaubt
  assert.equal((await schreibe(w, w.azubi, NEU, { ...tage, betrieb: [{ text: 'Messe', stunden: 4, tag: '2026-10-31' }] })).status, 200);
  assert.equal((await schreibe(w, w.azubi, NEU, tage)).status, 200);

  // Einreichen und Abzeichnen wie gehabt; die Betreuerin sieht dieselbe Form
  assert.equal((await reicheEin(w, w.azubi, NEU)).status, 200);
  assert.equal((await lies(w, w.ausbilder, w.azubi, NEU)).inhalt.form, 'tag');
  assert.equal((await zeichneAb(w, w.ausbilder, [{ azubiId: w.azubi.id, montag: NEU }])).status, 200);

  // im PDF steht der Bericht nach Tagen, mit Art und Tagessumme; der Wochenbericht daneben bleibt in drei Teilen
  const pdf = (await ruf(w.u, 'GET', `/api/azubis/${w.azubi.id}/berichtsheft.pdf?woche=${NEU}`, { cookies: als(w, w.azubi) })).datei!.inhalt;
  const roh = pdf.toString('latin1');
  let text = '';
  for (const m of roh.matchAll(/\/Filter \/FlateDecode \/Length (\d+) >>\nstream\n/g)) {
    const start = m.index! + m[0].length;
    try {
      const befehle = inflateSync(pdf.subarray(start, start + Number(m[1]))).toString('latin1');
      for (const t of befehle.matchAll(/<([0-9a-f]+)> Tj/g)) text += `${Buffer.from(t[1], 'hex').toString('latin1')}\n`;
    } catch {
      // Bilder und Schriften sind anders verpackt
    }
  }
  for (const teil of ['Montag, 26.10.2026', '8 h', 'Betrieb: Montag: Server gepatcht', 'Dienstag, 27.10.2026', 'Unterweisung: Brandschutz', 'Berufsschule: Mathe: Prozentrechnung', 'Freitag, 30.10.2026', 'Abwesenheit: Krank']) assert.ok(text.includes(teil), `PDF: ${teil}\n${text}`);
  assert.ok(!text.includes('Samstag') && !text.includes('Betriebliche Tätigkeiten'.normalize()), 'kein leerer Samstag, keine Teile der Wochenform');
  assert.ok(text.indexOf('Montag, 26.10.2026') < text.indexOf('Dienstag, 27.10.2026') && text.indexOf('Dienstag, 27.10.2026') < text.indexOf('Mittwoch, 28.10.2026'));

  // stellt der Betrieb zurück, bleibt der Tagesbericht ein Tagesbericht
  await ruf(w.u, 'PUT', '/api/stammdaten/betrieb', { cookies: als(w, w.ausbilder), body: { ...stamm, berichtForm: 'woche' } });
  assert.equal((await lies(w, w.azubi, w.azubi, NEU)).inhalt.form, 'tag');
  assert.equal((await lies(w, w.azubi, w.azubi, '2026-10-19')).inhalt.form, 'woche');

  // je Azubi: die Einstellung im Profil geht der des Betriebs vor; leer heißt wieder „wie im Betrieb“
  const profilPfad = `/api/azubis/${w.azubi.id}/profil`;
  const profil = async (wer = w.ausbilder) => koerper(await ruf(w.u, 'GET', profilPfad, { cookies: als(w, wer) }));
  const alt2 = (await profil()).profil;
  assert.deepEqual([alt2.berichtForm, (await profil()).berichtFormGilt], [null, 'woche']);
  assert.equal((await ruf(w.u, 'PUT', profilPfad, { cookies: als(w, w.ausbilder), body: { ...alt2, berichtForm: 'monat' } })).status, 400);
  assert.equal((await ruf(w.u, 'PUT', profilPfad, { cookies: als(w, w.azubi), body: { ...alt2, berichtForm: 'tag' } })).status, 403);
  assert.equal((await ruf(w.u, 'PUT', profilPfad, { cookies: als(w, w.ausbilder), body: { ...alt2, berichtForm: 'tag' } })).status, 200);
  // der Azubi sieht, was für ihn gilt
  assert.deepEqual([(await profil(w.azubi)).profil.berichtForm, (await profil(w.azubi)).berichtFormGilt], ['tag', 'tag']);
  assert.equal((await lies(w, w.azubi, w.azubi, '2026-10-19')).inhalt.form, 'tag', 'Betrieb: Woche, Azubi: Tag → neue Berichte je Tag');
  // ein anderer Azubi bleibt bei der Form des Betriebs
  assert.equal((await lies(w, w.ben, w.ben, '2026-10-19')).inhalt.form, 'woche');
  // fehlt die Angabe beim Speichern des Profils, bleibt sie
  const { berichtForm: _weg, ...ohneForm } = (await profil()).profil;
  assert.equal((await ruf(w.u, 'PUT', profilPfad, { cookies: als(w, w.ausbilder), body: ohneForm })).status, 200);
  assert.equal((await profil()).profil.berichtForm, 'tag');
  // umgekehrt: Betrieb je Tag, dieser Azubi die Woche im Ganzen
  await ruf(w.u, 'PUT', '/api/stammdaten/betrieb', { cookies: als(w, w.ausbilder), body: { ...stamm, berichtForm: 'tag' } });
  await ruf(w.u, 'PUT', profilPfad, { cookies: als(w, w.ausbilder), body: { ...alt2, berichtForm: 'woche' } });
  assert.equal((await lies(w, w.azubi, w.azubi, '2026-10-19')).inhalt.form, 'woche');
  assert.equal((await lies(w, w.ben, w.ben, '2026-10-19')).inhalt.form, 'tag');
  await ruf(w.u, 'PUT', profilPfad, { cookies: als(w, w.ausbilder), body: { ...alt2, berichtForm: null } });
  assert.deepEqual([(await profil()).profil.berichtForm, (await profil()).berichtFormGilt], [null, 'tag']);
});
