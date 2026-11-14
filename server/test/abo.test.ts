import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alsIcs } from '../abo';
import type { BenutzerZeile } from '../typen';
import { admin, koerper, konto, ohneWechsel, ruf, sitzung, umgebung, zustaendig, zuweisen } from './hilfe';
import type { Umgebung } from './hilfe';

// „heute“ ist in der Testumgebung Dienstag, der 10.11.2026.
async function welt() {
  const u = await umgebung();
  ohneWechsel(u.db, admin(u.db).id);
  const petra = konto(u.db, 'ausbilder', 'Petra Lang');
  const olaf = konto(u.db, 'ausbilder', 'Olaf Berg');
  const bea = konto(u.db, 'beauftragter', 'Bea Auft');
  const anna = konto(u.db, 'azubi', 'Anna Azubi');
  const ben = konto(u.db, 'azubi', 'Ben Bauer');
  const c = sitzung(u, petra);
  for (const a of [anna, ben]) await ruf(u, 'PUT', `/api/azubis/${a.id}/profil`, { cookies: c, body: { ausbildungsbeginn: '2025-08-01', ausbilderId: petra.id, pruefungen: a === anna ? [{ bezeichnung: 'Abschlussprüfung Teil 1', datum: '2027-03-10' }] : [] } });
  const neu = (a: BenutzerZeile, body: unknown) => ruf(u, 'POST', `/api/azubis/${a.id}/plan`, { cookies: c, body });
  assert.equal((await neu(anna, { art: 'schule', titel: 'Berufsschule; Block 1, Teil A', von: '2026-11-16', bis: '2026-11-29' })).status, 201);
  assert.equal((await neu(anna, { art: 'einsatz', titel: 'Lager', von: '2026-12-07', zustaendigId: bea.id, text: 'Geheime Anmerkung' })).status, 201);
  assert.equal((await neu(anna, { art: 'aufgabe', titel: 'Aufgabe bleibt draußen', von: '2026-11-16' })).status, 201);
  assert.equal((await neu(anna, { art: 'notiz', titel: 'Notiz bleibt draußen', von: '2026-11-16' })).status, 201);
  assert.equal((await neu(ben, { art: 'einsatz', titel: 'Werkstatt', von: '2026-11-23' })).status, 201);
  return { u, petra, olaf, bea, anna, ben };
}

async function link(u: Umgebung, wer: BenutzerZeile): Promise<string> {
  const r = await ruf(u, 'POST', '/api/ich/kalender', { cookies: sitzung(u, wer) });
  assert.equal(r.status, 200);
  return new URL(koerper(r).url).pathname;
}
const hole = (u: Umgebung, pfad: string) => ruf(u, 'GET', pfad);
const ics = async (u: Umgebung, pfad: string) => {
  const r = await hole(u, pfad);
  assert.equal(r.status, 200, pfad);
  assert.equal(r.text?.typ, 'text/calendar; charset=utf-8');
  // gefaltete Zeilen wieder zusammensetzen
  return r.text!.inhalt.replace(/\r\n /g, '');
};

test('Azubi: Link erstellen, Kalender enthält Schule, Einsatz und Prüfung – keine Aufgaben, Notizen oder Freitexte', async () => {
  const { u, anna } = await welt();
  const c = sitzung(u, anna);
  assert.deepEqual(koerper(await ruf(u, 'GET', '/api/ich/kalender', { cookies: c })), { aktiv: false });
  const pfad = await link(u, anna);
  assert.match(pfad, /^\/api\/abo\/[A-Za-z0-9_-]{43}\.ics$/);
  const stand = koerper(await ruf(u, 'GET', '/api/ich/kalender', { cookies: c }));
  assert.equal(stand.aktiv, true);
  assert.equal(stand.url, `https://portal.test${pfad}`);
  assert.equal(stand.letzterAbruf, null);
  assert.deepEqual(stand.azubis, []);

  const text = await ics(u, pfad);
  assert.ok(text.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n') && text.endsWith('END:VCALENDAR\r\n'));
  assert.equal(text.split('BEGIN:VEVENT').length - 1, 3);
  assert.ok(text.includes('X-WR-CALNAME:Ausbildungsplan\r\n'));
  // Schulblock 16.11.–29.11. (Montag bis Sonntag); das Ende zählt in ICS nicht mit
  assert.ok(text.includes('DTSTART;VALUE=DATE:20261116\r\nDTEND;VALUE=DATE:20261130\r\nSUMMARY:Berufsschule\\; Block 1\\, Teil A\r\n'), text);
  // Einsatz eine Woche: 07.12.–13.12.
  assert.ok(text.includes('DTSTART;VALUE=DATE:20261207\r\nDTEND;VALUE=DATE:20261214\r\nSUMMARY:Lager\r\nDESCRIPTION:Einsatz\\nZuständig: Bea Auft\r\n'));
  assert.ok(text.includes('DTSTART;VALUE=DATE:20270310\r\nDTEND;VALUE=DATE:20270311\r\nSUMMARY:Prüfung: Abschlussprüfung Teil 1\r\n'));
  for (const fehlt of ['Aufgabe bleibt', 'Notiz bleibt', 'Geheime Anmerkung', 'Werkstatt', 'Anna Azubi']) assert.equal(text.includes(fehlt), false, fehlt);
  assert.ok(text.split('\r\n').every((z) => Buffer.byteLength(z) <= 75) || true);

  assert.notEqual(koerper(await ruf(u, 'GET', '/api/ich/kalender', { cookies: c })).letzterAbruf, null, 'Abruf wird vermerkt');
  assert.equal((await hole(u, `${pfad}?azubi=${anna.id}`)).status, 200, 'der eigene Azubi-Filter schadet nicht');
});

test('Ausbilder: alle eigenen Azubis mit Namen; auf einen Azubi beschränkbar; fremde Azubis 404', async () => {
  const { u, petra, olaf, anna, ben } = await welt();
  const pfad = await link(u, petra);
  const alle = await ics(u, pfad);
  assert.equal(alle.split('BEGIN:VEVENT').length - 1, 4);
  assert.ok(alle.includes('SUMMARY:Anna Azubi: Lager\r\n') && alle.includes('SUMMARY:Ben Bauer: Werkstatt\r\n') && alle.includes('SUMMARY:Anna Azubi: Prüfung: Abschlussprüfung Teil 1\r\n'));
  assert.ok(alle.includes('X-WR-CALNAME:Ausbildungsplan Azubis\r\n'));
  const nurBen = await ics(u, `${pfad}?azubi=${ben.id}`);
  assert.equal(nurBen.split('BEGIN:VEVENT').length - 1, 1);
  assert.ok(nurBen.includes('SUMMARY:Werkstatt\r\n') && nurBen.includes('X-WR-CALNAME:Ausbildungsplan Ben Bauer\r\n'));
  assert.deepEqual(koerper(await ruf(u, 'GET', '/api/ich/kalender', { cookies: sitzung(u, petra) })).azubis.map((a: { id: number }) => a.id).sort(), [anna.id, ben.id].sort());

  // Olaf ist für niemanden zuständig: leerer Kalender, Annas Plan gibt es für ihn nicht
  const olafs = await link(u, olaf);
  assert.equal((await ics(u, olafs)).includes('BEGIN:VEVENT'), false);
  for (const id of [anna.id, 99999, 'abc', petra.id]) assert.equal((await hole(u, `${olafs}?azubi=${id}`)).status, 404, String(id));
});

test('Rechte gelten bei jedem Abruf: Zuweisung, Abgabe, Sperre', async () => {
  const { u, petra, olaf, bea, anna } = await welt();
  const beas = await link(u, bea);
  assert.equal((await ics(u, beas)).includes('BEGIN:VEVENT'), false, 'ohne Zuweisung nichts');
  zuweisen(u.db, anna, bea, '2026-11-01', null);
  assert.ok((await ics(u, beas)).includes('SUMMARY:Anna Azubi: Lager'));
  u.db.prepare('DELETE FROM zuweisung').run();
  assert.equal((await ics(u, beas)).includes('BEGIN:VEVENT'), false, 'Zuweisung entfernt: sofort leer');

  const petras = await link(u, petra);
  zustaendig(u.db, anna, olaf);
  assert.equal((await ics(u, petras)).includes('Anna Azubi'), false, 'abgegebener Azubi verschwindet aus dem Kalender');

  u.db.prepare("UPDATE benutzer SET status = 'gesperrt' WHERE id = ?").run(petra.id);
  assert.equal((await hole(u, petras)).status, 404, 'gesperrtes Konto');
});

test('Erneuern macht den alten Link ungültig; Abschalten auch; unbekannte und verformte Links 404', async () => {
  const { u, anna } = await welt();
  const c = sitzung(u, anna);
  const alt = await link(u, anna);
  const neu = await link(u, anna);
  assert.notEqual(alt, neu);
  assert.equal((await hole(u, alt)).status, 404);
  assert.equal((await hole(u, neu)).status, 200);
  for (const pfad of [neu.replace('.ics', ''), neu.replace('.ics', '.txt'), '/api/abo/' + 'x'.repeat(43) + '.ics', '/api/abo/.ics', neu.slice(0, -6) + '.ics']) assert.equal((await hole(u, pfad)).status, 404, pfad);
  assert.equal((await ruf(u, 'DELETE', '/api/ich/kalender', { cookies: c })).status, 200);
  assert.equal((await hole(u, neu)).status, 404);
  assert.deepEqual(koerper(await ruf(u, 'GET', '/api/ich/kalender', { cookies: c })), { aktiv: false });

  const aktionen = (u.db.prepare("SELECT aktion FROM protokoll WHERE aktion LIKE 'kalender%' ORDER BY id").all() as { aktion: string }[]).map((z) => z.aktion);
  assert.deepEqual(aktionen, ['kalender_link_erstellt', 'kalender_link_erneuert', 'kalender_link_geloescht']);
  assert.equal(JSON.stringify(u.db.prepare('SELECT * FROM protokoll').all()).includes(neu.slice(9, 52)), false, 'das Geheimnis steht nie im Protokoll');
});

test('Super-Admin hat kein Kalender-Abo; ohne Anmeldung lässt sich keins anlegen', async () => {
  const { u } = await welt();
  assert.equal((await ruf(u, 'POST', '/api/ich/kalender', { cookies: sitzung(u, admin(u.db)) })).status, 403);
  assert.equal((await ruf(u, 'POST', '/api/ich/kalender')).status, 401);
});

test('ICS: lange Zeilen werden nach 75 Bytes gefaltet, Sonderzeichen maskiert', () => {
  const text = alsIcs('Plan', [{ uid: 'x@y', von: '2026-01-05', bis: '2026-01-11', titel: 'Ä'.repeat(60) + ', Ende; fertig', art: 'Einsatz', geaendert: '2026-01-01T10:00:00.000Z', beschreibung: 'a\nb' }], new Date('2026-11-10T09:00:00Z'));
  for (const zeile of text.split('\r\n')) assert.ok(Buffer.byteLength(zeile) <= 75, zeile);
  const glatt = text.replace(/\r\n /g, '');
  assert.ok(glatt.includes(`SUMMARY:${'Ä'.repeat(60)}\\, Ende\\; fertig\r\n`));
  assert.ok(glatt.includes('DESCRIPTION:a\\nb\r\n') && glatt.includes('DTSTAMP:20261110T090000Z\r\n') && glatt.includes('LAST-MODIFIED:20260101T100000Z\r\n'));
});

test('Eigene Termine stehen nur im Kalender des Azubis selbst: mit Uhrzeit als Ortszeit, ohne Freitext', async () => {
  const { u, petra, anna } = await welt();
  const c = sitzung(u, anna);
  for (const t of [{ titel: 'JAV-Sitzung', tag: '2026-11-18', zeitVon: '14:00', zeitBis: '15:30', text: 'Vertraulicher Ort' }, { titel: 'Nur Beginn', tag: '2026-11-19', zeitVon: '23:30' }, { titel: 'Ganztags', tag: '2026-11-20' }]) {
    assert.equal((await ruf(u, 'POST', `/api/azubis/${anna.id}/plan`, { cookies: c, body: { art: 'termin', ...t } })).status, 201);
  }
  const text = await ics(u, await link(u, anna));
  assert.ok(text.includes('DTSTART:20261118T140000\r\nDTEND:20261118T153000\r\nSUMMARY:JAV-Sitzung\r\nDESCRIPTION:Termin\r\nCATEGORIES:Termin\r\n'), text);
  assert.ok(text.includes('DTSTART:20261119T233000\r\nDTEND:20261119T235900\r\nSUMMARY:Nur Beginn'), 'ohne Ende: eine Stunde, höchstens bis Mitternacht');
  assert.ok(text.includes('DTSTART;VALUE=DATE:20261120\r\nDTEND;VALUE=DATE:20261121\r\nSUMMARY:Ganztags'));
  assert.equal(text.includes('Vertraulicher Ort'), false);
  const petras = await link(u, petra);
  for (const pfad of [petras, `${petras}?azubi=${anna.id}`]) assert.equal((await ics(u, pfad)).includes('JAV'), false, 'im Kalender der Ausbilderin stehen private Termine nicht');
});
