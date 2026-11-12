import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

// Verweise aus der Oberfläche ins Handbuch (<HandbuchLink kapitel="…">) müssen auf ein Kapitel zeigen, das es gibt.
// Sonst öffnet sich das Handbuch, ohne zur richtigen Stelle zu springen.

function dateien(ordner: string): string[] {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? dateien(join(ordner, e.name)) : e.name.endsWith('.tsx') ? [join(ordner, e.name)] : []));
}

const handbuch = readFileSync('src/pages/Handbuch.tsx', 'utf8');
const kapitel = new Set([...handbuch.matchAll(/\bid: '([a-z-]+)'/g)].map((m) => m[1]));

test('jeder HandbuchLink zeigt auf ein vorhandenes Kapitel', () => {
  let anzahl = 0;
  for (const datei of dateien('src')) {
    const quelle = readFileSync(datei, 'utf8');
    for (const m of quelle.matchAll(/<HandbuchLink\s+kapitel=(\{[^}]*\}|"[^"]*")/g)) {
      // feste Angabe oder Auswahl je Rolle: alle genannten Kapitel müssen stimmen
      const ids = [...m[1].matchAll(/["']([a-z-]+)["']/g)].map((x) => x[1]).filter((x) => !['azubi', 'ausbilder', 'beauftragter', 'admin'].includes(x));
      assert.ok(ids.length > 0, `${datei}: Kapitel nicht erkennbar in ${m[0]}`);
      for (const id of ids) assert.ok(kapitel.has(id), `${datei}: Kapitel „${id}“ gibt es im Handbuch nicht`);
      anzahl++;
    }
  }
  assert.ok(anzahl >= 15, `nur ${anzahl} Verweise gefunden – sucht der Test noch richtig?`);
});

test('Kapitel-Kennungen sind je Handbuch eindeutig und als Sprungmarke brauchbar', () => {
  for (const id of kapitel) assert.match(id, /^[a-z-]+$/);
  for (const [name, von, bis] of [['Azubi', 'const AZUBI', 'const BETREUUNG'], ['Super-Admin', 'const ADMIN', 'export function Handbuch']] as const) {
    const teil = handbuch.slice(handbuch.indexOf(von), handbuch.indexOf(bis));
    const ids = [...teil.matchAll(/\bid: '([a-z-]+)'/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, `${name}: doppelte Kapitel-Kennung`);
  }
});

// ---------- Einheitlicher Aufbau (docs/handbuch-regeln.md) ----------

interface KapitelQuelle {
  id: string;
  /** null, wenn der Titel berechnet wird (z. B. je Rolle verschieden) */
  titel: string | null;
  gruppe: string | null;
  quelle: string;
  zeile: number;
}

/** Zerlegt Handbuch.tsx in seine Kapitel: von „id: '…'“ bis zur schließenden Klammer des Objekts. */
function kapitelQuellen(): KapitelQuelle[] {
  const out: KapitelQuelle[] = [];
  for (const m of handbuch.matchAll(/\n( *)id: '([a-z-]+)',\n/g)) {
    const ab = m.index + m[0].length;
    const ende = handbuch.indexOf(`\n${m[1].slice(2)}}`, ab);
    const quelle = handbuch.slice(ab, ende);
    out.push({
      id: m[2],
      titel: /^ *titel: '([^']*)',$/m.exec(quelle)?.[1] ?? null,
      gruppe: /^ *gruppe: '([^']*)',$/m.exec(quelle)?.[1] ?? null,
      quelle,
      zeile: handbuch.slice(0, m.index).split('\n').length + 1,
    });
  }
  return out;
}

const GRUPPEN = [...(/const GRUPPEN = \[([^\]]+)\]/.exec(handbuch)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
const STANDARD = ["So geht's", 'Begriffe', 'Gut zu wissen'];
const MAX_ZEILEN = 100;
const MAX_TITEL = 70;

test('Handbuch: jedes Kapitel hat eine Gruppe, einen brauchbaren Titel und bleibt überschaubar', () => {
  const alle = kapitelQuellen();
  assert.ok(alle.length >= 40, `nur ${alle.length} Kapitel gefunden – sucht der Test noch richtig?`);
  assert.ok(GRUPPEN.length >= 5, 'Liste der Gruppen nicht gefunden');
  for (const k of alle) {
    const wo = `Kapitel „${k.id}“ (Zeile ${k.zeile})`;
    assert.ok(k.gruppe, `${wo}: „gruppe“ fehlt`);
    assert.ok(GRUPPEN.includes(k.gruppe), `${wo}: Gruppe „${k.gruppe}“ gibt es nicht – erlaubt: ${GRUPPEN.join(', ')}`);
    if (k.titel !== null) {
      assert.ok(k.titel.length >= 4 && k.titel.length <= MAX_TITEL, `${wo}: Titel hat ${k.titel.length} Zeichen (erlaubt 4 bis ${MAX_TITEL})`);
      assert.ok(!/[.!]$/.test(k.titel), `${wo}: Titel endet nicht mit Punkt oder Ausrufezeichen`);
    }
    const zeilen = k.quelle.split('\n').length;
    assert.ok(zeilen <= MAX_ZEILEN, `${wo}: ${zeilen} Zeilen – höchstens ${MAX_ZEILEN}. Bitte teilen (Dateiformate gehören in die Gruppe „Dateien und Formate“).`);
  }
  // jede Gruppe wird benutzt – sonst steht eine leere Überschrift in der Vorgabe
  for (const g of GRUPPEN) assert.ok(alle.some((k) => k.gruppe === g), `Gruppe „${g}“ hat kein Kapitel`);
});

test('Handbuch: jedes Kapitel beginnt mit einem einleitenden Satz und hält die Reihenfolge der Abschnitte ein', () => {
  for (const k of kapitelQuellen()) {
    const wo = `Kapitel „${k.id}“ (Zeile ${k.zeile})`;
    const inhalt = k.quelle.slice(k.quelle.indexOf('inhalt:'));
    // erstes Element des Inhalts: ein Absatz (auch wenn der Inhalt je Rolle verschieden ist)
    const erstes = /<(?!>)(\w+)/.exec(inhalt)?.[1];
    assert.equal(erstes, 'p', `${wo}: beginnt mit <${erstes}> statt mit einem einleitenden Absatz <p>`);

    // „So geht's“ → „Begriffe“ → „Gut zu wissen“: jede höchstens einmal, in dieser Reihenfolge
    const h3 = [...inhalt.matchAll(/<h3>([^<{]+)<\/h3>/g)].map((m) => m[1].trim());
    const standard = h3.filter((t) => STANDARD.includes(t));
    assert.equal(new Set(standard).size, standard.length, `${wo}: eine der Überschriften ${STANDARD.join(' / ')} kommt doppelt vor`);
    assert.deepEqual(standard, [...standard].sort((a, b) => STANDARD.indexOf(a) - STANDARD.indexOf(b)), `${wo}: Reihenfolge muss „So geht's“ → „Begriffe“ → „Gut zu wissen“ sein`);
    // alte Schreibweisen derselben Abschnitte
    for (const t of h3) assert.ok(!/^(So gehst du vor|So gehts|Schritte|Hinweise|Tipps|Wichtig|Gut zu Wissen)$/i.test(t) || STANDARD.includes(t), `${wo}: Überschrift „${t}“ – dafür gibt es ${STANDARD.join(' / ')}`);

    // keine Liste ohne Überschrift davor
    const ersteH3 = inhalt.indexOf('<h3>');
    for (const [marke, name] of [['<ol className="schritte">', "So geht's"], ['<dl className="begriffe">', 'Begriffe'], ['<ul className="punkte">', 'Gut zu wissen']] as const) {
      const i = inhalt.indexOf(marke);
      if (i >= 0) assert.ok(ersteH3 >= 0 && ersteH3 < i, `${wo}: Liste ohne Überschrift davor – erwartet <h3>${name}</h3> oder eine eigene Zwischenüberschrift`);
    }
  }
});
