import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { vergissLernpakete } from '../lernen';
import { frontmatter, parseThemaMarkdown } from '../lernen/parse';
import { maskiere } from '../lernen/ueben';
import { bereinigeSvg } from '../lernen/store';
import type { BenutzerZeile } from '../typen';
import { admin, koerper, konto, ohneWechsel, ruf, sitzung, umgebung, zuweisen } from './hilfe';

const NETZ = `---
titel: Netzwerkgrundlagen
---

Wie Daten durch ein Netz kommen.

## Subnetting {#subnetting}

### Kernbegriffe
- **Netzadresse:** Erste Adresse eines Subnetzes.
- **Broadcast:** Letzte Adresse, mit \`ping\` nicht erreichbar.

### Abbildung: Aufbau
![Ein Rahmen mit Kopf und Daten](rahmen.svg)

### Tabelle: Präfixe
| Präfix | Hosts |
| --- | --- |
| /24 | 254 |
| /26 | 62 |

### Befehle
- \`ip addr show\` – Adressen anzeigen

### Merksatz
Blockgröße = 256 − letztes Masken-Oktett.

### Prüfungsfrage
Teile 192.168.10.0/24 in 4 Subnetze.

1. 2 Bits leihen → /26
2. Blockgröße 64

## VLAN {#vlan}

## Häufige Fehler
- Netzadresse als Host vergeben.

## Zusatz: Subnetze planen {#planen}
typ: text
zu: subnetting, wiso.vertrag

Wie man ein Netz aufteilt.

Erst zählen, dann rechnen.

### Vorgehen
1. Hosts zählen
2. Präfix wählen

### Checkliste: Fertig?
- Reserve eingeplant

## Links
- [Elektronik-Kompendium](https://www.elektronik-kompendium.de/) – Erklärungen
`;

const SVG = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" onload="alert(1)"><script>alert(2)</script><rect class="sv-box" x="2" y="2" width="196" height="76"/><a href="https://boese.example"><text class="sv-t" x="10" y="40">Kopf</text></a></svg>';

/** Legt einen Ordner mit einem Inhaltspaket „fisi“ an (und einem zweiten, „leer“). */
function inhalte(netz = NETZ, stand = '2026-11-01'): string {
  const dir = mkdtempSync(join(tmpdir(), 'lern-'));
  const p = join(dir, 'fisi');
  mkdirSync(join(p, 'themen'), { recursive: true });
  mkdirSync(join(p, 'bilder'));
  writeFileSync(join(p, 'paket.json'), JSON.stringify({ titel: 'Fachinformatiker Systemintegration', quelle: 'FISI-Lernkompass', lizenz: 'CC BY-SA 4.0' }));
  writeFileSync(join(p, 'meta.json'), JSON.stringify({ stand }));
  writeFileSync(join(p, 'themenfelder.json'), JSON.stringify([{ id: 'netz', icon: 'network', lernfelder: ['LF 3'], pruefung: ['AP1'] }, { id: 'wiso', icon: 'scale', lernfelder: [], pruefung: ['AP2'] }]));
  writeFileSync(join(p, 'themen', 'netz.md'), netz);
  writeFileSync(join(p, 'themen', 'wiso.md'), '---\ntitel: Wirtschaft\n---\n\nVerträge und Recht.\n\n## Ausbildungsvertrag {#vertrag}\n\n### Merksatz\nProbezeit: 1 bis 4 Monate.\n');
  writeFileSync(join(p, 'bilder', 'rahmen.svg'), SVG);
  mkdirSync(join(dir, 'Ungültig Name')); // wird übersprungen
  mkdirSync(join(dir, 'ohne-katalog')); // kein themenfelder.json: kein Paket
  return dir;
}

async function welt(dir = inhalte()) {
  vergissLernpakete();
  const u = await umgebung({ LERN_DIR: dir });
  ohneWechsel(u.db, admin(u.db).id);
  const ausbilder = konto(u.db, 'ausbilder', 'Petra');
  const bea = konto(u.db, 'beauftragter', 'Bea');
  const anna = konto(u.db, 'azubi', 'Anna');
  const ben = konto(u.db, 'azubi', 'Ben');
  const maler = konto(u.db, 'azubi', 'Mia');
  const c = sitzung(u, ausbilder);
  const beruf = async (bezeichnung: string, lernpaket: string | null) => koerper(await ruf(u, 'POST', '/api/stammdaten/berufe', { cookies: c, body: { bezeichnung, fachrichtung: '', regeldauerMonate: 36, lernpaket } })).beruf.id as number;
  const fisi = await beruf('Fachinformatiker', 'fisi');
  const malerBeruf = await beruf('Maler', null);
  for (const [a, b] of [[anna, fisi], [ben, fisi], [maler, malerBeruf]] as const) {
    assert.equal((await ruf(u, 'PUT', `/api/azubis/${a.id}/profil`, { cookies: c, body: { ausbildungsbeginn: '2025-08-01', berufId: b, ausbilderId: ausbilder.id } })).status, 200);
  }
  zuweisen(u.db, anna, bea);
  return { u, ausbilder, bea, anna, ben, maler, fisi, malerBeruf, dir };
}
const als = (w: Awaited<ReturnType<typeof welt>>, wer: BenutzerZeile) => sitzung(w.u, wer);

test('Frontmatter: Titel, Anführungszeichen, ohne Kopf, kaputter Kopf', () => {
  assert.deepEqual(frontmatter('---\ntitel: "Netz: Grundlagen"\n---\nText'), { data: { titel: 'Netz: Grundlagen' }, content: 'Text' });
  assert.deepEqual(frontmatter('Nur Text'), { data: {}, content: 'Nur Text' });
  assert.throws(() => frontmatter('---\nkein schluessel\n---\n'));
  assert.equal(frontmatter('---\r\ntitel: A\r\n---\r\n\r\nB').content, '\r\nB');
});

test('Einleser: Unterthemen mit Begriffen, Tabelle, Befehl, Merksatz, Prüfungsfrage; Fehler mit Zeile', () => {
  const { thema, meldungen } = parseThemaMarkdown(NETZ, 'themen/netz.md');
  assert.deepEqual(meldungen.filter((m) => m.level === 'fehler'), []);
  assert.equal(thema.titel, 'Netzwerkgrundlagen');
  assert.deepEqual(thema.unterthemen.map((x) => [x.id, x.hatInhalt]), [['subnetting', true], ['vlan', false]]);
  const s = thema.unterthemen[0];
  assert.deepEqual(s.begriffe[0], { begriff: 'Netzadresse', erklaerung: 'Erste Adresse eines Subnetzes.' });
  assert.deepEqual(s.tabellen[0], { titel: 'Präfixe', kopf: ['Präfix', 'Hosts'], zeilen: [['/24', '254'], ['/26', '62']] });
  assert.deepEqual(s.befehle, [{ befehl: 'ip addr show', info: 'Adressen anzeigen' }]);
  assert.equal(s.frage?.loesung.length, 2);
  assert.equal(s.abbildungen[0].bilder[0].datei, 'rahmen.svg');
  assert.equal(thema.links[0].url, 'https://www.elektronik-kompendium.de/');

  const kaputt = parseThemaMarkdown(NETZ.replace('## VLAN {#vlan}', '## VLAN'), 'themen/netz.md').meldungen.filter((m) => m.level === 'fehler');
  assert.equal(kaputt.length, 1);
  assert.match(kaputt[0].text, /ID/);
  assert.ok(kaputt[0].zeile && kaputt[0].zeile > 30);
});

test('Einleser: Links nur mit http(s) – „javascript:“ und „data:“ werden abgelehnt und nie zum Link', () => {
  for (const url of ['javascript:alert(1)', 'JavaScript:void0', 'data:text/html,x', '//boese.example']) {
    const { thema, meldungen } = parseThemaMarkdown(NETZ.replace('https://www.elektronik-kompendium.de/', url), 'themen/netz.md');
    assert.deepEqual(thema.links, [], url);
    assert.ok(meldungen.some((m) => m.level === 'fehler' && /Link/.test(m.text)), url);
  }
});

test('Grafiken werden bereinigt: kein Skript, keine Ereignisse, keine fremden Verweise', () => {
  const svg = bereinigeSvg(SVG);
  assert.ok(svg.startsWith('<svg') && svg.includes('class="sv-box"'));
  for (const x of ['script', 'onload', 'alert', 'boese.example', '<?xml']) assert.equal(svg.includes(x), false, x);
});

test('Grafiken: Umgehungen aus zusammengesetzten oder ungewöhnlich geschriebenen Teilen greifen nicht (CodeQL)', () => {
  const faelle = [
    '<svg><scr<script>x</script>ipt>alert(1)</script></svg>',
    '<svg><script>alert(1)</script foo="bar"></svg>',
    '<svg><script>alert(1)</svg>',
    '<svg><SCRIPT\n>alert(1)</SCRIPT\n></svg>',
    '<svg/onload=alert(1)></svg>',
    '<svg><a href="javajavascript:script:alert(1)">x</a></svg>',
    '<svg><a href=javascript:alert(1)>x</a></svg>',
    '<svg><rect style="fill:url(javascript:alert(1))"/></svg>',
    '<svg><rect fill="vbscript:alert(1)"/></svg>',
    '<svg><image href="data:image/svg+xml,alert(1)"/></svg>',
    '<svg><foreignObject><foreignObject></foreignObject>alert(1)</foreignObject></svg>',
    '<svg><!-- <script>alert(1)</script> --></svg>',
  ];
  for (const roh of faelle) {
    const s = bereinigeSvg(roh).toLowerCase();
    for (const verboten of ['<script', 'onload', 'javascript:', 'vbscript:', 'data:', 'foreignobject']) assert.equal(s.includes(verboten), false, `${roh} → ${s} enthält ${verboten}`);
  }
  // was harmlos ist, bleibt: Sprungmarken in der Grafik und das Wort „data:“ im Text
  const ok = bereinigeSvg('<svg><use href="#pfeil"/><text>Metadata: Version</text></svg>');
  assert.ok(ok.includes('href="#pfeil"') && ok.includes('Metadata: Version'), ok);
});

test('Lernmodul ist je Beruf schaltbar; /api/ich sagt, ob es das Menü gibt', async () => {
  const w = await welt();
  const ich = async (wer: BenutzerZeile) => koerper(await ruf(w.u, 'GET', '/api/ich', { cookies: als(w, wer) })).lernen;
  assert.equal(await ich(w.anna), true);
  assert.equal(await ich(w.maler), false, 'Beruf ohne Lernpaket');
  assert.equal(await ich(w.ausbilder), false);
  assert.equal((await ruf(w.u, 'GET', '/api/lernen', { cookies: als(w, w.maler) })).status, 404);

  // Auswahl in den Stammdaten: nur gültige Pakete, nur für Ausbilder sichtbar
  const sd = koerper(await ruf(w.u, 'GET', '/api/stammdaten', { cookies: als(w, w.ausbilder) }));
  assert.deepEqual(sd.lernpakete, [{ id: 'fisi', titel: 'Fachinformatiker Systemintegration', stand: '2026-11-01', herkunft: 'ordner', themenfelder: 2, unterthemen: 3, fehler: 0, meldungen: [] }]);
  assert.deepEqual(koerper(await ruf(w.u, 'GET', '/api/stammdaten', { cookies: als(w, w.bea) })).lernpakete, []);
  const aendere = (body: object) => ruf(w.u, 'PATCH', `/api/stammdaten/berufe/${w.malerBeruf}`, { cookies: als(w, w.ausbilder), body: { bezeichnung: 'Maler', fachrichtung: '', regeldauerMonate: 36, ...body } });
  assert.equal((await aendere({ lernpaket: 'gibt-es-nicht' })).status, 400);
  assert.equal((await aendere({ lernpaket: '../fisi' })).status, 400);
  assert.equal(koerper(await aendere({ lernpaket: 'fisi' })).beruf.lernpaket, 'fisi');
  assert.equal(await ich(w.maler), true, 'eingeschaltet: sofort da');
  assert.equal(koerper(await aendere({})).beruf.lernpaket, 'fisi', 'ohne Angabe bleibt es');
  assert.equal(koerper(await aendere({ lernpaket: null })).beruf.lernpaket, null);
  assert.equal(await ich(w.maler), false);
  const protokoll = (w.u.db.prepare("SELECT detail FROM protokoll WHERE detail LIKE '%Lernmodul%' ORDER BY id").all() as { detail: string }[]).map((z) => z.detail);
  assert.deepEqual(protokoll, ['Beruf geändert: Maler · Lernmodul eingeschaltet (fisi)', 'Beruf geändert: Maler · Lernmodul ausgeschaltet']);
});

test('Übersicht und Cheatsheet: Inhalte, bereinigte Grafik, Herkunft', async () => {
  const w = await welt();
  const c = als(w, w.anna);
  const ue = koerper(await ruf(w.u, 'GET', '/api/lernen', { cookies: c }));
  assert.deepEqual(ue.paket, { id: 'fisi', titel: 'Fachinformatiker Systemintegration', stand: '2026-11-01', quelle: 'FISI-Lernkompass', lizenz: 'CC BY-SA 4.0' });
  assert.deepEqual(ue.themenfelder.map((f: { id: string; titel: string; unterthemen: unknown[] }) => [f.id, f.titel, f.unterthemen.length]), [['netz', 'Netzwerkgrundlagen', 2], ['wiso', 'Wirtschaft', 1]]);
  assert.deepEqual(ue.themenfelder[0].unterthemen[0], { id: 'subnetting', titel: 'Subnetting', status: 'rot', lernpunkt: false, inhaltAktualisiert: false });
  assert.equal(JSON.stringify(ue).includes('Netzadresse'), false, 'die Übersicht trägt keine Inhalte');

  const t = koerper(await ruf(w.u, 'GET', '/api/lernen/thema/netz', { cookies: c })).thema;
  assert.equal(t.worum, 'Wie Daten durch ein Netz kommen.');
  assert.deepEqual(t.fehler, ['Netzadresse als Host vergeben.']);
  const s = t.unterthemen[0];
  assert.equal(s.merksatz, 'Blockgröße = 256 − letztes Masken-Oktett.');
  assert.deepEqual([s.status, s.luecke, s.notiz, s.geaendert, s.hash], ['rot', '', '', null, undefined]);
  const svg = s.abbildungen[0].bilder[0].svg as string;
  assert.ok(svg.startsWith('<svg') && !svg.includes('script') && !svg.includes('onload'));
  for (const pfad of ['/api/lernen/thema/gibtsnicht', '/api/lernen/thema/..']) assert.equal((await ruf(w.u, 'GET', pfad, { cookies: c })).status, 404);
});

test('Lernstand: Ampel, Lernpunkt und Notiz speichern; Eingaben werden geprüft', async () => {
  const w = await welt();
  const c = als(w, w.anna);
  const setze = (id: string, body: unknown) => ruf(w.u, 'PATCH', `/api/lernen/unterthema/${id}`, { cookies: c, body });
  assert.deepEqual(koerper(await setze('netz.subnetting', { status: 'gelb', luecke: '  Blockgröße bei /27 üben ' })), { id: 'netz.subnetting', status: 'gelb', luecke: 'Blockgröße bei /27 üben', notiz: '', geaendert: '2026-11-10', inhaltAktualisiert: false, abzeichen: { feld: 'netz', feldTitel: 'Netzwerkgrundlagen', stufe: 2, name: 'Stein' }, rang: { stufe: 2, name: 'Stein' } });
  assert.equal((await setze('netz.subnetting', { notiz: 'in der Schule fragen' })).status, 200);
  assert.equal(koerper(await setze('netz.subnetting', { status: 'gruen' })).luecke, 'Blockgröße bei /27 üben', 'der Lernpunkt bleibt beim Wechsel auf Sicher');

  const ue = koerper(await ruf(w.u, 'GET', '/api/lernen', { cookies: c })).themenfelder[0].unterthemen[0];
  assert.deepEqual([ue.status, ue.lernpunkt], ['gruen', false], 'Lernpunkt zählt nur bei „In Arbeit“');
  const s = koerper(await ruf(w.u, 'GET', '/api/lernen/thema/netz', { cookies: c })).thema.unterthemen[0];
  assert.deepEqual([s.status, s.luecke, s.notiz, s.geaendert], ['gruen', 'Blockgröße bei /27 üben', 'in der Schule fragen', '2026-11-10']);

  assert.equal((await setze('netz.subnetting', { status: 'blau' })).status, 400);
  assert.equal((await setze('netz.subnetting', {})).status, 400);
  assert.equal((await setze('netz.subnetting', { notiz: 'x'.repeat(2001) })).status, 400);
  assert.equal((await setze('netz.subnetting', { luecke: 5 })).status, 400);
  for (const id of ['netz.gibtsnicht', 'netz', 'netz.subnetting.x', 'NETZ.subnetting']) assert.equal((await setze(id, { status: 'gelb' })).status, 404, id);
});

test('Der Lernstand ist privat: andere Azubis, Ausbilder, Beauftragte und Super-Admin kommen nicht heran', async () => {
  const w = await welt();
  assert.equal((await ruf(w.u, 'PATCH', '/api/lernen/unterthema/netz.subnetting', { cookies: als(w, w.anna), body: { status: 'gelb', luecke: 'Annas Geheimnis' } })).status, 200);

  // Ben hat dasselbe Paket, aber seinen eigenen Stand
  const ben = koerper(await ruf(w.u, 'GET', '/api/lernen/thema/netz', { cookies: als(w, w.ben) })).thema.unterthemen[0];
  assert.deepEqual([ben.status, ben.luecke], ['rot', '']);

  for (const wer of [w.ausbilder, w.bea, admin(w.u.db)]) {
    for (const [m, pfad] of [['GET', '/api/lernen'], ['GET', '/api/lernen/kompendium'], ['GET', '/api/lernen/thema/netz'], ['PATCH', '/api/lernen/unterthema/netz.subnetting']] as const) {
      assert.equal((await ruf(w.u, m, pfad, { cookies: als(w, wer), body: { status: 'rot' } })).status, 403, `${wer.rolle} ${m} ${pfad}`);
    }
    // und nirgends sonst taucht er auf: Profil, Liste, Übersicht, Plan, Berichte
    for (const pfad of [`/api/azubis/${w.anna.id}/profil`, '/api/azubis', '/api/jahreskalender', `/api/azubis/${w.anna.id}/plan`, `/api/azubis/${w.anna.id}/berichte`]) {
      const r = await ruf(w.u, 'GET', pfad, { cookies: als(w, wer) });
      assert.equal(JSON.stringify(r.body ?? '').includes('Annas Geheimnis'), false, `${wer.rolle} ${pfad}`);
    }
  }
  assert.equal((await ruf(w.u, 'GET', '/api/lernen')).status, 401);
  assert.equal((w.u.db.prepare('SELECT COUNT(*) AS n FROM aktivitaet').get() as { n: number }).n, 0, 'nichts für die Glocke');
  assert.equal(JSON.stringify(w.u.db.prepare('SELECT * FROM protokoll').all()).includes('subnetting'), false, 'nichts im Protokoll');

  // Konto gelöscht: der Lernstand ist mit weg
  w.u.db.prepare('DELETE FROM benutzer WHERE id = ?').run(w.anna.id);
  assert.equal((w.u.db.prepare('SELECT COUNT(*) AS n FROM lern_status').get() as { n: number }).n, 0);
});

test('Geänderte Inhalte: Hinweis „Inhalt aktualisiert“, bis der Azubi ihn bestätigt; Umbenennungen nehmen den Stand mit', async () => {
  const w = await welt();
  const c = als(w, w.anna);
  const setze = (id: string, body: unknown) => ruf(w.u, 'PATCH', `/api/lernen/unterthema/${id}`, { cookies: c, body });
  await setze('netz.subnetting', { status: 'gruen' });
  await setze('netz.vlan', { status: 'gelb', luecke: 'Tagging' });
  const erstes = async () => koerper(await ruf(w.u, 'GET', '/api/lernen/thema/netz', { cookies: c })).thema.unterthemen as { id: string; status: string; luecke: string; inhaltAktualisiert: boolean }[];
  assert.equal((await erstes())[0].inhaltAktualisiert, false);

  // Inhaltspflege: Text geändert, VLAN umbenannt, Inhaltsstand erhöht
  const p = join(w.dir, 'fisi');
  writeFileSync(join(p, 'themen', 'netz.md'), NETZ.replace('Blockgröße = 256', 'Die Blockgröße ist 256').replace('{#vlan}', '{#vlans}'));
  writeFileSync(join(p, 'umbenennungen.json'), JSON.stringify({ 'netz.vlan': 'netz.vlans' }));
  writeFileSync(join(p, 'meta.json'), JSON.stringify({ stand: '2026-11-09' }));
  const spaeter = new Date(Date.now() + 60_000);
  utimesSync(join(p, 'meta.json'), spaeter, spaeter);
  vergissLernpakete(); // im Betrieb merkt das Portal die Änderung nach einigen Sekunden von selbst

  const danach = await erstes();
  assert.deepEqual([danach[0].status, danach[0].inhaltAktualisiert], ['gruen', true]);
  assert.deepEqual([danach[1].id, danach[1].status, danach[1].luecke], ['vlans', 'gelb', 'Tagging'], 'Stand ist zur neuen Kennung gewandert');
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/lernen', { cookies: c })).paket.stand, '2026-11-09');
  assert.equal(koerper(await setze('netz.subnetting', { bestaetigen: true })).inhaltAktualisiert, false);
  assert.equal((await erstes())[0].inhaltAktualisiert, false);
});

test('Geänderte Inhalte: Glocke für alle Azubis des Berufs – nicht für andere, nicht bei „kein-hinweis“, nicht beim ersten Einlesen', async () => {
  const w = await welt();
  const glocke = async (wer: BenutzerZeile) => (koerper(await ruf(w.u, 'GET', '/api/aktivitaeten', { cookies: als(w, wer) })).gruppen as any[]).filter((g) => g.art.endsWith('_aktualisiert'));
  // erstes Einlesen: nur der Stand wird gemerkt
  assert.equal((await ruf(w.u, 'GET', '/api/lernen', { cookies: als(w, w.anna) })).status, 200);
  assert.deepEqual(await glocke(w.anna), []);
  assert.ok((w.u.db.prepare("SELECT COUNT(*) AS n FROM lern_paket_stand WHERE paket = 'fisi'").get() as { n: number }).n > 0);

  const p = join(w.dir, 'fisi');
  const aendere = (text: string) => {
    writeFileSync(join(p, 'themen', 'netz.md'), text);
    const spaeter = new Date(Date.now() + 120_000 + Math.random() * 60_000);
    utimesSync(join(p, 'themen', 'netz.md'), spaeter, spaeter);
    vergissLernpakete();
  };
  // ein Unterthema geändert, eins nur umbenannt (gleicher Inhalt)
  aendere(NETZ.replace('Blockgröße = 256', 'Die Blockgröße ist 256').replace('{#vlan}', '{#vlans}'));
  writeFileSync(join(p, 'umbenennungen.json'), JSON.stringify({ 'netz.vlan': 'netz.vlans' }));
  await ruf(w.u, 'GET', '/api/lernen', { cookies: als(w, w.anna) });
  for (const a of [w.anna, w.ben]) {
    const g = await glocke(a);
    assert.deepEqual(g.map((x) => [x.art, x.anzahl, x.titel[0], x.akteurName]), [['lernen_aktualisiert', 1, '„Netzwerkgrundlagen“', '']]);
  }
  assert.deepEqual(await glocke(w.maler), [], 'anderer Beruf');
  assert.deepEqual(await glocke(w.ausbilder), [], 'Betreuende sehen das nicht');
  assert.deepEqual(await glocke(w.bea), []);
  assert.equal((w.u.db.prepare('SELECT COUNT(*) AS n FROM benachrichtigung_warte').get() as { n: number }).n, 0, 'nichts für Teams oder E-Mail');

  // reine Korrektur mit <!-- kein-hinweis -->: kein neuer Eintrag
  aendere(NETZ.replace('Blockgröße = 256', 'Die Blockgröße beträgt 256').replace('{#vlan}', '{#vlans}').replace('## Subnetting {#subnetting}\n', '## Subnetting {#subnetting}\n\n<!-- kein-hinweis -->\n'));
  await ruf(w.u, 'GET', '/api/lernen', { cookies: als(w, w.anna) });
  assert.equal((await glocke(w.anna))[0].anzahl, 1, 'kein weiterer Abschnitt');
});

test('Ohne Ordner oder mit kaputtem Paket startet das Portal trotzdem', async () => {
  vergissLernpakete();
  const u = await umgebung({ LERN_DIR: join(tmpdir(), 'gibt-es-nicht-' + Date.now()) });
  const a = konto(u.db, 'ausbilder');
  assert.deepEqual(koerper(await ruf(u, 'GET', '/api/stammdaten', { cookies: sitzung(u, a) })).lernpakete, []);

  const w = await welt(inhalte(NETZ.replace('## VLAN {#vlan}', '## VLAN')));
  const sd = koerper(await ruf(w.u, 'GET', '/api/stammdaten', { cookies: als(w, w.ausbilder) })).lernpakete;
  assert.equal(sd[0].fehler, 1, 'Fehler im Paket werden gezählt');
  assert.ok(w.u.logs.some((l) => l.includes('✖ themen/netz.md')), 'und stehen im Log');
  assert.equal((await ruf(w.u, 'GET', '/api/lernen', { cookies: als(w, w.anna) })).status, 200);
});

test('Unterordner beim Kopieren vergessen: 0 Themenfelder, und die Seite sagt, woran es liegt', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lern-'));
  mkdirSync(join(dir, 'fisi'));
  // nur die Dateien der obersten Ebene – wie nach cp/scp ohne -r
  writeFileSync(join(dir, 'fisi', 'meta.json'), JSON.stringify({ stand: '2026-11-01' }));
  writeFileSync(join(dir, 'fisi', 'themenfelder.json'), JSON.stringify([{ id: 'netz' }, { id: 'wiso' }]));
  vergissLernpakete();
  const u = await umgebung({ LERN_DIR: dir });
  const p = koerper(await ruf(u, 'GET', '/api/stammdaten', { cookies: sitzung(u, konto(u.db, 'ausbilder')) })).lernpakete[0];
  assert.deepEqual([p.themenfelder, p.fehler], [0, 2]);
  assert.match(p.meldungen[0], /Unterordner „themen“ fehlt.*cp -r/);
  assert.equal(p.meldungen[1], 'themen/netz.md – Markdown-Datei zum Katalogeintrag fehlt');

  // ganzer Ordner „content“ hineinkopiert: eine Ebene zu tief
  mkdirSync(join(dir, 'fisi', 'content', 'themen'), { recursive: true });
  vergissLernpakete();
  const tief = koerper(await ruf(u, 'GET', '/api/stammdaten', { cookies: sitzung(u, konto(u.db, 'ausbilder')) })).lernpakete[0];
  assert.match(tief.meldungen[0], /eine Ebene zu tief/);

  mkdirSync(join(dir, 'fisi', 'themen'));
  vergissLernpakete();
  const leer = koerper(await ruf(u, 'GET', '/api/stammdaten', { cookies: sitzung(u, konto(u.db, 'ausbilder')) })).lernpakete[0];
  assert.match(leer.meldungen[0], /ist leer/);
});

test('Kompendium: alle Bausteine aus allen Cheatsheets, nach Titel sortiert, mit Weg zum Unterthema', async () => {
  const w = await welt();
  const k = koerper(await ruf(w.u, 'GET', '/api/lernen/kompendium', { cookies: als(w, w.anna) }));
  assert.equal(k.paket.lizenz, 'CC BY-SA 4.0');
  assert.deepEqual(k.themenfelder, [{ id: 'netz', titel: 'Netzwerkgrundlagen' }, { id: 'wiso', titel: 'Wirtschaft' }]);
  assert.deepEqual(k.eintraege.map((e: { typ: string; titel: string }) => `${e.typ}:${e.titel}`), [
    'merksatz:Ausbildungsvertrag',
    'begriff:Broadcast',
    'befehl:ip addr show',
    'begriff:Netzadresse',
    'tabelle:Präfixe',
    'merksatz:Subnetting',
    'zusatz:Subnetze planen',
    'frage:Teile 192.168.10.0/24 in 4 Subnetze.',
  ]);
  const frage = k.eintraege.at(-1);
  assert.deepEqual([frage.feld, frage.sub, frage.subTitel, frage.loesung.length], ['netz', 'subnetting', 'Subnetting', 2]);
  assert.deepEqual(k.eintraege[4].tabelle.kopf, ['Präfix', 'Hosts']);
  // ohne Lernmodul am Beruf: nichts
  assert.equal((await ruf(w.u, 'GET', '/api/lernen/kompendium', { cookies: als(w, w.maler) })).status, 404);
});

test('Zusatzwissen: Inhalt, Verweise in beide Richtungen, Haken „gelesen“ – privat', async () => {
  const w = await welt();
  const c = als(w, w.anna);
  const t = koerper(await ruf(w.u, 'GET', '/api/lernen/thema/netz', { cookies: c })).thema;
  const z = t.zusatz[0];
  assert.deepEqual([z.id, z.titel, z.typ, z.intro, z.gelesen], ['planen', 'Subnetze planen', 'text', 'Wie man ein Netz aufteilt.', false]);
  assert.deepEqual(z.absaetze, ['Erst zählen, dann rechnen.']);
  assert.deepEqual(z.abschnitte.map((a: { art: string; titel: string }) => [a.art, a.titel]), [['text', 'Vorgehen'], ['checkliste', 'Fertig?']]);
  assert.deepEqual(z.zu, [{ feld: 'netz', feldTitel: 'Netzwerkgrundlagen', id: 'subnetting', titel: 'Subnetting' }, { feld: 'wiso', feldTitel: 'Wirtschaft', id: 'vertrag', titel: 'Ausbildungsvertrag' }]);
  assert.equal('ablaufDatei' in z, false);
  assert.deepEqual(t.unterthemen[0].vertiefung, [{ feld: 'netz', feldTitel: 'Netzwerkgrundlagen', id: 'planen', titel: 'Subnetze planen' }]);
  assert.deepEqual(t.unterthemen[1].vertiefung, []);
  // das andere Themenfeld verweist herüber
  assert.deepEqual(koerper(await ruf(w.u, 'GET', '/api/lernen/thema/wiso', { cookies: c })).thema.unterthemen[0].vertiefung[0].feld, 'netz');

  assert.equal((await ruf(w.u, 'PATCH', '/api/lernen/zusatz/netz.planen', { cookies: c, body: { gelesen: 'ja' } })).status, 400);
  assert.equal((await ruf(w.u, 'PATCH', '/api/lernen/zusatz/netz.subnetting', { cookies: c, body: { gelesen: true } })).status, 404);
  assert.deepEqual(koerper(await ruf(w.u, 'PATCH', '/api/lernen/zusatz/netz.planen', { cookies: c, body: { gelesen: true } })), { id: 'netz.planen', gelesen: true, abzeichen: null, rang: null });
  assert.equal((await ruf(w.u, 'PATCH', '/api/lernen/zusatz/netz.planen', { cookies: c, body: { gelesen: true } })).status, 200);
  assert.deepEqual(koerper(await ruf(w.u, 'GET', '/api/lernen', { cookies: c })).themenfelder[0].zusatz, [{ id: 'planen', titel: 'Subnetze planen', gelesen: true }]);
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/lernen/thema/netz', { cookies: c })).thema.zusatz[0].gelesen, true);
  // zählt nicht zur Ampel
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/lernen', { cookies: c })).themenfelder[0].unterthemen[0].status, 'rot');
  // Ben sieht Annas Haken nicht; andere Rollen kommen nicht heran
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/lernen', { cookies: als(w, w.ben) })).themenfelder[0].zusatz[0].gelesen, false);
  for (const wer of [w.ausbilder, w.bea, admin(w.u.db), w.maler]) assert.ok([403, 404].includes((await ruf(w.u, 'PATCH', '/api/lernen/zusatz/netz.planen', { cookies: als(w, wer), body: { gelesen: true } })).status));
  assert.equal((w.u.db.prepare('SELECT COUNT(*) AS n FROM lern_zusatz').get() as { n: number }).n, 1);
  assert.equal(koerper(await ruf(w.u, 'PATCH', '/api/lernen/zusatz/netz.planen', { cookies: c, body: { gelesen: false } })).gelesen, false);
  assert.equal((w.u.db.prepare('SELECT COUNT(*) AS n FROM lern_zusatz').get() as { n: number }).n, 0);

  // im Kompendium auffindbar – auch über Text aus den Abschnitten
  const e = koerper(await ruf(w.u, 'GET', '/api/lernen/kompendium', { cookies: c })).eintraege.find((x: { typ: string }) => x.typ === 'zusatz');
  assert.deepEqual([e.titel, e.text, e.feld, e.sub, e.abschnitte], ['Subnetze planen', 'Wie man ein Netz aufteilt.', 'netz', 'planen', ['Vorgehen', 'Fertig?']]);
  assert.match(e.volltext, /Reserve eingeplant/);
});

test('Abzeichen: Holz, Stein, Bronze je Themenfeld; einmal erreicht bleibt; Rang über die Hälfte der Themenfelder; privat', async () => {
  // Themenfeld „netz“ mit vier Unterthemen und einem Zusatzwissen, „wiso“ mit einem Unterthema
  const netz = NETZ.replace('## VLAN {#vlan}', '## VLAN {#vlan}\n\n## Routing {#routing}\n\n## DNS {#dns}');
  const w = await welt(inhalte(netz));
  const c = als(w, w.anna);
  const setze = async (id: string, status: string) => koerper(await ruf(w.u, 'PATCH', `/api/lernen/unterthema/${id}`, { cookies: c, body: { status } }));
  const lies = async () => koerper(await ruf(w.u, 'GET', '/api/lernen', { cookies: c }));
  const feld = async (id: string) => (await lies()).themenfelder.find((f: { id: string }) => f.id === id).abzeichen;

  // am Anfang: nichts
  const start = await lies();
  assert.deepEqual(start.rang, { stufe: 0, name: null, noetig: 1, felder: 2, hoechste: 3, naechste: { stufe: 1, name: 'Holz', haben: 0 } });
  assert.deepEqual([start.themenfelder[0].abzeichen.stufe, start.themenfelder[0].abzeichen.fortschritt, /Gelb oder Grün/.test(start.themenfelder[0].abzeichen.fehlt)], [0, 0, true]);

  // Rot zählt nicht; das erste Gelb bringt Holz – und weil ein Themenfeld von zweien reicht, auch den Rang
  assert.deepEqual([(await setze('netz.subnetting', 'rot')).abzeichen, (await feld('netz')).stufe], [null, 0]);
  const erstes = await setze('netz.subnetting', 'gelb');
  assert.deepEqual([erstes.abzeichen, erstes.rang], [{ feld: 'netz', feldTitel: 'Netzwerkgrundlagen', stufe: 1, name: 'Holz' }, { stufe: 1, name: 'Holz' }]);
  assert.deepEqual(await feld('netz'), { stufe: 1, name: 'Holz', erreicht: '2026-11-10', fehlt: 'Noch 1 Unterthema bis Stein.', fortschritt: 50, hoechste: 3 });
  // dasselbe noch einmal speichern: kein neues Abzeichen
  assert.deepEqual([(await setze('netz.subnetting', 'gruen')).abzeichen, (await setze('netz.subnetting', 'gelb')).rang], [null, null]);

  // die Hälfte der Unterthemen: Stein
  assert.equal((await setze('netz.vlan', 'gruen')).abzeichen.name, 'Stein');
  assert.deepEqual([(await feld('netz')).fehlt, (await feld('netz')).fortschritt], ['Noch 2 Unterthemen und 1× Zusatzwissen bis Bronze.', 40]);
  // alle Unterthemen, aber das Zusatzwissen fehlt noch: weiter Stein
  await setze('netz.routing', 'gelb');
  assert.equal((await setze('netz.dns', 'gelb')).abzeichen, null);
  assert.equal((await feld('netz')).fehlt, 'Noch 1× Zusatzwissen bis Bronze.');
  const gelesen = koerper(await ruf(w.u, 'PATCH', '/api/lernen/zusatz/netz.planen', { cookies: c, body: { gelesen: true } }));
  assert.deepEqual([gelesen.abzeichen, gelesen.rang], [{ feld: 'netz', feldTitel: 'Netzwerkgrundlagen', stufe: 3, name: 'Bronze' }, { stufe: 3, name: 'Bronze' }]);
  const bronze = await feld('netz');
  assert.deepEqual([bronze.stufe, bronze.fortschritt, /hier gibt es kein Quiz/.test(bronze.fehlt)], [3, 100, true]);
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/lernen/thema/netz', { cookies: c })).thema.abzeichen.name, 'Bronze');

  // einmal erreicht bleibt: Ampel zurück auf Rot, Haken weg – das Abzeichen steht weiter da
  await setze('netz.subnetting', 'rot');
  await ruf(w.u, 'PATCH', '/api/lernen/zusatz/netz.planen', { cookies: c, body: { gelesen: false } });
  assert.deepEqual([(await feld('netz')).stufe, (await lies()).rang.stufe], [3, 3]);
  // … und es gibt die Stufe nicht ein zweites Mal
  assert.equal((await setze('netz.subnetting', 'gelb')).abzeichen, null);

  // zweites Themenfeld mit nur einem Unterthema und ohne Zusatzwissen: sofort Bronze
  assert.equal((await setze('wiso.vertrag', 'gruen')).abzeichen.name, 'Bronze');
  assert.equal((await lies()).rang.naechste, null, 'ohne Quiz ist Bronze der höchste Rang');

  // privat: Ben hat nichts; Ausbilder, Beauftragte und Super-Admin kommen nicht heran
  const ben = koerper(await ruf(w.u, 'GET', '/api/lernen', { cookies: als(w, w.ben) }));
  assert.deepEqual([ben.rang.stufe, ben.themenfelder.map((f: { abzeichen: { stufe: number } }) => f.abzeichen.stufe)], [0, [0, 0]]);
  for (const wer of [w.ausbilder, w.bea, admin(w.u.db)]) assert.equal((await ruf(w.u, 'GET', '/api/lernen', { cookies: als(w, wer) })).status, 403);
  // mit dem Konto verschwinden die Abzeichen
  w.u.db.prepare('DELETE FROM benutzer WHERE id = ?').run(w.anna.id);
  assert.equal((w.u.db.prepare('SELECT COUNT(*) AS n FROM lern_abzeichen').get() as { n: number }).n, 0);
});

test('Abzeichen: Wer schon vorher gelernt hat, bekommt sie beim Öffnen von „Lernen“ gutgeschrieben', async () => {
  const w = await welt();
  const c = als(w, w.anna);
  // Lernstand wie vor der Einführung der Abzeichen: direkt in der Datenbank
  for (const id of ['netz.subnetting', 'netz.vlan']) w.u.db.prepare("INSERT INTO lern_status (azubi_id, paket, unterthema_id, status, geaendert) VALUES (?, 'fisi', ?, 'gruen', '2026-10-01')").run(w.anna.id, id);
  const d = koerper(await ruf(w.u, 'GET', '/api/lernen', { cookies: c }));
  assert.deepEqual([d.themenfelder[0].abzeichen.name, d.themenfelder[0].abzeichen.erreicht, d.rang.name], ['Stein', '2026-11-10', 'Stein']);
});

test('Leseansicht: Ausbilder und Beauftragte sehen alle Lernmodule mit Inhalt – aber keinen Lernstand', async () => {
  const w = await welt();
  // Anna hat gelernt, eine Notiz geschrieben und Zusatzwissen abgehakt
  const ca = als(w, w.anna);
  await ruf(w.u, 'PATCH', '/api/lernen/unterthema/netz.subnetting', { cookies: ca, body: { status: 'gruen', luecke: 'geheim-lernpunkt', notiz: 'geheim-notiz' } });
  await ruf(w.u, 'PATCH', '/api/lernen/zusatz/netz.planen', { cookies: ca, body: { gelesen: true } });

  for (const wer of [w.ausbilder, w.bea]) {
    const c = als(w, wer);
    // alle Pakete auf dem Server, mit den Berufen, für die sie eingeschaltet sind
    const liste = koerper(await ruf(w.u, 'GET', '/api/lerninhalte', { cookies: c })).pakete;
    assert.deepEqual(liste.map((p: { id: string; titel: string; themenfelder: number; unterthemen: number; berufe: string[] }) => [p.id, p.titel, p.themenfelder, p.unterthemen, p.berufe]), [['fisi', 'Fachinformatiker Systemintegration', 2, 3, ['Fachinformatiker']]]);
    // Übersicht: Themenfelder ohne Stand
    const ue = koerper(await ruf(w.u, 'GET', '/api/lerninhalte/fisi', { cookies: c }));
    assert.deepEqual(ue.themenfelder.map((f: { id: string }) => f.id), ['netz', 'wiso']);
    assert.equal(ue.rang, undefined);
    assert.deepEqual([ue.themenfelder[0].unterthemen[0].status, ue.themenfelder[0].zusatz[0].gelesen, ue.themenfelder[0].abzeichen.stufe], ['rot', false, 0]);
    // Themenfeld: der volle Inhalt, aber nichts von Anna
    const t = await ruf(w.u, 'GET', '/api/lerninhalte/fisi/thema/netz', { cookies: c });
    const thema = koerper(t).thema;
    assert.equal(thema.unterthemen[0].begriffe[0].begriff, 'Netzadresse');
    assert.deepEqual([thema.unterthemen[0].status, thema.unterthemen[0].luecke, thema.unterthemen[0].notiz, thema.zusatz[0].gelesen, thema.abzeichen.stufe], ['rot', '', '', false, 0]);
    assert.ok(!JSON.stringify(koerper(t)).includes('geheim'), 'weder Lernpunkt noch Notiz');
    assert.ok(koerper(await ruf(w.u, 'GET', '/api/lerninhalte/fisi/kompendium', { cookies: c })).eintraege.length > 3);
    // unbekanntes Paket, unbekanntes Themenfeld, krumme Namen
    for (const pfad of ['/api/lerninhalte/gibtsnicht', '/api/lerninhalte/fisi/thema/gibtsnicht', '/api/lerninhalte/..%2Ffisi', '/api/lerninhalte/FISI/kompendium']) assert.equal((await ruf(w.u, 'GET', pfad, { cookies: c })).status, 404, pfad);
    // die Seiten der Azubis bleiben ihnen verschlossen – und schreiben können sie nichts
    assert.equal((await ruf(w.u, 'GET', '/api/lernen/thema/netz', { cookies: c })).status, 403);
    assert.equal((await ruf(w.u, 'PATCH', '/api/lernen/unterthema/netz.subnetting', { cookies: c, body: { status: 'gelb' } })).status, 403);
  }
  // Azubis und Super-Admin haben die Leseansicht nicht
  for (const wer of [w.anna, w.maler, admin(w.u.db)]) for (const pfad of ['/api/lerninhalte', '/api/lerninhalte/fisi', '/api/lerninhalte/fisi/thema/netz', '/api/lerninhalte/fisi/kompendium']) assert.equal((await ruf(w.u, 'GET', pfad, { cookies: als(w, wer) })).status, 403, `${wer.rolle} ${pfad}`);
  assert.equal((await ruf(w.u, 'GET', '/api/lerninhalte')).status, 401);
});

test('Paket für alle Berufe: Ausbilder legt es fest, jeder Azubi liest es – ohne Lernstand, nichts wird gespeichert', async () => {
  const dir = inhalte();
  const p = join(dir, 'arbeiten');
  mkdirSync(join(p, 'themen'), { recursive: true });
  writeFileSync(join(p, 'paket.json'), JSON.stringify({ titel: 'Arbeiten und Prüfung' }));
  writeFileSync(join(p, 'meta.json'), JSON.stringify({ stand: '2026-11-12' }));
  writeFileSync(join(p, 'themenfelder.json'), JSON.stringify([{ id: 'struktur', icon: 'book-open', lernfelder: [], pruefung: [] }]));
  writeFileSync(join(p, 'themen', 'struktur.md'), '---\ntitel: Strukturiert arbeiten\n---\n\nSo behältst du den Überblick.\n\n## Aufgabe klären {#klaeren}\n\n### Kernbegriffe\n- **Ziel:** Was am Ende da sein soll.\n\n### Merksatz\nErst fragen, dann anfangen.\n');
  const w = await welt(dir);
  const ich = async (wer: BenutzerZeile) => koerper(await ruf(w.u, 'GET', '/api/ich', { cookies: als(w, wer) }));
  const setze = (paket: unknown, wer = w.ausbilder) => ruf(w.u, 'PUT', '/api/stammdaten/lern-allgemein', { cookies: als(w, wer), body: { paket } });
  const sd = async (wer = w.ausbilder) => koerper(await ruf(w.u, 'GET', '/api/stammdaten', { cookies: als(w, wer) })).lernAllgemein;

  // am Anfang keins
  assert.equal(await sd(), null);
  assert.equal((await ich(w.maler)).anleitungen, null);
  assert.equal((await ruf(w.u, 'GET', '/api/anleitungen', { cookies: als(w, w.maler) })).status, 404);

  // nur Ausbilder legen fest, nur vorhandene Pakete
  for (const wer of [w.bea, w.anna, admin(w.u.db)]) assert.equal((await setze('arbeiten', wer)).status, 403, wer.rolle);
  assert.equal((await setze('gibt-es-nicht')).status, 400);
  assert.equal((await setze('../arbeiten')).status, 400);
  assert.equal((await setze(7)).status, 400);
  assert.deepEqual(koerper(await setze('arbeiten')), { lernAllgemein: 'arbeiten' });
  assert.equal(await sd(), 'arbeiten');
  assert.equal(await sd(w.bea), null, 'Beauftragte brauchen die Angabe nicht');

  // jeder Azubi sieht es – mit und ohne Lernmodul für seinen Beruf; andere Rollen bekommen kein Menü dafür
  assert.deepEqual([(await ich(w.maler)).anleitungen, (await ich(w.maler)).lernen], ['Arbeiten und Prüfung', false]);
  assert.deepEqual([(await ich(w.anna)).anleitungen, (await ich(w.anna)).lernen], ['Arbeiten und Prüfung', true]);
  assert.equal((await ich(w.ausbilder)).anleitungen, null);
  for (const wer of [w.maler, w.anna]) {
    const ue = koerper(await ruf(w.u, 'GET', '/api/anleitungen', { cookies: als(w, wer) }));
    assert.deepEqual([ue.paket.titel, ue.themenfelder.map((f: { id: string; titel: string }) => f.titel), ue.rang], ['Arbeiten und Prüfung', ['Strukturiert arbeiten'], undefined]);
    const t = koerper(await ruf(w.u, 'GET', '/api/anleitungen/thema/struktur', { cookies: als(w, wer) })).thema;
    assert.deepEqual([t.worum, t.unterthemen[0].begriffe[0].begriff, t.unterthemen[0].merksatz, t.unterthemen[0].status, t.abzeichen.stufe], ['So behältst du den Überblick.', 'Ziel', 'Erst fragen, dann anfangen.', 'rot', 0]);
    assert.equal((await ruf(w.u, 'GET', '/api/anleitungen/thema/gibtsnicht', { cookies: als(w, wer) })).status, 404);
  }
  for (const wer of [w.ausbilder, w.bea, admin(w.u.db)]) for (const pfad of ['/api/anleitungen', '/api/anleitungen/thema/struktur']) assert.equal((await ruf(w.u, 'GET', pfad, { cookies: als(w, wer) })).status, 403, `${wer.rolle} ${pfad}`);
  assert.equal((await ruf(w.u, 'GET', '/api/anleitungen')).status, 401);

  // das eigene Lernmodul bleibt davon unberührt: Annas Lernen kennt die Anleitung nicht, der Lernstand lässt sich dort nicht setzen
  assert.deepEqual(koerper(await ruf(w.u, 'GET', '/api/lernen', { cookies: als(w, w.anna) })).themenfelder.map((f: { id: string }) => f.id), ['netz', 'wiso']);
  assert.equal((await ruf(w.u, 'PATCH', '/api/lernen/unterthema/struktur.klaeren', { cookies: als(w, w.anna), body: { status: 'gruen' } })).status, 404);
  assert.equal((w.u.db.prepare("SELECT COUNT(*) AS n FROM lern_status WHERE paket = 'arbeiten'").get() as { n: number }).n, 0);

  // Leseansicht der Betreuenden nennt „alle Berufe“
  const liste = koerper(await ruf(w.u, 'GET', '/api/lerninhalte', { cookies: als(w, w.bea) })).pakete as { id: string; berufe: string[] }[];
  assert.deepEqual(liste.find((x) => x.id === 'arbeiten')!.berufe, ['alle Berufe']);

  // wieder wegnehmen; im Protokoll steht beides
  assert.deepEqual(koerper(await setze(null)), { lernAllgemein: null });
  assert.equal((await ich(w.maler)).anleitungen, null);
  assert.equal((await ruf(w.u, 'GET', '/api/anleitungen', { cookies: als(w, w.maler) })).status, 404);
  assert.deepEqual((w.u.db.prepare("SELECT detail FROM protokoll WHERE detail LIKE 'Lerninhalte für alle%' ORDER BY id").all() as { detail: string }[]).map((z) => z.detail), ['Lerninhalte für alle Berufe: arbeiten', 'Lerninhalte für alle Berufe ausgeschaltet']);
});

// Paket mit Quiz: zwei Unterthemen mit je vier Begriffen, eins mit nur einem (kein Quiz)
const begriffe = (namen: string[]) => namen.map((n) => `- **${n}:** Erklärung zu ${n.toLowerCase()} mit genug Text, damit die Frage trägt.`).join('\n');
const QUIZ_NETZ = `---\ntitel: Netzwerke\n---\n\nNetze.\n\n## Adressen {#adressen}\n\n### Kernbegriffe\n${begriffe(['Netzadresse', 'Broadcast', 'Gateway', 'Subnetzmaske'])}\n\n### Prüfungsfrage\nTeile ein Netz.\n\n1. Bits leihen\n\n## Geräte {#geraete}\n\n### Kernbegriffe\n${begriffe(['Switch', 'Router', 'Hub', 'Repeater'])}\n\n## Kabel {#kabel}\n\n### Kernbegriffe\n${begriffe(['Patchkabel'])}\n`;

test('Üben: Karteikarten wandern durch die Fächer und kommen später wieder', async () => {
  const w = await welt(inhalte(QUIZ_NETZ));
  let c = als(w, w.anna);
  const ue = koerper(await ruf(w.u, 'GET', '/api/lernen/ueben', { cookies: c }));
  const netz = ue.themenfelder[0];
  // 9 Begriffe + 1 Prüfungsfrage; alle noch nie gesehen, also heute dran
  assert.deepEqual([netz.karten, netz.faellig, netz.sicher, netz.quiz.length, netz.ohneQuiz], [10, 10, 0, 2, 1]);
  const runde = koerper(await ruf(w.u, 'GET', '/api/lernen/karten?feld=netz&runde=1', { cookies: c }));
  assert.deepEqual([runde.feldTitel, runde.gesamt, runde.faellig, runde.karten.length], ['Netzwerke', 10, 10, 10]);
  const frage = runde.karten.find((k: { art: string }) => k.art === 'frage');
  assert.deepEqual([frage.vorne, frage.hinten, frage.fach], ['Teile ein Netz.', ['Bits leihen'], 0]);
  const karte = runde.karten.find((k: { vorne: string }) => k.vorne === 'Switch');
  const merke = async (gewusst: unknown, id = karte.id) => ruf(w.u, 'PATCH', '/api/lernen/karte', { cookies: c, body: { id, gewusst } });
  // gewusst: Fach 1 und morgen wieder dran; noch einmal: Fach 2 in drei Tagen
  assert.deepEqual(koerper(await merke(true)), { id: karte.id, fach: 1, faellig: '2026-11-11' });
  assert.deepEqual(koerper(await merke(true)), { id: karte.id, fach: 2, faellig: '2026-11-13' });
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/lernen/karten?feld=netz', { cookies: c })).faellig, 9, 'die gewusste Karte ist heute nicht mehr dran');
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/lernen/karten?feld=netz&alle=1', { cookies: c })).karten.length, 10);
  // nicht gewusst: zurück in Fach 1, sofort wieder dran
  assert.deepEqual(koerper(await merke(false)), { id: karte.id, fach: 1, faellig: '2026-11-10' });
  w.u.uhr.jetzt = new Date('2026-11-14T09:00:00Z');
  c = als(w, w.anna); // die alte Sitzung ist inzwischen abgelaufen
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/lernen/karten', { cookies: c })).feldTitel, 'Alle Themenfelder');
  assert.equal((await merke('ja')).status, 400);
  assert.equal((await merke(true, 'b:netz.adressen:gibtsnicht')).status, 404);
  assert.equal((await ruf(w.u, 'GET', '/api/lernen/karten?feld=gibtsnicht', { cookies: c })).status, 404);
  // privat: Ben hat nichts gelernt; Betreuer und Super-Admin kommen nicht heran
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/lernen/ueben', { cookies: als(w, w.ben) })).themenfelder[0].faellig, 10);
  for (const wer of [w.ausbilder, w.bea]) for (const pfad of ['/api/lernen/ueben', '/api/lernen/karten', '/api/lernen/quiz/netz.adressen']) assert.equal((await ruf(w.u, 'GET', pfad, { cookies: als(w, wer) })).status, 403, pfad);
});

test('Üben: Quiz wird vom Server gewertet und schaltet Silber, Gold und Meister frei', async () => {
  const w = await welt(inhalte(QUIZ_NETZ));
  let c = als(w, w.anna);
  const hole = async (id: string) => koerper(await ruf(w.u, 'GET', `/api/lernen/quiz/${id}`, { cookies: c }));
  const loese = async (id: string, fehler = 0) => {
    const q = await hole(id);
    const antworten = Object.fromEntries(q.fragen.map((f: { id: string; richtig: string; optionen: string[] }, i: number) => [f.id, i < fehler ? f.optionen.find((o) => o !== f.richtig) : f.richtig]));
    return koerper(await ruf(w.u, 'POST', `/api/lernen/quiz/${id}`, { cookies: c, body: { antworten } }));
  };
  const feld = async () => koerper(await ruf(w.u, 'GET', '/api/lernen', { cookies: c })).themenfelder[0].abzeichen;

  const q = await hole('netz.adressen');
  assert.deepEqual([q.titel, q.feldTitel, q.fragen.length, q.bestehenAb, q.stand], ['Adressen', 'Netzwerke', 4, 4, 'offen']);
  for (const f of q.fragen) {
    assert.equal(f.optionen.length, 4);
    assert.equal(new Set(f.optionen).size, 4);
    assert.ok(f.optionen.includes(f.richtig) && !f.text.toLowerCase().includes(f.richtig.toLowerCase()), 'die Frage verrät den Begriff nicht');
  }
  assert.equal((await ruf(w.u, 'GET', '/api/lernen/quiz/netz.kabel', { cookies: c })).status, 404, 'zu wenige Begriffe: kein Quiz');
  assert.equal((await ruf(w.u, 'POST', '/api/lernen/quiz/netz.adressen', { cookies: c, body: { antworten: { [q.fragen[0].id]: q.fragen[0].richtig } } })).status, 400, 'unvollständige Runde zählt nicht');

  // Voraussetzung für die oberen Stufen ist Bronze: alle Ampeln mindestens gelb (Zusatzwissen gibt es hier nicht)
  for (const id of ['netz.adressen', 'netz.geraete', 'netz.kabel']) await ruf(w.u, 'PATCH', `/api/lernen/unterthema/${id}`, { cookies: c, body: { status: 'gelb' } });
  assert.deepEqual([(await feld()).name, (await feld()).hoechste, (await feld()).fehlt], ['Bronze', 6, 'Noch 1 Quiz bestehen bis Silber.']);

  // ein Fehler bei vier Fragen = 75 %: nicht bestanden
  const knapp = await loese('netz.adressen', 1);
  assert.deepEqual([knapp.richtig, knapp.gesamt, knapp.bestanden, knapp.falsch.length, knapp.stand, knapp.abzeichen], [3, 4, false, 1, 'offen', null]);
  // bestanden: das eine von zwei Quiz reicht für Silber
  const gut = await loese('netz.adressen');
  assert.deepEqual([gut.bestanden, gut.neuBestanden, gut.stand, gut.meisterAb, gut.meisterMoeglich, gut.abzeichen?.name], [true, true, 'bestanden', '2026-11-17', false, 'Silber']);
  assert.equal((await feld()).fehlt, 'Noch 1 Quiz bestehen bis Gold.');
  assert.equal((await loese('netz.geraete')).abzeichen.name, 'Gold');
  // fehlerfrei am selben Tag zählt noch nicht für Meister
  assert.deepEqual([(await loese('netz.adressen')).neuMeister, (await feld()).name], [false, 'Gold']);
  assert.match((await feld()).fehlt, /Noch 2 Quiz fehlerfrei wiederholen bis Meister/);

  // eine Woche später: fehlerfrei zählt – mit einem Fehler nicht
  w.u.uhr.jetzt = new Date('2026-11-17T09:00:00Z');
  c = als(w, w.anna); // die alte Sitzung ist inzwischen abgelaufen
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/lernen/ueben', { cookies: c })).themenfelder[0].quiz[0].meisterMoeglich, true);
  const patzer = await loese('netz.adressen', 1);
  assert.deepEqual([patzer.neuMeister, patzer.stand], [false, 'bestanden'], 'bestanden bleibt bestanden');
  assert.deepEqual([(await loese('netz.adressen')).stand, (await feld()).name], ['meister', 'Gold']);
  const meister = await loese('netz.geraete');
  assert.deepEqual([meister.neuMeister, meister.abzeichen?.name, meister.rang?.name], [true, 'Meister', 'Meister']);
  assert.deepEqual([(await feld()).fehlt, (await feld()).fortschritt], ['Höchste Stufe erreicht.', 100]);
  // mit dem Konto verschwindet alles
  w.u.db.prepare('DELETE FROM benutzer WHERE id = ?').run(w.anna.id);
  assert.equal((w.u.db.prepare('SELECT (SELECT COUNT(*) FROM lern_quiz) + (SELECT COUNT(*) FROM lern_karte) AS n').get() as { n: number }).n, 0);
});

test('Quiz: Der gesuchte Begriff wird ausgeblendet – aber nur als ganzes Wort', () => {
  assert.equal(maskiere('Flüchtiger Speicher für laufende Programme; RAM-Riegel gibt es als DDR4.', 'Arbeitsspeicher (RAM)'), 'Flüchtiger Speicher für laufende Programme; …-Riegel gibt es als DDR4.');
  assert.equal(maskiere('Der Arbeitsspeicher ist flüchtig, die Größe des Arbeitsspeichers zählt.', 'Arbeitsspeicher (RAM)'), 'Der … ist flüchtig, die Größe des …s zählt.');
  assert.equal(maskiere('Ein Hub verteilt an alle; Schubfächer gibt es nicht.', 'Hub'), 'Ein … verteilt an alle; Schubfächer gibt es nicht.');
  assert.equal(maskiere('C++ (und C) sind Sprachen.', 'C++'), '… (und C) sind Sprachen.');
});

test('Rückmeldung: Wünsche zu Lerninhalten ohne Person an die Ausbilder, Ideen an Super-Admin und Ausbilder, Fehler nur an den Super-Admin', async () => {
  const w = await welt();
  const chef = admin(w.u.db);
  const sende = (wer: BenutzerZeile, body: Record<string, unknown>) => ruf(w.u, 'POST', '/api/fehlermeldungen', { cookies: als(w, wer), body });
  const fuerAusbilder = async (wer = w.ausbilder) => koerper(await ruf(w.u, 'GET', '/api/rueckmeldungen', { cookies: als(w, wer) }));
  const fuerChef = async () => koerper(await ruf(w.u, 'GET', '/api/fehlermeldungen', { cookies: als(w, chef) }));

  // Themen für das Formular: nur für Azubis, nur Titel
  const themen = koerper(await ruf(w.u, 'GET', '/api/rueckmeldungen/themen', { cookies: als(w, w.anna) })).bereiche;
  assert.deepEqual(themen.map((b: any) => [b.bereich, b.titel]), [['lernen', 'Fachinformatiker Systemintegration']]);
  assert.deepEqual(themen[0].felder[0], { id: 'netz', titel: 'Netzwerkgrundlagen', themen: [{ id: 'subnetting', titel: 'Subnetting' }, { id: 'vlan', titel: 'VLAN' }] });
  assert.deepEqual(koerper(await ruf(w.u, 'GET', '/api/rueckmeldungen/themen', { cookies: als(w, w.maler) })).bereiche, [], 'Beruf ohne Lernmodul');
  assert.equal((await ruf(w.u, 'GET', '/api/rueckmeldungen/themen', { cookies: als(w, w.ausbilder) })).status, 403);

  // Wunsch zu einem Lerninhalt: nur Azubis mit Lerninhalten, nur vorhandene Themen
  assert.equal((await sende(w.ausbilder, { art: 'inhalt', text: 'Bitte Subnetting genauer erklären.' })).status, 403);
  assert.equal((await sende(w.maler, { art: 'inhalt', text: 'Bitte Subnetting genauer erklären.' })).status, 409);
  for (const thema of ['lernen|gibtsnicht|', 'lernen|netz|gibtsnicht', 'anleitungen|netz|']) assert.equal((await sende(w.anna, { art: 'inhalt', text: 'Bitte Subnetting genauer erklären.', thema })).status, 400, thema);
  assert.equal((await sende(w.anna, { art: 'quatsch', text: 'Bitte Subnetting genauer erklären.' })).status, 400);
  assert.equal((await sende(w.anna, { art: 'inhalt', text: 'kurz', thema: 'lernen|netz|subnetting' })).status, 400);
  assert.equal((await sende(w.anna, { art: 'inhalt', text: 'Wie komme ich von /26 auf 62 Hosts?', thema: 'lernen|netz|subnetting', seite: '/lernen/thema/netz', fenster: '390 × 800', technik: 'x', bild: 'data:image/png;base64,AAAA' })).status, 201);
  assert.equal((await sende(w.ben, { art: 'inhalt', text: 'Das ganze Themenfeld ist mir zu knapp.', thema: 'lernen|wiso|' })).status, 201);
  assert.equal((await sende(w.ben, { art: 'inhalt', text: 'Mir fehlt ein Thema zu Druckern.' })).status, 201);

  // gespeichert ist nichts, woran man die Person erkennt
  const roh = w.u.db.prepare("SELECT * FROM fehlermeldung WHERE art = 'inhalt' ORDER BY id").all() as any[];
  assert.equal(roh.length, 3);
  for (const z of roh) {
    assert.deepEqual([z.benutzer_id, z.benutzer_name, z.seite, z.browser, z.fenster, z.technik, z.bild, z.version], [null, '', '', '', '', '', null, '']);
    assert.match(z.zeit, /^\d{4}-\d{2}-\d{2}$/, 'nur der Tag');
  }

  // Ausbilder lesen und haken ab; sonst niemand
  const a = await fuerAusbilder();
  assert.equal(a.offen, 3);
  assert.deepEqual(a.inhalte.map((x: any) => [x.paketTitel, x.thema, x.text]).reverse(), [
    ['Fachinformatiker Systemintegration', 'Netzwerkgrundlagen › Subnetting', 'Wie komme ich von /26 auf 62 Hosts?'],
    ['Fachinformatiker Systemintegration', 'Wirtschaft', 'Das ganze Themenfeld ist mir zu knapp.'],
    ['Fachinformatiker Systemintegration', '', 'Mir fehlt ein Thema zu Druckern.'],
  ]);
  assert.deepEqual(Object.keys(a.inhalte[0]).sort(), ['erledigtAm', 'id', 'paket', 'paketTitel', 'status', 'stelle', 'tag', 'text', 'thema'], 'kein Name, keine Rolle, keine Uhrzeit');
  // die Stelle zum Hinspringen: Themenfeld und – wenn gewählt – Unterthema
  assert.deepEqual(a.inhalte.map((x: any) => x.stelle).reverse(), [{ feld: 'netz', unterthema: 'subnetting' }, { feld: 'wiso', unterthema: '' }, null]);
  // ein älterer Wunsch ohne gespeicherte Kennungen findet die Stelle über die Titel
  w.u.db.prepare("UPDATE fehlermeldung SET ziel = '' WHERE thema = 'Netzwerkgrundlagen › Subnetting'").run();
  assert.deepEqual((await fuerAusbilder()).inhalte.at(-1).stelle, { feld: 'netz', unterthema: 'subnetting' });
  for (const wer of [w.bea, w.anna, chef]) assert.equal((await ruf(w.u, 'GET', '/api/rueckmeldungen', { cookies: als(w, wer) })).status, 403);
  assert.deepEqual((await fuerChef()).meldungen, [], 'der Super-Admin sieht Wünsche zu Lerninhalten nicht');
  const wunsch = a.inhalte[0].id;
  for (const [m, body] of [['PATCH', { status: 'erledigt' }], ['DELETE', undefined]] as const) assert.equal((await ruf(w.u, m, `/api/fehlermeldungen/${wunsch}`, { cookies: als(w, chef), body })).status, 404, `${m} als Super-Admin`);
  assert.equal((await ruf(w.u, 'GET', `/api/fehlermeldungen/${wunsch}/bild`, { cookies: als(w, chef) })).status, 404);
  assert.equal((await ruf(w.u, 'PATCH', `/api/rueckmeldungen/${wunsch}`, { cookies: als(w, w.bea), body: { status: 'erledigt' } })).status, 403);
  assert.equal((await ruf(w.u, 'PATCH', `/api/rueckmeldungen/${wunsch}`, { cookies: als(w, w.ausbilder), body: { status: 'egal' } })).status, 400);
  const e = koerper(await ruf(w.u, 'PATCH', `/api/rueckmeldungen/${wunsch}`, { cookies: als(w, w.ausbilder), body: { status: 'erledigt' } }));
  assert.equal(e.offen, 2);
  assert.equal(e.inhalte.at(-1).status, 'erledigt', 'offene zuerst');
  assert.equal(koerper(await ruf(w.u, 'DELETE', `/api/rueckmeldungen/${wunsch}`, { cookies: als(w, w.ausbilder) })).inhalte.length, 2);
  assert.equal((await ruf(w.u, 'DELETE', `/api/rueckmeldungen/${wunsch}`, { cookies: als(w, w.ausbilder) })).status, 404);

  // Idee fürs Portal: von jedem Konto, mit Name und Seite, ohne Technik und Bild
  assert.equal((await sende(w.bea, { art: 'idee', text: 'Ein Wochenüberblick für alle Azubis wäre gut.', seite: '/azubis', fenster: '1280 × 800', technik: 'x', bild: 'kein Bild' })).status, 201);
  const idee = w.u.db.prepare("SELECT * FROM fehlermeldung WHERE art = 'idee'").get() as any;
  assert.deepEqual([idee.benutzer_name, idee.rolle, idee.seite, idee.browser, idee.fenster, idee.technik, idee.bild], ['Bea', 'beauftragter', '/azubis', '', '', '', null]);
  const c = await fuerChef();
  assert.deepEqual(c.meldungen.map((m: any) => [m.art, m.name]), [['idee', 'Bea']]);
  const b = await fuerAusbilder();
  assert.deepEqual(b.ideen.map((x: any) => [x.name, x.rolle, x.seite, x.status]), [['Bea', 'beauftragter', '/azubis', 'offen']]);
  assert.equal(b.offen, 2, 'Ideen zählen bei den Ausbildern nicht als offen – sie lesen nur mit');
  // Ausbilder können eine Idee weder abhaken noch löschen
  for (const m of ['PATCH', 'DELETE'] as const) assert.equal((await ruf(w.u, m, `/api/rueckmeldungen/${idee.id}`, { cookies: als(w, w.ausbilder), body: m === 'PATCH' ? { status: 'erledigt' } : undefined })).status, 404);
  assert.equal(koerper(await ruf(w.u, 'PATCH', `/api/fehlermeldungen/${idee.id}`, { cookies: als(w, chef), body: { status: 'erledigt' } })).offen, 0);
  assert.equal((await fuerAusbilder()).ideen[0].status, 'erledigt');

  // ein Fehler bleibt beim Super-Admin
  assert.equal((await sende(w.anna, { text: 'Der Knopf reagiert nicht mehr.' })).status, 201);
  assert.deepEqual((await fuerChef()).meldungen.map((m: any) => m.art), ['fehler', 'idee']);
  assert.equal((await fuerAusbilder()).ideen.length, 1);

  // Grenze je Tag gilt auch ohne gespeicherte Person
  for (let i = 0; i < 9; i++) assert.equal((await sende(w.anna, { art: 'inhalt', text: `Noch ein Wunsch Nummer ${i}.` })).status, 201);
  assert.equal((await sende(w.anna, { art: 'inhalt', text: 'Und noch einer zu viel.' })).status, 429);
  assert.equal((await sende(w.ben, { art: 'inhalt', text: 'Ben darf noch schreiben.' })).status, 201);
});
