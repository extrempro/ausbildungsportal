import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ADMIN, ANNA, BEA, BEN, HANDY, mitFoto, oeffne, PETRA, startePortal, text, ueberlauf } from './hilfe';
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
    // auf einen Abschnitt eingrenzen
    await anna.selectOption('#melden-thema', 'lernen|grundlagen|ablauf');
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
    // „Zum Thema springen“ führt an die Stelle im Lernmodul
    await wunsch.locator('a:has-text("Zum Thema springen")').click();
    await pe.waitForURL(/\/lerninhalte\/muster\/grundlagen#u-ablauf$/);
    await pe.locator('main h1:has-text("Grundlagen")').waitFor();
    await pe.waitForFunction(() => {
      const r = document.getElementById('u-ablauf')?.getBoundingClientRect();
      return !!r && r.top >= 0 && r.top < 200;
    });
    await oeffne(pe, p.url, '/rueckmeldungen');
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

test(
  'Rückfragen: Super-Admin und Ausbilder fragen nach, die Person sieht es in der Glocke und antwortet unter „Meine Meldungen“',
  mitFoto(() => p, 'rueckfrage', async () => {
    // Ben meldet einen Fehler und eine Idee – danach steht „Meine Meldungen“ in seinem Menü
    const ben = await p.seite(BEN);
    await oeffne(ben, p.url, '/berichtsheft');
    await oeffneFenster(ben);
    await ben.click('.melden-art label:has-text("Fehler melden")');
    await ben.fill('#melden-text', 'Beim Einreichen kommt eine leere Seite.');
    await ben.click('[role=dialog] button:has-text("Rückmeldung senden")');
    await ben.waitForSelector('text=Danke! Deine Rückmeldung ist angekommen.');
    await ben.click('[role=dialog] a:has-text("Meine Meldungen ansehen")');
    await ben.waitForURL(/\/meine-meldungen$/);
    await ben.waitForSelector('.meldung:has-text("leere Seite")');
    assert.match(await text(ben, '.meldung'), /Noch keine Rückfrage/);
    await oeffneFenster(ben);
    await ben.click('.melden-art label:has-text("Idee fürs Portal")');
    await sende(ben, 'Eine Suche über alle Berichte wäre praktisch.');

    // Super-Admin fragt zum Fehler nach
    const chef = await p.seite(ADMIN.name);
    await oeffne(chef, p.url, '/verwaltung/meldungen');
    const fehler = chef.locator('.meldung:has-text("leere Seite")');
    await fehler.locator('summary:has-text("Rückfrage stellen")').click();
    await fehler.locator('textarea').fill('Welcher Browser – und welche Woche?');
    await fehler.locator('button:has-text("Rückfrage senden")').click();
    await fehler.locator('summary:has-text("Gespräch (1)")').waitFor();

    // Ausbilderin fragt zur Idee nach
    const pe = await p.seite(PETRA);
    await oeffne(pe, p.url, '/rueckmeldungen');
    const idee = pe.locator('.meldung:has-text("Suche über alle Berichte")');
    await idee.locator('summary:has-text("Rückfrage stellen")').click();
    await idee.locator('textarea').fill('Suchen nach Wörtern oder nach Wochen?');
    await idee.locator('button:has-text("Rückfrage senden")').click();
    await idee.locator('summary:has-text("Gespräch (1)")').waitFor();

    // Ben: Glocke zeigt die Rückfragen, ohne Inhalt; die Zahl steht am Menü
    await oeffne(ben, p.url, '/berichtsheft');
    await ben.click('button[aria-label^="Aktivitäten, "]');
    await ben.waitForSelector('.glocke-liste');
    assert.equal(await ben.locator('.glocke-liste li:has-text("Rückfrage zu deiner Rückmeldung")').count(), 2, 'je Person, die fragt, ein Eintrag');
    const glocke = await text(ben, '.glocke-flaeche');
    assert.doesNotMatch(glocke, /Welcher Browser|Wörtern/, 'die Glocke zeigt keinen Inhalt');
    await ben.locator('.glocke-liste a:has-text("Rückfrage zu deiner Rückmeldung")').first().click();
    await ben.waitForURL(/\/meine-meldungen$/);
    await ben.waitForSelector('.pille:has-text("Neue Rückfrage")');
    assert.equal(await ben.locator('.pille:has-text("Neue Rückfrage")').count(), 2);
    const meldung = ben.locator('.meldung:has-text("leere Seite")');
    assert.match((await meldung.textContent()) ?? '', /Welcher Browser/);
    await meldung.locator('textarea').fill('Firefox, Woche 46.');
    await meldung.locator('button:has-text("Antwort senden")').click();
    await meldung.locator('.von-person:has-text("Firefox, Woche 46.")').waitFor();

    // Super-Admin sieht die Antwort
    await oeffne(chef, p.url, '/verwaltung/meldungen');
    await fehler.locator('.pille:has-text("Neue Antwort")').waitFor();
    assert.match((await fehler.textContent()) ?? '', /Firefox, Woche 46\./);

    // am Handy ohne Überlauf, auch im Dunkeln
    const handy = await p.seite(BEN, { ...HANDY, dunkel: true });
    await oeffne(handy, p.url, '/meine-meldungen');
    await handy.waitForSelector('.gespraech-liste');
    assert.equal(await ueberlauf(handy), 0, 'kein waagerechter Überlauf');
    assert.deepEqual(p.probleme, [], 'keine Fehler in der Konsole');
  }),
);
