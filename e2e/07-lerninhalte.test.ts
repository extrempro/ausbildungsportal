import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { baueZip } from '../server/zip';
import { ADMIN, BEA, HANDY, mitFoto, oeffne, PETRA, startePortal, text, ueberlauf } from './hilfe';
import type { Portal } from './hilfe';
import type { Page } from 'playwright';

let p: Portal;
let zip: Buffer;
before(async () => {
  // das erfundene Musterpaket dient auch als Einreichung: derselbe Ordner, als ZIP gepackt
  p = await startePortal({
    lernmodul: (ordner) => {
      const dateien: { name: string; daten: Buffer }[] = [];
      const lies = (pfad: string, vor: string) => {
        for (const n of readdirSync(pfad)) {
          if (statSync(join(pfad, n)).isDirectory()) lies(join(pfad, n), `${vor}${n}/`);
          else dateien.push({ name: `${vor}${n}`, daten: readFileSync(join(pfad, n)) });
        }
      };
      lies(ordner, 'buero/');
      zip = baueZip(dateien);
    },
  });
  await p.grunddaten();
});
after(() => p.stop());

const datei = () => ({ name: 'buero.zip', mimeType: 'application/zip', buffer: zip });
const karte = (s: Page, kennung: string) => s.locator(`.lern-paket-liste > li:has(code:text-is("${kennung}"))`);

test(
  'Lerninhalte: Ausbilder reicht ein und aktualisiert an der Karte, der Super-Admin lädt hoch, der Verlauf zeigt jeden Schritt',
  mitFoto(() => p, 'lerninhalte', async () => {
    const pe = await p.seite(PETRA);
    await oeffne(pe, p.url, '/lerninhalte');
    assert.match(await text(pe, '.lern-paket-liste'), /Im Portal/);
    assert.equal(await pe.locator('summary:has-text("Verlauf")').count(), 0, 'ohne Einreichungen kein Verlauf');

    // neues Lernmodul: Kennung, Datei, einreichen – es erscheint sofort als Karte
    await pe.click('summary:has-text("Neues Lernmodul einreichen")');
    await pe.fill('details input[pattern]', 'buero');
    await pe.setInputFiles('details input[type=file]', datei());
    await pe.click('details button:has-text("Lerninhalte einreichen")');
    await karte(pe, 'buero').waitFor();
    assert.match((await karte(pe, 'buero').textContent()) ?? '', /Wartet auf Prüfung – noch nicht im Portal/);
    assert.equal(await karte(pe, 'buero').locator('button:has-text("aktualisieren"), button:has-text("Neue Fassung einreichen")').count(), 0, 'solange geprüft wird, kein zweites Einreichen');

    // Super-Admin: hochladen; das Erledigte steht danach im Verlauf
    const chef = await p.seite(ADMIN.name);
    await oeffne(chef, p.url, '/verwaltung/lerninhalte');
    await chef.click('button:has-text("Lerninhalte hochladen …")');
    await chef.click('form button:has-text("Lerninhalte hochladen")');
    await chef.click('[role=alertdialog] .frage-ja');
    await chef.waitForSelector('text=Im Moment wartet keine Einreichung.');
    await chef.click('summary:has-text("Verlauf")');
    assert.match(await text(chef, '.einr-verlauf'), /Hochgeladen[\s\S]*Eingereicht/);

    // Ausbilder: Karte steht auf „Im Portal“; aktualisieren ohne Kennung zu tippen
    await oeffne(pe, p.url, '/lerninhalte');
    await karte(pe, 'buero').locator('.pille:has-text("Im Portal")').waitFor();
    assert.match((await karte(pe, 'buero').textContent()) ?? '', /Zuletzt hochgeladen von/);
    await karte(pe, 'buero').locator('button:has-text("Lerninhalte aktualisieren")').click();
    assert.equal(await karte(pe, 'buero').locator('input[pattern]').count(), 0, 'die Kennung steht fest');
    await karte(pe, 'buero').locator('input[type=file]').setInputFiles(datei());
    await karte(pe, 'buero').locator('button:has-text("Neue Fassung einreichen")').click();
    await karte(pe, 'buero').locator('.pille:has-text("Neue Fassung wartet auf Prüfung")').waitFor();

    // zurückgeben – die Rückmeldung steht an der Karte, und von dort geht es weiter
    await oeffne(chef, p.url, '/verwaltung/lerninhalte');
    await chef.click('button:has-text("Einreichung zurückgeben …")');
    await chef.fill('form textarea', 'Bitte das zweite Thema ergänzen.');
    await chef.click('form button:has-text("Einreichung zurückgeben")');
    await chef.waitForSelector('text=Im Moment wartet keine Einreichung.');
    await oeffne(pe, p.url, '/lerninhalte');
    await karte(pe, 'buero').locator('.pille:has-text("Neue Fassung zurückgegeben")').waitFor();
    assert.match((await karte(pe, 'buero').textContent()) ?? '', /Bitte das zweite Thema ergänzen\./);
    assert.equal(await karte(pe, 'buero').locator('button:has-text("Lerninhalte aktualisieren")').count(), 1);
    await pe.click('summary:has-text("Verlauf (4)")');

    // am Handy ohne Überlauf, auch mit offenem Verlauf
    const handy = await p.seite(PETRA, HANDY);
    await oeffne(handy, p.url, '/lerninhalte');
    await handy.click('summary:has-text("Verlauf")');
    assert.equal(await ueberlauf(handy), 0, 'kein waagerechter Überlauf');

    // Ausbildungsbeauftragte lesen nur: keine Einreichungen, kein Verlauf
    const bea = await p.seite(BEA);
    await oeffne(bea, p.url, '/lerninhalte');
    await bea.waitForSelector('.lern-pakete');
    assert.equal(await bea.locator('summary:has-text("Verlauf"), button:has-text("aktualisieren"), .lern-paket-liste').count(), 0);
    assert.deepEqual(p.probleme, [], 'keine Fehler in der Konsole');
  }),
);
