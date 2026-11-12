import assert from 'node:assert/strict';
import { test } from 'node:test';
import { admin, koerper, konto, ohneWechsel, ruf, sitzung, umgebung, zuweisen } from './hilfe';

// „heute“ ist in der Testumgebung Dienstag, der 10.11.2026.
const PFAD = '/api/stammdaten/firmentermine';

test('Firmentermine: Ausbilder pflegen sie; alle Fachrollen sehen sie im Plan und im Jahreskalender – sonst nirgends', async () => {
  const u = await umgebung();
  ohneWechsel(u.db, admin(u.db).id);
  const petra = konto(u.db, 'ausbilder', 'Petra Lang');
  const bea = konto(u.db, 'beauftragter', 'Bea Auft');
  const anna = konto(u.db, 'azubi', 'Anna Azubi');
  const als = (wer: typeof petra) => sitzung(u, wer);
  await ruf(u, 'PUT', '/api/stammdaten/betrieb', { cookies: als(petra), body: { name: 'Muster GmbH', bundesland: 'HH' } });
  await ruf(u, 'PUT', `/api/azubis/${anna.id}/profil`, { cookies: als(petra), body: { ausbildungsbeginn: '2025-08-01', ausbilderId: petra.id } });
  await ruf(u, 'PUT', '/api/ich/unterschrift', { cookies: als(anna), body: { pfad: 'M10 10 L20 20 L30 10 L40 20 L50 10 L60 20' } });
  zuweisen(u.db, anna, bea);
  const stamm = async (wer = petra) => koerper(await ruf(u, 'GET', '/api/stammdaten', { cookies: als(wer) })).firmentermine;
  assert.deepEqual(await stamm(), []);

  // anlegen: nur Ausbilder; Eingaben werden geprüft
  for (const wer of [bea, anna, admin(u.db)]) assert.equal((await ruf(u, 'POST', PFAD, { cookies: als(wer), body: { titel: 'x', von: '2026-12-24' } })).status, 403, wer.rolle);
  assert.equal((await ruf(u, 'POST', PFAD, { body: { titel: 'x', von: '2026-12-24' } })).status, 401);
  const falsch: [unknown, RegExp][] = [
    [{ titel: '', von: '2026-12-24' }, /Der Titel fehlt/],
    [{ titel: 'x'.repeat(101), von: '2026-12-24' }, /zu lang/],
    [{ titel: 'Schließung' }, /erste Tag fehlt/],
    [{ titel: 'Schließung', von: '2026-02-30' }, /kein gültiges Datum/],
    [{ titel: 'Schließung', von: '2026-12-24', bis: '2026-12-23' }, /letzte Tag liegt vor dem ersten/],
    [{ titel: 'Schließung', von: '2026-12-24', bis: '2028-12-24' }, /länger als ein Jahr/],
    [{ titel: 'Schließung', von: '2026-12-24', hinweis: 'x'.repeat(201) }, /Hinweis ist zu lang/],
    ['Schließung', /Anfrage ohne gültige Daten/],
  ];
  for (const [body, grund] of falsch) {
    const r = await ruf(u, 'POST', PFAD, { cookies: als(petra), body });
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.match(koerper(r).fehler, grund);
  }
  const neu = await ruf(u, 'POST', PFAD, { cookies: als(petra), body: { titel: '  Betrieb   geschlossen\n', von: '2026-12-24', bis: '2027-01-01', hinweis: 'Notdienst über die Zentrale' } });
  assert.equal(neu.status, 201);
  assert.deepEqual(koerper(neu).firmentermine, [{ id: 1, titel: 'Betrieb geschlossen', von: '2026-12-24', bis: '2027-01-01', hinweis: 'Notdienst über die Zentrale' }]);
  // ohne „bis“ ist es ein einzelner Tag; die Liste ist nach Datum geordnet
  assert.equal((await ruf(u, 'POST', PFAD, { cookies: als(petra), body: { titel: 'Betriebsversammlung', von: '2026-11-18', bis: '' } })).status, 201);
  assert.deepEqual((await stamm(anna)).map((t: { titel: string; von: string; bis: string }) => [t.titel, t.von, t.bis]), [['Betriebsversammlung', '2026-11-18', '2026-11-18'], ['Betrieb geschlossen', '2026-12-24', '2027-01-01']]);

  // im Ausbildungsplan: für den Azubi und für die, die ihn betreuen
  for (const wer of [anna, petra, bea]) {
    const plan = koerper(await ruf(u, 'GET', `/api/azubis/${anna.id}/plan`, { cookies: als(wer) }));
    assert.deepEqual(plan.firmentermine.map((t: { titel: string }) => t.titel), ['Betriebsversammlung', 'Betrieb geschlossen'], wer.rolle);
  }
  // im Jahreskalender: je Jahr, was das Jahr berührt
  const jahr = async (j: number, wer = anna) => koerper(await ruf(u, 'GET', `/api/jahreskalender?jahr=${j}`, { cookies: als(wer) })).firmentermine.map((t: { titel: string }) => t.titel);
  assert.deepEqual(await jahr(2026), ['Betriebsversammlung', 'Betrieb geschlossen']);
  assert.deepEqual(await jahr(2027, bea), ['Betrieb geschlossen']);
  assert.deepEqual(await jahr(2028, petra), []);

  // reine Übersicht: nichts davon im Berichtsheft, keine Glocke, keine Benachrichtigung
  const bericht = koerper(await ruf(u, 'GET', `/api/azubis/${anna.id}/berichte/2026-11-16`, { cookies: als(anna) }));
  assert.ok(!JSON.stringify(bericht).includes('Betriebsversammlung'));
  assert.deepEqual(bericht.inhalt.abwesenheit, []);
  assert.equal(koerper(await ruf(u, 'GET', '/api/aktivitaeten', { cookies: als(anna) })).neu, 0);
  assert.equal((u.db.prepare('SELECT COUNT(*) AS n FROM benachrichtigung_warte').get() as { n: number }).n, 0);

  // ändern und löschen: nur Ausbilder
  assert.equal((await ruf(u, 'PATCH', `${PFAD}/2`, { cookies: als(bea), body: { titel: 'x', von: '2026-11-18' } })).status, 403);
  assert.equal((await ruf(u, 'DELETE', `${PFAD}/2`, { cookies: als(anna) })).status, 403);
  assert.equal((await ruf(u, 'PATCH', `${PFAD}/99`, { cookies: als(petra), body: { titel: 'x', von: '2026-11-18' } })).status, 404);
  const geaendert = await ruf(u, 'PATCH', `${PFAD}/2`, { cookies: als(petra), body: { titel: 'Betriebsversammlung', von: '2026-11-19', hinweis: 'Kantine, 10 Uhr' } });
  assert.deepEqual([geaendert.status, koerper(geaendert).firmentermine[0]], [200, { id: 2, titel: 'Betriebsversammlung', von: '2026-11-19', bis: '2026-11-19', hinweis: 'Kantine, 10 Uhr' }]);
  assert.equal((await ruf(u, 'DELETE', `${PFAD}/2`, { cookies: als(petra) })).status, 200);
  assert.equal((await ruf(u, 'DELETE', `${PFAD}/2`, { cookies: als(petra) })).status, 404);
  assert.deepEqual(await jahr(2026), ['Betrieb geschlossen']);
  // jede Änderung steht im Protokoll der Stammdaten
  const protokoll = (u.db.prepare("SELECT detail FROM protokoll WHERE aktion = 'stammdaten_geaendert' AND detail LIKE 'Firmentermin%' ORDER BY id").all() as { detail: string }[]).map((z) => z.detail);
  assert.deepEqual(protokoll, ['Firmentermin angelegt: Betrieb geschlossen (2026-12-24 bis 2027-01-01)', 'Firmentermin angelegt: Betriebsversammlung (2026-11-18)', 'Firmentermin geändert: Betriebsversammlung (2026-11-19)', 'Firmentermin gelöscht: Betriebsversammlung (2026-11-19)']);
});
