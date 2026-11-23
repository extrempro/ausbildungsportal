import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BenutzerZeile } from '../typen';
import { koerper, konto, ruf, sitzung, umgebung, zustaendig } from './hilfe';
import type { Umgebung } from './hilfe';

// „heute“ ist in der Testumgebung Dienstag, der 10.11.2026.
interface Welt {
  u: Umgebung;
  petra: BenutzerZeile;
  anna: BenutzerZeile;
  ben: BenutzerZeile;
  schule: number;
  andere: number;
}

async function welt(): Promise<Welt> {
  const u = await umgebung();
  const petra = konto(u.db, 'ausbilder', 'Petra Lang');
  const anna = konto(u.db, 'azubi', 'Anna Azubi');
  const ben = konto(u.db, 'azubi', 'Ben Beispiel');
  const c = sitzung(u, petra);
  const schule = koerper(await ruf(u, 'POST', '/api/stammdaten/berufsschulen', { cookies: c, body: { name: 'Berufliche Schule Musterstadt', ort: 'Musterstadt', bundesland: 'HH', form: 'block' } })).berufsschule.id as number;
  const andere = koerper(await ruf(u, 'POST', '/api/stammdaten/berufsschulen', { cookies: c, body: { name: 'Zweite Schule Musterstadt', bundesland: 'HH', form: 'block' } })).berufsschule.id as number;
  for (const a of [anna, ben]) {
    zustaendig(u.db, a, petra);
    await ruf(u, 'PUT', `/api/azubis/${a.id}/profil`, { cookies: c, body: { ausbildungsbeginn: '2025-08-01', ausbilderId: petra.id, berufsschuleId: schule } });
  }
  return { u, petra, anna, ben, schule, andere };
}

const als = (w: Welt, b: BenutzerZeile) => sitzung(w.u, b);
const klasse = async (w: Welt, name: string, schule = w.schule) => ruf(w.u, 'POST', '/api/stammdaten/klassen', { cookies: als(w, w.petra), body: { berufsschuleId: schule, name } });
const inKlasse = (w: Welt, a: BenutzerZeile, klasseId: number | null, schule = w.schule) =>
  ruf(w.u, 'PUT', `/api/azubis/${a.id}/profil`, { cookies: als(w, w.petra), body: { ausbildungsbeginn: '2025-08-01', ausbilderId: w.petra.id, berufsschuleId: schule, klasseId } });
const plan = async (w: Welt, a: BenutzerZeile) => (koerper(await ruf(w.u, 'GET', `/api/azubis/${a.id}/plan`, { cookies: als(w, a) })).eintraege as { id: number; art: string; von: string; bis: string; titel: string; klasse: string | null }[]).filter((e) => e.art === 'schule');
const glocke = (w: Welt, a: BenutzerZeile, art: string) => (w.u.db.prepare('SELECT COALESCE(SUM(anzahl), 0) AS n FROM aktivitaet WHERE azubi_id = ? AND art = ?').get(a.id, art) as { n: number }).n;

test('Klassen: anlegen, Name je Schule einmalig, im Profil nur Klassen der eigenen Berufsschule', async () => {
  const w = await welt();
  const r = await klasse(w, 'FI-25a');
  assert.equal(r.status, 201);
  const id = koerper(r).klasse.id as number;
  assert.equal((await klasse(w, 'fi-25A')).status, 409, 'gleicher Name, andere Schreibweise');
  assert.equal((await klasse(w, 'FI-25a', w.andere)).status, 201, 'an einer anderen Schule geht derselbe Name');
  assert.equal((await klasse(w, '')).status, 400);
  // die Stammdaten nennen die Klassen
  const s = koerper(await ruf(w.u, 'GET', '/api/stammdaten', { cookies: als(w, w.anna) }));
  assert.ok(s.klassen.some((k: { id: number; name: string; berufsschuleId: number }) => k.id === id && k.name === 'FI-25a' && k.berufsschuleId === w.schule));

  assert.equal((await inKlasse(w, w.anna, id)).status, 200);
  assert.equal(koerper(await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/profil`, { cookies: als(w, w.petra) })).profil.klasseId, id);
  const fremd = koerper(await klasse(w, 'FI-25b', w.andere)).klasse.id as number;
  assert.equal((await inKlasse(w, w.anna, fremd)).status, 400, 'Klasse einer anderen Schule');
  // ohne Angabe bleibt die Klasse (ältere Oberfläche)
  await ruf(w.u, 'PUT', `/api/azubis/${w.anna.id}/profil`, { cookies: als(w, w.petra), body: { ausbildungsbeginn: '2025-08-01', ausbilderId: w.petra.id, berufsschuleId: w.schule } });
  assert.equal(koerper(await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/profil`, { cookies: als(w, w.petra) })).profil.klasseId, id);

  // umbenennen; löschen erst, wenn niemand mehr in der Klasse ist
  assert.equal((await ruf(w.u, 'PATCH', `/api/stammdaten/klassen/${id}`, { cookies: als(w, w.petra), body: { name: 'FI-25A' } })).status, 200);
  assert.equal((await ruf(w.u, 'DELETE', `/api/stammdaten/klassen/${id}`, { cookies: als(w, w.petra) })).status, 409);
  await inKlasse(w, w.anna, null);
  assert.equal((await ruf(w.u, 'DELETE', `/api/stammdaten/klassen/${id}`, { cookies: als(w, w.petra) })).status, 200);
  // nur Ausbilder
  assert.equal((await ruf(w.u, 'POST', '/api/stammdaten/klassen', { cookies: als(w, w.anna), body: { berufsschuleId: w.schule, name: 'X' } })).status, 403);
  assert.equal((await ruf(w.u, 'GET', '/api/schulbloecke', { cookies: als(w, w.anna) })).status, 403);
});

test('Schulblöcke: an der Klasse gepflegt, im Plan aller Azubis der Klasse – mit Glocke', async () => {
  const w = await welt();
  const id = koerper(await klasse(w, 'FI-25a')).klasse.id as number;
  await inKlasse(w, w.anna, id);
  const c = als(w, w.petra);
  // Mittwoch bis Freitag: steht im Plan als ganze Wochen (Montag)
  const neu = await ruf(w.u, 'POST', '/api/schulbloecke', { cookies: c, body: { klasseId: id, von: '2026-11-18', bis: '2026-12-04', titel: '' } });
  assert.equal(neu.status, 201);
  assert.equal(koerper(neu).azubis, 1);
  const block = koerper(neu).schulen[0].klassen[0].bloecke[0];
  assert.deepEqual([block.von, block.bis, block.titel], ['2026-11-16', '2026-11-30', 'Berufsschule']);
  assert.deepEqual((await plan(w, w.anna)).map((e) => [e.von, e.bis, e.titel, e.klasse]), [['2026-11-16', '2026-11-30', 'Berufsschule', 'FI-25a']]);
  assert.equal((await plan(w, w.ben)).length, 0, 'Ben ist in keiner Klasse');
  assert.equal(glocke(w, w.anna, 'plan_neu'), 1);

  // ein neuer Azubi in der Klasse bekommt alle Blöcke
  await inKlasse(w, w.ben, id);
  assert.equal((await plan(w, w.ben)).length, 1);
  assert.equal(glocke(w, w.ben, 'plan_neu'), 1);

  // verschieben: bei allen, mit „Schulblock geändert“ in der Glocke
  await ruf(w.u, 'PUT', `/api/schulbloecke/${block.id}`, { cookies: c, body: { von: '2026-11-23', bis: '2026-12-11', titel: 'Blockunterricht' } });
  for (const a of [w.anna, w.ben]) {
    assert.deepEqual((await plan(w, a)).map((e) => [e.von, e.bis, e.titel]), [['2026-11-23', '2026-12-07', 'Blockunterricht']]);
    assert.equal(glocke(w, a, 'schule_geaendert'), 1);
  }
  // unverändert speichern meldet nichts
  await ruf(w.u, 'PUT', `/api/schulbloecke/${block.id}`, { cookies: c, body: { von: '2026-11-23', bis: '2026-12-11', titel: 'Blockunterricht' } });
  assert.equal(glocke(w, w.anna, 'schule_geaendert'), 1);

  // Ausnahme: im Plan von Ben einzeln geändert – folgt der Klasse nicht mehr
  const benBlock = (await plan(w, w.ben))[0];
  assert.equal((await ruf(w.u, 'PUT', `/api/azubis/${w.ben.id}/plan/${benBlock.id}`, { cookies: c, body: { art: 'schule', von: '2026-11-30', bis: '2026-12-07', titel: 'Blockunterricht (später)' } })).status, 200);
  await ruf(w.u, 'PUT', `/api/schulbloecke/${block.id}`, { cookies: c, body: { von: '2026-11-23', bis: '2026-12-14', titel: 'Blockunterricht' } });
  assert.deepEqual((await plan(w, w.ben)).map((e) => [e.von, e.titel, e.klasse]), [['2026-11-30', 'Blockunterricht (später)', null]]);
  assert.equal((await plan(w, w.anna))[0].bis, '2026-12-14');
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/schulbloecke', { cookies: c })).schulen[0].klassen[0].bloecke[0].ausnahmen, 1);

  // löschen: bei Anna weg, mit Glocke; Bens eigene Fassung bleibt
  await ruf(w.u, 'DELETE', `/api/schulbloecke/${block.id}`, { cookies: c });
  assert.equal((await plan(w, w.anna)).length, 0);
  assert.equal(glocke(w, w.anna, 'schule_geaendert'), 3);
  assert.equal((await plan(w, w.ben)).length, 1);
});

test('Schulblöcke: Klassenwechsel tauscht die Blöcke, ein im Plan gelöschter Block kommt nicht wieder', async () => {
  const w = await welt();
  const a = koerper(await klasse(w, 'FI-25a')).klasse.id as number;
  const b = koerper(await klasse(w, 'FI-25b')).klasse.id as number;
  const c = als(w, w.petra);
  await ruf(w.u, 'POST', '/api/schulbloecke', { cookies: c, body: { klasseId: a, von: '2026-11-16', bis: '2026-11-27', titel: 'Block A' } });
  await ruf(w.u, 'POST', '/api/schulbloecke', { cookies: c, body: { klasseId: b, von: '2026-12-07', bis: '2026-12-18', titel: 'Block B' } });
  await inKlasse(w, w.anna, a);
  assert.deepEqual((await plan(w, w.anna)).map((e) => e.titel), ['Block A']);
  await inKlasse(w, w.anna, b);
  assert.deepEqual((await plan(w, w.anna)).map((e) => e.titel), ['Block B']);

  const eintrag = (await plan(w, w.anna))[0];
  assert.equal((await ruf(w.u, 'DELETE', `/api/azubis/${w.anna.id}/plan/${eintrag.id}`, { cookies: c })).status, 200);
  await ruf(w.u, 'POST', '/api/schulbloecke', { cookies: c, body: { klasseId: b, von: '2027-01-11', bis: '2027-01-22', titel: 'Block B2' } });
  assert.deepEqual((await plan(w, w.anna)).map((e) => e.titel), ['Block B2'], 'der gelöschte Block bleibt weg');

  // ungültige Angaben
  assert.equal((await ruf(w.u, 'POST', '/api/schulbloecke', { cookies: c, body: { klasseId: b, von: '2027-02-01', bis: '2027-01-01' } })).status, 400);
  assert.equal((await ruf(w.u, 'POST', '/api/schulbloecke', { cookies: c, body: { klasseId: b, von: '2027-02-01', bis: '2028-02-01' } })).status, 400);
  assert.equal((await ruf(w.u, 'POST', '/api/schulbloecke', { cookies: c, body: { klasseId: 999, von: '2027-02-01' } })).status, 404);
  assert.equal((await ruf(w.u, 'PUT', '/api/schulbloecke/999', { cookies: c, body: { von: '2027-02-01' } })).status, 404);
  // Azubis sehen in der Übersicht nichts, ein Azubi darf den Block im eigenen Plan nicht ändern
  const b2 = (await plan(w, w.anna))[0];
  assert.equal((await ruf(w.u, 'DELETE', `/api/azubis/${w.anna.id}/plan/${b2.id}`, { cookies: als(w, w.anna) })).status, 403);
});
