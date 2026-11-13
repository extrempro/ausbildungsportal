import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ADMIN, ANNA, BEN, mitFoto, oeffne, PETRA, startePortal, text } from './hilfe';
import type { Grunddaten, Portal } from './hilfe';

let p: Portal;
let g: Grunddaten;
before(async () => {
  p = await startePortal();
});
after(() => p.stop());

test(
  'Super-Admin: Die erste Anmeldung verlangt ein neues Passwort; danach legt er ein Konto an',
  mitFoto(() => p, 'admin-erste-anmeldung', async () => {
    const s = await p.leer();
    // ohne Anmeldung landet jede Adresse auf der Anmeldeseite
    await s.goto(`${p.url}/verwaltung/konten`);
    await s.waitForSelector('button:has-text("Mit Microsoft anmelden"), summary:has-text("Entwicklung")');
    assert.equal(await s.locator('.haupt-nav').count(), 0, 'unangemeldet gibt es kein Menü');

    await s.goto(`${p.url}/super`);
    await s.fill('input[name=benutzername]', ADMIN.name);
    await s.fill('input[name=passwort]', 'falsch');
    await s.press('input[name=passwort]', 'Enter');
    assert.match(await text(s, '[role=alert]'), /falsch/i, 'falsches Passwort wird an der Stelle gemeldet');

    await s.fill('input[name=passwort]', ADMIN.start);
    await s.press('input[name=passwort]', 'Enter');
    await s.waitForSelector('h1:has-text("Passwort ändern")');
    await s.fill('input[name=alt]', ADMIN.start);
    await s.fill('input[name=neu]', ADMIN.passwort);
    await s.fill('input[name=wiederholung]', ADMIN.passwort);
    await s.click('button:has-text("Passwort ändern")');
    await s.waitForSelector('h1:has-text("Konten")');

    // ein Konto für eine Ausbilderin anlegen
    await s.selectOption('main form select', 'ausbilder');
    await s.fill('input[name=anmeldename]', 'neu.ausbilder@firma.test');
    await s.fill('input[name=anzeigename]', 'Nora Neu');
    await s.click('main form button:has-text("anlegen")');
    await s.waitForSelector('main :text("Nora Neu")');
    // das Protokoll hält es fest
    await oeffne(s, p.url, '/verwaltung/protokoll');
    assert.match(await text(s, 'main'), /Konto angelegt/);
    await s.context().close();
  }),
);

test(
  'Jede Rolle landet auf ihrer Startseite und sieht nur ihr Menü',
  mitFoto(() => p, 'startseiten', async () => {
    g = await p.grunddaten({ adminEingerichtet: true });
    const menue = async (wer: string) => {
      const s = await p.seite(wer);
      const punkte = (await s.locator('.haupt-nav a, .haupt-nav button').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').replace(/\d+$/, '').trim());
      const titel = await text(s, 'main h1');
      await s.context().close();
      return { punkte, titel };
    };
    const anna = await menue(ANNA);
    assert.deepEqual(anna.punkte, ['Ausbildungsplan', 'Berichtsheft', 'Lernen', 'Abschlussarbeit', 'Urlaub']);
    const ben = await menue(BEN);
    assert.deepEqual(ben.punkte, ['Ausbildungsplan', 'Berichtsheft', 'Urlaub'], 'ohne Beruf kein Lernen und kein Planer');
    const petra = await menue(PETRA);
    assert.match(petra.titel, /Hallo Petra/);
    for (const punkt of ['Azubis', 'Abzeichnen', 'Jahreskalender', 'Urlaub', 'Planung', 'Verwaltung']) assert.ok(petra.punkte.includes(punkt), `Ausbilderin hat „${punkt}“: ${petra.punkte.join(', ')}`);
    const chef = await menue(ADMIN.name);
    assert.ok(chef.punkte.includes('Konten') && chef.punkte.includes('Protokoll') && !chef.punkte.includes('Azubis'), chef.punkte.join(', '));
  }),
);

test(
  'Rechte: Ein Azubi kommt weder über die Adresse noch über die API an Fremdes',
  mitFoto(() => p, 'rechte', async () => {
    const s = await p.seite(ANNA);
    for (const pfad of ['/verwaltung/konten', '/verwaltung/stammdaten', '/abzeichnen', `/azubis/${g.ben}`, '/lerninhalte']) {
      await s.goto(p.url + pfad);
      await s.waitForSelector('main h1');
      assert.match(await text(s, 'main h1'), /nicht gefunden|gibt es nicht/i, `${pfad} zeigt einem Azubi nichts`);
    }
    const api = await p.api().als(ANNA);
    assert.equal(await api.status('GET', '/api/konten'), 403);
    assert.equal(await api.status('GET', `/api/azubis/${g.ben}/berichte`), 404, 'fremder Azubi: nicht gefunden');
    assert.equal(await api.status('GET', '/api/lerninhalte'), 403);
    assert.equal(await api.status('GET', '/api/begleiter/einstellung'), 403);
    assert.equal(await p.api().status('GET', '/api/ich'), 401, 'ohne Anmeldung');
    // Ausbilderin und Super-Admin sehen nichts vom privaten Bereich des Azubis
    const petra = await p.api().als(PETRA);
    for (const pfad of ['/api/lernen', '/api/planer', '/api/begleiter', '/api/begleiter/erinnerungen']) assert.equal(await petra.status('GET', pfad), 403, pfad);
    const chef = await p.api().alsAdmin();
    for (const pfad of ['/api/lernen', '/api/planer', '/api/begleiter', `/api/azubis/${g.anna}/berichte`]) assert.equal(await chef.status('GET', pfad), 403, pfad);

    // abmelden führt zur Anmeldeseite; die alte Sitzung gilt nicht mehr
    await s.goto(`${p.url}/`);
    await s.click('.menue.ich .menue-knopf');
    await s.click('button:has-text("Abmelden"), a:has-text("Abmelden")');
    await s.waitForSelector('summary:has-text("Entwicklung")');
    await s.goto(`${p.url}/berichtsheft`);
    await s.waitForSelector('summary:has-text("Entwicklung")');
    assert.deepEqual(p.probleme, [], 'keine Fehler in der Konsole');
  }),
);
