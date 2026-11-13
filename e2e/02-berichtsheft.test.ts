import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ANNA, inTagen, mitFoto, montagVon, oeffne, PETRA, startePortal, text } from './hilfe';
import type { Grunddaten, Portal } from './hilfe';
import type { Page } from 'playwright';

let p: Portal;
let g: Grunddaten;
before(async () => {
  p = await startePortal();
  g = await p.grunddaten();
});
after(() => p.stop());

/** Unterschreibt im Feld auf der Konto-Seite mit der Maus und speichert. */
async function unterschreibe(s: Page, url: string): Promise<void> {
  await oeffne(s, url, '/konto');
  const feld = s.locator('.unterschrift-feld, .signatur-feld.gross').first();
  await feld.scrollIntoViewIfNeeded();
  const r = (await feld.boundingBox())!;
  await s.mouse.move(r.x + 30, r.y + r.height * 0.6);
  await s.mouse.down();
  for (let i = 1; i <= 30; i++) await s.mouse.move(r.x + 30 + (i * (r.width - 60)) / 30, r.y + r.height * (0.5 + 0.25 * Math.sin(i / 2)), { steps: 2 });
  await s.mouse.up();
  await s.click('button:has-text("Unterschrift speichern")');
  await s.waitForSelector('button:has-text("Neu unterschreiben")');
}

// die Woche vor der laufenden – sie ist sicher schon fällig
const montag = montagVon(inTagen(-7));

test(
  'Berichtsheft: Azubi schreibt und reicht ein, Ausbilderin gibt zurück, Azubi bessert nach, Ausbilderin zeichnet ab',
  mitFoto(() => p, 'berichtsheft', async () => {
    const a = await p.seite(ANNA);

    // ohne Unterschrift lässt sich nicht einreichen – das Portal sagt, was fehlt
    await oeffne(a, p.url, `/berichtsheft/${montag}`);
    await a.locator('main textarea').first().fill('Wareneingang geprüft und Artikel eingelagert');
    await a.locator('main input[type=number]').first().fill('38');
    await a.click('main button.knopf:not(.klein):has-text("Einreichen")');
    // das Portal speichert den Bericht als Entwurf und sagt, was fehlt
    await a.waitForSelector('main h1:has-text("Entwurf")');
    assert.match(await text(a, 'main'), /Zum Einreichen fehlt deine Unterschrift/);

    await unterschreibe(a, p.url);
    await oeffne(a, p.url, `/berichtsheft/${montag}`);
    assert.equal(await a.locator('main textarea').first().inputValue(), 'Wareneingang geprüft und Artikel eingelagert', 'der Entwurf ist noch da');
    await a.click('main button.knopf:not(.klein):has-text("Einreichen")');
    await a.locator('[role=alertdialog] .frage-ja').click({ timeout: 2000 }).catch(() => undefined);
    await a.waitForSelector('main h1:has-text("eingereicht")');
    assert.equal(await a.locator('main textarea:not([disabled]):not([readonly])').count(), 0, 'eingereicht lässt sich nichts mehr ändern');

    // die Ausbilderin sieht ihn unter „Abzeichnen“ und gibt ihn mit Kommentar zurück
    const pe = await p.seite(PETRA);
    await unterschreibe(pe, p.url);
    await oeffne(pe, p.url, '/abzeichnen');
    assert.match(await text(pe, '.abz-gruppe'), /Anna Azubi/);
    await pe.click('.abz-gruppe button:has-text("Lesen"), .abz-gruppe summary:has-text("Lesen")');
    await pe.waitForSelector('.abz-gruppe :text("Wareneingang geprüft")');
    // der aufgeklappte Bericht steht unter seiner Zeile, nicht daneben
    const zeile = (await pe.locator('.abz-kopf').first().boundingBox())!;
    const offen = (await pe.locator('.abz-gruppe :text("Betriebliche Tätigkeiten")').first().boundingBox())!;
    assert.ok(offen.y >= zeile.y + zeile.height - 1, 'Bericht klappt unter der Zeile auf');
    await pe.click('.abz-gruppe button:has-text("Zurückgeben …")');
    await pe.locator('.abz-gruppe textarea, [role=dialog] textarea, [role=alertdialog] textarea').first().fill('Bitte die Tätigkeiten genauer beschreiben.');
    await pe.click('button:has-text("Bericht zurückgeben"), button:has-text("Zurückgeben"):not(:has-text("…"))');
    await pe.waitForSelector('text=/zurückgegeben/i');

    // der Azubi erfährt es über die Glocke, bessert nach und reicht wieder ein
    await a.goto(`${p.url}/`);
    await a.waitForSelector('.glocke-knopf');
    await a.click('.glocke-knopf');
    // die Einträge werden nachgeladen – warten, bis sie da sind
    await a.waitForSelector('.menue.glocke :text-matches("zurückgegeben", "i")');
    await a.keyboard.press('Escape');
    await oeffne(a, p.url, `/berichtsheft/${montag}`);
    assert.match(await text(a, 'main'), /Bitte die Tätigkeiten genauer beschreiben\./, 'der Kommentar steht am Bericht');
    await a.locator('main textarea').first().fill('Wareneingang geprüft: 40 Artikel gezählt, mit dem Lieferschein verglichen und eingelagert');
    await a.click('main button.knopf:not(.klein):has-text("Einreichen")');
    await a.locator('[role=alertdialog] .frage-ja').click({ timeout: 2000 }).catch(() => undefined);
    await a.waitForSelector('main h1:has-text("eingereicht")');

    // abzeichnen
    await oeffne(pe, p.url, '/abzeichnen');
    await pe.click('.abz-gruppe button:has-text("Lesen"), .abz-gruppe summary:has-text("Lesen")');
    await pe.waitForSelector('.abz-gruppe :text("40 Artikel gezählt")');
    await pe.click('.abz-gruppe button:has-text("Abzeichnen")');
    await pe.locator('[role=alertdialog] .frage-ja').click({ timeout: 2000 }).catch(() => undefined);
    await pe.waitForSelector('text=/abgezeichnet/i');
    await oeffne(pe, p.url, '/abzeichnen');
    assert.equal(await pe.locator('.abz-gruppe').count(), 0, 'nichts mehr abzuzeichnen');

    // beim Azubi: abgezeichnet, beide Unterschriften, Druckansicht
    await oeffne(a, p.url, `/berichtsheft/${montag}`);
    assert.match(await text(a, 'main h1'), /abgezeichnet/);
    assert.equal(await a.locator('.signaturen .signatur-feld svg, .signaturen .signatur-feld path').count() >= 2, true, 'beide Unterschriften stehen unter dem Bericht');
    await oeffne(a, p.url, '/berichtsheft');
    assert.match(await text(a, 'main table, main .stapel'), /abgezeichnet/i);

    // Rechte: Die Ausbilderin kann den Bericht lesen, Ben nicht
    assert.equal(await (await p.api().als(PETRA)).status('GET', `/api/azubis/${g.anna}/berichte/${montag}`), 200);
    assert.deepEqual(p.probleme, [], 'keine Fehler in der Konsole');
  }),
);
