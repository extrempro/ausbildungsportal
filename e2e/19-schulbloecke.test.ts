import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ANNA, HANDY, PC, PETRA, inTagen, mitFoto, montagVon, oeffne, startePortal, text, ueberlauf } from './hilfe';
import type { Grunddaten, Portal } from './hilfe';

/** Klassen und Schulblöcke: Klasse in den Stammdaten, im Profil gewählt, Block an der Klasse – steht im Plan des Azubis. */
let p: Portal;
let g: Grunddaten;
before(async () => {
  p = await startePortal();
  g = await p.grunddaten();
  const petra = await p.api().als(PETRA);
  const schule = (await petra.ruf('POST', '/api/stammdaten/berufsschulen', { name: 'Berufliche Schule Musterstadt', ort: 'Musterstadt', bundesland: 'HH', form: 'block' })).berufsschule.id as number;
  const profil = (await petra.ruf('GET', `/api/azubis/${g.anna}/profil`)).profil;
  await petra.ruf('PUT', `/api/azubis/${g.anna}/profil`, { ...profil, berufsschuleId: schule });
});
after(() => p.stop());

test(
  'Schulblöcke: Klasse anlegen, im Profil wählen, Block eintragen – er steht im Plan des Azubis',
  mitFoto(() => p, 'schulbloecke', async () => {
    const s = await p.seite(PETRA, PC);
    // Stammdaten: Klasse bei der Berufsschule anlegen
    await oeffne(s, p.url, '/verwaltung/stammdaten');
    await s.locator('summary:has-text("Klassen (0)")').click();
    await s.getByLabel('Neue Klasse').fill('FI-25a');
    await s.click('button:has-text("Klasse anlegen")');
    await s.locator('summary:has-text("Klassen (1)")').waitFor();

    // Profil: Klasse wählen
    await oeffne(s, p.url, `/azubis/${g.anna}`);
    await s.locator('label', { hasText: /^Klasse/ }).locator('select').selectOption({ label: 'FI-25a' });
    await s.click('button:has-text("Profil speichern")');
    await s.locator('text=Gespeichert.').waitFor();

    // Planung → Schulblöcke: Block eintragen
    await oeffne(s, p.url, '/planung/schulbloecke');
    assert.match(await text(s, 'details.karte summary'), /FI-25a · 0 Schulblöcke · 1 Azubi/);
    await s.locator('details.karte summary').click();
    const von = montagVon(inTagen(21));
    await s.getByLabel('Titel').fill('Blockunterricht');
    await s.getByLabel('Von (Woche mit diesem Tag)').fill(von);
    await s.getByLabel('Bis (leer = eine Woche)').fill(montagVon(inTagen(35)));
    await s.click('button:has-text("Schulblock eintragen")');
    await s.locator('text=Schulblock eingetragen – er steht jetzt im Plan von einem Azubi.').waitFor();
    assert.match(await text(s, 'details.karte .liste'), /Blockunterricht · KW \d+–\d+/);
    assert.equal(await ueberlauf(s), 0);

    // im Plan von Anna – mit Hinweis auf die Klasse
    const a = await p.seite(ANNA, HANDY);
    await oeffne(a, p.url, '/');
    await a.locator('text=Klasse FI-25a').first().waitFor({ state: 'attached' });
    assert.ok((await a.locator('main').textContent())?.includes('Blockunterricht'));
    assert.equal(await ueberlauf(a), 0);
    assert.deepEqual(p.probleme, [], 'keine Fehler in der Konsole');
  }),
);
