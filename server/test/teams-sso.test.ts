import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { test } from 'node:test';
import { TEAMS_CLIENTS, teamsRessource } from '../teams-sso';
import { teamsReiter } from '../teams';
import { cookiesAus, koerper, konto, ruf, umgebung } from './hilfe';
import type { Umgebung } from './hilfe';

const TID = '11111111-2222-4333-8444-555555555555';
const CLIENT = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const APP_ID = '7a1b2c3d-0000-4000-8000-000000000001';
const ENV = { ENTRA_TENANT_ID: TID, ENTRA_CLIENT_ID: CLIENT, ENTRA_CLIENT_SECRET: 'geheim', TEAMS_APP_ID: APP_ID };
const TEAMS_DESKTOP = Object.keys(TEAMS_CLIENTS)[0];

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const fremd = generateKeyPairSync('rsa', { modulusLength: 2048 });

/** Ein Token wie von Teams – mit Abweichungen für die Fehlerfälle */
function token(inhalt: Record<string, unknown> = {}, o: { kid?: string; alg?: string; schluessel?: KeyObject } = {}): string {
  const jetzt = Math.floor(new Date('2026-11-10T09:00:00Z').getTime() / 1000);
  const kopf = Buffer.from(JSON.stringify({ alg: o.alg ?? 'RS256', kid: o.kid ?? 'k1', typ: 'JWT' })).toString('base64url');
  const daten = Buffer.from(
    JSON.stringify({
      iss: `https://sts.windows.net/${TID}/`,
      aud: teamsRessource('https://portal.test', CLIENT),
      tid: TID,
      exp: jetzt + 3600,
      nbf: jetzt - 60,
      scp: 'access_as_user',
      appid: TEAMS_DESKTOP,
      oid: 'oid-anna-teams',
      upn: 'anna.teams@firma.test',
      ...inhalt,
    }),
  ).toString('base64url');
  const sig = sign('RSA-SHA256', Buffer.from(`${kopf}.${daten}`), o.schluessel ?? privateKey).toString('base64url');
  return `${kopf}.${daten}.${sig}`;
}

async function welt(env: Record<string, string> = ENV): Promise<Umgebung> {
  const u = await umgebung(env);
  u.k.teamsSchluessel = async (kid) => (kid === 'k1' ? publicKey : null);
  return u;
}
const melde = (u: Umgebung, t: string | null) => ruf(u, 'POST', '/api/auth/teams', { headers: t === null ? {} : { authorization: `Bearer ${t}` } });

test('Teams-Anmeldung: gültiges Token → Sitzung mit dem Cookie für Teams (SameSite=None, partitioniert)', async () => {
  const u = await welt();
  const anna = konto(u.db, 'azubi', 'Anna Azubi');
  u.db.prepare("UPDATE benutzer SET entra_oid = NULL, anmeldename = 'anna.teams@firma.test' WHERE id = ?").run(anna.id);
  const r = await melde(u, token());
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const roh = (r.cookies ?? []).find((c) => c.startsWith('__Host-ap_teams='))!;
  assert.match(roh, /HttpOnly; SameSite=None; Partitioned; Max-Age=\d+; Secure/);
  assert.ok(!(r.cookies ?? []).some((c) => c.startsWith('__Host-ap_sitzung=')), 'kein Cookie für den Browser');
  // erste Anmeldung: über den Anmeldenamen gefunden und fest an die Objekt-ID gebunden
  assert.equal((u.db.prepare('SELECT entra_oid FROM benutzer WHERE id = ?').get(anna.id) as { entra_oid: string }).entra_oid, 'oid-anna-teams');
  // das Cookie für Teams trägt die Sitzung
  const ich = await ruf(u, 'GET', '/api/ich', { cookies: cookiesAus(r) });
  assert.equal(ich.status, 200);
  assert.equal(koerper(ich).konto.id, anna.id);
  // unter „Angemeldete Geräte“ als Teams erkennbar, im Protokoll als Anmeldung über Teams
  assert.match((u.db.prepare('SELECT geraet FROM sitzung WHERE benutzer_id = ?').get(anna.id) as { geraet: string }).geraet, /^Teams/);
  assert.ok(u.db.prepare("SELECT 1 FROM protokoll WHERE aktion = 'anmeldung' AND detail = 'Teams'").get());
  // Abmelden löscht beide Cookies
  const ab = await ruf(u, 'POST', '/api/auth/abmelden', { cookies: cookiesAus(r) });
  assert.deepEqual(Object.values(cookiesAus(ab)), ['', '']);
  assert.equal((await ruf(u, 'GET', '/api/ich', { cookies: cookiesAus(r) })).status, 401);
});

test('Teams-Anmeldung: falsche oder fremde Tokens werden abgelehnt – mit Grund im Log', async () => {
  const u = await welt();
  const anna = konto(u.db, 'azubi', 'Anna Azubi');
  u.db.prepare("UPDATE benutzer SET entra_oid = 'oid-anna-teams' WHERE id = ?").run(anna.id);
  assert.equal((await melde(u, token())).status, 200);
  const faelle: [string, string, RegExp][] = [
    ['kein Token', '', /Kein Token/],
    ['Unsinn', 'a.b.c', /.*/],
    ['fremde Signatur', token({}, { schluessel: fremd.privateKey }), /Signatur/],
    ['unbekannter Schlüssel', token({}, { kid: 'k9' }), /unbekannter Schlüssel/],
    ['anderes Verfahren', token({}, { alg: 'HS256' }), /Verfahren/],
    ['anderer Mandant', token({ tid: '99999999-2222-4333-8444-555555555555' }), /anderen Microsoft-Mandanten/],
    ['anderer Aussteller', token({ iss: 'https://boese.test/' }), /anderen Microsoft-Mandanten/],
    ['andere App', token({ aud: 'api://boese.test/xyz' }), /andere App/],
    ['abgelaufen', token({ exp: 1_000_000 }), /abgelaufen/],
    ['ohne Bereich', token({ scp: 'User.Read' }), /access_as_user/],
    ['fremder Client', token({ appid: '00000000-0000-4000-8000-000000000000' }), /nicht von Teams/],
    ['ohne Objekt-ID', token({ oid: '' }), /Objekt-ID/],
  ];
  for (const [was, t, grund] of faelle) {
    const r = await melde(u, t === '' ? null : t);
    assert.ok(r.status === 400 || r.status === 401, `${was}: ${r.status}`);
    if (r.status === 401) assert.ok(u.logs.some((l) => grund.test(l)), `${was}: Grund im Log`);
    assert.equal(r.cookies, undefined, `${was}: kein Cookie`);
  }
  // kein Konto, gesperrtes Konto
  assert.equal((await melde(u, token({ oid: 'oid-niemand', upn: 'niemand@firma.test' }))).status, 403);
  u.db.prepare("UPDATE benutzer SET status = 'gesperrt' WHERE id = ?").run(anna.id);
  const gesperrt = await melde(u, token());
  assert.equal(gesperrt.status, 403);
  assert.match(koerper(gesperrt).fehler, /gesperrt/);
  // ohne Teams-App gibt es die Anmeldung nicht
  const ohne = await welt({ ENTRA_TENANT_ID: TID, ENTRA_CLIENT_ID: CLIENT, ENTRA_CLIENT_SECRET: 'geheim' });
  assert.equal((await melde(ohne, token())).status, 404);
});

test('Teams-Anmeldung: der Reiter lädt die Anmeldung nur, wenn sie möglich ist; sonst ohne Skript', async () => {
  const mit = await welt();
  const sso = teamsReiter(mit.k, 'hinweis:/urlaub', true);
  assert.match(sso.csp, /script-src 'self'; connect-src 'self' https:\/\/res\.cdn\.office\.net/);
  assert.match(sso.html, /<script src="\/teams\/teams\.js"><\/script>\s*<script src="\/teams\/einstieg\.js">/);
  assert.match(sso.html, /href="https:\/\/portal\.test\/urlaub"/, 'Vorsatz „hinweis:“ wird abgetrennt');
  assert.ok(!sso.html.includes('Anna'));
  const abgemeldet = teamsReiter(mit.k, '/', true, true);
  assert.match(abgemeldet.html, /Du hast dich abgemeldet\./);
  assert.match(abgemeldet.html, /Wieder anmelden/);
  const ohneSso = teamsReiter(mit.k, '/urlaub', false);
  assert.ok(!ohneSso.html.includes('<script') && !ohneSso.csp.includes('script-src'));
});
