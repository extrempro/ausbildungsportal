import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SAMMEL_MS, verschickeFaellige, vorname, zeilenAus } from '../benachrichtigung';
import { GraphFehler } from '../teams';
import { baueMail } from '../smtp';
import type { Mail } from '../smtp';
import type { BenutzerZeile } from '../typen';
import { admin, koerper, konto, ohneWechsel, ruf, sitzung, umgebung, zuweisen } from './hilfe';
import type { Umgebung } from './hilfe';

// „heute“ ist in der Testumgebung Dienstag, der 10.11.2026.
const PFAD = 'M10 10 L20 20 L30 10 L40 20 L50 10 L60 20';
const INHALT = { betrieb: [{ text: 'Switch konfiguriert', stunden: 40 }], schule: [], unterweisung: [], abwesenheit: [] };
const APP_ID = '7a1b2c3d-0000-4000-8000-000000000001';
const MIT_TEAMS = { ENTRA_TENANT_ID: '11111111-2222-4333-8444-555555555555', ENTRA_CLIENT_ID: 'client-id', ENTRA_CLIENT_SECRET: 'geheim', TEAMS_APP_ID: APP_ID };

interface Welt {
  u: Umgebung;
  petra: BenutzerZeile;
  bea: BenutzerZeile;
  anna: BenutzerZeile;
  ben: BenutzerZeile;
  /** an Microsoft Graph geschickte Meldungen: Objekt-ID der Person und Inhalt */
  teams: { oid: string; pfad: string; body: any }[];
  mails: Mail[];
  /** so antwortet Microsoft – null heißt: angenommen */
  fehler: { wert: Error | null };
}

async function welt(env: Record<string, string> = { ...MIT_TEAMS, SMTP_HOST: 'mail.firma.test', SMTP_ABSENDER: 'portal@firma.test' }): Promise<Welt> {
  const teams: Welt['teams'] = [];
  const mails: Mail[] = [];
  const fehler: Welt['fehler'] = { wert: null };
  const u = await umgebung(
    env,
    null,
    undefined,
    async (m) => {
      mails.push(m);
    },
    async (pfad, body) => {
      if (fehler.wert) throw fehler.wert;
      teams.push({ oid: decodeURIComponent(/^\/users\/([^/]+)\//.exec(pfad)?.[1] ?? ''), pfad, body });
    },
  );
  ohneWechsel(u.db, admin(u.db).id);
  const w: Welt = { u, petra: konto(u.db, 'ausbilder', 'Petra Lang'), bea: konto(u.db, 'beauftragter', 'Bea Auft'), anna: konto(u.db, 'azubi', 'Anna Azubi'), ben: konto(u.db, 'azubi', 'Ben Beispiel'), teams, mails, fehler };
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
    { bereich: 'rueckmeldungen', teams: false, mail: false },
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

  const anAnna = w.teams.find((t) => t.oid === w.anna.entra_oid);
  assert.ok(anAnna);
  assert.match(anAnna.pfad, /^\/users\/oid-\d+\/teamwork\/sendActivityNotification$/);
  assert.equal(anAnna.body.previewText.content, 'In deinem Ausbildungsplan gibt es 2 neue Einträge.');
  assert.equal(anAnna.body.activityType, 'systemDefault');
  const anPetra = w.teams.find((t) => t.oid === w.petra.entra_oid);
  assert.match(anPetra?.body.previewText.content, /2 Berichte wurden eingereicht/);
  assert.equal(w.teams.length, 2);

  const mailBea = w.mails.find((m) => m.an === w.bea.anmeldename);
  assert.match(mailBea?.text ?? '', /Ein Bericht für KW 45 wurde eingereicht/);
  assert.equal(w.mails.length, 2);

  // keine anderen Namen, keine Nachnamen, keine Titel, keine Inhalte – in Teams gar keine Namen, die Mail spricht nur die Person selbst an
  const vornamen: Record<string, string> = { [w.anna.anmeldename]: 'Anna', [w.petra.anmeldename]: 'Petra', [w.bea.anmeldename]: 'Bea' };
  const verboten = ['Anna', 'Petra', 'Bea', 'Ben ', 'Azubi', 'Beispiel', 'Lang', 'Auft', 'Geheimer Titel', 'Serverraum', 'Switch'];
  for (const t of w.teams) for (const v of verboten) assert.ok(!JSON.stringify(t.body).includes(v), `„${v}“ darf nicht in der Teams-Meldung stehen`);
  for (const m of w.mails) {
    const inhalt = [m.betreff, m.text, m.html].join('\n');
    assert.ok(inhalt.includes(`Hallo ${vornamen[m.an]},`), 'Anrede mit dem eigenen Vornamen');
    for (const v of verboten) if (v !== vornamen[m.an]) assert.ok(!inhalt.includes(v), `„${v}“ darf nicht in der Mail an ${vornamen[m.an]} stehen`);
  }
  // der Klick in Teams führt über den Reiter der App zur passenden Seite; die Mail hat eine Text- und eine gestaltete Fassung
  const ziel = (t: { body: any }) => JSON.parse(new URL(t.body.topic.webUrl).searchParams.get('context') ?? '{}').subEntityId;
  assert.ok(anPetra?.body.topic.webUrl.startsWith(`https://teams.microsoft.com/l/entity/${APP_ID}/portal?context=`));
  assert.equal(ziel(anPetra!), 'hinweis:/abzeichnen');
  assert.equal(ziel(anAnna), 'hinweis:/');
  assert.match(mailBea?.html ?? '', /<a href="https:\/\/portal\.test\/abzeichnen"/);
  assert.match(mailBea?.text ?? '', /Zum Portal: https:\/\/portal\.test\/abzeichnen/);
  // die Empfänger stehen nicht im Log
  assert.ok(!w.u.logs.join('\n').includes('oid-'));

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
  assert.equal(w.teams[0].oid, w.anna.entra_oid);
  assert.match(w.teams[0].body.previewText.content, /Testnachricht/);
  assert.equal((await ruf(w.u, 'POST', '/api/ich/benachrichtigungen/test', { cookies: als(w, w.anna), body: { weg: 'mail' } })).status, 200);
  assert.equal(w.mails[0].an, w.anna.anmeldename);
  assert.equal((await ruf(w.u, 'POST', '/api/ich/benachrichtigungen/test', { cookies: als(w, w.anna), body: { weg: 'fax' } })).status, 400);

  // Teams antwortet mit einem Fehler: die Handlung im Portal gelingt, die Warteschlange wird trotzdem geleert, der Grund steht im Log
  await waehle(w, w.anna, [{ bereich: 'plan', teams: true, mail: false }]);
  w.fehler.wert = new GraphFehler(403, 'Forbidden');
  assert.equal((await lege(w, w.petra, 'Aufgabe')).status, 201);
  spaeter(w);
  assert.equal(await verschickeFaellige(w.u.k), 0);
  assert.equal(wartend(w), 0);
  assert.ok(w.u.logs.some((l) => /Benachrichtigung per Teams fehlgeschlagen: Microsoft lehnt ab.*TeamsActivity\.Send/.test(l) && !l.includes(w.anna.entra_oid!) && !l.includes(w.anna.anmeldename)));
  // die Testnachricht nennt den Grund
  const test = await ruf(w.u, 'POST', '/api/ich/benachrichtigungen/test', { cookies: als(w, w.anna), body: { weg: 'teams' } });
  assert.equal(test.status, 502);
  assert.match(koerper(test).fehler, /TeamsActivity\.Send/);
  w.fehler.wert = new GraphFehler(404, 'NotFound');
  assert.match(koerper(await ruf(w.u, 'POST', '/api/ich/benachrichtigungen/test', { cookies: als(w, w.anna), body: { weg: 'teams' } })).fehler, /Teams-App für diese Person installiert/);

  // ein Konto, das noch nie mit Microsoft angemeldet war, kann Teams nicht wählen
  w.u.db.prepare('UPDATE benutzer SET entra_oid = NULL WHERE id = ?').run(w.ben.id);
  assert.match(koerper(await ruf(w.u, 'GET', '/api/ich/benachrichtigungen', { cookies: als(w, w.ben) })).teams.grund, /mit Microsoft verknüpft/);
  assert.equal((await waehle(w, w.ben, [{ bereich: 'plan', teams: true, mail: false }])).status, 409);
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
  assert.deepEqual(zeilenAus([{ art: 'bericht_abgezeichnet', eigenes: true, montag: '2026-11-09', anzahl: 1 }]), [{ text: 'Dein Bericht für KW 46 wurde abgezeichnet.', ton: 'gut', bereich: 'berichtsheft' }]);
  assert.deepEqual(
    zeilenAus([
      { art: 'urlaub_beantragt', eigenes: false, montag: '2026-12-21', anzahl: 1 },
      { art: 'urlaub_beantragt', eigenes: false, montag: '2026-12-28', anzahl: 1 },
      { art: 'plan_neu', eigenes: false, montag: '2026-11-16', anzahl: 5 },
      { art: 'urlaub_abgelehnt', eigenes: true, montag: '2026-12-21', anzahl: 1 },
    ]),
    [
      { text: '2 Urlaubsanträge warten auf dich.', ton: 'wartet', bereich: 'urlaub' },
      { text: 'In Ausbildungsplänen deiner Azubis gibt es 5 neue Einträge.', ton: 'neutral', bereich: 'plan' },
      { text: 'Dein Urlaubsantrag wurde abgelehnt. Den Grund findest du im Portal.', ton: 'achtung', bereich: 'urlaub' },
    ],
  );
});

test('Benachrichtigungen: Anrede mit dem Vornamen – nur wenn er sicher zu erkennen ist', () => {
  assert.equal(vorname('Petra Lang'), 'Petra');
  assert.equal(vorname('Lang, Petra'), 'Petra');
  assert.equal(vorname('  Jean-Luc   Picard '), 'Jean-Luc');
  assert.equal(vorname('Özlem Yılmaz'), 'Özlem');
  assert.equal(vorname('Dr. Petra Lang'), '');
  assert.equal(vorname('P. Lang'), '');
  assert.equal(vorname(''), '');
});

test('Benachrichtigungen: Logo in der Mail; die Mail geht als Text und gestaltet hinaus', async () => {
  const w = await welt();
  // ohne Logo antwortet die Adresse des Logos mit 404
  assert.equal((await ruf(w.u, 'GET', '/api/branding/logo')).status, 404);

  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 7)]);
  assert.equal((await ruf(w.u, 'PUT', '/api/branding/logo', { cookies: sitzung(w.u, admin(w.u.db)), body: { daten: `data:image/png;base64,${png.toString('base64')}` } })).status, 200);
  // das Logo ist ohne Anmeldung abrufbar (Kopfzeile, Anmeldeseite, Karten im Teams-Kanal)
  const bild = await ruf(w.u, 'GET', '/api/branding/logo');
  assert.equal(bild.status, 200);
  assert.equal(bild.bild?.typ, 'image/png');
  assert.ok(bild.bild?.inhalt.equals(png));

  await ruf(w.u, 'POST', '/api/ich/benachrichtigungen/test', { cookies: als(w, w.petra), body: { weg: 'mail' } });
  const mail = w.mails[0];
  assert.match(mail.html ?? '', /<img src="cid:logo@ausbildungsportal"/);
  assert.ok(mail.bild?.inhalt.equals(png));

  // so geht sie über die Leitung: Text und HTML als Alternativen, das Logo hängt an der HTML-Fassung
  const roh = baueMail({ absender: 'portal@firma.test' }, mail, new Date('2026-11-12T08:00:00Z'));
  assert.match(roh, /Content-Type: multipart\/alternative; boundary="/);
  assert.match(roh, /Content-Type: multipart\/related; boundary="[^"]+"; type="text\/html"/);
  assert.match(roh, /Content-Type: text\/plain; charset=utf-8/);
  assert.match(roh, /Content-Type: text\/html; charset=utf-8/);
  assert.match(roh, /Content-Type: image\/png\r\nContent-Transfer-Encoding: base64\r\nContent-ID: <logo@ausbildungsportal>\r\nContent-Disposition: inline/);
  assert.ok(roh.indexOf('text/plain') < roh.indexOf('text/html'), 'die Textfassung steht zuerst');
  for (const zeile of roh.split('\r\n')) assert.ok(zeile.length <= 998, 'keine überlange Zeile');
  // eine Mail ohne gestaltete Fassung bleibt, wie sie war
  assert.match(baueMail({ absender: 'portal@firma.test' }, { an: 'x@firma.test', betreff: 'Test', text: 'Hallo' }, new Date()), /MIME-Version: 1\.0\r\nAuto-Submitted: auto-generated\r\nContent-Type: text\/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\nSGFsbG8=$/);
});

test('Benachrichtigungen: eine Rückfrage zur eigenen Rückmeldung geht nur an die meldende Person – ohne Namen und ohne Inhalt', async () => {
  const w = await welt();
  await waehle(w, w.ben, [{ bereich: 'rueckmeldungen', teams: true, mail: true }]);
  await waehle(w, w.anna, [{ bereich: 'rueckmeldungen', teams: true, mail: true }]);
  await waehle(w, w.bea, [{ bereich: 'rueckmeldungen', teams: true, mail: true }]);
  await ruf(w.u, 'POST', '/api/fehlermeldungen', { cookies: als(w, w.ben), body: { art: 'idee', text: 'Eine Suche im Berichtsheft wäre toll.' } });
  const id = (w.u.db.prepare('SELECT id FROM fehlermeldung').get() as { id: number }).id;
  assert.equal((await ruf(w.u, 'POST', `/api/rueckmeldungen/${id}/nachricht`, { cookies: als(w, w.petra), body: { text: 'Geheime Rückfrage: Wonach willst du suchen?' } })).status, 201);
  spaeter(w);
  await verschickeFaellige(w.u.k);
  assert.equal(w.teams.length, 1);
  assert.equal(w.mails.length, 1);
  assert.equal(w.mails[0].an, w.ben.anmeldename);
  const alles = JSON.stringify([w.teams, w.mails]);
  for (const nicht of ['Petra', 'Geheime', 'Suche im Berichtsheft']) assert.ok(!alles.includes(nicht), nicht);
  assert.ok(alles.includes('/meine-meldungen'));
});
