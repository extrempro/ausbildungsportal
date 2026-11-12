import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cookieName, ROUTEN } from '../api';
import { LEERLAUF_MS } from '../sitzung';
import { ROLLEN } from '../typen';
import type { BenutzerZeile, Rolle } from '../typen';
import { admin, APP, cookiesAus, koerper, konto, ohneWechsel, ruf, sitzung, umgebung, zustaendig, zuweisen } from './hilfe';
import type { Umgebung } from './hilfe';

const START = 'Start-Passwort-2026!';
const NEU = 'Ganz-neues-Kennwort-77';

function alle(u: Umgebung): Record<Rolle, BenutzerZeile> {
  ohneWechsel(u.db, admin(u.db).id);
  return { admin: admin(u.db), ausbilder: konto(u.db, 'ausbilder'), beauftragter: konto(u.db, 'beauftragter'), azubi: konto(u.db, 'azubi') };
}

// ---------- jede Route × jede Rolle ----------

test('jede Route: ohne Anmeldung 401, mit falscher Rolle 403, mit erlaubter Rolle kein Rechtefehler', async () => {
  const u = await umgebung({ DEV_ANMELDUNG: 'true' });
  const wer = alle(u);
  const ziel = konto(u.db, 'azubi');
  let geprueft = 0;
  for (const route of ROUTEN) {
    if (route.wer === 'offen') continue;
    const pfad = route.p.replace(':id', String(ziel.id));
    const ohne = await ruf(u, route.m, pfad, { body: {} });
    assert.equal(ohne.status, 401, `${route.m} ${route.p} ohne Anmeldung`);
    for (const rolle of ROLLEN) {
      const a = await ruf(u, route.m, pfad, { cookies: sitzung(u, wer[rolle]), body: {} });
      const erlaubt = route.wer === 'alle' || route.wer.includes(rolle);
      if (erlaubt) {
        assert.notEqual(a.status, 401, `${route.m} ${route.p} als ${rolle}`);
        assert.notEqual(koerper(a).code, 'rolle', `${route.m} ${route.p} als ${rolle}`);
      } else {
        assert.equal(a.status, 403, `${route.m} ${route.p} als ${rolle}`);
        assert.equal(koerper(a).code, 'rolle');
      }
      geprueft++;
    }
  }
  assert.ok(geprueft >= 40, `nur ${geprueft} Kombinationen geprüft`);
});

test('die Rechtetabelle der Routen entspricht dem Kontext-Dokument', () => {
  const tabelle = Object.fromEntries(ROUTEN.map((r) => [`${r.m} ${r.p}`, Array.isArray(r.wer) ? r.wer.join(',') : r.wer]));
  assert.deepEqual(tabelle, {
    'GET /api/health': 'offen',
    'GET /api/auth/status': 'offen',
    'POST /api/auth/lokal': 'offen',
    'GET /api/auth/entra/login': 'offen',
    'GET /api/auth/entra/callback': 'offen',
    'POST /api/auth/dev': 'offen',
    'POST /api/auth/abmelden': 'alle',
    'GET /api/ich': 'alle',
    'PUT /api/ich/passwort': 'admin',
    'PUT /api/ich/bild': 'alle',
    'GET /api/benutzer/:id/bild': 'alle',
    'PUT /api/ich/theme': 'alle',
    'GET /api/konten': 'admin,ausbilder',
    'POST /api/konten': 'admin,ausbilder',
    'PATCH /api/konten/:id': 'admin,ausbilder',
    'POST /api/konten/:id/entra-loesen': 'admin,ausbilder',
    'POST /api/konten/:id/passwort-zuruecksetzen': 'admin',
    'DELETE /api/konten/:id': 'admin,ausbilder',
    'GET /api/azubis': 'ausbilder,beauftragter',
    'POST /api/azubis/:id/uebernehmen': 'ausbilder',
    'GET /api/lernen': 'azubi',
    'GET /api/lernpakete/einreichungen': 'ausbilder,admin',
    'POST /api/lernpakete/einreichungen': 'ausbilder',
    'GET /api/lernpakete/einreichungen/:id/zip': 'ausbilder,admin',
    'POST /api/lernpakete/einreichungen/:id/zurueckziehen': 'ausbilder',
    'POST /api/lernpakete/einreichungen/:id/zurueckgeben': 'admin',
    'POST /api/lernpakete/einreichungen/:id/uebernehmen': 'admin',
    'GET /api/abteilungen': 'ausbilder,beauftragter',
    'POST /api/abteilungen': 'ausbilder',
    'PUT /api/abteilungen/:id': 'ausbilder',
    'DELETE /api/abteilungen/:id': 'ausbilder',
    'GET /api/lerninhalte': 'ausbilder,beauftragter',
    'GET /api/lerninhalte/:paket': 'ausbilder,beauftragter',
    'GET /api/lerninhalte/:paket/kompendium': 'ausbilder,beauftragter',
    'GET /api/lerninhalte/:paket/thema/:id': 'ausbilder,beauftragter',
    'GET /api/lernen/kompendium': 'azubi',
    'GET /api/lernen/ueben': 'azubi',
    'GET /api/lernen/karten': 'azubi',
    'PATCH /api/lernen/karte': 'azubi',
    'GET /api/lernen/quiz/:id': 'azubi',
    'POST /api/lernen/quiz/:id': 'azubi',
    'GET /api/lernen/thema/:id': 'azubi',
    'PATCH /api/lernen/unterthema/:id': 'azubi',
    'PATCH /api/lernen/zusatz/:id': 'azubi',
    'GET /api/ich/kalender': 'ausbilder,beauftragter,azubi',
    'POST /api/ich/kalender': 'ausbilder,beauftragter,azubi',
    'DELETE /api/ich/kalender': 'ausbilder,beauftragter,azubi',
    'GET /api/azubis/:id/zuweisungen': 'ausbilder,beauftragter,azubi',
    'PUT /api/azubis/:id/zuweisungen': 'ausbilder',
    'GET /api/protokoll': 'admin',
    'GET /api/branding': 'offen',
    'GET /api/branding/logo': 'offen',
    'PUT /api/branding/logo': 'admin',
    'DELETE /api/branding/logo': 'admin',
    'GET /api/stammdaten': 'ausbilder,beauftragter,azubi',
    'PUT /api/stammdaten/betrieb': 'ausbilder',
    'POST /api/stammdaten/berufe': 'ausbilder',
    'PATCH /api/stammdaten/berufe/:id': 'ausbilder',
    'DELETE /api/stammdaten/berufe/:id': 'ausbilder',
    'POST /api/stammdaten/berufsschulen': 'ausbilder',
    'PATCH /api/stammdaten/berufsschulen/:id': 'ausbilder',
    'DELETE /api/stammdaten/berufsschulen/:id': 'ausbilder',
    'GET /api/azubis/:id/profil': 'ausbilder,beauftragter,azubi',
    'PUT /api/azubis/:id/profil': 'ausbilder',
    'GET /api/kalender': 'ausbilder,beauftragter,azubi',
    'GET /api/ich/unterschrift': 'ausbilder,beauftragter,azubi',
    'PUT /api/ich/unterschrift': 'ausbilder,beauftragter,azubi',
    'DELETE /api/ich/unterschrift': 'ausbilder,beauftragter,azubi',
    'GET /api/azubis/:id/berichtsheft.pdf': 'ausbilder,beauftragter,azubi',
    'GET /api/azubis/:id/berichte': 'ausbilder,beauftragter,azubi',
    'GET /api/azubis/:id/berichte/:montag': 'ausbilder,beauftragter,azubi',
    'POST /api/azubis/:id/berichte/:montag/anhaenge': 'azubi',
    'GET /api/azubis/:id/berichte/:montag/anhaenge/:anhang': 'ausbilder,beauftragter,azubi',
    'DELETE /api/azubis/:id/berichte/:montag/anhaenge/:anhang': 'azubi',
    'PUT /api/azubis/:id/berichte/:montag': 'azubi',
    'DELETE /api/azubis/:id/berichte/:montag': 'azubi',
    'POST /api/azubis/:id/berichte/:montag/einreichen': 'azubi',
    'POST /api/azubis/:id/berichte/:montag/zurueckziehen': 'azubi',
    'GET /api/abo/:datei': 'offen',
    'GET /api/abzeichnen': 'ausbilder,beauftragter',
    'GET /api/plan/sammel': 'ausbilder',
    'POST /api/plan/sammel': 'ausbilder',
    'DELETE /api/plan/sammel/:id': 'ausbilder',
    'POST /api/fehlermeldungen': 'alle',
    'GET /api/fehlermeldungen': 'admin',
    'GET /api/fehlermeldungen/:id/bild': 'admin',
    'POST /api/fehlermeldungen/webhook-test': 'admin',
    'PATCH /api/fehlermeldungen/:id': 'admin',
    'DELETE /api/fehlermeldungen/:id': 'admin',
    'GET /api/aktivitaeten': 'ausbilder,beauftragter,azubi',
    'POST /api/aktivitaeten/gesehen': 'ausbilder,beauftragter,azubi',
    'GET /api/ich/benachrichtigungen': 'ausbilder,beauftragter,azubi',
    'PUT /api/ich/benachrichtigungen': 'ausbilder,beauftragter,azubi',
    'POST /api/ich/benachrichtigungen/test': 'ausbilder,beauftragter,azubi',
    'POST /api/berichte/abzeichnen': 'ausbilder,beauftragter',
    'POST /api/azubis/:id/berichte/:montag/zurueckgeben': 'ausbilder,beauftragter',
    'POST /api/azubis/:id/berichte/:montag/oeffnen': 'ausbilder',
    'GET /api/versionshinweise': 'alle',
    'GET /api/azubis/:id/plan': 'ausbilder,beauftragter,azubi',
    'POST /api/azubis/:id/plan': 'ausbilder,beauftragter,azubi',
    'PUT /api/azubis/:id/plan/:eid': 'ausbilder,beauftragter,azubi',
    'DELETE /api/azubis/:id/plan/:eid': 'ausbilder,beauftragter,azubi',
    'POST /api/azubis/:id/plan/:eid/haken': 'ausbilder,beauftragter,azubi',
    'POST /api/azubis/:id/plan/vorlage': 'ausbilder',
    'GET /api/planvorlagen': 'ausbilder',
    'POST /api/planvorlagen': 'ausbilder',
    'PUT /api/planvorlagen/:id': 'ausbilder',
    'DELETE /api/planvorlagen/:id': 'ausbilder',
    'GET /api/jahreskalender': 'azubi,ausbilder,beauftragter',
    'GET /api/azubis/:id/urlaub': 'ausbilder,beauftragter,azubi',
    'GET /api/azubis/:id/urlaub/pruefen': 'azubi',
    'POST /api/azubis/:id/urlaub': 'azubi',
    'GET /api/urlaub': 'ausbilder,beauftragter',
    'POST /api/urlaub/:id/zurueckziehen': 'azubi',
    'POST /api/urlaub/:id/bestaetigen': 'ausbilder,beauftragter',
    'POST /api/urlaub/:id/ablehnen': 'ausbilder,beauftragter',
    'POST /api/urlaub/:id/genehmigen': 'ausbilder',
    'POST /api/urlaub/:id/stornieren': 'ausbilder',
    'POST /api/urlaub/:id/mail': 'ausbilder',
    'POST /api/urlaub/mail-test': 'ausbilder',
  });
});

test('unbekannte Pfade 404, falsche Methode 405', async () => {
  const u = await umgebung();
  assert.equal((await ruf(u, 'GET', '/api/gibt-es-nicht')).status, 404);
  assert.equal((await ruf(u, 'DELETE', '/api/health')).status, 405);
  assert.equal((await ruf(u, 'GET', '/api/konten/')).status, 404);
});

// ---------- erster Start und lokale Anmeldung ----------

test('erster Start legt genau einen Super-Admin an, das Passwort steht nicht im Log', async () => {
  const u = await umgebung();
  const a = admin(u.db);
  assert.equal(a.anmeldename, 'chef');
  assert.equal(a.passwort_wechsel, 1);
  assert.ok(a.passwort_hash?.startsWith('scrypt$'));
  assert.ok(!u.logs.join('\n').includes(START), 'vorgegebenes Passwort darf nicht ins Log');
  assert.equal((u.db.prepare('SELECT COUNT(*) AS n FROM benutzer').get() as { n: number }).n, 1);
});

test('ohne ADMIN_PASSWORT: Zufallspasswort einmalig im Log, Anmeldung damit möglich', async () => {
  const u = await umgebung({ ADMIN_BENUTZER: '', ADMIN_PASSWORT: '' });
  const zeile = u.logs.find((l) => l.startsWith('Startpasswort'));
  assert.ok(zeile);
  const passwort = zeile.split(': ')[1];
  assert.equal((await ruf(u, 'POST', '/api/auth/lokal', { body: { benutzername: 'admin', passwort } })).status, 200);
});

test('lokale Anmeldung: Cookie mit HttpOnly, SameSite, Secure und __Host-Präfix', async () => {
  const u = await umgebung();
  const a = await ruf(u, 'POST', '/api/auth/lokal', { body: { benutzername: 'Chef', passwort: START } });
  assert.equal(a.status, 200);
  const cookie = a.cookies?.[0] ?? '';
  assert.match(cookie, /^__Host-ap_sitzung=[\w-]{43}; Path=\/; HttpOnly; SameSite=Lax; Max-Age=86400; Secure$/);
  const token = cookiesAus(a)['__Host-ap_sitzung'];
  const gespeichert = u.db.prepare('SELECT token_hash FROM sitzung').get() as { token_hash: string };
  assert.notEqual(gespeichert.token_hash, token, 'in der Datenbank steht nur der Hash');
  assert.equal(koerper(await ruf(u, 'GET', '/api/ich', { cookies: cookiesAus(a) })).konto.anmeldename, 'chef');
});

test('ohne HTTPS (lokale Entwicklung) kein Secure und kein __Host-Präfix', async () => {
  const u = await umgebung({ APP_URL: 'http://localhost:3000' });
  const a = await ruf(u, 'POST', '/api/auth/lokal', { body: { benutzername: 'chef', passwort: START }, origin: 'http://localhost:3000' });
  assert.match(a.cookies?.[0] ?? '', /^ap_sitzung=[\w-]+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=86400$/);
});

test('falsches Passwort und unbekanntes Konto liefern dieselbe Antwort', async () => {
  const u = await umgebung();
  const falsch = await ruf(u, 'POST', '/api/auth/lokal', { body: { benutzername: 'chef', passwort: 'falsch' } });
  const unbekannt = await ruf(u, 'POST', '/api/auth/lokal', { body: { benutzername: 'niemand', passwort: 'falsch' } });
  assert.equal(falsch.status, 401);
  assert.deepEqual(falsch.body, unbekannt.body);
  assert.equal(falsch.cookies, undefined);
});

test('Entra-Konten können sich nicht lokal anmelden', async () => {
  const u = await umgebung();
  const ausbilder = konto(u.db, 'ausbilder');
  for (const passwort of ['', 'null', START]) {
    assert.equal((await ruf(u, 'POST', '/api/auth/lokal', { body: { benutzername: ausbilder.anmeldename, passwort } })).status, 401);
  }
});

test('nach 5 Fehlversuchen 15 Minuten Wartezeit – auch mit richtigem Passwort', async () => {
  const u = await umgebung();
  for (let i = 0; i < 5; i++) {
    assert.equal((await ruf(u, 'POST', '/api/auth/lokal', { body: { benutzername: 'chef', passwort: `falsch-${i}` } })).status, 401);
  }
  assert.equal((await ruf(u, 'POST', '/api/auth/lokal', { body: { benutzername: 'chef', passwort: START } })).status, 401, 'während der Wartezeit');
  u.uhr.jetzt = new Date(u.uhr.jetzt.getTime() + 16 * 60 * 1000);
  assert.equal((await ruf(u, 'POST', '/api/auth/lokal', { body: { benutzername: 'chef', passwort: START } })).status, 200, 'nach der Wartezeit');
  assert.equal(admin(u.db).fehlversuche, 0);
});

test('Begrenzung je IP: nach 30 Versuchen 429, andere IP unberührt', async () => {
  const u = await umgebung();
  let letzte = 0;
  for (let i = 0; i < 31; i++) letzte = (await ruf(u, 'POST', '/api/auth/lokal', { body: { benutzername: `x${i}`, passwort: 'y' }, ip: '203.0.113.9' })).status;
  assert.equal(letzte, 429);
  assert.equal((await ruf(u, 'POST', '/api/auth/lokal', { body: { benutzername: 'x', passwort: 'y' }, ip: '203.0.113.10' })).status, 401);
});

// ---------- erzwungener Passwortwechsel ----------

test('vor dem Passwortwechsel ist nur Konto, Passwort und Abmelden erreichbar', async () => {
  const u = await umgebung();
  const cookies = cookiesAus(await ruf(u, 'POST', '/api/auth/lokal', { body: { benutzername: 'chef', passwort: START } }));
  const gesperrt = await ruf(u, 'GET', '/api/konten', { cookies });
  assert.equal(gesperrt.status, 403);
  assert.equal(koerper(gesperrt).code, 'passwort_wechsel');
  assert.equal((await ruf(u, 'POST', '/api/konten', { cookies, body: { anmeldename: 'a@b.de', anzeigename: 'A', rolle: 'azubi' } })).status, 403);
  assert.equal(koerper(await ruf(u, 'GET', '/api/ich', { cookies })).konto.passwortWechsel, true);

  const fehler = async (body: unknown) => koerper(await ruf(u, 'PUT', '/api/ich/passwort', { cookies, body })).fehler as string;
  assert.match(await fehler({ alt: 'falsch', neu: NEU }), /bisherige Passwort/);
  assert.match(await fehler({ alt: START, neu: 'zu kurz' }), /mindestens 14/);
  assert.match(await fehler({ alt: START, neu: START }), /unterscheiden/);

  assert.equal((await ruf(u, 'PUT', '/api/ich/passwort', { cookies, body: { alt: START, neu: NEU } })).status, 200);
  assert.equal((await ruf(u, 'GET', '/api/konten', { cookies })).status, 200);
  assert.equal((await ruf(u, 'POST', '/api/auth/lokal', { body: { benutzername: 'chef', passwort: START } })).status, 401, 'altes Passwort gilt nicht mehr');
  assert.equal((await ruf(u, 'POST', '/api/auth/lokal', { body: { benutzername: 'chef', passwort: NEU } })).status, 200);
});

test('Passwortwechsel meldet andere Geräte ab, das eigene bleibt angemeldet', async () => {
  const u = await umgebung();
  const a = admin(u.db);
  const hier = sitzung(u, a);
  const dort = sitzung(u, a);
  assert.equal((await ruf(u, 'PUT', '/api/ich/passwort', { cookies: hier, body: { alt: START, neu: NEU } })).status, 200);
  assert.equal((await ruf(u, 'GET', '/api/ich', { cookies: hier })).status, 200);
  assert.equal((await ruf(u, 'GET', '/api/ich', { cookies: dort })).status, 401);
});

// ---------- Sitzungen ----------

test('Sitzung endet nach 8 Stunden ohne Aktivität und spätestens nach 24 Stunden', async () => {
  const u = await umgebung();
  const w = alle(u);
  const start = u.uhr.jetzt.getTime();
  const c1 = sitzung(u, w.azubi);
  u.uhr.jetzt = new Date(start + LEERLAUF_MS + 60_000);
  assert.equal((await ruf(u, 'GET', '/api/ich', { cookies: c1 })).status, 401, 'Leerlauf');

  u.uhr.jetzt = new Date(start);
  const c2 = sitzung(u, w.azubi);
  for (let h = 6; h <= 18; h += 6) {
    u.uhr.jetzt = new Date(start + h * 3_600_000);
    assert.equal((await ruf(u, 'GET', '/api/ich', { cookies: c2 })).status, 200, `aktiv nach ${h} h`);
  }
  u.uhr.jetzt = new Date(start + 24 * 3_600_000 + 60_000);
  assert.equal((await ruf(u, 'GET', '/api/ich', { cookies: c2 })).status, 401, 'Höchstdauer');
  assert.equal((u.db.prepare('SELECT COUNT(*) AS n FROM sitzung').get() as { n: number }).n, 0, 'abgelaufene Sitzungen werden gelöscht');
});

test('Abmelden beendet die Sitzung auf dem Server', async () => {
  const u = await umgebung();
  const w = alle(u);
  const cookies = sitzung(u, w.azubi);
  const ab = await ruf(u, 'POST', '/api/auth/abmelden', { cookies });
  assert.equal(ab.status, 200);
  assert.match(ab.cookies?.[0] ?? '', /Max-Age=0/);
  assert.equal((await ruf(u, 'GET', '/api/ich', { cookies })).status, 401, 'altes Cookie ist wertlos');
});

test('erfundene und überlange Tokens werden abgelehnt', async () => {
  const u = await umgebung();
  const name = cookieName(u.cfg, 'sitzung');
  for (const wert of ['', 'x', 'a'.repeat(43), 'a'.repeat(5000), "' OR 1=1 --"]) {
    assert.equal((await ruf(u, 'GET', '/api/ich', { cookies: { [name]: wert } })).status, 401);
  }
});

// ---------- Schutz vor fremder Herkunft ----------

test('schreibende Anfragen ohne oder mit fremdem Origin werden abgelehnt', async () => {
  const u = await umgebung();
  const w = alle(u);
  const cookies = sitzung(u, w.ausbilder);
  const body = { anmeldename: 'neu@firma.test', anzeigename: 'Neu', rolle: 'azubi' };
  for (const origin of [null, 'https://boese.example', 'http://portal.test', `${APP}.boese.example`, 'null']) {
    const a = await ruf(u, 'POST', '/api/konten', { cookies, body, origin });
    assert.equal(a.status, 403, String(origin));
    assert.equal(koerper(a).code, 'herkunft');
  }
  assert.equal((await ruf(u, 'POST', '/api/auth/lokal', { body: { benutzername: 'chef', passwort: START }, origin: 'https://boese.example' })).status, 403, 'auch die Anmeldung');
  assert.equal((await ruf(u, 'POST', '/api/konten', { cookies, body })).status, 201);
});

test('passt APP_URL nicht zur Adresse im Browser, nennt die Meldung beide Adressen', async () => {
  // typischer Fall: eigener Port oder eigene IP in docker-compose.override.yml, APP_URL nicht angepasst
  const u = await umgebung({ APP_URL: 'http://localhost:3000' });
  const versuch = () => ruf(u, 'POST', '/api/auth/lokal', { body: { benutzername: 'chef', passwort: START }, origin: 'http://100.64.0.10:8989' });
  const a = await versuch();
  assert.equal(a.status, 403);
  assert.match(koerper(a).fehler, /für die Adresse http:\/\/localhost:3000 eingerichtet.*über http:\/\/100\.64\.0\.10:8989.*APP_URL/);
  await versuch();
  assert.equal(u.logs.filter((l) => l.includes('APP_URL=http://100.64.0.10:8989')).length, 1, 'Hinweis steht genau einmal im Log');
  const boese = await ruf(u, 'POST', '/api/auth/lokal', { body: {}, origin: 'http://x/<script>alert(1)</script>' });
  assert.equal(koerper(boese).fehler, 'Anfrage von fremder Herkunft abgelehnt', 'unlesbare Herkunft wird nicht wiedergegeben');

  const passend = await umgebung({ APP_URL: 'http://100.64.0.10:8989' });
  assert.equal((await ruf(passend, 'POST', '/api/auth/lokal', { body: { benutzername: 'chef', passwort: START }, origin: 'http://100.64.0.10:8989' })).status, 200);
});

// ---------- Kontenverwaltung ----------

test('Super-Admin legt alle Rollen an; weitere Super-Admins bekommen ein einmaliges Startpasswort', async () => {
  const u = await umgebung();
  const w = alle(u);
  const cookies = sitzung(u, w.admin);
  const a = await ruf(u, 'POST', '/api/konten', { cookies, body: { anmeldename: ' Petra.Lang@Firma.Test ', anzeigename: 'Petra Lang', rolle: 'ausbilder' } });
  assert.equal(a.status, 201);
  assert.equal(koerper(a).konto.anmeldename, 'petra.lang@firma.test');
  assert.equal(koerper(a).konto.verknuepft, false, 'wartet auf die erste Anmeldung');
  assert.equal(koerper(a).startpasswort, undefined);
  assert.equal(JSON.stringify(a.body).includes('hash'), false);

  const zweiter = await ruf(u, 'POST', '/api/konten', { cookies, body: { anmeldename: 'vertretung', anzeigename: 'Vertretung', rolle: 'admin' } });
  assert.equal(zweiter.status, 201);
  const passwort = koerper(zweiter).startpasswort as string;
  assert.equal(passwort.length, 20);
  const an = await ruf(u, 'POST', '/api/auth/lokal', { body: { benutzername: 'vertretung', passwort } });
  assert.equal(an.status, 200);
  assert.equal(koerper(await ruf(u, 'GET', '/api/ich', { cookies: cookiesAus(an) })).konto.passwortWechsel, true);
});

test('Ausbilder legen nur Azubis und Beauftragte an', async () => {
  const u = await umgebung();
  const w = alle(u);
  const cookies = sitzung(u, w.ausbilder);
  for (const rolle of ['azubi', 'beauftragter']) {
    assert.equal((await ruf(u, 'POST', '/api/konten', { cookies, body: { anmeldename: `${rolle}.neu@firma.test`, anzeigename: 'Neu', rolle } })).status, 201);
  }
  for (const [rolle, name] of [['ausbilder', 'x@firma.test'], ['admin', 'zweiter']]) {
    assert.equal((await ruf(u, 'POST', '/api/konten', { cookies, body: { anmeldename: name, anzeigename: 'Neu', rolle } })).status, 403, rolle);
  }
});

test('Eingaben beim Anlegen werden geprüft', async () => {
  const u = await umgebung();
  const w = alle(u);
  const cookies = sitzung(u, w.admin);
  const status = async (body: unknown) => (await ruf(u, 'POST', '/api/konten', { cookies, body })).status;
  assert.equal(await status({ anmeldename: 'ohne-at', anzeigename: 'X', rolle: 'azubi' }), 400);
  assert.equal(await status({ anmeldename: 'a@b.de', anzeigename: '', rolle: 'azubi' }), 400);
  assert.equal(await status({ anmeldename: 'a@b.de', anzeigename: 'X', rolle: 'chef' }), 400);
  assert.equal(await status({ anmeldename: 'a@b.de', anzeigename: 'X'.repeat(121), rolle: 'azubi' }), 400);
  assert.equal(await status({ anmeldename: 'a@b.de', anzeigename: 'Zeilen\numbruch', rolle: 'azubi' }), 400);
  assert.equal(await status({ anmeldename: 'mit@at.de', anzeigename: 'X', rolle: 'admin' }), 400, 'lokaler Name ohne @');
  assert.equal(await status(null), 400);
  assert.equal(await status([]), 400);
  assert.equal(await status({ anmeldename: w.azubi.anmeldename.toUpperCase(), anzeigename: 'Doppelt', rolle: 'azubi' }), 409);
});

test('Kontenliste: Ausbilder sehen keinen Super-Admin; Azubis und Beauftragte sehen nichts', async () => {
  const u = await umgebung();
  const w = alle(u);
  const beimAdmin = koerper(await ruf(u, 'GET', '/api/konten', { cookies: sitzung(u, w.admin) }));
  assert.equal(beimAdmin.konten.length, 4);
  assert.equal(beimAdmin.konten.filter((k: { loeschbar: boolean }) => k.loeschbar).length, 3, 'alle außer dem eigenen Konto');
  const beimAusbilder = koerper(await ruf(u, 'GET', '/api/konten', { cookies: sitzung(u, w.ausbilder) }));
  assert.deepEqual(beimAusbilder.konten.map((k: { rolle: string }) => k.rolle).sort(), ['ausbilder', 'azubi', 'beauftragter']);
  assert.deepEqual(beimAusbilder.rollen, ['beauftragter', 'azubi']);
  assert.deepEqual(beimAusbilder.konten.filter((k: { loeschbar: boolean }) => k.loeschbar).map((k: { rolle: string }) => k.rolle).sort(), ['azubi', 'beauftragter']);
  for (const k of beimAusbilder.konten) {
    assert.deepEqual(Object.keys(k).sort(), ['alleAzubis', 'anmeldename', 'anmeldung', 'anzeigename', 'bild', 'bildZeigen', 'erstellt', 'id', 'letzteAnmeldung', 'loeschbar', 'passwortWechsel', 'rolle', 'status', 'theme', 'verknuepft', 'verwaltbar'].sort());
  }
});

test('Ausbilder ändern keine Ausbilder (403) und finden den Super-Admin nicht (404)', async () => {
  const u = await umgebung();
  const w = alle(u);
  const zweiter = konto(u.db, 'ausbilder');
  const cookies = sitzung(u, w.ausbilder);
  assert.equal((await ruf(u, 'PATCH', `/api/konten/${zweiter.id}`, { cookies, body: { status: 'gesperrt' } })).status, 403);
  assert.equal((await ruf(u, 'PATCH', `/api/konten/${w.admin.id}`, { cookies, body: { status: 'gesperrt' } })).status, 404);
  assert.equal((await ruf(u, 'PATCH', '/api/konten/99999', { cookies, body: {} })).status, 404);
  assert.equal((await ruf(u, 'PATCH', '/api/konten/1e3', { cookies, body: {} })).status, 404);
  assert.equal((await ruf(u, 'POST', `/api/konten/${zweiter.id}/entra-loesen`, { cookies })).status, 403);
  assert.equal((await ruf(u, 'PATCH', `/api/konten/${w.azubi.id}`, { cookies, body: { rolle: 'ausbilder' } })).status, 403, 'keine Beförderung zum Ausbilder');
  assert.equal((await ruf(u, 'PATCH', `/api/konten/${w.azubi.id}`, { cookies, body: { rolle: 'admin' } })).status, 400);
  assert.equal((u.db.prepare('SELECT rolle FROM benutzer WHERE id = ?').get(w.azubi.id) as { rolle: string }).rolle, 'azubi');
});

test('Sperren wirkt sofort: laufende Sitzung endet, Entsperren stellt den Zugang wieder her', async () => {
  const u = await umgebung();
  const w = alle(u);
  const beimAzubi = sitzung(u, w.azubi);
  assert.equal((await ruf(u, 'GET', '/api/ich', { cookies: beimAzubi })).status, 200);
  const cookies = sitzung(u, w.ausbilder);
  assert.equal((await ruf(u, 'PATCH', `/api/konten/${w.azubi.id}`, { cookies, body: { status: 'gesperrt' } })).status, 200);
  assert.equal((await ruf(u, 'GET', '/api/ich', { cookies: beimAzubi })).status, 401);
  assert.equal((await ruf(u, 'PATCH', `/api/konten/${w.azubi.id}`, { cookies, body: { status: 'aktiv' } })).status, 200);
  assert.equal((await ruf(u, 'GET', '/api/ich', { cookies: sitzung(u, w.azubi) })).status, 200);
});

test('niemand sperrt, löscht oder befördert sich selbst', async () => {
  const u = await umgebung();
  const w = alle(u);
  const cookies = sitzung(u, w.admin);
  assert.equal((await ruf(u, 'PATCH', `/api/konten/${w.admin.id}`, { cookies, body: { status: 'gesperrt' } })).status, 400);
  assert.equal((await ruf(u, 'DELETE', `/api/konten/${w.admin.id}`, { cookies })).status, 400);
  assert.equal((await ruf(u, 'POST', `/api/konten/${w.admin.id}/passwort-zuruecksetzen`, { cookies })).status, 400);
  assert.equal(admin(u.db).status, 'aktiv');
});

test('Rollenwechsel beendet Sitzungen und entfernt Zuweisungen der alten Rolle', async () => {
  const u = await umgebung();
  const w = alle(u);
  zuweisen(u.db, w.azubi, w.beauftragter);
  const beimBeauftragten = sitzung(u, w.beauftragter);
  const a = await ruf(u, 'PATCH', `/api/konten/${w.beauftragter.id}`, { cookies: sitzung(u, w.ausbilder), body: { rolle: 'azubi' } });
  assert.equal(a.status, 200);
  assert.equal((await ruf(u, 'GET', '/api/ich', { cookies: beimBeauftragten })).status, 401);
  assert.equal((u.db.prepare('SELECT COUNT(*) AS n FROM zuweisung').get() as { n: number }).n, 0);
});

test('Ausbilder löschen Azubis und Beauftragte, aber keine Ausbilder und keine Super-Admins', async () => {
  const u = await umgebung();
  const w = alle(u);
  const zweiter = konto(u.db, 'ausbilder');
  const cookies = sitzung(u, w.ausbilder);
  assert.equal((await ruf(u, 'DELETE', `/api/konten/${zweiter.id}`, { cookies })).status, 403);
  assert.equal((await ruf(u, 'DELETE', `/api/konten/${w.admin.id}`, { cookies })).status, 404);
  assert.equal((await ruf(u, 'DELETE', `/api/konten/${w.ausbilder.id}`, { cookies })).status, 403, 'auch nicht sich selbst');
  assert.equal((u.db.prepare('SELECT COUNT(*) AS n FROM benutzer').get() as { n: number }).n, 5);
  assert.equal((await ruf(u, 'DELETE', `/api/konten/${w.beauftragter.id}`, { cookies })).status, 200);
  assert.equal((await ruf(u, 'DELETE', `/api/konten/${w.azubi.id}`, { cookies })).status, 200);
  const eintrag = u.db.prepare("SELECT benutzer_name FROM protokoll WHERE aktion = 'konto_geloescht' ORDER BY id DESC").get() as { benutzer_name: string };
  assert.equal(eintrag.benutzer_name, w.ausbilder.anzeigename, 'wer gelöscht hat, steht im Protokoll');
  for (const wer of [konto(u.db, 'azubi'), konto(u.db, 'beauftragter')]) {
    assert.equal((await ruf(u, 'DELETE', `/api/konten/${zweiter.id}`, { cookies: sitzung(u, wer) })).status, 403, wer.rolle);
  }
});

test('Löschen: Sitzungen und Zuweisungen fallen weg, das Protokoll behält den Namen', async () => {
  const u = await umgebung();
  const w = alle(u);
  zuweisen(u.db, w.azubi, w.beauftragter);
  const beimAzubi = sitzung(u, w.azubi);
  assert.equal((await ruf(u, 'DELETE', `/api/konten/${w.azubi.id}`, { cookies: sitzung(u, w.admin) })).status, 200);
  assert.equal((await ruf(u, 'GET', '/api/ich', { cookies: beimAzubi })).status, 401);
  assert.equal((u.db.prepare('SELECT COUNT(*) AS n FROM zuweisung').get() as { n: number }).n, 0);
  const eintrag = u.db.prepare("SELECT * FROM protokoll WHERE aktion = 'konto_geloescht'").get() as { ziel_name: string; benutzer_name: string };
  assert.equal(eintrag.ziel_name, w.azubi.anzeigename);
  assert.equal(eintrag.benutzer_name, 'Super-Admin');
});

test('Anmeldename nur vor der ersten Anmeldung änderbar; Verknüpfung lösen setzt zurück', async () => {
  const u = await umgebung();
  const w = alle(u);
  const cookies = sitzung(u, w.ausbilder);
  assert.equal((await ruf(u, 'PATCH', `/api/konten/${w.azubi.id}`, { cookies, body: { anmeldename: 'anders@firma.test' } })).status, 400);
  const beimAzubi = sitzung(u, w.azubi);
  const geloest = await ruf(u, 'POST', `/api/konten/${w.azubi.id}/entra-loesen`, { cookies });
  assert.equal(koerper(geloest).konto.verknuepft, false);
  assert.equal((await ruf(u, 'GET', '/api/ich', { cookies: beimAzubi })).status, 401);
  assert.equal((await ruf(u, 'PATCH', `/api/konten/${w.azubi.id}`, { cookies, body: { anmeldename: 'anders@firma.test' } })).status, 200);
});

// ---------- Azubis und Zuweisungen ----------

test('Azubi-Liste und Zuweisungen: fremde Azubis sehen aus wie unbekannte (404)', async () => {
  const u = await umgebung();
  const w = alle(u);
  const ben = konto(u.db, 'azubi');
  const b2 = konto(u.db, 'beauftragter');
  const ausbilder = sitzung(u, w.ausbilder);

  const gesetzt = await ruf(u, 'PUT', `/api/azubis/${w.azubi.id}/zuweisungen`, {
    cookies: ausbilder,
    body: { zuweisungen: [{ beauftragterId: w.beauftragter.id, von: '2026-09-01', bis: '2026-12-31' }, { beauftragterId: b2.id, von: '2027-01-01', bis: null }] },
  });
  assert.equal(gesetzt.status, 200);

  assert.equal(koerper(await ruf(u, 'GET', '/api/azubis', { cookies: ausbilder })).azubis.length, 2);
  assert.deepEqual(koerper(await ruf(u, 'GET', '/api/azubis', { cookies: sitzung(u, w.beauftragter) })).azubis.map((a: { id: number }) => a.id), [w.azubi.id]);
  assert.deepEqual(koerper(await ruf(u, 'GET', '/api/azubis', { cookies: sitzung(u, b2) })).azubis, [], 'Zuweisung beginnt erst 2027');

  const zu = (wer: BenutzerZeile, id: number | string) => ruf(u, 'GET', `/api/azubis/${id}/zuweisungen`, { cookies: sitzung(u, wer) });
  assert.equal(koerper(await zu(w.ausbilder, w.azubi.id)).zuweisungen.length, 2);
  assert.equal(koerper(await zu(w.beauftragter, w.azubi.id)).zuweisungen.length, 1, 'Beauftragte sehen nur die eigene Zuweisung');
  assert.equal(koerper(await zu(w.azubi, w.azubi.id)).zuweisungen.length, 2);
  for (const [wer, id] of [[w.beauftragter, ben.id], [b2, w.azubi.id], [w.azubi, ben.id], [ben, w.azubi.id], [w.ausbilder, 99999], [w.ausbilder, w.beauftragter.id], [w.ausbilder, 'abc']] as const) {
    assert.equal((await zu(wer, id)).status, 404, `${wer.rolle} → ${id}`);
  }
});

test('Zuweisungen: Beauftragte und andere Ausbilder zuweisbar, Zeitraum muss stimmen, bei Fehler bleibt alles beim Alten', async () => {
  const u = await umgebung();
  const w = alle(u);
  zuweisen(u.db, w.azubi, w.beauftragter);
  const cookies = sitzung(u, w.ausbilder);
  const setze = (zuweisungen: unknown) => ruf(u, 'PUT', `/api/azubis/${w.azubi.id}/zuweisungen`, { cookies, body: { zuweisungen } });
  assert.equal((await setze([{ beauftragterId: w.ausbilder.id }])).status, 400);
  assert.equal((await setze([{ beauftragterId: w.beauftragter.id, von: '2026-12-01', bis: '2026-11-01' }])).status, 400);
  assert.equal((await setze([{ beauftragterId: w.beauftragter.id, von: '01.12.2026' }])).status, 400);
  assert.equal((await setze('alle')).status, 400);
  assert.equal((u.db.prepare('SELECT COUNT(*) AS n FROM zuweisung').get() as { n: number }).n, 1);
  assert.equal((await ruf(u, 'PUT', `/api/azubis/${w.beauftragter.id}/zuweisungen`, { cookies, body: { zuweisungen: [] } })).status, 404, 'Ziel ist kein Azubi');
});

// ---------- Ausbilder und ihre Azubis ----------

test('Ausbilder sehen nur ihre Azubis: Liste, Konten, Profil, Plan, Berichte (404 bei fremden)', async () => {
  const u = await umgebung();
  const w = alle(u);
  const a2 = konto(u.db, 'ausbilder', 'Zweite Ausbilderin');
  const ben = konto(u.db, 'azubi', 'Ben');
  zustaendig(u.db, w.azubi, w.ausbilder);
  zustaendig(u.db, ben, a2);
  const c1 = sitzung(u, w.ausbilder);
  const c2 = sitzung(u, a2);

  const liste = async (c: Record<string, string>) => koerper(await ruf(u, 'GET', '/api/azubis', { cookies: c })).azubis as { id: number; betreuung: string }[];
  assert.deepEqual((await liste(c1)).map((a) => [a.id, a.betreuung]), [[w.azubi.id, 'eigen']]);
  assert.deepEqual((await liste(c2)).map((a) => a.id), [ben.id]);

  for (const pfad of [`/api/azubis/${ben.id}/profil`, `/api/azubis/${ben.id}/plan`, `/api/azubis/${ben.id}/berichte`, `/api/azubis/${ben.id}/zuweisungen`]) {
    assert.equal((await ruf(u, 'GET', pfad, { cookies: c1 })).status, 404, pfad);
    assert.equal((await ruf(u, 'GET', pfad, { cookies: c2 })).status, 200, pfad);
  }
  assert.equal((await ruf(u, 'PUT', `/api/azubis/${ben.id}/zuweisungen`, { cookies: c1, body: { zuweisungen: [] } })).status, 404);

  const konten = koerper(await ruf(u, 'GET', '/api/konten', { cookies: c1 })).konten as { id: number }[];
  assert.equal(konten.some((k) => k.id === ben.id), false, 'fremdes Azubi-Konto fehlt in der Liste');
  assert.equal(konten.some((k) => k.id === w.azubi.id), true);
  assert.equal((await ruf(u, 'PATCH', `/api/konten/${ben.id}`, { cookies: c1, body: { status: 'gesperrt' } })).status, 404);
  assert.equal((await ruf(u, 'DELETE', `/api/konten/${ben.id}`, { cookies: c1 })).status, 404);
});

test('Wer als Ausbilder einen Azubi anlegt, ist zuständig; Azubis ohne Ausbilder lassen sich übernehmen', async () => {
  const u = await umgebung();
  const w = alle(u);
  const a2 = konto(u.db, 'ausbilder');
  const c1 = sitzung(u, w.ausbilder);
  const c2 = sitzung(u, a2);

  const neu = koerper(await ruf(u, 'POST', '/api/konten', { cookies: c1, body: { anmeldename: 'neu@firma.test', anzeigename: 'Neu', rolle: 'azubi' } })).konto.id as number;
  assert.equal(koerper(await ruf(u, 'GET', `/api/azubis/${neu}/profil`, { cookies: c1 })).ausbilder.id, w.ausbilder.id);
  assert.equal((await ruf(u, 'GET', `/api/azubis/${neu}/profil`, { cookies: c2 })).status, 404);
  assert.equal((await ruf(u, 'POST', `/api/azubis/${neu}/uebernehmen`, { cookies: c2 })).status, 404, 'einen vergebenen Azubi übernimmt man nicht einfach');

  // vom Super-Admin angelegt: ohne Ausbilder, alle sehen ihn, bis jemand übernimmt
  const frei = koerper(await ruf(u, 'POST', '/api/konten', { cookies: sitzung(u, w.admin), body: { anmeldename: 'frei@firma.test', anzeigename: 'Frei', rolle: 'azubi' } })).konto.id as number;
  for (const c of [c1, c2]) assert.equal((koerper(await ruf(u, 'GET', '/api/azubis', { cookies: c })).azubis as { id: number; betreuung: string }[]).find((a) => a.id === frei)?.betreuung, 'ohne');
  assert.equal((await ruf(u, 'POST', `/api/azubis/${frei}/uebernehmen`, { cookies: c2 })).status, 200);
  assert.equal((await ruf(u, 'GET', `/api/azubis/${frei}/profil`, { cookies: c1 })).status, 404, 'nach dem Übernehmen nur noch beim Zuständigen');
  assert.equal(koerper(await ruf(u, 'GET', `/api/azubis/${frei}/profil`, { cookies: c2 })).ausbilder.id, a2.id);
  for (const wer of [w.beauftragter, w.azubi, w.admin]) assert.equal((await ruf(u, 'POST', `/api/azubis/${frei}/uebernehmen`, { cookies: sitzung(u, wer) })).status, 403, wer.rolle);
});

test('Gesamtsicht: nur der Super-Admin schaltet sie, nur für Ausbilder; Rollenwechsel nimmt sie und die Zuständigkeit', async () => {
  const u = await umgebung();
  const w = alle(u);
  const a2 = konto(u.db, 'ausbilder');
  zustaendig(u.db, w.azubi, w.ausbilder);
  const sa = sitzung(u, w.admin);
  const c2 = sitzung(u, a2);
  const schalte = (id: number, alleAzubis: unknown, cookies = sa) => ruf(u, 'PATCH', `/api/konten/${id}`, { cookies, body: { alleAzubis } });

  assert.equal((await schalte(a2.id, true, sitzung(u, w.ausbilder))).status, 403, 'Ausbilder geben sich die Gesamtsicht nicht selbst');
  assert.equal((await schalte(w.beauftragter.id, true)).status, 400);
  assert.equal((await schalte(a2.id, 'ja')).status, 400);
  assert.equal(koerper(await ruf(u, 'GET', '/api/azubis', { cookies: c2 })).azubis.length, 0);
  const an = await schalte(a2.id, true);
  assert.equal(koerper(an).konto.alleAzubis, true);
  assert.equal(koerper(await ruf(u, 'GET', '/api/ich', { cookies: c2 })).konto.alleAzubis, true);
  assert.deepEqual(koerper(await ruf(u, 'GET', '/api/azubis', { cookies: c2 })).azubis.map((a: { betreuung: string }) => a.betreuung), ['gesamt']);
  // mit Gesamtsicht lässt sich ein Azubi auch von einem anderen Ausbilder übernehmen
  assert.equal((await ruf(u, 'POST', `/api/azubis/${w.azubi.id}/uebernehmen`, { cookies: c2 })).status, 200);
  assert.equal(koerper(await schalte(a2.id, false)).konto.alleAzubis, false);
  assert.equal((await ruf(u, 'GET', `/api/azubis/${w.azubi.id}/profil`, { cookies: sitzung(u, w.ausbilder) })).status, 404);

  // Rollenwechsel: Gesamtsicht und Zuständigkeit fallen weg, der Azubi ist wieder „ohne Ausbilder“
  await schalte(a2.id, true);
  assert.equal((await ruf(u, 'PATCH', `/api/konten/${a2.id}`, { cookies: sa, body: { rolle: 'beauftragter' } })).status, 200);
  assert.equal((u.db.prepare('SELECT alle_azubis AS n FROM benutzer WHERE id = ?').get(a2.id) as { n: number }).n, 0);
  assert.equal(koerper(await ruf(u, 'GET', `/api/azubis/${w.azubi.id}/profil`, { cookies: sitzung(u, w.ausbilder) })).ausbilder, null);
});

test('Vertretung: Ausbilder mit Zuweisung zeichnet im Zeitraum ab, verwaltet aber nicht', async () => {
  const u = await umgebung();
  const w = alle(u);
  const a2 = konto(u.db, 'ausbilder', 'Vertretung');
  zustaendig(u.db, w.azubi, w.ausbilder);
  const c1 = sitzung(u, w.ausbilder);
  const c2 = sitzung(u, a2);
  const setze = (zuweisungen: unknown, cookies = c1) => ruf(u, 'PUT', `/api/azubis/${w.azubi.id}/zuweisungen`, { cookies, body: { zuweisungen } });

  const personen = koerper(await ruf(u, 'GET', `/api/azubis/${w.azubi.id}/zuweisungen`, { cookies: c1 })).personen as { id: number }[];
  assert.deepEqual(personen.map((p) => p.id).sort(), [a2.id, w.beauftragter.id].sort(), 'der Zuständige selbst steht nicht zur Wahl');
  assert.equal((await setze([{ beauftragterId: w.ausbilder.id }])).status, 400);
  assert.equal((await setze([{ beauftragterId: a2.id, von: '2026-11-02', bis: '2026-11-29' }])).status, 200);

  const liste = koerper(await ruf(u, 'GET', '/api/azubis', { cookies: c2 })).azubis as { id: number; betreuung: string }[];
  assert.deepEqual(liste.map((a) => [a.id, a.betreuung]), [[w.azubi.id, 'vertretung']]);
  assert.equal(koerper(await ruf(u, 'GET', `/api/azubis/${w.azubi.id}/profil`, { cookies: c2 })).bearbeitbar, false);
  assert.equal(koerper(await ruf(u, 'GET', `/api/azubis/${w.azubi.id}/zuweisungen`, { cookies: c2 })).zuweisungen.length, 1);
  assert.equal(koerper(await ruf(u, 'GET', `/api/azubis/${w.azubi.id}/zuweisungen`, { cookies: c2 })).personen, undefined);
  assert.equal((await setze([], c2)).status, 404, 'die Vertretung ändert keine Zuweisungen');
  assert.equal((await ruf(u, 'POST', `/api/azubis/${w.azubi.id}/uebernehmen`, { cookies: c2 })).status, 404);
  const plan = koerper(await ruf(u, 'GET', `/api/azubis/${w.azubi.id}/plan`, { cookies: c2 }));
  assert.deepEqual(plan.rechte, { arten: ['aufgabe', 'notiz'], zuweisen: false });
  assert.deepEqual(plan.vorlagen, []);
  assert.equal(koerper(await ruf(u, 'GET', '/api/plan/sammel', { cookies: c2 })).azubis.length, 0, 'Sammelplanung nur für Azubis mit vollen Rechten');
  assert.equal((await ruf(u, 'GET', '/api/konten', { cookies: c2 }).then((a) => koerper(a).konten as { id: number }[])).some((k) => k.id === w.azubi.id), false);
});

// ---------- Protokoll ----------

test('Protokoll: nur der Super-Admin, vollständig; nie Passwörter', async () => {
  const u = await umgebung();
  const w = alle(u);
  await ruf(u, 'POST', '/api/auth/lokal', { body: { benutzername: 'chef', passwort: 'Falsches-Passwort-123' } });
  await ruf(u, 'PUT', `/api/azubis/${w.azubi.id}/zuweisungen`, { cookies: sitzung(u, w.ausbilder), body: { zuweisungen: [{ beauftragterId: w.beauftragter.id }] } });
  const neu = await ruf(u, 'POST', '/api/konten', { cookies: sitzung(u, w.admin), body: { anmeldename: 'zweiter', anzeigename: 'Zweiter', rolle: 'admin' } });

  const beimAdmin = koerper(await ruf(u, 'GET', '/api/protokoll', { cookies: sitzung(u, w.admin) })).eintraege as { aktion: string; bereich: string }[];
  assert.ok(beimAdmin.length >= 3);
  assert.ok(beimAdmin.some((e) => e.aktion === 'anmeldung_fehlgeschlagen'));
  assert.ok(beimAdmin.some((e) => e.aktion === 'zuweisung_geaendert'), 'auch fachliche Ereignisse');
  for (const wer of [w.ausbilder, w.beauftragter, w.azubi]) assert.equal((await ruf(u, 'GET', '/api/protokoll', { cookies: sitzung(u, wer) })).status, 403);

  const alles = JSON.stringify(u.db.prepare('SELECT * FROM protokoll').all());
  for (const geheim of ['Falsches-Passwort-123', START, koerper(neu).startpasswort as string]) assert.ok(!alles.includes(geheim));
});

test('Farbschema: nur bekannte Werte', async () => {
  const u = await umgebung();
  const w = alle(u);
  const cookies = sitzung(u, w.azubi);
  assert.equal((await ruf(u, 'PUT', '/api/ich/theme', { cookies, body: { theme: 'dark' } })).status, 200);
  assert.equal((await ruf(u, 'PUT', '/api/ich/theme', { cookies, body: { theme: 'pink' } })).status, 400);
  assert.equal(koerper(await ruf(u, 'GET', '/api/ich', { cookies })).konto.theme, 'dark');
});

test('Entwicklungsanmeldung gibt es nur mit DEV_ANMELDUNG und nie in Produktion', async () => {
  const aus = await umgebung();
  const azubi = konto(aus.db, 'azubi');
  assert.equal((await ruf(aus, 'POST', '/api/auth/dev', { body: { anmeldename: azubi.anmeldename } })).status, 404);
  const produktion = await umgebung({ DEV_ANMELDUNG: 'true', NODE_ENV: 'production' });
  const a2 = konto(produktion.db, 'azubi');
  assert.equal((await ruf(produktion, 'POST', '/api/auth/dev', { body: { anmeldename: a2.anmeldename } })).status, 404);
  const an = await umgebung({ DEV_ANMELDUNG: 'true' });
  const a3 = konto(an.db, 'azubi');
  assert.equal((await ruf(an, 'POST', '/api/auth/dev', { body: { anmeldename: a3.anmeldename } })).status, 200);
  assert.equal((await ruf(an, 'POST', '/api/auth/dev', { body: { anmeldename: 'chef' } })).status, 401, 'nie als Super-Admin');
});
