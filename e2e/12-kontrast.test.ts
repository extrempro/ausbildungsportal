import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ADMIN, ANNA, inTagen, mitFoto, montagVon, oeffne, PETRA, startePortal } from './hilfe';
import type { Grunddaten, Portal } from './hilfe';

/**
 * WCAG 1.4.3: Text hat mindestens 4,5 : 1 Kontrast zu seinem Hintergrund (große Schrift 3 : 1) – hell und dunkel.
 * Ohne Fremdwerkzeug: Für jedes sichtbare Element mit eigenem Text wird die Farbe gegen den zusammengesetzten
 * Hintergrund (halbdurchsichtige Flächen übereinander) gerechnet. Bilder und Verläufe als Hintergrund werden übersprungen.
 */
let p: Portal;
let g: Grunddaten;
before(async () => {
  p = await startePortal();
  g = await p.grunddaten();
  // getönte Karten, auf denen es am knappsten wird: Firmentermin, Prüfung, Einsatz, Lernpunkt („In Arbeit“ mit Notiz)
  const petra = await p.api().als(PETRA);
  await petra.ruf('PUT', `/api/azubis/${g.anna}/profil`, { ausbildungsbeginn: inTagen(-400), berufId: g.beruf, ausbilderId: g.petra, urlaubstage: 30, planerFrei: true, pruefungen: [{ bezeichnung: 'Abschlussprüfung Teil 1', datum: inTagen(10) }] });
  await petra.ruf('POST', '/api/stammdaten/firmentermine', { titel: 'Betriebsversammlung', von: inTagen(2) });
  await petra.ruf('POST', `/api/azubis/${g.anna}/plan`, { art: 'einsatz', von: montagVon(inTagen(0)), bis: montagVon(inTagen(7)), titel: 'Lager und Versand', text: 'Wareneingang' });
  await petra.ruf('POST', `/api/azubis/${g.anna}/plan`, { art: 'aufgabe', von: montagVon(inTagen(0)), bis: montagVon(inTagen(0)), titel: 'Inventurliste prüfen', text: '' });
  const anna = await p.api().als(ANNA);
  await anna.ruf('PATCH', '/api/lernen/unterthema/grundlagen.ablauf', { status: 'gelb', luecke: 'noch einmal üben' });
});
after(() => p.stop());

const PRUEFE = `(() => {
  const rgba = (s) => { const m = /rgba?\\(([^)]+)\\)/.exec(s); if (!m) return null; const v = m[1].split(/[\\s,\\/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v[3] === undefined ? 1 : v[3]]; };
  const mix = (f, b) => [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3])).concat(1);
  const lum = (c) => { const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const kontrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const sichtbar = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05 || e.classList.contains('nur-vorleser')) return false; } return true; };
  const hinter = (el) => { const stapel = []; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage && cs.backgroundImage !== 'none') return null; const c = rgba(cs.backgroundColor); if (c && c[3] > 0) { stapel.push(c); if (c[3] >= 1) break; } } let bg = rgba(getComputedStyle(document.body).backgroundColor) || [255, 255, 255, 1]; for (let i = stapel.length - 1; i >= 0; i--) bg = mix(stapel[i], bg); return bg; };
  const aus = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el instanceof SVGElement) continue;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || !sichtbar(el) || el.closest('[disabled],[aria-disabled="true"]')) continue;
    const cs = getComputedStyle(el); const fg = rgba(cs.color); const bg = hinter(el); if (!fg || !bg) continue;
    const k = kontrast(mix(fg, bg), bg); const px = parseFloat(cs.fontSize); const soll = px >= 24 || (px >= 18.66 && parseInt(cs.fontWeight) >= 700) ? 3 : 4.5;
    if (k < soll - 0.005) aus.push(el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : '') + ' „' + el.textContent.trim().slice(0, 30) + '“ ' + k.toFixed(2) + ' : 1');
  }
  return aus;
})()`;

const seiten: Record<string, (x: Grunddaten) => string[]> = {
  [ANNA]: () => ['/', '/berichtsheft', `/berichtsheft/${montagVon(inTagen(0))}`, '/urlaub', '/jahreskalender', '/lernen', '/lernen/grundlagen', '/planer', '/konto', '/handbuch'],
  [PETRA]: (x) => ['/', '/azubis', `/azubis/${x.anna}`, `/azubis/${x.anna}/plan`, '/abzeichnen', '/urlaub', '/jahreskalender', '/verwaltung/stammdaten', '/verwaltung/konten'],
  [ADMIN.name]: () => ['/verwaltung/konten', '/verwaltung/meldungen', '/verwaltung/erscheinungsbild'],
};

for (const dunkel of [false, true]) {
  test(
    `Kontrast (${dunkel ? 'dunkel' : 'hell'}): Text erreicht 4,5 : 1 (große Schrift 3 : 1) auf allen Seiten`,
    mitFoto(() => p, `kontrast-${dunkel ? 'dunkel' : 'hell'}`, async () => {
      const maengel = new Set<string>();
      for (const [wer, liste] of Object.entries(seiten)) {
        const s = await p.seite(wer, { breite: 1280, hoehe: 900, dunkel });
        for (const pfad of liste(g)) {
          await oeffne(s, p.url, pfad);
          for (const m of (await s.evaluate(PRUEFE)) as string[]) maengel.add(`${pfad}: ${m}`);
        }
        await s.context().close();
      }
      assert.deepEqual([...maengel], []);
    }),
  );
}
