import assert from 'node:assert/strict';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import { HANDY, mitFoto, startePortal, text, ueberlauf } from './hilfe';
import type { Portal } from './hilfe';
import type { Page } from 'playwright';

/**
 * Einstieg der Teams-App (/teams/app, public/teams/einstieg.js). Teams selbst gibt es hier nicht: Die Bibliothek von Microsoft
 * wird durch eine kleine Attrappe ersetzt, die sagt, was Teams sagen würde. Die echte Anmeldung (Token von Teams, Schlüssel
 * von Microsoft) prüfen die Tests in server/test/teams-sso.test.ts.
 */
const DIST_TEAMS = join(fileURLToPath(new URL('..', import.meta.url)), 'dist', 'teams', 'teams.js');
let selbstAngelegt = false;
let p: Portal;
before(async () => {
  // ohne mitgebaute Bibliothek zeigt der Reiter nur „Im Browser öffnen“ – für diesen Test eine Datei anlegen
  if (!existsSync(DIST_TEAMS)) {
    writeFileSync(DIST_TEAMS, '/* Platzhalter für den Test */');
    selbstAngelegt = true;
  }
  p = await startePortal({
    env: { ENTRA_TENANT_ID: '11111111-2222-4333-8444-555555555555', ENTRA_CLIENT_ID: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', ENTRA_CLIENT_SECRET: 'geheim', TEAMS_APP_ID: '7a1b2c3d-0000-4000-8000-000000000001' },
  });
});
after(async () => {
  await p.stop();
  if (selbstAngelegt) rmSync(DIST_TEAMS, { force: true });
});

/** Attrappe der Bibliothek: was Teams auf die Fragen des Einstiegs antwortet */
const attrappe = (s: Page, o: { subPageId?: string; token?: string; ausserhalb?: boolean }) =>
  s.route('**/teams/teams.js', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `window.microsoftTeams = {
        app: {
          initialize: () => ${o.ausserhalb ? 'new Promise(() => {})' : 'Promise.resolve()'},
          getContext: () => Promise.resolve({ app: { appId: 'app' }, page: { subPageId: ${JSON.stringify(o.subPageId ?? '')} } }),
          notifySuccess: () => {},
        },
        authentication: { getAuthToken: () => Promise.resolve(${JSON.stringify(o.token ?? 'a.b.c')}) },
        pages: { currentApp: { isSupported: () => true, navigateTo: (z) => { window.__wohin = z; return Promise.resolve(); } } },
      };`,
    }),
  );

test(
  'Teams-App: Aufruf aus dem Aktivitätsfeed zeigt nur den Hinweis; „In der App öffnen“ wechselt mit dem Ziel in die App',
  mitFoto(() => p, 'teams-hinweis', async () => {
    const s = await p.leer(HANDY);
    await attrappe(s, { subPageId: 'hinweis:/urlaub' });
    await s.goto(`${p.url}/teams/app?ziel=hinweis:/urlaub`);
    await s.locator('#zurapp').waitFor();
    assert.match(await text(s, 'main'), /Es gibt Neues für dich/);
    assert.equal(await s.locator('a:has-text("Im Browser öffnen")').first().getAttribute('href'), `${p.url}/urlaub`);
    await s.click('#zurapp');
    assert.deepEqual(await s.evaluate('window.__wohin'), { pageId: 'portal', subPageId: '/urlaub' });
    assert.equal(await ueberlauf(s), 0);
    await s.close();
  }),
);

test(
  'Teams-App: lehnt der Server das Token ab, steht der Grund da – mit „Noch einmal versuchen“ und „Im Browser öffnen“',
  mitFoto(() => p, 'teams-fehler', async () => {
    const s = await p.leer(HANDY);
    await attrappe(s, { token: 'kein.gueltiges.token' });
    await s.goto(`${p.url}/teams/app?ziel=/berichtsheft`);
    await s.locator('#fehlertext:not(:empty)').waitFor();
    assert.match(await text(s, '#fehlertext'), /Teams konnte dich nicht anmelden/);
    assert.ok(await s.locator('#erneut').isVisible());
    assert.equal(await s.locator('#fehler a').getAttribute('href'), `${p.url}/berichtsheft`);
    await s.close();
  }),
);

test(
  'Teams-App: außerhalb von Teams geht es nach kurzer Zeit direkt ins Portal',
  mitFoto(() => p, 'teams-ausserhalb', async () => {
    const s = await p.leer(HANDY);
    await attrappe(s, { ausserhalb: true });
    await s.goto(`${p.url}/teams/app?ziel=/urlaub`);
    await s.waitForURL(`${p.url}/urlaub`, { timeout: 10_000 });
    await s.close();
  }),
);
