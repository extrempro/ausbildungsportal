import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SAMMEL_MS, verschickeFaellige, zeilenAus } from '../benachrichtigung';
import type { Mail } from '../smtp';
import type { BenutzerZeile } from '../typen';
import { admin, koerper, konto, ohneWechsel, ruf, sitzung, umgebung, zuweisen } from './hilfe';
import type { Umgebung } from './hilfe';

// „heute“ ist in der Testumgebung Dienstag, der 10.11.2026.
const PFAD = 'M10 10 L20 20 L30 10 L40 20 L50 10 L60 20';
const INHALT = { betrieb: [{ text: 'Switch konfiguriert', stunden: 40 }], schule: [], unterweisung: [], abwesenheit: [] };
const HOOK = 'https://teams.test/workflow?sig=geheim';

interface Welt {
  u: Umgebung;
  petra: BenutzerZeile;
  bea: BenutzerZeile;
  anna: BenutzerZeile;
  ben: BenutzerZeile;
  teams: { url: string; body: any }[];
  mails: Mail[];
  antwort: { ok: boolean; status: number };
}

async function welt(env: Record<string, string> = { TEAMS_CHAT_WEBHOOK_URL: HOOK, SMTP_HOST: 'mail.firma.test', SMTP_ABSENDER: 'portal@firma.test' }): Promise<Welt> {
  const teams: Welt['teams'] = [];
  const mails: Mail[] = [];
  const antwort = { ok: true, status: 202 };
  const u = await umgebung(
    env,
    null,
    async (url, body) => {
      teams.push({ url, body });
      return antwort;
    },
    async (m) => {
      mails.push(m);
    },
  );
  ohneWechsel(u.db, admin(u.db).id);
  const w: Welt = { u, petra: konto(u.db, 'ausbilder', 'Petra Lang'), bea: konto(u.db, 'beauftragter', 'Bea Auft'), anna: konto(u.db, 'azubi', 'Anna Azubi'), ben: konto(u.db, 'azubi', 'Ben Beispiel'), teams, mails, antwort };
  const cookies = sitzung(u, w.petra);
  await ruf(u, 'PUT', '/api/stammdaten/betrieb', { cookies, body: { name: 'Muster GmbH', bundesland: 'HH' } });
  for (const a of [w.anna, w.ben]) await ruf(u, 'PUT', `/api/azubis/${a.id}/profil`, { cookies, body: { ausbildungsbeginn: '2025-08-01', ausbilderId: w.petra.id } });
  for (const wer of [w.petra, w.bea, w.anna, w.ben]) await ruf(u, 'PUT', '/api/ich/unterschrift', { cookies: sitzung(u, wer), body: { pfad: PFAD } });
  zuweisen(u.db, w.anna, w.bea);
  return w;
}

const als = (w: Welt, wer: BenutzerZeile) => sitzung(w.u, wer);
const waehle = (w: Welt, wer: BenutzerZeile, wahl: { bereich: string; teams: boolean; mail: boolean }[]) => ruf(w.u, 'PUT', '/api/ich/benachrichtigungen', { cookies: als(w, wer), body: { wahl } });
const lege = (w: Welt, wer: BenutzerZeile, titel: string, a: BenutzerZeile = w.anna) =>
  ruf(w.u, 'POST', `/api/azubis/${a.id}/plan`, { cookies: als(w, wer), body: { art: 'aufgabe', von: '2026-11-16', bis: '2026-11-16', titel } });
async function reicheEin(w: Welt, a: BenutzerZeile, montag: string) {
  assert.equal((await ruf(w.u, 'PUT', `/api/azubis/${a.id}/berichte/${montag}`, { cookies: als(w, a), body: { inhalt: INHALT } })).status, 200);
  assert.equal((await ruf(w.u, 'POST', `/api/azubis/${a.id}/berichte/${montag}/einreichen`, { cookies: als(w, a) })).status, 200);
}
const spaeter = (w: Welt, ms = SAMMEL_MS + 1000) => {
  w.u.uhr.jetzt = new Date(w.u.uhr.jetzt.getTime() + ms);
};
const wartend = (w: Welt) => (w.u.db.prepare('SELECT COUNT(*) AS n FROM benachrichtigung_warte').get() as { n: number }).n;

test('Benachrichtigungen: anfangs ist alles aus – ohne Wahl geht nichts hinaus', async () => {
  const w = await welt();
  const start = koerper(await ruf(w.u, 'GET', '/api/ich/benachrichtigungen', { cookies: als(w, w.anna) }));
  assert.deepEqual(start.wahl, [
    { bereich: 'berichtsheft', teams: false, mail: false },
    { bereich: 'urlaub', teams: false, mail: false },
    { bereich: 'plan', teams: false, mail: false },
  ]);
  assert.equal(start.teams.grund, null);
  assert.equal(start.mail.adresse, w.anna.anmeldename);
  await lege(w, w.petra, 'Serverraum aufräumen');
  await reicheEin(w, w.anna, '2026-11-02');
  assert.equal(wartend(w), 0);
  spaeter(w);
  assert.equal(await verschickeFaellige(w.u.k), 0);
  assert.equal(w.teams.length + w.mails.length, 0);
});

test('Benachrichtigungen: je Bereich und Weg wählbar; verschickt wird gebündelt, ohne Namen und nur an Berechtigte', async () => {
  const w = await welt();
  assert.equal((await waehle(w, w.anna, [{ bereich: 'plan', teams: true, mail: false }])).status, 200);
  assert.equal((await waehle(w, w.petra, [{ bereich: 'berichtsheft', teams: true, mail: true }])).status, 200);
  assert.equal((await waehle(w, w.bea, [{ bereich: 'berichtsheft', teams: false, mail: true }])).status, 200);

  await lege(w, w.petra, 'Serverraum aufräumen');
  await lege(w, w.petra, 'Geheimer Titel');
  await reicheEin(w, w.anna, '2026-11-02');
  await reicheEin(w, w.ben, '2026-11-02'); // Ben ist Bea nicht zugewiesen
  // Anna: 2 Plan-Einträge (Teams). Petra: 2 Berichte (beide Wege). Bea: nur Annas Bericht (Mail).
  assert.equal(wartend(w), 2 + 2 + 1);

  // vor Ablauf der Sammelzeit geht nichts hinaus
  assert.equal(await verschickeFaellige(w.u.k), 0);
  spaeter(w);
  assert.equal(await verschickeFaellige(w.u.k), 4);
  assert.equal(wartend(w), 0);

  const anAnna = w.teams.find((t) => t.body.empfaenger === w.anna.anmeldename);
  assert.ok(anAnna);
  assert.equal(anAnna.url, HOOK);
  assert.match(JSON.stringify(anAnna.body.karte), /In deinem Ausbildungsplan gibt es 2 neue Einträge\./);
  const anPetra = w.teams.find((t) => t.body.empfaenger === w.petra.anmeldename);
  assert.match(JSON.stringify(anPetra?.body.karte), /2 Berichte wurden eingereicht/);
  assert.equal(w.teams.length, 2);

  const mailBea = w.mails.find((m) => m.an === w.bea.anmeldename);
  assert.match(mailBea?.text ?? '', /Ein Bericht für KW 45 wurde eingereicht/);
  assert.equal(w.mails.length, 2);

  // keine Namen, keine Titel, keine Inhalte – in keiner Nachricht
  const alles = JSON.stringify(w.teams.map((t) => t.body.karte)) + JSON.stringify(w.mails.map((m) => [m.betreff, m.text]));
  for (const verboten of ['Anna', 'Azubi', 'Beispiel', 'Petra', 'Lang', 'Auft', 'Geheimer Titel', 'Serverraum', 'Switch']) assert.ok(!alles.includes(verboten), `„${verboten}“ darf in keiner Nachricht stehen`);
  // die Adresse des Workflows steht nicht im Log
  assert.ok(!w.u.logs.join('\n').includes('geheim'));

  // ein zweiter Lauf schickt nichts doppelt
  spaeter(w);
  assert.equal(await verschickeFaellige(w.u.k), 0);
});

test('Benachrichtigungen: die eigene Handlung wird nicht gemeldet; Abgewähltes geht nicht mehr hinaus', async () => {
  const w = await welt();
  await waehle(w, w.petra, [{ bereich: 'plan', teams: true, mail: false }]);
  await waehle(w, w.anna, [{ bereich: 'plan', teams: true, mail: true }]);
  await lege(w, w.petra, 'Aufgabe'); // Petra selbst bekommt nichts, Anna schon
  assert.equal(wartend(w), 1);
  await waehle(w, w.anna, [{ bereich: 'plan', teams: false, mail: false }]);
  spaeter(w);
  assert.equal(await verschickeFaellige(w.u.k), 0);
  assert.equal(w.teams.length + w.mails.length, 0);
  assert.equal(wartend(w), 0);
});

test('Benachrichtigungen: nicht eingerichtete Wege lassen sich nicht einschalten; Fehler beim Versand stören nicht', async () => {
  const ohne = await welt({});
  const start = koerper(await ruf(ohne.u, 'GET', '/api/ich/benachrichtigungen', { cookies: als(ohne, ohne.anna) }));
  assert.match(start.teams.grund, /nicht eingerichtet/);
  assert.match(start.mail.grund, /nicht eingerichtet/);
  assert.equal((await waehle(ohne, ohne.anna, [{ bereich: 'plan', teams: true, mail: false }])).status, 409);
  assert.equal((await waehle(ohne, ohne.anna, [{ bereich: 'plan', teams: false, mail: true }])).status, 409);
  assert.equal((await ruf(ohne.u, 'POST', '/api/ich/benachrichtigungen/test', { cookies: als(ohne, ohne.anna), body: { weg: 'teams' } })).status, 502);

  const w = await welt();
  assert.equal((await ruf(w.u, 'POST', '/api/ich/benachrichtigungen/test', { cookies: als(w, w.anna), body: { weg: 'teams' } })).status, 200);
  assert.equal(w.teams[0].body.empfaenger, w.anna.anmeldename);
  assert.equal((await ruf(w.u, 'POST', '/api/ich/benachrichtigungen/test', { cookies: als(w, w.anna), body: { weg: 'mail' } })).status, 200);
  assert.equal(w.mails[0].an, w.anna.anmeldename);
  assert.equal((await ruf(w.u, 'POST', '/api/ich/benachrichtigungen/test', { cookies: als(w, w.anna), body: { weg: 'fax' } })).status, 400);

  // Teams antwortet mit einem Fehler: die Handlung im Portal gelingt, die Warteschlange wird trotzdem geleert, der Grund steht im Log
  await waehle(w, w.anna, [{ bereich: 'plan', teams: true, mail: false }]);
  w.antwort.ok = false;
  w.antwort.status = 500;
  assert.equal((await lege(w, w.petra, 'Aufgabe')).status, 201);
  spaeter(w);
  assert.equal(await verschickeFaellige(w.u.k), 0);
  assert.equal(wartend(w), 0);
  assert.ok(w.u.logs.some((l) => /Benachrichtigung per Teams fehlgeschlagen/.test(l) && !l.includes('geheim') && !l.includes(w.anna.anmeldename)));
});

test('Benachrichtigungen: ungültige Angaben, fremde Rollen und zurückgenommene Aktivitäten', async () => {
  const w = await welt();
  assert.equal((await waehle(w, w.anna, [{ bereich: 'lernen', teams: true, mail: false }])).status, 400);
  assert.equal((await ruf(w.u, 'PUT', '/api/ich/benachrichtigungen', { cookies: als(w, w.anna), body: { wahl: 'alles' } })).status, 400);
  assert.equal((await ruf(w.u, 'GET', '/api/ich/benachrichtigungen', { cookies: sitzung(w.u, admin(w.u.db)) })).status, 403);
  assert.equal((await ruf(w.u, 'GET', '/api/ich/benachrichtigungen')).status, 401);

  // verschwindet die Aktivität, verschwindet auch der wartende Eintrag
  await waehle(w, w.anna, [{ bereich: 'plan', teams: true, mail: false }]);
  await lege(w, w.petra, 'Aufgabe');
  assert.equal(wartend(w), 1);
  w.u.db.prepare('DELETE FROM aktivitaet').run();
  assert.equal(wartend(w), 0);

  // gesperrte Konten bekommen nichts
  await lege(w, w.petra, 'Aufgabe 2');
  w.u.db.prepare("UPDATE benutzer SET status = 'gesperrt' WHERE id = ?").run(w.anna.id);
  spaeter(w);
  assert.equal(await verschickeFaellige(w.u.k), 0);
  assert.equal(w.teams.length, 0);
});

test('Benachrichtigungen: Texte fassen zusammen und unterscheiden „dein“ von „ein“', () => {
  assert.deepEqual(zeilenAus([{ art: 'bericht_abgezeichnet', eigenes: true, montag: '2026-11-09', anzahl: 1 }]), ['Dein Bericht für KW 46 wurde abgezeichnet.']);
  assert.deepEqual(
    zeilenAus([
      { art: 'urlaub_beantragt', eigenes: false, montag: '2026-12-21', anzahl: 1 },
      { art: 'urlaub_beantragt', eigenes: false, montag: '2026-12-28', anzahl: 1 },
      { art: 'plan_neu', eigenes: false, montag: '2026-11-16', anzahl: 5 },
    ]),
    ['2 Urlaubsanträge warten auf dich.', 'In Ausbildungsplänen deiner Azubis gibt es 5 neue Einträge.'],
  );
});
