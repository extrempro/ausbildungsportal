import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { loadConfig } from '../config';
import { erzeugeServer } from '../http';
import { APP, umgebung } from './hilfe';

/** Der echte Webserver: Dateien, Seitenadressen der Oberfläche, Header, Cookies über HTTP. */
let server: Server;
let basis: string;
const START = 'Start-Passwort-2026!';

before(async () => {
  const dist = mkdtempSync(join(tmpdir(), 'ap-dist-'));
  mkdirSync(join(dist, 'assets'));
  writeFileSync(join(dist, 'index.html'), '<!doctype html><title>Ausbildungsportal</title>');
  writeFileSync(join(dist, 'assets', 'app-abc123.js'), 'console.log(1)');
  writeFileSync(join(dist, '..', 'geheim.txt'), 'nicht ausliefern');
  const u = await umgebung();
  server = erzeugeServer(u.k, dist);
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  basis = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => server.close());

test('Seitenadressen der Oberfläche liefern index.html ohne Cache, Dateien mit Hash lange', async () => {
  for (const pfad of ['/', '/anmelden', '/verwaltung/konten', '/index.html']) {
    const r = await fetch(basis + pfad);
    assert.equal(r.status, 200, pfad);
    assert.match(await r.text(), /Ausbildungsportal/);
    assert.equal(r.headers.get('cache-control'), 'no-store');
  }
  const js = await fetch(`${basis}/assets/app-abc123.js`);
  assert.equal(js.headers.get('content-type'), 'text/javascript; charset=utf-8');
  assert.match(js.headers.get('cache-control') ?? '', /immutable/);
  assert.equal((await fetch(`${basis}/assets/gibt-es-nicht.js`)).status, 404);
});

test('kein Zugriff auf Dateien außerhalb von dist', async () => {
  for (const pfad of ['/../geheim.txt', '/%2e%2e/geheim.txt', '/assets/../../geheim.txt', '/..%2fgeheim.txt', '/%00']) {
    const r = await fetch(basis + pfad);
    assert.ok(!(await r.text()).includes('nicht ausliefern'), pfad);
  }
});

test('Sicherheits-Header auf jeder Antwort', async () => {
  for (const pfad of ['/', '/api/health', '/api/gibt-es-nicht']) {
    const h = (await fetch(basis + pfad)).headers;
    assert.match(h.get('content-security-policy') ?? '', /default-src 'self'.*frame-ancestors 'none'/, pfad);
    assert.equal(h.get('x-content-type-options'), 'nosniff');
    assert.equal(h.get('x-frame-options'), 'DENY');
    assert.equal(h.get('referrer-policy'), 'no-referrer');
    assert.match(h.get('strict-transport-security') ?? '', /max-age=31536000/);
  }
  assert.equal((await fetch(`${basis}/api/health`)).headers.get('cache-control'), 'no-store');
});

test('Anmeldung über HTTP: Cookie wird gesetzt und beim nächsten Aufruf erkannt', async () => {
  const an = await fetch(`${basis}/api/auth/lokal`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: APP },
    body: JSON.stringify({ benutzername: 'chef', passwort: START }),
  });
  assert.equal(an.status, 200);
  const cookie = (an.headers.getSetCookie()[0] ?? '').split(';')[0];
  assert.match(cookie, /^__Host-ap_sitzung=/);
  const ich = await fetch(`${basis}/api/ich`, { headers: { cookie } });
  assert.equal(((await ich.json()) as { konto: { rolle: string } }).konto.rolle, 'admin');
  const ohne = await fetch(`${basis}/api/ich`);
  assert.equal(ohne.status, 401);
  // jede API-Antwort nennt die Version des Servers – auch Fehler; daran erkennt eine offene Seite ein Update
  for (const antwort of [an, ich, ohne]) assert.match(antwort.headers.get('x-app-version') ?? '', /^\d+\.\d+\.\d+$/);
  // angemeldet nennt jede Antwort, wann die Sitzung ohne weitere Anfrage endet (Warnung vorher, WCAG 2.2.1): nach 8 Stunden Leerlauf
  const ende = ich.headers.get('x-sitzung-ende') ?? '';
  assert.match(ende, /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
  const stunden = (Date.parse(ende) - Date.parse('2026-11-10T09:00:00Z')) / 3_600_000; // die Uhr der Tests (hilfe.ts)
  assert.ok(stunden > 7.9 && stunden <= 8.01, `Ende in ${stunden} Stunden`);
  assert.equal(ohne.headers.get('x-sitzung-ende'), null);
});

test('nur JSON, begrenzte Größe, keine Formulare', async () => {
  const post = (headers: Record<string, string>, body: string) => fetch(`${basis}/api/auth/lokal`, { method: 'POST', headers: { origin: APP, ...headers }, body });
  assert.equal((await post({ 'content-type': 'application/x-www-form-urlencoded' }, 'benutzername=chef&passwort=x')).status, 400);
  assert.equal((await post({ 'content-type': 'text/plain' }, '{"benutzername":"chef"}')).status, 400);
  assert.equal((await post({ 'content-type': 'application/json' }, '{kaputt')).status, 400);
  assert.equal((await post({ 'content-type': 'application/json' }, JSON.stringify({ x: 'a'.repeat(300_000) }))).status, 413);
  assert.equal((await fetch(`${basis}/anmelden`, { method: 'POST' })).status, 405);
});

test('Client-IP: X-Forwarded-For nur mit TRUST_PROXY, und dann der letzte Eintrag', async () => {
  // ohne TRUST_PROXY darf ein erfundener Header die Begrenzung je IP nicht aushebeln
  const u = await umgebung();
  const s = erzeugeServer(u.k, tmpdir());
  await new Promise<void>((ok) => s.listen(0, '127.0.0.1', ok));
  const adresse = `http://127.0.0.1:${(s.address() as AddressInfo).port}/api/auth/lokal`;
  let letzte = 0;
  for (let i = 0; i < 31; i++) {
    const r = await fetch(adresse, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: APP, 'x-forwarded-for': `198.51.100.${i}` },
      body: JSON.stringify({ benutzername: `niemand${i}`, passwort: 'x' }),
    });
    letzte = r.status;
  }
  s.close();
  assert.equal(letzte, 429);
});

test('ungültige Konfiguration wird beim Start abgelehnt', () => {
  assert.throws(() => loadConfig({ APP_URL: 'kein-url' }, []));
  assert.throws(() => loadConfig({ APP_URL: 'https://portal.test/unterpfad' }, []));
  assert.throws(() => loadConfig({ ENTRA_TENANT_ID: 'firma.onmicrosoft.com', ENTRA_CLIENT_ID: 'x', ENTRA_CLIENT_SECRET: 'y' }, []), /GUID/);
  assert.throws(() => loadConfig({ ENTRA_CLIENT_ID: 'x' }, []));
  assert.equal(loadConfig({ DEV_ANMELDUNG: 'true', NODE_ENV: 'production' }, []).devAnmeldung, false);
  assert.equal(loadConfig({ APP_URL: 'https://portal.test/' }, []).appUrl, 'https://portal.test');
  assert.equal(loadConfig({}, []).sicher, false);
});
