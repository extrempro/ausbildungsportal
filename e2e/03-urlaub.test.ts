import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ANNA, BEA, BEN, inTagen, mitFoto, montagVon, oeffne, PETRA, startePortal, text } from './hilfe';
import type { Grunddaten, Portal } from './hilfe';

let p: Portal;
let g: Grunddaten;
before(async () => {
  p = await startePortal();
  g = await p.grunddaten();
});
after(() => p.stop());

// Montag bis Mittwoch in gut sechs Wochen
const von = montagVon(inTagen(45));
const bis = new Date(Date.parse(`${von}T12:00:00Z`) + 2 * 86_400_000).toISOString().slice(0, 10);

test(
  'Urlaub: Azubi beantragt, Beauftragte bestätigt, Ausbilderin genehmigt – der Azubi sieht jeden Schritt',
  mitFoto(() => p, 'urlaub', async () => {
    const a = await p.seite(ANNA);
    await oeffne(a, p.url, '/urlaub');
    const felder = a.locator('main form input[type=date]');
    await felder.nth(0).fill(von);
    await felder.nth(1).fill(bis);
    await a.click('main form button:has-text("Urlaub beantragen")');
    await a.waitForSelector('text=Urlaub beantragt.');
    assert.match(await text(a, 'main'), /beantragt/i);

    // die Beauftragte hat etwas zu tun: Zahl am Menüpunkt, Antrag in der Liste
    const b = await p.seite(BEA);
    await oeffne(b, p.url, '/urlaub');
    assert.match(await text(b, 'main'), /Anna Azubi/);
    await b.click('main button:has-text("Urlaub bestätigen")');
    await b.click('[role=alertdialog] .frage-ja');
    await b.waitForSelector('text=/bestätigt/i');
    assert.equal(await b.locator('main button:has-text("Urlaub genehmigen")').count(), 0, 'genehmigen kann nur die Ausbilderin');

    // die Ausbilderin genehmigt
    const pe = await p.seite(PETRA);
    await oeffne(pe, p.url, '/urlaub');
    await pe.click('main button:has-text("Urlaub genehmigen")');
    await pe.click('[role=alertdialog] .frage-ja');
    await pe.waitForSelector('text=/genehmigt/i');

    // beim Azubi: genehmigt, in der Glocke und im Jahreskalender
    await oeffne(a, p.url, '/urlaub');
    assert.match(await text(a, 'main'), /genehmigt/i);
    await a.click('.glocke-knopf');
    // die Einträge werden nachgeladen – warten, bis sie da sind
    await a.waitForSelector('.menue.glocke :text("Urlaub genehmigt")');
    await a.keyboard.press('Escape');
    await oeffne(a, p.url, '/jahreskalender');
    await a.waitForSelector('.jk-zelle.urlaub');
    assert.equal(await a.locator('.jk-zelle.urlaub').count(), 3, 'drei Urlaubstage im Jahreskalender');

    // Rechte: Ben sieht Annas Anträge nicht; ein Azubi kann nicht genehmigen
    const ben = await p.api().als(BEN);
    assert.equal(await ben.status('GET', `/api/azubis/${g.anna}/urlaub`), 404);
    const anna = await p.api().als(ANNA);
    const antrag = (await anna.ruf('GET', `/api/azubis/${g.anna}/urlaub`)).antraege?.[0]?.id ?? 1;
    assert.equal(await anna.status('POST', `/api/urlaub/${antrag}/genehmigen`, {}), 403);
    assert.deepEqual(p.probleme, [], 'keine Fehler in der Konsole');
  }),
);
