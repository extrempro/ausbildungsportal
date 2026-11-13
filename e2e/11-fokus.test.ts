import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ANNA, HANDY, inTagen, mitFoto, montagVon, oeffne, PETRA, startePortal } from './hilfe';
import type { Portal } from './hilfe';
import type { Page } from 'playwright';

/** WCAG 2.4.3 und 2.4.11 – Bedienung mit der Tastatur (docs/bedienregeln.md, „Tastatur“) */
let p: Portal;
before(async () => {
  p = await startePortal();
  await p.grunddaten();
});
after(() => p.stop());

/** Steht das fokussierte Element ganz unter einer angehefteten Leiste? */
const verdeckt = (s: Page) =>
  s.evaluate(`(() => { const el = document.activeElement; if (!el || el === document.body) return null; const r = el.getBoundingClientRect(); if (r.width === 0) return null;
    const pts = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 2, r.top + 2], [r.right - 2, r.bottom - 2]].filter(([x, y]) => y >= 0 && y < innerHeight && x >= 0 && x < innerWidth);
    if (!pts.length) return 'außerhalb: ' + el.tagName;
    const zu = pts.filter(([x, y]) => { const t = document.elementFromPoint(x, y); return t && !(t === el || el.contains(t) || t.contains(el)); });
    return zu.length === pts.length ? el.tagName + ' „' + (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30) + '“' : null; })()`) as Promise<string | null>;

test(
  'Tastatur: Angeheftete Leisten verdecken nie das Element mit dem Fokus (PC, Tablet, Handy)',
  mitFoto(() => p, 'fokus-verdeckt', async () => {
    const maengel: string[] = [];
    for (const groesse of [{ breite: 1280, hoehe: 800 }, { breite: 820, hoehe: 1000 }, HANDY]) {
      for (const [wer, pfad] of [[ANNA, '/'], [ANNA, `/berichtsheft/${montagVon(inTagen(0))}`], [ANNA, '/lernen/grundlagen'], [PETRA, '/verwaltung/stammdaten']] as const) {
        const s = await p.seite(wer, groesse);
        await oeffne(s, p.url, pfad);
        for (let i = 0; i < 80; i++) {
          await s.keyboard.press(i % 7 === 6 ? 'Shift+Tab' : 'Tab');
          await s.waitForTimeout(25);
          const v = await verdeckt(s);
          if (v) maengel.push(`${groesse.breite} px ${pfad}: ${v}`);
        }
        await s.context().close();
      }
    }
    assert.deepEqual([...new Set(maengel)], []);
  }),
);

test(
  'Tastatur: Fenster holen den Fokus, halten ihn bei Tab und geben ihn beim Schließen zurück',
  mitFoto(() => p, 'fokus-fenster', async () => {
    const imFenster = (s: Page) => s.evaluate(`!!document.activeElement.closest('[role=dialog],[role=alertdialog]')`) as Promise<boolean>;
    const pruefe = async (s: Page, name: string, knopf: string) => {
      await s.locator(knopf).first().focus();
      await s.keyboard.press('Enter');
      await s.waitForSelector('[role=dialog]');
      await s.waitForTimeout(100);
      assert.equal(await imFenster(s), true, `${name}: Fokus beim Öffnen im Fenster`);
      for (let i = 0; i < 25; i++) {
        await s.keyboard.press(i % 4 === 3 ? 'Shift+Tab' : 'Tab');
        assert.equal(await imFenster(s), true, `${name}: Tab bleibt im Fenster (Schritt ${i + 1})`);
      }
      await s.keyboard.press('Escape');
      await s.waitForSelector('[role=dialog]', { state: 'detached' });
      assert.equal(await s.locator(knopf).first().evaluate((el) => el === document.activeElement), true, `${name}: Fokus zurück am Knopf`);
    };
    const pc = await p.seite(ANNA, { breite: 1280, hoehe: 800 });
    await oeffne(pc, p.url, '/');
    await pruefe(pc, 'Rückmeldung geben', 'button[aria-label="Rückmeldung geben"]');
    await pruefe(pc, 'Neuer Eintrag', 'button:has-text("+ Eintrag")');
    const handy = await p.seite(ANNA, HANDY);
    await oeffne(handy, p.url, '/');
    await pruefe(handy, 'Mehr', '.tabs button:has-text("Mehr")');
    assert.deepEqual(p.probleme, []);
  }),
);
