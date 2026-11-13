import assert from 'node:assert/strict';
import { test } from 'node:test';
import { beginneSitzung, HOECHST_MS, LEERLAUF_MS, pruefeSitzung, sitzungsEnde } from '../sitzung';
import { konto, neueDb } from './hilfe';

test('Sitzungsende: nach 8 Stunden Leerlauf – kurz vor der festen Grenze von 24 Stunden diese (WCAG 2.2.1: die Oberfläche warnt vorher)', async () => {
  const db = await neueDb();
  const anna = konto(db, 'azubi', 'Anna');
  const start = new Date('2026-11-10T08:00:00Z');
  const token = beginneSitzung(db, anna.id, start);
  assert.deepEqual(sitzungsEnde(db, token), { ende: new Date(start.getTime() + LEERLAUF_MS).toISOString(), fest: false });
  // jede Anfrage verschiebt das Ende – bis die feste Grenze näher ist
  for (const stunde of [7, 14, 20]) assert.ok(pruefeSitzung(db, token, new Date(start.getTime() + stunde * 3_600_000)));
  assert.deepEqual(sitzungsEnde(db, token), { ende: new Date(start.getTime() + HOECHST_MS).toISOString(), fest: true });
  assert.equal(sitzungsEnde(db, 'gibt-es-nicht'), null);
  assert.equal(sitzungsEnde(db, undefined), null);
});
