import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { bereiteImportOrdner } from '../import-dienst';
import { ausModell, erkenneBloecke, nurAngelegte, zusammenfuehren } from '../schulplan';
import type { BenutzerZeile } from '../typen';
import { koerper, konto, ruf, sitzung, umgebung, zustaendig } from './hilfe';
import type { Umgebung } from './hilfe';

// „heute“ ist in der Testumgebung Dienstag, der 10.11.2026.
const PDF_TEXT = `Blockplan Schuljahr 2026/27
Berufliche Schule Musterstadt – Fachinformatiker

Klasse      Block 1              Block 2             Block 3
FI 25a 31.08.–18.09.2026 09.11.–27.11.2026         KW 5–7 2027
FI 25b 21.09.–09.10.2026 30.11.2026 – 18.12.2026 15.2.27 - 5.3.27

Herbstferien 12.10.–23.10.2026`;

// so liefert die Texterkennung den Scan desselben Plans
const SCAN_TEXT = `Blockplan Schuljahr 2026/27
Berufliche Schule Musterstadt — Fachinformatiker

[Klasse Block || Block 2 I Block3 |
| FI 25a |31.08.-18.09.2026)09.11.-27.11.2026 KW 5-7 2027

| FI 25b |21.09.-09.10.2026 |30.11.2026 — 18.12.2026/|15.2.27 - 5.3.27
Herbstferien 12.10.-23.10.2026`;

const KLASSEN = [{ name: 'FI-25a' }, { name: 'FI-25b' }];
const ERWARTET = [
  ['FI-25a', '2026-08-31', '2026-09-18'],
  ['FI-25a', '2026-11-09', '2026-11-27'],
  ['FI-25a', '2027-02-01', '2027-02-19'],
  ['FI-25b', '2026-09-21', '2026-10-09'],
  ['FI-25b', '2026-11-30', '2026-12-18'],
  ['FI-25b', '2027-02-15', '2027-03-05'],
];
const sortiert = (r: { klasse: string; von: string; bis: string }[]) => r.map((x) => [x.klasse, x.von, x.bis]).sort((a, b) => a.join().localeCompare(b.join()));

test('Schulplan: Muster finden Zeiträume und Kalenderwochen der angelegten Klassen – Ferien nicht', () => {
  assert.deepEqual(sortiert(erkenneBloecke(PDF_TEXT, KLASSEN, '2026-11-10')), ERWARTET);
  assert.deepEqual(sortiert(erkenneBloecke(SCAN_TEXT, KLASSEN, '2026-11-10')), ERWARTET);
  // nur angelegte Klassen: Die Zeilen der FI 25b gehören nicht zur FI-25a darüber
  assert.deepEqual(sortiert(erkenneBloecke(PDF_TEXT, [{ name: 'FI-25a' }], '2026-11-10')), ERWARTET.slice(0, 3));
  // ohne angelegte Klasse im Plan: Zeiträume ohne Klasse, zum Zuordnen; ohne Jahr aus dem Zusammenhang, über den Jahreswechsel
  const ohneJahr = erkenneBloecke('Plan 2027\nIT-26c 14.12.–15.01.', KLASSEN, '2026-11-10');
  assert.deepEqual(ohneJahr.map((r) => [r.klasse, r.von, r.bis, r.unsicher]), [['', '2026-12-14', '2027-01-15', true]]);
  // ungültige Daten fallen weg
  assert.deepEqual(erkenneBloecke('FI 25a 31.02.–05.03.2027', KLASSEN, '2026-11-10'), []);
});

test('Schulplan: Klassen in Blöcke eingeteilt – die Klassen unter einem Block bekommen seine Zeiträume, Blöcke sind keine Klassen', () => {
  const text = `Blockplan Schuljahr 2026/27
Block A        31.08.–18.09.2026        09.11.–27.11.2026
               FI 25a     FI 25b
Block B        21.09.–09.10.2026        30.11.–18.12.2026
               FI 25c
               IT 25a
Herbstferien 12.10.–23.10.2026`;
  const r = erkenneBloecke(text, [...KLASSEN, { name: 'IT-25a' }], '2026-11-10');
  assert.deepEqual(sortiert(r), [
    ['FI-25a', '2026-08-31', '2026-09-18'],
    ['FI-25a', '2026-11-09', '2026-11-27'],
    ['FI-25b', '2026-08-31', '2026-09-18'],
    ['FI-25b', '2026-11-09', '2026-11-27'],
    ['IT-25a', '2026-09-21', '2026-10-09'],
    ['IT-25a', '2026-11-30', '2026-12-18'],
  ]);
  // auch in einer Zeile: Block, Zeitraum und mehrere Klassen
  assert.deepEqual(sortiert(erkenneBloecke('Block 1: 31.08.–18.09.2026 für FI 25a, FI 25b', KLASSEN, '2026-11-10')), [
    ['FI-25a', '2026-08-31', '2026-09-18'],
    ['FI-25b', '2026-08-31', '2026-09-18'],
  ]);
  // das Sprachmodell: nur angelegte Klassen, in der Schreibweise des Portals – „Block 2“ ist keine
  assert.deepEqual(
    nurAngelegte(ausModell({ bloecke: [{ klasse: 'FI 25a', von: '2026-08-31', bis: '2026-09-18', titel: '' }, { klasse: 'Block 2', von: '2026-09-21', bis: '2026-10-09', titel: '' }] }), KLASSEN).map((x) => x.klasse),
    ['FI-25a'],
  );
});

test('Schulplan: Antwort des Sprachmodells nur in der festen Form', () => {
  assert.deepEqual(ausModell({ bloecke: [{ klasse: ' FI 25a ', von: '2026-08-31', bis: '2026-09-18', titel: '' }, { klasse: 'x', von: '31.08.2026', bis: '2026-09-18' }, null] }), [
    { klasse: 'FI 25a', von: '2026-08-31', bis: '2026-09-18', titel: 'Berufsschule', unsicher: false },
  ]);
  assert.deepEqual(ausModell({ nichts: 1 }), []);
  assert.deepEqual(ausModell(null), []);
});

test('Schulplan: Muster zuerst – das Sprachmodell ergänzt nur, erfundene Daten fallen weg', () => {
  // so hat das Sprachmodell den erfundenen Blockplan im CI gelesen: Block 1 richtig, Block 2 und 3 mit falschen Daten
  const modell = ausModell({
    bloecke: [
      { klasse: 'FI 25a', von: '2026-08-31', bis: '2026-09-18', titel: 'Block 1' },
      { klasse: 'FI 25a', von: '2027-09-05', bis: '2027-11-27', titel: 'Block 2' },
      { klasse: 'FI 25a', von: '2027-05-05', bis: '2027-07-07', titel: 'Block 3' },
      { klasse: 'FI 25b', von: '2026-09-21', bis: '2026-10-09', titel: 'Block 1' },
    ],
  });
  const r = zusammenfuehren(erkenneBloecke(PDF_TEXT, KLASSEN, '2026-11-10'), nurAngelegte(modell, KLASSEN), PDF_TEXT);
  assert.deepEqual(sortiert(r), ERWARTET, 'genau die sechs Blöcke aus dem Plan – nichts Erfundenes');
  assert.equal(r.find((x) => x.von === '2026-08-31')?.titel, 'Block 1', 'Titel des Modells übernommen');
  assert.ok(r.every((x) => !x.nurModell));
  // was nur das Modell findet und so im Text steht, kommt als „bitte prüfen“ dazu
  const extra = zusammenfuehren([], nurAngelegte(ausModell({ bloecke: [{ klasse: 'FI 25b', von: '2026-11-30', bis: '2026-12-18', titel: 'Block 2' }] }), KLASSEN), PDF_TEXT);
  assert.deepEqual(extra.map((x) => [x.von, x.nurModell, x.unsicher]), [['2026-11-30', true, true]]);
});

interface Welt {
  u: Umgebung;
  petra: BenutzerZeile;
  anna: BenutzerZeile;
  schule: number;
  a: number;
  ordner: string;
}

async function welt(): Promise<Welt> {
  const daten = mkdtempSync(join(tmpdir(), 'ap-schulplan-'));
  const u = await umgebung({ DATA_DIR: daten });
  const petra = konto(u.db, 'ausbilder', 'Petra Lang');
  const anna = konto(u.db, 'azubi', 'Anna Azubi');
  zustaendig(u.db, anna, petra);
  const c = sitzung(u, petra);
  const schule = koerper(await ruf(u, 'POST', '/api/stammdaten/berufsschulen', { cookies: c, body: { name: 'Berufliche Schule Musterstadt', bundesland: 'HH', form: 'block' } })).berufsschule.id as number;
  const a = koerper(await ruf(u, 'POST', '/api/stammdaten/klassen', { cookies: c, body: { berufsschuleId: schule, name: 'FI-25a' } })).klasse.id as number;
  await ruf(u, 'PUT', `/api/azubis/${anna.id}/profil`, { cookies: c, body: { ausbildungsbeginn: '2025-08-01', ausbilderId: petra.id, berufsschuleId: schule, klasseId: a } });
  return { u, petra, anna, schule, a, ordner: join(daten, 'import') };
}

test('Schulplan: ohne Dienst gleich eine Vorschau aus dem Text; PDF geht dann nicht', async () => {
  const w = await welt();
  const c = sitzung(w.u, w.petra);
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/schulbloecke/einlesen', { cookies: c })).dienst, false);
  const r = koerper(await ruf(w.u, 'POST', '/api/schulbloecke/einlesen', { cookies: c, body: { schuleId: w.schule, text: PDF_TEXT } }));
  assert.equal(r.status, 'fertig');
  const fi25a = r.zeilen.filter((z: { klasseId: number | null }) => z.klasseId === w.a);
  assert.equal(fi25a.length, 3, 'FI 25a ist die Klasse FI-25a');
  assert.ok(fi25a.every((z: { vorgewaehlt: boolean }) => z.vorgewaehlt));
  // die FI 25b ist nicht angelegt: ihre Zeilen kommen gar nicht vor
  assert.equal(r.zeilen.length, 3);
  // die PDF verlangt den Dienst
  const pdf = await ruf(w.u, 'POST', `/api/schulbloecke/einlesen?schule=${w.schule}`, { cookies: c, body: Buffer.from('%PDF-1.7 Test') });
  assert.equal(pdf.status, 409);
  assert.equal((await ruf(w.u, 'POST', `/api/schulbloecke/einlesen?schule=${w.schule}`, { cookies: c, body: Buffer.from('kein pdf') })).status, 400);
  assert.equal((await ruf(w.u, 'POST', '/api/schulbloecke/einlesen', { cookies: c, body: { schuleId: w.schule, text: '' } })).status, 400);
  assert.equal((await ruf(w.u, 'POST', '/api/schulbloecke/einlesen', { cookies: c, body: { schuleId: 999, text: 'x' } })).status, 400);

  // übernehmen: Blöcke an der Klasse, im Plan von Anna; doppelt Übernommenes zählt nicht
  const zeilen = fi25a.map((z: { klasseId: number; von: string; bis: string; titel: string }) => ({ klasseId: z.klasseId, von: z.von, bis: z.bis, titel: z.titel }));
  const ue = koerper(await ruf(w.u, 'POST', '/api/schulbloecke/uebernehmen', { cookies: c, body: { zeilen } }));
  assert.deepEqual([ue.angelegt, ue.azubis], [3, 1]);
  assert.equal((koerper(await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/plan`, { cookies: sitzung(w.u, w.anna) })).eintraege as { art: string }[]).filter((e) => e.art === 'schule').length, 3);
  assert.equal(koerper(await ruf(w.u, 'POST', '/api/schulbloecke/uebernehmen', { cookies: c, body: { zeilen } })).angelegt, 0);
  // in der nächsten Vorschau als „schon vorhanden“
  const nochmal = koerper(await ruf(w.u, 'POST', '/api/schulbloecke/einlesen', { cookies: c, body: { schuleId: w.schule, text: PDF_TEXT } }));
  assert.ok(nochmal.zeilen.filter((z: { klasseId: number | null }) => z.klasseId === w.a).every((z: { hinweise: string[]; vorgewaehlt: boolean }) => z.hinweise.includes('schon vorhanden') && !z.vorgewaehlt));
  assert.equal((await ruf(w.u, 'POST', '/api/schulbloecke/uebernehmen', { cookies: c, body: { zeilen: [{ klasseId: null, von: '2027-01-04', bis: '2027-01-08' }] } })).status, 400);
});

test('Schulplan: mit Dienst ein Auftrag im Arbeitsordner – nur für die eigene Person, Vorschlag des Modells geprüft', async () => {
  const w = await welt();
  const c = sitzung(w.u, w.petra);
  mkdirSync(w.ordner, { recursive: true });
  writeFileSync(join(w.ordner, '.bereit'), '');
  // der Dienst läuft: Lebenszeichen „gerade eben“ in der Zeit der Testumgebung
  utimesSync(join(w.ordner, '.bereit'), w.u.uhr.jetzt, w.u.uhr.jetzt);
  const r = await ruf(w.u, 'POST', `/api/schulbloecke/einlesen?schule=${w.schule}`, { cookies: c, body: Buffer.from('%PDF-1.7 erfundener Plan') });
  assert.equal(r.status, 202);
  const id = koerper(r).id as string;
  assert.match(id, /^[0-9a-f]{32}$/);
  assert.deepEqual(readdirSync(join(w.ordner, id)).sort(), ['art', 'auftrag', 'eingang.pdf', 'klassen.txt', 'schule', 'wer']);
  // das Sprachmodell bekommt die angelegten Klassen der Schule
  assert.equal(readFileSync(join(w.ordner, id, 'klassen.txt'), 'utf8'), 'FI-25a');
  assert.equal(koerper(await ruf(w.u, 'GET', `/api/schulbloecke/einlesen/${id}`, { cookies: c })).status, 'laeuft');
  // eine andere Person sieht den Auftrag nicht
  const bea = konto(w.u.db, 'ausbilder', 'Bea Zweite');
  assert.equal((await ruf(w.u, 'GET', `/api/schulbloecke/einlesen/${id}`, { cookies: sitzung(w.u, bea) })).status, 404);

  // der Dienst ist fertig: Text und Vorschlag des Modells (eine Zeile davon unsinnig)
  writeFileSync(join(w.ordner, id, 'text.txt'), PDF_TEXT);
  writeFileSync(join(w.ordner, id, 'ergebnis.json'), JSON.stringify({ bloecke: [{ klasse: 'FI 25a', von: '2026-08-31', bis: '2026-09-18', titel: 'Block 1' }, { klasse: 'FI 25a', von: '2030-01-07', bis: '2030-01-11', titel: 'Unsinn' }] }));
  writeFileSync(join(w.ordner, id, 'fertig'), 'modell=ja\nquelle=texterkennung\n');
  const s = koerper(await ruf(w.u, 'GET', `/api/schulbloecke/einlesen/${id}`, { cookies: c }));
  assert.equal(s.status, 'fertig');
  assert.equal(s.modell, true);
  assert.equal(s.quelle, 'texterkennung');
  // Muster zuerst: die drei Blöcke der angelegten Klasse, der Titel des Modells für Block 1 – „Unsinn“ steht so nicht im Plan und fällt weg
  assert.equal(s.zeilen.length, 3);
  assert.ok(!s.zeilen.some((z: { titel: string }) => z.titel === 'Unsinn'));
  assert.deepEqual(s.zeilen.filter((z: { klasseId: number | null }) => z.klasseId === w.a).map((z: { titel: string; vorgewaehlt: boolean }) => [z.titel, z.vorgewaehlt]), [['Block 1', true], ['Berufsschule', true], ['Berufsschule', true]]);
  assert.ok(s.zeilen.every((z: { unsicher: boolean }) => z.unsicher), 'Texterkennung ist unsicher');
  // übernehmen löscht den Auftrag
  await ruf(w.u, 'POST', '/api/schulbloecke/uebernehmen', { cookies: c, body: { auftrag: id, zeilen: [{ klasseId: w.a, von: '2026-08-31', bis: '2026-09-18', titel: 'Block 1' }] } });
  assert.equal((await ruf(w.u, 'GET', `/api/schulbloecke/einlesen/${id}`, { cookies: c })).status, 404);

  // Fehler des Dienstes kommen an; verwerfen löscht
  const f = koerper(await ruf(w.u, 'POST', '/api/schulbloecke/einlesen', { cookies: c, body: { schuleId: w.schule, text: PDF_TEXT } })).id as string;
  writeFileSync(join(w.ordner, f, 'fehler'), 'Die PDF lässt sich nicht lesen.');
  assert.equal(koerper(await ruf(w.u, 'GET', `/api/schulbloecke/einlesen/${f}`, { cookies: c })).fehler, 'Die PDF lässt sich nicht lesen.');
  assert.equal((await ruf(w.u, 'DELETE', `/api/schulbloecke/einlesen/${f}`, { cookies: c })).status, 200);
  assert.equal((await ruf(w.u, 'GET', `/api/schulbloecke/einlesen/${f}`, { cookies: c })).status, 404);
  assert.equal((await ruf(w.u, 'GET', '/api/schulbloecke/einlesen/../../etc', { cookies: c })).status, 404);
});

test('Start: die App legt den Austauschordner für den Dienst selbst an', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ap-import-'));
  const warnungen: string[] = [];
  bereiteImportOrdner(dir, (t) => warnungen.push(t));
  assert.ok(readdirSync(dir).includes('import'));
  bereiteImportOrdner(dir, (t) => warnungen.push(t)); // zweiter Start: nichts passiert
  assert.equal(warnungen.length, 0);
});
