import assert from 'node:assert/strict';
import { createSign, generateKeyPairSync } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { erzeugeEntra, pkceChallenge } from '../entra';
import type { Entra } from '../entra';
import { admin, APP, cookiesAus, koerper, konto, ohneWechsel, ruf, sitzung, umgebung } from './hilfe';
import type { Umgebung } from './hilfe';

/**
 * Nachgebildeter OpenID-Anbieter: Discovery, JWKS und Token-Endpunkt wie bei Entra.
 * Die Fälle unten prüfen, dass openid-client so eingestellt ist, dass es Fälschungen ablehnt –
 * insbesondere, dass die Signaturprüfung eingeschaltet ist (enableNonRepudiationChecks).
 * `anbieter.naechstes` legt fest, welche Person sich anmeldet und wie das Token (ver)fälscht wird.
 */
const CLIENT = '11111111-1111-1111-1111-111111111111';
const TENANT = '22222222-2222-2222-2222-222222222222';
const SECRET = 'geheimnis-des-clients';
const REDIRECT = `${APP}/api/auth/entra/callback`;

interface Anbieter {
  server: Server;
  aussteller: string;
  schluessel: KeyObject;
  /** der zuletzt am Token-Endpunkt eingegangene Formularinhalt */
  letzteAnfrage: URLSearchParams | null;
  codes: Map<string, { nonce: string; challenge: string }>;
  naechstes: { claims: Record<string, unknown>; kopf?: Record<string, unknown>; schluessel?: KeyObject; ohneSignatur?: boolean; status?: number; /** Profilbild bei Microsoft Graph: Bilddaten, 'keins' (404) oder 'kaputt' (500) */ bild?: Buffer | 'keins' | 'kaputt' };
  /** womit zuletzt bei Graph nach dem Bild gefragt wurde */
  graphAnfrage: { authorization: string } | null;
}

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

function jwt(a: Anbieter, nonce: string): string {
  const jetzt = Math.floor(Date.now() / 1000);
  const kopf = { alg: 'RS256', typ: 'JWT', kid: 'schluessel-1', ...a.naechstes.kopf };
  const claims = { iss: a.aussteller, sub: 'paarweise-kennung', aud: CLIENT, exp: jetzt + 600, iat: jetzt, nbf: jetzt, tid: TENANT, nonce, ...a.naechstes.claims };
  const daten = `${b64(kopf)}.${b64(claims)}`;
  if (a.naechstes.ohneSignatur) return `${daten}.`;
  return `${daten}.${createSign('RSA-SHA256').update(daten).sign(a.naechstes.schluessel ?? a.schluessel).toString('base64url')}`;
}

let a: Anbieter;
const person = (oid: string, name: string) => ({ oid, preferred_username: name, name: 'Aus Entra' });

before(async () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const json = (status: number, o: unknown) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(o));
    if (url.pathname === '/v2.0/.well-known/openid-configuration') {
      return json(200, { issuer: a.aussteller, authorization_endpoint: `${a.aussteller}/authorize`, token_endpoint: `${a.aussteller}/token`, jwks_uri: `${a.aussteller}/keys` });
    }
    if (url.pathname === '/graph/v1.0/me/photos/96x96/$value') {
      a.graphAnfrage = { authorization: String(req.headers.authorization ?? '') };
      const bild = a.naechstes.bild ?? 'keins';
      if (bild === 'keins') return json(404, { error: { code: 'ImageNotFound' } });
      if (bild === 'kaputt') return json(500, {});
      return res.writeHead(200, { 'content-type': 'image/jpeg' }).end(bild);
    }
    if (url.pathname === '/v2.0/keys') return json(200, { keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'schluessel-1', use: 'sig' }] });
    if (url.pathname === '/v2.0/token' && req.method === 'POST') {
      let roh = '';
      req.on('data', (d) => (roh += d));
      req.on('end', () => {
        const f = new URLSearchParams(roh);
        a.letzteAnfrage = f;
        const v = a.codes.get(f.get('code') ?? '');
        a.codes.delete(f.get('code') ?? '');
        if (a.naechstes.status) return json(a.naechstes.status, { error: 'invalid_client', error_description: 'AADSTS7000222: The provided client secret keys are expired.\nTrace ID: x' });
        if (!v || f.get('client_secret') !== SECRET || f.get('client_id') !== CLIENT || f.get('redirect_uri') !== REDIRECT) return json(400, { error: 'invalid_grant' });
        if (pkceChallenge(f.get('code_verifier') ?? '') !== v.challenge) return json(400, { error: 'invalid_grant', error_description: 'PKCE' });
        json(200, { token_type: 'Bearer', access_token: 'zugriffstoken-wird-nicht-verwendet', expires_in: 3600, id_token: jwt(a, v.nonce) });
      });
      return;
    }
    json(404, {});
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  const port = (server.address() as AddressInfo).port;
  a = { server, aussteller: `http://127.0.0.1:${port}/v2.0`, schluessel: privateKey, letzteAnfrage: null, graphAnfrage: null, codes: new Map(), naechstes: { claims: {} } };
});

after(() => a.server.close());

function entra(profilbild = false): Entra {
  return erzeugeEntra({ aussteller: a.aussteller, clientId: CLIENT, clientSecret: SECRET, redirectUri: REDIRECT, tenantId: TENANT, profilbild, graphUrl: a.aussteller.replace('/v2.0', '/graph') });
}

/** Beginnt die Anmeldung in der App und „meldet sich beim Anbieter an“: liefert Cookie, state und einen gültigen Code. */
async function beginne(u: Umgebung): Promise<{ cookies: Record<string, string>; state: string; code: string; url: URL }> {
  const start = await ruf(u, 'GET', '/api/auth/entra/login');
  assert.equal(start.status, 302);
  const url = new URL(start.redirect!);
  const state = url.searchParams.get('state')!;
  const code = `code-${Math.random().toString(36).slice(2)}`;
  a.codes.set(code, { nonce: url.searchParams.get('nonce')!, challenge: url.searchParams.get('code_challenge')! });
  return { cookies: cookiesAus(start), state, code, url };
}

async function anmelden(u: Umgebung, claims: Record<string, unknown>, rest: Partial<Anbieter['naechstes']> = {}) {
  a.naechstes = { claims, ...rest };
  const s = await beginne(u);
  return ruf(u, 'GET', `/api/auth/entra/callback?code=${s.code}&state=${s.state}`, { cookies: s.cookies });
}

test('Weiterleitung zu Entra enthält PKCE, state, nonce und die feste Umleitungs-URI', async () => {
  const u = await umgebung({}, entra());
  const { url, cookies, state } = await beginne(u);
  assert.equal(url.origin + url.pathname, `${a.aussteller}/authorize`);
  const p = url.searchParams;
  assert.equal(p.get('client_id'), CLIENT);
  assert.equal(p.get('response_type'), 'code');
  assert.equal(p.get('redirect_uri'), REDIRECT);
  assert.equal(p.get('scope'), 'openid profile email');
  assert.equal(p.get('code_challenge_method'), 'S256');
  assert.ok((p.get('code_challenge') ?? '').length >= 43 && (p.get('nonce') ?? '').length >= 43 && state.length >= 43);
  assert.equal(p.has('client_secret'), false, 'das Geheimnis geht nie über den Browser');
  assert.equal(cookies['__Host-ap_anmeldung'], state);
});

test('erste Anmeldung verknüpft das vorab angelegte Konto mit der Objekt-ID', async () => {
  const u = await umgebung({}, entra());
  const azubi = konto(u.db, 'azubi', 'Anna Azubi');
  u.db.prepare("UPDATE benutzer SET entra_oid = NULL, anmeldename = 'anna.azubi@firma.test' WHERE id = ?").run(azubi.id);

  const r = await anmelden(u, person('OID-ANNA', 'Anna.Azubi@Firma.Test'));
  assert.equal(r.status, 302);
  assert.equal(r.redirect, '/');
  assert.equal(a.letzteAnfrage?.get('grant_type'), 'authorization_code');
  assert.ok((a.letzteAnfrage?.get('code_verifier') ?? '').length >= 43);

  const cookies = cookiesAus(r);
  assert.equal(cookies['__Host-ap_anmeldung'], '', 'Anmelde-Cookie wird gelöscht');
  const ich = koerper(await ruf(u, 'GET', '/api/ich', { cookies }));
  assert.equal(ich.konto.id, azubi.id);
  assert.equal(ich.konto.anzeigename, 'Anna Azubi', 'der Name aus der App bleibt');
  assert.equal(ich.konto.verknuepft, true);
  assert.equal((u.db.prepare('SELECT entra_oid FROM benutzer WHERE id = ?').get(azubi.id) as { entra_oid: string }).entra_oid, 'oid-anna');
  assert.equal((u.db.prepare('SELECT COUNT(*) AS n FROM anmeldevorgang').get() as { n: number }).n, 0);
});

test('nach der Verknüpfung zählt nur die Objekt-ID – ein geänderter Anmeldename wird übernommen', async () => {
  const u = await umgebung({}, entra());
  const azubi = konto(u.db, 'azubi');
  u.db.prepare("UPDATE benutzer SET entra_oid = 'oid-fest' WHERE id = ?").run(azubi.id);
  const r = await anmelden(u, person('oid-fest', 'neuer.name@firma.test'));
  assert.equal(r.redirect, '/');
  assert.equal((u.db.prepare('SELECT anmeldename FROM benutzer WHERE id = ?').get(azubi.id) as { anmeldename: string }).anmeldename, 'neuer.name@firma.test');
});

test('ein anderes Entra-Konto mit dem Anmeldenamen eines schon verknüpften Kontos kommt nicht hinein', async () => {
  const u = await umgebung({}, entra());
  const azubi = konto(u.db, 'azubi');
  const r = await anmelden(u, person('oid-eines-anderen', azubi.anmeldename));
  assert.equal(r.redirect, '/anmelden?fehler=kein_zugang');
  assert.equal(cookiesAus(r)['__Host-ap_sitzung'], undefined);
});

test('ohne Konto in der App kein Zugang – es wird nichts automatisch angelegt', async () => {
  const u = await umgebung({}, entra());
  const vorher = (u.db.prepare('SELECT COUNT(*) AS n FROM benutzer').get() as { n: number }).n;
  const r = await anmelden(u, person('oid-fremd', 'fremd@firma.test'));
  assert.equal(r.redirect, '/anmelden?fehler=kein_zugang');
  assert.equal((u.db.prepare('SELECT COUNT(*) AS n FROM benutzer').get() as { n: number }).n, vorher);
  assert.equal((u.db.prepare('SELECT COUNT(*) AS n FROM sitzung').get() as { n: number }).n, 0);
});

test('der lokale Super-Admin lässt sich nicht über Entra übernehmen', async () => {
  const u = await umgebung({}, entra());
  const r = await anmelden(u, person('oid-x', 'chef'));
  assert.equal(r.redirect, '/anmelden?fehler=kein_zugang');
});

test('gesperrtes Konto kommt auch mit gültiger Entra-Anmeldung nicht hinein', async () => {
  const u = await umgebung({}, entra());
  const azubi = konto(u.db, 'azubi');
  u.db.prepare("UPDATE benutzer SET status = 'gesperrt', entra_oid = 'oid-g' WHERE id = ?").run(azubi.id);
  assert.equal((await anmelden(u, person('oid-g', azubi.anmeldename))).redirect, '/anmelden?fehler=gesperrt');
});

test('gefälschte oder unpassende Tokens werden abgelehnt', async () => {
  const fremd = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  const jetzt = Math.floor(Date.now() / 1000);
  const faelle: [string, Record<string, unknown>, Partial<Anbieter['naechstes']>, RegExp][] = [
    ['mit fremdem Schlüssel signiert', {}, { schluessel: fremd }, /JWT signature verification failed/],
    ['ohne Signatur', {}, { ohneSignatur: true }, /JWT signature verification failed/],
    ['alg none', {}, { kopf: { alg: 'none' }, ohneSignatur: true }, /unexpected JWT "alg" header parameter/],
    ['alg HS256', {}, { kopf: { alg: 'HS256' } }, /unexpected JWT "alg" header parameter/],
    ['unbekannte Schlüssel-ID', {}, { kopf: { kid: 'anderer' } }, /no applicable keys found/],
    ['falscher Aussteller', { iss: 'https://login.microsoftonline.com/fremd/v2.0' }, {}, /unexpected JWT "iss" \(issuer\) claim value/],
    ['für eine andere Anwendung', { aud: 'andere-app' }, {}, /unexpected JWT "aud" \(audience\) claim value/],
    ['mehrere Empfänger', { aud: [CLIENT, 'andere-app'] }, {}, /additional untrusted audiences/],
    ['abgelaufen', { exp: jetzt - 3600 }, {}, /expiration is past current timestamp/],
    ['noch nicht gültig', { nbf: jetzt + 3600 }, {}, /unexpected JWT "nbf" \(not before\) claim value/],
    ['falsche Nonce', { nonce: 'falsch' }, {}, /unexpected ID Token "nonce" claim value/],
    ['fremder Mandant', { tid: '33333333-3333-3333-3333-333333333333' }, {}, /falscher Mandant/],
    ['ohne Objekt-ID', { oid: undefined }, {}, /Objekt-ID fehlt/],
    ['ohne sub', { sub: undefined }, {}, /"sub" \(subject\) claim missing/],
    ['ohne Anmeldename', { preferred_username: undefined }, {}, /Anmeldename fehlt/],
  ];
  for (const [name, claims, rest, grund] of faelle) {
    const u = await umgebung({}, entra());
    const azubi = konto(u.db, 'azubi');
    const r = await anmelden(u, { ...person('oid-ok', azubi.anmeldename), ...claims }, rest);
    assert.equal(r.redirect, '/anmelden?fehler=entra_fehler', name);
    assert.match(u.logs.join('\n'), grund, name);
    assert.equal(cookiesAus(r)['__Host-ap_sitzung'], undefined, name);
    assert.equal((u.db.prepare('SELECT COUNT(*) AS n FROM sitzung').get() as { n: number }).n, 0, name);
  }
});

test('Rückruf zählt nur im Browser, der die Anmeldung begonnen hat, und nur einmal', async () => {
  const u = await umgebung({}, entra());
  const azubi = konto(u.db, 'azubi');
  u.db.prepare("UPDATE benutzer SET entra_oid = 'oid-a' WHERE id = ?").run(azubi.id);
  a.naechstes = { claims: person('oid-a', azubi.anmeldename) };

  const s1 = await beginne(u);
  const ohneCookie = await ruf(u, 'GET', `/api/auth/entra/callback?code=${s1.code}&state=${s1.state}`);
  assert.equal(ohneCookie.redirect, '/anmelden?fehler=abgelaufen', 'ohne Cookie');

  const s2 = await beginne(u);
  const s3 = await beginne(u);
  const fremderState = await ruf(u, 'GET', `/api/auth/entra/callback?code=${s2.code}&state=${s2.state}`, { cookies: s3.cookies });
  assert.equal(fremderState.redirect, '/anmelden?fehler=abgelaufen', 'state eines anderen Browsers');

  const s4 = await beginne(u);
  const ziel = `/api/auth/entra/callback?code=${s4.code}&state=${s4.state}`;
  assert.equal((await ruf(u, 'GET', ziel, { cookies: s4.cookies })).redirect, '/');
  assert.equal((await ruf(u, 'GET', ziel, { cookies: s4.cookies })).redirect, '/anmelden?fehler=abgelaufen', 'zweiter Aufruf');
});

test('Anmeldevorgang verfällt nach 10 Minuten', async () => {
  const u = await umgebung({}, entra());
  const azubi = konto(u.db, 'azubi');
  a.naechstes = { claims: person('oid-b', azubi.anmeldename) };
  const s = await beginne(u);
  u.uhr.jetzt = new Date(u.uhr.jetzt.getTime() + 11 * 60 * 1000);
  assert.equal((await ruf(u, 'GET', `/api/auth/entra/callback?code=${s.code}&state=${s.state}`, { cookies: s.cookies })).redirect, '/anmelden?fehler=abgelaufen');
});

test('Abbruch bei Microsoft und abgelaufenes Client-Geheimnis führen zurück zur Anmeldeseite', async () => {
  const u = await umgebung({}, entra());
  const s = await beginne(u);
  const abbruch = await ruf(u, 'GET', `/api/auth/entra/callback?error=access_denied&state=${s.state}`, { cookies: s.cookies });
  assert.equal(abbruch.redirect, '/anmelden?fehler=abgebrochen');

  const r = await anmelden(u, person('oid-c', 'c@firma.test'), { status: 401 });
  assert.equal(r.redirect, '/anmelden?fehler=entra_fehler');
  const log = u.logs.join('\n');
  assert.match(log, /AADSTS7000222/, 'der Grund steht im Server-Log');
  assert.ok(!log.includes(SECRET), 'das Geheimnis nie');
});

test('ohne Entra-Konfiguration gibt es keine Microsoft-Anmeldung', async () => {
  const u = await umgebung();
  assert.deepEqual((await ruf(u, 'GET', '/api/auth/status')).body, { entra: false, dev: false });
  assert.equal((await ruf(u, 'GET', '/api/auth/entra/login')).redirect, '/anmelden?fehler=entra_aus');
  assert.equal((await ruf(u, 'GET', '/api/auth/entra/callback?code=x&state=y')).redirect, '/anmelden?fehler=entra_aus');
});

test('Aussteller aus der Discovery muss zum konfigurierten Mandanten passen', async () => {
  const falsch = erzeugeEntra({ aussteller: a.aussteller.replace('/v2.0', '/v2.0/'), clientId: CLIENT, clientSecret: SECRET, redirectUri: REDIRECT });
  await assert.rejects(falsch.anmeldeUrl({ state: 's', nonce: 'n', challenge: 'c' }));
});

// kleinstes gültiges JPEG-Gerüst bzw. PNG-Kopf – der Server prüft nur die ersten Bytes
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('bild-eins')]);
const JPEG2 = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('bild-zwei')]);

test('Profilbild: ohne ENTRA_PROFILBILD wird nichts zusätzlich verlangt und nichts geholt', async () => {
  const u = await umgebung({}, entra());
  const azubi = konto(u.db, 'azubi', 'Anna Azubi');
  a.graphAnfrage = null;
  const r = await anmelden(u, person(azubi.entra_oid!, azubi.anmeldename), { bild: JPEG });
  assert.equal(r.status, 302);
  assert.equal(a.graphAnfrage, null);
  assert.equal((u.db.prepare('SELECT COUNT(*) AS n FROM benutzer_bild').get() as { n: number }).n, 0);
  assert.equal(koerper(await ruf(u, 'GET', '/api/ich', { cookies: cookiesAus(r) })).profilbild, false);
});

test('Profilbild: bei der Anmeldung geholt, angezeigt, erneuert und entfernt; ein Fehler bei Graph stört die Anmeldung nicht', async () => {
  const u = await umgebung({ ENTRA_TENANT_ID: TENANT, ENTRA_CLIENT_ID: CLIENT, ENTRA_CLIENT_SECRET: SECRET, ENTRA_PROFILBILD: 'true' }, entra(true));
  ohneWechsel(u.db, admin(u.db).id);
  const azubi = konto(u.db, 'azubi', 'Anna Azubi');
  const ausbilder = konto(u.db, 'ausbilder', 'Petra Lang');
  const fremd = konto(u.db, 'ausbilder', 'Olaf Berg');
  const ben = konto(u.db, 'azubi', 'Ben Bauer');
  u.db.prepare("INSERT INTO azubi_profil (benutzer_id, ausbilder_id, ausbildungsbeginn, geaendert) VALUES (?, ?, '2025-08-01', '2026-01-01T00:00:00.000Z')").run(azubi.id, ausbilder.id);
  const als = (wer: typeof azubi) => sitzung(u, wer);

  // die Anmeldung verlangt jetzt zusätzlich User.Read
  assert.equal((await beginne(u)).url.searchParams.get('scope'), 'openid profile email User.Read');

  const r = await anmelden(u, person(azubi.entra_oid!, azubi.anmeldename), { bild: JPEG });
  assert.equal(r.status, 302);
  assert.equal(a.graphAnfrage?.authorization, 'Bearer zugriffstoken-wird-nicht-verwendet');
  const ich = koerper(await ruf(u, 'GET', '/api/ich', { cookies: cookiesAus(r) }));
  assert.match(ich.konto.bild, new RegExp(`^/api/benutzer/${azubi.id}/bild\\?v=[0-9a-f]{12}$`));
  assert.deepEqual([ich.konto.bildZeigen, ich.profilbild], [true, true]);
  const bild = await ruf(u, 'GET', `/api/benutzer/${azubi.id}/bild`, { cookies: cookiesAus(r) });
  assert.deepEqual([bild.status, bild.bild?.typ, bild.bild?.inhalt.equals(JPEG)], [200, 'image/jpeg', true]);

  // wer das Bild sieht: die Person selbst und wer den Azubi sehen darf – sonst niemand
  assert.equal((await ruf(u, 'GET', `/api/benutzer/${azubi.id}/bild`, { cookies: als(ausbilder) })).status, 200);
  assert.equal(koerper(await ruf(u, 'GET', '/api/azubis', { cookies: als(ausbilder) })).azubis.find((x: { id: number }) => x.id === azubi.id).bild, ich.konto.bild);
  for (const wer of [fremd, ben, admin(u.db)]) assert.equal((await ruf(u, 'GET', `/api/benutzer/${azubi.id}/bild`, { cookies: als(wer) })).status, 404, wer.anzeigename);
  assert.equal((await ruf(u, 'GET', `/api/benutzer/${azubi.id}/bild`)).status, 401);
  assert.equal((await ruf(u, 'GET', `/api/benutzer/${ausbilder.id}/bild`, { cookies: als(azubi) })).status, 404, 'Azubis sehen keine fremden Bilder');

  // Graph antwortet mit einem Fehler: Anmeldung gelingt, das alte Bild bleibt, der Grund steht im Log
  const kaputt = await anmelden(u, person(azubi.entra_oid!, azubi.anmeldename), { bild: 'kaputt' });
  assert.equal(kaputt.status, 302);
  assert.equal(koerper(await ruf(u, 'GET', '/api/ich', { cookies: cookiesAus(kaputt) })).konto.bild, ich.konto.bild);
  assert.ok(u.logs.some((l) => l === 'Profilbild nicht geladen: Microsoft Graph antwortet mit Status 500'));
  // etwas, das kein Bild ist, wird nicht gespeichert
  await anmelden(u, person(azubi.entra_oid!, azubi.anmeldename), { bild: Buffer.from('<svg onload=alert(1)>') });
  assert.ok(u.logs.some((l) => l.includes('weder JPEG noch PNG')));
  assert.equal((await ruf(u, 'GET', `/api/benutzer/${azubi.id}/bild`, { cookies: als(azubi) })).bild?.inhalt.equals(JPEG), true);

  // neues Bild in Microsoft 365: neue Adresse
  const neu = await anmelden(u, person(azubi.entra_oid!, azubi.anmeldename), { bild: JPEG2 });
  const neuerPfad = koerper(await ruf(u, 'GET', '/api/ich', { cookies: cookiesAus(neu) })).konto.bild;
  assert.notEqual(neuerPfad, ich.konto.bild);

  // abschalten löscht das Bild sofort – und die nächste Anmeldung holt es nicht wieder
  assert.equal((await ruf(u, 'PUT', '/api/ich/bild', { cookies: als(azubi), body: { zeigen: 'nein' } })).status, 400);
  assert.equal((await ruf(u, 'PUT', '/api/ich/bild', { cookies: als(azubi), body: { zeigen: false } })).status, 200);
  assert.equal((u.db.prepare('SELECT COUNT(*) AS n FROM benutzer_bild').get() as { n: number }).n, 0);
  assert.equal((await ruf(u, 'GET', `/api/benutzer/${azubi.id}/bild`, { cookies: als(ausbilder) })).status, 404);
  const aus = await anmelden(u, person(azubi.entra_oid!, azubi.anmeldename), { bild: JPEG2 });
  assert.deepEqual([koerper(await ruf(u, 'GET', '/api/ich', { cookies: cookiesAus(aus) })).konto.bild, (u.db.prepare('SELECT COUNT(*) AS n FROM benutzer_bild').get() as { n: number }).n], [null, 0]);
  // wieder einschalten: das Bild kommt mit der nächsten Anmeldung
  await ruf(u, 'PUT', '/api/ich/bild', { cookies: als(azubi), body: { zeigen: true } });
  const wieder = await anmelden(u, person(azubi.entra_oid!, azubi.anmeldename), { bild: JPEG2 });
  assert.equal(koerper(await ruf(u, 'GET', '/api/ich', { cookies: cookiesAus(wieder) })).konto.bild, neuerPfad);
  // Bild in Microsoft 365 entfernt: auch im Portal weg
  const weg = await anmelden(u, person(azubi.entra_oid!, azubi.anmeldename), { bild: 'keins' });
  assert.equal(koerper(await ruf(u, 'GET', '/api/ich', { cookies: cookiesAus(weg) })).konto.bild, null);
  // der Super-Admin meldet sich lokal an – für ihn gibt es kein Profilbild
  assert.equal((await ruf(u, 'PUT', '/api/ich/bild', { cookies: als(admin(u.db)), body: { zeigen: false } })).status, 400);
});
