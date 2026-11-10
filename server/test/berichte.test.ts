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
  const aktionen = protokoll.map((e) => e.aktion);
  for (const a of ['bericht_eingereicht', 'bericht_abgezeichnet', 'bericht_geoeffnet']) assert.ok(aktionen.includes(a), a);
  assert.deepEqual([protokoll.find((e) => e.aktion === 'bericht_geoeffnet')?.detail, protokoll.find((e) => e.aktion === 'bericht_geoeffnet')?.ziel_name], ['KW 45/2026', 'Anna Azubi']);
  assert.ok(!JSON.stringify(protokoll).includes('Switch konfiguriert'), 'keine Berichtsinhalte im Protokoll');
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
