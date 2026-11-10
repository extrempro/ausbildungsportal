import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BenutzerZeile } from '../typen';
import { admin, koerper, konto, ohneWechsel, ruf, sitzung, umgebung, zuweisen } from './hilfe';
import type { Umgebung } from './hilfe';

// „heute“ ist in der Testumgebung Dienstag, der 10.11.2026.
const PFAD = 'M10 10 L20 20 L30 10 L40 20 L50 10 L60 20';
const INHALT = { betrieb: [{ text: 'Switch konfiguriert', stunden: 40 }], schule: [], unterweisung: [], abwesenheit: [] };

interface Welt {
  u: Umgebung;
  admin: BenutzerZeile;
  ausbilder: BenutzerZeile;
  beauftragter: BenutzerZeile;
  azubi: BenutzerZeile;
  ben: BenutzerZeile;
}

async function welt(): Promise<Welt> {
  const u = await umgebung();
  ohneWechsel(u.db, admin(u.db).id);
  const w: Welt = { u, admin: admin(u.db), ausbilder: konto(u.db, 'ausbilder', 'Petra Lang'), beauftragter: konto(u.db, 'beauftragter', 'Bernd Beauftragt'), azubi: konto(u.db, 'azubi', 'Anna Azubi'), ben: konto(u.db, 'azubi', 'Ben Azubi') };
  const cookies = sitzung(u, w.ausbilder);
  await ruf(u, 'PUT', '/api/stammdaten/betrieb', { cookies, body: { name: 'Muster GmbH', bundesland: 'HH' } });
  for (const a of [w.azubi, w.ben]) await ruf(u, 'PUT', `/api/azubis/${a.id}/profil`, { cookies, body: { ausbildungsbeginn: '2025-08-01', ausbilderId: w.ausbilder.id } });
  for (const wer of [w.ausbilder, w.beauftragter, w.azubi, w.ben]) await ruf(u, 'PUT', '/api/ich/unterschrift', { cookies: sitzung(u, wer), body: { pfad: PFAD } });
  return w;
}

const als = (w: Welt, wer: BenutzerZeile) => sitzung(w.u, wer);
const glocke = async (w: Welt, wer: BenutzerZeile) => koerper(await ruf(w.u, 'GET', '/api/aktivitaeten', { cookies: als(w, wer) }));
const lege = (w: Welt, wer: BenutzerZeile, titel: string, a: BenutzerZeile = w.azubi, art = 'aufgabe') =>
  ruf(w.u, 'POST', `/api/azubis/${a.id}/plan`, { cookies: als(w, wer), body: { art, von: '2026-11-16', bis: '2026-11-16', titel } });
async function reicheEin(w: Welt, a: BenutzerZeile, montag: string) {
  assert.equal((await ruf(w.u, 'PUT', `/api/azubis/${a.id}/berichte/${montag}`, { cookies: als(w, a), body: { inhalt: INHALT } })).status, 200);
  assert.equal((await ruf(w.u, 'POST', `/api/azubis/${a.id}/berichte/${montag}/einreichen`, { cookies: als(w, a) })).status, 200);
}

test('Glocke: neue Plan-Einträge sieht der Azubi, nicht die Person, die sie angelegt hat; mehrere werden zusammengefasst', async () => {
  const w = await welt();
  for (const t of ['Ticket-System', 'Netzwerk', 'Server', 'Backup']) assert.equal((await lege(w, w.ausbilder, t)).status, 201);
  const a = await glocke(w, w.azubi);
  assert.equal(a.neu, 4);
  assert.equal(a.gruppen.length, 1, 'gleiche Person, gleicher Tag, gleiche Art → eine Zeile');
  const g = a.gruppen[0];
  assert.deepEqual([g.art, g.anzahl, g.akteurName, g.azubiId, g.neu], ['plan_neu', 4, 'Petra Lang', w.azubi.id, true]);
  assert.deepEqual(g.titel, ['Backup', 'Server', 'Netzwerk'], 'höchstens drei Titel, die jüngsten zuerst');
  assert.deepEqual(g.wochen, ['2026-11-16']);
  assert.equal((await glocke(w, w.ausbilder)).neu, 0, 'eigene Handlungen stehen nicht in der Glocke');
  assert.equal((await glocke(w, w.ben)).neu, 0, 'ein anderer Azubi sieht nichts davon');
  assert.equal((await glocke(w, w.beauftragter)).neu, 0, 'ohne Zuweisung sieht der Beauftragte nichts');
  assert.equal((await ruf(w.u, 'GET', '/api/aktivitaeten', { cookies: als(w, w.admin) })).status, 403, 'der Super-Admin sieht keine Azubi-Daten');
  assert.equal((await ruf(w.u, 'GET', '/api/aktivitaeten')).status, 401);
});

test('Glocke: Einträge des Azubis sehen Ausbilder und zugewiesene Beauftragte; ein neuer Tag beginnt eine neue Zeile', async () => {
  const w = await welt();
  zuweisen(w.u.db, w.azubi, w.beauftragter);
  await lege(w, w.azubi, 'Frage zur Prüfung', w.azubi, 'notiz');
  w.u.uhr.jetzt = new Date('2026-11-11T09:00:00Z');
  await lege(w, w.azubi, 'Lernzettel schreiben');
  const g = (await glocke(w, w.ausbilder)).gruppen;
  assert.deepEqual(g.map((x: any) => [x.titel, x.anzahl]), [[['Lernzettel schreiben'], 1], [['Frage zur Prüfung'], 1]]);
  assert.equal((await glocke(w, w.beauftragter)).neu, 2);
  assert.equal((await glocke(w, w.azubi)).neu, 0);
});

test('Glocke: gesehen merkt sich den Stand; was danach kommt, ist wieder neu', async () => {
  const w = await welt();
  await lege(w, w.ausbilder, 'Eins');
  const a = await glocke(w, w.azubi);
  const cookies = als(w, w.azubi);
  for (const falsch of [undefined, 'x', -1, 1.5]) assert.equal((await ruf(w.u, 'POST', '/api/aktivitaeten/gesehen', { cookies, body: { bis: falsch } })).status, 400);
  const b = koerper(await ruf(w.u, 'POST', '/api/aktivitaeten/gesehen', { cookies, body: { bis: a.bis } }));
  assert.deepEqual([b.neu, b.gruppen[0].neu], [0, false]);
  await ruf(w.u, 'POST', '/api/aktivitaeten/gesehen', { cookies, body: { bis: 999_999 } });
  await lege(w, w.ausbilder, 'Zwei');
  const c = await glocke(w, w.azubi);
  assert.equal(c.neu, 1, 'ein zu hoher Wert blendet spätere Aktivitäten nicht aus');
  assert.deepEqual(c.gruppen.map((x: any) => [x.titel[0], x.neu]), [['Zwei', true], ['Eins', false]], 'Neues und Gesehenes bleiben getrennt');
});

test('Glocke: Berichte – Einreichen geht an die Betreuenden, Abzeichnen und Zurückgeben an den Azubi', async () => {
  const w = await welt();
  for (const m of ['2026-10-19', '2026-10-26', '2026-11-02']) await reicheEin(w, w.azubi, m);
  await reicheEin(w, w.ben, '2026-11-02');
  const a = await glocke(w, w.ausbilder);
  assert.equal(a.neu, 4);
  assert.deepEqual(
    a.gruppen.map((g: any) => [g.art, g.azubiName, g.anzahl, g.wochen]),
    [
      ['bericht_eingereicht', 'Ben Azubi', 1, ['2026-11-02']],
      ['bericht_eingereicht', 'Anna Azubi', 3, ['2026-10-19', '2026-10-26', '2026-11-02']],
    ],
  );
  const cookies = als(w, w.ausbilder);
  assert.equal((await ruf(w.u, 'POST', '/api/berichte/abzeichnen', { cookies, body: { berichte: [{ azubiId: w.azubi.id, montag: '2026-10-19' }, { azubiId: w.azubi.id, montag: '2026-10-26' }] } })).status, 200);
  assert.equal((await ruf(w.u, 'POST', `/api/azubis/${w.azubi.id}/berichte/2026-11-02/zurueckgeben`, { cookies, body: { kommentar: 'Bitte genauer beschreiben' } })).status, 200);
  const z = await glocke(w, w.azubi);
  assert.equal(z.neu, 3);
  assert.deepEqual(z.gruppen.map((g: any) => [g.art, g.anzahl, g.wochen]), [['bericht_zurueck', 1, ['2026-11-02']], ['bericht_abgezeichnet', 2, ['2026-10-19', '2026-10-26']]]);
  assert.ok(!JSON.stringify(z).includes('genauer beschreiben'), 'Kommentare und Berichtsinhalte stehen nicht in der Glocke');
  assert.equal((await glocke(w, w.ben)).neu, 0);
});

test('Glocke: eine übernommene Planvorlage zählt mit allen Einträgen; alte Aktivitäten werden nach 60 Tagen gelöscht', async () => {
  const w = await welt();
  const cookies = als(w, w.ausbilder);
  const v = await ruf(w.u, 'POST', '/api/planvorlagen', { cookies, body: { titel: 'Erstes Jahr', eintraege: [{ art: 'einsatz', abWoche: 1, wochen: 4, titel: 'Empfang' }, { art: 'einsatz', abWoche: 5, wochen: 4, titel: 'Lager' }] } });
  assert.equal(v.status, 201);
  assert.equal((await ruf(w.u, 'POST', `/api/azubis/${w.azubi.id}/plan/vorlage`, { cookies, body: { vorlageId: koerper(v).vorlage.id } })).status, 200);
  const a = await glocke(w, w.azubi);
  assert.deepEqual([a.neu, a.gruppen[0].anzahl, a.gruppen[0].titel], [2, 2, ['Vorlage „Erstes Jahr“']]);
  w.u.uhr.jetzt = new Date('2027-01-20T09:00:00Z');
  await lege(w, w.ausbilder, 'Neu im Januar');
  const b = await glocke(w, w.azubi);
  assert.deepEqual(b.gruppen.map((g: any) => g.titel[0]), ['Neu im Januar']);
});
