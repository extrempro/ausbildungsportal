import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { vergissLernpakete } from '../lernen';
import { frontmatter, parseThemaMarkdown } from '../lernen/parse';
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

test('Grafiken werden bereinigt: kein Skript, keine Ereignisse, keine fremden Verweise', () => {
  const svg = bereinigeSvg(SVG);
  assert.ok(svg.startsWith('<svg') && svg.includes('class="sv-box"'));
  for (const x of ['script', 'onload', 'alert', 'boese.example', '<?xml']) assert.equal(svg.includes(x), false, x);
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
  assert.deepEqual(sd.lernpakete, [{ id: 'fisi', titel: 'Fachinformatiker Systemintegration', stand: '2026-11-01', themenfelder: 2, unterthemen: 3, fehler: 0, meldungen: [] }]);
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
  assert.deepEqual(start.rang, { stufe: 0, name: null, noetig: 1, felder: 2, naechste: { stufe: 1, name: 'Holz', haben: 0 } });
  assert.deepEqual([start.themenfelder[0].abzeichen.stufe, start.themenfelder[0].abzeichen.fortschritt, /Gelb oder Grün/.test(start.themenfelder[0].abzeichen.fehlt)], [0, 0, true]);

  // Rot zählt nicht; das erste Gelb bringt Holz – und weil ein Themenfeld von zweien reicht, auch den Rang
  assert.deepEqual([(await setze('netz.subnetting', 'rot')).abzeichen, (await feld('netz')).stufe], [null, 0]);
  const erstes = await setze('netz.subnetting', 'gelb');
  assert.deepEqual([erstes.abzeichen, erstes.rang], [{ feld: 'netz', feldTitel: 'Netzwerkgrundlagen', stufe: 1, name: 'Holz' }, { stufe: 1, name: 'Holz' }]);
  assert.deepEqual(await feld('netz'), { stufe: 1, name: 'Holz', erreicht: '2026-11-10', fehlt: 'Noch 1 Unterthema bis Stein.', fortschritt: 50 });
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
  assert.deepEqual([bronze.stufe, bronze.fortschritt, /Silber, Gold und Meister kommen mit den Übungen/.test(bronze.fehlt)], [3, 100, true]);
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/lernen/thema/netz', { cookies: c })).thema.abzeichen.name, 'Bronze');

  // einmal erreicht bleibt: Ampel zurück auf Rot, Haken weg – das Abzeichen steht weiter da
  await setze('netz.subnetting', 'rot');
  await ruf(w.u, 'PATCH', '/api/lernen/zusatz/netz.planen', { cookies: c, body: { gelesen: false } });
  assert.deepEqual([(await feld('netz')).stufe, (await lies()).rang.stufe], [3, 3]);
  // … und es gibt die Stufe nicht ein zweites Mal
  assert.equal((await setze('netz.subnetting', 'gelb')).abzeichen, null);

  // zweites Themenfeld mit nur einem Unterthema und ohne Zusatzwissen: sofort Bronze
  assert.equal((await setze('wiso.vertrag', 'gruen')).abzeichen.name, 'Bronze');
  assert.equal((await lies()).rang.naechste, null, 'mehr als Bronze gibt es noch nicht');

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
