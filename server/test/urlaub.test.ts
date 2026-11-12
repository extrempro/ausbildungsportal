import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Kontext } from '../api-basis';
import { MailFehler } from '../smtp';
import type { Mail } from '../smtp';
import type { BenutzerZeile } from '../typen';
import { admin, koerper, konto, ohneWechsel, ruf, sitzung, umgebung, zuweisen } from './hilfe';
import type { Umgebung } from './hilfe';

// „heute“ ist in der Testumgebung Dienstag, der 10.11.2026.
interface Welt {
  u: Umgebung;
  admin: BenutzerZeile;
  ausbilder: BenutzerZeile;
  fremd: BenutzerZeile;
  bea: BenutzerZeile;
  bodo: BenutzerZeile;
  anna: BenutzerZeile;
  ben: BenutzerZeile;
}

/** Anna (Ausbilderin Petra, Beauftragte Bea) mit 30 Tagen Urlaub im Jahr; Ben gehört einem anderen Ausbilder. Betrieb in Hamburg. */
async function welt(env: Record<string, string> = {}, mail?: Kontext['mail']): Promise<Welt> {
  const u = await umgebung(env, null, undefined, mail);
  ohneWechsel(u.db, admin(u.db).id);
  const w: Welt = { u, admin: admin(u.db), ausbilder: konto(u.db, 'ausbilder', 'Petra Lang'), fremd: konto(u.db, 'ausbilder', 'Olaf Berg'), bea: konto(u.db, 'beauftragter', 'Bea Auft'), bodo: konto(u.db, 'beauftragter', 'Bodo Zweit'), anna: konto(u.db, 'azubi', 'Anna Azubi'), ben: konto(u.db, 'azubi', 'Ben Bauer') };
  const c = sitzung(u, w.ausbilder);
  assert.equal((await ruf(u, 'PUT', '/api/stammdaten/betrieb', { cookies: c, body: { name: 'Muster GmbH', bundesland: 'HH', personalMail: 'personal@firma.test' } })).status, 200);
  assert.equal((await ruf(u, 'PUT', `/api/azubis/${w.anna.id}/profil`, { cookies: c, body: { ausbildungsbeginn: '2025-08-01', ausbilderId: w.ausbilder.id, urlaubstage: 30 } })).status, 200);
  assert.equal((await ruf(u, 'PUT', `/api/azubis/${w.ben.id}/profil`, { cookies: sitzung(u, w.fremd), body: { ausbildungsbeginn: '2025-08-01', ausbilderId: w.fremd.id } })).status, 200);
  zuweisen(u.db, w.anna, w.bea);
  return w;
}
const als = (w: Welt, wer: BenutzerZeile) => sitzung(w.u, wer);
const beantrage = (w: Welt, von: string, bis: string, a = w.anna, bemerkung = '') => ruf(w.u, 'POST', `/api/azubis/${a.id}/urlaub`, { cookies: als(w, a), body: { von, bis, bemerkung } });
const tue = (w: Welt, wer: BenutzerZeile, id: number, aktion: string, body: unknown = {}) => ruf(w.u, 'POST', `/api/urlaub/${id}/${aktion}`, { cookies: als(w, wer), body });
const liste = async (w: Welt, wer: BenutzerZeile, a = w.anna, frage = '') => koerper(await ruf(w.u, 'GET', `/api/azubis/${a.id}/urlaub${frage}`, { cookies: als(w, wer) }));

test('Urlaub beantragen: Arbeitstage ohne Wochenende und Feiertag, Hinweise, Eingaben werden geprüft', async () => {
  const w = await welt();
  // 21.12.2026–03.01.2027: 1. und 2. Weihnachtstag und Neujahr fallen auf Arbeitstage
  const p = koerper(await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/urlaub/pruefen?von=2026-12-21&bis=2027-01-03`, { cookies: als(w, w.anna) }));
  assert.deepEqual([p.tage, p.bestaetiger], [8, ['Bea Auft']]);
  // Hinweise: Berufsschule und Prüfung im Zeitraum, mehr Tage als frei
  await ruf(w.u, 'POST', `/api/azubis/${w.anna.id}/plan`, { cookies: als(w, w.ausbilder), body: { art: 'schule', von: '2026-11-23', bis: '2026-11-30', titel: 'Blockunterricht' } });
  const profil = koerper(await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/profil`, { cookies: als(w, w.ausbilder) })).profil;
  assert.equal(profil.urlaubstage, 30);
  await ruf(w.u, 'PUT', `/api/azubis/${w.anna.id}/profil`, { cookies: als(w, w.ausbilder), body: { ...profil, urlaubstage: 3, pruefungen: [{ bezeichnung: 'AP Teil 1', datum: '2026-11-26' }] } });
  const h = koerper(await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/urlaub/pruefen?von=2026-11-23&bis=2026-11-27`, { cookies: als(w, w.anna) })).hinweise.join(' | ');
  assert.match(h, /Berufsschule \(Blockunterricht\)/);
  assert.match(h, /Prüfungstermin: AP Teil 1 am 26\.11\./);
  assert.match(h, /5 Tage, frei sind laut Portal noch 3 von 3/);
  // trotz Hinweisen lässt sich der Antrag stellen (nur warnen)
  assert.equal((await beantrage(w, '2026-11-23', '2026-11-27')).status, 201);

  for (const [von, bis, status] of [['2026-11-09', '2026-11-13', 400], ['2026-12-05', '2026-12-06', 400], ['2026-12-10', '2026-12-09', 400], ['2026-12-01', '2027-06-01', 400], ['x', '2026-12-01', 400], ['2029-01-08', '2029-01-12', 409], ['2026-11-27', '2026-12-01', 409]] as const) {
    assert.equal((await beantrage(w, von, bis)).status, status, `${von}–${bis}`);
  }
  assert.equal((await beantrage(w, '2026-12-07', '2026-12-08', w.anna, 'x'.repeat(301))).status, 400);
  // nur der Azubi selbst beantragt
  for (const wer of [w.ausbilder, w.bea, w.ben, w.admin]) assert.ok([403, 404].includes((await ruf(w.u, 'POST', `/api/azubis/${w.anna.id}/urlaub`, { cookies: als(w, wer), body: { von: '2026-12-07', bis: '2026-12-08' } })).status), wer.rolle);
});

test('Ablauf: Beauftragte bestätigt, Ausbilderin genehmigt; Urlaubskonto, Jahreskalender, Bericht und Glocke folgen', async () => {
  const w = await welt();
  const antrag = koerper(await beantrage(w, '2026-12-21', '2027-01-03', w.anna, 'Familienbesuch')).antrag;
  assert.deepEqual([antrag.status, antrag.stufe, antrag.tage, antrag.bestaetigungen.map((b: { name: string }) => b.name), antrag.rechte.zurueckziehen], ['offen', 'beauftragte', 8, ['Bea Auft'], true]);

  // Urlaubskonto: alle 8 Arbeitstage liegen in 2026 (21.–24. und 28.–31.12.); der 1.1. ist Feiertag, danach Wochenende
  const k26 = (await liste(w, w.anna)).konto;
  assert.deepEqual(k26, { jahr: 2026, anspruch: 30, genehmigt: 0, beantragt: 8, frei: 22 });
  assert.deepEqual((await liste(w, w.anna, w.anna, '?jahr=2027')).konto, { jahr: 2027, anspruch: 30, genehmigt: 0, beantragt: 0, frei: 30 });

  // im Jahreskalender steht der offene Antrag als „beantragt“, noch nicht als Urlaub
  const jk = async (wer: BenutzerZeile) => koerper(await ruf(w.u, 'GET', `/api/jahreskalender?jahr=2026&azubi=${w.anna.id}`, { cookies: als(w, wer) })).azubis[0];
  assert.deepEqual([(await jk(w.ausbilder)).beantragt, (await jk(w.ausbilder)).urlaub], [[{ von: '2026-12-21', bis: '2027-01-03' }], []]);

  // die Ausbilderin kann noch nicht einfach genehmigen – die Bestätigung fehlt
  const frueh = await tue(w, w.ausbilder, antrag.id, 'genehmigen');
  assert.deepEqual([frueh.status, koerper(frueh).code], [409, 'bestaetigung_fehlt']);
  // wer nicht gefragt ist, kann nicht bestätigen
  assert.equal((await tue(w, w.ausbilder, antrag.id, 'bestaetigen')).status, 409);
  assert.equal((await tue(w, w.bodo, antrag.id, 'bestaetigen')).status, 404);

  // die Liste der Beauftragten zeigt: hier ist etwas zu tun
  const beaListe = koerper(await ruf(w.u, 'GET', '/api/urlaub', { cookies: als(w, w.bea) }));
  assert.deepEqual([beaListe.zuTun, beaListe.antraege[0].rechte.bestaetigen, beaListe.antraege[0].rechte.genehmigen], [1, true, false]);
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/urlaub', { cookies: als(w, w.ausbilder) })).zuTun, 0);

  const bestaetigt = koerper(await tue(w, w.bea, antrag.id, 'bestaetigen')).antrag;
  assert.deepEqual([bestaetigt.status, bestaetigt.stufe, bestaetigt.rechte.bestaetigen], ['offen', 'ausbilder', false]);
  assert.equal((await tue(w, w.bea, antrag.id, 'bestaetigen')).status, 409, 'nicht zweimal');
  assert.equal((await tue(w, w.bea, antrag.id, 'genehmigen')).status, 403, 'Beauftragte genehmigen nicht');
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/urlaub', { cookies: als(w, w.ausbilder) })).zuTun, 1);
  assert.equal((await tue(w, w.fremd, antrag.id, 'genehmigen')).status, 404, 'ein fremder Ausbilder sieht den Antrag nicht');

  const genehmigt = koerper(await tue(w, w.ausbilder, antrag.id, 'genehmigen')).antrag;
  assert.deepEqual([genehmigt.status, genehmigt.stufe, genehmigt.rechte.stornieren], ['genehmigt', null, true]);
  assert.deepEqual(genehmigt.verlauf.map((v: { aktion: string; name: string }) => `${v.aktion}:${v.name}`), ['beantragt:Anna Azubi', 'bestaetigt:Bea Auft', 'genehmigt:Petra Lang']);
  assert.equal((await tue(w, w.anna, antrag.id, 'zurueckziehen')).status, 409, 'nach der Genehmigung nicht mehr');

  assert.deepEqual((await liste(w, w.anna)).konto, { jahr: 2026, anspruch: 30, genehmigt: 8, beantragt: 0, frei: 22 });
  // Jahreskalender: die Arbeitstage als Urlaub, ohne Feiertage und Wochenenden – auch für die Ausbilderin, ohne dass ein Bericht existiert
  assert.deepEqual((await jk(w.ausbilder)).urlaub, ['2026-12-21', '2026-12-22', '2026-12-23', '2026-12-24', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31']);
  assert.deepEqual((await jk(w.ausbilder)).beantragt, []);
  // der Bericht der Woche trägt den Urlaub schon als Abwesenheit, neben den Feiertagen
  const bericht = koerper(await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/berichte/2026-12-21`, { cookies: als(w, w.anna) }));
  assert.deepEqual(bericht.inhalt.abwesenheit.map((a: { tag: string; grund: string }) => `${a.tag.slice(8)}:${a.grund}`), ['21:urlaub', '22:urlaub', '23:urlaub', '24:urlaub', '25:feiertag']);
  // Glocke: Anna erfährt Bestätigung und Genehmigung, die Ausbilderin Antrag und Bestätigung
  const glocke = async (wer: BenutzerZeile) => koerper(await ruf(w.u, 'GET', '/api/aktivitaeten', { cookies: als(w, wer) })).gruppen.map((g: { art: string }) => g.art);
  assert.deepEqual(await glocke(w.anna), ['urlaub_genehmigt', 'urlaub_bestaetigt']);
  assert.deepEqual(await glocke(w.ausbilder), ['urlaub_bestaetigt', 'urlaub_beantragt']);
  assert.equal((await ruf(w.u, 'GET', '/api/aktivitaeten', { cookies: als(w, w.bea) })).status, 200);

  // stornieren: nur mit Begründung, nur die Ausbilderin; danach ist der Zeitraum wieder frei
  assert.equal((await tue(w, w.ausbilder, antrag.id, 'stornieren')).status, 400);
  assert.equal((await tue(w, w.bea, antrag.id, 'stornieren', { kommentar: 'x' })).status, 403);
  assert.equal(koerper(await tue(w, w.ausbilder, antrag.id, 'stornieren', { kommentar: 'Projekt geht vor' })).antrag.status, 'storniert');
  assert.deepEqual((await jk(w.ausbilder)).urlaub, []);
  assert.equal((await beantrage(w, '2026-12-21', '2026-12-23')).status, 201);
});

test('Sonderfälle: ohne Beauftragte direkt zum Ausbilder, zwei Beauftragte, ablehnen, zurückziehen, entscheiden ohne Bestätigung', async () => {
  const w = await welt();
  // Ben hat niemanden zugewiesen: Der Antrag liegt sofort beim Ausbilder
  const ohne = koerper(await beantrage(w, '2026-12-07', '2026-12-08', w.ben)).antrag;
  assert.deepEqual([ohne.stufe, ohne.bestaetigungen], ['ausbilder', []]);
  assert.equal(koerper(await tue(w, w.fremd, ohne.id, 'genehmigen')).antrag.status, 'genehmigt');

  // zwei Beauftragte im Zeitraum: beide müssen bestätigen
  zuweisen(w.u.db, w.anna, w.bodo);
  const zwei = koerper(await beantrage(w, '2026-12-07', '2026-12-11')).antrag;
  assert.deepEqual(zwei.bestaetigungen.map((b: { name: string }) => b.name), ['Bea Auft', 'Bodo Zweit']);
  assert.equal(koerper(await tue(w, w.bea, zwei.id, 'bestaetigen')).antrag.stufe, 'beauftragte');
  // die Ausbilderin entscheidet ausdrücklich ohne die zweite Bestätigung – das steht im Verlauf
  const direkt = koerper(await tue(w, w.ausbilder, zwei.id, 'genehmigen', { ohneBestaetigung: true })).antrag;
  assert.equal(direkt.status, 'genehmigt');
  assert.equal(direkt.verlauf.at(-1).kommentar, 'ohne Bestätigung von Bodo Zweit');

  // ablehnen braucht eine Begründung; der Azubi sieht sie
  const a2 = koerper(await beantrage(w, '2027-02-01', '2027-02-05')).antrag;
  assert.equal((await tue(w, w.bea, a2.id, 'ablehnen')).status, 400);
  assert.equal(koerper(await tue(w, w.bea, a2.id, 'ablehnen', { kommentar: 'In der Woche ist Inventur.' })).antrag.status, 'abgelehnt');
  const beiAnna = (await liste(w, w.anna)).antraege.find((x: { id: number }) => x.id === a2.id);
  assert.deepEqual([beiAnna.status, beiAnna.verlauf.at(-1).kommentar], ['abgelehnt', 'In der Woche ist Inventur.']);
  assert.equal((await tue(w, w.ausbilder, a2.id, 'genehmigen')).status, 409, 'entschieden ist entschieden');
  // abgelehnt gibt den Zeitraum wieder frei
  const a3 = koerper(await beantrage(w, '2027-02-01', '2027-02-05')).antrag;
  assert.equal(koerper(await tue(w, w.anna, a3.id, 'zurueckziehen')).antrag.status, 'zurueckgezogen');
  assert.equal((await tue(w, w.bea, a3.id, 'bestaetigen')).status, 409);
  assert.equal((await tue(w, w.ben, a3.id, 'zurueckziehen')).status, 404, 'fremder Antrag');
});

test('Urlaubsanträge sind vertraulich: nur Azubi, zugewiesene Beauftragte und zuständiger Ausbilder', async () => {
  const w = await welt();
  const antrag = koerper(await beantrage(w, '2026-12-07', '2026-12-08', w.anna, 'Umzug')).antrag;
  for (const wer of [w.anna, w.bea, w.ausbilder]) assert.equal((await liste(w, wer)).antraege[0].bemerkung, 'Umzug', wer.anzeigename);
  for (const wer of [w.ben, w.bodo, w.fremd]) assert.equal((await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/urlaub`, { cookies: als(w, wer) })).status, 404, wer.anzeigename);
  assert.equal((await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/urlaub`, { cookies: als(w, w.admin) })).status, 403);
  assert.equal((await ruf(w.u, 'GET', '/api/urlaub', { cookies: als(w, w.admin) })).status, 403);
  assert.equal((await ruf(w.u, 'GET', '/api/urlaub')).status, 401);
  for (const wer of [w.bodo, w.fremd]) {
    assert.deepEqual(koerper(await ruf(w.u, 'GET', '/api/urlaub', { cookies: als(w, wer) })).antraege.filter((a: { azubi: { id: number } }) => a.azubi.id === w.anna.id), []);
    for (const aktion of ['bestaetigen', 'ablehnen', 'genehmigen', 'stornieren']) assert.equal((await tue(w, wer, antrag.id, aktion, { kommentar: 'x' })).status, wer.rolle === 'beauftragter' && ['genehmigen', 'stornieren'].includes(aktion) ? 403 : 404, `${wer.anzeigename} ${aktion}`);
  }
  assert.equal((await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/urlaub/pruefen?von=2026-12-07&bis=2026-12-08`, { cookies: als(w, w.ben) })).status, 404);
  // die Adresse der Personalstelle sehen nur Ausbilder
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/stammdaten', { cookies: als(w, w.ausbilder) })).betrieb.personalMail, 'personal@firma.test');
  for (const wer of [w.anna, w.bea]) assert.equal(koerper(await ruf(w.u, 'GET', '/api/stammdaten', { cookies: als(w, wer) })).betrieb.personalMail, '');
  for (const falsch of ['keine-adresse', 'a@b.de, c@d.de', 'a@b.de\nBcc: x@y.de']) assert.equal((await ruf(w.u, 'PUT', '/api/stammdaten/betrieb', { cookies: als(w, w.ausbilder), body: { name: 'Muster GmbH', bundesland: 'HH', personalMail: falsch } })).status, 400, falsch);
  // mit dem Konto verschwinden die Anträge
  w.u.db.prepare('DELETE FROM benutzer WHERE id = ?').run(w.anna.id);
  assert.equal((w.u.db.prepare('SELECT COUNT(*) AS n FROM urlaub_antrag').get() as { n: number }).n + (w.u.db.prepare('SELECT COUNT(*) AS n FROM urlaub_verlauf').get() as { n: number }).n, 0);
});

const SMTP = { SMTP_HOST: 'mail.firma.test', SMTP_ABSENDER: 'portal@firma.test' };

test('Mail an die Personalstelle: nach Genehmigung und Storno, knapp und ohne Bemerkung oder Begründung', async () => {
  const post: Mail[] = [];
  const w = await welt(SMTP, async (m) => void post.push(m));
  const antrag = koerper(await beantrage(w, '2026-12-21', '2027-01-03', w.anna, 'Familienbesuch')).antrag;
  await tue(w, w.bea, antrag.id, 'bestaetigen');
  assert.equal(post.length, 0, 'vor der Genehmigung geht nichts raus');
  const genehmigt = koerper(await tue(w, w.ausbilder, antrag.id, 'genehmigen')).antrag;
  assert.deepEqual([genehmigt.mail, genehmigt.rechte.mailErneut], [{ stand: 'gesendet', fehler: '' }, false]);
  assert.equal(post.length, 1);
  assert.deepEqual([post[0].an, post[0].betreff], ['personal@firma.test', 'Urlaub genehmigt: Anna Azubi, 21.12.2026–03.01.2027']);
  for (const teil of ['für Anna Azubi (Auszubildende/r) wurde Urlaub genehmigt', 'Zeitraum: 21.12.2026 bis 03.01.2027', 'Arbeitstage: 8', 'Beantragt am: 10.11.2026', 'Bestätigt von: Bea Auft', 'Genehmigt von: Petra Lang am 10.11.2026', '(Muster GmbH)']) assert.ok(post[0].text.includes(teil), teil);
  assert.ok(!post[0].text.includes('Familienbesuch'), 'die Bemerkung des Azubis geht nicht mit');
  // die gestaltete Fassung sagt dasselbe: Kopf mit Betrieb, Marke, Angaben – ohne Bemerkung; die Personalstelle wird nicht mit Namen angesprochen
  const html0 = post[0].html ?? '';
  for (const teil of ['Ausbildungsportal', 'Muster GmbH', 'Urlaub genehmigt', 'Guten Tag,', 'Anna Azubi', '21.12.2026 bis 03.01.2027', 'Bea Auft', 'Petra Lang am 10.11.2026']) assert.ok(html0.includes(teil), `gestaltet: ${teil}`);
  assert.ok(!html0.includes('Familienbesuch') && !html0.includes('<a href'), 'gestaltet: keine Bemerkung, kein Knopf ins Portal');
  // den Stand der Mail sieht nur, wer genehmigt
  for (const wer of [w.anna, w.bea]) assert.equal((await liste(w, wer)).antraege[0].mail, null, wer.anzeigename);
  assert.equal((await tue(w, w.ausbilder, antrag.id, 'mail')).status, 409, 'schon gesendet');

  const storniert = koerper(await tue(w, w.ausbilder, antrag.id, 'stornieren', { kommentar: 'Projekt geht vor' })).antrag;
  assert.equal(storniert.mail.stand, 'gesendet');
  assert.equal(post.length, 2);
  assert.equal(post[1].betreff, 'Urlaub storniert: Anna Azubi, 21.12.2026–03.01.2027');
  assert.ok(post[1].text.includes('wurde storniert. Der Urlaub findet nicht statt.') && post[1].text.includes('Storniert von: Petra Lang am 10.11.2026'));
  assert.ok(!post[1].text.includes('Projekt geht vor'), 'die Begründung der Stornierung geht nicht mit');
  assert.ok((post[1].html ?? '').includes('Urlaub storniert') && !(post[1].html ?? '').includes('Projekt geht vor'), 'gestaltet: Storno ohne Begründung');
  // Ablehnen und Zurückziehen lösen keine Mail aus
  const a2 = koerper(await beantrage(w, '2027-02-01', '2027-02-05')).antrag;
  await tue(w, w.bea, a2.id, 'ablehnen', { kommentar: 'Inventur' });
  const a3 = koerper(await beantrage(w, '2027-02-01', '2027-02-05')).antrag;
  await tue(w, w.anna, a3.id, 'zurueckziehen');
  assert.equal(post.length, 2);
  assert.equal((await tue(w, w.ausbilder, a2.id, 'mail')).status, 409);
});

test('Mail an die Personalstelle: Die Genehmigung gilt auch ohne Mail; Stand und Grund stehen am Antrag, erneut senden geht', async () => {
  // 1. der Mailserver lehnt ab
  let kaputt = true;
  const post: Mail[] = [];
  const w = await welt(SMTP, async (m) => {
    if (kaputt) throw new MailFehler('Der Mailserver lehnt die Anmeldung ab (Benutzer oder Passwort): 535 5.7.8');
    post.push(m);
  });
  const antrag = koerper(await beantrage(w, '2026-12-07', '2026-12-08', w.ben)).antrag;
  const r = await tue(w, w.fremd, antrag.id, 'genehmigen');
  assert.equal(r.status, 200);
  assert.deepEqual([koerper(r).antrag.status, koerper(r).antrag.mail.stand, koerper(r).antrag.rechte.mailErneut], ['genehmigt', 'fehler', true]);
  assert.match(koerper(r).antrag.mail.fehler, /lehnt die Anmeldung ab/);
  assert.ok(w.u.logs.some((l) => l.startsWith('Mailversand fehlgeschlagen: Der Mailserver lehnt die Anmeldung ab')));
  // erneut senden: nur der zuständige Ausbilder
  assert.equal((await tue(w, w.ausbilder, antrag.id, 'mail')).status, 404);
  assert.equal((await tue(w, w.bea, antrag.id, 'mail')).status, 403);
  kaputt = false;
  const erneut = koerper(await tue(w, w.fremd, antrag.id, 'mail')).antrag;
  assert.deepEqual([erneut.mail, post.length, erneut.verlauf.at(-1).kommentar], [{ stand: 'gesendet', fehler: '' }, 1, 'Mail an die Personalstelle gesendet']);

  // 2. kein Mailserver eingerichtet
  const ohne = await welt();
  const a = koerper(await beantrage(ohne, '2026-12-07', '2026-12-08', ohne.ben)).antrag;
  const g = koerper(await tue(ohne, ohne.fremd, a.id, 'genehmigen')).antrag;
  assert.deepEqual([g.status, g.mail.stand], ['genehmigt', 'ohne']);
  assert.match(g.mail.fehler, /Mailversand ist im Portal nicht eingerichtet/);
  assert.equal(koerper(await ruf(ohne.u, 'GET', '/api/stammdaten', { cookies: als(ohne, ohne.ausbilder) })).mailversand, false);
  const t = await ruf(ohne.u, 'POST', '/api/urlaub/mail-test', { cookies: als(ohne, ohne.ausbilder) });
  assert.deepEqual([t.status, /nicht eingerichtet/.test(koerper(t).fehler)], [409, true]);

  // 3. Mailserver da, aber die Adresse der Personalstelle fehlt
  const leer = await welt(SMTP, async (m) => void post.push(m));
  await ruf(leer.u, 'PUT', '/api/stammdaten/betrieb', { cookies: als(leer, leer.ausbilder), body: { name: 'Muster GmbH', bundesland: 'HH', personalMail: '' } });
  const b = koerper(await beantrage(leer, '2026-12-07', '2026-12-08', leer.ben)).antrag;
  const h = koerper(await tue(leer, leer.fremd, b.id, 'genehmigen')).antrag;
  assert.deepEqual([h.mail.stand, /fehlt die Mail-Adresse der Personalstelle/.test(h.mail.fehler)], ['ohne', true]);
  assert.equal((await ruf(leer.u, 'POST', '/api/urlaub/mail-test', { cookies: als(leer, leer.ausbilder) })).status, 409);
});

test('Testmail an die Personalstelle: nur Ausbilder; Erfolg und Fehler werden gemeldet', async () => {
  const post: Mail[] = [];
  let kaputt = false;
  const w = await welt(SMTP, async (m) => {
    if (kaputt) throw new MailFehler('Der Mailserver ist nicht erreichbar');
    post.push(m);
  });
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/stammdaten', { cookies: als(w, w.ausbilder) })).mailversand, true);
  const ok = await ruf(w.u, 'POST', '/api/urlaub/mail-test', { cookies: als(w, w.ausbilder) });
  assert.deepEqual([ok.status, koerper(ok).an, post[0].an, post[0].betreff], [200, 'personal@firma.test', 'personal@firma.test', 'Test: Mails aus dem Ausbildungsportal']);
  assert.ok(post[0].text.includes('ausgelöst von Petra Lang'));
  kaputt = true;
  const fehl = await ruf(w.u, 'POST', '/api/urlaub/mail-test', { cookies: als(w, w.ausbilder) });
  assert.deepEqual([fehl.status, koerper(fehl).fehler], [502, 'Die Testmail wurde nicht gesendet: Der Mailserver ist nicht erreichbar']);
  for (const wer of [w.bea, w.anna, w.admin]) assert.equal((await ruf(w.u, 'POST', '/api/urlaub/mail-test', { cookies: als(w, wer) })).status, 403, wer.rolle);
});
