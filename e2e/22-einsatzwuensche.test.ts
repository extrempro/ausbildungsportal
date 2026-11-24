import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ANNA, BEA, HANDY, PC, PETRA, inTagen, mitFoto, montagVon, oeffne, startePortal, text, ueberlauf } from './hilfe';
import type { Grunddaten, Portal } from './hilfe';

/** Einsatz wünschen (Anna) → genehmigen (Petra) → Zeitleiste; Erinnerung der Beauftragten (Bea). */
let p: Portal;
let g: Grunddaten;
before(async () => {
  p = await startePortal();
  g = await p.grunddaten();
  const petra = await p.api().als(PETRA);
  await petra.ruf('POST', '/api/abteilungen', { name: 'Lager', beauftragte: [g.bea] });
});
after(() => p.stop());

test(
  'Einsatzwunsch: Anna wünscht am Handy, Petra genehmigt – der Einsatz steht im Plan und in der Zeitleiste',
  mitFoto(() => p, 'einsatzwunsch', async () => {
    const von = montagVon(inTagen(28));
    const a = await p.seite(ANNA, HANDY);
    await oeffne(a, p.url, '/');
    await a.click('a:has-text("Einsatz wünschen")');
    await a.locator('h1', { hasText: 'Einsatz wünschen' }).waitFor();
    await a.locator('label', { hasText: 'Abteilung' }).locator('select').selectOption({ label: 'Lager' });
    await a.locator('label', { hasText: 'Ab der Woche' }).locator('input').fill(von);
    await a.locator('label', { hasText: 'Warum?' }).locator('textarea').fill('Wareneingang kennenlernen');
    await a.click('button:has-text("Wunsch absenden")');
    await a.locator('.pille', { hasText: 'Wartet auf Entscheidung' }).waitFor();
    assert.equal(await ueberlauf(a), 0);

    // Petra: Zahl am Menü „Planung“, Wunsch genehmigen
    const s = await p.seite(PETRA, PC);
    await oeffne(s, p.url, '/planung/einsatzwuensche');
    await s.locator('.antrag', { hasText: 'Anna' }).waitFor();
    assert.match(await text(s, '.antrag'), /Wareneingang kennenlernen/);
    await s.click('button:has-text("Einsatz genehmigen")');
    await s.locator('[role=alertdialog] button:has-text("Einsatz genehmigen")').click();
    await s.locator('text=Im Moment wartet kein Wunsch auf dich.').waitFor();

    // Anna sieht „Genehmigt“
    await a.reload();
    await a.locator('.pille', { hasText: 'Genehmigt' }).waitFor();

    // Zeitleiste: Reiter nur für Ausbilder, Zeile „Lager“, Klick öffnet die Woche im Plan
    await oeffne(s, p.url, `/azubis/${g.anna}/zeitleiste`);
    await s.locator('.zl-zeile', { hasText: 'Lager' }).waitFor();
    await s.click('button:has-text("Quartal")');
    assert.equal(await s.locator('.umschalter button[aria-pressed="true"]').textContent(), 'Quartal');
    await s.locator('.zl-zeile', { hasText: 'Lager' }).locator('a.zl-ziel').click();
    await s.waitForURL(new RegExp(`/azubis/${g.anna}/plan#kw-${von}$`));
    await s.locator(`#kw-${von}`).waitFor();

    const b = await p.seite(BEA, PC);
    await oeffne(b, p.url, `/azubis/${g.anna}/plan`);
    assert.equal(await b.locator('.reiter a', { hasText: 'Zeitleiste' }).count(), 0, 'Beauftragte sehen den Reiter nicht');
    assert.deepEqual(p.probleme, [], 'keine Fehler in der Konsole');
  }),
);

test(
  'Erinnerung: Bea legt am Handy eine Erinnerung an, sie ist fällig und steht mit Zahl am Menü',
  mitFoto(() => p, 'erinnerung', async () => {
    const b = await p.seite(BEA, { ...HANDY, dunkel: true });
    await oeffne(b, p.url, '/erinnerungen');
    await b.locator('label', { hasText: 'Azubi' }).locator('select').selectOption({ label: 'Anna Azubi' });
    await b.click('button:has-text("An einem Tag")');
    await b.locator('label', { hasText: 'Tag' }).locator('input[type="date"]').fill(inTagen(0));
    await b.locator('label', { hasText: 'Woran erinnern?' }).locator('input').fill('Zugang vorbereiten');
    await b.click('button:has-text("Erinnerung anlegen")');
    await b.locator('.erinnerung', { hasText: 'Zugang vorbereiten' }).waitFor();
    await b.locator('main h2', { hasText: 'Fällig (1)' }).waitFor();
    assert.equal(await ueberlauf(b), 0);
    await b.locator('.erinnerung', { hasText: 'Zugang vorbereiten' }).locator('input[type="checkbox"]').click();
    await b.locator('text=Gerade ist nichts fällig.').waitFor();
    assert.deepEqual(p.probleme, [], 'keine Fehler in der Konsole');
  }),
);
