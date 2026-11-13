import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ADMIN, ANNA, BEA, HANDY, inTagen, mitFoto, montagVon, oeffne, PETRA, startePortal, text, ueberlauf } from './hilfe';
import type { Grunddaten, Portal } from './hilfe';

let p: Portal;
let g: Grunddaten;
before(async () => {
  p = await startePortal();
  g = await p.grunddaten();
  // etwas Inhalt, damit die Seiten nicht leer sind: ein Planeintrag, ein Urlaubsantrag, ein Firmentermin
  const petra = await p.api().als(PETRA);
  const montag = montagVon(inTagen(0));
  await petra.ruf('POST', `/api/azubis/${g.anna}/plan`, { art: 'einsatz', von: montag, bis: montag, titel: 'Lager und Versand – eine Abteilung mit einem ziemlich langen Namen', text: 'Wareneingang, Kommissionierung, Versand' });
  await petra.ruf('POST', '/api/stammdaten/firmentermine', { titel: 'Betriebsversammlung mit anschließendem Sommerfest', von: inTagen(3) });
  const anna = await p.api().als(ANNA);
  const von = montagVon(inTagen(60));
  await anna.ruf('POST', `/api/azubis/${g.anna}/urlaub`, { von, bis: von, bemerkung: 'Umzug' });
});
after(() => p.stop());

const seiten: Record<string, (g: Grunddaten) => string[]> = {
  [ANNA]: () => ['/', '/berichtsheft', `/berichtsheft/${montagVon(inTagen(-7))}`, '/urlaub', '/jahreskalender', '/lernen', '/lernen/grundlagen', '/lernen/kompendium', '/lernen/ueben', '/planer', '/konto', '/handbuch', '/versionen'],
  [PETRA]: (x) => ['/', '/azubis', `/azubis/${x.anna}`, `/azubis/${x.anna}/plan`, '/abzeichnen', '/urlaub', '/jahreskalender', '/planung/sammelplanung', '/planung/bausteine', '/lerninhalte', '/lerninhalte/muster/grundlagen', '/rueckmeldungen', '/verwaltung/stammdaten', '/verwaltung/konten', '/konto', '/handbuch'],
  [BEA]: (x) => ['/', '/azubis', `/azubis/${x.anna}`, '/abzeichnen', '/urlaub', '/jahreskalender', '/lerninhalte', '/konto', '/handbuch'],
  [ADMIN.name]: () => ['/verwaltung/konten', '/verwaltung/protokoll', '/verwaltung/meldungen', '/verwaltung/lerninhalte', '/verwaltung/erscheinungsbild', '/konto', '/handbuch'],
};

// 320 px: kleinstes übliches Handy und zugleich 400 % Zoom am PC (WCAG 1.4.10)
for (const [breite, dunkel] of [[390, false], [390, true], [320, false]] as const) {
  test(
    `Handy (${breite} px, ${dunkel ? 'dunkel' : 'hell'}): Keine Seite läuft waagerecht über, jede hat eine Überschrift, die Konsole bleibt leer`,
    mitFoto(() => p, `handy-${breite}-${dunkel ? 'dunkel' : 'hell'}`, async () => {
      const maengel: string[] = [];
      for (const [wer, liste] of Object.entries(seiten)) {
        const s = await p.seite(wer, { ...HANDY, breite, dunkel });
        for (const pfad of liste(g)) {
          await oeffne(s, p.url, pfad);
          const titel = await text(s, 'main h1');
          if (/nicht gefunden|gibt es nicht/i.test(titel)) maengel.push(`${wer} ${pfad}: Seite nicht gefunden`);
          const zuBreit = await ueberlauf(s);
          if (zuBreit > 0) maengel.push(`${wer} ${pfad}: ${zuBreit} px zu breit`);
          // nach unten gerollt darf sich daran nichts ändern (angeheftete Zeilen, breite Tabellen)
          await s.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          if ((await ueberlauf(s)) > 0 && zuBreit === 0) maengel.push(`${wer} ${pfad}: unten zu breit`);
        }
        // die Leiste unten hat höchstens fünf Punkte; der Rest steht unter „Mehr“
        const punkte = await s.locator('.tabs > a, .tabs > button').count();
        if (punkte > 5) maengel.push(`${wer}: ${punkte} Punkte in der Leiste unten`);
        await s.context().close();
      }
      assert.deepEqual(maengel, []);
      assert.deepEqual(p.probleme, [], 'keine Fehler in der Konsole');
    }),
  );
}

test(
  'Handbuch am Handy: Suchen, Kapitel antippen – das Verzeichnis klappt zu und das Kapitel steht da',
  mitFoto(() => p, 'handbuch-suche', async () => {
    const s = await p.seite(ANNA, HANDY);
    await oeffne(s, p.url, '/handbuch');
    await s.click('details.handbuch-inhalt > summary');
    await s.fill('.handbuch-suche input', 'Urlaub');
    await s.waitForTimeout(300);
    const treffer = s.locator('details.handbuch-inhalt nav li button');
    assert.ok((await treffer.count()) > 1, 'die Suche findet mehrere Kapitel');
    const ziel = (await treffer.nth(1).innerText()).replace(/\s+/g, ' ').replace(/^\d+\.\s*/, '').trim();
    await treffer.nth(1).click();
    await s.waitForTimeout(500);
    assert.equal(await s.locator('details.handbuch-inhalt[open]').count(), 0, 'das Verzeichnis ist zu');
    assert.match(await text(s, 'details.handbuch-inhalt > summary'), /Suche: „Urlaub“ · \d+ Kapitel/);
    const oben = await s.evaluate((t) => [...document.querySelectorAll('.kapitel h2')].find((x) => (x.textContent ?? '').includes(t))?.getBoundingClientRect().top ?? -1, ziel);
    assert.ok(oben >= 0 && oben < HANDY.hoehe * 0.6, `„${ziel}“ steht im Bild (bei ${Math.round(oben)} px)`);
    // die Suche lässt sich wieder öffnen, das Wort steht noch da
    await s.click('details.handbuch-inhalt > summary');
    assert.equal(await s.locator('.handbuch-suche input').inputValue(), 'Urlaub');
    assert.equal(await ueberlauf(s), 0);
  }),
);

test(
  'Handbuch: Jeder Verweis „Im Handbuch“ im Portal führt zu einem Kapitel, das es für diese Rolle gibt',
  mitFoto(() => p, 'handbuch-verweise', async () => {
    const maengel: string[] = [];
    for (const [wer, liste] of Object.entries(seiten)) {
      const s = await p.seite(wer);
      const ziele = new Set<string>();
      for (const pfad of liste(g)) {
        await oeffne(s, p.url, pfad);
        for (const h of await s.locator('main a[href^="/handbuch#kapitel-"]:visible').evaluateAll((l) => l.map((a) => a.getAttribute('href') ?? ''))) ziele.add(`${h}|${pfad}`);
      }
      await oeffne(s, p.url, '/handbuch');
      const kapitel = new Set(await s.locator('.kapitel').evaluateAll((l) => l.map((k) => k.id)));
      for (const z of ziele) {
        const [href, von] = z.split('|');
        if (!kapitel.has(href.split('#')[1])) maengel.push(`${wer} ${von}: ${href} gibt es im Handbuch dieser Rolle nicht`);
      }
      await s.context().close();
    }
    assert.deepEqual(maengel, []);
  }),
);
