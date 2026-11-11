import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BenutzerZeile } from '../typen';
import { admin, koerper, konto, ohneWechsel, ruf, sitzung, umgebung } from './hilfe';

// „heute“ ist in der Testumgebung Dienstag, der 10.11.2026.
async function welt() {
  const u = await umgebung();
  ohneWechsel(u.db, admin(u.db).id);
  const w = { u, chef: admin(u.db), petra: konto(u.db, 'ausbilder', 'Petra Lang'), olaf: konto(u.db, 'ausbilder', 'Olaf Berg'), bea: konto(u.db, 'beauftragter', 'Bea Auft'), bodo: konto(u.db, 'beauftragter', 'Bodo Zweit'), carla: konto(u.db, 'beauftragter', 'Carla Dritt'), anna: konto(u.db, 'azubi', 'Anna Azubi'), ben: konto(u.db, 'azubi', 'Ben Bauer') };
  const c = sitzung(u, w.petra);
  await ruf(u, 'PUT', '/api/stammdaten/betrieb', { cookies: c, body: { name: 'Muster GmbH', bundesland: 'HH' } });
  for (const a of [w.anna, w.ben]) assert.equal((await ruf(u, 'PUT', `/api/azubis/${a.id}/profil`, { cookies: c, body: { ausbildungsbeginn: '2025-08-01', ausbilderId: w.petra.id, urlaubstage: 30 } })).status, 200);
  return w;
}
type Welt = Awaited<ReturnType<typeof welt>>;
const als = (w: Welt, wer: BenutzerZeile) => sitzung(w.u, wer);
const lege = (w: Welt, wer: BenutzerZeile, body: unknown) => ruf(w.u, 'POST', '/api/abteilungen', { cookies: als(w, wer), body });
const auto = async (w: Welt, a = w.anna) => koerper(await ruf(w.u, 'GET', `/api/azubis/${a.id}/zuweisungen`, { cookies: als(w, w.petra) })).ausAbteilungen.map((z: { beauftragter: string; von: string; bis: string; abteilung: string; stellvertretung: boolean }) => `${z.beauftragter}${z.stellvertretung ? ' (Stv.)' : ''} ${z.von}–${z.bis} ${z.abteilung}`);
const sieht = async (w: Welt, wer: BenutzerZeile, a = w.anna) => (await ruf(w.u, 'GET', `/api/azubis/${a.id}/plan`, { cookies: als(w, wer) })).status;

test('Abteilungen anlegen: Ausbilder, mit Beauftragten und Stellvertretung; Eingaben werden geprüft', async () => {
  const w = await welt();
  const r = await lege(w, w.petra, { name: ' IT-Betrieb ', beauftragte: [w.bea.id, w.olaf.id], stellvertretung: [w.bodo.id, w.bea.id] });
  assert.equal(r.status, 201);
  const a = koerper(r).abteilung;
  // wer schon Beauftragte:r ist, steht nicht zusätzlich als Stellvertretung da
  assert.deepEqual([a.name, a.einsaetze, a.beauftragte.map((p: { anzeigename: string }) => p.anzeigename), a.stellvertretung.map((p: { anzeigename: string }) => p.anzeigename)], ['IT-Betrieb', 0, ['Bea Auft', 'Olaf Berg'], ['Bodo Zweit']]);
  for (const [body, status] of [[{ name: 'it-betrieb' }, 409], [{ name: '' }, 400], [{ name: 'X', beauftragte: [w.anna.id] }, 400], [{ name: 'X', beauftragte: [w.chef.id] }, 400], [{ name: 'X', stellvertretung: [99999] }, 400], [{ name: 'X', beauftragte: 'bea' }, 400]] as const) assert.equal((await lege(w, w.petra, body)).status, status, JSON.stringify(body));
  // ohne Personen geht auch – die Abteilung dient dann nur als Name
  assert.equal((await lege(w, w.olaf, { name: 'Lager' })).status, 201);
  for (const wer of [w.bea, w.anna, w.chef]) assert.equal((await lege(w, wer, { name: 'Y' })).status, 403, wer.rolle);
  // Beauftragte sehen die Liste (für die Anzeige), aber nicht, wen man hinterlegen könnte
  const beiBea = koerper(await ruf(w.u, 'GET', '/api/abteilungen', { cookies: als(w, w.bea) }));
  assert.deepEqual([beiBea.abteilungen.map((x: { name: string }) => x.name), beiBea.personen], [['IT-Betrieb', 'Lager'], []]);
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/abteilungen', { cookies: als(w, w.petra) })).personen.length, 5);
  for (const wer of [w.anna, w.chef]) assert.equal((await ruf(w.u, 'GET', '/api/abteilungen', { cookies: als(w, wer) })).status, 403);
  const geaendert = koerper(await ruf(w.u, 'PUT', `/api/abteilungen/${a.id}`, { cookies: als(w, w.olaf), body: { name: 'IT', beauftragte: [w.bodo.id] } })).abteilung;
  assert.deepEqual([geaendert.name, geaendert.beauftragte.length, geaendert.stellvertretung.length], ['IT', 1, 0]);
  assert.equal((await ruf(w.u, 'PUT', `/api/abteilungen/${a.id}`, { cookies: als(w, w.petra), body: { name: 'Lager' } })).status, 409);
  assert.equal((await ruf(w.u, 'PUT', '/api/abteilungen/9999', { cookies: als(w, w.petra), body: { name: 'Z' } })).status, 404);
});

test('Einsatz in einer Abteilung: Beauftragte und Stellvertretung sind für die Dauer automatisch zugewiesen', async () => {
  const w = await welt();
  const it = koerper(await lege(w, w.petra, { name: 'IT-Betrieb', beauftragte: [w.bea.id], stellvertretung: [w.bodo.id] })).abteilung.id as number;
  assert.deepEqual([await sieht(w, w.bea), await sieht(w, w.bodo)], [404, 404], 'vorher sehen sie den Azubi nicht');

  // ohne Titel heißt der Einsatz wie die Abteilung
  const r = await ruf(w.u, 'POST', `/api/azubis/${w.anna.id}/plan`, { cookies: als(w, w.petra), body: { art: 'einsatz', von: '2026-11-09', bis: '2026-12-14', abteilungId: it } });
  assert.equal(r.status, 201);
  const e = koerper(r).eintrag;
  assert.deepEqual([e.titel, e.abteilungId, e.abteilung], ['IT-Betrieb', it, 'IT-Betrieb']);
  // die Zuweisung reicht vom Montag der ersten bis zum Sonntag der letzten Woche
  assert.deepEqual(await auto(w), ['Bea Auft 2026-11-09–2026-12-20 IT-Betrieb', 'Bodo Zweit (Stv.) 2026-11-09–2026-12-20 IT-Betrieb']);
  assert.deepEqual([await sieht(w, w.bea), await sieht(w, w.bodo), await sieht(w, w.carla), await sieht(w, w.bea, w.ben)], [200, 200, 404, 404]);
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/azubis', { cookies: als(w, w.bodo) })).azubis.map((a: { anzeigename: string }) => a.anzeigename).join(), 'Anna Azubi');
  // die Liste „von Hand“ bleibt leer – und sie zu speichern lässt die automatischen Zuweisungen stehen
  assert.deepEqual(koerper(await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/zuweisungen`, { cookies: als(w, w.petra) })).zuweisungen, []);
  assert.equal((await ruf(w.u, 'PUT', `/api/azubis/${w.anna.id}/zuweisungen`, { cookies: als(w, w.petra), body: { zuweisungen: [{ beauftragterId: w.carla.id, von: null, bis: null }] } })).status, 200);
  assert.equal((await auto(w)).length, 2);
  // Beauftragte sehen bei den Zuweisungen nur sich selbst
  assert.equal(koerper(await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/zuweisungen`, { cookies: als(w, w.bea) })).ausAbteilungen.length, 1);

  // Zeitraum des Einsatzes ändern: die Zuweisung zieht mit
  const aendere = (body: Record<string, unknown>) => ruf(w.u, 'PUT', `/api/azubis/${w.anna.id}/plan/${e.id}`, { cookies: als(w, w.petra), body: { art: 'einsatz', titel: 'IT-Betrieb', von: '2026-11-09', bis: '2026-11-23', abteilungId: it, ...body } });
  assert.equal((await aendere({})).status, 200);
  assert.deepEqual(await auto(w), ['Bea Auft 2026-11-09–2026-11-29 IT-Betrieb', 'Bodo Zweit (Stv.) 2026-11-09–2026-11-29 IT-Betrieb']);
  // Personen der Abteilung ändern: wirkt sofort auf den Einsatz
  await ruf(w.u, 'PUT', `/api/abteilungen/${it}`, { cookies: als(w, w.petra), body: { name: 'IT-Betrieb', beauftragte: [w.bodo.id] } });
  assert.deepEqual(await auto(w), ['Bodo Zweit 2026-11-09–2026-11-29 IT-Betrieb']);
  assert.equal(await sieht(w, w.bea), 404, 'wer nicht mehr hinterlegt ist, verliert den Zugriff');
  // gesperrte Konten werden nicht zugewiesen
  w.u.db.prepare("UPDATE benutzer SET status = 'gesperrt' WHERE id = ?").run(w.bodo.id);
  await ruf(w.u, 'PUT', `/api/abteilungen/${it}`, { cookies: als(w, w.petra), body: { name: 'IT-Betrieb', beauftragte: [w.bodo.id, w.bea.id] } });
  assert.deepEqual(await auto(w), ['Bea Auft 2026-11-09–2026-11-29 IT-Betrieb']);

  // eine Abteilung, die verwendet wird, lässt sich nicht löschen
  const loesche = () => ruf(w.u, 'DELETE', `/api/abteilungen/${it}`, { cookies: als(w, w.petra) });
  assert.deepEqual([(await loesche()).status, /wird in 1 Einsatz verwendet/.test(koerper(await loesche()).fehler)], [409, true]);
  // Abteilung vom Einsatz nehmen: Zuweisung weg; unbekannte Abteilung: Fehler
  assert.equal((await aendere({ abteilungId: 9999 })).status, 400);
  assert.equal(koerper(await aendere({ abteilungId: null })).eintrag.abteilungId, null);
  assert.deepEqual([await auto(w), await sieht(w, w.bea)], [[], 404]);
  // wieder zuordnen und den Einsatz löschen: Zuweisung verschwindet mit
  await aendere({});
  assert.equal((await auto(w)).length, 1);
  assert.equal((await ruf(w.u, 'DELETE', `/api/azubis/${w.anna.id}/plan/${e.id}`, { cookies: als(w, w.petra) })).status, 200);
  assert.deepEqual(await auto(w), []);
  assert.equal((await loesche()).status, 200);
  // nur Einsätze tragen eine Abteilung
  const lager = koerper(await lege(w, w.petra, { name: 'Lager', beauftragte: [w.bea.id] })).abteilung.id as number;
  const schule = koerper(await ruf(w.u, 'POST', `/api/azubis/${w.anna.id}/plan`, { cookies: als(w, w.petra), body: { art: 'schule', titel: 'Block', von: '2026-11-09', bis: '2026-11-09', abteilungId: lager } })).eintrag;
  assert.deepEqual([schule.abteilungId, await auto(w)], [null, []]);
});

test('Urlaub: Aus einer Abteilung genügt eine Bestätigung – von Beauftragten oder Stellvertretung', async () => {
  const w = await welt();
  const it = koerper(await lege(w, w.petra, { name: 'IT-Betrieb', beauftragte: [w.bea.id, w.petra.id], stellvertretung: [w.bodo.id] })).abteilung.id as number;
  await ruf(w.u, 'POST', `/api/azubis/${w.anna.id}/plan`, { cookies: als(w, w.petra), body: { art: 'einsatz', von: '2026-11-09', bis: '2026-12-28', abteilungId: it } });
  // Carla ist zusätzlich von Hand zugewiesen: Sie muss selbst bestätigen
  await ruf(w.u, 'PUT', `/api/azubis/${w.anna.id}/zuweisungen`, { cookies: als(w, w.petra), body: { zuweisungen: [{ beauftragterId: w.carla.id, von: null, bis: null }] } });

  const p = koerper(await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/urlaub/pruefen?von=2026-12-07&bis=2026-12-11`, { cookies: als(w, w.anna) }));
  assert.deepEqual(p.bestaetiger, ['Carla Dritt', 'Bea Auft oder Bodo Zweit (IT-Betrieb)'], 'die zuständige Ausbilderin steht nicht dabei – sie entscheidet ohnehin');
  const antrag = koerper(await ruf(w.u, 'POST', `/api/azubis/${w.anna.id}/urlaub`, { cookies: als(w, w.anna), body: { von: '2026-12-07', bis: '2026-12-11' } })).antrag;
  assert.deepEqual(antrag.bestaetigungen.map((b: { name: string; gruppe: string }) => `${b.name}|${b.gruppe}`), ['Carla Dritt|', 'Bea Auft|IT-Betrieb', 'Bodo Zweit|IT-Betrieb']);
  const tue = (wer: BenutzerZeile, aktion: string) => ruf(w.u, 'POST', `/api/urlaub/${antrag.id}/${aktion}`, { cookies: als(w, wer), body: {} });
  // die Stellvertretung bestätigt: Für die Abteilung ist damit alles erledigt, Bea muss nicht mehr
  const nachBodo = koerper(await tue(w.bodo, 'bestaetigen')).antrag;
  assert.deepEqual([nachBodo.stufe, nachBodo.bestaetigungen.map((b: { name: string; zeit: string | null }) => `${b.name}:${b.zeit ? 'ja' : 'offen'}`)], ['beauftragte', ['Carla Dritt:offen', 'Bodo Zweit:ja']]);
  assert.equal((await tue(w.bea, 'bestaetigen')).status, 409);
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/urlaub', { cookies: als(w, w.bea) })).zuTun, 0);
  // Carla fehlt noch
  assert.equal(koerper(await tue(w.carla, 'bestaetigen')).antrag.stufe, 'ausbilder');
  assert.equal(koerper(await tue(w.petra, 'genehmigen')).antrag.status, 'genehmigt');
});
