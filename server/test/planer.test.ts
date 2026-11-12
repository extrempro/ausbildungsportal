import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { pruefeLernpaketeSofort, vergissLernpakete } from '../lernen';
import { parsePlaner, planerKennungen } from '../lernen/planer';
import type { BenutzerZeile } from '../typen';
import { admin, koerper, konto, ohneWechsel, ruf, sitzung, umgebung, zuweisen } from './hilfe';

const PLANER = `---
titel: Abschlussprojekt
untertitel: Teil 2 · 50 % der Endnote
name-feld: Projekttitel
auftraggeber-feld: Auftraggeber
---

Dein Projekt Schritt für Schritt.

## Termine

Die Kammer gibt die Fristen vor.

- Projektantrag abgeben bis {#antrag} – Lieber früher hochladen.
- Präsentation am {#praesentation}

## Checkliste: Projektantrag {#antrag}

### Pflichtangaben
- Thema {#thema} – Was wird für wen umgesetzt?
- Projektziel {#ziel}

### Abgabe
- Im Portal eingereicht {#portal}

## Zeitplanung

hoechststunden: 40

Die Präsentation zählt nicht mit.

- Analyse: 4
- Umsetzung: 16,5

## Fragen: Fachgespräch {#gespraech}

timer: 15

Übe laut.

- Warum diese Lösung? {#warum}

## Links
- [Merkblatt](https://www.example.org/merkblatt.pdf) – von der Kammer
`;

/** Paket „fisi“ mit Planer, Paket „ohne“ ohne Planer. */
function inhalte(planer: string | null = PLANER): string {
  const dir = mkdtempSync(join(tmpdir(), 'planer-'));
  for (const name of ['fisi', 'ohne']) {
    const p = join(dir, name);
    mkdirSync(join(p, 'themen'), { recursive: true });
    writeFileSync(join(p, 'meta.json'), JSON.stringify({ stand: '2026-11-01' }));
    writeFileSync(join(p, 'themenfelder.json'), JSON.stringify([{ id: 'netz', icon: 'network', lernfelder: [], pruefung: [] }]));
    writeFileSync(join(p, 'themen', 'netz.md'), '---\ntitel: Netz\n---\n\nWorum es geht.\n\n## Subnetting {#subnetting}\n\n### Merksatz\nErst zählen, dann rechnen.\n');
  }
  if (planer !== null) writeFileSync(join(dir, 'fisi', 'planer.md'), planer);
  return dir;
}

async function welt(dir = inhalte()) {
  vergissLernpakete();
  const u = await umgebung({ LERN_DIR: dir });
  ohneWechsel(u.db, admin(u.db).id);
  const ausbilder = konto(u.db, 'ausbilder', 'Petra Lang');
  const fremd = konto(u.db, 'ausbilder', 'Fred Fremd');
  const bea = konto(u.db, 'beauftragter', 'Bea Auft');
  const anna = konto(u.db, 'azubi', 'Anna Azubi');
  const ben = konto(u.db, 'azubi', 'Ben Beispiel');
  const mia = konto(u.db, 'azubi', 'Mia Muster');
  const c = sitzung(u, ausbilder);
  const beruf = async (bezeichnung: string, lernpaket: string | null) => koerper(await ruf(u, 'POST', '/api/stammdaten/berufe', { cookies: c, body: { bezeichnung, fachrichtung: '', regeldauerMonate: 36, lernpaket } })).beruf.id as number;
  const fisi = await beruf('Fachinformatiker', 'fisi');
  const ohne = await beruf('Maler', 'ohne');
  const profil = (a: BenutzerZeile, body: Record<string, unknown>) => ruf(u, 'PUT', `/api/azubis/${a.id}/profil`, { cookies: c, body: { ausbildungsbeginn: '2025-08-01', ausbilderId: ausbilder.id, ...body } });
  for (const [a, b] of [[anna, fisi], [ben, fisi], [mia, ohne]] as const) assert.equal((await profil(a, { berufId: b })).status, 200);
  zuweisen(u.db, anna, bea);
  const als = (wer: BenutzerZeile) => sitzung(u, wer);
  return { u, dir, ausbilder, fremd, bea, anna, ben, mia, fisi, ohne, profil, als, admin: admin(u.db) };
}

test('Einleser: Termine, Checklisten, Zeitplanung, Fragen, Links – in der Reihenfolge der Datei', () => {
  const { planer, meldungen } = parsePlaner(PLANER);
  assert.deepEqual(meldungen, []);
  assert.ok(planer);
  assert.equal(planer.titel, 'Abschlussprojekt');
  assert.equal(planer.einleitung, 'Dein Projekt Schritt für Schritt.');
  assert.equal(planer.nameFeld, 'Projekttitel');
  assert.deepEqual(planer.termine, [
    { id: 'antrag', label: 'Projektantrag abgeben bis', hinweis: 'Lieber früher hochladen.' },
    { id: 'praesentation', label: 'Präsentation am', hinweis: '' },
  ]);
  assert.deepEqual(planer.abschnitte.map((a) => a.art), ['checkliste', 'zeitplanung', 'fragen']);
  const [liste, zeit, fragen] = planer.abschnitte;
  assert.ok(liste.art === 'checkliste' && zeit.art === 'zeitplanung' && fragen.art === 'fragen');
  assert.deepEqual(liste.gruppen.map((g) => [g.titel, g.punkte.map((p) => p.id)]), [['Pflichtangaben', ['thema', 'ziel']], ['Abgabe', ['portal']]]);
  assert.equal(liste.gruppen[0].punkte[0].hilfe, 'Was wird für wen umgesetzt?');
  assert.equal(zeit.hoechststunden, 40);
  assert.equal(zeit.hinweis, 'Die Präsentation zählt nicht mit.');
  assert.deepEqual(zeit.phasen, [{ name: 'Analyse', stunden: 4 }, { name: 'Umsetzung', stunden: 16.5 }]);
  assert.equal(fragen.timerMinuten, 15);
  assert.equal(fragen.einleitung, 'Übe laut.');
  assert.deepEqual(planer.links, [{ titel: 'Merkblatt', url: 'https://www.example.org/merkblatt.pdf', info: 'von der Kammer' }]);
  assert.deepEqual([...planerKennungen(planer)].sort(), ['antrag.portal', 'antrag.thema', 'antrag.ziel', 'gespraech.warum', 'termine.antrag', 'termine.praesentation']);
});

test('Einleser meldet Fehler mit Zeile – mit Fehlern gibt es keinen Planer', () => {
  const fehler = (roh: string) => {
    const r = parsePlaner(roh);
    assert.equal(r.planer, null);
    return r.meldungen.filter((m) => m.level === 'fehler');
  };
  assert.match(fehler(PLANER.replace('titel: Abschlussprojekt\n', ''))[0].text, /titel/);
  const ohneKennung = fehler(PLANER.replace('- Projektziel {#ziel}', '- Projektziel'));
  assert.match(ohneKennung[0].text, /keine Kennung/);
  assert.ok(ohneKennung[0].zeile && ohneKennung[0].zeile > 20);
  assert.match(fehler(PLANER.replace('{#ziel}', '{#thema}'))[0].text, /doppelt/);
  assert.match(fehler(PLANER.replace('{#gespraech}', '{#antrag}'))[0].text, /doppelt/, 'Checklisten und Fragen teilen sich die Kennungen');
  assert.match(fehler(PLANER.replace('Fachgespräch {#gespraech}', 'Fachgespräch {#termine}'))[0].text, /vergeben/);
  assert.match(fehler(PLANER.replace('- Analyse: 4', '- Analyse vier Stunden'))[0].text, /Name: Stunden/);
  assert.match(fehler(PLANER.replace('## Links', '## Sonstiges'))[0].text, /Unbekannter Abschnitt/);
  assert.match(fehler(PLANER.replace('https://www.example.org', 'http://www.example.org'))[0].text, /https/);
  assert.match(fehler('---\ntitel: Leer\n---\n\nNur Text.\n')[0].text, /leer/);
  // Umbenennungen: Ziel muss es geben, die alte Kennung darf es nicht mehr geben
  assert.deepEqual(parsePlaner(`${PLANER}\n## Umbenennungen\n- antrag.bezeichnung → antrag.thema\n- termine.abgabe -> termine.antrag\n`).planer?.umbenennungen, { 'antrag.bezeichnung': 'antrag.thema', 'termine.abgabe': 'termine.antrag' });
  assert.match(fehler(`${PLANER}\n## Umbenennungen\n- antrag.alt → antrag.gibt-es-nicht\n`)[0].text, /gibt es nicht/);
  assert.match(fehler(`${PLANER}\n## Umbenennungen\n- antrag.ziel → antrag.thema\n`)[0].text, /gibt es noch/);
});

test('Freischalten: nur Ausbilder, nur wenn das Paket des Berufs einen Planer hat; der Azubi erfährt es', async () => {
  const w = await welt();
  const ich = async (wer: BenutzerZeile) => koerper(await ruf(w.u, 'GET', '/api/ich', { cookies: w.als(wer) })).planer;
  assert.equal(await ich(w.anna), null, 'anfangs nicht freigeschaltet');
  assert.equal((await ruf(w.u, 'GET', '/api/planer', { cookies: w.als(w.anna) })).status, 404);

  const sicht = koerper(await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/profil`, { cookies: w.als(w.ausbilder) }));
  assert.equal(sicht.planerTitel, 'Abschlussprojekt');
  assert.equal(sicht.profil.planerFrei, false);
  assert.equal(koerper(await ruf(w.u, 'GET', `/api/azubis/${w.mia.id}/profil`, { cookies: w.als(w.ausbilder) })).planerTitel, null);

  // Beruf ohne Planer: lässt sich nicht freischalten
  const ohne = await w.profil(w.mia, { berufId: w.ohne, planerFrei: true });
  assert.equal(ohne.status, 400);
  assert.match(koerper(ohne).fehler, /keinen Planer/);
  // Beauftragte und fremde Ausbilder dürfen das Profil nicht ändern
  assert.equal((await ruf(w.u, 'PUT', `/api/azubis/${w.anna.id}/profil`, { cookies: w.als(w.bea), body: { berufId: w.fisi, planerFrei: true } })).status, 403);
  assert.equal((await ruf(w.u, 'PUT', `/api/azubis/${w.anna.id}/profil`, { cookies: w.als(w.fremd), body: { berufId: w.fisi, planerFrei: true } })).status, 404);

  assert.equal(koerper(await w.profil(w.anna, { berufId: w.fisi, planerFrei: true })).profil.planerFrei, true);
  assert.equal(await ich(w.anna), 'Abschlussprojekt');
  assert.equal(await ich(w.ben), null, 'gilt je Azubi');
  assert.equal(await ich(w.ausbilder), null);
  // Glocke: der Azubi sieht es, der Ausbilder (hat es selbst getan) nicht
  const glocke = koerper(await ruf(w.u, 'GET', '/api/aktivitaeten', { cookies: w.als(w.anna) }));
  assert.equal(glocke.neu, 1);
  assert.equal(glocke.gruppen[0].art, 'planer_frei');
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/aktivitaeten', { cookies: w.als(w.ausbilder) })).neu, 0);
  // ohne Angabe bleibt die Freischaltung; noch einmal speichern meldet nichts Neues
  assert.equal(koerper(await w.profil(w.anna, { berufId: w.fisi })).profil.planerFrei, true);
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/aktivitaeten', { cookies: w.als(w.anna) })).neu, 1);

  // wieder sperren: der Bereich verschwindet, die Eintragungen bleiben
  await ruf(w.u, 'PUT', '/api/planer/angaben', { cookies: w.als(w.anna), body: { name: 'Monitoring', auftraggeber: 'IT' } });
  assert.equal(koerper(await w.profil(w.anna, { berufId: w.fisi, planerFrei: false })).profil.planerFrei, false);
  assert.equal(await ich(w.anna), null);
  assert.equal((await ruf(w.u, 'GET', '/api/planer', { cookies: w.als(w.anna) })).status, 404);
  await w.profil(w.anna, { berufId: w.fisi, planerFrei: true });
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/planer', { cookies: w.als(w.anna) })).daten.name, 'Monitoring');
});

test('Der Planer ist privat: keine Route für Ausbilder, Beauftragte und Super-Admin', async () => {
  const w = await welt();
  await w.profil(w.anna, { berufId: w.fisi, planerFrei: true });
  for (const wer of [w.ausbilder, w.bea, w.admin]) {
    assert.equal((await ruf(w.u, 'GET', '/api/planer', { cookies: w.als(wer) })).status, 403, wer.rolle);
    assert.equal((await ruf(w.u, 'PUT', '/api/planer/notizen', { cookies: w.als(wer), body: { text: 'x' } })).status, 403, wer.rolle);
  }
  assert.equal((await ruf(w.u, 'GET', '/api/planer')).status, 401);
  // ein anderer Azubi kommt nur an seinen eigenen Planer – und der ist nicht freigeschaltet
  assert.equal((await ruf(w.u, 'GET', '/api/planer', { cookies: w.als(w.ben) })).status, 404);
  // das Profil verrät nur die Freischaltung, nichts vom Inhalt
  await ruf(w.u, 'PUT', '/api/planer/angaben', { cookies: w.als(w.anna), body: { name: 'Geheimes Projekt', auftraggeber: 'Vorstand' } });
  await ruf(w.u, 'PUT', '/api/planer/notizen', { cookies: w.als(w.anna), body: { text: 'Geheime Notiz' } });
  for (const pfad of [`/api/azubis/${w.anna.id}/profil`, `/api/azubis/${w.anna.id}/plan`, '/api/azubis', '/api/aktivitaeten']) {
    const roh = JSON.stringify((await ruf(w.u, 'GET', pfad, { cookies: w.als(w.ausbilder) })).body);
    assert.equal(/Geheim|Vorstand/.test(roh), false, pfad);
  }
});

test('Eintragen: Angaben, Haken, Zeitplanung, Stichworte, Notizen', async () => {
  const w = await welt();
  await w.profil(w.anna, { berufId: w.fisi, planerFrei: true });
  const c = w.als(w.anna);
  const start = koerper(await ruf(w.u, 'GET', '/api/planer', { cookies: c }));
  assert.equal(start.planer.titel, 'Abschlussprojekt');
  assert.equal('umbenennungen' in start.planer, false);
  assert.deepEqual(start.daten.phasen, [{ name: 'Analyse', soll: 4, ist: 0 }, { name: 'Umsetzung', soll: 16.5, ist: 0 }], 'anfangs der Vorschlag des Pakets');
  assert.equal(start.daten.phasenVorschlag, true);

  assert.equal(koerper(await ruf(w.u, 'PUT', '/api/planer/angaben', { cookies: c, body: { name: ' Monitoring ', auftraggeber: 'IT-Leitung' } })).daten.name, 'Monitoring');
  assert.equal((await ruf(w.u, 'PUT', '/api/planer/angaben', { cookies: c, body: { name: 'x'.repeat(301) } })).status, 400);

  assert.deepEqual(koerper(await ruf(w.u, 'PATCH', '/api/planer/haken', { cookies: c, body: { id: 'antrag.thema', an: true } })).daten.haken, { 'antrag.thema': true });
  assert.deepEqual(koerper(await ruf(w.u, 'PATCH', '/api/planer/haken', { cookies: c, body: { id: 'antrag.thema', an: false } })).daten.haken, {});
  assert.equal((await ruf(w.u, 'PATCH', '/api/planer/haken', { cookies: c, body: { id: 'antrag.gibt-es-nicht', an: true } })).status, 404);
  assert.equal((await ruf(w.u, 'PATCH', '/api/planer/haken', { cookies: c, body: { id: 'gespraech.warum', an: true } })).status, 404, 'eine Frage ist kein Checklisten-Punkt');
  assert.equal((await ruf(w.u, 'PATCH', '/api/planer/haken', { cookies: c, body: { id: 'antrag.thema' } })).status, 400);

  const phasen = koerper(await ruf(w.u, 'PUT', '/api/planer/phasen', { cookies: c, body: { phasen: [{ name: 'Planung', soll: '8,3', ist: 2 }] } })).daten;
  assert.deepEqual(phasen.phasen, [{ name: 'Planung', soll: 8.25, ist: 2 }], 'auf Viertelstunden gerundet');
  assert.equal(phasen.phasenVorschlag, false);
  assert.equal((await ruf(w.u, 'PUT', '/api/planer/phasen', { cookies: c, body: { phasen: [{ name: '', soll: 1, ist: 0 }] } })).status, 400);
  assert.equal((await ruf(w.u, 'PUT', '/api/planer/phasen', { cookies: c, body: { phasen: [{ name: 'A', soll: -1, ist: 0 }] } })).status, 400);
  assert.equal((await ruf(w.u, 'PUT', '/api/planer/phasen', { cookies: c, body: { phasen: Array.from({ length: 21 }, (_, i) => ({ name: `P${i}`, soll: 1, ist: 0 })) } })).status, 400);
  assert.deepEqual(koerper(await ruf(w.u, 'PUT', '/api/planer/phasen', { cookies: c, body: { phasen: [] } })).daten.phasen, [], 'leer bleibt leer – der Vorschlag kommt nicht zurück');

  assert.deepEqual(koerper(await ruf(w.u, 'PUT', '/api/planer/antwort', { cookies: c, body: { id: 'gespraech.warum', text: 'Weil es passt.\nUnd günstig ist.' } })).daten.antworten, { 'gespraech.warum': 'Weil es passt.\nUnd günstig ist.' });
  assert.equal((await ruf(w.u, 'PUT', '/api/planer/antwort', { cookies: c, body: { id: 'antrag.thema', text: 'x' } })).status, 404);
  assert.deepEqual(koerper(await ruf(w.u, 'PUT', '/api/planer/antwort', { cookies: c, body: { id: 'gespraech.warum', text: ' ' } })).daten.antworten, {});

  assert.equal(koerper(await ruf(w.u, 'PUT', '/api/planer/notizen', { cookies: c, body: { text: 'Zeile 1\r\nZeile 2' } })).daten.notizen, 'Zeile 1\nZeile 2');
  assert.equal((await ruf(w.u, 'PUT', '/api/planer/notizen', { cookies: c, body: { text: 'x'.repeat(20001) } })).status, 400);
  // alles zusammen ist noch da
  const ende = koerper(await ruf(w.u, 'GET', '/api/planer', { cookies: c })).daten;
  assert.equal(ende.name, 'Monitoring');
  assert.equal(ende.auftraggeber, 'IT-Leitung');
  assert.equal(ende.notizen, 'Zeile 1\nZeile 2');
});

test('Termine stehen im Ausbildungsplan und im Jahreskalender – für alle, die den Azubi sehen; Betreuende erfahren die Änderung', async () => {
  const w = await welt();
  await w.profil(w.anna, { berufId: w.fisi, planerFrei: true, pruefungen: [{ bezeichnung: 'Abschlussprüfung Teil 1', datum: '2027-03-10' }] });
  const c = w.als(w.anna);
  await ruf(w.u, 'POST', '/api/aktivitaeten/gesehen', { cookies: c, body: { bis: 999 } });
  const setze = (termine: Record<string, unknown>) => ruf(w.u, 'PUT', '/api/planer/termine', { cookies: c, body: { termine } });
  assert.equal((await setze({ antrag: '2027-13-01' })).status, 400);
  assert.equal((await setze({ antrag: '1927-01-15' })).status, 400, 'Tippfehler im Jahr');
  assert.deepEqual(koerper(await setze({ antrag: '2027-01-15', praesentation: '2027-06-20', unbekannt: '2027-01-01' })).daten.termine, { antrag: '2027-01-15', praesentation: '2027-06-20' });

  for (const wer of [w.anna, w.ausbilder, w.bea]) {
    const plan = koerper(await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/plan`, { cookies: w.als(wer) }));
    assert.deepEqual(plan.pruefungen, [
      { bezeichnung: 'Abschlussprojekt: Projektantrag abgeben bis', datum: '2027-01-15', planer: true },
      { bezeichnung: 'Abschlussprüfung Teil 1', datum: '2027-03-10' },
      { bezeichnung: 'Abschlussprojekt: Präsentation am', datum: '2027-06-20', planer: true },
    ], wer.rolle);
  }
  assert.equal((await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/plan`, { cookies: w.als(w.fremd) })).status, 404, 'fremder Ausbilder sieht den Azubi nicht');
  const jahr = koerper(await ruf(w.u, 'GET', `/api/jahreskalender?jahr=2027`, { cookies: w.als(w.ausbilder) }));
  const zeile = (jahr.azubis as { id: number; pruefungen: { tag: string; bezeichnung: string }[] }[]).find((a) => a.id === w.anna.id)!;
  assert.deepEqual(zeile.pruefungen.map((p) => p.tag), ['2027-01-15', '2027-03-10', '2027-06-20']);

  // Glocke: Ausbilder und Beauftragte sehen „Termine geändert“ – ohne Inhalt; der Azubi selbst nicht
  for (const wer of [w.ausbilder, w.bea]) {
    const g = koerper(await ruf(w.u, 'GET', '/api/aktivitaeten', { cookies: w.als(wer) })).gruppen as { art: string; titel: string[] }[];
    assert.equal(g.filter((x) => x.art === 'planer_termine').length, 1, wer.rolle);
    assert.equal(/2027|Projektantrag/.test(JSON.stringify(g.filter((x) => x.art === 'planer_termine'))), false, 'weder Datum noch Bezeichnung');
  }
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/aktivitaeten', { cookies: c })).neu, 0);
  // dieselben Termine noch einmal speichern: keine neue Nachricht
  const vorher = (w.u.db.prepare("SELECT COUNT(*) AS n FROM aktivitaet WHERE art = 'planer_termine'").get() as { n: number }).n;
  await setze({ antrag: '2027-01-15' });
  assert.equal((w.u.db.prepare("SELECT COUNT(*) AS n FROM aktivitaet WHERE art = 'planer_termine'").get() as { n: number }).n, vorher);
  // Termin leeren → verschwindet aus dem Plan; gesperrter Planer → alle Planer-Termine verschwinden
  await setze({ antrag: '' });
  assert.equal(koerper(await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/plan`, { cookies: w.als(w.ausbilder) })).pruefungen.length, 2);
  await w.profil(w.anna, { berufId: w.fisi, planerFrei: false, pruefungen: [{ bezeichnung: 'Abschlussprüfung Teil 1', datum: '2027-03-10' }] });
  assert.deepEqual(koerper(await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/plan`, { cookies: w.als(w.ausbilder) })).pruefungen, [{ bezeichnung: 'Abschlussprüfung Teil 1', datum: '2027-03-10' }]);
});

test('Aktualisierung des Pakets: Eintragungen hängen an den Kennungen; Umbenennungen nehmen sie mit', async () => {
  const dir = inhalte();
  const w = await welt(dir);
  await w.profil(w.anna, { berufId: w.fisi, planerFrei: true });
  const c = w.als(w.anna);
  await ruf(w.u, 'PATCH', '/api/planer/haken', { cookies: c, body: { id: 'antrag.thema', an: true } });
  await ruf(w.u, 'PATCH', '/api/planer/haken', { cookies: c, body: { id: 'antrag.ziel', an: true } });
  await ruf(w.u, 'PUT', '/api/planer/termine', { cookies: c, body: { termine: { antrag: '2027-01-15' } } });
  await ruf(w.u, 'PUT', '/api/planer/antwort', { cookies: c, body: { id: 'gespraech.warum', text: 'Weil.' } });
  let zeit = Date.now() / 1000;
  const neu = (inhalt: string) => {
    writeFileSync(join(dir, 'fisi', 'planer.md'), inhalt);
    // wie im Betrieb: Das Portal merkt die geänderte Datei und liest das Paket neu ein
    zeit += 10;
    utimesSync(join(dir, 'fisi', 'planer.md'), zeit, zeit);
    pruefeLernpaketeSofort();
  };
  // Text geändert, Kennung gleich: Haken bleibt. Kennungen umbenannt und eingetragen: Haken, Termin und Stichworte ziehen mit.
  neu(
    PLANER.replace('- Thema {#thema}', '- Thema und Bezeichnung {#thema}')
      .replace('{#ziel}', '{#projektziel}')
      .replace('abgeben bis {#antrag}', 'abgeben bis {#abgabe}')
      .replace('{#warum}', '{#grund}') + '\n## Umbenennungen\n- antrag.ziel → antrag.projektziel\n- termine.antrag → termine.abgabe\n- gespraech.warum → gespraech.grund\n',
  );
  let d = koerper(await ruf(w.u, 'GET', '/api/planer', { cookies: c })).daten;
  assert.deepEqual(d.haken, { 'antrag.thema': true, 'antrag.projektziel': true });
  assert.deepEqual(d.termine, { abgabe: '2027-01-15' });
  assert.deepEqual(d.antworten, { 'gespraech.grund': 'Weil.' });
  assert.equal(koerper(await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/plan`, { cookies: w.als(w.ausbilder) })).pruefungen[0].datum, '2027-01-15');

  // Punkt gelöscht: der Haken bleibt gespeichert und ist wieder da, wenn die Kennung zurückkommt
  neu(PLANER.replace('- Thema {#thema} – Was wird für wen umgesetzt?\n', ''));
  assert.equal((await ruf(w.u, 'PATCH', '/api/planer/haken', { cookies: c, body: { id: 'antrag.thema', an: false } })).status, 404);
  await ruf(w.u, 'PATCH', '/api/planer/haken', { cookies: c, body: { id: 'antrag.portal', an: true } });
  neu(PLANER);
  d = koerper(await ruf(w.u, 'GET', '/api/planer', { cookies: c })).daten;
  assert.equal(d.haken['antrag.thema'], true);
  assert.equal(d.haken['antrag.portal'], true);

  // fehlerhafte Datei: die zuletzt gültige Fassung gilt weiter
  neu(PLANER.replace('{#ziel}', ''));
  assert.equal(koerper(await ruf(w.u, 'GET', '/api/planer', { cookies: c })).planer.titel, 'Abschlussprojekt');
});

test('Paket ohne planer.md: kein Planer, keine Freischaltung', async () => {
  const w = await welt(inhalte(null));
  assert.equal(koerper(await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/profil`, { cookies: w.als(w.ausbilder) })).planerTitel, null, 'Paket ohne planer.md');
  assert.equal((await w.profil(w.anna, { berufId: w.fisi, planerFrei: true })).status, 400);
});
