import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { vergissLernpakete } from '../lernen';
import { bewerte, ihkNote, ladeDokumente, leseZahl, parseUebungssatz } from '../lernen/pruefung';
import { ladeInhalte } from '../lernen/store';
import type { Meldung } from '../lernen/typen';
import { admin, koerper, konto, ohneWechsel, ruf, sitzung, umgebung } from './hilfe';

const SATZ = `---
titel: Grundlagen und Leistung
gruppe: Zwischenprüfung
---

Rechnen mit Strom und Leistung.

## Betriebsstrom PAR 64 {#strom}
quelle: ZP 2019, U1
zu: netz.leistung

Ein Scheinwerfer mit **1000 W** hängt an 230 V. Berechne den Strom.

### Zahl
- 4,35 ± 0,03 A

### Lösung
I = P / U

1. 1000 W / 230 V
2. ≈ 4,35 A

## Leistung je Gewerk {#gewerke}

Berechne die Leistung je Gewerk.

| Gewerk | Geräte |
| --- | --- |
| Video | Scaler, Projektor |

### Zahl
- Video: 1122 ± 2 W
- IT: 253 ± 1 W

## Welche RCD? {#rcd}

Welche RCD ist für den Personenschutz geeignet?

### Auswahl
- [x] 40 A / 30 mA
- [ ] 63 A / 300 mA
- [ ] 25 A / 500 mA

## Typen mit Gleichfehlerstrom {#typen}

Welche Typen erkennen pulsierende Gleichfehlerströme?

### Auswahl
- [x] Typ A
- [x] Typ B
- [ ] Typ AC

## Geräte zuordnen {#zuordnen}

Ordne die Geräte den Gewerken zu.

### Zuordnung
- Scaler → Video
- Projektor → Video
- Switch → IT
`;

const PDF = '%PDF-1.4\n% Testdatei\n';

function paket(): string {
  const dir = mkdtempSync(join(tmpdir(), 'pruef-'));
  const p = join(dir, 'vt');
  for (const d of ['themen', 'pruefung', 'dokumente']) mkdirSync(join(p, d), { recursive: true });
  writeFileSync(join(p, 'meta.json'), JSON.stringify({ stand: '2026-11-11' }));
  writeFileSync(join(p, 'themenfelder.json'), JSON.stringify([{ id: 'netz', lernfelder: [], pruefung: [] }]));
  writeFileSync(join(p, 'themen', 'netz.md'), '---\ntitel: Netz\n---\n\nStrom.\n\n## Leistung {#leistung}\n\n### Merksatz\nP = U · I\n');
  writeFileSync(join(p, 'pruefung', 'zp-1.md'), SATZ);
  writeFileSync(join(p, 'pruefung', 'zp-probe.md'), '---\ntitel: Probetest\ngruppe: Zwischenprüfung\numfasst: zp-1\n---\n\nAlle Fragen.\n');
  writeFileSync(join(p, 'dokumente', 'zp-2024-aufgaben.pdf'), PDF);
  writeFileSync(join(p, 'dokumente', 'zp-2024-loesungen.pdf'), PDF);
  writeFileSync(
    join(p, 'dokumente.json'),
    JSON.stringify([
      { datei: 'zp-2024-aufgaben.pdf', titel: 'Schriftliche Aufgaben', gruppe: 'Zwischenprüfung 2024' },
      { datei: 'zp-2024-loesungen.pdf', titel: 'Lösungsvorschläge', gruppe: 'Zwischenprüfung 2024', nurBetreuung: true },
    ]),
  );
  return dir;
}

test('Übungssatz: alle Antwortarten werden gelesen', () => {
  const { satz, meldungen } = parseUebungssatz(SATZ, 'zp-1', 'pruefung/zp-1.md');
  assert.deepEqual(meldungen, []);
  assert.equal(satz.titel, 'Grundlagen und Leistung');
  assert.equal(satz.gruppe, 'Zwischenprüfung');
  assert.equal(satz.fragen.length, 5);
  const [strom, gewerke, rcd, typen, zuordnen] = satz.fragen;
  assert.equal(strom.schluessel, 'zp-1.strom');
  assert.equal(strom.quelle, 'ZP 2019, U1');
  assert.deepEqual(strom.zu, ['netz.leistung']);
  assert.deepEqual(strom.felder, [{ text: '', wert: 4.35, toleranz: 0.03, einheit: 'A' }]);
  assert.deepEqual(strom.loesung, { absaetze: ['I = P / U'], schritte: ['1000 W / 230 V', '≈ 4,35 A'] });
  assert.equal(gewerke.felder.length, 2);
  assert.equal(gewerke.felder[1].text, 'IT');
  assert.equal(gewerke.tabelle?.zeilen.length, 1);
  assert.equal(rcd.mehrfach, false);
  assert.equal(typen.mehrfach, true);
  assert.deepEqual(zuordnen.paare.map((x) => x.rechts), ['Video', 'Video', 'IT']);
});

test('Übungssatz: Fehler mit Datei und Zeile', () => {
  const kaputt = `---\ntitel: Kaputt\n---\n\n## Ohne Antwort {#a}\n\nText.\n\n## Doppelt {#a}\n\nText.\n\n### Auswahl\n- [x] eins\n- [ ] zwei\n\n## Falsches Format {#b}\n\nText.\n\n### Zahl\n- viel\n\n### Notiz\nGibt es nicht.\n\n## Nur eine Option {#c}\n\nText.\n\n### Auswahl\n- [ ] einzig\n`;
  const { meldungen } = parseUebungssatz(kaputt, 'x', 'pruefung/x.md');
  const texte = meldungen.map((m) => `${m.zeile}: ${m.text}`);
  assert.ok(texte.some((t) => t.startsWith('5:') && t.includes('genau einen Abschnitt')), texte.join('\n'));
  assert.ok(texte.some((t) => t.includes('Kennung "a" kommt doppelt')));
  assert.ok(texte.some((t) => t.includes('Zahl nicht im Format')));
  assert.ok(texte.some((t) => t.includes('Unbekannte Überschrift "### Notiz"')));
  assert.ok(texte.some((t) => t.includes('mindestens zwei Antworten')));
  assert.ok(texte.some((t) => t.includes('keine Antwort mit [x]')));
});

test('Bewertung: Toleranz, Komma, Teilpunkte, Note', () => {
  const { satz } = parseUebungssatz(SATZ, 'zp-1', 'x');
  const [strom, gewerke, rcd, typen, zuordnen] = satz.fragen;
  assert.equal(leseZahl('4,35 A'), 4.35);
  assert.equal(leseZahl(' 4.168,8 '), 4168.8);
  assert.equal(leseZahl('A'), null);
  assert.equal(leseZahl('1.000'), 1000);
  assert.equal(leseZahl('65.536 Stufen'), 65536);
  assert.equal(leseZahl('4.35'), 4.35);
  assert.equal(leseZahl('0.033'), 0.033);
  assert.equal(leseZahl('-3,5'), -3.5);
  // im Inhalt gilt die deutsche Schreibweise: Punkt = Tausender
  const gross = parseUebungssatz('---\ntitel: T\n---\n\n## G {#g}\n\nText.\n\n### Zahl\n- 1.000 ± 0 kg\n- Wert: 4.168,8 ± 0,5 W\n', 'g', 'x').satz.fragen[0];
  assert.deepEqual(gross.felder.map((f) => [f.wert, f.toleranz]), [[1000, 0], [4168.8, 0.5]]);
  assert.equal(bewerte(gross, ['1000', '4.168,8']), 1);
  assert.equal(bewerte(strom, ['4,37']), 1);
  assert.equal(bewerte(strom, ['4.40']), 0);
  assert.equal(bewerte(strom, 'unsinn'), 0);
  assert.equal(bewerte(gewerke, ['1121', '260']), 0.5);
  assert.equal(bewerte(rcd, [0]), 1);
  assert.equal(bewerte(rcd, [0, 1]), 0);
  assert.equal(bewerte(typen, [0, 1]), 1);
  assert.equal(bewerte(typen, [0]), 0.5);
  assert.equal(bewerte(typen, [0, 2]), 0);
  assert.equal(bewerte(typen, [0, 1, 2]), 0.5);
  assert.equal(bewerte(typen, [7, -1, 'x']), 0);
  assert.equal(bewerte(zuordnen, ['Video', 'IT', 'IT']), 2 / 3);
  assert.deepEqual([92, 81, 67, 50, 49, 29].map((p) => ihkNote(p).note), [1, 2, 3, 4, 5, 6]);
});

test('Unterlagen: fehlende Datei, kein PDF, nicht gelistet, ungültiger Name', () => {
  const dir = paket();
  const p = join(dir, 'vt');
  writeFileSync(join(p, 'dokumente', 'falsch.pdf'), 'kein pdf');
  writeFileSync(join(p, 'dokumente', 'vergessen.pdf'), PDF);
  writeFileSync(
    join(p, 'dokumente.json'),
    JSON.stringify([
      { datei: 'zp-2024-aufgaben.pdf', titel: 'Aufgaben' },
      { datei: 'fehlt.pdf', titel: 'Fehlt' },
      { datei: 'falsch.pdf', titel: 'Falsch' },
      { datei: '../geheim.pdf', titel: 'Ausbruch' },
      { datei: 'zp-2024-loesungen.pdf', titel: 'Lösungen', nurBetreuung: true },
    ]),
  );
  const meldungen: Meldung[] = [];
  const docs = ladeDokumente(p, meldungen);
  assert.deepEqual(docs.map((d) => [d.datei, d.nurBetreuung]), [['zp-2024-aufgaben.pdf', false], ['zp-2024-loesungen.pdf', true]]);
  const texte = meldungen.map((m) => `${m.level} ${m.datei} ${m.text}`);
  assert.ok(texte.some((t) => t.startsWith('fehler dokumente/fehlt.pdf Datei fehlt')));
  assert.ok(texte.some((t) => t.startsWith('fehler dokumente/falsch.pdf Das ist keine PDF-Datei')));
  assert.ok(texte.some((t) => t.includes('"../geheim.pdf": Dateiname')));
  assert.ok(texte.some((t) => t.startsWith('warnung dokumente/vergessen.pdf')));
});

test('Paket: Probetest sammelt die Fragen, reservierte Kennung, fehlendes Unterthema', () => {
  const dir = paket();
  const p = join(dir, 'vt');
  writeFileSync(join(p, 'themenfelder.json'), JSON.stringify([{ id: 'netz' }, { id: 'pruefung' }]));
  writeFileSync(join(p, 'pruefung', 'zp-2.md'), '---\ntitel: Zwei\n---\n\n## F {#f}\nzu: netz.gibtsnicht\n\nText.\n\n### Auswahl\n- [x] a\n- [ ] b\n');
  const i = ladeInhalte(p);
  assert.deepEqual(i.pruefung.map((s) => [s.id, s.fragen.length]), [['zp-1', 5], ['zp-2', 1], ['zp-probe', 5]]);
  assert.ok(i.meldungen.some((m) => m.text.includes('"pruefung" ist für eine Seite des Lernmoduls reserviert')));
  assert.ok(i.meldungen.some((m) => m.level === 'warnung' && m.text.includes('"zu: netz.gibtsnicht"')));
  assert.equal(i.dokumente.length, 2);
});

async function welt() {
  vergissLernpakete();
  const u = await umgebung({ LERN_DIR: paket() });
  ohneWechsel(u.db, admin(u.db).id);
  const ausbilder = konto(u.db, 'ausbilder', 'Petra');
  const bea = konto(u.db, 'beauftragter', 'Bea');
  const anna = konto(u.db, 'azubi', 'Anna');
  const ben = konto(u.db, 'azubi', 'Ben');
  const c = sitzung(u, ausbilder);
  const beruf = koerper(await ruf(u, 'POST', '/api/stammdaten/berufe', { cookies: c, body: { bezeichnung: 'Fachkraft für Veranstaltungstechnik', fachrichtung: '', regeldauerMonate: 36, lernpaket: 'vt' } })).beruf.id as number;
  assert.equal((await ruf(u, 'PUT', `/api/azubis/${anna.id}/profil`, { cookies: c, body: { ausbildungsbeginn: '2025-08-01', berufId: beruf, ausbilderId: ausbilder.id } })).status, 200);
  return { u, ausbilder, bea, anna, ben };
}

test('Azubi: Übersicht ohne Lösungs-PDF, Übungssatz ohne Lösungen, Auswertung mit Lösungen und Stand', async () => {
  const { u, anna, ben } = await welt();
  const c = sitzung(u, anna);
  const ueb = koerper(await ruf(u, 'GET', '/api/lernen/pruefung', { cookies: c }));
  assert.deepEqual(ueb.saetze.map((s: { id: string; fragen: number; probetest: boolean }) => [s.id, s.fragen, s.probetest]), [['zp-1', 5, false], ['zp-probe', 5, true]]);
  assert.deepEqual(ueb.dokumente.map((d: { datei: string }) => d.datei), ['zp-2024-aufgaben.pdf']);
  assert.equal(ueb.saetze[0].stand, null);

  const satz = koerper(await ruf(u, 'GET', '/api/lernen/pruefung/zp-1', { cookies: c }));
  const json = JSON.stringify(satz);
  for (const verboten of ['loesung', 'richtig', 'wert', 'toleranz', '4,35 A', '4.35']) assert.ok(!json.includes(verboten), `verrät ${verboten}`);
  const rcd = satz.fragen.find((f: { schluessel: string }) => f.schluessel === 'zp-1.rcd');
  assert.equal(rcd.optionen.length, 3);
  const nr30 = rcd.optionen.find((o: { text: string }) => o.text === '40 A / 30 mA').nr;

  const antworten = { 'zp-1.strom': ['4,35'], 'zp-1.gewerke': ['1122', '0'], 'zp-1.rcd': [nr30], 'zp-1.zuordnen': ['Video', 'Video', 'IT'] };
  const r = await ruf(u, 'POST', '/api/lernen/pruefung/zp-1', { cookies: c, body: { antworten } });
  assert.equal(r.status, 200);
  const e = koerper(r);
  assert.equal(e.punkte, 3.5);
  assert.equal(e.gesamt, 5);
  assert.equal(e.prozent, 70);
  assert.deepEqual(e.note, { note: 3, text: 'befriedigend' });
  const typen = e.ergebnisse.find((x: { schluessel: string }) => x.schluessel === 'zp-1.typen');
  assert.equal(typen.anteil, 0);
  assert.deepEqual(typen.richtig, [0, 1]);
  assert.equal(e.ergebnisse[0].loesung.schritte.length, 2);

  // schlechterer zweiter Versuch: die beste Quote bleibt
  await ruf(u, 'POST', '/api/lernen/pruefung/zp-1', { cookies: c, body: { antworten: {} } });
  const nachher = koerper(await ruf(u, 'GET', '/api/lernen/pruefung', { cookies: c })).saetze[0].stand;
  assert.deepEqual([nachher.versuche, nachher.punkte, nachher.besteProzent], [2, 0, 70]);
  // privat: Ben (ohne Lernmodul) sieht nichts, auch nicht Annas Stand
  assert.equal((await ruf(u, 'GET', '/api/lernen/pruefung', { cookies: sitzung(u, ben) })).status, 404);

  assert.equal((await ruf(u, 'POST', '/api/lernen/pruefung/zp-1', { cookies: c, body: { antworten: [] } })).status, 400);
  assert.equal((await ruf(u, 'GET', '/api/lernen/pruefung/gibtsnicht', { cookies: c })).status, 404);
});

test('Unterlagen: Azubi lädt Aufgaben, aber keine Lösungen; Betreuung lädt beides', async () => {
  const { u, anna, ausbilder, bea } = await welt();
  const a = await ruf(u, 'GET', '/api/lernen/dokument/zp-2024-aufgaben.pdf', { cookies: sitzung(u, anna) });
  assert.equal(a.status, 200);
  assert.equal(a.datei?.typ, 'application/pdf');
  assert.equal(a.datei?.dateiname, 'Zwischenprüfung 2024 – Schriftliche Aufgaben.pdf');
  assert.ok(a.datei?.inhalt.toString('latin1').startsWith('%PDF-'));
  assert.equal((await ruf(u, 'GET', '/api/lernen/dokument/zp-2024-loesungen.pdf', { cookies: sitzung(u, anna) })).status, 404);
  assert.equal((await ruf(u, 'GET', '/api/lernen/dokument/..%2Fmeta.json', { cookies: sitzung(u, anna) })).status, 404);
  for (const wer of [ausbilder, bea]) {
    const c = sitzung(u, wer);
    const ueb = koerper(await ruf(u, 'GET', '/api/lerninhalte/vt/pruefung', { cookies: c }));
    assert.deepEqual(ueb.dokumente.map((d: { datei: string; nurBetreuung: boolean }) => [d.datei, d.nurBetreuung]), [['zp-2024-aufgaben.pdf', false], ['zp-2024-loesungen.pdf', true]]);
    assert.equal((await ruf(u, 'GET', '/api/lerninhalte/vt/dokument/zp-2024-loesungen.pdf', { cookies: c })).status, 200);
    const satz = koerper(await ruf(u, 'GET', '/api/lerninhalte/vt/pruefung/zp-1', { cookies: c }));
    assert.deepEqual(satz.fragen[0].werte, [{ wert: 4.35, toleranz: 0.03 }]);
    assert.equal(satz.fragen[0].loesung.schritte.length, 2);
  }
});
