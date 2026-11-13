import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ANNA, BEA, BEN, HANDY, inTagen, mitFoto, oeffne, PETRA, startePortal, text, ueberlauf } from './hilfe';
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

test(
  'Planer freigeschaltet, während das Portal offen ist: Die Glocke führt ohne Neuladen hin',
  mitFoto(() => p, 'planer-frei', async () => {
    // Ben hat noch kein Profil – also weder Lernen noch Planer
    const b = await p.seite(BEN);
    const petra = await p.api().als(PETRA);
    await petra.ruf('PUT', `/api/azubis/${g.ben}/profil`, { ausbildungsbeginn: inTagen(-30), berufId: g.beruf, ausbilderId: g.petra, urlaubstage: 30, planerFrei: true });
    await b.click('.glocke-knopf');
    await b.click('.menue.glocke :text("Neu für dich: Planer für deine Prüfung")');
    await b.waitForSelector('main h1:has-text("Abschlussarbeit")');
    assert.equal((await text(b, 'main')).includes('Seite nicht gefunden'), false);
    // eine Seite, die es wirklich nicht gibt, bleibt „nicht gefunden“
    await oeffne(b, p.url, '/planer/gibt-es-nicht');
    await b.waitForSelector('main h1:has-text("Seite nicht gefunden")');
    assert.deepEqual(p.probleme, [], 'keine Fehler in der Konsole');
  }),
);

test(
  'Lernen am Handy: Die Zeile „Inhalt“ bleibt beim Rollen stehen, springt zum Abschnitt und klappt danach zu',
  mitFoto(() => p, 'lernen-navi-handy', async () => {
    const s = await p.seite(ANNA, HANDY);
    await oeffne(s, p.url, '/lernen/grundlagen');
    const zeile = s.locator('details.lern-navi-klapp');
    await zeile.waitFor();
    assert.equal(await s.locator('aside.lern-navi').isVisible(), false, 'die Randleiste gibt es am Handy nicht');
    assert.match((await zeile.locator('.handbuch-wo').textContent()) ?? '', /Grundlagen/);

    // aufklappen, Abschnitt wählen: Die Zeile klappt zu, bleibt oben stehen und nennt den Abschnitt
    await zeile.locator('summary').click();
    await zeile.locator('.lern-navi-unter button:has-text("Ablauf")').click();
    await s.waitForFunction(() => !document.querySelector<HTMLDetailsElement>('details.lern-navi-klapp')?.open);
    await s.waitForFunction(() => /Ablauf/.test(document.querySelector('.lern-navi-klapp .handbuch-wo')?.textContent ?? ''));
    const lage = await s.evaluate(() => {
      const kopf = document.querySelector('.leiste')!.getBoundingClientRect().bottom;
      const z = document.querySelector('.lern-navi-klapp')!.getBoundingClientRect();
      return { abstand: Math.round(z.top - kopf), ziel: Math.round(document.getElementById('u-ablauf')!.getBoundingClientRect().top - z.bottom) };
    });
    assert.ok(lage.ziel >= 0, `der Abschnitt beginnt unter der Zeile, nicht dahinter (${lage.ziel} px)`);
    assert.equal(await ueberlauf(s), 0);

    // in ein anderes Themenfeld wechseln: zu, und die Zeile nennt das neue
    await zeile.locator('summary').click();
    await zeile.locator('a:has-text("Praxis")').click();
    await s.waitForFunction(() => /Praxis/.test(document.querySelector('.lern-navi-klapp .handbuch-wo')?.textContent ?? ''));
    assert.equal(await zeile.evaluate((e) => (e as HTMLDetailsElement).open), false);
    assert.deepEqual(p.probleme, [], 'keine Fehler in der Konsole');
  }),
);
