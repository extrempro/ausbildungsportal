import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';

/**
 * Hilfen für die End-to-End-Tests: ein frisches Portal starten, Grunddaten anlegen, als eine Rolle im Browser anmelden.
 *
 * - Jede Testdatei startet ihr eigenes Portal mit leerem Datenordner auf einem freien Port und räumt danach auf.
 * - Angemeldet wird über die Entwicklungsanmeldung (DEV_ANMELDUNG) – ohne Microsoft. Der Super-Admin meldet sich mit Passwort an.
 * - Alle Namen und Inhalte hier sind erfunden. Echte Namen, Adressen oder Lerninhalte gehören nicht in die Tests.
 */

const WURZEL = fileURLToPath(new URL('..', import.meta.url));
export const BILDER = join(WURZEL, 'e2e', 'ergebnis');

export const ADMIN = { name: 'chef', start: 'Start-Passwort-2026!', passwort: 'Neues-Passwort-2026!' };
export const PETRA = 'petra.lang@firma.test';
export const BEA = 'bea.auft@firma.test';
export const ANNA = 'anna@firma.test';
export const BEN = 'ben@firma.test';

/** Schmale Breite, bei der nichts waagerecht überlaufen darf (Handy). */
export const HANDY = { breite: 390, hoehe: 780 };
export const PC = { breite: 1280, hoehe: 900 };

const tag = (d: Date) => d.toISOString().slice(0, 10);
/** Datum in n Tagen (JJJJ-MM-TT) */
export const inTagen = (n: number) => tag(new Date(Date.now() + n * 86_400_000));
/** Der Montag der Woche, in der das Datum liegt */
export function montagVon(datum: string): string {
  const d = new Date(`${datum}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return tag(d);
}

async function freierPort(): Promise<number> {
  return new Promise((ok, fehler) => {
    const s = createServer();
    s.once('error', fehler);
    s.listen(0, '127.0.0.1', () => {
      const a = s.address();
      s.close(() => (a && typeof a === 'object' ? ok(a.port) : fehler(new Error('kein Port'))));
    });
  });
}

/** Ein kleines erfundenes Lernmodul mit Planer – nur für die Tests. */
function schreibeLernmodul(dir: string): void {
  const p = join(dir, 'muster');
  mkdirSync(join(p, 'themen'), { recursive: true });
  writeFileSync(join(p, 'paket.json'), JSON.stringify({ titel: 'Musterberuf', quelle: 'Testdaten', lizenz: 'nur für Tests' }));
  writeFileSync(join(p, 'meta.json'), JSON.stringify({ stand: '2026-01-01' }));
  writeFileSync(join(p, 'themenfelder.json'), JSON.stringify([{ id: 'grundlagen', icon: 'book-open', lernfelder: ['LF 1'], pruefung: ['Teil 1'] }, { id: 'praxis', icon: 'book-open', lernfelder: [], pruefung: [] }]));
  writeFileSync(
    join(p, 'themen', 'grundlagen.md'),
    '---\ntitel: Grundlagen\n---\n\nDas Wichtigste zum Einstieg.\n\n## Begriffe {#begriffe}\n\n### Kernbegriffe\n- **Auftrag:** Was erledigt werden soll.\n- **Termin:** Bis wann es fertig sein muss.\n\n### Merksatz\nErst fragen, dann anfangen.\n\n## Ablauf {#ablauf}\n\n### Kernbegriffe\n- **Planen:** Schritte festlegen.\n\n## Zusatz: Mehr zum Planen {#planen}\ntyp: text\nzu: ablauf\n\nEin kurzer Text.\n\n### Vorgehen\n1. Aufschreiben\n2. Ordnen\n',
  );
  writeFileSync(join(p, 'themen', 'praxis.md'), '---\ntitel: Praxis\n---\n\nAus dem Alltag.\n\n## Werkzeug {#werkzeug}\n\n### Kernbegriffe\n- **Pflege:** Nach der Arbeit reinigen.\n');
  writeFileSync(
    join(p, 'planer.md'),
    '---\ntitel: Abschlussarbeit\nname-feld: Titel der Arbeit\n---\n\nDein Vorhaben Schritt für Schritt.\n\n## Termine\n\n- Abgabe am {#abgabe}\n\n## Checkliste: Vorbereitung {#vorbereitung}\n\n- Thema festgelegt {#thema}\n- Zeitplan gemacht {#zeitplan}\n',
  );
}

/** Spricht die API wie ein Browser an: merkt sich das Sitzungs-Cookie und schickt die Herkunft mit (Schutz gegen CSRF). */
export class Api {
  private cookie = '';
  constructor(private readonly url: string) {}

  async ruf<T = Record<string, any>>(methode: string, pfad: string, body?: unknown): Promise<T> {
    const r = await fetch(this.url + pfad, {
      method: methode,
      headers: { Origin: this.url, ...(this.cookie ? { Cookie: this.cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const gesetzt = r.headers.getSetCookie?.() ?? [];
    if (gesetzt.length) this.cookie = gesetzt.map((c) => c.split(';')[0]).join('; ');
    const text = await r.text();
    if (!r.ok) throw new Error(`${methode} ${pfad} → ${r.status}: ${text.slice(0, 300)}`);
    return (text ? JSON.parse(text) : {}) as T;
  }

  /** Status einer Antwort, ohne bei einem Fehler abzubrechen – für Rechte-Prüfungen. */
  async status(methode: string, pfad: string, body?: unknown): Promise<number> {
    const r = await fetch(this.url + pfad, {
      method: methode,
      headers: { Origin: this.url, ...(this.cookie ? { Cookie: this.cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    await r.arrayBuffer();
    return r.status;
  }

  async alsAdmin(passwort = ADMIN.passwort): Promise<this> {
    await this.ruf('POST', '/api/auth/lokal', { benutzername: ADMIN.name, passwort });
    return this;
  }

  async als(anmeldename: string): Promise<this> {
    await this.ruf('POST', '/api/auth/dev', { anmeldename });
    return this;
  }
}

export interface Grunddaten {
  petra: number;
  bea: number;
  anna: number;
  ben: number;
  beruf: number;
}

export interface Portal {
  url: string;
  browser: Browser;
  /** Fehler aus der Konsole aller Seiten (ohne erwartete 401/403/404 von Rechte-Prüfungen) */
  probleme: string[];
  api(): Api;
  /** Legt Konten, Beruf, Profile und Zuweisung an. `adminEingerichtet`: Der Super-Admin hat sein Startpasswort schon geändert (im Test der ersten Anmeldung). */
  grunddaten(o?: { adminEingerichtet?: boolean }): Promise<Grunddaten>;
  /** Neue Sitzung im Browser, angemeldet als dieses Konto. Das Angebot der Führung und des Begleiters ist schon weggeklickt. */
  seite(wer: string, o?: { breite?: number; hoehe?: number; dunkel?: boolean; mitAngeboten?: boolean }): Promise<Page>;
  /** Neue Sitzung ohne Anmeldung */
  leer(o?: { breite?: number; hoehe?: number }): Promise<Page>;
  stop(): Promise<void>;
}

export async function startePortal(): Promise<Portal> {
  const port = await freierPort();
  const url = `http://127.0.0.1:${port}`;
  const ordner = mkdtempSync(join(tmpdir(), 'portal-e2e-'));
  mkdirSync(join(ordner, 'daten'));
  mkdirSync(join(ordner, 'lernen'));
  schreibeLernmodul(join(ordner, 'lernen'));

  let ausgabe = '';
  const server: ChildProcess = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    cwd: WURZEL,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(port),
      HOST: '127.0.0.1',
      APP_URL: url,
      DATA_DIR: join(ordner, 'daten'),
      LERN_DIR: join(ordner, 'lernen'),
      DEV_ANMELDUNG: 'true',
      ADMIN_BENUTZER: ADMIN.name,
      ADMIN_PASSWORT: ADMIN.start,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout?.on('data', (d: Buffer) => (ausgabe += d.toString()));
  server.stderr?.on('data', (d: Buffer) => (ausgabe += d.toString()));
  let beendet = false;
  server.once('exit', () => (beendet = true));

  // warten, bis das Portal antwortet
  for (let i = 0; ; i++) {
    if (beendet || i > 150) {
      server.kill();
      throw new Error(`Das Portal ist nicht gestartet:\n${ausgabe.slice(-2000)}`);
    }
    try {
      if ((await fetch(`${url}/api/auth/status`)).ok) break;
    } catch {
      /* noch nicht da */
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  const browser = await chromium.launch();
  const probleme: string[] = [];
  const seiten: Page[] = [];

  async function neu(opt: { breite?: number; hoehe?: number; dunkel?: boolean } = {}): Promise<Page> {
    const ctx = await browser.newContext({ viewport: { width: opt.breite ?? PC.breite, height: opt.hoehe ?? PC.hoehe }, colorScheme: opt.dunkel ? 'dark' : 'light', locale: 'de-DE' });
    const page = await ctx.newPage();
    page.setDefaultTimeout(10_000);
    // 401/403/404 kommen bei Rechte-Prüfungen absichtlich vor
    page.on('console', (m) => m.type() === 'error' && !/status of 40[0-9]/.test(m.text()) && probleme.push(`${new URL(page.url()).pathname}: ${m.text()}`));
    page.on('pageerror', (e) => probleme.push(`${new URL(page.url()).pathname}: ${String(e)}`));
    seiten.push(page);
    return page;
  }

  const portal: Portal = {
    url,
    browser,
    probleme,
    api: () => new Api(url),
    async grunddaten(g = {}) {
      const admin = new Api(url);
      if (g.adminEingerichtet) await admin.alsAdmin();
      else {
        // beim ersten Start gilt das Startpasswort und muss geändert werden
        await admin.alsAdmin(ADMIN.start);
        await admin.ruf('PUT', '/api/ich/passwort', { alt: ADMIN.start, neu: ADMIN.passwort });
      }
      const konto = async (wer: Api, rolle: string, anmeldename: string, anzeigename: string) => (await wer.ruf('POST', '/api/konten', { rolle, anmeldename, anzeigename })).konto.id as number;
      const petra = await konto(admin, 'ausbilder', PETRA, 'Petra Lang');
      const bea = await konto(admin, 'beauftragter', BEA, 'Bea Auft');
      const p = await new Api(url).als(PETRA);
      const anna = await konto(p, 'azubi', ANNA, 'Anna Azubi');
      const ben = await konto(p, 'azubi', BEN, 'Ben Beispiel');
      const beruf = (await p.ruf('POST', '/api/stammdaten/berufe', { bezeichnung: 'Musterberuf', fachrichtung: '', regeldauerMonate: 36, lernpaket: 'muster' })).beruf.id as number;
      // Anna ist seit gut einem Jahr dabei, mit Lernmodul und freigeschaltetem Planer; Ben hat noch kein Profil
      await p.ruf('PUT', `/api/azubis/${anna}/profil`, { ausbildungsbeginn: inTagen(-400), berufId: beruf, ausbilderId: petra, urlaubstage: 30, planerFrei: true });
      await p.ruf('PUT', `/api/azubis/${anna}/zuweisungen`, { zuweisungen: [{ beauftragterId: bea }] });
      return { petra, bea, anna, ben, beruf };
    },
    async seite(wer, opt = {}) {
      const page = await neu(opt);
      if (wer === ADMIN.name) {
        await page.goto(`${url}/super`);
        await page.fill('input[name=benutzername]', ADMIN.name);
        await page.fill('input[name=passwort]', ADMIN.passwort);
        await page.press('input[name=passwort]', 'Enter');
      } else {
        await page.goto(`${url}/`);
        await page.click('summary:has-text("Entwicklung")');
        await page.fill('details:has-text("Entwicklung") input', wer);
        await page.click('button:has-text("Ohne Microsoft anmelden")');
      }
      // am Handy ist die obere Navigation ausgeblendet – es reicht, dass sie da ist
      await page.waitForSelector('.haupt-nav', { state: 'attached' });
      await page.waitForLoadState('networkidle');
      if (!opt.mitAngeboten) {
        // die Führung merkt sich der Browser, den Begleiter das Konto – die Angebote stören sonst jeden weiteren Schritt
        await page.locator('.fuehrung-angebot button:has-text("Später")').click({ timeout: 1500 }).catch(() => undefined);
        await page.locator('.begleiter-angebot button:has-text("Nein danke")').click({ timeout: 1500 }).catch(() => undefined);
      }
      return page;
    },
    leer: (opt) => neu(opt),
    async stop() {
      await browser.close().catch(() => undefined);
      if (!beendet) {
        server.kill('SIGTERM');
        await new Promise((r) => (beendet ? r(null) : server.once('exit', r)));
      }
      rmSync(ordner, { recursive: true, force: true });
    },
  };
  // für Bildschirmfotos im Fehlerfall
  (portal as Portal & { seiten: Page[] }).seiten = seiten;
  return portal;
}

/** Bildschirmfotos aller offenen Seiten – wird aufgerufen, wenn ein Test scheitert. */
export async function fotografiere(portal: Portal, name: string): Promise<void> {
  mkdirSync(BILDER, { recursive: true });
  const seiten = (portal as Portal & { seiten: Page[] }).seiten.filter((s) => !s.isClosed());
  for (const [i, s] of seiten.entries()) {
    await s.screenshot({ path: join(BILDER, `${name.replace(/[^a-z0-9äöüß]+/gi, '-').slice(0, 60)}-${i + 1}.png`), fullPage: true }).catch(() => undefined);
  }
}

/** Führt einen Testschritt aus; scheitert er, entstehen Bildschirmfotos unter e2e/ergebnis/. */
export function mitFoto(portal: () => Portal, name: string, fn: () => Promise<void>): () => Promise<void> {
  return async () => {
    try {
      await fn();
    } catch (e) {
      await fotografiere(portal(), name);
      // was auf den offenen Seiten steht, hilft im Log mehr als die nackte Fehlermeldung
      for (const seite of (portal() as Portal & { seiten: Page[] }).seiten.filter((x) => !x.isClosed())) {
        const kurz = await seite.evaluate(() => `${location.pathname} | ${(document.querySelector('main')?.textContent ?? document.body.textContent ?? '').replace(/\s+/g, ' ').slice(0, 400)}`).catch(() => '');
        if (kurz) console.log(`  offen: ${kurz}`);
      }
      throw e;
    }
  };
}

/** Wie viele Pixel die Seite breiter ist als das Fenster – 0 heißt: kein waagerechter Überlauf. */
export const ueberlauf = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Text eines Elements, Leerraum zusammengezogen */
export const text = async (page: Page, sel: string) => ((await page.locator(sel).first().textContent()) ?? '').replace(/\s+/g, ' ').trim();

/** Geht im Portal zu einer Seite und wartet, bis sie steht. */
export async function oeffne(page: Page, url: string, pfad: string): Promise<void> {
  await page.goto(url + pfad);
  await page.waitForSelector('main h1');
  await page.waitForLoadState('networkidle');
}
