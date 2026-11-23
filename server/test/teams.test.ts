import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { inflateSync } from 'node:zlib';
import { loadConfig } from '../config';
import { erzeugeServer } from '../http';
import { pngGroesse, umrissSymbol } from '../png';
import { aktivitaet, erzeugeGraph, GraphFehler, sicheresZiel, teamsFehlertext, teamsLink } from '../teams';
import { leseZip } from '../zip';
import { admin, koerper, konto, ohneWechsel, ruf, sitzung, umgebung } from './hilfe';

const APP_ID = '7a1b2c3d-0000-4000-8000-000000000001';
const ENTRA = { ENTRA_TENANT_ID: '11111111-2222-4333-8444-555555555555', ENTRA_CLIENT_ID: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', ENTRA_CLIENT_SECRET: 'geheim' };
const GRENZEN = { maxDateien: 10, maxDatei: 1024 * 1024, maxGesamt: 4 * 1024 * 1024 };

async function alsAdmin(env: Record<string, string>) {
  const u = await umgebung(env);
  const a = admin(u.db);
  ohneWechsel(u.db, a.id);
  return { u, cookies: sitzung(u, a) };
}

test('Teams-App: TEAMS_APP_ID muss eine GUID sein und braucht die Anmeldung mit Microsoft', () => {
  const basis = { APP_URL: 'https://portal.test', ADMIN_BENUTZER: 'chef', ADMIN_PASSWORT: 'Start-Passwort-2026!' };
  assert.equal(loadConfig({ ...basis, ...ENTRA, TEAMS_APP_ID: APP_ID.toUpperCase() }, []).teamsAppId, APP_ID);
  assert.throws(() => loadConfig({ ...basis, ...ENTRA, TEAMS_APP_ID: 'meine-app' }, []), /GUID/);
  assert.throws(() => loadConfig({ ...basis, TEAMS_APP_ID: APP_ID }, []), /Anmeldung mit Microsoft/);
  // der alte Workflow-Weg wird erkannt und im Log erwähnt, aber nicht mehr genutzt
  assert.equal(loadConfig({ ...basis, TEAMS_CHAT_WEBHOOK_URL: 'https://teams.test/x' }, []).teamsWebhookAlt, true);
});

test('Teams-App: das Paket enthält Manifest und Symbole; die Version steigt nur, wenn sich etwas ändert', async () => {
  const { u, cookies } = await alsAdmin(ENTRA);
  // ohne TEAMS_APP_ID: eine vorgeschlagene ID, die bleibt
  const s1 = koerper(await ruf(u, 'GET', '/api/teams', { cookies }));
  assert.equal(s1.aktiv, false);
  assert.equal(s1.ausEnv, false);
  assert.match(s1.appId, /^[0-9a-f-]{36}$/);
  assert.equal(koerper(await ruf(u, 'GET', '/api/teams', { cookies })).appId, s1.appId);
  assert.equal(s1.version, null);

  const r = await ruf(u, 'GET', '/api/teams/paket', { cookies });
  assert.equal(r.status, 200);
  assert.equal(r.datei?.typ, 'application/zip');
  assert.equal(r.datei?.dateiname, 'ausbildungsportal-teams-1.0.1.zip');
  const dateien = new Map(leseZip(r.datei!.inhalt, GRENZEN).map((d) => [d.name, d.daten]));
  assert.deepEqual([...dateien.keys()].sort(), ['color.png', 'manifest.json', 'outline.png']);
  const m = JSON.parse(dateien.get('manifest.json')!.toString('utf8'));
  assert.equal(m.id, s1.appId);
  assert.equal(m.version, '1.0.1');
  assert.equal(m.webApplicationInfo.id, ENTRA.ENTRA_CLIENT_ID);
  assert.deepEqual(m.validDomains, ['portal.test']);
  assert.equal(m.staticTabs[0].contentUrl, 'https://portal.test/teams/app?ziel={subEntityId}');
  assert.equal(m.staticTabs[0].entityId, 'portal');
  assert.ok(m.name.short.length <= 30 && m.developer.name.length <= 32 && m.description.short.length <= 80);
  assert.deepEqual(pngGroesse(dateien.get('color.png')!), { breite: 192, hoehe: 192 });
  assert.deepEqual(pngGroesse(dateien.get('outline.png')!), { breite: 32, hoehe: 32 });
  assert.ok(u.db.prepare("SELECT 1 FROM protokoll WHERE aktion = 'teams_paket'").get());

  // gleiches Paket – gleiche Version; anderer Name des Betriebs – nächste Version
  assert.equal((await ruf(u, 'GET', '/api/teams/paket', { cookies })).datei?.dateiname, 'ausbildungsportal-teams-1.0.1.zip');
  u.db.prepare("INSERT INTO einstellungen (schluessel, wert) VALUES ('betrieb_name', 'Muster GmbH')").run();
  const neu = await ruf(u, 'GET', '/api/teams/paket', { cookies });
  assert.equal(neu.datei?.dateiname, 'ausbildungsportal-teams-1.0.2.zip');
  const m2 = JSON.parse(leseZip(neu.datei!.inhalt, GRENZEN).find((d) => d.name === 'manifest.json')!.daten.toString('utf8'));
  assert.equal(m2.developer.name, 'Muster GmbH');
  assert.equal(koerper(await ruf(u, 'GET', '/api/teams', { cookies })).version, '1.0.2');

  // mit TEAMS_APP_ID gilt diese
  const mit = await alsAdmin({ ...ENTRA, TEAMS_APP_ID: APP_ID });
  const s2 = koerper(await ruf(mit.u, 'GET', '/api/teams', { cookies: mit.cookies }));
  assert.deepEqual([s2.appId, s2.ausEnv, s2.aktiv], [APP_ID, true, true]);
});

test('Teams-App: ohne Anmeldung mit Microsoft kein Paket; nur der Super-Admin', async () => {
  const { u, cookies } = await alsAdmin({});
  assert.equal(koerper(await ruf(u, 'GET', '/api/teams', { cookies })).entra, false);
  assert.equal((await ruf(u, 'GET', '/api/teams/paket', { cookies })).status, 409);
  const petra = konto(u.db, 'ausbilder', 'Petra Lang');
  assert.equal((await ruf(u, 'GET', '/api/teams/paket', { cookies: sitzung(u, petra) })).status, 403);
  assert.equal((await ruf(u, 'GET', '/api/teams/paket')).status, 401);
});

test('Teams-App: Meldung im Aktivitätsfeed – kurz, ohne Namen, mit Link auf den Reiter', () => {
  const a = aktivitaet(APP_ID, ['Dein Urlaub wurde genehmigt.'], '/urlaub');
  assert.equal(a.previewText.content, 'Dein Urlaub wurde genehmigt.');
  assert.equal(a.templateParameters[0].value, 'Dein Urlaub wurde genehmigt.');
  // aus dem Aktivitätsfeed mit Vorsatz „hinweis:“ – der Reiter zeigt dort nur einen Hinweis
  assert.equal(new URL(a.topic.webUrl).searchParams.get('context'), '{"subEntityId":"hinweis:/urlaub"}');
  const mehr = aktivitaet(APP_ID, ['Eins.', 'Zwei.', 'x'.repeat(300)], '/');
  assert.equal(mehr.previewText.content, '3 Neuigkeiten im Ausbildungsportal');
  assert.ok(mehr.templateParameters[0].value.length <= 200);
  // nur eigene Pfade als Ziel
  for (const boese of ['https://boese.test', '//boese.test', '/\\boese', '/a b', 'javascript:alert(1)', '/../x', null]) assert.equal(sicheresZiel(boese), '/', String(boese));
  assert.equal(sicheresZiel('/meine-meldungen'), '/meine-meldungen');
  assert.ok(!teamsLink(APP_ID, 'https://boese.test').includes('boese'));
});

test('Teams-App: das Umriss-Symbol ist ein gültiges PNG, weiß auf durchsichtig', () => {
  const b = umrissSymbol(32);
  assert.deepEqual(pngGroesse(b), { breite: 32, hoehe: 32 });
  // IDAT entpacken und Pixel zählen: nur Weiß, teils durchsichtig, teils gedeckt
  const idat = b.subarray(b.indexOf('IDAT') + 4, b.indexOf('IEND') - 8);
  const roh = inflateSync(idat);
  let gedeckt = 0;
  let leer = 0;
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const o = y * 129 + 1 + x * 4;
      assert.deepEqual([roh[o], roh[o + 1], roh[o + 2]], [255, 255, 255]);
      if (roh[o + 3] === 255) gedeckt++;
      if (roh[o + 3] === 0) leer++;
    }
  assert.ok(gedeckt > 100 && leer > 300, `gedeckt ${gedeckt}, leer ${leer}`);
});

test('Teams-App: eingebettet nur in Teams – mit Teams-App das Portal, sonst nur der Reiter; der Reiter ohne Daten', async () => {
  const dist = mkdtempSync(join(tmpdir(), 'ap-dist-'));
  writeFileSync(join(dist, 'index.html'), '<!doctype html><title>Ausbildungsportal</title>');
  const starte = async (env: Record<string, string>) => {
    const u = await umgebung(env);
    const server = erzeugeServer(u.k, dist);
    await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
    return { server, basis: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
  };
  const ohne = await starte(ENTRA);
  const mit = await starte({ ...ENTRA, TEAMS_APP_ID: APP_ID });
  try {
    // ohne Teams-App: das Portal ist nirgends einbettbar, der Reiter nur in Teams und ohne Skript
    const r = await fetch(`${ohne.basis}/teams/app?ziel=hinweis:/urlaub`);
    assert.equal(r.status, 200);
    const csp = r.headers.get('content-security-policy') ?? '';
    assert.match(csp, /frame-ancestors https:\/\/teams\.microsoft\.com/);
    assert.match(csp, /default-src 'none'/);
    assert.ok(!csp.includes('script-src'), 'kein Skript erlaubt');
    assert.equal(r.headers.get('x-frame-options'), null);
    const html = await r.text();
    assert.match(html, /href="https:\/\/portal\.test\/urlaub" target="_blank" rel="noopener"/);
    assert.match(html, /Es gibt Neues für dich/);
    assert.ok(!html.includes('<script'));
    const boese = await (await fetch(`${ohne.basis}/teams/app?ziel=${encodeURIComponent('"><script>alert(1)</script>')}`)).text();
    assert.ok(!boese.includes('alert'));
    assert.match(boese, /href="https:\/\/portal\.test\/"/);
    const sonst = await fetch(`${ohne.basis}/verwaltung/konten`);
    assert.match(sonst.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
    assert.equal(sonst.headers.get('x-frame-options'), 'DENY');

    // mit Teams-App: das Portal läuft eingebettet in Teams – aber nur dort
    const portal = await fetch(`${mit.basis}/verwaltung/konten`);
    const csp2 = portal.headers.get('content-security-policy') ?? '';
    assert.match(csp2, /frame-ancestors https:\/\/teams\.microsoft\.com https:\/\/\*\.teams\.microsoft\.com/);
    assert.ok(!csp2.includes("frame-ancestors 'none'") && !/frame-ancestors[^;]*\*(;|$| )/.test(csp2.replace(/https:\/\/\*\./g, '')));
    assert.equal(portal.headers.get('x-frame-options'), null);
    // ohne mitgebaute Bibliothek von Microsoft bleibt der Reiter ohne Skript …
    assert.ok(!(await (await fetch(`${mit.basis}/teams/app`)).text()).includes('<script'));
    // … mit ihr meldet er über Teams an
    mkdirSync(join(dist, 'teams'), { recursive: true });
    writeFileSync(join(dist, 'teams', 'teams.js'), '/* Bibliothek */');
    const sso = await fetch(`${mit.basis}/teams/app?ziel=/urlaub`);
    assert.match(await sso.text(), /<script src="\/teams\/einstieg\.js">/);
    assert.match(sso.headers.get('content-security-policy') ?? '', /script-src 'self'/);
  } finally {
    ohne.server.close();
    mit.server.close();
  }
});

test('Teams-App: Graph als App – Token wird wiederverwendet, Fehler nennen weder Token noch Geheimnis', async () => {
  const echt = globalThis.fetch;
  const anfragen: { url: string; init: RequestInit }[] = [];
  let antwort = 202;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    anfragen.push({ url: String(url), init });
    if (String(url).includes('/oauth2/v2.0/token')) return new Response(JSON.stringify({ access_token: 'tok-123', expires_in: 3600 }), { status: 200 });
    return new Response(antwort === 202 ? null : JSON.stringify({ error: { code: 'Forbidden' } }), { status: antwort });
  }) as typeof fetch;
  try {
    const graph = erzeugeGraph({ tenantId: ENTRA.ENTRA_TENANT_ID, clientId: ENTRA.ENTRA_CLIENT_ID, clientSecret: 'sehr-geheim' });
    await graph('/users/x/teamwork/sendActivityNotification', { a: 1 });
    await graph('/users/y/teamwork/sendActivityNotification', { a: 2 });
    assert.equal(anfragen.filter((a) => a.url.includes('/token')).length, 1, 'ein Token für beide Meldungen');
    const token = String(anfragen[0].init.body);
    assert.match(token, /grant_type=client_credentials/);
    assert.match(token, /scope=https%3A%2F%2Fgraph\.microsoft\.com%2F\.default/);
    assert.equal((anfragen[1].init.headers as Record<string, string>).Authorization, 'Bearer tok-123');
    assert.equal(anfragen[1].url, 'https://graph.microsoft.com/v1.0/users/x/teamwork/sendActivityNotification');
    antwort = 403;
    const e = await graph('/users/z/teamwork/sendActivityNotification', {}).catch((x: unknown) => x);
    assert.ok(e instanceof GraphFehler);
    assert.equal(e.status, 403);
    const text = teamsFehlertext(e);
    assert.match(text, /TeamsActivity\.Send/);
    assert.ok(!text.includes('tok-123') && !text.includes('sehr-geheim') && !String((e as Error).message).includes('tok-123'));
  } finally {
    globalThis.fetch = echt;
  }
});
