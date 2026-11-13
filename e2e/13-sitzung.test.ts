import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ANNA, inTagen, mitFoto, montagVon, oeffne, startePortal, text } from './hilfe';
import type { Portal } from './hilfe';
import type { Page } from 'playwright';

/** WCAG 2.2.1 Zeitbegrenzung: Warnung vor dem Abmelden, nichts geht verloren (src/sitzung.tsx) */
let p: Portal;
before(async () => {
  p = await startePortal();
  await p.grunddaten();
});
after(() => p.stop());

/** Lässt den Server sagen, die Sitzung ende in `ms` – so muss niemand acht Stunden warten. */
const endeIn = (s: Page, ms: number, fest = false) =>
  s.route('**/api/**', async (route) => {
    const antwort = await route.fetch();
    const ende = new Date(Date.parse(antwort.headers().date ?? new Date().toUTCString()) + ms).toISOString();
    await route.fulfill({ response: antwort, headers: { ...antwort.headers(), 'x-sitzung-ende': fest ? `${ende};fest` : ende } });
  });

test(
  'Sitzung: Fünf Minuten vor dem Abmelden warnt ein Fenster; „Angemeldet bleiben“ verlängert',
  mitFoto(() => p, 'sitzung-warnung', async () => {
    const s = await p.seite(ANNA, { breite: 1280, hoehe: 800 });
    await oeffne(s, p.url, '/');
    assert.equal(await s.locator('#sitzung-kopf').count(), 0, 'ohne Grund keine Warnung');
    await endeIn(s, 4 * 60 * 1000);
    await oeffne(s, p.url, '/berichtsheft');
    await s.locator('[role=alertdialog] #sitzung-kopf').waitFor();
    assert.match(await text(s, '[role=alertdialog]'), /seit fast acht Stunden.*noch [34]:\d\d Minuten/);
    assert.equal(await s.evaluate(`document.activeElement.textContent`), 'Angemeldet bleiben', 'der Fokus steht auf dem Knopf');
    // ab jetzt wieder die echte Antwort des Servers: acht Stunden ab jetzt
    await s.unrouteAll();
    await s.click('[role=alertdialog] button:has-text("Angemeldet bleiben")');
    await s.locator('#sitzung-kopf').waitFor({ state: 'detached' });
    await s.locator('text=Du bleibst angemeldet.').waitFor();

    // feste Grenze nach 24 Stunden: verlängern geht nicht, nur speichern und neu anmelden
    await endeIn(s, 3 * 60 * 1000, true);
    await oeffne(s, p.url, '/urlaub');
    await s.locator('#sitzung-kopf').waitFor();
    assert.match(await text(s, '[role=alertdialog]'), /nach 24 Stunden/);
    assert.equal(await s.locator('[role=alertdialog] button:has-text("Angemeldet bleiben")').count(), 0);
    await s.click('[role=alertdialog] button:has-text("Verstanden")');
    await s.locator('#sitzung-kopf').waitFor({ state: 'detached' });
    assert.deepEqual(p.probleme, []);
  }),
);

test(
  'Sitzung: Abgemeldet mit ungespeicherten Eingaben – die Seite bleibt stehen, nach neuer Anmeldung im zweiten Tab wird gespeichert',
  mitFoto(() => p, 'sitzung-abgemeldet', async () => {
    const s = await p.seite(ANNA, { breite: 1280, hoehe: 800 });
    const montag = montagVon(inTagen(-7));
    await oeffne(s, p.url, `/berichtsheft/${montag}`);
    const feld = s.locator('main textarea').first();
    await feld.fill('Regale im Lager neu beschriftet');
    // die Anmeldung läuft ab (hier: Cookie weg), dann wird gespeichert
    await s.context().clearCookies();
    await s.click('main button.knopf:has-text("Als Entwurf speichern")');
    await s.locator('#abgemeldet-kopf').waitFor();
    assert.equal(await feld.inputValue(), 'Regale im Lager neu beschriftet', 'die Eingabe ist noch da');
    // noch nicht angemeldet
    await s.click('button:has-text("Ich bin wieder angemeldet")');
    await s.locator('#abgemeldet-kopf ~ * [role=alert], [role=alertdialog] [role=alert]').first().waitFor();
    // im zweiten Tab anmelden (gleicher Browser, gleiche Cookies)
    const tab = await s.context().newPage();
    await tab.goto(`${p.url}/`);
    await tab.click('summary:has-text("Entwicklung")');
    await tab.fill('details:has-text("Entwicklung") input', ANNA);
    await tab.click('button:has-text("Ohne Microsoft anmelden")');
    await tab.waitForSelector('main h1');
    await tab.close();
    await s.click('button:has-text("Ich bin wieder angemeldet")');
    await s.locator('#abgemeldet-kopf').waitFor({ state: 'detached' });
    await s.click('main button.knopf:has-text("Als Entwurf speichern")');
    await oeffne(s, p.url, `/berichtsheft/${montag}`);
    assert.equal(await s.locator('main textarea').first().inputValue(), 'Regale im Lager neu beschriftet', 'gespeichert');
  }),
);
