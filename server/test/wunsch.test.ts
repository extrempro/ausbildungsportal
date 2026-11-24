import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BenutzerZeile } from '../typen';
import { admin, koerper, konto, ohneWechsel, ruf, sitzung, umgebung, zuweisen } from './hilfe';
import type { Umgebung } from './hilfe';

// „heute“ ist in der Testumgebung Dienstag, der 10.11.2026.
interface Welt {
  u: Umgebung;
  admin: BenutzerZeile;
  petra: BenutzerZeile;
  olaf: BenutzerZeile;
  bea: BenutzerZeile;
  anna: BenutzerZeile;
  ben: BenutzerZeile;
  lager: number;
}

/** Anna (Ausbilderin Petra, Beauftragte Bea), Ben (Ausbilder Olaf); Abteilung „Lager“ mit Bea als Beauftragter. */
async function welt(): Promise<Welt> {
  const u = await umgebung();
  ohneWechsel(u.db, admin(u.db).id);
  const w = { u, admin: admin(u.db), petra: konto(u.db, 'ausbilder', 'Petra Lang'), olaf: konto(u.db, 'ausbilder', 'Olaf Berg'), bea: konto(u.db, 'beauftragter', 'Bea Auft'), anna: konto(u.db, 'azubi', 'Anna Azubi'), ben: konto(u.db, 'azubi', 'Ben Bauer'), lager: 0 };
  assert.equal((await ruf(u, 'PUT', `/api/azubis/${w.anna.id}/profil`, { cookies: sitzung(u, w.petra), body: { ausbildungsbeginn: '2025-08-01', ausbilderId: w.petra.id } })).status, 200);
  assert.equal((await ruf(u, 'PUT', `/api/azubis/${w.ben.id}/profil`, { cookies: sitzung(u, w.olaf), body: { ausbildungsbeginn: '2025-08-01', ausbilderId: w.olaf.id } })).status, 200);
  zuweisen(u.db, w.anna, w.bea);
  const r = await ruf(u, 'POST', '/api/abteilungen', { cookies: sitzung(u, w.petra), body: { name: 'Lager', beauftragte: [w.bea.id] } });
  w.lager = koerper(r).abteilung.id;
  return w;
}
const als = (w: Welt, wer: BenutzerZeile) => sitzung(w.u, wer);
const wuensche = (w: Welt, von: string, bis: string, body: Record<string, unknown> = {}, a = w.anna) => ruf(w.u, 'POST', `/api/azubis/${a.id}/wuensche`, { cookies: als(w, a), body: { abteilungId: w.lager, von, bis, ...body } });
const tue = (w: Welt, wer: BenutzerZeile, id: number, aktion: string, body: unknown = {}) => ruf(w.u, 'POST', `/api/wuensche/${id}/${aktion}`, { cookies: als(w, wer), body });
const glocke = async (w: Welt, wer: BenutzerZeile) => (koerper(await ruf(w.u, 'GET', '/api/aktivitaeten', { cookies: als(w, wer) })).gruppen as { art: string }[]).map((g) => g.art);

test('Einsatz wünschen: nur Abteilungen aus den Stammdaten, ganze Wochen, Eingaben werden geprüft', async () => {
  const w = await welt();
  const r = await wuensche(w, '2027-01-20', '2027-02-03', { grund: 'Ich möchte sehen, wie der Wareneingang läuft.' });
  assert.equal(r.status, 201);
  const x = koerper(r).wunsch;
  // Wochen über den Montag
  assert.deepEqual([x.von, x.bis, x.zeitraum, x.abteilung.name, x.status, x.rechte.zurueckziehen], ['2027-01-18', '2027-02-01', 'KW 3–5/2027', 'Lager', 'offen', true]);
  for (const [von, bis, body, status] of [
    ['2027-01-20', '', { abteilungId: 99999 }, 400],
    ['2027-01-20', '', { abteilungId: '' }, 400],
    ['2026-10-05', '2026-10-09', {}, 400],
    ['2027-03-10', '2027-03-01', {}, 400],
    ['2027-01-04', '2027-12-31', {}, 400],
    ['x', '', {}, 400],
    ['2029-01-08', '', {}, 409],
    ['2027-01-20', '', { grund: 'x'.repeat(501) }, 400],
  ] as const) {
    assert.equal((await wuensche(w, von, bis, body)).status, status, `${von}–${bis} ${JSON.stringify(body)}`);
  }
  // nur der Azubi selbst wünscht – und nur für sich
  assert.equal((await ruf(w.u, 'POST', `/api/azubis/${w.anna.id}/wuensche`, { cookies: als(w, w.petra), body: { abteilungId: w.lager, von: '2027-01-20' } })).status, 403);
  assert.equal((await ruf(w.u, 'POST', `/api/azubis/${w.anna.id}/wuensche`, { cookies: als(w, w.ben), body: { abteilungId: w.lager, von: '2027-01-20' } })).status, 404);
  // die Liste nennt die Abteilungen zur Auswahl
  const l = koerper(await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/wuensche`, { cookies: als(w, w.anna) }));
  assert.deepEqual([l.abteilungen.map((a: { name: string }) => a.name), l.wuensche.length], [['Lager'], 1]);
});

test('Einsatzwunsch genehmigen: Einsatz im Plan mit Abteilung, Beauftragte zugewiesen, Zeitraum anpassbar', async () => {
  const w = await welt();
  const id = koerper(await wuensche(w, '2027-01-18', '2027-02-01', { grund: 'privater Grund' })).wunsch.id;
  // Hinweis bei Überschneidung mit einem Schulblock
  await ruf(w.u, 'POST', `/api/azubis/${w.anna.id}/plan`, { cookies: als(w, w.petra), body: { art: 'schule', von: '2027-01-04', bis: '2027-01-18', titel: 'Block C2' } });
  const offen = koerper(await ruf(w.u, 'GET', '/api/wuensche', { cookies: als(w, w.petra) }));
  assert.equal(offen.offen, 1);
  assert.match(offen.wuensche[0].hinweise.join(' '), /Schulblock „Block C2“/);
  // fremder Ausbilder: sieht den Wunsch nicht und kann nicht entscheiden
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/wuensche', { cookies: als(w, w.olaf) })).offen, 0);
  assert.equal((await tue(w, w.olaf, id, 'genehmigen')).status, 404);
  // angepasster Zeitraum, außerhalb der Ausbildung nicht
  assert.equal((await tue(w, w.petra, id, 'genehmigen', { von: '2029-01-08', bis: '2029-01-15' })).status, 409);
  const r = await tue(w, w.petra, id, 'genehmigen', { von: '2027-01-27', bis: '2027-02-12' });
  assert.equal(r.status, 200);
  assert.deepEqual([koerper(r).wunsch.status, koerper(r).wunsch.zeitraum, koerper(r).wunsch.imPlan, koerper(r).wunsch.entschiedenVon], ['genehmigt', 'KW 4–6/2027', true, 'Petra Lang']);
  assert.equal((await tue(w, w.petra, id, 'genehmigen')).status, 409, 'nur einmal');
  // im Plan: Einsatz in der Abteilung – ohne den Grund des Azubis
  const plan = koerper(await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/plan`, { cookies: als(w, w.bea) }));
  const e = plan.eintraege.find((x: { art: string }) => x.art === 'einsatz');
  assert.deepEqual([e.titel, e.von, e.bis, e.abteilung, e.text], ['Lager', '2027-01-25', '2027-02-08', 'Lager', '']);
  // automatische Zuweisung der Beauftragten der Abteilung
  assert.ok(w.u.db.prepare('SELECT 1 FROM zuweisung WHERE azubi_id = ? AND beauftragter_id = ? AND einsatz_id = ?').get(w.anna.id, w.bea.id, e.id));
  // wird der Einsatz gelöscht, weiß der Wunsch das
  await ruf(w.u, 'DELETE', `/api/azubis/${w.anna.id}/plan/${e.id}`, { cookies: als(w, w.petra) });
  assert.equal(koerper(await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/wuensche`, { cookies: als(w, w.anna) })).wuensche[0].imPlan, false);
});

test('Einsatzwunsch ablehnen und zurückziehen; Beauftragte sehen Wünsche nicht – auch nicht in der Glocke', async () => {
  const w = await welt();
  const a = koerper(await wuensche(w, '2027-01-18', '')).wunsch.id;
  const b = koerper(await wuensche(w, '2027-03-01', '')).wunsch.id;
  // Glocke: der Ausbilder erfährt es, die Beauftragte nicht
  assert.ok((await glocke(w, w.petra)).includes('wunsch_neu'));
  assert.ok(!(await glocke(w, w.bea)).some((x) => x.startsWith('wunsch_')));
  assert.equal((await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/wuensche`, { cookies: als(w, w.bea) })).status, 403);
  assert.equal((await ruf(w.u, 'GET', '/api/wuensche', { cookies: als(w, w.bea) })).status, 403);

  assert.equal((await tue(w, w.petra, a, 'ablehnen', { begruendung: '' })).status, 400);
  const r = await tue(w, w.petra, a, 'ablehnen', { begruendung: 'In der Woche ist Berufsschule.' });
  assert.equal(r.status, 200);
  const sicht = koerper(await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/wuensche`, { cookies: als(w, w.anna) })).wuensche.find((x: { id: number }) => x.id === a);
  assert.deepEqual([sicht.status, sicht.begruendung, sicht.rechte.zurueckziehen], ['abgelehnt', 'In der Woche ist Berufsschule.', false]);
  assert.ok((await glocke(w, w.anna)).includes('wunsch_abgelehnt'));
  assert.ok(!(await glocke(w, w.bea)).some((x) => x.startsWith('wunsch_')));

  // zurückziehen: nur der Azubi selbst, nur offen
  assert.equal((await tue(w, w.ben, b, 'zurueckziehen')).status, 404);
  assert.equal((await tue(w, w.anna, b, 'zurueckziehen')).status, 200);
  assert.equal((await tue(w, w.anna, b, 'zurueckziehen')).status, 409);
  assert.equal((await tue(w, w.petra, b, 'genehmigen')).status, 409);
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/wuensche', { cookies: als(w, w.petra) })).entschieden.length, 2);
});
