import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_ANHAENGE, MAX_ANHANG, sichererName } from '../bericht-anhang';
import type { BenutzerZeile } from '../typen';
import { admin, koerper, konto, ohneWechsel, ruf, sitzung, umgebung, zuweisen } from './hilfe';
import type { Umgebung } from './hilfe';

// „heute“ ist in der Testumgebung Dienstag, der 10.11.2026.
const WOCHE = '2026-11-02';
const PFAD = 'M10 10 L20 20 L30 10 L40 20 L50 10 L60 20';
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(50, 2)]);
const PDF = Buffer.from('%PDF-1.7\n%test\n');
const ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(60, 3)]);

interface Welt {
  u: Umgebung;
  petra: BenutzerZeile;
  bea: BenutzerZeile;
  fremd: BenutzerZeile;
  anna: BenutzerZeile;
  ben: BenutzerZeile;
}

async function welt(form: 'woche' | 'tag' = 'woche'): Promise<Welt> {
  const u = await umgebung();
  ohneWechsel(u.db, admin(u.db).id);
  const w: Welt = { u, petra: konto(u.db, 'ausbilder', 'Petra Lang'), bea: konto(u.db, 'beauftragter', 'Bea Auft'), fremd: konto(u.db, 'beauftragter', 'Bodo Fremd'), anna: konto(u.db, 'azubi', 'Anna Azubi'), ben: konto(u.db, 'azubi', 'Ben Beispiel') };
  const c = sitzung(u, w.petra);
  await ruf(u, 'PUT', '/api/stammdaten/betrieb', { cookies: c, body: { name: 'Muster GmbH', bundesland: 'HH', berichtForm: form } });
  for (const a of [w.anna, w.ben]) await ruf(u, 'PUT', `/api/azubis/${a.id}/profil`, { cookies: c, body: { ausbildungsbeginn: '2025-08-01', ausbilderId: w.petra.id } });
  for (const wer of [w.petra, w.bea, w.anna, w.ben]) await ruf(u, 'PUT', '/api/ich/unterschrift', { cookies: sitzung(u, wer), body: { pfad: PFAD } });
  zuweisen(u.db, w.anna, w.bea);
  return w;
}

const als = (w: Welt, wer: BenutzerZeile) => sitzung(w.u, wer);
const bericht = (a: BenutzerZeile, rest = '') => `/api/azubis/${a.id}/berichte/${WOCHE}${rest}`;
const schreibe = (w: Welt, inhalt: unknown, a = w.anna) => ruf(w.u, 'PUT', bericht(a), { cookies: als(w, a), body: { inhalt } });
const lade = (w: Welt, name: string, daten: Buffer, tag = '', wer = w.anna, a = w.anna) => ruf(w.u, 'POST', bericht(a, `/anhaenge?name=${encodeURIComponent(name)}${tag ? `&tag=${tag}` : ''}`), { cookies: als(w, wer), body: daten });
const hole = (w: Welt, id: number, wer: BenutzerZeile, a = w.anna) => ruf(w.u, 'GET', bericht(a, `/anhaenge/${id}`), { cookies: als(w, wer) });
const lies = async (w: Welt, wer: BenutzerZeile, a = w.anna) => koerper(await ruf(w.u, 'GET', bericht(a), { cookies: als(w, wer) }));
const WOCHENINHALT = { betrieb: [{ text: 'Switch konfiguriert', stunden: 40 }], unterweisung: [], schule: [], abwesenheit: [] };

test('Anhänge: hochladen erst nach dem Speichern; erlaubt sind Bilder, PDF und Office ohne Makros – geprüft am Dateianfang', async () => {
  const w = await welt();
  // ohne gespeicherten Bericht geht es nicht
  const frueh = await lade(w, 'foto.jpg', JPG);
  assert.deepEqual([frueh.status, koerper(frueh).fehler], [409, 'Bitte den Bericht zuerst speichern – dann lassen sich Anhänge hinzufügen']);
  assert.equal((await schreibe(w, WOCHENINHALT)).status, 200);
  assert.deepEqual((await lies(w, w.anna)).anhaenge, []);

  const erste = await lade(w, 'C:\\Users\\anna\\Bilder\\Serverraum 1.JPG', JPG);
  assert.equal(erste.status, 201);
  assert.deepEqual(koerper(erste).anhaenge, [{ id: 1, tag: null, name: 'Serverraum 1.JPG', art: 'bild', vorschau: true, groesse: JPG.length }]);
  assert.equal((await lade(w, 'plan.pdf', PDF)).status, 201);
  assert.equal((await lade(w, 'liste.xlsx', ZIP)).status, 201);
  assert.equal((await lade(w, 'iphone.heic', Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic'), Buffer.alloc(20)]))).status, 201);
  const liste = (await lies(w, w.anna)).anhaenge;
  assert.deepEqual(liste.map((a: { name: string; art: string; vorschau: boolean }) => [a.name, a.art, a.vorschau]), [['Serverraum 1.JPG', 'bild', true], ['plan.pdf', 'pdf', false], ['liste.xlsx', 'office', false], ['iphone.heic', 'bild', false]]);

  // nicht erlaubt: falscher Typ, Makro-Formate, Inhalt passt nicht zur Endung, leer, zu groß, ohne Namen
  const fehler = async (name: string, daten: Buffer) => {
    const r = await lade(w, name, daten);
    return [r.status, koerper(r).fehler as string] as const;
  };
  assert.match((await fehler('skript.exe', ZIP))[1], /Dieser Dateityp ist nicht erlaubt\. Erlaubt sind Bilder/);
  assert.match((await fehler('bild.svg', Buffer.from('<svg/>')))[1], /nicht erlaubt/);
  assert.match((await fehler('alt.doc', ZIP))[1], /kann Makros enthalten.*DOCX oder als PDF/);
  assert.match((await fehler('makro.xlsm', ZIP))[1], /XLSX/);
  assert.match((await fehler('getarnt.jpg', PDF))[1], /kein gültiges JPG – ihr Inhalt passt nicht zur Endung/);
  assert.match((await fehler('getarnt.pdf', Buffer.from('<html><script>alert(1)</script>')))[1], /kein gültiges PDF/);
  assert.equal((await fehler('leer.pdf', Buffer.alloc(0)))[0], 400);
  assert.deepEqual(await fehler('riesig.pdf', Buffer.concat([PDF, Buffer.alloc(MAX_ANHANG)])), [413, 'Die Datei ist zu groß (höchstens 5 MB)']);
  assert.equal((await fehler('', PDF))[0], 400);
  // JSON statt Datei
  assert.equal((await ruf(w.u, 'POST', bericht(w.anna, '/anhaenge?name=a.pdf'), { cookies: als(w, w.anna), body: { daten: 'x' } })).status, 400);
  // Wochenform kennt keine Tage
  assert.match(koerper(await lade(w, 'tag.pdf', PDF, '2026-11-03')).fehler, /hat keine Tage/);
  assert.equal((await lies(w, w.anna)).anhaenge.length, 4);

  // Dateinamen werden entschärft
  assert.equal(sichererName('../../etc/passwd'), 'passwd');
  assert.equal(sichererName('a\r\nb"<x>.pdf'), 'abx.pdf');
  assert.equal(sichererName(`${'x'.repeat(200)}.pdf`).length, 120);
  assert.ok(sichererName(`${'x'.repeat(200)}.pdf`).endsWith('.pdf'));
});

test('Anhänge: sehen kann sie, wer den Bericht sieht; ändern nur der Azubi, solange der Bericht nicht eingereicht ist', async () => {
  const w = await welt();
  await schreibe(w, WOCHENINHALT);
  const id = koerper(await lade(w, 'foto.png', PNG)).anhaenge[0].id as number;
  const pdfId = koerper(await lade(w, 'plan.pdf', PDF)).anhaenge[1].id as number;

  // Bild wird angezeigt, PDF heruntergeladen – beides mit dem geprüften Typ
  const bild = await hole(w, id, w.anna);
  assert.deepEqual([bild.status, bild.bild?.typ, bild.bild?.inhalt.equals(PNG)], [200, 'image/png', true]);
  const pdf = await hole(w, pdfId, w.anna);
  assert.deepEqual([pdf.status, pdf.datei?.typ, pdf.datei?.dateiname, pdf.datei?.inhalt.equals(PDF)], [200, 'application/pdf', 'plan.pdf', true]);

  // Entwurf: niemand außer Anna – weder Liste noch Datei; niemand außer Anna lädt hoch oder entfernt
  for (const wer of [w.petra, w.bea, w.fremd, w.ben]) {
    assert.ok([403, 404].includes((await hole(w, id, wer)).status), `Entwurf: ${wer.anzeigename} sieht keinen Anhang`);
    assert.ok([403, 404].includes((await lade(w, 'x.pdf', PDF, '', wer)).status), `${wer.anzeigename} lädt nichts hoch`);
    assert.ok([403, 404].includes((await ruf(w.u, 'DELETE', bericht(w.anna, `/anhaenge/${id}`), { cookies: als(w, wer) })).status), `${wer.anzeigename} entfernt nichts`);
  }
  assert.deepEqual((await lies(w, w.petra)).anhaenge, []);
  assert.equal((await hole(w, id, admin(w.u.db))).status, 403);
  assert.equal((await ruf(w.u, 'GET', bericht(w.anna, `/anhaenge/${id}`))).status, 401);
  // ein Anhang lässt sich nicht über einen anderen Bericht oder Azubi abrufen
  await schreibe(w, WOCHENINHALT, w.ben);
  assert.equal((await hole(w, id, w.ben, w.ben)).status, 404);
  assert.equal((await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/berichte/2026-10-26/anhaenge/${id}`, { cookies: als(w, w.anna) })).status, 404);

  // eingereicht: Ausbilderin und zugewiesene Beauftragte sehen Liste und Dateien, der fremde Beauftragte nicht
  assert.equal((await ruf(w.u, 'POST', bericht(w.anna, '/einreichen'), { cookies: als(w, w.anna) })).status, 200);
  for (const wer of [w.petra, w.bea]) {
    assert.equal((await lies(w, wer)).anhaenge.length, 2, wer.anzeigename);
    assert.equal((await hole(w, id, wer)).status, 200, wer.anzeigename);
  }
  assert.ok([403, 404].includes((await hole(w, id, w.fremd)).status));
  // … und Anna kann nichts mehr ändern
  assert.match(koerper(await lade(w, 'spaet.pdf', PDF)).fehler, /eingereicht – zum Ändern zuerst zurückziehen/);
  assert.equal((await ruf(w.u, 'DELETE', bericht(w.anna, `/anhaenge/${id}`), { cookies: als(w, w.anna) })).status, 409);
  await ruf(w.u, 'POST', '/api/berichte/abzeichnen', { cookies: als(w, w.petra), body: { berichte: [{ azubiId: w.anna.id, montag: WOCHE }] } });
  assert.match(koerper(await lade(w, 'spaet.pdf', PDF)).fehler, /abgezeichnet und gesperrt/);
  assert.equal((await hole(w, id, w.anna)).status, 200);
});

test('Anhänge in der Tagesform gehören zu einem Tag; mit dem Entwurf verschwinden sie; Grenzen je Bericht', async () => {
  const w = await welt('tag');
  await schreibe(w, { betrieb: [{ text: 'Server gepatcht', stunden: 8, tag: '2026-11-03' }], unterweisung: [], schule: [], abwesenheit: [] });
  assert.match(koerper(await lade(w, 'ohne-tag.pdf', PDF)).fehler, /Der Tag muss in der Berichtswoche liegen/);
  assert.match(koerper(await lade(w, 'andere-woche.pdf', PDF, '2026-11-10')).fehler, /Der Tag muss in der Berichtswoche liegen/);
  assert.equal((await lade(w, 'mittwoch.pdf', PDF, '2026-11-04')).status, 201);
  assert.equal((await lade(w, 'dienstag.jpg', JPG, '2026-11-03')).status, 201);
  // nach Tagen geordnet
  assert.deepEqual((await lies(w, w.anna)).anhaenge.map((a: { tag: string; name: string }) => [a.tag, a.name]), [['2026-11-03', 'dienstag.jpg'], ['2026-11-04', 'mittwoch.pdf']]);

  // entfernen
  const id = (await lies(w, w.anna)).anhaenge[0].id as number;
  const weg = await ruf(w.u, 'DELETE', bericht(w.anna, `/anhaenge/${id}`), { cookies: als(w, w.anna) });
  assert.deepEqual([weg.status, koerper(weg).anhaenge.length], [200, 1]);
  assert.equal((await ruf(w.u, 'DELETE', bericht(w.anna, `/anhaenge/${id}`), { cookies: als(w, w.anna) })).status, 404);

  // höchstens zwölf Anhänge je Bericht
  for (let i = 1; i < MAX_ANHAENGE; i++) assert.equal((await lade(w, `n${i}.pdf`, PDF, '2026-11-05')).status, 201);
  assert.match(koerper(await lade(w, 'zu-viel.pdf', PDF, '2026-11-05')).fehler, /Mehr als 12 Anhänge je Bericht gehen nicht/);

  // wird der Entwurf gelöscht, sind auch die Dateien weg; ebenso mit dem Konto
  const zahl = () => (w.u.db.prepare('SELECT COUNT(*) AS n FROM bericht_anhang').get() as { n: number }).n;
  assert.equal(zahl(), MAX_ANHAENGE);
  assert.equal((await ruf(w.u, 'DELETE', bericht(w.anna), { cookies: als(w, w.anna) })).status, 200);
  assert.equal(zahl(), 0);
  await schreibe(w, { betrieb: [{ text: 'x', stunden: 1, tag: '2026-11-03' }], unterweisung: [], schule: [], abwesenheit: [] });
  await lade(w, 'a.pdf', PDF, '2026-11-03');
  assert.equal(zahl(), 1);
  w.u.db.prepare('DELETE FROM benutzer WHERE id = ?').run(w.anna.id);
  assert.equal(zahl(), 0);
});
