import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ANNA, HANDY, mitFoto, oeffne, startePortal, ueberlauf } from './hilfe';
import type { Portal } from './hilfe';
import type { Page } from 'playwright';

let p: Portal;
before(async () => {
  p = await startePortal();
  await p.grunddaten();
});
after(() => p.stop());

const breiteMain = (s: Page) => s.evaluate('Math.round(document.querySelector("main").getBoundingClientRect().width)') as Promise<number>;
const kopfzeile = (s: Page) => s.locator('.leiste').first().isVisible();

test(
  'Ansicht: volle Breite wird gemerkt, die Navigation lässt sich einklappen, der Lesemodus blendet Menü und Inhaltsverzeichnis aus',
  mitFoto(() => p, 'ansicht', async () => {
    const anna = await p.seite(ANNA, { breite: 1600, hoehe: 900 });
    await oeffne(anna, p.url, '/lernen/grundlagen');
    const normal = await breiteMain(anna);
    assert.ok(normal < 1400, `normal schmaler als das Fenster (${normal})`);

    // über das Menü am Namen
    await anna.click('button[aria-label^="Menü für"]');
    await anna.click('#menue-ich button:has-text("Volle Breite")');
    assert.equal(await breiteMain(anna), 1600);
    assert.equal(await ueberlauf(anna), 0);
    // gemerkt, auch auf anderen Seiten
    await oeffne(anna, p.url, '/');
    assert.equal(await breiteMain(anna), 1600);
    // zurück über den Knopf an der Überschrift
    await oeffne(anna, p.url, '/lernen/grundlagen');
    await anna.click('.ansicht-knoepfe button:has-text("Normale Breite")');
    assert.equal(await breiteMain(anna), normal);

    // Lesemodus im Handbuch: Leiste weg, Escape holt sie zurück
    await oeffne(anna, p.url, '/handbuch');
    await anna.click('.ansicht-knoepfe button:has-text("Lesemodus")');
    await anna.locator('.lesemodus-ende').waitFor();
    assert.equal(await kopfzeile(anna), false);
    assert.equal(await anna.locator('.handbuch-inhalt').first().isVisible(), false);
    await anna.keyboard.press('Escape');
    await anna.locator('.lesemodus-ende').waitFor({ state: 'detached' });
    assert.equal(await kopfzeile(anna), true);

    // Navigation links einklappen: schmale Leiste mit Nummern, gemerkt, wieder ausklappen
    await oeffne(anna, p.url, '/lernen/grundlagen');
    const textbreite = () => anna.evaluate('Math.round(document.querySelector(".lern-haupt").getBoundingClientRect().width)') as Promise<number>;
    const vorher = await textbreite();
    await anna.click('button[aria-label="Themenfelder einklappen"]');
    assert.equal(await anna.locator('.lern-navi-nr').count(), 2);
    assert.ok((await textbreite()) > vorher + 150, 'der Text bekommt den Platz');
    await anna.click('.lern-navi-nr >> nth=1');
    await anna.waitForURL(/\/lernen\/praxis$/);
    assert.equal(await anna.locator('.lern-navi.schmal').count(), 1, 'bleibt eingeklappt');
    await oeffne(anna, p.url, '/handbuch');
    await anna.click('button[aria-label="Im Handbuch suchen"]');
    await anna.locator('.handbuch-suche input:focus').waitFor();
    await anna.click('button[aria-label="Inhalt einklappen"]');
    await anna.click('button[aria-label="Inhalt ausklappen"]');
    await anna.locator('nav.handbuch-inhalt .handbuch-suche').waitFor();

    // Am Handy: kein Knopf für die Breite, Lesemodus ohne Überlauf, endet beim Seitenwechsel
    const handy = await p.seite(ANNA, { breite: HANDY.breite, hoehe: HANDY.hoehe, dunkel: true });
    await oeffne(handy, p.url, '/lernen/grundlagen');
    assert.equal(await handy.locator('.ansicht-knoepfe button:has-text("Breite")').count(), 0);
    await handy.click('.ansicht-knoepfe button:has-text("Lesemodus")');
    await handy.locator('.lesemodus-ende').waitFor();
    assert.equal(await handy.locator('.tabs').first().isVisible(), false);
    assert.equal(await ueberlauf(handy), 0);
    assert.equal(await handy.locator('.navi-knopf:visible').count(), 0, 'am Handy gibt es kein Einklappen');
    await handy.click('.lesemodus-ende');
    assert.equal(await handy.locator('.tabs').first().isVisible(), true);

    await handy.click('.ansicht-knoepfe button:has-text("Lesemodus")');
    await handy.click('main a:has-text("Alle Themenfelder")');
    await handy.waitForURL(/\/lernen$/);
    assert.equal(await handy.locator('.lesemodus-ende').count(), 0, 'Lesemodus endet außerhalb der Leseseiten');

    // eingeklappt gemerkt: am Handy bleibt es bei der Zeile „Inhalt“
    await handy.evaluate('localStorage.setItem("ansicht-navi-zu", "1")');
    await oeffne(handy, p.url, '/lernen/grundlagen');
    assert.equal(await handy.locator('.lern-navi:visible').count(), 0);
    assert.equal(await handy.locator('.lern-navi-klapp:visible').count(), 1);
    assert.equal(await ueberlauf(handy), 0);

    assert.deepEqual(p.probleme, []);
  }),
);
