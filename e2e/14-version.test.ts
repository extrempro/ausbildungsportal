import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ADMIN, ANNA, HANDY, mitFoto, oeffne, startePortal } from './hilfe';
import type { Portal } from './hilfe';

/** Hinweise auf neue Versionen – auch in der App auf dem Handy, die lange im Hintergrund liegt */
let p: Portal;
before(async () => {
  p = await startePortal();
  await p.grunddaten();
});
after(() => p.stop());

test(
  'Version: Nach einem Update ohne Neuladen zeigt das Portal einmal „Das Portal wurde auf Version … aktualisiert“ mit „Was ist neu?“',
  mitFoto(() => p, 'version-neu', async () => {
    const s = await p.seite(ANNA, HANDY);
    await oeffne(s, p.url, '/');
    assert.equal(await s.locator('.meldungen :text("Das Portal wurde auf Version")').count(), 0, 'beim ersten Öffnen kein Hinweis');
    // so, als hätte dieser Browser zuletzt eine ältere Version gesehen
    await s.evaluate(`localStorage.setItem('portal-version-gesehen', '0.0.1')`);
    await oeffne(s, p.url, '/');
    await s.locator('.meldungen :text("Das Portal wurde auf Version")').waitFor();
    await s.click('.meldungen a:has-text("Was ist neu?")');
    await s.waitForURL(`${p.url}/versionen`);
    assert.equal(await s.locator('.meldungen :text("Das Portal wurde auf Version")').count(), 0);
    await oeffne(s, p.url, '/');
    assert.equal(await s.locator('.meldungen :text("Das Portal wurde auf Version")').count(), 0, 'nur einmal je Version');
    assert.deepEqual(p.probleme, []);
  }),
);

test(
  'Version: Zurück in die App (auch ohne Glocke, Super-Admin) – eine neuere Version auf dem Server wird sofort gemeldet',
  mitFoto(() => p, 'version-zurueck', async () => {
    const s = await p.seite(ADMIN.name, HANDY);
    await oeffne(s, p.url, '/verwaltung/konten');
    // der Server ist inzwischen neuer
    await s.route('**/api/health', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'X-App-Version': '99.0.0' }, body: '{"ok":true}' }));
    await s.evaluate(`document.dispatchEvent(new Event('visibilitychange'))`);
    await s.locator('text=Das Portal wurde aktualisiert (Version 99.0.0)').waitFor();
    assert.deepEqual(p.probleme, []);
  }),
);

test(
  'Version: Im Konto abgeschaltet – kein Hinweis, auch nicht bei neuer Version auf dem Server',
  mitFoto(() => p, 'version-aus', async () => {
    const s = await p.seite(ANNA, { breite: 1280, hoehe: 800 });
    await oeffne(s, p.url, '/konto');
    const haken = s.locator('label:has-text("Hinweis zeigen, wenn das Portal aktualisiert wurde") input');
    assert.equal(await haken.isChecked(), true, 'Standard: an');
    // der Haken folgt der gespeicherten Einstellung – erst nach der Antwort des Servers ist er aus
    await haken.click();
    await s.locator('text=Gespeichert.').waitFor();
    assert.equal(await haken.isChecked(), false);
    // eine ältere Version gesehen und der Server ist neuer – beides bleibt still
    await s.evaluate(`localStorage.setItem('portal-version-gesehen', '0.0.1')`);
    await oeffne(s, p.url, '/');
    await s.route('**/api/health', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'X-App-Version': '99.0.0' }, body: '{"ok":true}' }));
    await s.evaluate(`document.dispatchEvent(new Event('visibilitychange'))`);
    await s.waitForTimeout(1000);
    assert.equal(await s.locator('.meldung-zeile.update').count(), 0);
    assert.deepEqual(p.probleme, []);
  }),
);
