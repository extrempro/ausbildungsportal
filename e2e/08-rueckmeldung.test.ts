import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ADMIN, ANNA, BEA, HANDY, mitFoto, oeffne, PETRA, startePortal, text, ueberlauf } from './hilfe';
import type { Portal } from './hilfe';
import type { Page } from 'playwright';

let p: Portal;
before(async () => {
  p = await startePortal();
  await p.grunddaten();
});
after(() => p.stop());

const oeffneFenster = async (s: Page) => {
  await s.click('button[aria-label="Rückmeldung geben"]');
  await s.waitForSelector('[role=dialog] .melden-art');
};
const arten = (s: Page) => s.locator('.melden-art label strong').allTextContents();
const sende = async (s: Page, was: string) => {
  await s.fill('#melden-text', was);
  await s.click('[role=dialog] button:has-text("Rückmeldung senden")');
  await s.waitForSelector('text=Danke! Deine Rückmeldung ist angekommen.');
  await s.click('[role=dialog] button:has-text("Schließen")');
};

test(
  'Rückmeldung: Wunsch zu Lerninhalten geht ohne Namen an die Ausbilder, eine Idee an Super-Admin und Ausbilder, ein Fehler nur an den Super-Admin',
  mitFoto(() => p, 'rueckmeldung', async () => {
    // Azubi im Lernmodul: Art und Thema sind vorausgewählt
    const anna = await p.seite(ANNA);
    await oeffne(anna, p.url, '/lernen/grundlagen');
    await oeffneFenster(anna);
    await anna.waitForSelector('.melden-art label.gewaehlt:has-text("Lerninhalt besser erklären")');
    assert.deepEqual(await arten(anna), ['Fehler melden', 'Idee fürs Portal', 'Lerninhalt besser erklären']);
    assert.equal(await anna.inputValue('#melden-thema'), 'lernen|grundlagen|');
    assert.match(await text(anna, '[role=dialog]'), /Ohne deinen Namen/);
    await sende(anna, 'Den zweiten Abschnitt verstehe ich nicht, ein Beispiel würde helfen.');

    // von einer anderen Seite: erst wählen, dann schreiben
    await oeffne(anna, p.url, '/berichtsheft');
    await oeffneFenster(anna);
    assert.equal(await anna.locator('.melden-art label.gewaehlt').count(), 0, 'nichts vorausgewählt');
    assert.equal(await anna.locator('#melden-text').count(), 0);
    await anna.click('.melden-art label:has-text("Idee fürs Portal")');
    await sende(anna, 'Ein Zähler für die noch fehlenden Berichte wäre praktisch.');

    // Ausbildungsbeauftragte: zwei Arten, ein Fehler
    const bea = await p.seite(BEA);
    await oeffne(bea, p.url, '/');
    await oeffneFenster(bea);
    assert.deepEqual(await arten(bea), ['Fehler melden', 'Idee fürs Portal']);
    await bea.click('.melden-art label:has-text("Fehler melden")');
    await sende(bea, 'Die Liste der Azubis lädt bei mir sehr langsam.');
    await oeffne(bea, p.url, '/rueckmeldungen');
    assert.match(await text(bea, 'main'), /Seite nicht gefunden/);

    // Ausbilder: Wunsch mit Thema, aber ohne Namen; die Idee zum Mitlesen; den Fehler nicht
    const pe = await p.seite(PETRA);
    await oeffne(pe, p.url, '/rueckmeldungen');
    await pe.waitForSelector('.meldung');
    const seite = await text(pe, 'main');
    assert.match(seite, /Wünsche zu den Lerninhalten \(1 offen\)/);
    assert.match(seite, /Den zweiten Abschnitt verstehe ich nicht/);
    assert.match(seite, /Ein Zähler für die noch fehlenden Berichte/);
    assert.doesNotMatch(seite, /lädt bei mir sehr langsam/, 'Fehler gehen nur an den Super-Admin');
    const wunsch = pe.locator('.meldung:has-text("Den zweiten Abschnitt")');
    assert.doesNotMatch((await wunsch.textContent()) ?? '', /Anna/, 'der Wunsch nennt niemanden');
    await wunsch.locator('button:has-text("Als erledigt markieren")').click();
    await pe.waitForSelector('summary:has-text("Erledigt (1)")');

    // Super-Admin: Fehler und Idee, aber kein Wunsch zu Lerninhalten
    const chef = await p.seite(ADMIN.name);
    await oeffne(chef, p.url, '/verwaltung/meldungen');
    await chef.waitForSelector('.meldung');
    const liste = await text(chef, 'main');
    assert.match(liste, /lädt bei mir sehr langsam/);
    assert.match(liste, /Ein Zähler für die noch fehlenden Berichte/);
    assert.doesNotMatch(liste, /Den zweiten Abschnitt/, 'Wünsche zu Lerninhalten sieht der Super-Admin nicht');
    await chef.selectOption('.meldung-filter select', 'idee');
    assert.equal(await chef.locator('.meldung').count(), 1);

    // am Handy passt das Fenster ohne Überlauf
    const handy = await p.seite(ANNA, HANDY);
    await oeffne(handy, p.url, '/lernen/grundlagen');
    await oeffneFenster(handy);
    await handy.waitForSelector('#melden-thema');
    assert.equal(await ueberlauf(handy), 0, 'kein waagerechter Überlauf');
    assert.deepEqual(p.probleme, [], 'keine Fehler in der Konsole');
  }),
);
