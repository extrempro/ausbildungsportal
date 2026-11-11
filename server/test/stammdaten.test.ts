import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BenutzerZeile, Rolle } from '../typen';
import { admin, koerper, konto, ohneWechsel, ruf, sitzung, umgebung, zuweisen } from './hilfe';
import type { Umgebung } from './hilfe';

// „heute“ ist in der Testumgebung der 10.11.2026

function alle(u: Umgebung): Record<Rolle, BenutzerZeile> {
  ohneWechsel(u.db, admin(u.db).id);
  return { admin: admin(u.db), ausbilder: konto(u.db, 'ausbilder'), beauftragter: konto(u.db, 'beauftragter'), azubi: konto(u.db, 'azubi') };
}

async function mitStammdaten(u: Umgebung, w: Record<Rolle, BenutzerZeile>) {
  const cookies = sitzung(u, w.ausbilder);
  const beruf = koerper(await ruf(u, 'POST', '/api/stammdaten/berufe', { cookies, body: { bezeichnung: 'Fachinformatiker/-in', fachrichtung: 'Systemintegration', regeldauerMonate: 36 } })).beruf;
  const lang = koerper(await ruf(u, 'POST', '/api/stammdaten/berufe', { cookies, body: { bezeichnung: 'Mechatroniker/-in', regeldauerMonate: 42 } })).beruf;
  const schule = koerper(await ruf(u, 'POST', '/api/stammdaten/berufsschulen', { cookies, body: { name: 'Berufliche Schule ITECH', ort: 'Hamburg', bundesland: 'HH', form: 'block' } })).berufsschule;
  return { cookies, beruf, lang, schule };
}

test('Stammdaten lesen alle Fachrollen, ändern nur Ausbilder; der Super-Admin kommt nicht heran', async () => {
  const u = await umgebung();
  const w = alle(u);
  const { beruf, schule } = await mitStammdaten(u, w);
  for (const rolle of ['ausbilder', 'beauftragter', 'azubi'] as const) {
    const s = koerper(await ruf(u, 'GET', '/api/stammdaten', { cookies: sitzung(u, w[rolle]) }));
    assert.equal(s.berufe.length, 2, rolle);
    assert.equal(s.berufsschulen[0].name, 'Berufliche Schule ITECH');
    assert.equal(s.bundeslaender.length, 16);
    assert.equal(s.ausbilder.length, rolle === 'ausbilder' ? 1 : 0, 'Ausbilder-Liste nur für Ausbilder');
  }
  assert.equal((await ruf(u, 'GET', '/api/stammdaten', { cookies: sitzung(u, w.admin) })).status, 403);
  for (const rolle of ['admin', 'beauftragter', 'azubi'] as const) {
    const cookies = sitzung(u, w[rolle]);
    assert.equal((await ruf(u, 'PUT', '/api/stammdaten/betrieb', { cookies, body: { name: 'X' } })).status, 403, rolle);
    assert.equal((await ruf(u, 'POST', '/api/stammdaten/berufe', { cookies, body: { bezeichnung: 'X', regeldauerMonate: 36 } })).status, 403, rolle);
    assert.equal((await ruf(u, 'PATCH', `/api/stammdaten/berufe/${beruf.id}`, { cookies, body: { bezeichnung: 'X', regeldauerMonate: 36 } })).status, 403, rolle);
    assert.equal((await ruf(u, 'DELETE', `/api/stammdaten/berufsschulen/${schule.id}`, { cookies })).status, 403, rolle);
  }
});

test('Betrieb speichern; Eingaben werden geprüft', async () => {
  const u = await umgebung();
  const w = alle(u);
  const cookies = sitzung(u, w.ausbilder);
  const ok = await ruf(u, 'PUT', '/api/stammdaten/betrieb', { cookies, body: { name: ' Muster GmbH ', anschrift: 'Hafenstraße 1\n20457 Hamburg', bundesland: 'HH' } });
  assert.equal(ok.status, 200);
  assert.deepEqual(koerper(await ruf(u, 'GET', '/api/stammdaten', { cookies })).betrieb, { name: 'Muster GmbH', anschrift: 'Hafenstraße 1, 20457 Hamburg', bundesland: 'HH', personalMail: '' });
  assert.equal((await ruf(u, 'PUT', '/api/stammdaten/betrieb', { cookies, body: { name: 'X', bundesland: 'XX' } })).status, 400);
  assert.equal((await ruf(u, 'PUT', '/api/stammdaten/betrieb', { cookies, body: { name: 'X'.repeat(151) } })).status, 400);

  const beruf = (body: unknown) => ruf(u, 'POST', '/api/stammdaten/berufe', { cookies, body });
  assert.equal((await beruf({ bezeichnung: '', regeldauerMonate: 36 })).status, 400);
  assert.equal((await beruf({ bezeichnung: 'X', regeldauerMonate: 6 })).status, 400);
  assert.equal((await beruf({ bezeichnung: 'X', regeldauerMonate: 36.5 })).status, 400);
  assert.equal((await beruf({ bezeichnung: 'X', regeldauerMonate: '42' })).status, 201, 'Zahl als Text aus dem Formular');
  const schule = (body: unknown) => ruf(u, 'POST', '/api/stammdaten/berufsschulen', { cookies, body });
  assert.equal((await schule({ name: 'S', bundesland: 'Hamburg', form: 'block' })).status, 400, 'Kürzel, nicht Name');
  assert.equal((await schule({ name: 'S', bundesland: 'HH', form: 'abends' })).status, 400);
  assert.equal((await ruf(u, 'PATCH', '/api/stammdaten/berufe/99999', { cookies, body: { bezeichnung: 'X', regeldauerMonate: 36 } })).status, 404);
});

test('Profil: Ausbilder speichert, Stand wird berechnet; zugeordnete Berufe und Schulen lassen sich nicht löschen', async () => {
  const u = await umgebung();
  const w = alle(u);
  const { cookies, beruf, lang, schule } = await mitStammdaten(u, w);
  const pfad = `/api/azubis/${w.azubi.id}/profil`;

  const leer = koerper(await ruf(u, 'GET', pfad, { cookies }));
  assert.equal(leer.stand.phase, 'offen');
  assert.equal(leer.profil.wochenstunden, 40);
  assert.equal(leer.bearbeitbar, true);

  const gespeichert = await ruf(u, 'PUT', pfad, {
    cookies,
    body: { berufId: beruf.id, berufsschuleId: schule.id, ausbilderId: w.ausbilder.id, ausbildungsbeginn: '2025-08-01', verkuerzungMonate: 6, verkuerzungArt: 'ende', verkuerzungGrund: 'Abitur', wochenstunden: '38.5', vorzeitigeZulassung: true },
  });
  assert.equal(gespeichert.status, 200);
  const p = koerper(await ruf(u, 'GET', pfad, { cookies }));
  assert.deepEqual([p.stand.phase, p.stand.ausbildungsjahr, p.stand.ende, p.stand.monate], ['laufend', 2, '2028-01-31', 30]);
  assert.equal(p.beruf.bezeichnung, 'Fachinformatiker/-in');
  assert.equal(p.berufsschule.bundesland, 'HH');
  assert.equal(p.ausbilder.anzeigename, w.ausbilder.anzeigename);
  assert.deepEqual([p.profil.wochenstunden, p.profil.vorzeitigeZulassung, p.hoechsteVerkuerzung], [38.5, true, 24]);

  // anderer Beruf mit 42 Monaten → späteres Ende
  await ruf(u, 'PUT', pfad, { cookies, body: { berufId: lang.id, ausbildungsbeginn: '2025-08-01' } });
  assert.equal(koerper(await ruf(u, 'GET', pfad, { cookies })).stand.ende, '2029-01-31');

  const liste = koerper(await ruf(u, 'GET', '/api/azubis', { cookies })).azubis;
  assert.deepEqual([liste[0].beruf, liste[0].ausbildungsjahr, liste[0].ende], ['Mechatroniker/-in', 2, '2029-01-31']);

  assert.equal((await ruf(u, 'DELETE', `/api/stammdaten/berufe/${lang.id}`, { cookies })).status, 409);
  assert.equal((await ruf(u, 'DELETE', `/api/stammdaten/berufe/${beruf.id}`, { cookies })).status, 200);
  await ruf(u, 'PUT', pfad, { cookies, body: { berufsschuleId: schule.id } });
  assert.equal((await ruf(u, 'DELETE', `/api/stammdaten/berufsschulen/${schule.id}`, { cookies })).status, 409);
});

test('Profil: Eingaben werden geprüft, bei Fehler bleibt das Profil unverändert', async () => {
  const u = await umgebung();
  const w = alle(u);
  const { cookies, beruf } = await mitStammdaten(u, w);
  const pfad = `/api/azubis/${w.azubi.id}/profil`;
  await ruf(u, 'PUT', pfad, { cookies, body: { berufId: beruf.id, ausbildungsbeginn: '2025-08-01' } });
  const falsch: Record<string, unknown>[] = [
    { berufId: 99999 },
    { berufsschuleId: 99999 },
    { ausbilderId: w.beauftragter.id },
    { ausbildungsbeginn: '01.08.2025' },
    { ausbildungsbeginn: '2025-08-01', vertragsende: '2025-07-31' },
    { ausbildungsbeginn: '2025-08-01', vertragsende: '2062-07-31' },
    { vertragsende: '2028-07-31' },
    { berufId: beruf.id, verkuerzungMonate: 25 },
    { verkuerzungMonate: -1 },
    { verkuerzungArt: 'mitte' },
    { wochenstunden: 0 },
    { wochenstunden: 'viel' },
    { verkuerzungGrund: 'x'.repeat(201) },
  ];
  for (const body of falsch) assert.equal((await ruf(u, 'PUT', pfad, { cookies, body })).status, 400, JSON.stringify(body));
  const p = koerper(await ruf(u, 'GET', pfad, { cookies }));
  assert.deepEqual([p.profil.berufId, p.profil.ausbildungsbeginn], [beruf.id, '2025-08-01']);
});

test('Profil: wer es sehen und ändern darf – fremde Azubis sehen aus wie unbekannte', async () => {
  const u = await umgebung();
  const w = alle(u);
  const ben = konto(u.db, 'azubi');
  const fremd = konto(u.db, 'beauftragter');
  zuweisen(u.db, w.azubi, w.beauftragter);
  const lesen = (wer: BenutzerZeile, id: number | string) => ruf(u, 'GET', `/api/azubis/${id}/profil`, { cookies: sitzung(u, wer) });
  assert.equal((await lesen(w.ausbilder, w.azubi.id)).status, 200);
  assert.equal((await lesen(w.azubi, w.azubi.id)).status, 200);
  const beimBeauftragten = await lesen(w.beauftragter, w.azubi.id);
  assert.equal(beimBeauftragten.status, 200);
  assert.equal(koerper(beimBeauftragten).bearbeitbar, false);
  assert.equal(koerper(await lesen(w.azubi, w.azubi.id)).bearbeitbar, false);
  for (const [wer, id] of [[w.azubi, ben.id], [w.beauftragter, ben.id], [fremd, w.azubi.id], [w.ausbilder, w.beauftragter.id], [w.ausbilder, 99999], [w.ausbilder, 'x']] as const) {
    assert.equal((await lesen(wer, id)).status, 404, `${wer.rolle} → ${id}`);
  }
  assert.equal((await lesen(w.admin, w.azubi.id)).status, 403, 'Super-Admin sieht keine Azubi-Daten');

  const body = { ausbildungsbeginn: '2025-08-01' };
  for (const wer of [w.azubi, w.beauftragter, w.admin]) {
    assert.equal((await ruf(u, 'PUT', `/api/azubis/${w.azubi.id}/profil`, { cookies: sitzung(u, wer), body })).status, 403, wer.rolle);
  }
  assert.equal((await ruf(u, 'PUT', `/api/azubis/${w.beauftragter.id}/profil`, { cookies: sitzung(u, w.ausbilder), body })).status, 404, 'Ziel ist kein Azubi');
});

test('Löschen eines Kontos nimmt das Profil mit; gelöschter Ausbilder wird im Profil ausgetragen', async () => {
  const u = await umgebung();
  const w = alle(u);
  const zweiter = konto(u.db, 'ausbilder');
  const cookies = sitzung(u, w.ausbilder);
  await ruf(u, 'PUT', `/api/azubis/${w.azubi.id}/profil`, { cookies, body: { ausbilderId: zweiter.id, ausbildungsbeginn: '2025-08-01' } });
  assert.equal((await ruf(u, 'DELETE', `/api/konten/${zweiter.id}`, { cookies: sitzung(u, w.admin) })).status, 200);
  const p = koerper(await ruf(u, 'GET', `/api/azubis/${w.azubi.id}/profil`, { cookies }));
  assert.equal(p.profil.ausbilderId, null);
  assert.equal(p.profil.ausbildungsbeginn, '2025-08-01');
  assert.equal((await ruf(u, 'DELETE', `/api/konten/${w.azubi.id}`, { cookies })).status, 200);
  assert.equal((u.db.prepare('SELECT COUNT(*) AS n FROM azubi_profil').get() as { n: number }).n, 0);
});

test('Kalender: Feiertage nach Bundesland, Ferien aus der Datei, Zeitraum begrenzt', async () => {
  const u = await umgebung();
  const w = alle(u);
  const cookies = sitzung(u, w.azubi);
  const hh = koerper(await ruf(u, 'GET', '/api/kalender?bundesland=HH&von=2026-10-01&bis=2026-12-31', { cookies }));
  assert.deepEqual(hh.feiertage.map((f: { datum: string }) => f.datum), ['2026-10-03', '2026-10-31', '2026-12-25', '2026-12-26']);
  assert.equal(hh.ferien.vorhanden, true);
  assert.ok(hh.ferien.zeiten.some((z: { name: string }) => z.name === 'Herbstferien'));
  const by = koerper(await ruf(u, 'GET', '/api/kalender?bundesland=BY&von=2026-10-01&bis=2026-12-31', { cookies }));
  assert.ok(by.feiertage.some((f: { name: string }) => f.name === 'Allerheiligen'));
  assert.equal(by.ferien.vorhanden, false, 'für Bayern ist keine Feriendatei hinterlegt');
  assert.deepEqual(by.ferien.zeiten, []);
  for (const q of ['bundesland=XX&von=2026-01-01&bis=2026-12-31', 'bundesland=HH&von=2026-12-31&bis=2026-01-01', 'bundesland=HH&von=2020-01-01&bis=2030-01-01', 'bundesland=HH', 'bundesland=../HH&von=2026-01-01&bis=2026-12-31']) {
    assert.equal((await ruf(u, 'GET', `/api/kalender?${q}`, { cookies })).status, 400, q);
  }
  assert.equal((await ruf(u, 'GET', '/api/kalender?bundesland=HH&von=2026-01-01&bis=2026-12-31', { cookies: sitzung(u, w.admin) })).status, 403);
});

test('Änderungen an Stammdaten und Profil stehen im Protokoll', async () => {
  const u = await umgebung();
  const w = alle(u);
  const { cookies } = await mitStammdaten(u, w);
  await ruf(u, 'PUT', `/api/azubis/${w.azubi.id}/profil`, { cookies, body: { ausbildungsbeginn: '2025-08-01' } });
  const protokoll = koerper(await ruf(u, 'GET', '/api/protokoll', { cookies: sitzung(u, w.admin) })).eintraege as { aktion: string; ziel_name: string }[];
  assert.ok(protokoll.some((e) => e.aktion === 'profil_geaendert' && e.ziel_name === w.azubi.anzeigename));
  assert.ok(protokoll.some((e) => e.aktion === 'stammdaten_geaendert'));
});
