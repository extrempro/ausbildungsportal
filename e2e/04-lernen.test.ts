import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ANNA, BEA, inTagen, mitFoto, oeffne, PETRA, startePortal, text } from './hilfe';
import type { Grunddaten, Portal } from './hilfe';
import type { Page } from 'playwright';

let p: Portal;
let g: Grunddaten;
before(async () => {
  p = await startePortal();
  g = await p.grunddaten();
});
after(() => p.stop());

test(
  'Lernen: Die Ampel wird mit Rückfrage umgestellt und bleibt; Betreuende sehen die Inhalte, aber keinen Lernstand',
  mitFoto(() => p, 'lernen', async () => {
    const a = await p.seite(ANNA);
    await oeffne(a, p.url, '/lernen');
    assert.match(await text(a, '.lern-gesamt'), /0 %/);
    await a.click('.lern-kachel:has-text("Grundlagen")');
    await a.waitForSelector('.lern-unterthema');
    // erst die Rückfrage, dann der neue Stand
    await a.locator('.lern-unterthema').first().locator('.ampel-knopf.gruen').click();
    assert.match(await text(a, '[role=alertdialog]'), /Ampel umstellen/);
    await a.click('[role=alertdialog] .frage-nein');
    assert.equal(await a.locator('.lern-unterthema').first().locator('.ampel-knopf.gruen').getAttribute('aria-pressed'), 'false', 'abgebrochen: nichts geändert');
    await a.locator('.lern-unterthema').first().locator('.ampel-knopf.gruen').click();
    await a.click('[role=alertdialog] .frage-ja');
    await a.waitForSelector('.lern-unterthema .ampel-knopf.gruen[aria-pressed="true"]');
    // ein neues Abzeichen wird einmal gezeigt – wegklicken, falls es kommt
    await a.locator('.abz-feier button.knopf').click({ timeout: 1500 }).catch(() => undefined);
    await a.reload();
    await a.waitForSelector('.lern-unterthema .ampel-knopf.gruen[aria-pressed="true"]');
    await oeffne(a, p.url, '/lernen');
    assert.doesNotMatch(await text(a, '.lern-gesamt'), /^0 %/, 'der Lernstand ist gestiegen');

    // Leseansicht: gleiche Inhalte, keine Ampel – und über die API kein Lernstand
    for (const wer of [PETRA, BEA]) {
      const s = await p.seite(wer);
      await oeffne(s, p.url, '/lerninhalte/muster/grundlagen');
      await s.waitForSelector('.lern-unterthema');
      assert.match(await text(s, 'main'), /Erst fragen, dann anfangen\./);
      assert.equal(await s.locator('.ampel-schalter').count(), 0, `${wer}: keine Ampel`);
      assert.equal(await (await p.api().als(wer)).status('GET', '/api/lernen'), 403);
      await s.context().close();
    }
    assert.deepEqual(p.probleme, [], 'keine Fehler in der Konsole');
  }),
);

/** Klappt einen Abschnitt auf, wenn er zu ist. */
async function klappeAuf(s: Page, titel: string): Promise<void> {
  const d = s.locator(`main details:has(> summary:has-text("${titel}"))`).first();
  if ((await d.getAttribute('open')) === null) await d.locator('> summary').click();
}

test(
  'Planer für die Prüfung: Eintragungen bleiben privat, nur der Termin steht im Plan – auch für die Ausbilderin',
  mitFoto(() => p, 'planer', async () => {
    const termin = inTagen(60);
    const a = await p.seite(ANNA);
    await oeffne(a, p.url, '/planer');
    await a.locator('main input:not([type=date]):not([type=checkbox])').first().fill('Geheimes Vorhaben');
    await a.click('main button:has-text("Angaben speichern")');
    await a.waitForSelector('text=/gespeichert/i');
    await klappeAuf(a, 'Termine');
    await a.locator('main input[type=date]').first().fill(termin);
    await a.click('main button:has-text("Termine speichern")');
    await a.waitForSelector('main summary:has-text("1 von 1 eingetragen")');
    await klappeAuf(a, 'Vorbereitung');
    await a.locator('main details:has(summary:has-text("Vorbereitung")) input[type=checkbox]').first().check();
    await a.waitForSelector('main summary:has-text("1 von 2 erledigt")');
    await a.reload();
    await a.waitForSelector('main summary:has-text("1 von 2 erledigt")');

    // im eigenen Plan steht der Termin
    await oeffne(a, p.url, '/');
    assert.match(await text(a, 'main'), /Abschlussarbeit: Abgabe am/);

    // die Ausbilderin sieht den Termin im Plan des Azubis – aber weder Titel noch Haken
    const petra = await p.api().als(PETRA);
    const plan = JSON.stringify(await petra.ruf('GET', `/api/azubis/${g.anna}/plan`));
    assert.ok(plan.includes('Abschlussarbeit: Abgabe am') && plan.includes(termin), 'Termin im Plan');
    assert.equal(plan.includes('Geheimes Vorhaben'), false, 'der Titel der Arbeit bleibt privat');
    assert.equal(await petra.status('GET', '/api/planer'), 403);
    assert.deepEqual(p.probleme, [], 'keine Fehler in der Konsole');
  }),
);
