import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { dailyBackup, openDatabase } from '../db';
import { loescheAltesProtokoll, protokolliere, PROTOKOLL_TAGE } from '../protokoll';
import { neueDb } from './hilfe';

const TAG = 24 * 60 * 60 * 1000;

test('Protokoll: Einträge älter als 90 Tage werden gelöscht – alle Arten, jüngere bleiben', async () => {
  const db = await neueDb();
  const jetzt = new Date('2026-11-14T10:00:00.000Z');
  const vor = (tage: number) => new Date(jetzt.getTime() - tage * TAG);
  protokolliere(db, vor(PROTOKOLL_TAGE + 1), 'konto', 'anmeldung', null);
  protokolliere(db, vor(200), 'konto', 'konto_angelegt', null);
  protokolliere(db, vor(120), 'fach', 'zuweisung_geaendert', null);
  protokolliere(db, vor(PROTOKOLL_TAGE - 1), 'konto', 'anmeldung', null);
  protokolliere(db, jetzt, 'fach', 'zuweisung_geaendert', null);
  assert.equal(loescheAltesProtokoll(db, jetzt), 3);
  const rest = db.prepare('SELECT aktion FROM protokoll ORDER BY zeit').all() as { aktion: string }[];
  assert.deepEqual(rest.map((r) => r.aktion), ['anmeldung', 'zuweisung_geaendert']);
  assert.equal(loescheAltesProtokoll(db, jetzt), 0, 'beim nächsten Lauf gibt es nichts mehr zu löschen');
});

test('Tägliche Sicherung: höchstens eine am Tag, die letzten sieben bleiben, Anhänge sind darin', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pflege-'));
  const db = await openDatabase(dir, () => {});
  // ein Anhang an einem Bericht liegt als Datei in der Datenbank – also auch in der Sicherung
  db.prepare("INSERT INTO benutzer (anmeldung, anmeldename, anzeigename, rolle, erstellt) VALUES ('entra', 'a@firma.test', 'Anna', 'azubi', '2026-01-01T00:00:00.000Z')").run();
  db.prepare("INSERT INTO bericht (azubi_id, montag, geaendert) VALUES (1, '2026-11-02', '2026-11-02T08:00:00.000Z')").run();
  db.prepare("INSERT INTO bericht_anhang (azubi_id, montag, tag, name, typ, groesse, erstellt, daten) VALUES (1, '2026-11-02', NULL, 'foto.jpg', 'image/jpeg', 3, '2026-11-02T08:00:00.000Z', ?)").run(Buffer.from([1, 2, 3]));

  const erste = await dailyBackup(db, dir);
  assert.ok(erste, 'die erste Sicherung wird angelegt');
  assert.equal(await dailyBackup(db, dir), null, 'am selben Tag keine zweite');

  const kopie = new DatabaseSync(erste!, { readOnly: true });
  assert.equal((kopie.prepare('SELECT COUNT(*) AS n FROM bericht_anhang').get() as { n: number }).n, 1);
  kopie.close();

  // zehn Tage nacheinander: die vorige Sicherung jeweils einen Tag älter machen
  const sicherungen = () => readdirSync(join(dir, 'backups')).filter((f) => f.includes('-taeglich-') && f.endsWith('.db'));
  for (let i = 0; i < 10; i++) {
    for (const f of sicherungen()) {
      const alt = new Date(Date.now() - (i + 1) * TAG - 60_000);
      utimesSync(join(dir, 'backups', f), alt, alt);
    }
    await new Promise((r) => setTimeout(r, 1100)); // eigener Zeitstempel im Dateinamen
    assert.ok(await dailyBackup(db, dir));
  }
  assert.equal(sicherungen().length, 7);
  db.close();
});
