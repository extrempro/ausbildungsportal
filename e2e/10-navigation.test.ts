import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ADMIN, ANNA, BEA, HANDY, mitFoto, oeffne, PETRA, startePortal, ueberlauf } from './hilfe';
import type { Portal } from './hilfe';
import type { Page } from 'playwright';

/** docs/bedienregeln.md, „Navigation ist überall gleich“ */
let p: Portal;
let anna = 0;
before(async () => {
  p = await startePortal();
  anna = (await p.grunddaten()).anna;
});
after(() => p.stop());

const ziele = (s: Page, sel: string) => s.locator(sel).evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? '').filter(Boolean));
const sortiert = (a: string[]) => [...new Set(a)].sort();

/** Alle Ziele der Navigation am PC: Hauptleiste, die Gruppen und das Menü am Namen */
async function amPc(s: Page): Promise<string[]> {
  const alle = await ziele(s, '.haupt-nav > a');
  for (const knopf of await s.locator('.haupt-nav .menue-knopf').all()) {
    await knopf.click();
    alle.push(...(await ziele(s, '.haupt-nav .menue-flaeche a')));
    await knopf.click();
  }
  await s.click('button[aria-label^="Menü für"]');
  alle.push(...(await ziele(s, '#menue-ich a')));
  await s.keyboard.press('Escape');
  return sortiert(alle);
}
/** … und am Handy oder Tablet: Leiste unten und „Mehr“ */
async function unten(s: Page): Promise<string[]> {
  const alle = await ziele(s, '.tabs a');
  await s.click('.tabs button:has-text("Mehr")');
  alle.push(...(await ziele(s, '#menue-mehr a')));
  await s.keyboard.press('Escape');
  return sortiert(alle);
}

test(
  'Navigation: jede Rolle erreicht am PC, am Tablet und am Handy dieselben Bereiche',
  mitFoto(() => p, 'navigation', async () => {
    for (const wer of [ANNA, PETRA, BEA, ADMIN.name]) {
      const pc = await p.seite(wer, { breite: 1280, hoehe: 900 });
      await oeffne(pc, p.url, '/konto');
      const soll = await amPc(pc);
      assert.ok(soll.length >= 6, `${wer}: zu wenige Ziele (${soll.join(', ')})`);
      for (const [geraet, groesse] of [['Tablet', { breite: 820, hoehe: 1100 }], ['Handy', HANDY]] as const) {
        const s = await p.seite(wer, groesse);
        await oeffne(s, p.url, '/konto');
        assert.deepEqual(await unten(s), soll, `${wer} am ${geraet}`);
        await s.context().close();
      }
      await pc.context().close();
    }
    assert.deepEqual(p.probleme, []);
  }),
);

test(
  'Navigation: Zahlen stehen auch in Menüs und am Knopf davor',
  mitFoto(() => p, 'navigation-zahl', async () => {
    await p.api().als(ANNA).then((a) => a.ruf('POST', '/api/fehlermeldungen', { art: 'inhalt', thema: 'lernen|grundlagen|', text: 'Bitte ein Beispiel mehr zu diesem Thema.' }));
    const pc = await p.seite(PETRA, { breite: 1280, hoehe: 900 });
    await oeffne(pc, p.url, '/');
    const verwaltung = pc.locator('.haupt-nav .menue-knopf:has-text("Verwaltung")');
    assert.equal((await verwaltung.locator('.nav-zahl').textContent())?.trim(), '1');
    await verwaltung.click();
    assert.equal((await pc.locator('#menue-verwaltung a:has-text("Rückmeldungen") .nav-zahl').textContent())?.trim(), '1');

    const handy = await p.seite(PETRA, HANDY);
    await oeffne(handy, p.url, '/');
    assert.equal((await handy.locator('.tabs button:has-text("Mehr") .nav-zahl').textContent())?.trim(), '1');
    await handy.click('.tabs button:has-text("Mehr")');
    assert.equal((await handy.locator('#menue-mehr a:has-text("Rückmeldungen") .nav-zahl').textContent())?.trim(), '1');
    assert.deepEqual(p.probleme, []);
  }),
);

test(
  'Navigation: eine Grenze bei 1024 px für Leiste unten und die Seiten-Navigation „Inhalt“',
  mitFoto(() => p, 'navigation-grenze', async () => {
    for (const [breite, schmal] of [[1023, true], [1024, false]] as const) {
      const s = await p.seite(ANNA, { breite, hoehe: 900 });
      for (const pfad of ['/lernen/grundlagen', '/handbuch', '/']) {
        await oeffne(s, p.url, pfad);
        const leisteUnten = await s.locator('.tabs').isVisible();
        const zeile = await s.locator('.lern-navi-klapp, details.handbuch-inhalt').first().isVisible();
        const seitenleiste = await s.locator('aside.lern-navi, nav.handbuch-inhalt, aside.plan-seite').first().isVisible();
        assert.deepEqual({ leisteUnten, zeile, seitenleiste }, { leisteUnten: schmal, zeile: schmal, seitenleiste: !schmal }, `${pfad} bei ${breite} px`);
        assert.match((await s.locator(schmal ? '.lern-navi-klapp summary, details.handbuch-inhalt summary' : 'aside.lern-navi h2, nav.handbuch-inhalt h2, aside.plan-seite h2').first().textContent()) ?? '', /^Inhalt/);
      }
      await s.context().close();
    }
  }),
);

test(
  'Navigation: Reiter zwischen den Seiten eines Azubis, Zurück-Link zur Liste',
  mitFoto(() => p, 'navigation-reiter', async () => {
    for (const groesse of [{ breite: 1280, hoehe: 900 }, HANDY]) {
      const s = await p.seite(PETRA, groesse);
      await oeffne(s, p.url, `/azubis/${anna}/plan`);
      const reiter = s.locator('nav.reiter a');
      assert.deepEqual(await reiter.allTextContents(), ['Profil', 'Ausbildungsplan', 'Berichtsheft', 'Urlaub']);
      assert.equal(await s.locator('nav.reiter a[aria-current="page"]').textContent(), 'Ausbildungsplan');
      for (const [text, pfad] of [['Berichtsheft', `/azubis/${anna}/berichtsheft`], ['Urlaub', `/azubis/${anna}/urlaub`], ['Profil', `/azubis/${anna}`]] as const) {
        await s.click(`nav.reiter a:has-text("${text}")`);
        await s.waitForURL(p.url + pfad);
        await s.locator('main h1').waitFor();
        assert.equal(await s.locator('nav.reiter a[aria-current="page"]').textContent(), text);
        assert.equal(await s.locator('main a:has-text("← Alle Azubis")').count(), 1);
      }
      await s.context().close();
    }
    assert.deepEqual(p.probleme, []);
  }),
);

test(
  'Navigation: Ausbildungsplan mit „Inhalt“ – am PC einklappbar, am Handy als Zeile mit den Farben',
  mitFoto(() => p, 'navigation-plan', async () => {
    const pc = await p.seite(ANNA, { breite: 1280, hoehe: 900 });
    await oeffne(pc, p.url, '/');
    await pc.click('aside.plan-seite button[aria-label="Inhalt einklappen"]');
    assert.deepEqual(await pc.locator('aside.plan-seite .lern-navi-nr').allTextContents(), ['1', '2', '3']);
    await pc.click('aside.plan-seite button[aria-label="Inhalt ausklappen"]');
    await pc.locator('aside.plan-seite .kompass').waitFor();
    await pc.context().close();

    const h = await p.seite(ANNA, HANDY);
    await oeffne(h, p.url, '/');
    assert.equal(await h.locator('.plan-wochen > .plan-legende').isVisible(), false, 'die Legende steht in „Inhalt“');
    assert.match((await h.locator('.plan-inhalt summary').textContent()) ?? '', /Inhalt.*Ausbildungsjahr · KW \d+/);
    await h.click('.plan-inhalt summary');
    assert.equal(await h.locator('.plan-inhalt .plan-inhalt-legende').isVisible(), true);
    await h.click('.plan-inhalt button:has-text("3. Ausbildungsjahr")');
    assert.equal(await h.locator('.plan-inhalt[open]').count(), 0, 'klappt nach der Auswahl zu');
    // das Rollen dauert einen Moment
    for (let i = 0; i < 25 && !/^3\. Ausbildungsjahr/.test((await h.locator('.plan-inhalt .handbuch-wo').textContent()) ?? ''); i++) await h.waitForTimeout(200);
    assert.match((await h.locator('.plan-inhalt .handbuch-wo').textContent()) ?? '', /^3\. Ausbildungsjahr/);
    assert.equal(await ueberlauf(h), 0);
    assert.deepEqual(p.probleme, []);
  }),
);
