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
  assert.deepEqual(p.rechte, { arten: ['aufgabe', 'notiz'], zuweisen: false });
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

test('Übersicht: Schule, Einsatz und Urlaub je Woche; Beauftragte sehen nur ihre Azubis', async () => {
  const w = await welt();
  await lege(w, w.ausbilder, EINSATZ);
  await lege(w, w.ausbilder, { art: 'schule', von: '2026-11-16', bis: '2026-11-23', titel: 'Block' });
  await lege(w, w.ausbilder, { art: 'aufgabe', von: '2026-11-09', titel: 'zählt nicht' });
  await ruf(w.u, 'PUT', `/api/azubis/${w.azubi.id}/berichte/2026-11-02`, { cookies: als(w, w.azubi), body: { inhalt: { betrieb: [{ text: 'x', stunden: 24 }], abwesenheit: [{ tag: '2026-11-05', grund: 'urlaub', stunden: 8 }, { tag: '2026-11-06', grund: 'urlaub', stunden: 8 }, { tag: '2026-11-04', grund: 'krank', stunden: 8 }] } } });

  const r = koerper(await ruf(w.u, 'GET', '/api/uebersicht?von=2026-11-04&wochen=4', { cookies: als(w, w.ausbilder) }));
  assert.deepEqual(r.wochen.map((x: any) => x.montag), ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23']);
  assert.deepEqual(r.azubis.map((x: any) => x.anzeigename), ['Anna Azubi', 'Ben Azubi']);
  assert.equal(r.azubis[0].ausbildungsjahr, 2);
  const anna = r.azubis[0].wochen;
  assert.deepEqual(anna[0], { inAusbildung: true, schule: false, einsatz: [], urlaubstage: 2 });
  assert.deepEqual(anna[1], { inAusbildung: true, schule: false, einsatz: ['IT-Support'], urlaubstage: 0 });
  assert.deepEqual(anna[2], { inAusbildung: true, schule: true, einsatz: ['IT-Support'], urlaubstage: 0 });
  assert.ok(!JSON.stringify(r).includes('krank'), 'Krankheit erscheint nicht in der Übersicht');

  assert.deepEqual(koerper(await ruf(w.u, 'GET', '/api/uebersicht', { cookies: als(w, w.beauftragter) })).azubis, []);
  zuweisen(w.u.db, w.ben, w.beauftragter);
  const b = koerper(await ruf(w.u, 'GET', '/api/uebersicht', { cookies: als(w, w.beauftragter) }));
  assert.deepEqual(b.azubis.map((x: any) => x.anzeigename), ['Ben Azubi']);
  assert.equal(b.wochen.length, 26);
  assert.equal(b.wochen[0].montag, '2026-11-09');
  assert.equal((await ruf(w.u, 'GET', '/api/uebersicht?wochen=99', { cookies: als(w, w.ausbilder) })).status, 400);
  assert.equal((await ruf(w.u, 'GET', '/api/uebersicht?von=gestern', { cookies: als(w, w.ausbilder) })).status, 400);
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
