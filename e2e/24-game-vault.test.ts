import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ANNA, HANDY, PC, PETRA, mitFoto, oeffne, startePortal, text, ueberlauf } from './hilfe';
import type { Grunddaten, Portal } from './hilfe';

/** Game Vault: Super-Admin schaltet ein, Anna legt ihr Regal an, öffnet ein Samenpaket, kauft und gibt Dünger. Andere sehen nichts. */
let p: Portal;
let g: Grunddaten;
before(async () => {
  p = await startePortal();
  g = await p.grunddaten();
});
after(() => p.stop());

test(
  'Game Vault: anfangs aus – nach dem Einschalten Regal anlegen, Samenpaket öffnen, Dünger kaufen und geben',
  mitFoto(() => p, 'game-vault', async () => {
    const anna = await p.api().als(ANNA);
    // ohne Schalter gibt es keinen Reiter
    let s = await p.seite(ANNA, PC);
    await oeffne(s, p.url, '/lernen');
    assert.equal(await s.locator('.reiter a:has-text("Game Vault")').count(), 0);
    await (await p.api().alsAdmin()).ruf('PUT', '/api/regal/einstellung', { an: true });
    // ein gelesenes Zusatzwissen bringt einen Funken
    await anna.ruf('PATCH', '/api/lernen/zusatz/grundlagen.planen', { gelesen: true });

    s = await p.seite(ANNA, PC);
    await oeffne(s, p.url, '/lernen');
    await s.click('.reiter a:has-text("Game Vault")');
    await s.locator('h1:has-text("Game Vault")').waitFor();
    await s.click('button:has-text("Regal anlegen")');
    await s.click('a:has-text("Zum Regal")');
    await s.locator('h1:has-text("Dein Pflanzenregal")').waitFor();
    assert.match(await text(s, '.vault-regal'), /Berichtsheft 1\. Jahr/);
    await s.click('button:has-text("Samenpaket öffnen")');
    await s.locator('[role=dialog] label:has-text("Blühpflanzen")').click();
    await s.click('[role=dialog] button:has-text("Paket öffnen")');
    await s.locator('[role=dialog] .vault-neu h3').waitFor();
    await s.click('[role=dialog] button:has-text("Zum Regal")');
    assert.equal(await s.locator('.vault-pflanze').count(), 1);
    assert.match(await text(s, '.vault-seite'), /noch feucht genug/);
    assert.ok(await s.locator('.vault-seite button:has-text("Pflanze gießen")').isDisabled());
    // Gärtnerei: Dünger für einen Funken, dann im Regal geben
    await s.click('a:has-text("Gärtnerei")');
    await s.locator('h1:has-text("Gärtnerei")').waitFor();
    await s.click('button:has-text("Dünger kaufen")');
    await s.locator('.hinweis.gut:has-text("liegt im Vorrat")').waitFor();
    await s.click('a:has-text("← Pflanzenregal")');
    await s.click('summary:has-text("Booster geben")');
    await s.click('button:has-text("Dünger (1)")');
    await s.locator('.vault-seite .hinweis.gut').waitFor();
    assert.match(await text(s, '.vault-seite'), /20 %/);
    // Üben bringt Tropfen – die Antwort sagt es, die Oberfläche zeigt es nach der Runde
    const karten = await anna.ruf('GET', '/api/lernen/karten');
    const r = await anna.ruf('PATCH', '/api/lernen/karte', { id: karten.karten[0].id, gewusst: true });
    assert.equal(r.regalTropfen, 1, 'fällige Karte: +1 Tropfen fürs Regal');
    const nochmal = await anna.ruf('PATCH', '/api/lernen/karte', { id: karten.karten[0].id, gewusst: true });
    assert.equal(nochmal.regalTropfen, 0, 'nicht fällig: nichts');
    assert.equal(await ueberlauf(s), 0);
    assert.deepEqual(p.probleme, [], 'keine Fehler in der Konsole');
  }),
);

test(
  'Game Vault am Handy und dunkel: Regal ohne Überlauf, Gärtnerei und Tropfen-Seite',
  mitFoto(() => p, 'game-vault-handy', async () => {
    const s = await p.seite(ANNA, { ...HANDY, dunkel: true });
    for (const pfad of ['/lernen/vault/regal', '/lernen/vault/gaertnerei', '/lernen/vault/tropfen']) {
      await oeffne(s, p.url, pfad);
      await s.locator('h1').waitFor();
      assert.equal(await ueberlauf(s), 0, pfad);
    }
    assert.deepEqual(p.probleme, []);
  }),
);

test('Game Vault ist privat: Ausbilder kommt weder an die Seite noch an die Daten', async () => {
  const petra = await p.api().als(PETRA);
  await assert.rejects(petra.ruf('GET', '/api/regal'));
  const s = await p.seite(PETRA, PC);
  await oeffne(s, p.url, '/lernen/vault/regal');
  assert.equal(await s.locator('h1:has-text("Dein Pflanzenregal")').count(), 0);
  void g;
});
