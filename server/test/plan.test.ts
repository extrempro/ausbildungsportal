import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseChangelog } from '../changelog';
import type { BenutzerZeile } from '../typen';
import { admin, koerper, konto, ohneWechsel, ruf, sitzung, umgebung, zuweisen } from './hilfe';
import type { Umgebung } from './hilfe';

// „heute“ ist in der Testumgebung Dienstag, der 10.11.2026.
interface Welt {
  u: Umgebung;
  admin: BenutzerZeile;
  ausbilder: BenutzerZeile;
  beauftragter: BenutzerZeile;
  azubi: BenutzerZeile;
  ben: BenutzerZeile;
}

/** Zwei Azubis mit Ausbildungsbeginn 01.08.2025 (ein Samstag – die erste Woche beginnt am 28.07.2025), Betrieb in Hamburg. */
async function welt(): Promise<Welt> {
  const u = await umgebung();
  ohneWechsel(u.db, admin(u.db).id);
  const w: Welt = { u, admin: admin(u.db), ausbilder: konto(u.db, 'ausbilder', 'Petra Lang'), beauftragter: konto(u.db, 'beauftragter', 'Bernd Beauftragt'), azubi: konto(u.db, 'azubi', 'Anna Azubi'), ben: konto(u.db, 'azubi', 'Ben Azubi') };
  const cookies = sitzung(u, w.ausbilder);
  await ruf(u, 'PUT', '/api/stammdaten/betrieb', { cookies, body: { name: 'Muster GmbH', bundesland: 'HH' } });
  for (const a of [w.azubi, w.ben]) await ruf(u, 'PUT', `/api/azubis/${a.id}/profil`, { cookies, body: { ausbildungsbeginn: '2025-08-01', ausbilderId: w.ausbilder.id } });
  return w;
}

const als = (w: Welt, wer: BenutzerZeile) => sitzung(w.u, wer);
const plan = async (w: Welt, wer: BenutzerZeile, a: BenutzerZeile = w.azubi) => koerper(await ruf(w.u, 'GET', `/api/azubis/${a.id}/plan`, { cookies: als(w, wer) }));
const lege = (w: Welt, wer: BenutzerZeile, body: unknown, a: BenutzerZeile = w.azubi) => ruf(w.u, 'POST', `/api/azubis/${a.id}/plan`, { cookies: als(w, wer), body });
const EINSATZ = { art: 'einsatz', von: '2026-11-11', bis: '2026-12-02', titel: 'IT-Support' };

test('Plan lesen: Wochen der Ausbildung mit Ausbildungsjahr, Feiertage und Ferien', async () => {
  const w = await welt();
  const p = await plan(w, w.azubi);
  assert.equal(p.eigenes, true);
  assert.equal(p.beginnFehlt, false);
  assert.equal(p.beginn, '2025-08-01');
  assert.equal(p.ende, '2028-07-31');
  assert.equal(p.wochen[0].montag, '2025-07-28');
  assert.equal(p.wochen[0].ausbildungsjahr, 1);
  assert.equal(p.wochen.find((x: any) => x.montag === '2026-11-09').ausbildungsjahr, 2);
  assert.equal(p.wochen.at(-1).montag, '2028-07-31', 'letzte Woche enthält das Ende am 31.07.2028');
  assert.ok(p.feiertage.some((f: any) => f.datum === '2026-10-31'), 'Reformationstag in Hamburg');
  assert.ok(p.ferienVorhanden && p.ferien.length > 0, 'Hamburger Ferien');
  assert.deepEqual(p.rechte, { arten: ['aufgabe', 'notiz', 'termin'], zuweisen: false });
  assert.deepEqual(p.personen, []);
  assert.deepEqual(p.pruefungen, []);
  assert.deepEqual(p.vorlagen, []);
});

test('Ausbilder plant alles; Daten rasten auf Montage ein; zuständig können Ausbilder und Beauftragte sein', async () => {
  const w = await welt();
  const a = await lege(w, w.ausbilder, { ...EINSATZ, zustaendigId: w.ausbilder.id, text: 'Erste Station\nmit Tickets' });
  assert.equal(a.status, 201);
  const e = koerper(a).eintrag;
  assert.equal(e.von, '2026-11-09');
  assert.equal(e.bis, '2026-11-30');
  assert.equal(e.zustaendig, 'Petra Lang', 'auch ein Ausbilder kann zuständig sein');
  assert.equal(koerper(a).zugewiesen, false);
  assert.equal((await lege(w, w.ausbilder, { ...EINSATZ, zustaendigId: w.beauftragter.id })).status, 201);
  assert.equal((await lege(w, w.ausbilder, { art: 'schule', von: '2026-11-16', titel: 'Blockunterricht' })).status, 201);
  assert.equal(koerper(await lege(w, w.ausbilder, { art: 'notiz', von: '2026-11-16', titel: 'Hinweis', zustaendigId: w.ausbilder.id })).eintrag.zustaendigId, null, 'Notizen haben keinen Zuständigen');

  for (const falsch of [
    { ...EINSATZ, art: 'thema' },
    { ...EINSATZ, titel: '' },
    { ...EINSATZ, von: '2026-13-01' },
    { ...EINSATZ, bis: '2026-11-01' },
    { ...EINSATZ, bis: '2031-01-01' },
    { ...EINSATZ, zustaendigId: w.azubi.id },
    { ...EINSATZ, zustaendigId: w.admin.id },
    { art: 'aufgabe', von: '2026-11-09', titel: 'x', unteraufgaben: Array(31).fill('a') },
  ]) {
    assert.equal((await lege(w, w.ausbilder, falsch)).status, 400, JSON.stringify(falsch).slice(0, 80));
  }

  const p = await plan(w, w.ausbilder);
  assert.equal(p.eintraege.length, 4);
  assert.deepEqual(p.rechte.arten, ['schule', 'einsatz', 'aufgabe', 'notiz']);
  assert.deepEqual(p.personen.map((x: any) => x.anzeigename), ['Bernd Beauftragt', 'Petra Lang']);

  const geaendert = await ruf(w.u, 'PUT', `/api/azubis/${w.azubi.id}/plan/${e.id}`, { cookies: als(w, w.ausbilder), body: { ...EINSATZ, titel: 'Netzwerk', bis: '2026-11-11' } });
  assert.equal(koerper(geaendert).eintrag.titel, 'Netzwerk');
  assert.equal(koerper(geaendert).eintrag.bis, '2026-11-09');
  assert.equal((await ruf(w.u, 'PUT', `/api/azubis/${w.ben.id}/plan/${e.id}`, { cookies: als(w, w.ausbilder), body: EINSATZ })).status, 404, 'Eintrag gehört einem anderen Azubi');
  assert.equal((await ruf(w.u, 'DELETE', `/api/azubis/${w.azubi.id}/plan/${e.id}`, { cookies: als(w, w.ausbilder) })).status, 200);
  assert.equal((await ruf(w.u, 'DELETE', `/api/azubis/${w.azubi.id}/plan/${e.id}`, { cookies: als(w, w.ausbilder) })).status, 404);
});

test('Einsatz mit Beauftragtem: Zuweisung für den Zeitraum wird auf Wunsch angelegt, aber nicht doppelt', async () => {
  const w = await welt();
  const a = await lege(w, w.ausbilder, { ...EINSATZ, zustaendigId: w.beauftragter.id, zuweisen: true });
  assert.equal(koerper(a).zugewiesen, true);
  const z = w.u.db.prepare('SELECT von, bis FROM zuweisung WHERE azubi_id = ?').all(w.azubi.id) as unknown[];
  assert.deepEqual(z.map((x) => ({ ...(x as object) })), [{ von: '2026-11-09', bis: '2026-12-06' }]);
  assert.equal(koerper(await lege(w, w.ausbilder, { ...EINSATZ, zustaendigId: w.beauftragter.id, zuweisen: true })).zugewiesen, false, 'Zeitraum ist schon abgedeckt');
  assert.equal(koerper(await lege(w, w.ausbilder, { ...EINSATZ, zustaendigId: w.ausbilder.id, zuweisen: true })).zugewiesen, false, 'Ausbilder brauchen keine Zuweisung');
  assert.equal((w.u.db.prepare('SELECT COUNT(*) AS n FROM zuweisung').get() as { n: number }).n, 1);
  // der Beauftragte sieht den Azubi jetzt
  assert.equal((await ruf(w.u, 'GET', `/api/azubis/${w.azubi.id}/plan`, { cookies: als(w, w.beauftragter) })).status, 200);
});

test('Beauftragte: nur zugewiesene Azubis, nur Aufgaben und Notizen, nur solange die Zuweisung läuft', async () => {
  const w = await welt();
  assert.equal((await ruf(w.u, 'GET', `/api/azubis/${w.azubi.id}/plan`, { cookies: als(w, w.beauftragter) })).status, 404, 'nicht zugewiesen');
  assert.equal((await lege(w, w.beauftragter, { art: 'aufgabe', von: '2026-11-09', titel: 'x' })).status, 404);
  zuweisen(w.u.db, w.azubi, w.beauftragter, '2026-10-01', '2026-12-31');
  const einsatz = koerper(await lege(w, w.ausbilder, EINSATZ)).eintrag;

  const p = await plan(w, w.beauftragter);
  assert.deepEqual(p.rechte, { arten: ['aufgabe', 'notiz'], zuweisen: false });
  assert.deepEqual(p.vorlagen, []);
  const a = await lege(w, w.beauftragter, { art: 'aufgabe', von: '2026-11-09', titel: 'Drucker einrichten', unteraufgaben: ['Treiber', { text: 'Testseite', erledigt: true }, ''] });
  assert.equal(a.status, 201);
  assert.deepEqual(koerper(a).eintrag.unteraufgaben, [{ text: 'Treiber', erledigt: false }, { text: 'Testseite', erledigt: true }]);
  assert.deepEqual([koerper(a).eintrag.bearbeitbar, koerper(a).eintrag.vomAzubi], [true, false]);
  assert.equal((await lege(w, w.beauftragter, EINSATZ)).status, 403, 'Einsätze plant der Ausbilder');
  assert.equal((await lege(w, w.beauftragter, { art: 'schule', von: '2026-11-09', titel: 'x' })).status, 403);
  assert.equal(koerper(await lege(w, w.beauftragter, { art: 'aufgabe', von: '2026-11-09', titel: 'x', zuweisen: true })).zugewiesen, false);

  const pfad = (id: number) => `/api/azubis/${w.azubi.id}/plan/${id}`;
  const cookies = als(w, w.beauftragter);
  assert.equal((await ruf(w.u, 'PUT', pfad(einsatz.id), { cookies, body: { ...EINSATZ, titel: 'gekapert' } })).status, 403);
  assert.equal((await ruf(w.u, 'PUT', pfad(einsatz.id), { cookies, body: { art: 'aufgabe', von: '2026-11-09', titel: 'gekapert' } })).status, 403, 'Art wechseln hilft nicht');
  assert.equal((await ruf(w.u, 'DELETE', pfad(einsatz.id), { cookies })).status, 403);
  const eigene = koerper(a).eintrag.id;
  assert.equal((await ruf(w.u, 'PUT', pfad(eigene), { cookies, body: { ...EINSATZ } })).status, 403, 'Aufgabe lässt sich nicht zum Einsatz machen');
  assert.equal((await ruf(w.u, 'PUT', pfad(eigene), { cookies, body: { art: 'notiz', von: '2026-11-09', titel: 'Notiz' } })).status, 200);

  // nach dem Ende der Zuweisung: lesen ja, ändern nein
  w.u.uhr.jetzt = new Date('2027-01-15T09:00:00Z');
  assert.equal((await ruf(w.u, 'GET', `/api/azubis/${w.azubi.id}/plan`, { cookies: als(w, w.beauftragter) })).status, 200);
  assert.deepEqual((await plan(w, w.beauftragter)).rechte.arten, []);
  assert.equal((await lege(w, w.beauftragter, { art: 'aufgabe', von: '2027-01-11', titel: 'x' })).status, 403);
  assert.equal((await ruf(w.u, 'DELETE', pfad(eigene), { cookies: als(w, w.beauftragter) })).status, 403);
});

test('Azubi: eigene Aufgaben und Notizen anlegen und ändern; Geplantes von Ausbilder und Beauftragten nur abhaken', async () => {
  const w = await welt();
  const aufgabe = koerper(await lege(w, w.ausbilder, { art: 'aufgabe', von: '2026-11-09', titel: 'Server aufsetzen', unteraufgaben: ['Installieren', 'Härten'] })).eintrag;
  const einsatz = koerper(await lege(w, w.ausbilder, EINSATZ)).eintrag;
  const cookies = als(w, w.azubi);
  const pfad = (id: number, a = w.azubi) => `/api/azubis/${a.id}/plan/${id}`;
  assert.equal((await ruf(w.u, 'GET', `/api/azubis/${w.ben.id}/plan`, { cookies })).status, 404);

  // anlegen: nur Aufgabe und Notiz, nur im eigenen Plan, ohne Zuständigen
  const eigene = await lege(w, w.azubi, { art: 'aufgabe', von: '2026-11-09', titel: 'Lernzettel Subnetting', unteraufgaben: ['Kapitel 1'], zustaendigId: w.ausbilder.id, zuweisen: true });
  assert.equal(eigene.status, 201);
  const e = koerper(eigene).eintrag;
  assert.deepEqual([e.zustaendigId, e.vomAzubi, e.bearbeitbar, koerper(eigene).zugewiesen], [null, true, true, false]);
  assert.equal((await lege(w, w.azubi, { art: 'notiz', von: '2026-11-09', titel: 'Berufsschule: Buch mitbringen' })).status, 201);
  assert.equal((await lege(w, w.azubi, EINSATZ)).status, 403);
  assert.equal((await lege(w, w.azubi, { art: 'schule', von: '2026-11-09', titel: 'x' })).status, 403);
  assert.equal((await lege(w, w.azubi, { art: 'notiz', von: '2026-11-09', titel: 'x' }, w.ben)).status, 404, 'fremder Plan');

  // ändern und löschen: nur Selbstangelegtes
  assert.equal(koerper(await ruf(w.u, 'PUT', pfad(e.id), { cookies, body: { art: 'notiz', von: '2026-11-16', titel: 'umbenannt' } })).eintrag.titel, 'umbenannt');
  assert.equal((await ruf(w.u, 'PUT', pfad(e.id), { cookies, body: { ...EINSATZ } })).status, 403, 'eigene Notiz wird kein Einsatz');
  assert.equal((await ruf(w.u, 'PUT', pfad(aufgabe.id), { cookies, body: { art: 'aufgabe', von: '2026-11-09', titel: 'leichter' } })).status, 403, 'Aufgabe des Ausbilders');
  assert.equal((await ruf(w.u, 'DELETE', pfad(aufgabe.id), { cookies })).status, 403);
  assert.equal((await ruf(w.u, 'DELETE', pfad(einsatz.id), { cookies })).status, 403);
  assert.equal((await ruf(w.u, 'DELETE', pfad(e.id, w.ben), { cookies: als(w, w.ben) })).status, 404, 'Ben kommt nicht an Annas Eintrag');
  const p = await plan(w, w.azubi);
  assert.deepEqual(p.eintraege.map((x: any) => [x.titel, x.bearbeitbar, x.vomAzubi]).sort(), [
    ['Berufsschule: Buch mitbringen', true, true],
    ['IT-Support', false, false],
    ['Server aufsetzen', false, false],
    ['umbenannt', true, true],
  ]);
  // der Ausbilder darf auch die Einträge des Azubis ändern
  assert.ok((await plan(w, w.ausbilder)).eintraege.every((x: any) => x.bearbeitbar));
  assert.equal((await ruf(w.u, 'DELETE', pfad(e.id), { cookies })).status, 200);

  const haken = (id: number, body: unknown, wer = w.azubi, a = w.azubi) => ruf(w.u, 'POST', `/api/azubis/${a.id}/plan/${id}/haken`, { cookies: als(w, wer), body });
  let r = koerper(await haken(aufgabe.id, { unteraufgabe: 1, erledigt: true })).eintrag;
  assert.deepEqual(r.unteraufgaben.map((x: any) => x.erledigt), [false, true]);
  assert.equal(r.erledigt, false);
  r = koerper(await haken(aufgabe.id, { erledigt: true })).eintrag;
  assert.equal(r.erledigt, true);
  assert.equal(r.titel, 'Server aufsetzen');
  assert.equal((await haken(aufgabe.id, { unteraufgabe: 5, erledigt: true })).status, 400);
  assert.equal((await haken(einsatz.id, { erledigt: true })).status, 400, 'nur Aufgaben');
  assert.equal((await haken(aufgabe.id, { erledigt: false }, w.ben)).status, 404, 'fremder Azubi');
  assert.equal((await haken(aufgabe.id, { erledigt: false }, w.ben, w.ben)).status, 404, 'Eintrag gehört nicht zu Ben');
  assert.equal((await haken(aufgabe.id, { erledigt: false }, w.admin)).status, 403);
});

test('Prüfungstermine im Profil: geprüft, sortiert, im Plan sichtbar', async () => {
  const w = await welt();
  const cookies = als(w, w.ausbilder);
  const setze = (pruefungen: unknown) => ruf(w.u, 'PUT', `/api/azubis/${w.azubi.id}/profil`, { cookies, body: { ausbildungsbeginn: '2025-08-01', pruefungen } });
  for (const falsch of [[{ bezeichnung: 'AP1', datum: '2027-13-01' }], [{ bezeichnung: 'ohne Datum', datum: '' }], [{ bezeichnung: '', datum: '2027-03-01' }], 'nein', Array(9).fill({ bezeichnung: 'x', datum: '2027-03-01' })]) {
    assert.equal((await setze(falsch)).status, 400, JSON.stringify(falsch).slice(0, 60));
  }
  assert.equal((await setze([{ bezeichnung: 'Abschlussprüfung Teil 2', datum: '2028-08-15' }, { bezeichnung: 'Abschlussprüfung Teil 1', datum: '2027-03-09' }, { bezeichnung: '', datum: '' }])).status, 200);
  const p = await plan(w, w.azubi);
  assert.deepEqual(p.pruefungen, [{ bezeichnung: 'Abschlussprüfung Teil 1', datum: '2027-03-09' }, { bezeichnung: 'Abschlussprüfung Teil 2', datum: '2028-08-15' }]);
  assert.equal(p.wochen.at(-1).montag, '2028-08-14', 'die Woche einer Prüfung nach dem Vertragsende ist im Plan');
  assert.equal(p.wochen.at(-1).ausbildungsjahr, null);
  assert.equal((await setze(undefined)).status, 200);
  assert.deepEqual((await plan(w, w.azubi)).pruefungen, []);
});

test('Planvorlagen: anlegen, ändern, in einen Plan übernehmen (Wochen ab Ausbildungsbeginn), löschen', async () => {
  const w = await welt();
  const cookies = als(w, w.ausbilder);
  const eintraege = [
    { art: 'einsatz', abWoche: 1, wochen: 8, titel: 'IT-Support' },
    { art: 'aufgabe', abWoche: 2, wochen: 1, titel: 'Einführung', unteraufgaben: ['Rundgang', 'Konten'] },
    { art: 'einsatz', abWoche: 150, wochen: 20, titel: 'ragt über das Ende' },
    { art: 'notiz', abWoche: 200, titel: 'nach dem Ende' },
  ];
  for (const falsch of [{ titel: '', eintraege }, { titel: 'x', eintraege: [{ art: 'einsatz', abWoche: 0, titel: 'x' }] }, { titel: 'x', eintraege: [{ art: 'einsatz', abWoche: 1, wochen: 999, titel: 'x' }] }, { titel: 'x', berufId: 99, eintraege: [] }, { titel: 'x', eintraege: 'nein' }]) {
    assert.equal((await ruf(w.u, 'POST', '/api/planvorlagen', { cookies, body: falsch })).status, 400, JSON.stringify(falsch).slice(0, 60));
  }
  // ohne „abWoche“ beginnt der Eintrag in der Startwoche; der Baustein wird gleich wieder gelöscht
  const ohne = koerper(await ruf(w.u, 'POST', '/api/planvorlagen', { cookies, body: { titel: 'Ohne Woche', eintraege: [{ art: 'einsatz', wochen: 4, titel: 'Einkauf' }] } })).vorlage;
  assert.deepEqual([ohne.eintraege[0].abWoche, ohne.eintraege[0].wochen], [1, 4]);
  assert.equal((await ruf(w.u, 'DELETE', `/api/planvorlagen/${ohne.id}`, { cookies })).status, 200);
  const v = koerper(await ruf(w.u, 'POST', '/api/planvorlagen', { cookies, body: { titel: 'FISI Standard', eintraege } })).vorlage;
  assert.equal(v.eintraege.length, 4);
  assert.equal(v.eintraege[3].wochen, 1);
  assert.equal(koerper(await ruf(w.u, 'PUT', `/api/planvorlagen/${v.id}`, { cookies, body: { titel: 'FISI', eintraege } })).vorlage.titel, 'FISI');
  assert.equal((await ruf(w.u, 'PUT', '/api/planvorlagen/999', { cookies, body: { titel: 'FISI', eintraege } })).status, 404);
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/planvorlagen', { cookies })).vorlagen.length, 1);
  assert.deepEqual((await plan(w, w.ausbilder)).vorlagen, [{ id: v.id, titel: 'FISI', berufId: null, passt: true }]);

  const r = await ruf(w.u, 'POST', `/api/azubis/${w.azubi.id}/plan/vorlage`, { cookies, body: { vorlageId: v.id } });
  assert.equal(koerper(r).uebernommen, 3, 'der Eintrag nach dem Ende entfällt');
  const p = await plan(w, w.ausbilder);
  const e = (titel: string) => p.eintraege.find((x: any) => x.titel === titel);
  assert.deepEqual([e('IT-Support').von, e('IT-Support').bis], ['2025-07-28', '2025-09-15']);
  assert.equal(e('Einführung').von, '2025-08-04');
  assert.deepEqual(e('Einführung').unteraufgaben, [{ text: 'Rundgang', erledigt: false }, { text: 'Konten', erledigt: false }]);
  assert.equal(e('ragt über das Ende').bis, '2028-07-31', 'auf das Ende der Ausbildung gekürzt');
  assert.equal((await plan(w, w.ausbilder, w.ben)).eintraege.length, 0, 'andere Pläne bleiben unberührt');

  assert.equal((await ruf(w.u, 'POST', `/api/azubis/${w.azubi.id}/plan/vorlage`, { cookies, body: { vorlageId: 999 } })).status, 400);
  assert.equal((await ruf(w.u, 'POST', `/api/azubis/${w.beauftragter.id}/plan/vorlage`, { cookies, body: { vorlageId: v.id } })).status, 404, 'kein Azubi');
  const ohneBeginn = konto(w.u.db, 'azubi');
  assert.equal((await ruf(w.u, 'POST', `/api/azubis/${ohneBeginn.id}/plan/vorlage`, { cookies, body: { vorlageId: v.id } })).status, 409);

  assert.equal((await ruf(w.u, 'DELETE', `/api/planvorlagen/${v.id}`, { cookies })).status, 200);
  assert.equal((await ruf(w.u, 'DELETE', `/api/planvorlagen/${v.id}`, { cookies })).status, 404);
  assert.equal((await plan(w, w.ausbilder)).eintraege.length, 3, 'übernommene Einträge bleiben');
  assert.ok(w.u.db.prepare("SELECT 1 FROM protokoll WHERE aktion = 'planvorlage_uebernommen'").get());
});

test('Bericht zeigt, was laut Plan in der Woche ansteht', async () => {
  const w = await welt();
  await lege(w, w.ausbilder, { ...EINSATZ, von: '2026-11-02' });
  await lege(w, w.ausbilder, { art: 'notiz', von: '2026-11-02', titel: 'intern' });
  const b = koerper(await ruf(w.u, 'GET', `/api/azubis/${w.azubi.id}/berichte/2026-11-02`, { cookies: als(w, w.azubi) }));
  assert.deepEqual(b.plan, [{ art: 'einsatz', titel: 'IT-Support' }]);
});

test('Konto löschen: Plan des Azubis verschwindet, Zuständigkeit eines gelöschten Beauftragten wird leer', async () => {
  const w = await welt();
  await lege(w, w.ausbilder, { ...EINSATZ, zustaendigId: w.beauftragter.id });
  await lege(w, w.ausbilder, EINSATZ, w.ben);
  assert.equal((await ruf(w.u, 'DELETE', `/api/konten/${w.beauftragter.id}`, { cookies: als(w, w.ausbilder) })).status, 200);
  assert.equal((await plan(w, w.ausbilder)).eintraege[0].zustaendig, '');
  assert.equal((await ruf(w.u, 'DELETE', `/api/konten/${w.ben.id}`, { cookies: als(w, w.ausbilder) })).status, 200);
  assert.equal((w.u.db.prepare('SELECT COUNT(*) AS n FROM plan_eintrag').get() as { n: number }).n, 1);
});

test('Versionshinweise: Changelog wird gelesen, für alle angemeldeten Konten', async () => {
  const e = parseChangelog('# Änderungen\n\n## [0.2.0] – 2026-11-10\n\n### Neu\n\n- Eins\n- Zwei\n\n### Behoben\n\n- Drei\n\n## [0.1.0] - 2026-11-09\n- ohne Gruppe\n');
  assert.deepEqual(e, [
    { version: '0.2.0', datum: '2026-11-10', gruppen: [{ titel: 'Neu', punkte: ['Eins', 'Zwei'] }, { titel: 'Behoben', punkte: ['Drei'] }] },
    { version: '0.1.0', datum: '2026-11-09', gruppen: [{ titel: '', punkte: ['ohne Gruppe'] }] },
  ]);
  const w = await welt();
  assert.equal((await ruf(w.u, 'GET', '/api/versionshinweise')).status, 401);
  for (const wer of [w.admin, w.azubi]) {
    const r = koerper(await ruf(w.u, 'GET', '/api/versionshinweise', { cookies: als(w, wer) }));
    assert.ok(r.eintraege.length >= 5);
    assert.equal(r.eintraege[0].version, r.version, 'die laufende Version steht oben im Changelog');
  }
});

test('Logo: nur der Super-Admin hinterlegt es, nur echte PNG-, JPEG- oder WebP-Bilder; lesbar ohne Anmeldung', async () => {
  const w = await welt();
  // kleinstes gültiges PNG (1 × 1 Pixel)
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const setze = (daten: unknown, wer = w.admin) => ruf(w.u, 'PUT', '/api/branding/logo', { cookies: als(w, wer), body: { daten } });
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/branding')).logo, null);
  for (const wer of [w.ausbilder, w.beauftragter, w.azubi]) assert.equal((await setze(`data:image/png;base64,${png}`, wer)).status, 403);
  for (const falsch of [
    '',
    42,
    png,
    `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64')}`,
    `data:image/png;base64,${Buffer.from('<script>alert(1)</script> kein Bild').toString('base64')}`,
    `data:image/png;base64,${Buffer.concat([Buffer.from(png, 'base64'), Buffer.alloc(160 * 1024)]).toString('base64')}`,
    `data:image/png;base64,${png}" onload="alert(1)`,
  ]) {
    assert.equal((await setze(falsch)).status, 400, String(falsch).slice(0, 40));
  }
  // der Typ richtet sich nach dem Inhalt, nicht nach der Angabe
  const r = await setze(`data:image/jpeg;base64,${png}`);
  assert.equal(r.status, 200);
  assert.equal(koerper(r).logo, `data:image/png;base64,${png}`);
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/branding')).logo, `data:image/png;base64,${png}`, 'auch ohne Anmeldung – für die Anmeldeseite');
  assert.equal((await ruf(w.u, 'DELETE', '/api/branding/logo', { cookies: als(w, w.ausbilder) })).status, 403);
  assert.equal((await ruf(w.u, 'DELETE', '/api/branding/logo', { cookies: als(w, w.admin) })).status, 200);
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/branding')).logo, null);
  assert.ok(w.u.db.prepare("SELECT 1 FROM protokoll WHERE aktion = 'logo_geaendert'").get());

  // helles und dunkles Logo sind getrennt
  const fuer = (schema: unknown) => ruf(w.u, 'PUT', '/api/branding/logo', { cookies: als(w, w.admin), body: { daten: `data:image/png;base64,${png}`, schema } });
  assert.equal((await fuer('bunt')).status, 400);
  assert.deepEqual(koerper(await fuer('dunkel')), { logo: null, logoDunkel: `data:image/png;base64,${png}` });
  assert.equal((await fuer('hell')).status, 200);
  assert.equal((await ruf(w.u, 'DELETE', '/api/branding/logo?schema=bunt', { cookies: als(w, w.admin) })).status, 400);
  assert.deepEqual(koerper(await ruf(w.u, 'DELETE', '/api/branding/logo?schema=hell', { cookies: als(w, w.admin) })), { logo: null, logoDunkel: `data:image/png;base64,${png}` });
  assert.deepEqual(koerper(await ruf(w.u, 'DELETE', '/api/branding/logo?schema=dunkel', { cookies: als(w, w.admin) })), { logo: null, logoDunkel: null });
});

test('Baustein ab einer gewählten Woche einfügen: Woche 1 ist die Startwoche, mehrfach möglich, nur innerhalb der Ausbildung', async () => {
  const w = await welt();
  const cookies = als(w, w.ausbilder);
  const v = koerper(await ruf(w.u, 'POST', '/api/planvorlagen', { cookies, body: { titel: 'IT-Support', eintraege: [{ art: 'einsatz', abWoche: 1, wochen: 8, titel: 'IT-Support' }, { art: 'aufgabe', abWoche: 2, wochen: 1, titel: 'Erstes Ticket', unteraufgaben: ['annehmen', 'lösen'] }] } })).vorlage;
  const fuege = (ab: unknown, a = w.azubi) => ruf(w.u, 'POST', `/api/azubis/${a.id}/plan/vorlage`, { cookies, body: { vorlageId: v.id, ab } });
  assert.equal(koerper(await fuege('2026-11-18')).uebernommen, 2, 'Mittwoch rastet auf den Montag ein');
  let e = (await plan(w, w.ausbilder)).eintraege;
  assert.deepEqual(e.map((x: any) => [x.titel, x.von, x.bis]), [['IT-Support', '2026-11-16', '2027-01-04'], ['Erstes Ticket', '2026-11-23', '2026-11-23']]);
  assert.equal(koerper(await fuege('2027-03-01')).uebernommen, 2, 'derselbe Baustein lässt sich später noch einmal einfügen');
  assert.equal((await plan(w, w.ausbilder)).eintraege.length, 4);
  // kurz vor dem Ende: gekürzt bzw. weggelassen (Ende 31.07.2028, letzte Woche beginnt am 31.07.2028)
  assert.equal(koerper(await fuege('2028-07-31', w.ben)).uebernommen, 1);
  e = (await plan(w, w.ausbilder, w.ben)).eintraege;
  assert.deepEqual([e[0].von, e[0].bis], ['2028-07-31', '2028-07-31']);
  for (const [ab, status] of [['2025-07-21', 409], ['2028-08-07', 409], ['quatsch', 400]] as const) assert.equal((await fuege(ab)).status, status, ab);
  assert.equal((await ruf(w.u, 'POST', `/api/azubis/${w.azubi.id}/plan/vorlage`, { cookies: als(w, w.beauftragter), body: { vorlageId: v.id, ab: '2026-11-16' } })).status, 403);
});

test('Sammelplanung: ein Eintrag oder Baustein für mehrere Azubis; wer nicht passt, wird mit Grund ausgelassen', async () => {
  const w = await welt();
  const cookies = als(w, w.ausbilder);
  const spaet = konto(w.u.db, 'azubi', 'Cem Azubi');
  await ruf(w.u, 'PUT', `/api/azubis/${spaet.id}/profil`, { cookies, body: { ausbildungsbeginn: '2027-08-01', ausbilderId: w.ausbilder.id } });
  const ohne = konto(w.u.db, 'azubi', 'Dana Azubi');
  const alle = [w.azubi.id, w.ben.id, spaet.id, ohne.id];
  const sammel = (body: unknown, wer = w.ausbilder) => ruf(w.u, 'POST', '/api/plan/sammel', { cookies: als(w, wer), body });

  const seite = koerper(await ruf(w.u, 'GET', '/api/plan/sammel', { cookies }));
  assert.deepEqual(seite.azubis.map((a: any) => [a.anzeigename, a.ausbildungsjahr, a.beginn]), [['Anna Azubi', 2, '2025-08-01'], ['Ben Azubi', 2, '2025-08-01'], ['Cem Azubi', null, '2027-08-01'], ['Dana Azubi', null, null]]);
  assert.equal((await ruf(w.u, 'GET', '/api/plan/sammel', { cookies: als(w, w.beauftragter) })).status, 403);

  // einzelner Eintrag: Schulblock für alle
  const r = koerper(await sammel({ azubiIds: alle, eintrag: { art: 'schule', von: '2026-11-23', bis: '2026-12-04', titel: 'Berufsschule Block 2' } }));
  assert.equal(r.eingetragen, 2);
  assert.deepEqual(r.ergebnis.map((x: any) => [x.anzeigename, x.ok, x.grund]), [
    ['Anna Azubi', true, ''],
    ['Ben Azubi', true, ''],
    ['Cem Azubi', false, 'Der Zeitraum liegt außerhalb der Ausbildungszeit'],
    ['Dana Azubi', false, 'Für diesen Azubi ist noch kein Ausbildungsbeginn eingetragen'],
  ]);
  for (const a of [w.azubi, w.ben]) {
    const e = (await plan(w, w.ausbilder, a)).eintraege;
    assert.deepEqual(e.map((x: any) => [x.art, x.von, x.bis, x.titel]), [['schule', '2026-11-23', '2026-11-30', 'Berufsschule Block 2']]);
  }
  assert.equal((await plan(w, w.ausbilder, spaet)).eintraege.length, 0);
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/aktivitaeten', { cookies: als(w, w.ben) })).neu, 1, 'jeder Azubi sieht den Eintrag in seiner Glocke');

  // Baustein für mehrere
  const v = koerper(await ruf(w.u, 'POST', '/api/planvorlagen', { cookies, body: { titel: 'Lager', eintraege: [{ art: 'einsatz', abWoche: 1, wochen: 4, titel: 'Lager' }] } })).vorlage;
  const b = koerper(await sammel({ azubiIds: [w.azubi.id, spaet.id], vorlageId: v.id, ab: '2027-01-11' }));
  assert.deepEqual(b.ergebnis.map((x: any) => [x.ok, x.anzahl, x.grund]), [[true, 1, ''], [false, 0, 'Die Startwoche liegt außerhalb der Ausbildungszeit']]);
  assert.equal((await plan(w, w.ausbilder)).eintraege.length, 2);

  // fehlerhafte Anfragen legen nichts an
  for (const falsch of [{ azubiIds: [], eintrag: { art: 'notiz', von: '2026-11-23', titel: 'x' } }, { azubiIds: [w.azubi.id, w.beauftragter.id], eintrag: { art: 'notiz', von: '2026-11-23', titel: 'x' } }, { azubiIds: [w.azubi.id] }, { azubiIds: [w.azubi.id], eintrag: { art: 'schule', von: '2026-11-23' } }, { azubiIds: [w.azubi.id], vorlageId: 999 }]) {
    assert.equal((await sammel(falsch)).status, 400, JSON.stringify(falsch).slice(0, 70));
  }
  assert.equal((await sammel({ azubiIds: [w.azubi.id], eintrag: { art: 'notiz', von: '2026-11-23', titel: 'x' } }, w.beauftragter)).status, 403);
  assert.equal((await plan(w, w.ausbilder)).eintraege.length, 2);
});

test('Sammelplanung zurücknehmen: entfernt Unverändertes, lässt Geändertes und Abgehaktes stehen, räumt die Glocken auf', async () => {
  const w = await welt();
  const cookies = als(w, w.ausbilder);
  const sammel = (body: unknown) => ruf(w.u, 'POST', '/api/plan/sammel', { cookies: als(w, w.ausbilder), body });
  const nimm = (id: number, wer = w.ausbilder) => ruf(w.u, 'DELETE', `/api/plan/sammel/${id}`, { cookies: als(w, wer) });
  const letzte = async () => koerper(await ruf(w.u, 'GET', '/api/plan/sammel', { cookies: als(w, w.ausbilder) })).letzte;
  // ein eigener Eintrag, der nichts mit der Sammelplanung zu tun hat
  await lege(w, w.ausbilder, { art: 'notiz', von: '2026-11-09', titel: 'Bleibt immer' });

  // Lauf 1: Schulblock für beide
  const a = koerper(await sammel({ azubiIds: [w.azubi.id, w.ben.id], eintrag: { art: 'schule', von: '2026-11-23', titel: 'Block 2' } }));
  assert.ok(a.laufId);
  assert.deepEqual(a.letzte.map((l: any) => [l.titel, l.name, l.azubis, l.eintraege, l.vorhanden, l.unveraendert]), [['Block 2', 'Petra Lang', 2, 2, 2, 2]]);
  // Lauf 2: Baustein mit Aufgabe für beide, eine Minute später
  w.u.uhr.jetzt = new Date('2026-11-10T09:01:00Z');
  const v = koerper(await ruf(w.u, 'POST', '/api/planvorlagen', { cookies, body: { titel: 'Lager', eintraege: [{ art: 'einsatz', abWoche: 1, wochen: 4, titel: 'Lager' }, { art: 'aufgabe', abWoche: 1, wochen: 1, titel: 'Sicherheitsschuhe holen' }] } })).vorlage;
  const b = koerper(await sammel({ azubiIds: [w.azubi.id, w.ben.id], vorlageId: v.id, ab: '2027-01-11' }));
  assert.deepEqual((await letzte()).map((l: any) => [l.titel, l.eintraege]), [['Baustein „Lager“', 4], ['Block 2', 2]]);
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/aktivitaeten', { cookies: als(w, w.ben) })).neu, 3);

  // Anna hakt ihre Aufgabe ab, der Ausbilder ändert Bens Einsatz – beides zählt als geändert
  w.u.uhr.jetzt = new Date('2026-11-10T09:05:00Z');
  const anna = (await plan(w, w.azubi)).eintraege;
  const aufgabe = anna.find((e: any) => e.titel === 'Sicherheitsschuhe holen');
  assert.equal((await ruf(w.u, 'POST', `/api/azubis/${w.azubi.id}/plan/${aufgabe.id}/haken`, { cookies: als(w, w.azubi), body: { erledigt: true } })).status, 200);
  const bensEinsatz = (await plan(w, w.ausbilder, w.ben)).eintraege.find((e: any) => e.titel === 'Lager');
  assert.equal((await ruf(w.u, 'PUT', `/api/azubis/${w.ben.id}/plan/${bensEinsatz.id}`, { cookies, body: { art: 'einsatz', von: '2027-01-11', bis: '2027-02-01', titel: 'Lager und Versand' } })).status, 200);
  assert.deepEqual((await letzte()).map((l: any) => [l.vorhanden, l.unveraendert]), [[4, 2], [2, 2]]);

  // Lauf 2 zurücknehmen
  assert.equal((await nimm(b.laufId, w.beauftragter)).status, 403);
  const r = koerper(await nimm(b.laufId));
  assert.equal(r.entfernt, 2);
  assert.deepEqual(r.geblieben, [{ azubi: 'Anna Azubi', titel: 'Sicherheitsschuhe holen' }, { azubi: 'Ben Azubi', titel: 'Lager und Versand' }]);
  assert.deepEqual(r.letzte.map((l: any) => l.titel), ['Block 2']);
  assert.deepEqual((await plan(w, w.azubi)).eintraege.map((e: any) => e.titel).sort(), ['Bleibt immer', 'Block 2', 'Sicherheitsschuhe holen']);
  assert.deepEqual((await plan(w, w.ausbilder, w.ben)).eintraege.map((e: any) => e.titel).sort(), ['Block 2', 'Lager und Versand']);
  assert.equal((await nimm(b.laufId)).status, 404, 'ein Lauf lässt sich nur einmal zurücknehmen');

  // Lauf 1 zurücknehmen: alles weg, auch der Hinweis in der Glocke
  const r1 = koerper(await nimm(a.laufId));
  assert.deepEqual([r1.entfernt, r1.geblieben, r1.letzte], [2, [], []]);
  assert.deepEqual((await plan(w, w.azubi)).eintraege.map((e: any) => e.titel).sort(), ['Bleibt immer', 'Sicherheitsschuhe holen']);
  const glocke = koerper(await ruf(w.u, 'GET', '/api/aktivitaeten', { cookies: als(w, w.ben) }));
  assert.ok(!JSON.stringify(glocke).includes('Block 2'), 'der Hinweis auf den zurückgenommenen Eintrag ist weg');
  assert.ok(JSON.stringify(glocke).includes('Lager'), 'der Hinweis auf den gebliebenen Baustein bleibt');
  assert.ok(w.u.db.prepare("SELECT 1 FROM protokoll WHERE aktion = 'sammelplanung_zurueckgenommen'").get());

  // ein Lauf ohne Treffer hinterlässt nichts; nach 30 Tagen ist ein Lauf vergessen, seine Einträge bleiben
  const leer = koerper(await sammel({ azubiIds: [w.azubi.id], eintrag: { art: 'notiz', von: '2030-01-07', titel: 'zu spät' } }));
  assert.deepEqual([leer.eingetragen, leer.laufId, leer.letzte], [0, null, []]);
  const alt = koerper(await sammel({ azubiIds: [w.azubi.id], eintrag: { art: 'notiz', von: '2026-12-07', titel: 'Alter Lauf' } }));
  w.u.uhr.jetzt = new Date('2026-12-20T09:00:00Z');
  await sammel({ azubiIds: [w.ben.id], eintrag: { art: 'notiz', von: '2026-12-21', titel: 'Neuer Lauf' } });
  assert.deepEqual((await letzte()).map((l: any) => l.titel), ['Neuer Lauf']);
  assert.equal((await nimm(alt.laufId)).status, 404);
  assert.ok((await plan(w, w.azubi)).eintraege.some((e: any) => e.titel === 'Alter Lauf'));
});

// ---------- Termine ----------

test('Termine sind privat: nur der Azubi selbst trägt ein, sieht, ändert und löscht', async () => {
  const w = await welt();
  zuweisen(w.u.db, w.azubi, w.beauftragter);
  w.u.db.prepare('UPDATE benutzer SET alle_azubis = 1 WHERE id = ?').run(w.ausbilder.id); // selbst die Gesamtsicht ändert nichts
  const neu = (wer: BenutzerZeile, body: unknown, a: BenutzerZeile = w.azubi) => ruf(w.u, 'POST', `/api/azubis/${a.id}/plan`, { cookies: als(w, wer), body });
  const termin = { art: 'termin', titel: 'JAV-Sitzung', tag: '2026-11-18', zeitVon: '14:00', zeitBis: '15:30', text: 'Raum 2' };

  const r = await neu(w.azubi, termin);
  assert.equal(r.status, 201);
  const e = koerper(r).eintrag;
  // Mittwoch, 18.11.2026 → steht in der Woche ab Montag, 16.11.
  assert.deepEqual([e.art, e.von, e.bis, e.tag, e.zeitVon, e.zeitBis, e.bearbeitbar], ['termin', '2026-11-16', '2026-11-16', '2026-11-18', '14:00', '15:30', true]);
  assert.deepEqual((await plan(w, w.azubi)).rechte.arten, ['aufgabe', 'notiz', 'termin']);
  assert.equal((await plan(w, w.azubi)).eintraege.length, 1);

  for (const wer of [w.ausbilder, w.beauftragter]) {
    assert.equal((await neu(wer, termin)).status, 403, `${wer.rolle} trägt keine Termine ein`);
    const p = await plan(w, wer);
    assert.equal(p.rechte.arten.includes('termin'), false);
    assert.deepEqual(p.eintraege, [], `${wer.rolle} sieht den Termin nicht`);
    assert.equal(JSON.stringify(p).includes('JAV'), false);
    // für andere gibt es den Eintrag nicht – auch nicht zum Ändern, Löschen oder Abhaken
    assert.equal((await ruf(w.u, 'PUT', `/api/azubis/${w.azubi.id}/plan/${e.id}`, { cookies: als(w, wer), body: { art: 'notiz', titel: 'x', von: '2026-11-16' } })).status, 404);
    assert.equal((await ruf(w.u, 'DELETE', `/api/azubis/${w.azubi.id}/plan/${e.id}`, { cookies: als(w, wer) })).status, 404);
    assert.equal((await ruf(w.u, 'POST', `/api/azubis/${w.azubi.id}/plan/${e.id}/haken`, { cookies: als(w, wer), body: { erledigt: true } })).status, 404);
  }
  assert.equal((await neu(w.ben, termin, w.azubi)).status, 404, 'fremder Azubi');

  const geaendert = await ruf(w.u, 'PUT', `/api/azubis/${w.azubi.id}/plan/${e.id}`, { cookies: als(w, w.azubi), body: { art: 'termin', titel: 'JAV-Sitzung', tag: '2026-11-24' } });
  assert.equal(geaendert.status, 200);
  assert.deepEqual([koerper(geaendert).eintrag.von, koerper(geaendert).eintrag.tag, koerper(geaendert).eintrag.zeitVon], ['2026-11-23', '2026-11-24', ''], 'neuer Tag, jetzt ganztägig');
  assert.equal((await ruf(w.u, 'DELETE', `/api/azubis/${w.azubi.id}/plan/${e.id}`, { cookies: als(w, w.azubi) })).status, 200);
});

test('Termine: Eingaben werden geprüft; nicht in Bausteinen und nicht in der Sammelplanung', async () => {
  const w = await welt();
  const status = async (body: unknown) => (await ruf(w.u, 'POST', `/api/azubis/${w.azubi.id}/plan`, { cookies: als(w, w.azubi), body: { art: 'termin', titel: 'Gespräch', tag: '2026-11-18', ...(body as object) } })).status;
  assert.equal(await status({}), 201, 'ganztägig');
  assert.equal(await status({ zeitVon: '09:00' }), 201, 'nur Beginn');
  assert.equal(await status({ tag: '' }), 400);
  assert.equal(await status({ tag: '18.11.2026' }), 400);
  assert.equal(await status({ zeitVon: '9 Uhr' }), 400);
  assert.equal(await status({ zeitVon: '24:00' }), 400);
  assert.equal(await status({ zeitBis: '10:00' }), 400, 'Ende ohne Beginn');
  assert.equal(await status({ zeitVon: '10:00', zeitBis: '10:00' }), 400);
  assert.equal(await status({ titel: '' }), 400);

  const c = als(w, w.ausbilder);
  assert.equal((await ruf(w.u, 'POST', '/api/planvorlagen', { cookies: c, body: { titel: 'B', eintraege: [{ art: 'termin', abWoche: 1, wochen: 1, titel: 'x' }] } })).status, 400);
  assert.equal((await ruf(w.u, 'POST', '/api/plan/sammel', { cookies: c, body: { azubiIds: [w.azubi.id], eintrag: { art: 'termin', titel: 'x', tag: '2026-11-18' } } })).status, 400);
});

test('Termine hinterlassen bei anderen keine Spur: Glocke, Übersicht, Bericht-Hinweis, Wochen des Plans', async () => {
  const w = await welt();
  const c = als(w, w.azubi);
  // ein Termin weit nach dem Ende der Ausbildung würde sonst den Plan um Wochen verlängern
  for (const t of [{ titel: 'JAV-Sitzung', tag: '2026-11-12', zeitVon: '09:00' }, { titel: 'Weit weg', tag: '2031-05-05' }]) {
    assert.equal((await ruf(w.u, 'POST', `/api/azubis/${w.azubi.id}/plan`, { cookies: c, body: { art: 'termin', ...t } })).status, 201);
  }
  const alsAusbilder = als(w, w.ausbilder);
  assert.equal((w.u.db.prepare('SELECT COUNT(*) AS n FROM aktivitaet').get() as { n: number }).n, 0, 'kein Eintrag für die Glocke');
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/aktivitaeten', { cookies: alsAusbilder })).neu ?? 0, 0);
  assert.equal(JSON.stringify(koerper(await ruf(w.u, 'GET', '/api/jahreskalender', { cookies: alsAusbilder }))).includes('JAV'), false);

  const eigen = await plan(w, w.azubi);
  const fremd = await plan(w, w.ausbilder);
  assert.ok(eigen.wochen.some((x: { montag: string }) => x.montag === '2031-05-05'), 'der Azubi sieht die Woche seines Termins');
  assert.equal(fremd.wochen.some((x: { montag: string }) => x.montag > '2029-01-01'), false, 'für den Ausbilder endet der Plan wie ohne Termin');

  const bericht = (wer: BenutzerZeile) => ruf(w.u, 'GET', `/api/azubis/${w.azubi.id}/berichte/2026-11-09`, { cookies: als(w, wer) }).then(koerper);
  assert.deepEqual((await bericht(w.azubi)).plan, [{ art: 'termin', titel: 'JAV-Sitzung' }], 'dem Azubi hilft der Termin beim Schreiben');
  assert.deepEqual((await bericht(w.ausbilder)).plan, []);
});

test('Jahreskalender: ein Jahr mit Schule, Einsatz, Urlaub, Prüfung und Feiertagen; Termine und fremde Azubis bleiben privat', async () => {
  const w = await welt();
  const c = als(w, w.ausbilder);
  await lege(w, w.ausbilder, EINSATZ); // 09.11.–06.12.2026 (ganze Wochen)
  await lege(w, w.ausbilder, { art: 'schule', von: '2026-12-28', bis: '2027-01-04', titel: 'Blockunterricht' }); // über den Jahreswechsel
  await lege(w, w.azubi, { art: 'termin', titel: 'JAV-Sitzung', tag: '2026-11-18', zeitVon: '14:00' });
  await ruf(w.u, 'PUT', `/api/azubis/${w.azubi.id}/berichte/2026-11-02`, { cookies: als(w, w.azubi), body: { inhalt: { betrieb: [{ text: 'x', stunden: 24 }], abwesenheit: [{ tag: '2026-11-05', grund: 'urlaub', stunden: 8 }, { tag: '2026-11-04', grund: 'krank', stunden: 8 }] } } });
  const profil = koerper(await ruf(w.u, 'GET', `/api/azubis/${w.azubi.id}/profil`, { cookies: c })).profil;
  assert.equal((await ruf(w.u, 'PUT', `/api/azubis/${w.azubi.id}/profil`, { cookies: c, body: { ...profil, pruefungen: [{ bezeichnung: 'AP Teil 1', datum: '2027-03-09' }] } })).status, 200);

  // Azubi: der eigene Kalender, ohne Angabe das laufende Jahr
  const eigen = koerper(await ruf(w.u, 'GET', '/api/jahreskalender', { cookies: als(w, w.azubi) }));
  assert.deepEqual([eigen.jahr, eigen.heute, eigen.eigenes, eigen.einzeln, eigen.azubis.length], [2026, '2026-11-10', true, true, 1]);
  const a = eigen.azubis[0];
  assert.deepEqual([a.id, a.anzeigename, a.beginn, a.ende, a.ausbildungsjahr], [w.azubi.id, 'Anna Azubi', '2025-08-01', '2028-07-31', 2]);
  assert.deepEqual(a.eintraege, [{ art: 'einsatz', von: '2026-11-09', bis: '2026-12-06', titel: 'IT-Support' }, { art: 'schule', von: '2026-12-28', bis: '2027-01-10', titel: 'Blockunterricht' }]);
  assert.deepEqual(a.urlaub, ['2026-11-05']);
  assert.deepEqual(a.termine, [{ tag: '2026-11-18', zeitVon: '14:00', titel: 'JAV-Sitzung' }]);
  assert.deepEqual(a.pruefungen, []);
  assert.ok(eigen.feiertage.some((f: { tag: string; name: string }) => f.tag === '2026-10-31' && f.name === 'Reformationstag'));
  assert.ok(a.ferien.length > 0);
  // Folgejahr: der Schulblock reicht hinein, die Prüfung steht darin
  const naechstes = koerper(await ruf(w.u, 'GET', '/api/jahreskalender?jahr=2027', { cookies: als(w, w.azubi) })).azubis[0];
  assert.deepEqual(naechstes.eintraege.map((e: { titel: string }) => e.titel), ['Blockunterricht']);
  assert.deepEqual(naechstes.pruefungen, [{ tag: '2027-03-09', bezeichnung: 'AP Teil 1' }]);
  // ein Azubi kommt nicht an einen anderen Kalender
  assert.equal((await ruf(w.u, 'GET', `/api/jahreskalender?azubi=${w.ben.id}`, { cookies: als(w, w.azubi) })).status, 404);
  assert.equal((await ruf(w.u, 'GET', `/api/jahreskalender?azubi=${w.azubi.id}`, { cookies: als(w, w.azubi) })).status, 200);

  // Ausbilderin: alle ihre Azubis – ohne die privaten Termine
  const alle = koerper(await ruf(w.u, 'GET', '/api/jahreskalender?jahr=2026', { cookies: c }));
  assert.deepEqual([alle.eigenes, alle.einzeln, alle.azubis.map((x: { anzeigename: string }) => x.anzeigename).sort()], [false, false, ['Anna Azubi', 'Ben Azubi']]);
  const anna = alle.azubis.find((x: { id: number }) => x.id === w.azubi.id);
  // der Bericht mit dem Urlaub ist noch ein Entwurf: Den sieht nur Anna – die Ausbilderin erfährt den Urlaub erst mit dem Einreichen
  assert.deepEqual([anna.termine, anna.urlaub, anna.eintraege.length], [[], [], 2]);
  await ruf(w.u, 'PUT', '/api/ich/unterschrift', { cookies: als(w, w.azubi), body: { pfad: 'M10 10 L20 20 L30 10 L40 20 L50 10 L60 20' } });
  assert.equal((await ruf(w.u, 'POST', `/api/azubis/${w.azubi.id}/berichte/2026-11-02/einreichen`, { cookies: als(w, w.azubi) })).status, 200);
  const danach = koerper(await ruf(w.u, 'GET', '/api/jahreskalender?jahr=2026', { cookies: c }));
  assert.deepEqual(danach.azubis.find((x: { id: number }) => x.id === w.azubi.id).urlaub, ['2026-11-05']);
  assert.ok(!JSON.stringify(danach).includes('krank'), 'Krankheit erscheint nicht im Jahreskalender');
  const einzeln = koerper(await ruf(w.u, 'GET', `/api/jahreskalender?azubi=${w.ben.id}`, { cookies: c }));
  assert.deepEqual([einzeln.einzeln, einzeln.azubis.length, einzeln.azubis[0].anzeigename], [true, 1, 'Ben Azubi']);

  // Beauftragter: nur zugewiesene Azubis; fremde gibt es für ihn nicht
  assert.deepEqual(koerper(await ruf(w.u, 'GET', '/api/jahreskalender', { cookies: als(w, w.beauftragter) })).azubis, []);
  assert.equal((await ruf(w.u, 'GET', `/api/jahreskalender?azubi=${w.azubi.id}`, { cookies: als(w, w.beauftragter) })).status, 404);
  zuweisen(w.u.db, w.azubi, w.beauftragter);
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/jahreskalender', { cookies: als(w, w.beauftragter) })).azubis.length, 1);

  for (const jahr of ['abc', '1999', '20260']) assert.equal((await ruf(w.u, 'GET', `/api/jahreskalender?jahr=${jahr}`, { cookies: c })).status, 400);
  assert.equal((await ruf(w.u, 'GET', '/api/jahreskalender', { cookies: als(w, w.admin) })).status, 403);
  assert.equal((await ruf(w.u, 'GET', '/api/jahreskalender')).status, 401);
});
