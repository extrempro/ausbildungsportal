import assert from 'node:assert/strict';
import { test } from 'node:test';
import { karteWiederholt, meilensteine } from '../regal';
import type { BenutzerZeile } from '../typen';
import { admin, koerper, konto, ohneWechsel, ruf, sitzung, umgebung } from './hilfe';

test('Meilensteine hängen nur an der Ausbildungszeit: Start, Probezeit, jedes Jahr, Halbzeit, Abschluss', () => {
  const m = meilensteine('2025-09-01', '2028-08-31');
  assert.deepEqual(
    m.map((x) => [x.id, x.am]),
    [
      ['start', null],
      ['probezeit', '2026-01-01'],
      ['jahr1', '2026-09-01'],
      ['halbzeit', '2027-03-03'],
      ['jahr2', '2027-09-01'],
      ['ende', '2028-08-31'],
    ],
  );
  assert.deepEqual(meilensteine(null, null).map((x) => x.id), ['start'], 'ohne Ausbildungszeit nur der Start');
});

async function welt() {
  const u = await umgebung();
  const chef = admin(u.db);
  ohneWechsel(u.db, chef.id);
  const ausbilder = konto(u.db, 'ausbilder', 'Petra Lang');
  const anna = konto(u.db, 'azubi', 'Anna Azubi');
  const ben = konto(u.db, 'azubi', 'Ben Beispiel');
  const als = (wer: BenutzerZeile) => sitzung(u, wer);
  const tag = (d: number) => new Date(u.uhr.jetzt.getTime() + d * 86_400_000).toISOString().slice(0, 10);
  const r = async (wer: BenutzerZeile, m: string, p: string, body?: unknown) => {
    const a = await ruf(u, m, p, { cookies: als(wer), body });
    return { status: a.status, b: koerper(a) as Record<string, any> };
  };
  const weiter = (tage: number) => (u.uhr.jetzt = new Date(u.uhr.jetzt.getTime() + tage * 86_400_000));
  const bericht = (wer: BenutzerZeile, montag: string, status = 'eingereicht', inhalt = '{}') =>
    u.db.prepare('INSERT INTO bericht (azubi_id, montag, status, inhalt, geaendert) VALUES (?, ?, ?, ?, ?)').run(wer.id, montag, status, inhalt, u.uhr.jetzt.toISOString());
  return { u, chef, ausbilder, anna, ben, als, tag, r, weiter, bericht };
}

test('Game Vault: erst nach dem Schalter des Super-Admins; Regal anlegen, Samenpaket öffnen, gießen erst wenn trocken', async () => {
  const w = await welt();
  // anfangs aus
  assert.equal((await w.r(w.anna, 'GET', '/api/regal')).b.erlaubt, false);
  assert.equal((await w.r(w.anna, 'POST', '/api/regal', {})).status, 409);
  assert.equal((await w.r(w.chef, 'PUT', '/api/regal/einstellung', { an: true })).status, 200);

  let v = (await w.r(w.anna, 'POST', '/api/regal', {})).b;
  assert.equal(v.angelegt, true);
  assert.equal(v.pakete, 1, 'zum Start wartet ein Samenpaket');
  assert.equal(v.ohneZeit, true);
  assert.equal(v.tropfen, 0);
  assert.equal(v.plaetze, 9);

  // Ausbildungsbeginn vor gut 400 Tagen: Probezeit und 1. Jahr sind geschafft → zwei weitere Pakete
  assert.equal((await w.r(w.ausbilder, 'PUT', `/api/azubis/${w.anna.id}/profil`, { ausbildungsbeginn: w.tag(-400), ausbilderId: w.ausbilder.id })).status, 200);
  v = (await w.r(w.anna, 'GET', '/api/regal')).b;
  assert.equal(v.pakete, 3);
  assert.equal(v.gewaechse.length, 2, 'ein Berichtsheft-Gewächs je begonnenem Ausbildungsjahr');
  assert.ok(v.gadgets.find((g: { id: string }) => g.id === 'docht').hat, 'Probezeit geschafft → Bewässerungsdocht');
  assert.ok(!v.gadgets.find((g: { id: string }) => g.id === 'brett').hat, 'Halbzeit noch nicht');

  assert.equal((await w.r(w.anna, 'POST', '/api/regal/paket', { sorte: 'kaktus' })).status, 400);
  const paket = await w.r(w.anna, 'POST', '/api/regal/paket', { sorte: 'haenge' });
  assert.equal(paket.status, 200);
  assert.ok(['efeuranke', 'erbsenranke', 'tradeskantie'].includes(paket.b.neu.art));
  assert.equal(paket.b.pakete, 2);
  const pflanze = paket.b.pflanzen[0];
  assert.equal(pflanze.feuchte, 100);
  assert.equal(pflanze.giessbar, false);

  // frisch eingepflanzt: noch feucht
  const giess = () => w.r(w.anna, 'POST', `/api/regal/pflanzen/${pflanze.id}/giessen`, {});
  assert.equal((await giess()).status, 409);
  // zwei Wochen später ist die Erde trocken – aber ohne Tropfen geht nichts
  w.weiter(14);
  v = (await w.r(w.anna, 'GET', '/api/regal')).b;
  assert.ok(v.pflanzen[0].feuchte < 70, `Feuchte ${v.pflanzen[0].feuchte}`);
  assert.match((await giess()).b.fehler, /zu wenig Tropfen/);

  // ein eingereichter Bericht bringt 5 Tropfen – egal wann
  w.bericht(w.anna, '2025-11-03');
  const nachher = await giess();
  assert.equal(nachher.status, 200);
  assert.equal(nachher.b.tropfen, 3);
  assert.equal(nachher.b.pflanzen[0].feuchte, 100);
  assert.equal(nachher.b.pflanzen[0].wuchs, 25);
  assert.equal(nachher.b.gewaechse[0].blaetter, 1, 'ein Blatt am Gewächs des 1. Jahres');
});

test('Game Vault: Tropfen werden errechnet – zurückgestellter Lernstand nimmt nichts weg; Funken, Booster, Gadgets', async () => {
  const w = await welt();
  await w.r(w.chef, 'PUT', '/api/regal/einstellung', { an: true });
  await w.r(w.anna, 'POST', '/api/regal', {});
  const jetzt = w.u.uhr.jetzt.toISOString();
  const status = (s: string) =>
    w.u.db.prepare("INSERT INTO lern_status (azubi_id, paket, unterthema_id, status, geaendert) VALUES (?, 'muster', 'a.b', ?, ?) ON CONFLICT DO UPDATE SET status = excluded.status").run(w.anna.id, s, jetzt);
  status('gruen');
  assert.equal((await w.r(w.anna, 'GET', '/api/regal')).b.tropfen, 7, 'Gelb 2 + Grün 5');
  status('rot');
  assert.equal((await w.r(w.anna, 'GET', '/api/regal')).b.tropfen, 7, 'zurückgestellt: die Tropfen bleiben');
  w.u.db.prepare("INSERT INTO lern_quiz (azubi_id, paket, unterthema_id, versuche, zuletzt, bestanden_am) VALUES (?, 'muster', 'a.b', 3, ?, ?)").run(w.anna.id, jetzt, jetzt);
  assert.equal((await w.r(w.anna, 'GET', '/api/regal')).b.tropfen, 10, 'Quiz bestanden +3');
  karteWiederholt(w.u.db, w.anna.id);
  karteWiederholt(w.u.db, w.ben.id); // Ben hat kein Regal – nichts wird gezählt
  assert.equal((await w.r(w.anna, 'GET', '/api/regal')).b.tropfen, 11, 'fällige Karte +1');
  assert.equal(w.u.db.prepare('SELECT COUNT(*) AS n FROM regal WHERE azubi_id = ?').get(w.ben.id)!.n, 0);

  // Funken aus Zusatzwissen; Booster kaufen und geben
  assert.equal((await w.r(w.anna, 'POST', '/api/regal/kaufen', { was: 'duenger' })).status, 409);
  w.u.db.prepare("INSERT INTO lern_zusatz (azubi_id, paket, zusatz_id, geaendert) VALUES (?, 'muster', 'a.z', ?)").run(w.anna.id, jetzt);
  let v = (await w.r(w.anna, 'POST', '/api/regal/kaufen', { was: 'duenger' })).b;
  assert.equal(v.funken, 0);
  assert.equal(v.vorrat.duenger, 1);
  v = (await w.r(w.anna, 'POST', '/api/regal/paket', { sorte: 'gruen' })).b;
  const id = v.pflanzen[0].id;
  v = (await w.r(w.anna, 'POST', `/api/regal/pflanzen/${id}/booster`, { art: 'duenger' })).b;
  assert.equal(v.pflanzen[0].wuchs, 20);
  assert.equal(v.vorrat.duenger, 0);
  assert.equal((await w.r(w.anna, 'POST', `/api/regal/pflanzen/${id}/booster`, { art: 'duenger' })).status, 409, 'nichts mehr im Vorrat');

  // Gadget für Tropfen: zu teuer
  assert.equal((await w.r(w.anna, 'POST', '/api/regal/kaufen', { was: 'brett' })).status, 409);
  assert.equal((await w.r(w.anna, 'POST', '/api/regal/kaufen', { was: 'gold' })).status, 400);

  // Samenpaket ohne Meilenstein kostet 300 Tropfen
  assert.equal((await w.r(w.anna, 'POST', '/api/regal/paket', { sorte: 'gruen' })).status, 409);
  assert.equal((await w.r(w.anna, 'POST', '/api/regal/paket', { sorte: 'gruen', kauf: true })).status, 409);
});

test('Game Vault: Urlaub, Berufsschule und Abwesenheit halten die Zeit an', async () => {
  const w = await welt();
  await w.r(w.chef, 'PUT', '/api/regal/einstellung', { an: true });
  await w.r(w.anna, 'POST', '/api/regal', {});
  const id = (await w.r(w.anna, 'POST', '/api/regal/paket', { sorte: 'gruen' })).b.pflanzen[0].id as number;
  // heute ist Dienstag, 10.11.2026: Urlaub bis Freitag, 27.11., danach eine Woche Berufsschule (im Plan wochenweise: Montag 30.11.)
  w.u.db.prepare("INSERT INTO urlaub_antrag (azubi_id, von, bis, tage, status, erstellt, geaendert) VALUES (?, '2026-11-11', '2026-11-27', 13, 'genehmigt', ?, ?)").run(w.anna.id, w.tag(0), w.tag(0));
  w.u.db.prepare("INSERT INTO plan_eintrag (azubi_id, art, titel, von, bis, erstellt_von, geaendert) VALUES (?, 'schule', 'Berufsschule', '2026-11-30', '2026-11-30', ?, ?)").run(w.anna.id, w.ausbilder.id, w.tag(0));
  const feuchte = async () => ((await w.r(w.anna, 'GET', '/api/regal')).b.pflanzen as { id: number; feuchte: number }[]).find((p) => p.id === id)!.feuchte;
  w.weiter(17);
  assert.equal(await feuchte(), 100, 'im Urlaub trocknet nichts');
  w.weiter(7);
  assert.equal(await feuchte(), 100, 'in der Berufsschule auch nicht');
  // Dienstag, 8.12.: Montag und Dienstag im Betrieb; den Dienstag trägt Anna im Bericht als abwesend ein
  w.weiter(4);
  w.bericht(w.anna, '2026-12-07', 'entwurf', JSON.stringify({ abwesenheit: [{ tag: '2026-12-08', grund: 'abwesend', stunden: 8, text: '' }] }));
  assert.equal(await feuchte(), 93, 'nur der Montag zählt');

});

test('Game Vault ist privat: nur der Azubi selbst – fremde Pflanzen gibt es nicht, andere Rollen dürfen nicht', async () => {
  const w = await welt();
  await w.r(w.chef, 'PUT', '/api/regal/einstellung', { an: true });
  await w.r(w.anna, 'POST', '/api/regal', {});
  const id = (await w.r(w.anna, 'POST', '/api/regal/paket', { sorte: 'bluete' })).b.pflanzen[0].id as number;
  await w.r(w.ben, 'POST', '/api/regal', {});
  for (const [m, p, body] of [
    ['POST', `/api/regal/pflanzen/${id}/giessen`, {}],
    ['POST', `/api/regal/pflanzen/${id}/booster`, { art: 'lampe' }],
    ['DELETE', `/api/regal/pflanzen/${id}`, undefined],
  ] as const) {
    assert.equal((await w.r(w.ben, m, p, body)).status, 404, `${m} ${p} als Ben`);
  }
  for (const wer of [w.ausbilder, w.chef]) assert.equal((await w.r(wer, 'GET', '/api/regal')).status, 403);
  assert.equal((await w.r(w.anna, 'GET', '/api/regal/einstellung')).status, 403);
  // Anna gibt ihre Pflanze weg, dann löscht sie das Regal
  assert.equal((await w.r(w.anna, 'DELETE', `/api/regal/pflanzen/${id}`)).b.pflanzen.length, 0);
  const weg = (await w.r(w.anna, 'DELETE', '/api/regal')).b;
  assert.equal(weg.angelegt, false);
  assert.equal(w.u.db.prepare('SELECT COUNT(*) AS n FROM regal_pflanze WHERE azubi_id = ?').get(w.anna.id)!.n, 0);
  // ausgeschaltet: nichts geht mehr
  await w.r(w.chef, 'PUT', '/api/regal/einstellung', { an: false });
  assert.equal((await w.r(w.ben, 'POST', '/api/regal/paket', { sorte: 'gruen' })).status, 409);
});
