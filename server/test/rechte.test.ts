import assert from 'node:assert/strict';
import { test } from 'node:test';
import { darfAbzeichnen, darfAzubiSehen, darfAzubiVerwalten, darfKontoLoeschen, darfKontoSehen, darfKontoVerwalten, darfRolleVergeben, sichtbareAzubis } from '../rechte';
import { ROLLEN } from '../typen';
import { admin, konto, umgebung, zuweisen } from './hilfe';

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

  assert.ok(darfKontoVerwalten(a, ausbilder) && darfKontoVerwalten(a, azubi) && darfKontoLoeschen(a, ausbilder) && darfKontoLoeschen(a, azubi));
  assert.ok(darfKontoVerwalten(ausbilder, azubi) && darfKontoVerwalten(ausbilder, beauftragter));
  assert.ok(darfKontoLoeschen(ausbilder, azubi) && darfKontoLoeschen(ausbilder, beauftragter), 'Ausbilder löschen Azubis und Beauftragte');
  assert.equal(darfKontoLoeschen(ausbilder, zweiter), false, 'aber keine Ausbilder');
  assert.equal(darfKontoLoeschen(ausbilder, a), false, 'und keine Super-Admins');
  assert.equal(darfKontoVerwalten(ausbilder, zweiter), false, 'Ausbilder ändern keine Ausbilder');
  assert.equal(darfKontoVerwalten(ausbilder, a), false);
  assert.equal(darfKontoSehen(ausbilder, a), false, 'Ausbilder sehen den Super-Admin nicht');
  assert.equal(darfKontoSehen(ausbilder, zweiter), true);
  for (const wer of [azubi, beauftragter]) {
    assert.equal(darfKontoSehen(wer, azubi), false);
    assert.equal(darfKontoVerwalten(wer, azubi), false);
    assert.equal(darfKontoLoeschen(wer, azubi), false);
  }
});

test('Azubi sehen: selbst, Ausbilder alle, Beauftragte nur zugewiesene, Super-Admin nie', async () => {
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
