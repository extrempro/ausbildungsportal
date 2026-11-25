import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ANNA, HANDY, PC, PETRA, inTagen, mitFoto, montagVon, oeffne, startePortal, text, ueberlauf } from './hilfe';
import type { Grunddaten, Portal } from './hilfe';

/** Bericht: automatisch speichern, zwischen Wochen blättern; Ausbilder blättern zwischen Azubis. */
let p: Portal;
let g: Grunddaten;
before(async () => {
  p = await startePortal();
  g = await p.grunddaten();
  const petra = await p.api().als(PETRA);
  await petra.ruf('PUT', `/api/azubis/${g.ben}/profil`, { ausbildungsbeginn: inTagen(-400), berufId: g.beruf, ausbilderId: g.petra, urlaubstage: 30 });
});
after(() => p.stop());

test(
  'Bericht: speichert von selbst, blättert zur nächsten Woche (vorschreiben, einreichen erst ab Montag) und zurück',
  mitFoto(() => p, 'bericht-autosave', async () => {
    const diese = montagVon(inTagen(0));
    const naechste = montagVon(inTagen(7));
    const s = await p.seite(ANNA, PC);
    await oeffne(s, p.url, `/berichtsheft/${diese}`);
    assert.equal(await s.locator('main button:has-text("Als Entwurf speichern")').count(), 0, 'kein Speichern-Knopf mehr');
    await s.locator('main textarea').first().fill('Netzwerkdose im Büro geprüft');
    await s.locator('.bericht-rand .bericht-sicher', { hasText: 'Alles gespeichert ·' }).waitFor();
    await s.reload();
    assert.equal(await s.locator('main textarea').first().inputValue(), 'Netzwerkdose im Büro geprüft', 'nach dem Neuladen noch da');

    // weitertippen und sofort in die nächste Woche: vorher wird gespeichert
    await s.locator('main textarea').first().fill('Netzwerkdose im Büro geprüft und beschriftet');
    await s.locator('.wochen-blaettern button').last().click();
    await s.waitForURL(new RegExp(`/berichtsheft/${naechste}$`));
    assert.match(await text(s, '.bericht-rand'), /Einreichen geht ab Montag/);
    assert.ok(await s.locator('.bericht-rand button:has-text("Einreichen")').isDisabled());
    await s.locator('.wochen-blaettern button').first().click();
    await s.waitForURL(new RegExp(`/berichtsheft/${diese}$`));
    assert.equal(await s.locator('main textarea').first().inputValue(), 'Netzwerkdose im Büro geprüft und beschriftet');
    assert.deepEqual(p.probleme, [], 'keine Fehler in der Konsole');
  }),
);

test(
  'Bericht am Handy: Stand des Speicherns in der Leiste, Wochen nebeneinander, kein Überlauf',
  mitFoto(() => p, 'bericht-autosave-handy', async () => {
    const s = await p.seite(ANNA, { ...HANDY, dunkel: true });
    await oeffne(s, p.url, `/berichtsheft/${montagVon(inTagen(-7))}`);
    await s.locator('main textarea').first().fill('Druckertreiber verteilt');
    await s.locator('.bericht-leiste .bericht-sicher', { hasText: 'Alles gespeichert' }).waitFor();
    assert.equal(await s.locator('.wochen-blaettern button:visible').count(), 2);
    assert.equal(await ueberlauf(s), 0);
  }),
);

test(
  'Ausbilder: zwischen Azubis blättern – der Reiter bleibt gleich',
  mitFoto(() => p, 'azubi-wechsel', async () => {
    const s = await p.seite(PETRA, PC);
    await oeffne(s, p.url, `/azubis/${g.anna}/plan`);
    const auswahl = s.locator('.azubi-wechsel select');
    await auswahl.waitFor();
    await auswahl.selectOption(String(g.ben));
    await s.waitForURL(new RegExp(`/azubis/${g.ben}/plan$`));
    await s.locator('.azubi-wechsel button').first().click();
    await s.waitForURL(new RegExp(`/azubis/${g.anna}/plan$`));
    const h = await p.seite(PETRA, HANDY);
    await oeffne(h, p.url, `/azubis/${g.anna}/urlaub`);
    await h.locator('.azubi-wechsel select').waitFor();
    assert.equal(await ueberlauf(h), 0);
    assert.deepEqual(p.probleme, [], 'keine Fehler in der Konsole');
  }),
);
