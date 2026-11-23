import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ANNA, HANDY, PC, PETRA, inTagen, mitFoto, montagVon, oeffne, startePortal, text, ueberlauf } from './hilfe';
import type { Portal } from './hilfe';

/** Alte Berichte einlesen: Text einfügen, Vorschau prüfen, als Entwurf übernehmen, gesammelt einreichen – Ausbilderin sieht „eingelesen“. */
let p: Portal;
before(async () => {
  p = await startePortal();
  await p.grunddaten();
  await (await p.api().als(ANNA)).ruf('PUT', '/api/ich/unterschrift', { pfad: 'M10 10 L20 20 L30 10 L40 20 L50 10 L60 20' });
});
after(() => p.stop());

/** TT.MM.JJJJ */
const tt = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const plus = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

test(
  'Alte Berichte: Text einlesen, übernehmen, einreichen – beim Abzeichnen als „eingelesen“ markiert',
  mitFoto(() => p, 'berichte-einlesen', async () => {
    const s = await p.seite(ANNA, HANDY);
    await oeffne(s, p.url, '/berichtsheft');
    await s.click('a:has-text("Alte Berichte einlesen")');
    await s.locator('h1:has-text("Alte Berichte einlesen")').waitFor();
    // ohne Dienst ist die PDF gesperrt – mit Grund
    await s.locator('text=PDFs lesen geht gerade nicht').waitFor();
    assert.ok(await s.locator('input[type=file]').isDisabled());
    const a = montagVon(inTagen(-35));
    const b = plus(a, 7);
    await s.locator('textarea').fill(
      `Ausbildungsnachweis Nr. 1\nWoche vom ${tt(a)} bis ${tt(plus(a, 4))}\nBetriebliche Tätigkeiten   Stunden\nArbeitsplätze eingerichtet   7\nDrucker eingebunden   8\n\fAusbildungsnachweis Nr. 2\nWoche vom ${tt(b)} bis ${tt(plus(b, 4))}\nBetriebliche Tätigkeiten\nServer-Updates eingespielt   8\nThemen des Berufsschulunterrichts\nSubnetting   6`,
    );
    await s.click('button:has-text("Text einlesen")');
    await s.locator('h2:has-text("Vorschau")').waitFor();
    assert.match(await text(s, 'main'), /2 Wochen aus dem eingefügten Text gelesen/);
    assert.equal(await s.locator('.liste input[type=checkbox]:checked').count(), 2);
    await s.locator('summary:has-text("Einträge ansehen")').first().click();
    assert.match(await text(s, 'details.klapp'), /Drucker eingebunden – 8 Std\./);
    assert.equal(await ueberlauf(s), 0);
    await s.click('button:has-text("2 Wochen als Entwurf übernehmen")');
    await s.locator('text=2 Berichte als Entwurf übernommen.').waitFor();
    await s.locator('h2:has-text("Eingelesene Entwürfe einreichen")').waitFor();
    assert.equal(await ueberlauf(s), 0);
    await s.click('button:has-text("2 Berichte einreichen")');
    await s.locator('text=2 Berichte eingereicht.').waitFor();

    // Petra sieht beim Abzeichnen, dass die Berichte eingelesen sind
    const q = await p.seite(PETRA, PC);
    await oeffne(q, p.url, '/abzeichnen');
    await q.locator('.pille:has-text("eingelesen")').first().waitFor();
    assert.equal(await q.locator('.pille:has-text("eingelesen")').count(), 2);
    assert.deepEqual(p.probleme, [], 'keine Fehler in der Konsole');
  }),
);
