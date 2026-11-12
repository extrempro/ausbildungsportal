import assert from 'node:assert/strict';
import { test } from 'node:test';
import { naechstesTeilAm, stufeAm } from '../begleiter';
import { erinnerungenAm } from '../begleiter-erinnerung';
import type { BenutzerZeile } from '../typen';
import { admin, koerper, konto, ohneWechsel, ruf, sitzung, umgebung, zuweisen } from './hilfe';

test('Stufen: neun Teile gleichmäßig über die Ausbildungszeit, das letzte am Ende – nur die Zeit zählt', () => {
  // drei Jahre: alle vier Monate
  const [b, e] = ['2024-08-01', '2027-07-31'];
  assert.equal(stufeAm(b, e, '2024-07-31'), 0, 'vor dem Beginn');
  assert.equal(stufeAm(b, e, '2024-08-01'), 0);
  assert.equal(stufeAm(b, e, '2024-11-30'), 0);
  assert.equal(stufeAm(b, e, '2024-12-01'), 1, 'nach vier Monaten');
  assert.equal(stufeAm(b, e, '2025-08-01'), 3, 'nach einem Jahr');
  assert.equal(stufeAm(b, e, '2026-08-01'), 6, 'nach zwei Jahren');
  assert.equal(stufeAm(b, e, '2027-07-30'), 8, 'kurz vor dem Ende fehlt nur der Abschlusshut');
  assert.equal(stufeAm(b, e, '2027-07-31'), 9, 'am letzten Tag');
  assert.equal(stufeAm(b, e, '2030-01-01'), 9);
  // zwei Jahre: kürzere Abstände, trotzdem alle neun Teile
  assert.equal(stufeAm('2025-08-01', '2027-07-31', '2025-10-20'), 0);
  assert.equal(stufeAm('2025-08-01', '2027-07-31', '2025-10-22'), 1, 'nach knapp drei Monaten');
  assert.equal(stufeAm('2025-08-01', '2027-07-31', '2027-07-31'), 9);
  // dreieinhalb Jahre
  assert.equal(stufeAm('2024-08-01', '2028-01-31', '2024-12-21'), 1, 'nach gut viereinhalb Monaten');
  assert.equal(stufeAm('2024-08-01', '2028-01-31', '2024-12-20'), 0);
  // ohne Zeiten kein Zubehör
  assert.equal(stufeAm(null, e, '2026-01-01'), 0);
  assert.equal(stufeAm(b, null, '2026-01-01'), 0);
  assert.equal(stufeAm(e, b, '2026-01-01'), 0, 'Ende vor Beginn');
  // der Tag des nächsten Teils ist genau der, an dem die Stufe steigt
  for (const tag of ['2024-08-01', '2025-03-15', '2026-11-12', '2027-07-01']) {
    const n = naechstesTeilAm(b, e, tag)!;
    assert.equal(stufeAm(b, e, n), stufeAm(b, e, tag) + 1, tag);
    assert.equal(stufeAm(b, e, new Date(Date.parse(n) - 86_400_000).toISOString().slice(0, 10)), stufeAm(b, e, tag), tag);
  }
  assert.equal(naechstesTeilAm(b, e, '2027-07-01'), '2027-07-31', 'der Abschlusshut kommt am letzten Tag');
  assert.equal(naechstesTeilAm(b, e, '2027-08-01'), null);
  assert.equal(naechstesTeilAm(null, null, '2026-01-01'), null);
});

async function welt() {
  const u = await umgebung();
  ohneWechsel(u.db, admin(u.db).id);
  const ausbilder = konto(u.db, 'ausbilder', 'Petra Lang');
  const bea = konto(u.db, 'beauftragter', 'Bea Auft');
  const anna = konto(u.db, 'azubi', 'Anna Azubi');
  const ben = konto(u.db, 'azubi', 'Ben Beispiel');
  const als = (wer: BenutzerZeile) => sitzung(u, wer);
  const tag = (d: number) => new Date(u.uhr.jetzt.getTime() + d * 86_400_000).toISOString().slice(0, 10);
  // Anna ist seit gut 20 Monaten dabei (von 36)
  assert.equal((await ruf(u, 'PUT', `/api/azubis/${anna.id}/profil`, { cookies: als(ausbilder), body: { ausbildungsbeginn: tag(-620), vertragsende: tag(475), ausbilderId: ausbilder.id } })).status, 200);
  zuweisen(u.db, anna, bea);
  return { u, ausbilder, bea, anna, ben, als, chef: admin(u.db) };
}

test('Begleiter: aussuchen, benennen, ausschalten – und die Teile kommen mit der Zeit', async () => {
  const w = await welt();
  const c = w.als(w.anna);
  const hol = async (wer = w.anna) => koerper(await ruf(w.u, 'GET', '/api/begleiter', { cookies: w.als(wer) }));
  assert.deepEqual(await hol(), { erlaubt: true, gefragt: false, an: false, figur: '', name: '', stufe: 5, gezeigt: 0, naechstesAm: (await hol()).naechstesAm, ohneZeit: false, erinnernAus: [] });
  assert.match((await hol()).naechstesAm, /^\d{4}-\d\d-\d\d$/);

  // einschalten braucht Figur und Namen
  const setze = (body: Record<string, unknown>, wer = w.anna) => ruf(w.u, 'PUT', '/api/begleiter', { cookies: w.als(wer), body });
  assert.equal((await setze({ an: true })).status, 400);
  assert.equal((await setze({ an: true, figur: 'kaktus', name: 'Kalle' })).status, 400, 'unbekannte Figur');
  assert.equal((await setze({ an: true, figur: 'biber', name: '' })).status, 400);
  assert.equal((await setze({ an: true, figur: 'biber', name: 'x'.repeat(21) })).status, 400);
  assert.equal((await setze({ figur: 'biber' })).status, 400, '„an“ fehlt');
  const neu = koerper(await setze({ an: true, figur: 'biber', name: ' Bruno ' }));
  assert.deepEqual([neu.an, neu.gefragt, neu.figur, neu.name, neu.stufe, neu.gezeigt], [true, true, 'biber', 'Bruno', 5, 0]);

  // die Animation wird je Stufe einmal gezeigt; mehr als die erreichte Stufe geht nicht
  const feier = (stufe: unknown) => ruf(w.u, 'POST', '/api/begleiter/gefeiert', { cookies: c, body: { stufe } });
  assert.equal(koerper(await feier(3)).gezeigt, 3);
  assert.equal(koerper(await feier(2)).gezeigt, 3, 'geht nicht zurück');
  assert.equal(koerper(await feier(9)).gezeigt, 5, 'höchstens die erreichte Stufe');
  assert.equal((await feier(10)).status, 400);
  assert.equal((await feier('x')).status, 400);

  // Figur und Name ändern, ausschalten, wieder einschalten: nichts geht verloren
  assert.equal(koerper(await setze({ an: true, figur: 'pinguin' })).figur, 'pinguin');
  const aus = koerper(await setze({ an: false }));
  assert.deepEqual([aus.an, aus.gefragt, aus.figur, aus.name, aus.gezeigt], [false, true, 'pinguin', 'Bruno', 5]);
  assert.equal(koerper(await setze({ an: true })).an, true);

  // ablehnen: gefragt, aber aus – und ohne Figur
  const nein = koerper(await setze({ an: false }, w.ben));
  assert.deepEqual([nein.an, nein.gefragt, nein.figur], [false, true, '']);
  assert.equal((await ruf(w.u, 'POST', '/api/begleiter/gefeiert', { cookies: w.als(w.ben), body: { stufe: 0 } })).status, 200);
  // Ben hat keinen Ausbildungsbeginn: Stufe 0, kein nächstes Teil
  assert.deepEqual([(await hol(w.ben)).stufe, (await hol(w.ben)).naechstesAm, (await hol(w.ben)).ohneZeit], [0, null, true]);
});

test('Begleiter ist privat: nur der Azubi selbst – Ausbilder, Beauftragte und Super-Admin sehen nichts davon', async () => {
  const w = await welt();
  await ruf(w.u, 'PUT', '/api/begleiter', { cookies: w.als(w.anna), body: { an: true, figur: 'fuchs', name: 'Geheimfuchs' } });
  for (const wer of [w.ausbilder, w.bea, w.chef]) {
    assert.equal((await ruf(w.u, 'GET', '/api/begleiter', { cookies: w.als(wer) })).status, 403, wer.rolle);
    assert.equal((await ruf(w.u, 'PUT', '/api/begleiter', { cookies: w.als(wer), body: { an: false } })).status, 403, wer.rolle);
  }
  assert.equal((await ruf(w.u, 'GET', '/api/begleiter')).status, 401);
  for (const pfad of [`/api/azubis/${w.anna.id}/profil`, `/api/azubis/${w.anna.id}/plan`, '/api/azubis', '/api/aktivitaeten']) {
    assert.equal(JSON.stringify((await ruf(w.u, 'GET', pfad, { cookies: w.als(w.ausbilder) })).body).includes('Geheimfuchs'), false, pfad);
  }
  assert.equal(JSON.stringify((await ruf(w.u, 'GET', '/api/protokoll', { cookies: w.als(w.chef) })).body).includes('Geheimfuchs'), false, 'auch nicht im Protokoll');
  // jeder Azubi hat seinen eigenen
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/begleiter', { cookies: w.als(w.ben) })).name, '');
});

test('Super-Admin schaltet den Begleiter für das ganze Portal aus und wieder ein', async () => {
  const w = await welt();
  await ruf(w.u, 'PUT', '/api/begleiter', { cookies: w.als(w.anna), body: { an: true, figur: 'eule', name: 'Uhu' } });
  const schalter = (wer: BenutzerZeile, an?: boolean) => ruf(w.u, an === undefined ? 'GET' : 'PUT', '/api/begleiter/einstellung', { cookies: w.als(wer), body: an === undefined ? undefined : { an } });
  assert.deepEqual(koerper(await schalter(w.chef)), { an: true }, 'anfangs an');
  for (const wer of [w.ausbilder, w.bea, w.anna]) {
    assert.equal((await schalter(wer)).status, 403, wer.rolle);
    assert.equal((await schalter(wer, false)).status, 403, wer.rolle);
  }
  assert.equal((await ruf(w.u, 'PUT', '/api/begleiter/einstellung', { cookies: w.als(w.chef), body: {} })).status, 400);
  assert.deepEqual(koerper(await schalter(w.chef, false)), { an: false });
  const anna = koerper(await ruf(w.u, 'GET', '/api/begleiter', { cookies: w.als(w.anna) }));
  assert.deepEqual([anna.erlaubt, anna.an, anna.name], [false, true, 'Uhu'], 'die Wahl bleibt gespeichert, die Oberfläche zeigt nichts');
  assert.equal((await ruf(w.u, 'PUT', '/api/begleiter', { cookies: w.als(w.ben), body: { an: true, figur: 'biber', name: 'Bo' } })).status, 409);
  assert.equal((await ruf(w.u, 'PUT', '/api/begleiter', { cookies: w.als(w.ben), body: { an: false } })).status, 200, 'ablehnen geht immer');
  assert.deepEqual(koerper(await schalter(w.chef, true)), { an: true });
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/begleiter', { cookies: w.als(w.anna) })).erlaubt, true);
});

test('Erinnerungen: was ansteht, jede Art einzeln abschaltbar, nur für den Azubi selbst', async () => {
  const w = await welt();
  const { db } = w.u;
  const jetzt = w.u.uhr.jetzt.toISOString();
  // die Uhr der Tests steht auf Dienstag, 10.11.2026 (KW 46)
  const arten = (tag: string, aus: string[] = [], wer = w.anna) => erinnerungenAm(w.u.k, wer.id, tag, aus).map((e) => e.art);
  const eine = (tag: string, art: string) => erinnerungenAm(w.u.k, w.anna.id, tag).find((e) => e.art === art);

  // Anna hat noch nichts geschrieben und keine Unterschrift
  assert.deepEqual(arten('2026-11-10'), ['bericht_alt', 'unterschrift']);
  assert.match(eine('2026-11-10', 'bericht_alt')!.text, /^Dir fehlen noch \d+ Berichte aus vergangenen Wochen\.$/);
  assert.equal(eine('2026-11-10', 'bericht_alt')!.zu, '/berichtsheft');
  assert.equal(eine('2026-11-10', 'unterschrift')!.zu, '/konto');
  // Mittwoch noch nicht, ab Donnerstag die laufende Woche – jeden Tag mit eigenem Schlüssel
  assert.equal(arten('2026-11-11').includes('bericht_woche'), false);
  assert.deepEqual(arten('2026-11-12'), ['bericht_woche', 'bericht_alt', 'unterschrift']);
  assert.match(eine('2026-11-12', 'bericht_woche')!.text, /KW 46/);
  assert.equal(eine('2026-11-12', 'bericht_woche')!.zu, '/berichtsheft/2026-11-09');
  assert.notEqual(eine('2026-11-12', 'bericht_woche')!.schluessel, eine('2026-11-13', 'bericht_woche')!.schluessel);
  // vergangene Wochen: derselbe Schlüssel die ganze Woche, in der nächsten ein neuer
  assert.equal(eine('2026-11-10', 'bericht_alt')!.schluessel, eine('2026-11-15', 'bericht_alt')!.schluessel);
  assert.notEqual(eine('2026-11-10', 'bericht_alt')!.schluessel, eine('2026-11-16', 'bericht_alt')!.schluessel);

  // Unterschrift da, alle alten Wochen abgezeichnet bis auf KW 45, die laufende eingereicht
  db.prepare('INSERT INTO unterschrift (benutzer_id, pfad, geaendert) VALUES (?, ?, ?)').run(w.anna.id, 'M1 1L2 2', jetzt);
  const bericht = (montag: string, status: string) => db.prepare("INSERT INTO bericht (azubi_id, montag, status, geaendert) VALUES (?, ?, ?, ?) ON CONFLICT(azubi_id, montag) DO UPDATE SET status = excluded.status").run(w.anna.id, montag, status, jetzt);
  for (let m = new Date('2025-02-24T00:00:00Z'); m.toISOString().slice(0, 10) < '2026-11-02'; m = new Date(m.getTime() + 7 * 86_400_000)) bericht(m.toISOString().slice(0, 10), 'abgezeichnet');
  bericht('2026-11-09', 'eingereicht');
  assert.deepEqual(arten('2026-11-13'), ['bericht_alt']);
  assert.equal(eine('2026-11-13', 'bericht_alt')!.text, 'Der Bericht für KW 45 fehlt noch.');
  assert.equal(eine('2026-11-13', 'bericht_alt')!.zu, '/berichtsheft/2026-11-02');
  // ein Entwurf zählt noch nicht als geschrieben
  bericht('2026-11-02', 'entwurf');
  assert.deepEqual(arten('2026-11-13'), ['bericht_alt']);
  // zurückgegeben steht vorn
  bericht('2026-11-02', 'zurueck');
  assert.deepEqual(arten('2026-11-13'), ['bericht_zurueck']);
  assert.match(eine('2026-11-13', 'bericht_zurueck')!.text, /^Dein Bericht für KW 45 kam zurück\./);
  bericht('2026-11-02', 'abgezeichnet');
  assert.deepEqual(arten('2026-11-13'), []);

  // Berufsschule: ab Freitag, wenn sie nächste Woche beginnt – nicht, wenn sie schon läuft
  const schule = (von: string, bis: string) => db.prepare("INSERT INTO plan_eintrag (azubi_id, art, von, bis, titel, geaendert) VALUES (?, 'schule', ?, ?, 'Blockunterricht', ?)").run(w.anna.id, von, bis, jetzt);
  schule('2026-11-16', '2026-11-23');
  assert.deepEqual(arten('2026-11-12'), [], 'Donnerstag ist noch zu früh');
  assert.deepEqual(arten('2026-11-13'), ['schule']);
  assert.deepEqual(arten('2026-11-15'), ['schule'], 'auch am Sonntag');
  assert.equal(eine('2026-11-13', 'schule')!.schluessel, eine('2026-11-15', 'schule')!.schluessel, 'nur einmal');
  assert.equal(arten('2026-11-20').includes('schule'), false, 'in der zweiten Schulwoche nicht noch einmal');

  // Firmentermin: zwei Tage und einen Tag vorher derselbe Schlüssel; am Tag selbst nicht mehr
  db.prepare("INSERT INTO firmentermin (titel, von, bis, erstellt) VALUES ('Betriebsversammlung', '2026-12-03', '2026-12-03', ?)").run(jetzt);
  bericht('2026-11-16', 'abgezeichnet');
  bericht('2026-11-23', 'abgezeichnet');
  assert.deepEqual(arten('2026-11-30'), []);
  assert.equal(eine('2026-12-01', 'firmentermin')!.text, 'Übermorgen: Betriebsversammlung.');
  assert.equal(eine('2026-12-02', 'firmentermin')!.text, 'Morgen: Betriebsversammlung.');
  assert.equal(eine('2026-12-01', 'firmentermin')!.schluessel, eine('2026-12-02', 'firmentermin')!.schluessel);
  assert.equal(arten('2026-12-03').includes('firmentermin'), false);

  // Prüfung: eine Woche und einen Tag vorher – der Tag davor steht ganz vorn
  assert.equal((await ruf(w.u, 'PUT', `/api/azubis/${w.anna.id}/profil`, { cookies: w.als(w.ausbilder), body: { ausbildungsbeginn: '2025-02-28', vertragsende: '2028-02-27', ausbilderId: w.ausbilder.id, pruefungen: [{ bezeichnung: 'Abschlussprüfung Teil 1', datum: '2026-12-10' }] } })).status, 200);
  assert.equal(eine('2026-12-03', 'pruefung')!.text, 'In einer Woche: Abschlussprüfung Teil 1.');
  assert.equal(arten('2026-12-04').includes('pruefung'), false);
  assert.equal(arten('2026-12-09')[0], 'pruefung');
  assert.match(eine('2026-12-09', 'pruefung')!.text, /^Morgen steht an: Abschlussprüfung Teil 1\./);

  // Urlaub: am letzten Arbeitstag davor – über das Wochenende hinweg; nur genehmigter
  const urlaub = (von: string, bis: string, status: string) => db.prepare('INSERT INTO urlaub_antrag (azubi_id, von, bis, tage, status, erstellt, geaendert) VALUES (?, ?, ?, 5, ?, ?, ?)').run(w.anna.id, von, bis, status, jetzt, jetzt);
  urlaub('2026-12-14', '2026-12-18', 'genehmigt');
  urlaub('2027-01-13', '2027-01-15', 'offen');
  assert.equal(arten('2026-12-10').includes('urlaub'), false, 'Donnerstag: dazwischen liegt noch der Freitag');
  assert.equal(eine('2026-12-11', 'urlaub')!.text, 'Ab Montag hast du Urlaub. Erhol dich gut!');
  assert.equal(eine('2026-12-13', 'urlaub')!.text, 'Ab morgen hast du Urlaub. Erhol dich gut!');
  assert.equal(eine('2026-12-11', 'urlaub')!.schluessel, eine('2026-12-13', 'urlaub')!.schluessel);
  assert.equal(arten('2026-12-14').includes('urlaub'), false, 'im Urlaub nicht mehr');
  assert.equal(arten('2027-01-12').includes('urlaub'), false, 'ein offener Antrag ist noch kein Urlaub');

  // abgeschaltete Arten fehlen
  assert.equal(arten('2026-12-11', ['urlaub']).includes('urlaub'), false);
  // in keinem Text steht ein anderer Name
  for (const tag of ['2026-11-13', '2026-12-01', '2026-12-09', '2026-12-11']) for (const e of erinnerungenAm(w.u.k, w.anna.id, tag)) assert.doesNotMatch(e.text, /Petra|Bea|Ben|Anna/, e.text);

  // --- über die Route ---
  const hol = async (wer = w.anna) => koerper(await ruf(w.u, 'GET', '/api/begleiter/erinnerungen', { cookies: w.als(wer) })).erinnerungen as { art: string }[];
  w.u.uhr.jetzt = new Date('2026-12-11T09:00:00Z');
  assert.deepEqual(await hol(), [], 'ohne Begleiter keine Erinnerung');
  const setze = (body: Record<string, unknown>) => ruf(w.u, 'PUT', '/api/begleiter', { cookies: w.als(w.anna), body });
  assert.equal((await setze({ an: true, figur: 'eule', name: 'Uhu' })).status, 200);
  assert.deepEqual((await hol()).map((e) => e.art), ['bericht_woche', 'bericht_alt', 'urlaub']);
  // einzeln abschalten; die Reihenfolge der Angabe ist egal, Unbekanntes wird abgelehnt
  assert.deepEqual(koerper(await setze({ an: true, erinnernAus: ['urlaub', 'bericht_woche'] })).erinnernAus, ['bericht_woche', 'urlaub']);
  assert.deepEqual((await hol()).map((e) => e.art), ['bericht_alt']);
  assert.equal((await setze({ an: true, erinnernAus: ['lernen'] })).status, 400);
  assert.equal((await setze({ an: true, erinnernAus: 'urlaub' })).status, 400);
  // Figur ändern lässt die Auswahl stehen
  assert.deepEqual(koerper(await setze({ an: true, figur: 'fuchs' })).erinnernAus, ['bericht_woche', 'urlaub']);
  assert.deepEqual(koerper(await setze({ an: true, erinnernAus: [] })).erinnernAus, []);
  // Begleiter aus oder für das Portal abgeschaltet: keine Erinnerungen
  await setze({ an: false });
  assert.deepEqual(await hol(), []);
  await setze({ an: true });
  await ruf(w.u, 'PUT', '/api/begleiter/einstellung', { cookies: w.als(w.chef), body: { an: false } });
  assert.deepEqual(await hol(), []);
  // nur der Azubi selbst
  for (const wer of [w.ausbilder, w.bea, w.chef]) assert.equal((await ruf(w.u, 'GET', '/api/begleiter/erinnerungen', { cookies: w.als(wer) })).status, 403, wer.rolle);
  // Ben ohne Ausbildungszeit: nur die Unterschrift
  assert.deepEqual(arten('2026-11-13', [], w.ben), ['unterschrift']);
});
