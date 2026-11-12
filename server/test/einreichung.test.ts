import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { vergissLernpakete } from '../lernen';
import type { BenutzerZeile } from '../typen';
import { baueZip, leseZip, ZipFehler } from '../zip';
import { admin, koerper, konto, ohneWechsel, ruf, sitzung, umgebung } from './hilfe';

const G = { maxDateien: 10, maxDatei: 1000, maxGesamt: 3000 };
const THEMA = (merksatz: string) => `---\ntitel: Wirtschaft\n---\n\nVerträge und Recht.\n\n## Ausbildungsvertrag {#vertrag}\n\n### Kernbegriffe\n- **Probezeit:** Ein bis vier Monate.\n\n### Merksatz\n${merksatz}\n`;
const paket = (merksatz = 'Probezeit: 1 bis 4 Monate.', davor = '') => [
  { name: `${davor}paket.json`, daten: JSON.stringify({ titel: 'Kaufleute für Büromanagement', quelle: 'Muster GmbH', lizenz: 'intern' }) },
  { name: `${davor}meta.json`, daten: JSON.stringify({ stand: '2026-11-10' }) },
  { name: `${davor}themenfelder.json`, daten: JSON.stringify([{ id: 'wiso', icon: 'scale', lernfelder: ['LF 1'], pruefung: ['AP1'] }]) },
  { name: `${davor}themen/wiso.md`, daten: THEMA(merksatz) },
];

test('ZIP-Leser: gespeichert und gepackt; Fallen werden abgelehnt', () => {
  const dateien = [{ name: 'a.txt', daten: 'Hallo' }, { name: 'ordner/ä.txt', daten: 'x'.repeat(500) }];
  for (const packen of [false, true]) assert.deepEqual(leseZip(baueZip(dateien, packen), G).map((d) => [d.name, d.daten.toString()]), [['a.txt', 'Hallo'], ['ordner/ä.txt', 'x'.repeat(500)]]);
  // Systemdateien vom Mac werden übergangen
  assert.deepEqual(leseZip(baueZip([{ name: '__MACOSX/._a', daten: 'x' }, { name: 'a/.DS_Store', daten: 'x' }, { name: 'a.txt', daten: 'y' }]), G).map((d) => d.name), ['a.txt']);
  const lehntAb = (zip: Buffer, was: RegExp, g = G) => assert.throws(() => leseZip(zip, g), (e: unknown) => e instanceof ZipFehler && was.test(e.message));
  lehntAb(Buffer.from('das ist kein Archiv, nur Text'), /keine ZIP-Datei/);
  for (const name of ['../boese.txt', 'a/../../boese.txt', '/etc/passwd', 'C:/x.txt', 'a//b.txt', 'a\\..\\b.txt']) lehntAb(baueZip([{ name, daten: 'x' }]), /Unzulässiger Dateiname/);
  lehntAb(baueZip([{ name: 'gross.txt', daten: 'x'.repeat(1001) }]), /zu groß \(höchstens/);
  lehntAb(baueZip([1, 2, 3, 4].map((i) => ({ name: `${i}.txt`, daten: 'x'.repeat(900) }))), /entpackt zu groß/);
  lehntAb(baueZip(Array.from({ length: 11 }, (_, i) => ({ name: `${i}.txt`, daten: 'x' }))), /zu viele Dateien/);
  // Archiv, das sich größer aufbläht als angekündigt: Im Verzeichnis steht eine kleine Größe
  const bombe = baueZip([{ name: 'b.txt', daten: 'x'.repeat(900) }], true);
  const eintrag = bombe.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  bombe.writeUInt32LE(10, eintrag + 24);
  lehntAb(bombe, /lässt sich nicht entpacken|beschädigt/);
  // abgeschnitten
  lehntAb(baueZip(dateien).subarray(0, 60), /unvollständig oder beschädigt/);
});

async function welt() {
  vergissLernpakete();
  const daten = mkdtempSync(join(tmpdir(), 'portal-daten-'));
  const u = await umgebung({ DATA_DIR: daten, LERN_DIR: mkdtempSync(join(tmpdir(), 'lern-leer-')) });
  ohneWechsel(u.db, admin(u.db).id);
  return { u, daten, chef: admin(u.db), petra: konto(u.db, 'ausbilder', 'Petra Lang'), olaf: konto(u.db, 'ausbilder', 'Olaf Berg'), bea: konto(u.db, 'beauftragter', 'Bea Auft'), anna: konto(u.db, 'azubi', 'Anna Azubi') };
}
type Welt = Awaited<ReturnType<typeof welt>>;
const als = (w: Welt, wer: BenutzerZeile) => sitzung(w.u, wer);
const reiche = (w: Welt, wer: BenutzerZeile, zip: Buffer | undefined, kennung = 'buero', notiz = '') => ruf(w.u, 'POST', `/api/lernpakete/einreichungen?kennung=${encodeURIComponent(kennung)}&notiz=${encodeURIComponent(notiz)}`, { cookies: als(w, wer), body: zip });
const tue = (w: Welt, wer: BenutzerZeile, id: number, aktion: string, body: unknown = {}) => ruf(w.u, 'POST', `/api/lernpakete/einreichungen/${id}/${aktion}`, { cookies: als(w, wer), body });
const liste = async (w: Welt, wer: BenutzerZeile) => koerper(await ruf(w.u, 'GET', '/api/lernpakete/einreichungen', { cookies: als(w, wer) }));

test('Einreichen: Das Portal prüft sofort; mit Fehlern wird nichts angenommen', async () => {
  const w = await welt();
  // gültig – auch wenn alles in einem Ordner steckt und Fremdes dabei liegt
  const r = await reiche(w, w.petra, baueZip([...paket('Probezeit: 1 bis 4 Monate.', 'buero-paket/'), { name: 'buero-paket/notizen.docx', daten: 'x' }, { name: 'liesmich.txt', daten: 'x' }], true), 'buero', 'Erste Fassung');
  assert.equal(r.status, 201);
  const e = koerper(r).einreichung;
  assert.deepEqual([e.status, e.kennung, e.titel, e.ausbilder, e.notiz, e.eigene, e.ersetzt], ['eingereicht', 'buero', 'Kaufleute für Büromanagement', 'Petra Lang', 'Erste Fassung', true, false]);
  assert.deepEqual([e.pruefung.themenfelder, e.pruefung.unterthemen, e.pruefung.dateien, e.pruefung.fehler, e.pruefung.ignoriert], [1, 1, 4, [], ['buero-paket/notizen.docx', 'liesmich.txt']]);
  assert.deepEqual(e.rechte, { zurueckziehen: true, entscheiden: false, laden: true });
  // solange eine Einreichung offen ist, keine zweite für dieselbe Kennung
  assert.equal((await reiche(w, w.olaf, baueZip(paket()))).status, 409);

  // Fehler im Inhalt: nichts wird gespeichert, die Liste nennt Datei und Zeile
  const kaputt = await reiche(w, w.petra, baueZip([...paket().slice(0, 3), { name: 'themen/wiso.md', daten: '---\ntitel: Wirtschaft\n---\n\n## Ohne Kennung\n' }]), 'kaputt');
  assert.equal(kaputt.status, 422);
  assert.match(koerper(kaputt).fehler, /wurde nicht eingereicht/);
  assert.ok(koerper(kaputt).pruefung.fehler.some((f: string) => f.startsWith('themen/wiso.md')));
  // der Planer (planer.md) gehört zum Paket: Er wird mitgeprüft, Fehler nennen Datei und Zeile
  const planerKaputt = await reiche(w, w.petra, baueZip([...paket(), { name: 'planer.md', daten: '---\ntitel: Fachaufgabe\n---\n\n## Termine\n- Abgabe ohne Kennung\n' }]), 'mit-planer');
  assert.equal(planerKaputt.status, 422);
  assert.ok(koerper(planerKaputt).pruefung.fehler.some((f: string) => f.startsWith('planer.md:6')), JSON.stringify(koerper(planerKaputt).pruefung.fehler));
  const mitPlaner = await reiche(w, w.petra, baueZip([...paket(), { name: 'planer.md', daten: '---\ntitel: Fachaufgabe\n---\n\n## Termine\n- Abgabe am {#abgabe}\n' }]), 'mit-planer');
  assert.equal(mitPlaner.status, 201);
  assert.equal(koerper(mitPlaner).einreichung.pruefung.planer, 'Fachaufgabe');
  assert.deepEqual(koerper(mitPlaner).einreichung.pruefung.ignoriert, [], 'planer.md wird übernommen');
  assert.equal(e.pruefung.planer, '', 'Paket ohne Planer');
  assert.equal((await tue(w, w.petra, koerper(mitPlaner).einreichung.id, 'zurueckziehen')).status, 200);
  for (const [zip, kennung, status] of [
    [baueZip([{ name: 'irgendwas.txt', daten: 'x' }]), 'x', 422], // kein Inhaltspaket
    [Buffer.from('kein zip'), 'x', 422],
    [undefined, 'x', 400],
    [baueZip(paket()), 'Großbuchstaben', 400],
    [baueZip(paket()), '../oben', 400],
    [baueZip(paket()), '', 400],
  ] as const) assert.equal((await reiche(w, w.petra, zip as Buffer | undefined, kennung)).status, status, kennung);
  assert.equal((await liste(w, w.petra)).einreichungen.length, 2); // die gültige und die zurückgezogene mit Planer
  // nur Ausbilder reichen ein
  for (const wer of [w.bea, w.anna, w.chef]) assert.equal((await reiche(w, wer, baueZip(paket()), 'andere')).status, 403, wer.rolle);
});

test('Prüfen: zurückgeben mit Rückmeldung oder übernehmen – übernommene Inhalte gelten sofort', async () => {
  const w = await welt();
  const id = koerper(await reiche(w, w.petra, baueZip(paket()))).einreichung.id as number;
  // der Super-Admin sieht sie und kann die ZIP-Datei laden; andere Ausbilder sehen sie, laden aber nicht
  const beimChef = await liste(w, w.chef);
  assert.deepEqual([beimChef.offen, beimChef.einreichungen[0].rechte], [1, { zurueckziehen: false, entscheiden: true, laden: true }]);
  assert.deepEqual((await liste(w, w.olaf)).einreichungen[0].rechte, { zurueckziehen: false, entscheiden: false, laden: false });
  const zip = await ruf(w.u, 'GET', `/api/lernpakete/einreichungen/${id}/zip`, { cookies: als(w, w.chef) });
  assert.deepEqual([zip.status, zip.datei?.dateiname, leseZip(zip.datei!.inhalt, { maxDateien: 10, maxDatei: 9999, maxGesamt: 99999 }).length], [200, `buero-einreichung-${id}.zip`, 4]);
  assert.equal((await ruf(w.u, 'GET', `/api/lernpakete/einreichungen/${id}/zip`, { cookies: als(w, w.olaf) })).status, 403);
  for (const wer of [w.bea, w.anna]) assert.equal((await ruf(w.u, 'GET', '/api/lernpakete/einreichungen', { cookies: als(w, wer) })).status, 403);

  // zurückgeben: nur der Super-Admin, nur mit Rückmeldung; die ZIP-Datei wird gelöscht
  assert.equal((await tue(w, w.petra, id, 'zurueckgeben', { rueckmeldung: 'x' })).status, 403);
  assert.equal((await tue(w, w.chef, id, 'zurueckgeben', {})).status, 400);
  const zurueck = koerper(await tue(w, w.chef, id, 'zurueckgeben', { rueckmeldung: 'Im Themenfeld WiSo fehlt die Kündigung.' })).einreichung;
  assert.deepEqual([zurueck.status, zurueck.rueckmeldung, zurueck.geprueftVon, zurueck.rechte.laden], ['zurueck', 'Im Themenfeld WiSo fehlt die Kündigung.', admin(w.u.db).anzeigename, false]);
  assert.equal((await ruf(w.u, 'GET', `/api/lernpakete/einreichungen/${id}/zip`, { cookies: als(w, w.chef) })).status, 404);
  assert.equal((await tue(w, w.chef, id, 'uebernehmen')).status, 409, 'entschieden ist entschieden');
  assert.equal((await liste(w, w.petra)).einreichungen[0].rueckmeldung, 'Im Themenfeld WiSo fehlt die Kündigung.');

  // neue Fassung einreichen und übernehmen
  const id2 = koerper(await reiche(w, w.petra, baueZip(paket('Probezeit: mindestens 1, höchstens 4 Monate.'), true))).einreichung.id as number;
  assert.equal((await tue(w, w.petra, id2, 'uebernehmen')).status, 403);
  const fertig = koerper(await tue(w, w.chef, id2, 'uebernehmen', { kommentar: 'Danke, ist online.' })).einreichung;
  assert.deepEqual([fertig.status, fertig.rueckmeldung, fertig.ersetzt], ['hochgeladen', 'Danke, ist online.', true]);
  assert.ok(readFileSync(join(w.daten, 'lerninhalte', 'buero', 'themen', 'wiso.md'), 'utf8').includes('mindestens 1, höchstens 4'));
  assert.ok(!existsSync(join(w.daten, 'lerninhalte', 'buero.neu')) && !existsSync(join(w.daten, 'lerninhalte', 'buero.alt')));
  // das Paket ist sofort da: in den Stammdaten wählbar und in der Leseansicht
  const pakete = koerper(await ruf(w.u, 'GET', '/api/stammdaten', { cookies: als(w, w.petra) })).lernpakete;
  assert.deepEqual(pakete.map((p: { id: string; herkunft: string; themenfelder: number }) => [p.id, p.herkunft, p.themenfelder]), [['buero', 'portal', 1]]);
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/lerninhalte/buero/thema/wiso', { cookies: als(w, w.bea) })).thema.unterthemen[0].merksatz, 'Probezeit: mindestens 1, höchstens 4 Monate.');
  assert.ok(w.u.logs.some((l) => l.startsWith('Lerninhalte übernommen: Paket „buero“')));

  // eine dritte Fassung ersetzt die zweite vollständig (auch Dateien, die es nicht mehr gibt)
  const drei = [...paket('Dritte Fassung.'), { name: 'bilder/alt.svg', daten: '<svg xmlns="http://www.w3.org/2000/svg"/>' }];
  const id3 = koerper(await reiche(w, w.olaf, baueZip(drei))).einreichung.id as number;
  await tue(w, w.chef, id3, 'uebernehmen');
  assert.ok(existsSync(join(w.daten, 'lerninhalte', 'buero', 'bilder', 'alt.svg')));
  const id4 = koerper(await reiche(w, w.olaf, baueZip(paket('Vierte Fassung.')))).einreichung.id as number;
  await tue(w, w.chef, id4, 'uebernehmen');
  assert.ok(!existsSync(join(w.daten, 'lerninhalte', 'buero', 'bilder', 'alt.svg')));
});

test('Zurückziehen: nur wer eingereicht hat, nur solange offen', async () => {
  const w = await welt();
  const id = koerper(await reiche(w, w.petra, baueZip(paket()))).einreichung.id as number;
  assert.equal((await tue(w, w.olaf, id, 'zurueckziehen')).status, 403);
  assert.equal(koerper(await tue(w, w.petra, id, 'zurueckziehen')).einreichung.status, 'zurueckgezogen');
  assert.equal((await tue(w, w.petra, id, 'zurueckziehen')).status, 409);
  assert.equal((await tue(w, w.chef, id, 'uebernehmen')).status, 409);
  assert.equal((await liste(w, w.chef)).offen, 0);
  assert.equal((await tue(w, w.chef, 9999, 'uebernehmen')).status, 404);
  // danach ist die Kennung wieder frei
  assert.equal((await reiche(w, w.olaf, baueZip(paket()))).status, 201);
});

test('Einreichung benachrichtigt den Teams-Kanal – ohne Namen, mit Link zur Prüfung', async () => {
  vergissLernpakete();
  const karten: { url: string; body: unknown }[] = [];
  const u = await umgebung({ DATA_DIR: mkdtempSync(join(tmpdir(), 'portal-daten-')), LERN_DIR: mkdtempSync(join(tmpdir(), 'lern-leer-')), FEHLER_WEBHOOK_URL: 'https://teams.example/webhook/geheim' }, null, async (url, body) => {
    karten.push({ url, body });
    return { ok: true, status: 202 };
  });
  const petra = konto(u.db, 'ausbilder', 'Petra Lang');
  const r = await ruf(u, 'POST', '/api/lernpakete/einreichungen?kennung=buero', { cookies: sitzung(u, petra), body: baueZip(paket()) });
  assert.equal(r.status, 201);
  await new Promise((ok) => setImmediate(ok));
  assert.equal(karten.length, 1);
  const text = JSON.stringify(karten[0].body);
  assert.ok(text.includes('Lerninhalte im Ausbildungsportal eingereicht') && text.includes('Kaufleute für Büromanagement (buero)') && text.includes('/verwaltung/lerninhalte'));
  assert.ok(!text.includes('Petra'), 'kein Name im Kanal');
  // ein kaputtes Paket löst nichts aus
  await ruf(u, 'POST', '/api/lernpakete/einreichungen?kennung=x', { cookies: sitzung(u, petra), body: Buffer.from('kein zip') });
  assert.equal(karten.length, 1);
});
