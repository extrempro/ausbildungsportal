import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { HANDY, PC, PETRA, mitFoto, oeffne, startePortal } from './hilfe';
import type { Portal } from './hilfe';
import type { Page } from 'playwright';

/**
 * Rückmeldungen sind immer zu sehen – PC, Tablet, Handy (src/fokusFrei.ts, docs/bedienregeln.md).
 * Auf einer langen Seite steht das Formular unten, die Rückmeldung oben: Nach dem Absenden muss sie im Bild stehen,
 * frei von angehefteten Leisten.
 */
let p: Portal;
before(async () => {
  p = await startePortal();
  await p.grunddaten();
  // viele Konten machen die Seite lang
  const petra = await p.api().als(PETRA);
  for (let i = 1; i <= 25; i++) await petra.ruf('POST', '/api/konten', { rolle: 'azubi', anmeldename: `muster${i}@firma.test`, anzeigename: `Muster Azubi ${i}` });
});
after(() => p.stop());

/** Steht das Element ganz im Bild und liegt keine angeheftete Leiste darüber? */
const frei = (s: Page, sel: string) =>
  s.locator(sel).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) return `nicht im Bild (oben ${Math.round(r.top)}, unten ${Math.round(r.bottom)}, Fenster ${window.innerHeight})`;
    for (const y of [r.top + 4, r.bottom - 4]) {
      const oben = document.elementFromPoint(r.left + r.width / 2, y);
      if (!oben || !(el.contains(oben) || oben.contains(el))) return `verdeckt von ${oben?.className || oben?.tagName}`;
    }
    return 'frei';
  });

for (const [name, groesse] of [
  ['PC', PC],
  ['Tablet', { breite: 820, hoehe: 1100 }],
  ['Handy', HANDY],
] as const) {
  test(
    `Rückmeldung sichtbar (${name}): Bestätigung und Fehler oben erscheinen im Bild, auch wenn das Formular unten steht`,
    mitFoto(() => p, `rueckmeldung-sichtbar-${name}`, async () => {
      const s = await p.seite(PETRA, groesse);
      await oeffne(s, p.url, '/verwaltung/konten');
      const anlegen = async (anmeldename: string) => {
        await s.locator('form:has(input[name=anzeigename]) input[name=anmeldename]').scrollIntoViewIfNeeded();
        await s.fill('form:has(input[name=anzeigename]) input[name=anmeldename]', anmeldename);
        await s.fill('input[name=anzeigename]', 'Neu Azubi');
        await s.click('button:has-text("Konto anlegen")');
      };
      // Bestätigung an der Stelle (oben auf der Seite)
      await anlegen(`neu-${name.toLowerCase()}@firma.test`);
      await s.locator('.hinweis.gut[role=status]').waitFor();
      await s.waitForTimeout(150);
      assert.equal(await frei(s, '.hinweis.gut[role=status]'), 'frei', 'die Bestätigung steht im Bild');

      // Fehler an der Stelle: dasselbe Konto noch einmal
      await anlegen(`neu-${name.toLowerCase()}@firma.test`);
      await s.locator('.hinweis.fehler[role=alert]').waitFor();
      await s.waitForTimeout(150);
      assert.equal(await frei(s, '.hinweis.fehler[role=alert]'), 'frei', 'der Fehler steht im Bild');
      await s.close();
    }),
  );
}

test(
  'Rückmeldung sichtbar: Beim Öffnen einer Seite springt nichts',
  mitFoto(() => p, 'rueckmeldung-oeffnen', async () => {
    const s = await p.seite(PETRA, PC);
    await oeffne(s, p.url, '/verwaltung/konten');
    assert.equal(await s.evaluate(() => window.scrollY), 0, 'die Seite beginnt oben');
    await s.close();
  }),
);
