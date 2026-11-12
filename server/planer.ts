import { merkeAktivitaet } from './aktivitaet';
import { Fehler, istObjekt, koerper, text } from './api-basis';
import type { Ctx, Kontext, Route } from './api-basis';
import type { DB } from './db';
import { gueltigesDatum } from './kalender';
import { lernpakete, paketVon } from './lernen';
import type { Paket } from './lernen';
import { planerKennungen } from './lernen/planer';
import type { Planer } from './lernen/planer';

/**
 * Planer für das Prüfungsvorhaben eines Azubis – Abschlussprojekt, Gesellenstück, Fachaufgabe …
 *
 * - Was der Planer enthält (Name, Termine, Checklisten, Zeitplanung, Fragen, Links), steht im Inhaltspaket des Berufs
 *   in der Datei planer.md. Hat das Paket keine, gibt es für diesen Beruf keinen Planer.
 * - Ein Ausbilder schaltet den Planer je Azubi im Profil frei (azubi_profil.planer_frei).
 * - Die Eintragungen sind privat für den Azubi: Alle Routen hier sind nur für die Rolle Azubi und liefern nur die eigenen
 *   Daten. Für Ausbilder, Beauftragte und den Super-Admin gibt es keine Route und keine Zusammenfassung.
 * - Einzige Ausnahme sind die Termine: Sie stehen als Prüfungstermine im Ausbildungsplan (und Jahreskalender) und sind
 *   dort für alle sichtbar, die den Azubi sehen dürfen. Ändert der Azubi sie, steht das in der Glocke – ohne Inhalt.
 * - Eintragungen hängen an den Kennungen aus planer.md. Verschwindet eine Kennung, bleibt die Eintragung gespeichert
 *   und taucht wieder auf, wenn die Kennung zurückkommt. Umbenennungen stehen in planer.md unter „## Umbenennungen“.
 */

const MAX_PHASEN = 20;
const MAX_STUNDEN = 2000;

export interface Phase {
  name: string;
  soll: number;
  ist: number;
}

interface Zeile {
  name: string;
  auftraggeber: string;
  termine: string;
  haken: string;
  phasen: string | null;
  antworten: string;
  notizen: string;
  bekannt: string | null;
  geaendert: string;
}

interface Daten {
  name: string;
  auftraggeber: string;
  termine: Record<string, string>;
  haken: Record<string, true>;
  /** null = noch nicht angefangen – dann gilt der Vorschlag des Pakets */
  phasen: Phase[] | null;
  antworten: Record<string, string>;
  notizen: string;
  /** Kennungen, die der Azubi schon gesehen hat (für den Hinweis „Planer ergänzt“); null = noch nicht festgehalten */
  bekannt: string[] | null;
}

const LEER: Daten = { name: '', auftraggeber: '', termine: {}, haken: {}, phasen: null, antworten: {}, notizen: '', bekannt: null };

function json<T>(s: string | null, sonst: T): T {
  if (!s) return sonst;
  try {
    const x: unknown = JSON.parse(s);
    return x && typeof x === 'object' ? (x as T) : sonst;
  } catch {
    return sonst;
  }
}

/** Der Planer aus dem Inhaltspaket des Berufs – unabhängig davon, ob er für den Azubi freigeschaltet ist. */
export function planerDesBerufs(k: Kontext, azubiId: number): { paket: Paket; planer: Planer } | null {
  const paket = paketVon(k, { id: azubiId, rolle: 'azubi' });
  return paket?.inhalte.planer ? { paket, planer: paket.inhalte.planer } : null;
}

/** Der Planer eines Lernpakets (für die Prüfung im Profil, bevor der Beruf gespeichert ist). */
export function planerDesPakets(k: Kontext, paketId: string | null): Planer | null {
  return paketId ? (lernpakete(k).get(paketId)?.inhalte.planer ?? null) : null;
}

export function istFreigeschaltet(db: DB, azubiId: number): boolean {
  return (db.prepare('SELECT planer_frei AS f FROM azubi_profil WHERE benutzer_id = ?').get(azubiId) as { f: number } | undefined)?.f === 1;
}

/** Der Planer, den dieser Azubi benutzen kann: freigeschaltet und im Paket vorhanden – sonst null. */
export function planerFuer(k: Kontext, azubiId: number): { paket: Paket; planer: Planer } | null {
  return istFreigeschaltet(k.db, azubiId) ? planerDesBerufs(k, azubiId) : null;
}

/** Zieht Eintragungen von alten auf neue Kennungen um (planer.md, „## Umbenennungen“). Vorhandenes am Ziel bleibt. */
function benenneUm<T>(werte: Record<string, T>, um: Record<string, string>, vorsatz = ''): Record<string, T> {
  const out = { ...werte };
  for (const [alt, neu] of Object.entries(um)) {
    if (vorsatz && (!alt.startsWith(vorsatz) || !neu.startsWith(vorsatz))) continue;
    const a = alt.slice(vorsatz.length);
    const n = neu.slice(vorsatz.length);
    if (a in out) {
      if (!(n in out)) out[n] = out[a];
      delete out[a];
    }
  }
  return out;
}

function lies(db: DB, azubiId: number, paket: Paket, planer: Planer): Daten {
  const z = db.prepare('SELECT name, auftraggeber, termine, haken, phasen, antworten, notizen, bekannt, geaendert FROM planer WHERE azubi_id = ? AND paket = ?').get(azubiId, paket.id) as Zeile | undefined;
  if (!z) return { ...LEER };
  const ohneTermine = Object.fromEntries(Object.entries(planer.umbenennungen).filter(([a]) => !a.startsWith('termine.')));
  return {
    name: z.name,
    auftraggeber: z.auftraggeber,
    termine: benenneUm(json<Record<string, string>>(z.termine, {}), planer.umbenennungen, 'termine.'),
    haken: benenneUm(json<Record<string, true>>(z.haken, {}), ohneTermine),
    phasen: z.phasen === null ? null : json<Phase[]>(z.phasen, []),
    antworten: benenneUm(json<Record<string, string>>(z.antworten, {}), ohneTermine),
    notizen: z.notizen,
    // umbenannte Kennungen gelten als bekannt
    bekannt: z.bekannt === null ? null : json<string[]>(z.bekannt, []).map((id) => planer.umbenennungen[id] ?? id),
  };
}

function schreibe(db: DB, jetzt: Date, azubiId: number, paket: Paket, d: Daten): void {
  db.prepare(
    `INSERT INTO planer (azubi_id, paket, name, auftraggeber, termine, haken, phasen, antworten, notizen, bekannt, geaendert) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(azubi_id, paket) DO UPDATE SET name = excluded.name, auftraggeber = excluded.auftraggeber, termine = excluded.termine, haken = excluded.haken,
       phasen = excluded.phasen, antworten = excluded.antworten, notizen = excluded.notizen, bekannt = excluded.bekannt, geaendert = excluded.geaendert`,
  ).run(azubiId, paket.id, d.name, d.auftraggeber, JSON.stringify(d.termine), JSON.stringify(d.haken), d.phasen === null ? null : JSON.stringify(d.phasen), JSON.stringify(d.antworten), d.notizen, d.bekannt === null ? null : JSON.stringify(d.bekannt), jetzt.toISOString());
}

/**
 * Die eingetragenen Termine des Planers als Prüfungstermine – für Ausbildungsplan, Jahreskalender, Urlaub und Kalender-Abo.
 * Nur solange der Planer freigeschaltet ist und der Termin im Paket noch vorkommt.
 */
export function planerTermine(k: Kontext, azubiId: number): { bezeichnung: string; datum: string; planer: true }[] {
  const p = planerFuer(k, azubiId);
  if (!p || p.planer.termine.length === 0) return [];
  const d = lies(k.db, azubiId, p.paket, p.planer);
  return p.planer.termine
    .filter((t) => gueltigesDatum(d.termine[t.id]))
    .map((t) => ({ bezeichnung: `${p.planer.titel}: ${t.label}`, datum: d.termine[t.id], planer: true as const }))
    .sort((a, b) => a.datum.localeCompare(b.datum));
}

/** Prüfungstermine aus dem Profil und Termine aus dem Planer, nach Datum. */
export function mitPlanerTerminen<T extends { bezeichnung: string; datum: string }>(k: Kontext, azubiId: number, pruefungen: T[]): (T | { bezeichnung: string; datum: string; planer: true })[] {
  const dazu = planerTermine(k, azubiId);
  return dazu.length ? [...pruefungen, ...dazu].sort((a, b) => a.datum.localeCompare(b.datum)) : pruefungen;
}

function ansicht(planer: Planer, d: Daten) {
  const zeit = planer.abschnitte.find((a) => a.art === 'zeitplanung');
  const { umbenennungen: _, ...inhalt } = planer;
  // „bekannt“ ist nur Buchführung – die Oberfläche bekommt stattdessen „neu“
  const { bekannt, ...eintragungen } = d;
  return {
    planer: inhalt,
    daten: {
      ...eintragungen,
      phasen: d.phasen ?? (zeit ? zeit.phasen.map((p) => ({ name: p.name, soll: p.stunden, ist: 0 })) : []),
      // solange der Azubi nichts gespeichert hat, ist die Zeitplanung der Vorschlag aus dem Paket
      phasenVorschlag: d.phasen === null,
    },
    // Termine, Punkte und Fragen, die seit dem letzten „gesehen“ dazugekommen sind (durch eine neue Fassung des Pakets)
    neu: bekannt === null ? [] : [...planerKennungen(planer)].filter((id) => !bekannt.includes(id)),
  };
}

/** Planer, Paket und Eintragungen des angemeldeten Azubis – 404, wenn es für ihn keinen Planer gibt. */
function meiner(c: Ctx) {
  const p = planerFuer(c.k, c.b.id);
  if (!p) throw new Fehler(404, 'Für dich ist kein Planer freigeschaltet');
  return { ...p, daten: lies(c.k.db, c.b.id, p.paket, p.planer) };
}

function speichere(c: Ctx, m: ReturnType<typeof meiner>, daten: Daten) {
  // beim ersten Speichern festhalten, welche Punkte es gab – alles Spätere gilt als „neu“
  if (daten.bekannt === null) daten = { ...daten, bekannt: [...planerKennungen(m.planer)] };
  schreibe(c.k.db, c.k.jetzt(), c.b.id, m.paket, daten);
  return { status: 200, body: ansicht(m.planer, daten) };
}

/** Mehrzeiliger Text (Stichworte, Notizen): Zeilenumbrüche bleiben, andere Steuerzeichen nicht. */
function langtext(x: unknown, max: number, feld: string): string {
  const s = typeof x === 'string' ? x.replace(/\r\n?/g, '\n').trim() : '';
  if (s.length > max) throw new Fehler(400, `${feld}: höchstens ${max} Zeichen`);
  if (/[\u0000-\u0008\u000b-\u001f\u007f]/.test(s)) throw new Fehler(400, `${feld} enthält unzulässige Zeichen`);
  return s;
}

function stunden(x: unknown, feld: string): number {
  const n = typeof x === 'number' ? x : Number(String(x ?? '').replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > MAX_STUNDEN) throw new Fehler(400, `${feld}: Stunden zwischen 0 und ${MAX_STUNDEN}`);
  return Math.round(n * 4) / 4;
}

export const PLANER_ROUTEN: Route[] = [
  { m: 'GET', p: '/api/planer', wer: ['azubi'], h: (c) => ({ status: 200, body: (({ planer, daten }) => ansicht(planer, daten))(meiner(c)) }) },

  {
    m: 'PUT',
    p: '/api/planer/angaben',
    wer: ['azubi'],
    h: (c) => {
      const m = meiner(c);
      const b = koerper(c);
      return speichere(c, m, { ...m.daten, name: text(b.name ?? '', 300, m.planer.nameFeld, false), auftraggeber: m.planer.auftraggeberFeld ? text(b.auftraggeber ?? '', 300, m.planer.auftraggeberFeld, false) : m.daten.auftraggeber });
    },
  },

  {
    // Termine stehen im Ausbildungsplan – deshalb erfahren die Betreuenden von einer Änderung (ohne Inhalt)
    m: 'PUT',
    p: '/api/planer/termine',
    wer: ['azubi'],
    h: (c) => {
      const m = meiner(c);
      const roh = koerper(c).termine;
      if (!istObjekt(roh)) throw new Fehler(400, 'Termine fehlen');
      const termine = { ...m.daten.termine };
      let geaendert = false;
      for (const t of m.planer.termine) {
        if (!(t.id in roh)) continue;
        const wert = roh[t.id];
        if (wert !== '' && wert !== null && !gueltigesDatum(wert)) throw new Fehler(400, `„${t.label}“: Das Datum ist ungültig`);
        if (gueltigesDatum(wert) && (wert < '2000-01-01' || wert > '2099-12-31')) throw new Fehler(400, `„${t.label}“: Das Jahr sieht nach einem Tippfehler aus – bitte prüfen`);
        const neu = gueltigesDatum(wert) ? wert : '';
        if ((termine[t.id] ?? '') !== neu) geaendert = true;
        if (neu) termine[t.id] = neu;
        else delete termine[t.id];
      }
      const antwort = speichere(c, m, { ...m.daten, termine });
      if (geaendert) merkeAktivitaet(c.k.db, c.k.jetzt(), 'planer_termine', c.b.id, c.b, null, m.planer.titel);
      return antwort;
    },
  },

  {
    m: 'PATCH',
    p: '/api/planer/haken',
    wer: ['azubi'],
    h: (c) => {
      const m = meiner(c);
      const b = koerper(c);
      const id = typeof b.id === 'string' ? b.id : '';
      const erlaubt = new Set(m.planer.abschnitte.flatMap((a) => (a.art === 'checkliste' ? a.gruppen.flatMap((g) => g.punkte.map((p) => `${a.id}.${p.id}`)) : [])));
      if (!erlaubt.has(id)) throw new Fehler(404, 'Diesen Punkt gibt es nicht');
      if (typeof b.an !== 'boolean') throw new Fehler(400, 'Angabe „an“ fehlt');
      const haken = { ...m.daten.haken };
      if (b.an) haken[id] = true;
      else delete haken[id];
      return speichere(c, m, { ...m.daten, haken });
    },
  },

  {
    m: 'PUT',
    p: '/api/planer/phasen',
    wer: ['azubi'],
    h: (c) => {
      const m = meiner(c);
      if (!m.planer.abschnitte.some((a) => a.art === 'zeitplanung')) throw new Fehler(404, 'Dieser Planer hat keine Zeitplanung');
      const roh = koerper(c).phasen;
      if (!Array.isArray(roh) || roh.length > MAX_PHASEN) throw new Fehler(400, `Höchstens ${MAX_PHASEN} Phasen`);
      const phasen: Phase[] = roh.map((x, i) => {
        if (!istObjekt(x)) throw new Fehler(400, 'Ungültige Phase');
        const name = text(x.name, 120, `Name der Phase ${i + 1}`);
        return { name, soll: stunden(x.soll, `„${name}“ geplant`), ist: stunden(x.ist, `„${name}“ tatsächlich`) };
      });
      return speichere(c, m, { ...m.daten, phasen });
    },
  },

  {
    m: 'PUT',
    p: '/api/planer/antwort',
    wer: ['azubi'],
    h: (c) => {
      const m = meiner(c);
      const b = koerper(c);
      const id = typeof b.id === 'string' ? b.id : '';
      const erlaubt = new Set(m.planer.abschnitte.flatMap((a) => (a.art === 'fragen' ? a.fragen.map((f) => `${a.id}.${f.id}`) : [])));
      if (!erlaubt.has(id)) throw new Fehler(404, 'Diese Frage gibt es nicht');
      const t = langtext(b.text, 3000, 'Stichworte');
      const antworten = { ...m.daten.antworten };
      if (t) antworten[id] = t;
      else delete antworten[id];
      return speichere(c, m, { ...m.daten, antworten });
    },
  },

  {
    // „Planer ergänzt“ bestätigen: alles, was es jetzt gibt, gilt als gesehen
    m: 'POST',
    p: '/api/planer/gesehen',
    wer: ['azubi'],
    h: (c) => {
      const m = meiner(c);
      return speichere(c, m, { ...m.daten, bekannt: [...planerKennungen(m.planer)] });
    },
  },

  {
    m: 'PUT',
    p: '/api/planer/notizen',
    wer: ['azubi'],
    h: (c) => {
      const m = meiner(c);
      return speichere(c, m, { ...m.daten, notizen: langtext(koerper(c).text, 20000, 'Notizen') });
    },
  },
];
