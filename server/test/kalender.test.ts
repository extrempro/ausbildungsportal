import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { BUNDESLAENDER, bussUndBettag, feiertage, feiertageZwischen, ostersonntag } from '../feiertage';
import { ferienZwischen, ladeFerien, leseFerienDatei } from '../ferien';
import { ausbildungsdauer, ausbildungsjahrAm, ausbildungsstand, gueltigesDatum, hoechsteVerkuerzung, monateZwischen, plusMonate } from '../kalender';

const eingabe = (o: Partial<Parameters<typeof ausbildungsdauer>[0]> = {}) => ({
  ausbildungsbeginn: '2025-08-01',
  vertragsende: '',
  verkuerzung_monate: 0,
  verkuerzung_art: 'ende' as const,
  ...o,
});

test('Datum prüfen und Monate rechnen', () => {
  assert.equal(gueltigesDatum('2026-02-28'), true);
  for (const x of ['2026-02-30', '2026-13-01', '26-01-01', '', null, 20260101]) assert.equal(gueltigesDatum(x), false, String(x));
  assert.equal(plusMonate('2026-01-31', 1), '2026-02-28');
  assert.equal(plusMonate('2024-01-31', 1), '2024-02-29');
  assert.equal(plusMonate('2025-08-01', 36), '2028-08-01');
  assert.equal(monateZwischen('2025-08-01', '2026-07-31'), 11);
  assert.equal(monateZwischen('2025-08-01', '2026-08-01'), 12);
});

test('Ausbildungsdauer: Regeldauer je Beruf, Verkürzung, Vertragsende von Hand', () => {
  assert.equal(ausbildungsdauer(eingabe(), 36)?.ende, '2028-07-31');
  assert.equal(ausbildungsdauer(eingabe(), 42)?.ende, '2029-01-31');
  assert.equal(ausbildungsdauer(eingabe(), 24)?.ende, '2027-07-31');
  assert.equal(ausbildungsdauer(eingabe({ verkuerzung_monate: 6 }), 36)?.ende, '2028-01-31');
  const vonHand = ausbildungsdauer(eingabe({ vertragsende: '2028-06-30', verkuerzung_monate: 6 }), 36);
  assert.equal(vonHand?.ende, '2028-06-30');
  assert.equal(vonHand?.endeVonHand, true);
  assert.equal(ausbildungsdauer(eingabe({ ausbildungsbeginn: '' }), 36), null);
  assert.equal(hoechsteVerkuerzung(36), 24);
  assert.equal(ausbildungsdauer(eingabe({ verkuerzung_monate: 99 }), 36)?.monate, 12, 'mindestens 12 Monate bleiben');
});

test('Ausbildungsjahr: zählt ab Beginn, angerechnete Monate zählen mit', () => {
  const normal = ausbildungsdauer(eingabe(), 36)!;
  assert.equal(ausbildungsjahrAm(normal, '2025-08-01'), 1);
  assert.equal(ausbildungsjahrAm(normal, '2026-07-31'), 1);
  assert.equal(ausbildungsjahrAm(normal, '2026-08-01'), 2);
  assert.equal(ausbildungsjahrAm(normal, '2028-07-31'), 3);
  assert.equal(ausbildungsjahrAm(normal, '2025-01-01'), 1, 'vor dem Beginn: erstes Jahr');
  const angerechnet = ausbildungsdauer(eingabe({ verkuerzung_monate: 12, verkuerzung_art: 'anfang' }), 36)!;
  assert.equal(ausbildungsjahrAm(angerechnet, '2025-08-01'), 2, 'Start im zweiten Ausbildungsjahr');
  assert.equal(angerechnet.ende, '2027-07-31');
});

test('Ausbildungsstand: offen, vor Beginn, laufend, beendet', () => {
  assert.equal(ausbildungsstand(eingabe({ ausbildungsbeginn: '' }), 36, '2026-11-10').phase, 'offen');
  const vor = ausbildungsstand(eingabe({ ausbildungsbeginn: '2027-08-01' }), 36, '2027-07-22');
  assert.deepEqual([vor.phase, vor.tage, vor.ausbildungsjahr], ['vor', 10, 1]);
  const laufend = ausbildungsstand(eingabe(), 36, '2026-11-10');
  assert.deepEqual([laufend.phase, laufend.ausbildungsjahr, laufend.ende, laufend.monate], ['laufend', 2, '2028-07-31', 36]);
  assert.equal(ausbildungsstand(eingabe(), 36, '2028-07-31').phase, 'laufend', 'letzter Tag zählt noch');
  const beendet = ausbildungsstand(eingabe(), 36, '2028-08-01');
  assert.deepEqual([beendet.phase, beendet.ausbildungsjahr], ['beendet', 3]);
});

test('Ostern und Buß- und Bettag', () => {
  assert.equal(ostersonntag(2025), '2025-04-20');
  assert.equal(ostersonntag(2026), '2026-04-05');
  assert.equal(ostersonntag(2027), '2027-03-28');
  assert.equal(bussUndBettag(2025), '2025-11-19');
  assert.equal(bussUndBettag(2026), '2026-11-18');
  assert.equal(bussUndBettag(2022), '2022-11-16', 'fällt der 23. auf einen Mittwoch, gilt der Mittwoch davor');
});

test('Feiertage 2026: Anzahl je Bundesland (landesweit geltende)', () => {
  const erwartet: Record<string, number> = { BW: 12, BY: 12, BE: 10, BB: 12, HB: 10, HH: 10, HE: 10, MV: 11, NI: 10, NW: 11, RP: 11, SL: 12, SN: 11, ST: 11, SH: 10, TH: 11 };
  assert.deepEqual(Object.keys(BUNDESLAENDER).sort(), Object.keys(erwartet).sort());
  for (const [land, n] of Object.entries(erwartet)) {
    const liste = feiertage(land, 2026);
    assert.equal(liste.filter((f) => !f.teilweise).length, n, land);
    assert.deepEqual(liste.map((f) => f.datum), liste.map((f) => f.datum).sort(), `${land} sortiert`);
  }
});

test('Feiertage: einzelne Daten und Besonderheiten', () => {
  const namen = (land: string, jahr: number) => Object.fromEntries(feiertage(land, jahr).map((f) => [f.name, f]));
  const nw = namen('NW', 2026);
  assert.equal(nw['Karfreitag'].datum, '2026-04-03');
  assert.equal(nw['Christi Himmelfahrt'].datum, '2026-05-14');
  assert.equal(nw['Pfingstmontag'].datum, '2026-05-25');
  assert.equal(nw['Fronleichnam'].datum, '2026-06-04');
  assert.equal(namen('SN', 2026)['Buß- und Bettag'].datum, '2026-11-18');
  assert.equal(namen('SN', 2026)['Fronleichnam'].teilweise, true);
  assert.equal(namen('BY', 2026)['Mariä Himmelfahrt'].teilweise, true);
  assert.equal(namen('SL', 2026)['Mariä Himmelfahrt'].teilweise, undefined);
  assert.equal(namen('HH', 2017)['Reformationstag'].datum, '2017-10-31', '2017 einmalig überall');
  assert.equal(namen('NW', 2017)['Reformationstag'].datum, '2017-10-31');
  assert.equal(namen('HH', 2016)['Reformationstag'], undefined);
  assert.equal(namen('HH', 2026)['Reformationstag'].datum, '2026-10-31');
  assert.equal(namen('NW', 2026)['Reformationstag'], undefined);
  assert.equal(namen('BE', 2018)['Internationaler Frauentag'], undefined);
  assert.equal(namen('BE', 2026)['Internationaler Frauentag'].datum, '2026-03-08');
  assert.equal(namen('MV', 2022)['Internationaler Frauentag'], undefined);
  assert.equal(namen('BE', 2025)['Tag der Befreiung'].datum, '2025-05-08');
  assert.equal(namen('BE', 2026)['Tag der Befreiung'], undefined);
  assert.equal(feiertage('BE', 2028).filter((f) => f.datum === '2028-06-17').length, 1, 'einmaliger Feiertag in Berlin');
  assert.equal(feiertage('BE', 2027).filter((f) => f.datum.endsWith('-06-17')).length, 0);
  assert.equal(feiertage('HH', 2028).filter((f) => f.datum === '2028-06-17').length, 0);
  assert.equal(namen('TH', 2026)['Weltkindertag'].datum, '2026-09-20');
  assert.deepEqual(feiertageZwischen('HH', '2026-12-20', '2027-01-05').map((f) => f.datum), ['2026-12-25', '2026-12-26', '2027-01-01']);
});

test('Ferien: mitgelieferte Datei für Hamburg ist gültig', () => {
  const fehler: string[] = [];
  const hh = leseFerienDatei('content/ferien/HH.json', fehler);
  assert.deepEqual(fehler, []);
  assert.equal(hh.vorhanden, true);
  assert.ok(hh.zeiten.length >= 30);
  assert.ok(hh.quelle.length > 10 && gueltigesDatum(hh.stand));
  assert.ok(ferienZwischen(hh, '2026-12-01', '2027-01-15').some((z) => z.name === 'Weihnachtsferien'));
});

test('Ferien: fehlende Datei, kaputte Einträge, Änderungen ohne Neustart', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ap-content-'));
  mkdirSync(join(dir, 'ferien'));
  assert.equal(ladeFerien(dir, 'BY').vorhanden, false);
  assert.equal(ladeFerien(dir, '../HH').vorhanden, false, 'nur Kürzel, keine Pfade');
  const datei = join(dir, 'ferien', 'BY.json');
  writeFileSync(datei, JSON.stringify({ quelle: 'Test', stand: '2026-01-01', ferien: [{ name: 'Sommerferien', von: '2026-08-03', bis: '2026-09-14' }, { name: '', von: '2026-01-01', bis: '2026-01-02' }, { name: 'Falsch', von: '2026-05-10', bis: '2026-05-01' }, { name: 'Kein Datum', von: 'x', bis: 'y' }] }));
  const logs: string[] = [];
  const by = ladeFerien(dir, 'BY', (t) => logs.push(t));
  assert.equal(by.vorhanden, true);
  assert.deepEqual(by.zeiten.map((z) => z.name), ['Sommerferien']);
  assert.equal(logs.length, 3, 'drei fehlerhafte Einträge gemeldet');
  writeFileSync(datei, '{kaputt');
  // mtime kann bei schnellem Schreiben gleich bleiben – direkt prüfen statt über den Zwischenspeicher
  const fehler: string[] = [];
  assert.equal(leseFerienDatei(datei, fehler).vorhanden, false);
  assert.match(fehler[0], /Ungültiges JSON/);
});
