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
