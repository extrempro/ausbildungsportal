import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ANNA, HANDY, PC, PETRA, inTagen, mitFoto, montagVon, oeffne, startePortal, text, ueberlauf } from './hilfe';
import type { Grunddaten, Portal } from './hilfe';

/** Samstag und Sonntag im Berichtsheft: Der Ausbilder schaltet sie im Profil frei, dann stehen sie in Annas Bericht. */
let p: Portal;
let g: Grunddaten;
before(async () => {
  p = await startePortal();
  g = await p.grunddaten();
});
after(() => p.stop());

test(
  'Wochenende im Berichtsheft: ohne Freischaltung Montag bis Freitag, mit Freischaltung im Profil auch Samstag und Sonntag',
  mitFoto(() => p, 'wochenende', async () => {
    const woche = montagVon(inTagen(-7));
    const s = await p.seite(PETRA, PC);
    await oeffne(s, p.url, `/azubis/${g.anna}`);
    const haken = s.getByLabel('Samstag und Sonntag im Berichtsheft freischalten');
    // gesperrt, solange Anna ihre Berichte als Woche im Ganzen schreibt – mit Grund
    assert.ok(await haken.isDisabled());
    assert.match(await text(s, 'form'), /Gesperrt: Das gilt nur für Berichte mit Einträgen je Tag/);
    await s.locator('label', { hasText: 'Form des Berichtshefts' }).locator('select').selectOption('tag');
    assert.ok(!(await haken.isDisabled()));

    // Anna: nur Montag bis Freitag
    await s.click('button:has-text("Profil speichern")');
    await s.locator('text=Gespeichert.').waitFor();
    const a = await p.seite(ANNA, HANDY);
    await oeffne(a, p.url, `/berichtsheft/${woche}`);
    await a.locator('fieldset.tag').first().waitFor();
    assert.equal(await a.locator('fieldset.tag').count(), 5);
    await a.locator('text=kann dein Ausbilder Samstag und Sonntag in deinem Profil freischalten').waitFor();

    // freischalten
    await haken.check();
    await s.click('button:has-text("Profil speichern")');
    // die Übersicht über dem Formular zeigt den neuen Stand
    await s.locator('dd', { hasText: 'Samstag und Sonntag freigeschaltet' }).waitFor();
    await a.reload();
    await a.locator('fieldset.tag').first().waitFor();
    assert.equal(await a.locator('fieldset.tag').count(), 7);
    assert.match(await text(a, 'fieldset.tag:nth-of-type(6) legend'), /Samstag/);
    assert.equal(await ueberlauf(a), 0);
    assert.deepEqual(p.probleme, [], 'keine Fehler in der Konsole');
  }),
);
