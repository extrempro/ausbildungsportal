import assert from 'node:assert/strict';
import { test } from 'node:test';
import { meldeFaelligeErinnerungen } from '../erinnerung';
import type { BenutzerZeile } from '../typen';
import { admin, koerper, konto, ohneWechsel, ruf, sitzung, umgebung, zuweisen } from './hilfe';
import type { Umgebung } from './hilfe';

// „heute“ ist in der Testumgebung Dienstag, der 10.11.2026.
interface Welt {
  u: Umgebung;
  petra: BenutzerZeile;
  olaf: BenutzerZeile;
  bea: BenutzerZeile;
  anna: BenutzerZeile;
  ben: BenutzerZeile;
}

/** Anna (Ausbilderin Petra, Beauftragte Bea), Ben (Ausbilder Olaf, Bea nicht zugewiesen). */
async function welt(): Promise<Welt> {
  const u = await umgebung();
  ohneWechsel(u.db, admin(u.db).id);
  const w = { u, petra: konto(u.db, 'ausbilder', 'Petra Lang'), olaf: konto(u.db, 'ausbilder', 'Olaf Berg'), bea: konto(u.db, 'beauftragter', 'Bea Auft'), anna: konto(u.db, 'azubi', 'Anna Azubi'), ben: konto(u.db, 'azubi', 'Ben Bauer') };
  await ruf(u, 'PUT', `/api/azubis/${w.anna.id}/profil`, { cookies: sitzung(u, w.petra), body: { ausbildungsbeginn: '2025-08-01', ausbilderId: w.petra.id } });
  await ruf(u, 'PUT', `/api/azubis/${w.ben.id}/profil`, { cookies: sitzung(u, w.olaf), body: { ausbildungsbeginn: '2025-08-01', ausbilderId: w.olaf.id } });
  zuweisen(u.db, w.anna, w.bea);
  return w;
}
const als = (w: Welt, wer: BenutzerZeile) => sitzung(w.u, wer);
const lege = (w: Welt, wer: BenutzerZeile, body: Record<string, unknown>) => ruf(w.u, 'POST', '/api/erinnerungen', { cookies: als(w, wer), body });
const liste = async (w: Welt, wer: BenutzerZeile) => koerper(await ruf(w.u, 'GET', '/api/erinnerungen', { cookies: als(w, wer) }));
const glocke = async (w: Welt, wer: BenutzerZeile) => (koerper(await ruf(w.u, 'GET', '/api/aktivitaeten', { cookies: als(w, wer) })).gruppen as { art: string; titel: string[]; anzahl: number }[]).filter((g) => g.art === 'erinnerung_faellig');

test('Erinnerungen: nur zu sichtbaren Azubis, vor einem Einsatz wandert mit, Eingaben werden geprüft', async () => {
  const w = await welt();
  const einsatz = koerper(await ruf(w.u, 'POST', `/api/azubis/${w.anna.id}/plan`, { cookies: als(w, w.petra), body: { art: 'einsatz', von: '2027-02-08', bis: '2027-03-01', titel: 'Lager' } })).eintrag.id;
  // Bea sieht Anna (zugewiesen) und ihre kommenden Einsätze, Ben nicht
  const l = await liste(w, w.bea);
  assert.deepEqual(l.azubis.map((a: { anzeigename: string }) => a.anzeigename), ['Anna Azubi']);
  assert.deepEqual(l.azubis[0].einsaetze.map((e: { id: number }) => e.id), [einsatz]);

  const r = await lege(w, w.bea, { azubiId: w.anna.id, text: 'Arbeitsplatz vorbereiten', einsatzId: einsatz, tageVorher: 7 });
  assert.equal(r.status, 201);
  const e = koerper(r).erinnerung;
  assert.deepEqual([e.datum, e.einsatz.titel, e.tageVorher, e.faellig], ['2027-02-01', 'Lager', 7, false]);
  for (const [body, status] of [
    [{ azubiId: w.ben.id, text: 'x', datum: '2026-12-01' }, 400],
    [{ azubiId: w.anna.id, text: '', datum: '2026-12-01' }, 400],
    [{ azubiId: w.anna.id, text: 'x', datum: '2026-11-01' }, 400],
    [{ azubiId: w.anna.id, text: 'x', datum: 'morgen' }, 400],
    [{ azubiId: w.anna.id, text: 'x', einsatzId: einsatz, tageVorher: 91 }, 400],
    [{ azubiId: w.anna.id, text: 'x', einsatzId: 99999, tageVorher: 1 }, 400],
    [{ azubiId: w.anna.id, text: 'x'.repeat(201), datum: '2026-12-01' }, 400],
  ] as const) {
    assert.equal((await lege(w, w.bea, body)).status, status, JSON.stringify(body));
  }
  // Einsatz verschoben → Erinnerung wandert mit
  const alt = koerper(await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/plan`, { cookies: als(w, w.petra) })).eintraege.find((x: { id: number }) => x.id === einsatz);
  assert.equal((await ruf(w.u, 'PUT', `/api/azubis/${w.anna.id}/plan/${einsatz}`, { cookies: als(w, w.petra), body: { ...alt, art: 'einsatz', von: '2027-03-01', bis: '2027-03-15' } })).status, 200);
  assert.equal((await liste(w, w.bea)).erinnerungen[0].datum, '2027-02-22');
  // Einsatz gelöscht → der letzte Tag bleibt stehen
  await ruf(w.u, 'DELETE', `/api/azubis/${w.anna.id}/plan/${einsatz}`, { cookies: als(w, w.petra) });
  const nachher = (await liste(w, w.bea)).erinnerungen[0];
  assert.deepEqual([nachher.datum, nachher.einsatz], ['2027-02-22', null]);
});

test('Erinnerungen sind privat: fremde gibt es nicht, nur die eigene Glocke meldet sie – einmal', async () => {
  const w = await welt();
  const id = koerper(await lege(w, w.bea, { azubiId: w.anna.id, text: 'Zugang beantragen', datum: '2026-11-10' })).erinnerung.id;
  await lege(w, w.petra, { azubiId: w.anna.id, text: 'Gespräch vorbereiten', datum: '2026-12-01' });
  // nur die eigenen
  assert.deepEqual((await liste(w, w.petra)).erinnerungen.map((e: { text: string }) => e.text), ['Gespräch vorbereiten']);
  for (const wer of [w.petra, w.olaf]) {
    assert.equal((await ruf(w.u, 'PUT', `/api/erinnerungen/${id}/erledigt`, { cookies: als(w, wer), body: { erledigt: true } })).status, 404);
    assert.equal((await ruf(w.u, 'DELETE', `/api/erinnerungen/${id}`, { cookies: als(w, wer) })).status, 404);
  }
  for (const wer of [w.anna, admin(w.u.db)]) assert.equal((await ruf(w.u, 'GET', '/api/erinnerungen', { cookies: als(w, wer) })).status, 403);

  // fällig: Glocke nur bei Bea, mit Azubi und Text; ein zweiter Lauf meldet nicht noch einmal
  const l = await liste(w, w.bea);
  assert.equal(l.faellig, 1);
  assert.equal(meldeFaelligeErinnerungen(w.u.db, w.u.uhr.jetzt), 0);
  const g = await glocke(w, w.bea);
  assert.deepEqual([g.length, g[0].anzahl, g[0].titel[0]], [1, 1, 'Anna Azubi: Zugang beantragen']);
  for (const wer of [w.petra, w.anna]) assert.equal((await glocke(w, wer)).length, 0, wer.anzeigename);

  // abhaken, wieder öffnen, löschen
  assert.equal(koerper(await ruf(w.u, 'PUT', `/api/erinnerungen/${id}/erledigt`, { cookies: als(w, w.bea), body: { erledigt: true } })).erinnerung.faellig, false);
  assert.equal((await liste(w, w.bea)).faellig, 0);
  assert.equal((await ruf(w.u, 'PUT', `/api/erinnerungen/${id}/erledigt`, { cookies: als(w, w.bea), body: { erledigt: false } })).status, 200);
  assert.equal((await ruf(w.u, 'DELETE', `/api/erinnerungen/${id}`, { cookies: als(w, w.bea) })).status, 200);
  assert.equal((await liste(w, w.bea)).erinnerungen.length, 0);
});

test('Erinnerungen: wer den Azubi nicht mehr sieht, verfolgt über die Erinnerung nicht weiter dessen Plan', async () => {
  const w = await welt();
  const einsatz = koerper(await ruf(w.u, 'POST', `/api/azubis/${w.anna.id}/plan`, { cookies: als(w, w.petra), body: { art: 'einsatz', von: '2027-02-08', bis: '2027-03-01', titel: 'Lager' } })).eintrag.id;
  await lege(w, w.bea, { azubiId: w.anna.id, text: 'Arbeitsplatz vorbereiten', einsatzId: einsatz, tageVorher: 7 });
  // die Zuweisung endet, danach wird der Einsatz umbenannt und verschoben
  w.u.db.prepare('DELETE FROM zuweisung WHERE beauftragter_id = ?').run(w.bea.id);
  const alt = koerper(await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/plan`, { cookies: als(w, w.petra) })).eintraege.find((x: { id: number }) => x.id === einsatz);
  assert.equal((await ruf(w.u, 'PUT', `/api/azubis/${w.anna.id}/plan/${einsatz}`, { cookies: als(w, w.petra), body: { ...alt, art: 'einsatz', titel: 'Neues Projekt', von: '2027-05-03', bis: '2027-05-10' } })).status, 200);
  const e = (await liste(w, w.bea)).erinnerungen[0];
  assert.deepEqual([e.datum, e.einsatz, e.text], ['2027-02-01', null, 'Arbeitsplatz vorbereiten'], 'weder neuer Titel noch neuer Tag');
});

test('Erinnerungen: Beauftragte schon vor einer künftigen Zuweisung – nur mit den Einsätzen in ihrer Abteilung', async () => {
  const w = await welt();
  // Ben kommt im Februar über einen Einsatz in Beas Abteilung zu ihr; einen anderen Einsatz hat er davor
  const abteilung = koerper(await ruf(w.u, 'POST', '/api/abteilungen', { cookies: als(w, w.olaf), body: { name: 'Lager', beauftragte: [w.bea.id] } })).abteilung.id;
  const lager = koerper(await ruf(w.u, 'POST', `/api/azubis/${w.ben.id}/plan`, { cookies: als(w, w.olaf), body: { art: 'einsatz', von: '2027-02-08', bis: '2027-03-01', abteilungId: abteilung } })).eintrag.id;
  const anders = koerper(await ruf(w.u, 'POST', `/api/azubis/${w.ben.id}/plan`, { cookies: als(w, w.olaf), body: { art: 'einsatz', von: '2027-01-04', bis: '2027-01-25', titel: 'Werkstatt' } })).eintrag.id;
  // Bea sieht Ben noch nicht – im Formular steht er aber, nur mit dem Einsatz bei ihr
  assert.equal((await ruf(w.u, 'GET', `/api/azubis/${w.ben.id}/plan`, { cookies: als(w, w.bea) })).status, 404);
  const ben = (await liste(w, w.bea)).azubis.find((a: { id: number }) => a.id === w.ben.id);
  assert.deepEqual(ben.einsaetze.map((e: { id: number }) => e.id), [lager]);
  assert.equal((await lege(w, w.bea, { azubiId: w.ben.id, text: 'Spind vorbereiten', einsatzId: lager, tageVorher: 7 })).status, 201);
  assert.equal((await lege(w, w.bea, { azubiId: w.ben.id, text: 'x', einsatzId: anders, tageVorher: 1 })).status, 400);
  assert.equal((await lege(w, w.bea, { azubiId: w.ben.id, text: 'Begrüßung', datum: '2027-02-08' })).status, 201);
  // andere Beauftragte nicht
  const bodo = konto(w.u.db, 'beauftragter', 'Bodo Ohne');
  assert.equal((await lege(w, bodo, { azubiId: w.ben.id, text: 'x', datum: '2027-02-08' })).status, 400);
  // die Erinnerung folgt dem Einsatz, solange die Zuweisung besteht
  const alt = koerper(await ruf(w.u, 'GET', `/api/azubis/${w.ben.id}/plan`, { cookies: als(w, w.olaf) })).eintraege.find((x: { id: number }) => x.id === lager);
  await ruf(w.u, 'PUT', `/api/azubis/${w.ben.id}/plan/${lager}`, { cookies: als(w, w.olaf), body: { ...alt, art: 'einsatz', abteilungId: abteilung, von: '2027-02-15', bis: '2027-03-08' } });
  assert.deepEqual((await liste(w, w.bea)).erinnerungen.map((e: { datum: string; einsatz: unknown }) => [e.datum, e.einsatz !== null]), [['2027-02-08', true], ['2027-02-08', false]]);
});
