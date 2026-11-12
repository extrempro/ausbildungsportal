import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { Fehler, idAus, koerper, text } from './api-basis';
import type { Ctx, Kontext, Route } from './api-basis';
import { lernpakete, portalLernDir, pruefeLernpaketeSofort } from './lernen';
import { planerKennungen } from './lernen/planer';
import { ladeInhalte, unterthemaIndex, zusatzIds } from './lernen/store';
import type { Inhalte } from './lernen/store';
import { benachrichtige, teamsKarteEinreichung } from './meldungen';
import { protokolliere } from './protokoll';
import { leseZip, ZipFehler } from './zip';
import type { ZipDatei } from './zip';

/**
 * Lerninhalte einreichen.
 * Ablauf: Ein Ausbilder lädt ein Inhaltspaket als ZIP hoch → das Portal prüft es sofort mit dem Einleser des Lernmoduls
 * (mit Fehlern wird nichts angenommen) → der Super-Admin sieht die Einreichung, kann die ZIP-Datei herunterladen und
 * gibt sie mit einer Rückmeldung zurück oder übernimmt sie. Übernommene Pakete liegen unter <DATA_DIR>/lerninhalte/<kennung>
 * und gelten sofort; sie gehen vor ein gleichnamiges Paket aus LERN_DIR.
 * Lerninhalte sind keine Daten über Personen – deshalb darf der Super-Admin sie sehen.
 */
export const ZIP_MAX = 15 * 1024 * 1024;
const GRENZEN = { maxDateien: 600, maxDatei: 5 * 1024 * 1024, maxGesamt: 40 * 1024 * 1024 };
const KENNUNG = /^[a-z0-9][a-z0-9-]{0,30}$/;
/** was aus dem Archiv übernommen wird – alles andere bleibt draußen */
const ERLAUBT = [/^(paket|meta|themenfelder|umbenennungen)\.json$/, /^planer\.md$/, /^themen\/[a-z0-9-]+\.md$/, /^bilder\/[A-Za-z0-9._-]+\.svg$/, /^zusatz\/[A-Za-z0-9._-]+\.json$/, /^(CHANGELOG\.md|LICENSE)$/];

type Status = 'eingereicht' | 'zurueck' | 'hochgeladen' | 'zurueckgezogen';
interface Zeile {
  id: number;
  kennung: string;
  titel: string;
  ausbilder_id: number | null;
  ausbilder_name: string;
  notiz: string;
  groesse: number;
  pruefung: string;
  status: Status;
  rueckmeldung: string;
  geprueft_von: string;
  geprueft_am: string | null;
  erstellt: string;
}
const SPALTEN = 'id, kennung, titel, ausbilder_id, ausbilder_name, notiz, groesse, pruefung, status, rueckmeldung, geprueft_von, geprueft_am, erstellt';

interface Pruefung {
  titel: string;
  stand: string;
  themenfelder: number;
  unterthemen: number;
  dateien: number;
  /** Titel des Planers aus planer.md; leer oder fehlend = das Paket hat keinen */
  planer?: string;
  /** Folgen für vorhandene Daten, die der Ausbilder vor dem Einreichen bestätigt hat (z. B. fehlende Kennungen) */
  achtung?: string[];
  fehler: string[];
  warnungen: string[];
  /** Dateien im Archiv, die nicht zu einem Inhaltspaket gehören und nicht übernommen werden */
  ignoriert: string[];
}

/** Sucht das Paket im Archiv (der Ordner mit themenfelder.json) und gibt seine Dateien ohne den Ordner davor zurück. */
function paketDateien(alle: ZipDatei[]): { dateien: ZipDatei[]; ignoriert: string[] } {
  const katalog = alle.filter((d) => d.name === 'themenfelder.json' || d.name.endsWith('/themenfelder.json')).sort((a, b) => a.name.length - b.name.length)[0];
  if (!katalog) throw new Fehler(422, 'In der ZIP-Datei fehlt die Datei themenfelder.json – sie gehört in den obersten Ordner des Inhaltspakets');
  const davor = katalog.name.slice(0, -'themenfelder.json'.length);
  const dateien: ZipDatei[] = [];
  const ignoriert: string[] = [];
  for (const d of alle) {
    const name = d.name.startsWith(davor) ? d.name.slice(davor.length) : null;
    if (name !== null && ERLAUBT.some((r) => r.test(name))) dateien.push({ name, daten: d.daten });
    else ignoriert.push(d.name);
  }
  return { dateien, ignoriert };
}

function schreibe(ziel: string, dateien: ZipDatei[]): void {
  for (const d of dateien) {
    const pfad = join(ziel, d.name);
    mkdirSync(dirname(pfad), { recursive: true });
    writeFileSync(pfad, d.daten);
  }
}

/** Entpackt und prüft ein eingereichtes Archiv mit dem Einleser des Lernmoduls. */
function pruefe(zip: Buffer): { pruefung: Pruefung; dateien: ZipDatei[]; inhalte: Inhalte } {
  let alle: ZipDatei[];
  try {
    alle = leseZip(zip, GRENZEN);
  } catch (e) {
    if (e instanceof ZipFehler) throw new Fehler(422, e.message);
    throw e;
  }
  const { dateien, ignoriert } = paketDateien(alle);
  const ordner = mkdtempSync(join(tmpdir(), 'lernpaket-'));
  try {
    schreibe(ordner, dateien);
    const inhalte = ladeInhalte(ordner);
    const zeile = (m: { datei: string; zeile?: number; text: string }) => `${m.datei}${m.zeile ? `:${m.zeile}` : ''} – ${m.text}`;
    let titel = '';
    try {
      const info = JSON.parse(dateien.find((d) => d.name === 'paket.json')?.daten.toString('utf8') ?? '{}') as { titel?: unknown };
      if (typeof info.titel === 'string') titel = info.titel.trim().slice(0, 200);
    } catch {
      // ein kaputtes paket.json meldet die Liste unten nicht – hier reicht: kein Titel
    }
    return {
      dateien,
      inhalte,
      pruefung: {
        titel,
        stand: inhalte.meta.stand,
        themenfelder: inhalte.themenfelder.length,
        unterthemen: inhalte.themenfelder.reduce((n, f) => n + f.unterthemen.length, 0),
        dateien: dateien.length,
        // Titel des Planers (planer.md) – leer, wenn das Paket keinen hat
        planer: inhalte.planer?.titel ?? '',
        fehler: inhalte.meldungen.filter((m) => m.level === 'fehler').map(zeile),
        warnungen: inhalte.meldungen
          .filter((m) => m.level !== 'fehler')
          .slice(0, 50)
          .map(zeile),
        ignoriert: ignoriert.slice(0, 50),
      },
    };
  } finally {
    rmSync(ordner, { recursive: true, force: true });
  }
}

const aufzaehlung = (ids: string[]) => `${ids.slice(0, 12).join(', ')}${ids.length > 12 ? ` … und ${ids.length - 12} weitere` : ''}`;

/**
 * Was eine neue Fassung für vorhandene Daten bedeutet – der Ausbilder bestätigt das vor dem Einreichen:
 * Kennungen, die es bisher gab und die jetzt fehlen (daran hängen Lernstand und Eintragungen im Planer),
 * und ein Paket, das der Betreiber schon als Ordner einbindet (dann gilt künftig die Einreichung).
 */
export function folgenDerEinreichung(k: Kontext, kennung: string, neu: Inhalte): string[] {
  const alt = lernpakete(k).get(kennung);
  if (!alt) return [];
  const out: string[] = [];
  if (alt.herkunft === 'ordner') {
    out.push(`Ein Lernmodul mit der Kennung „${kennung}“ bindet der Betreiber schon als Ordner auf dem Server ein. Wird deine Einreichung hochgeladen, gilt ab dann sie – spätere Änderungen im Ordner kommen nicht mehr an. Je Lernmodul sollte es nur einen Weg geben.`);
  }
  const neueThemen = new Set([...unterthemaIndex(neu).keys(), ...zusatzIds(neu)]);
  const fehlt = [...unterthemaIndex(alt.inhalte).keys(), ...zusatzIds(alt.inhalte)].filter((id) => !neueThemen.has(id) && !(id in neu.umbenennungen));
  if (fehlt.length) {
    out.push(`${fehlt.length === 1 ? 'Eine Kennung' : `${fehlt.length} Kennungen`} aus den Cheatsheets ${fehlt.length === 1 ? 'fehlt' : 'fehlen'} in der neuen Fassung: ${aufzaehlung(fehlt)}. Der Lernstand der Azubis dazu ist dann nicht mehr zu sehen. Wurde eine Kennung nur umbenannt, gehört sie in umbenennungen.json.`);
  }
  if (alt.inhalte.planer) {
    if (!neu.planer) {
      out.push(`Die neue Fassung enthält keinen Planer mehr (planer.md fehlt). Azubis, für die „${alt.inhalte.planer.titel}“ freigeschaltet ist, sehen ihn dann nicht mehr; ihre Eintragungen bleiben gespeichert.`);
    } else {
      const neuePunkte = planerKennungen(neu.planer);
      const weg = [...planerKennungen(alt.inhalte.planer)].filter((id) => !neuePunkte.has(id) && !(id in neu.planer!.umbenennungen));
      if (weg.length) {
        out.push(`${weg.length === 1 ? 'Eine Kennung' : `${weg.length} Kennungen`} aus dem Planer ${weg.length === 1 ? 'fehlt' : 'fehlen'} in der neuen Fassung: ${aufzaehlung(weg)}. Was Azubis dort eingetragen haben (Haken, Termine, Stichworte), ist dann nicht mehr zu sehen. Wurde eine Kennung nur umbenannt, gehört sie in planer.md unter „## Umbenennungen“.`);
      }
    }
  }
  return out;
}

function ansicht(c: Ctx, z: Zeile) {
  const offen = z.status === 'eingereicht';
  const admin = c.b.rolle === 'admin';
  return {
    id: z.id,
    kennung: z.kennung,
    titel: z.titel,
    ausbilder: z.ausbilder_name,
    eigene: z.ausbilder_id === c.b.id,
    notiz: z.notiz,
    groesse: z.groesse,
    pruefung: JSON.parse(z.pruefung) as Pruefung,
    status: z.status,
    rueckmeldung: z.rueckmeldung,
    geprueftVon: z.geprueft_von,
    geprueftAm: z.geprueft_am,
    erstellt: z.erstellt,
    /** gibt es schon ein Paket mit dieser Kennung? Dann ersetzt die Übernahme es. */
    ersetzt: lernpakete(c.k).has(z.kennung),
    rechte: { zurueckziehen: offen && z.ausbilder_id === c.b.id, entscheiden: offen && admin, laden: offen && (admin || z.ausbilder_id === c.b.id) },
  };
}

function hole(c: Ctx): Zeile {
  const z = c.k.db.prepare(`SELECT ${SPALTEN} FROM lern_einreichung WHERE id = ?`).get(idAus(c.p.id)) as Zeile | undefined;
  if (!z) throw new Fehler(404, 'Nicht gefunden');
  return z;
}
const zipVon = (c: Ctx, id: number) => (c.k.db.prepare('SELECT zip FROM lern_einreichung WHERE id = ?').get(id) as { zip: Uint8Array | null } | undefined)?.zip ?? null;

export const EINREICHUNG_ROUTEN: Route[] = [
  {
    // Alle Einreichungen: Ausbilder arbeiten mit denselben Lernmodulen, deshalb sehen sie auch die der anderen
    m: 'GET',
    p: '/api/lernpakete/einreichungen',
    wer: ['ausbilder', 'admin'],
    h: (c) => {
      const zeilen = c.k.db.prepare(`SELECT ${SPALTEN} FROM lern_einreichung ORDER BY (status = 'eingereicht') DESC, erstellt DESC LIMIT 100`).all() as unknown as Zeile[];
      return { status: 200, body: { offen: zeilen.filter((z) => z.status === 'eingereicht').length, maxMb: ZIP_MAX / 1024 / 1024, einreichungen: zeilen.map((z) => ansicht(c, z)) } };
    },
  },
  {
    // Hochladen: der Körper ist die ZIP-Datei selbst; Kennung und Notiz stehen in der Adresse
    m: 'POST',
    p: '/api/lernpakete/einreichungen',
    wer: ['ausbilder'],
    h: (c) => {
      const kennung = (c.a.query.get('kennung') ?? '').trim().toLowerCase();
      if (!KENNUNG.test(kennung)) throw new Fehler(400, 'Die Kennung darf nur Kleinbuchstaben, Ziffern und Bindestriche enthalten (höchstens 31 Zeichen), z. B. „kauffrau-bueromanagement“');
      const notiz = text(c.a.query.get('notiz') ?? '', 500, 'Die Notiz', false);
      if (!Buffer.isBuffer(c.a.body) || c.a.body.length === 0) throw new Fehler(400, 'Es wurde keine ZIP-Datei mitgeschickt');
      if (c.a.body.length > ZIP_MAX) throw new Fehler(413, `Die ZIP-Datei ist zu groß (höchstens ${ZIP_MAX / 1024 / 1024} MB)`);
      const offen = c.k.db.prepare("SELECT ausbilder_name FROM lern_einreichung WHERE kennung = ? AND status = 'eingereicht'").get(kennung) as { ausbilder_name: string } | undefined;
      if (offen) throw new Fehler(409, `Für „${kennung}“ liegt schon eine Einreichung von ${offen.ausbilder_name} zur Prüfung vor. Sie muss erst entschieden oder zurückgezogen werden.`);
      const { pruefung, inhalte } = pruefe(c.a.body);
      // mit Fehlern nimmt das Portal nichts an – die Liste sagt, was zu beheben ist
      if (pruefung.fehler.length) return { status: 422, body: { fehler: `Das Inhaltspaket hat ${pruefung.fehler.length === 1 ? 'einen Fehler' : `${pruefung.fehler.length} Fehler`} und wurde nicht eingereicht. Bitte beheben und erneut hochladen.`, pruefung } };
      if (pruefung.themenfelder === 0) throw new Fehler(422, 'Das Inhaltspaket enthält kein Themenfeld');
      // Folgen für vorhandene Daten: erst zeigen, dann – nach der Bestätigung – mit einreichen, damit sie auch der Super-Admin sieht
      const achtung = folgenDerEinreichung(c.k, kennung, inhalte);
      if (achtung.length && c.a.query.get('bestaetigt') !== '1') return { status: 409, body: { fehler: 'Bitte bestätige erst, was die neue Fassung für vorhandene Daten bedeutet.', achtung } };
      if (achtung.length) pruefung.achtung = achtung;
      const r = c.k.db
        .prepare('INSERT INTO lern_einreichung (kennung, titel, ausbilder_id, ausbilder_name, notiz, groesse, pruefung, erstellt, zip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(kennung, pruefung.titel, c.b.id, c.b.anzeigename, notiz, c.a.body.length, JSON.stringify(pruefung), c.k.jetzt().toISOString(), c.a.body);
      protokolliere(c.k.db, c.k.jetzt(), 'fach', 'lerninhalte_eingereicht', c.b, null, `Paket ${kennung}`);
      c.k.log(`Lerninhalte eingereicht: Paket „${kennung}“ (${pruefung.themenfelder} Themenfelder)`);
      // derselbe Teams-Kanal wie bei Fehlermeldungen – damit der Super-Admin von der Einreichung erfährt
      if (c.k.cfg.fehlerWebhook) void benachrichtige(c.k, teamsKarteEinreichung(c.k, { kennung, titel: pruefung.titel, themenfelder: pruefung.themenfelder, unterthemen: pruefung.unterthemen }));
      return { status: 201, body: { einreichung: ansicht(c, hole({ ...c, p: { id: String(r.lastInsertRowid) } })) } };
    },
  },
  {
    m: 'GET',
    p: '/api/lernpakete/einreichungen/:id/zip',
    wer: ['ausbilder', 'admin'],
    h: (c) => {
      const z = hole(c);
      if (c.b.rolle !== 'admin' && z.ausbilder_id !== c.b.id) throw new Fehler(403, 'Die ZIP-Datei kann nur laden, wer sie eingereicht hat');
      const zip = zipVon(c, z.id);
      if (!zip) throw new Fehler(404, 'Die ZIP-Datei ist nicht mehr gespeichert – sie wird nach der Entscheidung gelöscht');
      return { status: 200, datei: { typ: 'application/zip', inhalt: Buffer.from(zip), dateiname: `${z.kennung}-einreichung-${z.id}.zip` } };
    },
  },
  {
    m: 'POST',
    p: '/api/lernpakete/einreichungen/:id/zurueckziehen',
    wer: ['ausbilder'],
    h: (c) => {
      const z = hole(c);
      if (z.ausbilder_id !== c.b.id) throw new Fehler(403, 'Zurückziehen kann nur, wer eingereicht hat');
      if (z.status !== 'eingereicht') throw new Fehler(409, 'Die Einreichung ist schon entschieden');
      c.k.db.prepare("UPDATE lern_einreichung SET status = 'zurueckgezogen', zip = NULL WHERE id = ?").run(z.id);
      return { status: 200, body: { einreichung: ansicht(c, hole(c)) } };
    },
  },
  {
    // Zurückgeben: immer mit Rückmeldung, damit der Ausbilder weiß, was zu ändern ist
    m: 'POST',
    p: '/api/lernpakete/einreichungen/:id/zurueckgeben',
    wer: ['admin'],
    h: (c) => {
      const z = hole(c);
      if (z.status !== 'eingereicht') throw new Fehler(409, 'Die Einreichung ist schon entschieden');
      const rueckmeldung = text(koerper(c).rueckmeldung, 2000, 'Die Rückmeldung');
      c.k.db.prepare("UPDATE lern_einreichung SET status = 'zurueck', rueckmeldung = ?, geprueft_von = ?, geprueft_am = ?, zip = NULL WHERE id = ?").run(rueckmeldung, c.b.anzeigename, c.k.jetzt().toISOString(), z.id);
      protokolliere(c.k.db, c.k.jetzt(), 'fach', 'lerninhalte_zurueckgegeben', c.b, null, `Paket ${z.kennung}`);
      return { status: 200, body: { einreichung: ansicht(c, hole(c)) } };
    },
  },
  {
    // Übernehmen: Das Paket wird entpackt, noch einmal geprüft und ersetzt ein vorhandenes mit derselben Kennung
    m: 'POST',
    p: '/api/lernpakete/einreichungen/:id/uebernehmen',
    wer: ['admin'],
    h: (c) => {
      const z = hole(c);
      if (z.status !== 'eingereicht') throw new Fehler(409, 'Die Einreichung ist schon entschieden');
      const kommentar = text(koerper(c).kommentar ?? '', 2000, 'Der Kommentar', false);
      const zip = zipVon(c, z.id);
      if (!zip) throw new Fehler(409, 'Die ZIP-Datei fehlt');
      const { pruefung, dateien } = pruefe(Buffer.from(zip));
      if (pruefung.fehler.length) throw new Fehler(409, 'Das Inhaltspaket hat Fehler und lässt sich nicht übernehmen');
      const wurzel = portalLernDir(c.k.cfg);
      const ziel = join(wurzel, z.kennung);
      const neu = `${ziel}.neu`;
      const alt = `${ziel}.alt`;
      try {
        mkdirSync(wurzel, { recursive: true });
        rmSync(neu, { recursive: true, force: true });
        rmSync(alt, { recursive: true, force: true });
        schreibe(neu, dateien);
        // erst wenn alles geschrieben ist, den Ordner tauschen – so gibt es nie ein halbes Paket
        if (existsSync(ziel)) renameSync(ziel, alt);
        renameSync(neu, ziel);
        rmSync(alt, { recursive: true, force: true });
      } catch (e) {
        rmSync(neu, { recursive: true, force: true });
        if (!existsSync(ziel) && existsSync(alt)) renameSync(alt, ziel);
        c.k.log(`Lerninhalte übernehmen fehlgeschlagen (${z.kennung}): ${(e as Error).message}`);
        throw new Fehler(500, 'Das Inhaltspaket ließ sich nicht speichern. Der Datenordner des Portals muss beschreibbar sein – Näheres steht im Log.');
      }
      c.k.db.prepare("UPDATE lern_einreichung SET status = 'hochgeladen', rueckmeldung = ?, geprueft_von = ?, geprueft_am = ?, zip = NULL WHERE id = ?").run(kommentar, c.b.anzeigename, c.k.jetzt().toISOString(), z.id);
      protokolliere(c.k.db, c.k.jetzt(), 'fach', 'lerninhalte_hochgeladen', c.b, null, `Paket ${z.kennung}`);
      c.k.log(`Lerninhalte übernommen: Paket „${z.kennung}“ aus Einreichung ${z.id}`);
      pruefeLernpaketeSofort();
      return { status: 200, body: { einreichung: ansicht(c, hole(c)) } };
    },
  },
];
