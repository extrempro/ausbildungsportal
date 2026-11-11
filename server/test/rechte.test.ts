import assert from 'node:assert/strict';
import { test } from 'node:test';
import { betreuung, darfAbzeichnen, darfAzubiSehen, darfAzubiVerwalten, darfKontoLoeschen, darfKontoSehen, darfKontoVerwalten, darfPlanBearbeiten, darfRolleVergeben, sichtbareAzubis } from '../rechte';
import { ROLLEN } from '../typen';
import { admin, konto, umgebung, zustaendig, zuweisen } from './hilfe';

const HEUTE = '2026-11-10';

test('Rollen vergeben: Super-Admin alle, Ausbilder nur Azubi und Beauftragte, sonst niemand', async () => {
  const { db } = await umgebung();
  const erwartet = {
    admin: ['admin', 'ausbilder', 'beauftragter', 'azubi'],
    ausbilder: ['beauftragter', 'azubi'],
    beauftragter: [],
    azubi: [],
  };
  const wer = { admin: admin(db), ausbilder: konto(db, 'ausbilder'), beauftragter: konto(db, 'beauftragter'), azubi: konto(db, 'azubi') };
  for (const rolle of ROLLEN) {
    assert.deepEqual(ROLLEN.filter((r) => darfRolleVergeben(wer[rolle], r)), erwartet[rolle], rolle);
  }
});

test('Konten sehen, verwalten, löschen', async () => {
  const { db } = await umgebung();
  const a = admin(db);
  const ausbilder = konto(db, 'ausbilder');
  const zweiter = konto(db, 'ausbilder');
  const azubi = konto(db, 'azubi');
  const beauftragter = konto(db, 'beauftragter');

  assert.ok(darfKontoVerwalten(db, a, ausbilder) && darfKontoVerwalten(db, a, azubi) && darfKontoLoeschen(db, a, ausbilder) && darfKontoLoeschen(db, a, azubi));
  assert.ok(darfKontoVerwalten(db, ausbilder, azubi) && darfKontoVerwalten(db, ausbilder, beauftragter));
  assert.ok(darfKontoLoeschen(db, ausbilder, azubi) && darfKontoLoeschen(db, ausbilder, beauftragter), 'Ausbilder löschen Azubis und Beauftragte');
  assert.equal(darfKontoLoeschen(db, ausbilder, zweiter), false, 'aber keine Ausbilder');
  assert.equal(darfKontoLoeschen(db, ausbilder, a), false, 'und keine Super-Admins');
  assert.equal(darfKontoVerwalten(db, ausbilder, zweiter), false, 'Ausbilder ändern keine Ausbilder');
  assert.equal(darfKontoVerwalten(db, ausbilder, a), false);
  assert.equal(darfKontoSehen(db, ausbilder, a), false, 'Ausbilder sehen den Super-Admin nicht');
  assert.equal(darfKontoSehen(db, ausbilder, zweiter), true);
  for (const wer of [azubi, beauftragter]) {
    assert.equal(darfKontoSehen(db, wer, azubi), false);
    assert.equal(darfKontoVerwalten(db, wer, azubi), false);
    assert.equal(darfKontoLoeschen(db, wer, azubi), false);
  }
});

test('Azubi sehen: selbst, Ausbilder Azubis ohne Ausbilder, Beauftragte nur zugewiesene, Super-Admin nie', async () => {
  const { db } = await umgebung();
  const a = admin(db);
  const ausbilder = konto(db, 'ausbilder');
  const b1 = konto(db, 'beauftragter');
  const b2 = konto(db, 'beauftragter');
  const anna = konto(db, 'azubi');
  const ben = konto(db, 'azubi');
  zuweisen(db, anna, b1);

  assert.equal(darfAzubiSehen(db, anna, anna.id, HEUTE), true);
  assert.equal(darfAzubiSehen(db, anna, ben.id, HEUTE), false, 'Azubis sehen einander nicht');
  assert.equal(darfAzubiSehen(db, ausbilder, anna.id, HEUTE), true);
  assert.equal(darfAzubiSehen(db, ausbilder, ben.id, HEUTE), true);
  assert.equal(darfAzubiSehen(db, b1, anna.id, HEUTE), true);
  assert.equal(darfAzubiSehen(db, b1, ben.id, HEUTE), false);
  assert.equal(darfAzubiSehen(db, b2, anna.id, HEUTE), false);
  assert.equal(darfAzubiSehen(db, a, anna.id, HEUTE), false, 'Super-Admin sieht keine Azubi-Daten');

  // die ID muss ein Azubi sein
  assert.equal(darfAzubiSehen(db, ausbilder, b1.id, HEUTE), false);
  assert.equal(darfAzubiSehen(db, ausbilder, 99999, HEUTE), false);
  assert.equal(darfAzubiSehen(db, ausbilder, NaN, HEUTE), false);

  assert.deepEqual(sichtbareAzubis(db, ausbilder, HEUTE).sort(), [anna.id, ben.id].sort());
  assert.deepEqual(sichtbareAzubis(db, b1, HEUTE), [anna.id]);
  assert.deepEqual(sichtbareAzubis(db, b2, HEUTE), []);
  assert.deepEqual(sichtbareAzubis(db, anna, HEUTE), [anna.id]);
  assert.deepEqual(sichtbareAzubis(db, a, HEUTE), []);

  assert.equal(darfAzubiVerwalten(db, ausbilder, anna.id), true);
  for (const wer of [a, b1, anna]) assert.equal(darfAzubiVerwalten(db, wer, anna.id), false);
});

test('Zuweisung mit Zeitraum: sichtbar ab Beginn, auch nach dem Ende', async () => {
  const { db } = await umgebung();
  const b = konto(db, 'beauftragter');
  const azubi = konto(db, 'azubi');
  zuweisen(db, azubi, b, '2026-12-01', '2027-01-31');
  assert.equal(darfAzubiSehen(db, b, azubi.id, '2026-11-30'), false, 'vor Beginn');
  assert.equal(darfAzubiSehen(db, b, azubi.id, '2026-12-01'), true);
  assert.equal(darfAzubiSehen(db, b, azubi.id, '2027-06-01'), true, 'nach dem Ende weiter einsehbar');
  assert.deepEqual(sichtbareAzubis(db, b, '2026-11-30'), []);
});

test('Abzeichnen: Ausbilder immer, Beauftragte nur Wochen im Zeitraum', async () => {
  const { db } = await umgebung();
  const a = admin(db);
  const ausbilder = konto(db, 'ausbilder');
  const b = konto(db, 'beauftragter');
  const fremd = konto(db, 'beauftragter');
  const azubi = konto(db, 'azubi');
  const anderer = konto(db, 'azubi');
  // Mittwoch 02.12.2026 bis Freitag 29.01.2027
  zuweisen(db, azubi, b, '2026-12-02', '2027-01-29');

  assert.equal(darfAbzeichnen(db, ausbilder, azubi.id, '2026-06-01'), true);
  assert.equal(darfAbzeichnen(db, b, azubi.id, '2026-11-23'), false, 'Woche vor Beginn');
  assert.equal(darfAbzeichnen(db, b, azubi.id, '2026-11-30'), true, 'Woche, in der die Zuweisung beginnt');
  assert.equal(darfAbzeichnen(db, b, azubi.id, '2026-12-14'), true);
  assert.equal(darfAbzeichnen(db, b, azubi.id, '2027-01-25'), true, 'Woche, in der die Zuweisung endet');
  assert.equal(darfAbzeichnen(db, b, azubi.id, '2027-02-01'), false, 'Woche nach dem Ende');
  assert.equal(darfAbzeichnen(db, b, anderer.id, '2026-12-14'), false);
  assert.equal(darfAbzeichnen(db, fremd, azubi.id, '2026-12-14'), false);
  assert.equal(darfAbzeichnen(db, azubi, azubi.id, '2026-12-14'), false, 'Azubis zeichnen nicht selbst ab');
  assert.equal(darfAbzeichnen(db, a, azubi.id, '2026-12-14'), false, 'Super-Admin zeichnet nicht ab');
  assert.equal(darfAbzeichnen(db, ausbilder, azubi.id, 'kein-datum'), false);
  assert.equal(darfAbzeichnen(db, ausbilder, b.id, '2026-12-14'), false, 'Ziel muss ein Azubi sein');
});

test('Zuweisung ohne Zeitraum gilt für die ganze Ausbildung', async () => {
  const { db } = await umgebung();
  const b = konto(db, 'beauftragter');
  const azubi = konto(db, 'azubi');
  zuweisen(db, azubi, b);
  assert.equal(darfAbzeichnen(db, b, azubi.id, '2025-08-04'), true);
  assert.equal(darfAbzeichnen(db, b, azubi.id, '2028-07-24'), true);
});

test('Ausbilder: nur eigene Azubis und Azubis ohne Ausbilder', async () => {
  const { db } = await umgebung();
  const a1 = konto(db, 'ausbilder');
  const a2 = konto(db, 'ausbilder');
  const anna = konto(db, 'azubi'); // gehört a1
  const ben = konto(db, 'azubi'); // gehört a2
  const cem = konto(db, 'azubi'); // ohne Ausbilder
  zustaendig(db, anna, a1);
  zustaendig(db, ben, a2);
  zustaendig(db, cem, null);

  assert.deepEqual(sichtbareAzubis(db, a1, HEUTE).sort(), [anna.id, cem.id].sort());
  assert.deepEqual(sichtbareAzubis(db, a2, HEUTE).sort(), [ben.id, cem.id].sort());
  assert.equal(darfAzubiSehen(db, a1, ben.id, HEUTE), false, 'fremder Azubi ist unsichtbar');
  assert.equal(darfAzubiVerwalten(db, a1, ben.id), false);
  assert.equal(darfAbzeichnen(db, a1, ben.id, '2026-11-09'), false);
  assert.equal(darfPlanBearbeiten(db, a1, ben.id, 'einsatz', HEUTE), false);
  assert.equal(darfPlanBearbeiten(db, a1, ben.id, 'aufgabe', HEUTE), false);
  for (const wer of [a1, a2]) {
    assert.equal(darfAzubiVerwalten(db, wer, cem.id), true, 'ohne Ausbilder: jeder Ausbilder');
    assert.equal(darfAbzeichnen(db, wer, cem.id, '2026-11-09'), true);
    assert.equal(betreuung(db, wer, cem.id), 'ohne');
  }
  assert.equal(betreuung(db, a1, anna.id), 'eigen');

  // Konten: fremde Azubis tauchen nicht auf und lassen sich nicht ändern
  assert.equal(darfKontoSehen(db, a1, ben), false);
  assert.equal(darfKontoVerwalten(db, a1, ben), false);
  assert.equal(darfKontoLoeschen(db, a1, ben), false);
  assert.ok(darfKontoSehen(db, a1, anna) && darfKontoVerwalten(db, a1, anna) && darfKontoLoeschen(db, a1, cem));
});

test('Gesamtsicht: volle Rechte bei allen Azubis', async () => {
  const { db } = await umgebung();
  const a1 = konto(db, 'ausbilder');
  const leitung = konto(db, 'ausbilder');
  const anna = konto(db, 'azubi');
  zustaendig(db, anna, a1);
  assert.equal(darfAzubiSehen(db, leitung, anna.id, HEUTE), false);
  db.prepare('UPDATE benutzer SET alle_azubis = 1 WHERE id = ?').run(leitung.id);
  assert.equal(darfAzubiSehen(db, leitung, anna.id, HEUTE), true);
  assert.equal(darfAzubiVerwalten(db, leitung, anna.id), true);
  assert.equal(darfAbzeichnen(db, leitung, anna.id, '2026-11-09'), true);
  assert.equal(darfKontoVerwalten(db, leitung, anna), true);
  assert.deepEqual(sichtbareAzubis(db, leitung, HEUTE), [anna.id]);
  assert.equal(betreuung(db, leitung, anna.id), 'gesamt');
  // der Schalter wirkt nur bei Ausbildern
  const b = konto(db, 'beauftragter');
  db.prepare('UPDATE benutzer SET alle_azubis = 1 WHERE id = ?').run(b.id);
  assert.equal(darfAzubiSehen(db, b, anna.id, HEUTE), false);
});

test('Vertretung: zugewiesener Ausbilder hat die Rechte eines Beauftragten', async () => {
  const { db } = await umgebung();
  const a1 = konto(db, 'ausbilder');
  const vertretung = konto(db, 'ausbilder');
  const anna = konto(db, 'azubi');
  zustaendig(db, anna, a1);
  // Montag 16.11. bis Sonntag 29.11.2026
  zuweisen(db, anna, vertretung, '2026-11-16', '2026-11-29');

  assert.equal(darfAzubiSehen(db, vertretung, anna.id, '2026-11-15'), false, 'vor Beginn');
  assert.equal(darfAzubiSehen(db, vertretung, anna.id, '2026-11-16'), true);
  assert.equal(darfAzubiSehen(db, vertretung, anna.id, '2027-03-01'), true, 'wie bei Beauftragten: danach weiter einsehbar');
  assert.equal(darfAbzeichnen(db, vertretung, anna.id, '2026-11-16'), true);
  assert.equal(darfAbzeichnen(db, vertretung, anna.id, '2026-11-30'), false, 'Woche nach dem Ende');
  assert.equal(darfPlanBearbeiten(db, vertretung, anna.id, 'aufgabe', '2026-11-20'), true);
  assert.equal(darfPlanBearbeiten(db, vertretung, anna.id, 'einsatz', '2026-11-20'), false, 'Einsätze plant der zuständige Ausbilder');
  assert.equal(darfPlanBearbeiten(db, vertretung, anna.id, 'aufgabe', '2026-12-01'), false, 'nach dem Ende nichts mehr');
  assert.equal(darfAzubiVerwalten(db, vertretung, anna.id), false);
  assert.equal(darfKontoVerwalten(db, vertretung, anna), false);
  assert.equal(betreuung(db, vertretung, anna.id), 'vertretung');
  assert.deepEqual(sichtbareAzubis(db, vertretung, '2026-11-20'), [anna.id]);
});

test('Gesperrter oder umgestufter Ausbilder: seine Azubis gelten als ohne Ausbilder', async () => {
  const { db } = await umgebung();
  const a1 = konto(db, 'ausbilder');
  const a2 = konto(db, 'ausbilder');
  const anna = konto(db, 'azubi');
  zustaendig(db, anna, a1);
  assert.equal(darfAzubiSehen(db, a2, anna.id, HEUTE), false);
  db.prepare("UPDATE benutzer SET status = 'gesperrt' WHERE id = ?").run(a1.id);
  assert.equal(darfAzubiVerwalten(db, a2, anna.id), true);
  assert.deepEqual(sichtbareAzubis(db, a2, HEUTE), [anna.id]);
  db.prepare("UPDATE benutzer SET status = 'aktiv' WHERE id = ?").run(a1.id);
  assert.equal(darfAzubiSehen(db, a2, anna.id, HEUTE), false, 'nach dem Entsperren wieder nur beim Zuständigen');
});
