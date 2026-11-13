import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ANNA, HANDY, inTagen, mitFoto, montagVon, oeffne, startePortal, text } from './hilfe';
import type { Portal } from './hilfe';

/** Unterschrift ohne Zeichnen (WCAG 2.1.1, 2.5.7): nur mit der Tastatur erzeugen, speichern, einreichen */
let p: Portal;
before(async () => {
  p = await startePortal();
  await p.grunddaten();
});
after(() => p.stop());

test(
  'Unterschrift: nur mit der Tastatur aus dem Namen erzeugen, speichern – danach lässt sich ein Bericht einreichen',
  mitFoto(() => p, 'unterschrift-erzeugen', async () => {
    const s = await p.seite(ANNA, HANDY);
    await oeffne(s, p.url, '/konto');
    // nur Tastatur: Fokus auf den Knopf, Enter
    await s.locator('button:has-text("Unterschrift aus meinem Namen erzeugen")').focus();
    await s.keyboard.press('Enter');
    const bild = s.locator('.signatur-feld.gross svg[aria-label^="Erzeugte Unterschrift"]');
    await bild.waitFor();
    assert.match((await bild.getAttribute('aria-label')) ?? '', /Anna Azubi/);
    // „Doch selbst zeichnen“ bringt das Zeichenfeld zurück – und wieder erzeugen
    await s.click('button:has-text("Doch selbst zeichnen")');
    await s.locator('.unterschrift-feld').waitFor();
    await s.locator('button:has-text("Unterschrift aus meinem Namen erzeugen")').focus();
    await s.keyboard.press('Enter');
    // der Fokus steht danach schon auf „Unterschrift speichern“
    assert.equal(await s.evaluate('document.activeElement?.textContent?.trim()'), 'Unterschrift speichern');
    await s.keyboard.press('Enter');
    await s.locator('button:has-text("Neu unterschreiben")').waitFor();
    await s.locator('text=Unterschrift gespeichert.').waitFor();

    // einreichen geht jetzt
    const montag = montagVon(inTagen(-7));
    await oeffne(s, p.url, `/berichtsheft/${montag}`);
    await s.locator('main textarea').first().fill('Regale im Lager neu beschriftet');
    await s.locator('main input[type=number]').first().fill('38');
    await s.locator('main button:visible:has-text("Einreichen")').first().click();
    await s.locator('[role=alertdialog] .frage-ja').click({ timeout: 2000 }).catch(() => undefined);
    await s.waitForSelector('main h1:has-text("Woche")');
    await s.locator('main :text("eingereicht")').first().waitFor();
    assert.doesNotMatch(await text(s, 'main'), /fehlt deine Unterschrift/);
    assert.deepEqual(p.probleme, []);
  }),
);
