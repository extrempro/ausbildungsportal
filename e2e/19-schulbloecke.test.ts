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

test(
  'Plan der Schule einlesen: ohne Dienst Text einfügen, nur angelegte Klassen in der Vorschau, übernehmen',
  mitFoto(() => p, 'schulplan-einlesen', async () => {
    const s = await p.seite(PETRA, HANDY);
    await oeffne(s, p.url, '/planung/schulbloecke');
    await s.click('a:has-text("Plan der Schule einlesen")');
    await s.locator('h1:has-text("Plan der Schule einlesen")').waitFor();
    // ohne Dienst ist die PDF gesperrt – mit Grund
    await s.locator('text=PDFs lesen geht gerade nicht').waitFor();
    assert.ok(await s.locator('input[type=file]').isDisabled());
    await s.locator('textarea').fill(`Blockplan Schuljahr ${inTagen(0).slice(0, 4)}\nFI 25a  ${tt(inTagen(42))}–${tt(inTagen(56))}\nFI 25c  ${tt(inTagen(70))}–${tt(inTagen(84))}\nHerbstferien ${tt(inTagen(90))}–${tt(inTagen(95))}`);
    await s.click('button:has-text("Text einlesen")');
    await s.locator('h2:has-text("Vorschau")').waitFor();
    // FI 25a ist die angelegte Klasse FI-25a und angehakt; die FI 25c gibt es im Portal nicht – sie kommt nicht vor
    assert.match(await text(s, 'main'), /Ein Zeitraum aus dem eingefügten Text gelesen/);
    assert.equal(await s.locator('.liste input[type=checkbox]:checked').count(), 1);
    assert.equal(await ueberlauf(s), 0);
    await s.click('button:has-text("Einen Schulblock übernehmen")');
    await s.locator('h1:has-text("Schulblöcke")').waitFor();
    await s.locator('text=Ein Schulblock übernommen – im Plan von einem Azubi.').waitFor();
    assert.match(await text(s, 'main'), /FI-25a · 2 Schulblöcke/);
    assert.deepEqual(p.probleme, [], 'keine Fehler in der Konsole');
  }),
);

/** TT.MM.JJJJ */
function tt(iso: string): string {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
}
