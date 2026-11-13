import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from 'playwright';
import { ADMIN, ANNA, BEA, BEN, HANDY, inTagen, montagVon, PETRA, startePortal } from './hilfe';
import type { Api } from './hilfe';

/**
 * Bildschirmfotos für docs/bilder/: startet ein frisches Portal mit erfundenen Daten und fotografiert eine feste Liste
 * von Ansichten – damit man sehen kann, wie das Portal aussieht, ohne es zu installieren.
 *
 * Aufruf: npm run bilder. Der Ordner wird dabei neu geschrieben; die Bilder gehören ins Repository.
 * Alle Namen und Inhalte sind erfunden. Echte Daten können nicht hineingeraten: Das Portal läuft mit leerem Datenordner.
 */

const ZIEL = fileURLToPath(new URL('../docs/bilder/', import.meta.url));
const VERSION = (JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')) as { version: string }).version;
const PC = { breite: 1280, hoehe: 860 };
// erfundene Unterschriften (das Feld ist 600 × 200 groß)
const UNTERSCHRIFT = [
  'M60 150 L95 50 L125 140 L160 60 L195 140 L235 80 L280 135 L340 105 L470 120 L540 100',
  'M70 110 L100 160 L135 45 L175 160 L210 85 L255 145 L310 95 L400 130 L520 110',
  'M65 130 L100 60 L140 150 L175 70 L225 140 L290 80 L370 120 L450 95 L530 115',
];

const woche = (n: number) => montagVon(inTagen(n * 7));
const plus = (datum: string, tage: number) => new Date(Date.parse(`${datum}T12:00:00Z`) + tage * 86_400_000).toISOString().slice(0, 10);

/** Mehr erfundener Lernstoff, damit „Lernen“ nicht leer aussieht. */
function reicherLernstoff(ordner: string): void {
  writeFileSync(
    join(ordner, 'themenfelder.json'),
    JSON.stringify([
      { id: 'grundlagen', icon: 'book-open', lernfelder: ['LF 1'], pruefung: ['Teil 1'] },
      { id: 'praxis', icon: 'book-open', lernfelder: ['LF 2'], pruefung: ['Teil 1'] },
      { id: 'kunden', icon: 'book-open', lernfelder: ['LF 4'], pruefung: ['Teil 2'] },
      { id: 'sicherheit', icon: 'book-open', lernfelder: ['LF 3'], pruefung: ['Teil 1', 'Teil 2'] },
    ]),
  );
  writeFileSync(
    join(ordner, 'themen', 'grundlagen.md'),
    `---
titel: Arbeitsaufträge
---

Vom Auftrag bis zur Übergabe: So gehst du eine Aufgabe an.

## Auftrag klären {#begriffe}

### Kernbegriffe
- **Ziel:** Was am Ende da sein soll.
- **Termin:** Bis wann es fertig sein muss.
- **Maßstab:** Woran man erkennt, dass es gut ist.

### Tabelle: Fragen vor dem Start
| Frage | Beispiel |
| --- | --- |
| Was soll entstehen? | Eine Liste aller Geräte im Lager |
| Bis wann? | Donnerstag, 12 Uhr |
| In welcher Form? | Als Tabelle |

### Merksatz
Erst fragen, dann anfangen.

## Schritte planen {#ablauf}

### Kernbegriffe
- **Teilschritt:** Ein Stück Arbeit, das du in einem Zug schaffst.
- **Puffer:** Freie Zeit vor dem Termin.

### Merksatz
Was zu groß zum Anfangen ist, ist noch nicht klein genug geteilt.

## Ergebnis prüfen {#pruefen}

### Kernbegriffe
- **Selbstkontrolle:** Ergebnis mit dem Auftrag vergleichen.
- **Übergabe:** Sagen, was fertig ist und was offen bleibt.

## Häufige Fehler
- Loslegen, ohne das Ziel zu kennen.
- Erst am Termin sagen, dass es nicht fertig wird.

## Zusatz: Dein Tag in drei Schritten {#planen}
typ: text
zu: ablauf

Ein Tagesplan braucht keine App – ein Zettel reicht.

### Morgens
1. Alles aufschreiben, was ansteht
2. Die wichtigste Aufgabe markieren
3. Zeiten schätzen

### Checkliste: Guter Tagesplan
- Passt auf einen Zettel
- Hat Luft für Unvorhergesehenes
`,
  );
  const einfach = (titel: string, worum: string, themen: [string, string, string][]) => `---\ntitel: ${titel}\n---\n\n${worum}\n\n${themen.map(([id, name, begriff]) => `## ${name} {#${id}}\n\n### Kernbegriffe\n- **${begriff}:** Kurze Erklärung für die Bildschirmfotos.\n- **Beispiel:** So sieht ein zweiter Begriff aus.\n`).join('\n')}`;
  writeFileSync(join(ordner, 'themen', 'praxis.md'), einfach('Werkzeug und Material', 'Womit du arbeitest und wie du es pflegst.', [['werkzeug', 'Werkzeug pflegen', 'Pflege'], ['lager', 'Material lagern', 'Lagerplatz'], ['bestellung', 'Material bestellen', 'Bestellmenge']]));
  writeFileSync(join(ordner, 'themen', 'kunden.md'), einfach('Kunden und Aufträge', 'Vom ersten Gespräch bis zur Rechnung.', [['gespraech', 'Das Kundengespräch', 'Bedarf'], ['angebot', 'Angebot schreiben', 'Angebot'], ['reklamation', 'Reklamationen', 'Kulanz']]));
  writeFileSync(join(ordner, 'themen', 'sicherheit.md'), einfach('Sicher arbeiten', 'Was dich und andere schützt.', [['schutz', 'Schutzausrüstung', 'Schutzbrille'], ['brand', 'Verhalten im Brandfall', 'Sammelplatz'], ['erste-hilfe', 'Erste Hilfe', 'Ersthelfer'], ['ergonomie', 'Heben und Tragen', 'Hebetechnik']]));
}

/** Füllt das Portal über die API mit erfundenem Inhalt. */
async function fuelle(url: string, api: () => Api, g: { petra: number; bea: number; anna: number; ben: number; beruf: number }) {
  const petra = await api().als(PETRA);
  const bea = await api().als(BEA);
  const anna = await api().als(ANNA);
  const ben = await api().als(BEN);

  await petra.ruf('PUT', '/api/stammdaten/betrieb', { name: 'Muster GmbH', anschrift: 'Beispielweg 1, 20095 Hamburg', bundesland: 'HH', personalMail: '', personalAnrede: '', berichtForm: 'woche' });
  const schule = (await petra.ruf('POST', '/api/stammdaten/berufsschulen', { name: 'Berufliche Schule Musterstadt', ort: 'Hamburg', bundesland: 'HH', form: 'block' })).berufsschule.id as number;
  const cem = (await petra.ruf('POST', '/api/konten', { rolle: 'azubi', anmeldename: 'cem@firma.test', anzeigename: 'Cem Kaya' })).konto.id as number;
  await petra.ruf('PUT', `/api/azubis/${g.anna}/profil`, { ausbildungsbeginn: inTagen(-470), berufId: g.beruf, berufsschuleId: schule, ausbilderId: g.petra, urlaubstage: 30, planerFrei: true, pruefungen: [{ bezeichnung: 'Abschlussprüfung Teil 1', datum: inTagen(75) }] });
  await petra.ruf('PUT', `/api/azubis/${g.ben}/profil`, { ausbildungsbeginn: inTagen(-105), berufId: g.beruf, berufsschuleId: schule, ausbilderId: g.petra, urlaubstage: 28 });
  await petra.ruf('PUT', `/api/azubis/${cem}/profil`, { ausbildungsbeginn: inTagen(-835), berufId: g.beruf, berufsschuleId: schule, ausbilderId: g.petra, urlaubstage: 30 });
  await petra.ruf('PUT', `/api/azubis/${g.ben}/zuweisungen`, { zuweisungen: [{ beauftragterId: g.bea }] });

  for (const [wer, pfad] of [[petra, UNTERSCHRIFT[0]], [bea, UNTERSCHRIFT[1]], [anna, UNTERSCHRIFT[2]], [ben, UNTERSCHRIFT[1]]] as const) await wer.ruf('PUT', '/api/ich/unterschrift', { pfad });

  // Ausbildungsplan: Einsätze, Berufsschule, eine Aufgabe
  const plan = (azubi: number, art: string, von: number, bis: number, titel: string, text = '') => petra.ruf('POST', `/api/azubis/${azubi}/plan`, { art, von: woche(von), bis: woche(bis), titel, text });
  await plan(g.anna, 'einsatz', -6, -1, 'Einkauf', 'Bestellungen, Lieferanten, Wareneingang');
  await plan(g.anna, 'einsatz', 0, 3, 'Lager und Versand', 'Kommissionierung, Verpackung, Versand');
  await plan(g.anna, 'schule', 4, 6, 'Blockunterricht');
  await plan(g.anna, 'einsatz', 7, 14, 'Kundendienst');
  await plan(g.anna, 'aufgabe', 0, 1, 'Inventurliste prüfen', 'Zählliste mit dem Bestand im System vergleichen');
  await plan(g.ben, 'einsatz', -4, 5, 'Werkstatt');
  await plan(g.ben, 'schule', 6, 8, 'Blockunterricht');
  await plan(cem, 'einsatz', -3, 2, 'Kundendienst');
  await plan(cem, 'schule', 3, 5, 'Blockunterricht');
  await petra.ruf('POST', '/api/stammdaten/firmentermine', { titel: 'Betriebsversammlung', von: inTagen(12) });
  await petra.ruf('POST', '/api/stammdaten/firmentermine', { titel: 'Betriebsferien', von: inTagen(40), bis: inTagen(47) });

  // Berichtsheft: abgezeichnet, zurückgegeben, eingereicht, Entwurf
  const bericht = async (wer: Api, azubi: number, n: number, zeilen: [string, number][], schuleStd = 0) => {
    const m = woche(n);
    await wer.ruf('PUT', `/api/azubis/${azubi}/berichte/${m}`, { inhalt: { betrieb: zeilen.map(([text, stunden]) => ({ text, stunden })), unterweisung: [], schule: schuleStd ? [{ text: 'Fachkunde und Wirtschaftslehre', stunden: schuleStd }] : [], abwesenheit: [] } });
    return m;
  };
  // alle Wochen seit dem Ausbildungsbeginn sind geschrieben und abgezeichnet – sonst stünde überall „Berichte fehlen“
  const abgezeichnet = async (wer: Api, azubi: number, ersteWoche: number, letzteWoche: number) => {
    const fertig: string[] = [];
    for (let n = ersteWoche; n <= letzteWoche; n++) {
      const m = await bericht(wer, azubi, n, [['Bestellungen geprüft und im System erfasst', 16], ['Lieferanten angerufen und Liefertermine abgestimmt', 12], ['Wareneingang kontrolliert', 10]]);
      await wer.ruf('POST', `/api/azubis/${azubi}/berichte/${m}/einreichen`, {});
      fertig.push(m);
    }
    for (let i = 0; i < fertig.length; i += 50) await petra.ruf('POST', '/api/berichte/abzeichnen', { berichte: fertig.slice(i, i + 50).map((montag) => ({ azubiId: azubi, montag })) });
  };
  await abgezeichnet(anna, g.anna, -66, -3);
  await abgezeichnet(ben, g.ben, -14, -2);
  const cemApi = await api().als('cem@firma.test');
  await cemApi.ruf('PUT', '/api/ich/unterschrift', { pfad: UNTERSCHRIFT[0] });
  await abgezeichnet(cemApi, cem, -118, -1);
  const zurueck = await bericht(anna, g.anna, -2, [['Im Einkauf gearbeitet', 38]]);
  await anna.ruf('POST', `/api/azubis/${g.anna}/berichte/${zurueck}/einreichen`, {});
  await petra.ruf('POST', `/api/azubis/${g.anna}/berichte/${zurueck}/zurueckgeben`, { kommentar: 'Bitte genauer: Was hast du im Einkauf gemacht?' });
  const offen = await bericht(anna, g.anna, -1, [['Angebote von drei Lieferanten verglichen', 14], ['Bestellung für Verpackungsmaterial vorbereitet', 10], ['Übergabe an das Lager vorbereitet', 14]]);
  await anna.ruf('POST', `/api/azubis/${g.anna}/berichte/${offen}/einreichen`, {});
  await bericht(anna, g.anna, 0, [['Einweisung im Lager: Lagerplätze und Scanner', 6], ['Aufträge kommissioniert', 10]]);
  const vonBen = await bericht(ben, g.ben, -1, [['Werkzeug gereinigt und einsortiert', 8], ['Bei der Wartung einer Maschine geholfen', 30]]);
  await ben.ruf('POST', `/api/azubis/${g.ben}/berichte/${vonBen}/einreichen`, {});

  // Urlaub: einer genehmigt, einer wartet
  const frei = woche(2);
  await anna.ruf('POST', `/api/azubis/${g.anna}/urlaub`, { von: frei, bis: plus(frei, 4) });
  const antrag = (await anna.ruf('GET', `/api/azubis/${g.anna}/urlaub`)).antraege[0].id as number;
  await bea.ruf('POST', `/api/urlaub/${antrag}/bestaetigen`, {});
  await petra.ruf('POST', `/api/urlaub/${antrag}/genehmigen`, {});
  const bruecke = woche(15);
  await anna.ruf('POST', `/api/azubis/${g.anna}/urlaub`, { von: bruecke, bis: plus(bruecke, 1), bemerkung: 'Umzug' });
  const benFrei = woche(5);
  await ben.ruf('POST', `/api/azubis/${g.ben}/urlaub`, { von: benFrei, bis: plus(benFrei, 2) });

  // Lernen, Planer, Begleiter – alles privat für Anna
  for (const [id, status, luecke] of [['grundlagen.begriffe', 'gruen', ''], ['grundlagen.ablauf', 'gruen', ''], ['grundlagen.pruefen', 'gelb', 'Übergabe noch einmal üben'], ['praxis.werkzeug', 'gruen', ''], ['praxis.lager', 'gelb', 'Lagerarten wiederholen'], ['sicherheit.schutz', 'gruen', ''], ['sicherheit.brand', 'gruen', '']] as const) {
    await anna.ruf('PATCH', `/api/lernen/unterthema/${id}`, { status, ...(luecke ? { luecke } : {}) });
  }
  await anna.ruf('PATCH', '/api/lernen/zusatz/grundlagen.planen', { gelesen: true });
  await anna.ruf('PUT', '/api/planer/angaben', { name: 'Neues Regalsystem für das Kleinteilelager' });
  await anna.ruf('PUT', '/api/planer/termine', { termine: { abgabe: inTagen(120) } });
  await anna.ruf('PATCH', '/api/planer/haken', { id: 'vorbereitung.thema', an: true });
  // Rückmeldungen: ein Wunsch zu den Lerninhalten (ohne Person), eine Idee, ein Fehler
  await anna.ruf('POST', '/api/fehlermeldungen', { art: 'inhalt', thema: 'lernen|grundlagen|ablauf', text: 'Beim Planen der Schritte würde mir ein Beispiel mit einem echten Auftrag helfen.' });
  await anna.ruf('POST', '/api/fehlermeldungen', { art: 'idee', seite: '/berichtsheft', text: 'Eine Erinnerung am Freitag, wenn der Bericht der Woche noch fehlt, wäre praktisch.' });
  await bea.ruf('POST', '/api/fehlermeldungen', { art: 'fehler', seite: '/urlaub', fenster: '1280 × 860', technik: '', text: 'Nach dem Bestätigen eines Antrags springt die Liste ganz nach oben.' });
  const begleiter = await anna.ruf('PUT', '/api/begleiter', { an: true, figur: 'fuchs', name: 'Fiete' });
  await anna.ruf('POST', '/api/begleiter/gefeiert', { stufe: begleiter.stufe });
  return { cem, url };
}

interface Bild {
  datei: string;
  titel: string;
  text: string;
}
const bilder: { gruppe: string; liste: Bild[] }[] = [];

async function main() {
  const p = await startePortal({ lernmodul: reicherLernstoff, deutsch: true });
  try {
    const g = await p.grunddaten();
    await fuelle(p.url, p.api, g);
    rmSync(ZIEL, { recursive: true, force: true });
    mkdirSync(ZIEL, { recursive: true });

    let gruppe: Bild[] = [];
    const abschnitt = (name: string) => bilder.push({ gruppe: name, liste: (gruppe = []) });
    /** Öffnet eine Seite, wartet, bis sie steht, und fotografiert sie. `vorher` kann noch etwas aufklappen oder anklicken. */
    const foto = async (s: Page, pfad: string | null, datei: string, titel: string, text: string, o: { vorher?: () => Promise<void>; ganz?: boolean } = {}) => {
      if (pfad !== null) {
        await s.goto(p.url + pfad);
        await s.waitForSelector('main h1');
        await s.waitForLoadState('networkidle');
        await s.evaluate(() => window.scrollTo(0, 0));
      }
      await o.vorher?.();
      // Passt die gebaute Oberfläche nicht zur Version des Servers, blendet das Portal „Das Portal wurde aktualisiert“ ein –
      // das stünde dann auf jedem Bild. Deshalb immer über „npm run bilder“ starten: Der Befehl baut vorher neu.
      if ((await s.locator('.meldung-zeile.update').count()) > 0) throw new Error('Auf der Seite steht „Das Portal wurde aktualisiert“: Die Oberfläche in dist/ ist älter als der Server. Bitte mit „npm run bilder“ starten (baut vorher neu).');
      // Bestätigungen unten („gespeichert“) und der Mauszeiger sollen nicht im Bild sein
      await s.mouse.move(0, 0);
      await s.waitForTimeout(400);
      // Ganze Seite: das Fenster so hoch machen wie die Seite. Mit „fullPage“ stünde Angeheftetes (der Begleiter in der Ecke)
      // mitten im Bild, nämlich dort, wo das Fenster vorher aufhörte.
      const fenster = s.viewportSize()!;
      if (o.ganz) {
        const hoehe = await s.evaluate(() => document.documentElement.scrollHeight);
        await s.setViewportSize({ width: fenster.width, height: Math.min(Math.max(hoehe, fenster.height), 6000) });
        await s.waitForTimeout(300);
      }
      await s.screenshot({ path: join(ZIEL, `${datei}.png`), animations: 'disabled' });
      if (o.ganz) await s.setViewportSize(fenster);
      gruppe.push({ datei: `${datei}.png`, titel, text });
    };
    /** Der Begleiter soll nur auf seinem eigenen Bild etwas sagen. */
    const ruhig = (s: Page) =>
      s.addInitScript(() => {
        const heute = new Date().toLocaleDateString('sv-SE');
        localStorage.setItem('begleiter-gruss', heute);
        localStorage.setItem('begleiter-erinnert-am', heute);
      });

    // ---------- Azubi ----------
    abschnitt('Azubi');
    let s = await p.seite(ANNA, PC);
    await ruhig(s);
    // einmal in die Glocke sehen: Die Zahl am Symbol verschwindet, die Einträge bleiben
    const gesehen = async (seite: Page) => {
      await seite.click('.glocke-knopf');
      await seite.waitForTimeout(600);
      await seite.keyboard.press('Escape');
    };
    await foto(s, '/', 'azubi-10-glocke', 'Die Glocke', 'Was es Neues gibt: abgezeichnete und zurückgegebene Berichte, Urlaub, neue Einträge im Plan.', {
      vorher: async () => {
        await s.click('.glocke-knopf');
        await s.waitForSelector('.menue.glocke li, .menue.glocke [class*=eintrag]').catch(() => undefined);
      },
    });
    await s.keyboard.press('Escape');
    await foto(s, '/', 'azubi-01-ausbildungsplan', 'Ausbildungsplan', 'Die Startseite der Azubis: was diese Woche ansteht, Kennzahlen zur Ausbildung und darunter jede Woche. Unten rechts sitzt der Begleiter.');
    await foto(s, '/berichtsheft', 'azubi-02-berichtsheft', 'Berichtsheft', 'Alle Wochen mit ihrem Stand: fehlt, Entwurf, eingereicht, zurückgegeben, abgezeichnet.');
    await foto(s, `/berichtsheft/${woche(0)}`, 'azubi-03-bericht-schreiben', 'Einen Bericht schreiben', 'Je Tätigkeit eine Zeile mit Stunden. Speichern als Entwurf oder einreichen.');
    await foto(s, `/berichtsheft/${woche(-3)}`, 'azubi-04-bericht-abgezeichnet', 'Abgezeichneter Bericht', 'Der fertige Ausbildungsnachweis mit beiden Unterschriften.', { ganz: true });
    await foto(s, '/urlaub', 'azubi-05-urlaub', 'Urlaub', 'Urlaubskonto, Antrag und der Stand der eigenen Anträge.', { ganz: true });
    await foto(s, '/jahreskalender', 'azubi-06-jahreskalender', 'Jahreskalender', 'Das eigene Jahr Tag für Tag: Berufsschule, Einsätze, Urlaub, Prüfungen.');
    await foto(s, '/lernen', 'azubi-07-lernen', 'Lernen', 'Themenfelder mit der eigenen Ampel und den Abzeichen. Diesen Lernstand sieht nur der Azubi selbst.', { ganz: true });
    await foto(s, '/lernen/grundlagen', 'azubi-08-lernen-thema', 'Ein Themenfeld', 'Das Cheatsheet mit Ampel und Notiz je Unterthema.');
    await foto(s, '/planer', 'azubi-09-planer', 'Planer für die Prüfung', 'Termine, Checklisten und Notizen zum Prüfungsvorhaben. Die Eintragungen sind privat – nur die Termine stehen im Ausbildungsplan.');
    await foto(s, '/', 'azubi-11-begleiter', 'Der Begleiter', 'Eine freiwillige Figur, die mit der Ausbildungszeit Zubehör bekommt. Nur der Azubi sieht sie; es gibt keine Punkte und keinen Vergleich.', {
      vorher: async () => {
        await s.click('.begleiter-figur');
        await s.waitForSelector('.begleiter-fenster');
      },
    });
    await s.keyboard.press('Escape');
    await foto(s, '/konto', 'azubi-12-konto', 'Konto', 'Eigene Angaben, Ausbildungsdaten, Darstellung, Benachrichtigungen, Begleiter, Kalender-Abo und Unterschrift.', { ganz: true });
    await foto(s, '/lernen/grundlagen', 'azubi-14-rueckmeldung', 'Rückmeldung geben', 'Die zwei Daumen oben in der Leiste: Fehler melden, eine Idee fürs Portal schicken oder – nur Azubis – einen Lerninhalt besser erklärt haben wollen. Im Lernmodul ist das Thema schon gewählt; dieser Wunsch geht ohne Namen an die Ausbilder.', {
      vorher: async () => {
        await s.click('button[aria-label="Rückmeldung geben"]');
        await s.waitForSelector('[role=dialog] .melden-art');
      },
    });
    await s.keyboard.press('Escape');
    await foto(s, '/lernen/grundlagen', 'azubi-15-navi-eingeklappt', 'Navigation eingeklappt', 'Am PC lässt sich die Navigation links zu einer schmalen Leiste einklappen; die Themenfelder stehen dann als Nummern mit Ampel-Punkt. Der Browser merkt sich das.', {
      vorher: async () => {
        await s.click('button[aria-label="Themenfelder einklappen"]');
      },
    });
    await s.click('button[aria-label="Themenfelder ausklappen"]');
    await foto(s, '/lernen/grundlagen', 'azubi-16-lesemodus', 'Lesemodus', 'Auf Lernseiten und im Handbuch blendet der Lesemodus Menü und Navigation aus; die Schrift wird größer. Beenden mit dem Knopf oben rechts oder mit Escape.', {
      vorher: async () => {
        await s.click('.ansicht-knoepfe button:has-text("Lesemodus")');
        await s.waitForSelector('.lesemodus-ende');
      },
    });
    await s.keyboard.press('Escape');
    await foto(s, '/handbuch', 'azubi-13-handbuch', 'Handbuch', 'Jede Rolle hat ihr eigenes Handbuch mit Inhaltsverzeichnis und Suche.');
    await s.context().close();

    // ---------- Ausbilder ----------
    abschnitt('Ausbilderin');
    s = await p.seite(PETRA, PC);
    await gesehen(s);
    await foto(s, '/', 'ausbilder-01-start', 'Startseite', 'Was zu tun ist: Berichte, die auf eine Unterschrift warten, Urlaubsanträge und die eigenen Azubis.');
    await foto(s, '/azubis', 'ausbilder-02-azubis', 'Azubis', 'Alle Azubis, für die die Ausbilderin zuständig ist.');
    await foto(s, `/azubis/${g.anna}`, 'ausbilder-03-azubi', 'Ein Azubi', 'Profil, Zuständigkeit und Zuweisungen. Vom Lernstand, vom Begleiter und von den Eintragungen im Planer steht hier nichts – die Ausbilderin sieht sie nicht.', { ganz: true });
    await foto(s, `/azubis/${g.anna}/plan`, 'ausbilder-04-plan', 'Ausbildungsplan eines Azubis', 'Einsätze, Berufsschule und Aufgaben planen.');
    await foto(s, '/abzeichnen', 'ausbilder-05-abzeichnen', 'Berichte abzeichnen', 'Eingereichte Berichte lesen, abzeichnen oder mit einem Kommentar zurückgeben.', {
      vorher: async () => {
        await s.locator('.abz-gruppe button:has-text("Lesen"), .abz-gruppe summary:has-text("Lesen")').first().click();
        await s.waitForSelector('.abz-gruppe :text("Angebote von drei Lieferanten")').catch(() => undefined);
      },
      ganz: true,
    });
    await foto(s, '/urlaub', 'ausbilder-06-urlaub', 'Urlaubsanträge', 'Erst bestätigen die Ausbildungsbeauftragten, dann genehmigt die Ausbilderin.', { ganz: true });
    await foto(s, '/jahreskalender', 'ausbilder-07-jahreskalender', 'Jahreskalender', 'Wer ist wann wo: je Azubi eine Zeile mit Schule, Einsätzen und Urlaub.');
    await foto(s, '/lerninhalte/muster/grundlagen', 'ausbilder-08-lerninhalte', 'Lerninhalte ansehen', 'Ausbilder und Beauftragte sehen die Lerninhalte nur zum Lesen – ohne Ampel, Notizen und Abzeichen der Azubis.');
    await foto(s, '/lerninhalte', 'ausbilder-11-lerninhalte-verwalten', 'Lerninhalte verwalten', 'Je Lernmodul eine Karte mit Stand und Berufen. Ausbilder reichen neue Fassungen ein; eine andere Ausbilderin prüft sie, bevor sie ins Portal kommen.', { ganz: true });
    await foto(s, '/rueckmeldungen', 'ausbilder-12-rueckmeldungen', 'Rückmeldungen', 'Wünsche der Azubis zu den Lerninhalten – ohne Namen, mit Sprung an die Stelle im Lernmodul – und die Ideen fürs Portal zum Mitlesen.', { ganz: true });
    await foto(s, '/verwaltung/stammdaten', 'ausbilder-09-stammdaten', 'Stammdaten', 'Betrieb, Berufe, Berufsschulen, Abteilungen und Firmentermine.');
    await foto(s, '/verwaltung/konten', 'ausbilder-10-konten', 'Konten', 'Ausbilder legen Konten für Azubis und Beauftragte an.');
    await s.context().close();

    // ---------- Beauftragte ----------
    abschnitt('Ausbildungsbeauftragte');
    s = await p.seite(BEA, PC);
    await gesehen(s);
    await foto(s, '/', 'beauftragte-01-start', 'Startseite', 'Ausbildungsbeauftragte sehen nur die Azubis, die ihnen zugewiesen sind.');
    await foto(s, '/urlaub', 'beauftragte-02-urlaub', 'Urlaub bestätigen', 'Beauftragte bestätigen einen Antrag; genehmigen kann nur die Ausbilderin.', { ganz: true });
    await s.context().close();

    // ---------- Super-Admin ----------
    abschnitt('Super-Admin');
    s = await p.seite(ADMIN.name, PC);
    await foto(s, '/verwaltung/konten', 'admin-01-konten', 'Konten', 'Der Super-Admin verwaltet Konten. Berichte, Pläne und Urlaub sieht er nicht.');
    await foto(s, '/verwaltung/protokoll', 'admin-02-protokoll', 'Protokoll', 'Anmeldungen und Änderungen – ohne Inhalte von Berichten und Plänen.');
    await foto(s, '/verwaltung/meldungen', 'admin-04-meldungen', 'Rückmeldungen', 'Fehlermeldungen und Ideen fürs Portal. Wünsche zu den Lerninhalten sieht der Super-Admin nicht – die gehen nur an die Ausbilder.', { ganz: true });
    await foto(s, '/verwaltung/erscheinungsbild', 'admin-03-erscheinungsbild', 'Erscheinungsbild', 'Logo des Betriebs und der Schalter für den Begleiter der Azubis.', { ganz: true });
    await s.context().close();

    // ---------- Handy und dunkel ----------
    abschnitt('Am Handy und in dunkler Darstellung');
    s = await p.seite(ANNA, { ...HANDY, schaerfe: 2 });
    await ruhig(s);
    await foto(s, '/', 'handy-01-ausbildungsplan', 'Ausbildungsplan am Handy', 'Die Navigation steht unten, der Kopf des Begleiters oben neben der Glocke.');
    await foto(s, `/berichtsheft/${woche(0)}`, 'handy-02-bericht', 'Bericht schreiben am Handy', 'Dieselben Felder, untereinander.');
    await foto(s, '/lernen/grundlagen', 'handy-03-lernen', 'Lernen am Handy', 'Cheatsheet mit Ampel. Die Zeile „Inhalt“ bleibt beim Rollen stehen und zeigt, wo man gerade liest.');
    await foto(s, '/lernen/grundlagen', 'handy-05-lernen-inhalt', 'Inhalt am Handy', 'Aufgeklappt führt „Inhalt“ zu jedem Themenfeld und Unterthema.', {
      vorher: async () => {
        await s.click('.lern-navi-klapp summary');
      },
    });
    await s.context().close();
    s = await p.seite(PETRA, { ...HANDY, schaerfe: 2 });
    await foto(s, '/abzeichnen', 'handy-04-abzeichnen', 'Abzeichnen am Handy', 'Auch Ausbilder und Beauftragte können alles am Handy erledigen.');
    await s.context().close();
    s = await p.seite(ANNA, { ...PC, dunkel: true });
    await ruhig(s);
    await foto(s, '/', 'dunkel-01-ausbildungsplan', 'Dunkle Darstellung', 'Hell, dunkel oder automatisch wie das Gerät – einstellbar unter „Konto“.');
    await s.context().close();
    s = await p.seite(ANNA, { ...HANDY, dunkel: true, schaerfe: 2 });
    await ruhig(s);
    await foto(s, '/berichtsheft', 'dunkel-02-berichtsheft-handy', 'Dunkel am Handy', 'Das Berichtsheft in dunkler Darstellung.');
    await s.context().close();

    // ---------- Übersicht ----------
    const heute = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const zeilen = [
      '# So sieht das Ausbildungsportal aus',
      '',
      `Bildschirmfotos des Portals, Stand Version ${VERSION} (erzeugt am ${heute}).`,
      '',
      '**Alle Namen und Inhalte sind erfunden.** Die Bilder entstehen automatisch aus einem frisch gestarteten Portal mit Beispieldaten (`npm run bilder`) – echte Daten eines Betriebs können nicht darin vorkommen.',
      '',
      'In den Beispielen meldet sich jeder über eine Entwicklungsanmeldung an (so steht es auch im Protokoll); im Betrieb läuft die Anmeldung über Microsoft.',
      '',
      'Wer sieht was? Lernstand, Abzeichen, die Eintragungen im Planer und der Begleiter sind privat für den Azubi. Die Bilder der Ausbilderin, der Beauftragten und des Super-Admins zeigen deshalb nichts davon. Wünsche zu den Lerninhalten sind ohne Namen gespeichert.',
      '',
      ...bilder.flatMap((b) => [`## ${b.gruppe}`, '', ...[...b.liste].sort((x, y) => x.datei.localeCompare(y.datei)).flatMap((x) => [`### ${x.titel}`, '', x.text, '', `![${x.titel}](${x.datei})`, ''])]),
    ];
    writeFileSync(join(ZIEL, 'README.md'), `${zeilen.join('\n')}`);
    const anzahl = readdirSync(ZIEL).filter((d) => d.endsWith('.png')).length;
    console.log(`${anzahl} Bilder in docs/bilder/ geschrieben.`);
    if (p.probleme.length) console.log(`Fehler in der Konsole:\n  ${[...new Set(p.probleme)].join('\n  ')}`);
  } finally {
    await p.stop();
  }
}

await main();
