import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ANNA, HANDY, inTagen, mitFoto, montagVon, oeffne, PETRA, startePortal } from './hilfe';
import type { Grunddaten, Portal } from './hilfe';

/**
 * Was Safari (iPhone und Mac) anders macht als Chromium – hier nachgestellt:
 * - Ein angeklickter Knopf bekommt keinen Fokus; den bekommt das nächste fokussierbare Element darüber (<main tabindex="-1">).
 * - In Feldern mit type="number" nimmt Safari kein Komma an.
 */
let p: Portal;
let g: Grunddaten;
const montag = montagVon(inTagen(-7));
before(async () => {
  p = await startePortal();
  g = await p.grunddaten();
  const petra = p.api();
  await petra.als(PETRA);
  const profil = (await petra.ruf('GET', `/api/azubis/${g.anna}/profil`)) as { profil: Record<string, unknown> };
  await petra.ruf('PUT', `/api/azubis/${g.anna}/profil`, { ...profil.profil, berichtForm: 'tag' });
});
after(() => p.stop());

test(
  'Bericht in Tagesform: Fokus auf dem Seiteninhalt rollt nicht an den Anfang; Stunden nehmen Komma und Punkt',
  mitFoto(() => p, 'safari', async () => {
    const s = await p.seite(ANNA, HANDY);
    await oeffne(s, p.url, `/berichtsheft/${montag}`);
    const knopf = s.locator('button:has-text("Tätigkeit im Betrieb eintragen")').nth(2);
    await knopf.scrollIntoViewIfNeeded();
    await s.locator('.bericht-stunden input').first().focus();
    await knopf.scrollIntoViewIfNeeded();
    const vorher = await s.evaluate(() => scrollY);
    assert.ok(vorher > 300, 'die Seite ist weiter unten');
    // wie in Safari: Der Klick fokussiert nicht den Knopf, sondern <main>
    await s.evaluate(() => document.getElementById('inhalt')!.focus({ preventScroll: true }));
    await knopf.dispatchEvent('click');
    await s.waitForTimeout(300);
    assert.equal(await s.evaluate(() => document.activeElement?.id), 'inhalt');
    assert.ok(Math.abs((await s.evaluate(() => scrollY)) - vorher) < 50, 'die Seite bleibt, wo sie war');

    // Stunden: Komma, Punkt, Pfeiltasten; Buchstaben gehen nicht hinein
    const feld = s.getByLabel('Stunden, Mittwoch, Zeile 1');
    await feld.fill('');
    await feld.pressSequentially('1,5');
    assert.equal(await feld.inputValue(), '1,5');
    await feld.press('ArrowUp');
    assert.equal(await feld.inputValue(), '1,75');
    await feld.fill('2.25');
    await feld.pressSequentially('x');
    assert.equal(await feld.inputValue(), '2.25', 'kein Buchstabe');
    await feld.blur();
    assert.equal(await feld.inputValue(), '2,25', 'nach dem Verlassen mit Komma');
    await s.locator('button:has-text("Tätigkeit im Betrieb eintragen")').nth(3).click();
    await s.getByLabel('Stunden, Donnerstag, Zeile 1').fill('7,6');
    await s.getByLabel('Stunden, Donnerstag, Zeile 1').blur();
    assert.equal(await s.getByLabel('Stunden, Donnerstag, Zeile 1').inputValue(), '7,5', 'auf Viertelstunden gerundet');

    // gespeichert wird die Zahl
    for (const feldText of await s.locator('.bericht-text textarea').all()) await feldText.fill('Netzwerkkabel verlegt');
    await s.locator('button[aria-label="Als Entwurf speichern"]:visible').first().click();
    await s.waitForSelector('text=Alles gespeichert');
    const api = p.api();
    await api.als(ANNA);
    const b = (await api.ruf('GET', `/api/azubis/${g.anna}/berichte/${montag}`)) as { inhalt: { betrieb: { stunden: number; tag: string }[] } };
    const stunden = b.inhalt.betrieb.map((e) => e.stunden).sort();
    assert.ok(stunden.includes(2.25) && stunden.includes(7.5), JSON.stringify(stunden));
    assert.deepEqual(p.probleme, [], 'keine Fehler in der Konsole');
  }),
);
