import { Fehler, holeBenutzer, idAus, istObjekt, koerper, text } from './api-basis';
import type { Ctx, Route } from './api-basis';
import type { DB } from './db';
import { heute } from './datum';
import { BUNDESLAENDER, feiertageZwischen, istBundesland } from './feiertage';
import { ferienZwischen, ladeFerien } from './ferien';
import { ausbildungsdauer, ausbildungsstand, gueltigesDatum, hoechsteVerkuerzung, montagVon, plusTage } from './kalender';
import type { Ausbildungsstand, Dauer } from './kalender';
import { protokolliere } from './protokoll';
import { darfAzubiSehen, darfAzubiVerwalten } from './rechte';
import type { BenutzerZeile } from './typen';

/**
 * Stammdaten (Betrieb, Berufe, Berufsschulen), das Profil der Azubis und der Kalender mit
 * Feiertagen und Schulferien. Gepflegt von den Ausbildern; der Super-Admin hat hier keinen Zugriff.
 */
export interface Beruf {
  id: number;
  bezeichnung: string;
  fachrichtung: string;
  regeldauer_monate: number;
}

export interface Berufsschule {
  id: number;
  name: string;
  ort: string;
  bundesland: string;
  form: 'block' | 'teilzeit';
}

export interface Betrieb {
  name: string;
  anschrift: string;
  bundesland: string;
}

interface ProfilZeile {
  benutzer_id: number;
  beruf_id: number | null;
  berufsschule_id: number | null;
  ausbilder_id: number | null;
  ausbildungsbeginn: string;
  vertragsende: string;
  verkuerzung_monate: number;
  verkuerzung_art: 'ende' | 'anfang';
  verkuerzung_grund: string;
  vorzeitige_zulassung: number;
  wochenstunden: number;
  pruefungen: string;
}

export interface Pruefung {
  bezeichnung: string;
  datum: string;
}

export interface Profil {
  berufId: number | null;
  berufsschuleId: number | null;
  ausbilderId: number | null;
  ausbildungsbeginn: string;
  vertragsende: string;
  verkuerzungMonate: number;
  verkuerzungArt: 'ende' | 'anfang';
  verkuerzungGrund: string;
  vorzeitigeZulassung: boolean;
  wochenstunden: number;
  pruefungen: Pruefung[];
}

const STANDARD_REGELDAUER = 36;
const LEERES_PROFIL: Profil = {
  berufId: null,
  berufsschuleId: null,
  ausbilderId: null,
  ausbildungsbeginn: '',
  vertragsende: '',
  verkuerzungMonate: 0,
  verkuerzungArt: 'ende',
  verkuerzungGrund: '',
  vorzeitigeZulassung: false,
  wochenstunden: 40,
  pruefungen: [],
};

// ---------- Lesen ----------

export function leseBetrieb(db: DB): Betrieb {
  const zeilen = db.prepare("SELECT schluessel, wert FROM einstellungen WHERE schluessel LIKE 'betrieb_%'").all() as unknown as { schluessel: string; wert: string }[];
  const m = new Map(zeilen.map((z) => [z.schluessel, z.wert]));
  return { name: m.get('betrieb_name') ?? '', anschrift: m.get('betrieb_anschrift') ?? '', bundesland: m.get('betrieb_bundesland') ?? '' };
}

function alleBerufe(db: DB): Beruf[] {
  return db.prepare('SELECT * FROM beruf ORDER BY bezeichnung COLLATE NOCASE, fachrichtung COLLATE NOCASE').all() as unknown as Beruf[];
}

function alleSchulen(db: DB): Berufsschule[] {
  return db.prepare('SELECT * FROM berufsschule ORDER BY name COLLATE NOCASE').all() as unknown as Berufsschule[];
}

export function leseProfil(db: DB, azubiId: number): Profil {
  const z = db.prepare('SELECT * FROM azubi_profil WHERE benutzer_id = ?').get(azubiId) as ProfilZeile | undefined;
  if (!z) return { ...LEERES_PROFIL };
  let pruefungen: Pruefung[] = [];
  try {
    pruefungen = JSON.parse(z.pruefungen) as Pruefung[];
  } catch {
    // unlesbar → keine Termine
  }
  return {
    berufId: z.beruf_id,
    berufsschuleId: z.berufsschule_id,
    ausbilderId: z.ausbilder_id,
    ausbildungsbeginn: z.ausbildungsbeginn,
    vertragsende: z.vertragsende,
    verkuerzungMonate: z.verkuerzung_monate,
    verkuerzungArt: z.verkuerzung_art,
    verkuerzungGrund: z.verkuerzung_grund,
    vorzeitigeZulassung: z.vorzeitige_zulassung === 1,
    wochenstunden: z.wochenstunden,
    pruefungen,
  };
}

export function standAus(db: DB, p: Profil, tag: string): { beruf: Beruf | null; stand: Ausbildungsstand } {
  const beruf = p.berufId ? ((db.prepare('SELECT * FROM beruf WHERE id = ?').get(p.berufId) as Beruf | undefined) ?? null) : null;
  const stand = ausbildungsstand(
    { ausbildungsbeginn: p.ausbildungsbeginn, vertragsende: p.vertragsende, verkuerzung_monate: p.verkuerzungMonate, verkuerzung_art: p.verkuerzungArt },
    beruf?.regeldauer_monate ?? STANDARD_REGELDAUER,
    tag,
  );
  return { beruf, stand };
}

/** Dauer der Ausbildung eines Azubis oder null, solange kein Ausbildungsbeginn eingetragen ist. */
export function dauerVon(db: DB, p: Profil): Dauer | null {
  const beruf = p.berufId ? (db.prepare('SELECT regeldauer_monate FROM beruf WHERE id = ?').get(p.berufId) as { regeldauer_monate: number } | undefined) : undefined;
  return ausbildungsdauer(
    { ausbildungsbeginn: p.ausbildungsbeginn, vertragsende: p.vertragsende, verkuerzung_monate: p.verkuerzungMonate, verkuerzung_art: p.verkuerzungArt },
    beruf?.regeldauer_monate ?? STANDARD_REGELDAUER,
  );
}

/** Wie viele Berichte warten, zurückgegeben sind oder für vergangene Wochen fehlen. */
function berichtStand(db: DB, azubiId: number, beginn: string | null, ende: string | null, tag: string) {
  const zeilen = db.prepare('SELECT montag, status FROM bericht WHERE azubi_id = ?').all(azubiId) as unknown as { montag: string; status: string }[];
  const wartend = zeilen.filter((b) => b.status === 'eingereicht').length;
  const zurueck = zeilen.filter((b) => b.status === 'zurueck').length;
  let fehlend = 0;
  if (beginn && ende) {
    // fällig sind die Wochen vor der laufenden – die laufende Woche darf noch offen sein
    const dieseWoche = montagVon(tag);
    const vorhanden = new Set(zeilen.map((b) => b.montag));
    const letzte = montagVon(ende);
    for (let m = montagVon(beginn), n = 0; m < dieseWoche && m <= letzte && n < 400; m = plusTage(m, 7), n++) if (!vorhanden.has(m)) fehlend++;
  }
  return { wartend, zurueck, fehlend };
}

/** Kurzangaben für die Azubi-Liste. */
export function azubiUebersicht(db: DB, z: BenutzerZeile, tag: string) {
  const { beruf, stand } = standAus(db, leseProfil(db, z.id), tag);
  return {
    id: z.id,
    anzeigename: z.anzeigename,
    anmeldename: z.anmeldename,
    status: z.status,
    beruf: beruf ? [beruf.bezeichnung, beruf.fachrichtung].filter(Boolean).join(' – ') : '',
    phase: stand.phase,
    ausbildungsjahr: stand.ausbildungsjahr,
    beginn: stand.beginn,
    ende: stand.ende,
    tage: stand.tage,
    berichte: berichtStand(db, z.id, stand.beginn, stand.ende, tag),
  };
}

// ---------- Prüfen von Eingaben ----------

function ganzzahl(x: unknown, min: number, max: number, feld: string): number {
  const n = typeof x === 'number' ? x : typeof x === 'string' && x.trim() !== '' ? Number(x) : NaN;
  if (!Number.isInteger(n) || n < min || n > max) throw new Fehler(400, `${feld} muss eine ganze Zahl von ${min} bis ${max} sein`);
  return n;
}

function datumOderLeer(x: unknown, feld: string): string {
  if (x === null || x === undefined || x === '') return '';
  if (!gueltigesDatum(x)) throw new Fehler(400, `${feld} ist kein gültiges Datum`);
  return x;
}

function bundesland(x: unknown, pflicht: boolean): string {
  if (!pflicht && (x === '' || x === null || x === undefined)) return '';
  if (!istBundesland(x)) throw new Fehler(400, 'Unbekanntes Bundesland');
  return x;
}

function idOderNull(x: unknown): number | null {
  if (x === null || x === undefined || x === '') return null;
  const n = Number(x);
  if (!Number.isInteger(n) || n < 1) throw new Fehler(400, 'Ungültige Auswahl');
  return n;
}

function pruefeBeruf(body: Record<string, unknown>) {
  return {
    bezeichnung: text(body.bezeichnung, 150, 'Bezeichnung'),
    fachrichtung: text(body.fachrichtung, 100, 'Fachrichtung', false),
    regeldauer: ganzzahl(body.regeldauerMonate, 12, 60, 'Regeldauer in Monaten'),
  };
}

function pruefeSchule(body: Record<string, unknown>) {
  if (body.form !== 'block' && body.form !== 'teilzeit') throw new Fehler(400, 'Unterrichtsform muss Block oder Teilzeit sein');
  return {
    name: text(body.name, 150, 'Name'),
    ort: text(body.ort, 100, 'Ort', false),
    bundesland: bundesland(body.bundesland, true),
    form: body.form as 'block' | 'teilzeit',
  };
}

/** Azubi, den der Aufrufer sehen darf – sonst 404, damit fremde und unbekannte IDs gleich aussehen. */
export function sichtbarerAzubi(c: Ctx): BenutzerZeile {
  const id = idAus(c.p.id);
  if (!darfAzubiSehen(c.k.db, c.b, id, heute(c.k.jetzt()))) throw new Fehler(404, 'Nicht gefunden');
  return holeBenutzer(c.k.db, id)!;
}

// ---------- Routen ----------

export const FACH: ('ausbilder' | 'beauftragter' | 'azubi')[] = ['ausbilder', 'beauftragter', 'azubi'];

export const STAMMDATEN_ROUTEN: Route[] = [
  {
    m: 'GET',
    p: '/api/stammdaten',
    wer: FACH,
    h: (c) => ({
      status: 200,
      body: {
        betrieb: leseBetrieb(c.k.db),
        berufe: alleBerufe(c.k.db),
        berufsschulen: alleSchulen(c.k.db),
        bundeslaender: Object.entries(BUNDESLAENDER).map(([kuerzel, name]) => ({ kuerzel, name })),
        // nur Ausbilder brauchen die Liste, um den zuständigen Ausbilder auszuwählen
        ausbilder:
          c.b.rolle === 'ausbilder'
            ? (c.k.db.prepare("SELECT id, anzeigename FROM benutzer WHERE rolle = 'ausbilder' ORDER BY anzeigename COLLATE NOCASE").all() as unknown as { id: number; anzeigename: string }[])
            : [],
      },
    }),
  },

  {
    m: 'PUT',
    p: '/api/stammdaten/betrieb',
    wer: ['ausbilder'],
    h: (c) => {
      const body = koerper(c);
      const neu: Betrieb = {
        name: text(body.name, 150, 'Name des Betriebs', false),
        anschrift: text(String(body.anschrift ?? '').replace(/\r?\n/g, ', '), 300, 'Anschrift', false),
        bundesland: bundesland(body.bundesland, false),
      };
      const setze = c.k.db.prepare('INSERT INTO einstellungen (schluessel, wert) VALUES (?, ?) ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert');
      setze.run('betrieb_name', neu.name);
      setze.run('betrieb_anschrift', neu.anschrift);
      setze.run('betrieb_bundesland', neu.bundesland);
      protokolliere(c.k.db, c.k.jetzt(), 'fach', 'stammdaten_geaendert', c.b, null, 'Betrieb');
      return { status: 200, body: { betrieb: neu } };
    },
  },

  {
    m: 'POST',
    p: '/api/stammdaten/berufe',
    wer: ['ausbilder'],
    h: (c) => {
      const b = pruefeBeruf(koerper(c));
      const r = c.k.db.prepare('INSERT INTO beruf (bezeichnung, fachrichtung, regeldauer_monate) VALUES (?, ?, ?)').run(b.bezeichnung, b.fachrichtung, b.regeldauer);
      protokolliere(c.k.db, c.k.jetzt(), 'fach', 'stammdaten_geaendert', c.b, null, `Beruf angelegt: ${b.bezeichnung}`);
      return { status: 201, body: { beruf: c.k.db.prepare('SELECT * FROM beruf WHERE id = ?').get(Number(r.lastInsertRowid)) } };
    },
  },

  {
    m: 'PATCH',
    p: '/api/stammdaten/berufe/:id',
    wer: ['ausbilder'],
    h: (c) => {
      const id = idAus(c.p.id);
      if (!c.k.db.prepare('SELECT 1 FROM beruf WHERE id = ?').get(id)) throw new Fehler(404, 'Beruf nicht gefunden');
      const b = pruefeBeruf(koerper(c));
      c.k.db.prepare('UPDATE beruf SET bezeichnung = ?, fachrichtung = ?, regeldauer_monate = ? WHERE id = ?').run(b.bezeichnung, b.fachrichtung, b.regeldauer, id);
      protokolliere(c.k.db, c.k.jetzt(), 'fach', 'stammdaten_geaendert', c.b, null, `Beruf geändert: ${b.bezeichnung}`);
      return { status: 200, body: { beruf: c.k.db.prepare('SELECT * FROM beruf WHERE id = ?').get(id) } };
    },
  },

  {
    m: 'DELETE',
    p: '/api/stammdaten/berufe/:id',
    wer: ['ausbilder'],
    h: (c) => {
      const id = idAus(c.p.id);
      const beruf = c.k.db.prepare('SELECT * FROM beruf WHERE id = ?').get(id) as Beruf | undefined;
      if (!beruf) throw new Fehler(404, 'Beruf nicht gefunden');
      const n = (c.k.db.prepare('SELECT COUNT(*) AS n FROM azubi_profil WHERE beruf_id = ?').get(id) as { n: number }).n;
      if (n > 0) throw new Fehler(409, `Der Beruf ist noch ${n} Azubi(s) zugeordnet und kann deshalb nicht gelöscht werden`);
      c.k.db.prepare('DELETE FROM beruf WHERE id = ?').run(id);
      protokolliere(c.k.db, c.k.jetzt(), 'fach', 'stammdaten_geaendert', c.b, null, `Beruf gelöscht: ${beruf.bezeichnung}`);
      return { status: 200, body: { ok: true } };
    },
  },

  {
    m: 'POST',
    p: '/api/stammdaten/berufsschulen',
    wer: ['ausbilder'],
    h: (c) => {
      const s = pruefeSchule(koerper(c));
      const r = c.k.db.prepare('INSERT INTO berufsschule (name, ort, bundesland, form) VALUES (?, ?, ?, ?)').run(s.name, s.ort, s.bundesland, s.form);
      protokolliere(c.k.db, c.k.jetzt(), 'fach', 'stammdaten_geaendert', c.b, null, `Berufsschule angelegt: ${s.name}`);
      return { status: 201, body: { berufsschule: c.k.db.prepare('SELECT * FROM berufsschule WHERE id = ?').get(Number(r.lastInsertRowid)) } };
    },
  },

  {
    m: 'PATCH',
    p: '/api/stammdaten/berufsschulen/:id',
    wer: ['ausbilder'],
    h: (c) => {
      const id = idAus(c.p.id);
      if (!c.k.db.prepare('SELECT 1 FROM berufsschule WHERE id = ?').get(id)) throw new Fehler(404, 'Berufsschule nicht gefunden');
      const s = pruefeSchule(koerper(c));
      c.k.db.prepare('UPDATE berufsschule SET name = ?, ort = ?, bundesland = ?, form = ? WHERE id = ?').run(s.name, s.ort, s.bundesland, s.form, id);
      protokolliere(c.k.db, c.k.jetzt(), 'fach', 'stammdaten_geaendert', c.b, null, `Berufsschule geändert: ${s.name}`);
      return { status: 200, body: { berufsschule: c.k.db.prepare('SELECT * FROM berufsschule WHERE id = ?').get(id) } };
    },
  },

  {
    m: 'DELETE',
    p: '/api/stammdaten/berufsschulen/:id',
    wer: ['ausbilder'],
    h: (c) => {
      const id = idAus(c.p.id);
      const schule = c.k.db.prepare('SELECT * FROM berufsschule WHERE id = ?').get(id) as Berufsschule | undefined;
      if (!schule) throw new Fehler(404, 'Berufsschule nicht gefunden');
      const n = (c.k.db.prepare('SELECT COUNT(*) AS n FROM azubi_profil WHERE berufsschule_id = ?').get(id) as { n: number }).n;
      if (n > 0) throw new Fehler(409, `Die Berufsschule ist noch ${n} Azubi(s) zugeordnet und kann deshalb nicht gelöscht werden`);
      c.k.db.prepare('DELETE FROM berufsschule WHERE id = ?').run(id);
      protokolliere(c.k.db, c.k.jetzt(), 'fach', 'stammdaten_geaendert', c.b, null, `Berufsschule gelöscht: ${schule.name}`);
      return { status: 200, body: { ok: true } };
    },
  },

  {
    m: 'GET',
    p: '/api/azubis/:id/profil',
    wer: FACH,
    h: (c) => {
      const azubi = sichtbarerAzubi(c);
      const profil = leseProfil(c.k.db, azubi.id);
      const { beruf, stand } = standAus(c.k.db, profil, heute(c.k.jetzt()));
      const schule = profil.berufsschuleId ? (c.k.db.prepare('SELECT * FROM berufsschule WHERE id = ?').get(profil.berufsschuleId) as Berufsschule | undefined) : undefined;
      const ausbilder = profil.ausbilderId ? holeBenutzer(c.k.db, profil.ausbilderId) : undefined;
      return {
        status: 200,
        body: {
          azubi: { id: azubi.id, anzeigename: azubi.anzeigename, anmeldename: azubi.anmeldename, status: azubi.status },
          profil,
          beruf,
          berufsschule: schule ?? null,
          ausbilder: ausbilder ? { id: ausbilder.id, anzeigename: ausbilder.anzeigename } : null,
          stand,
          hoechsteVerkuerzung: hoechsteVerkuerzung(beruf?.regeldauer_monate ?? STANDARD_REGELDAUER),
          bearbeitbar: darfAzubiVerwalten(c.k.db, c.b, azubi.id),
        },
      };
    },
  },

  {
    m: 'PUT',
    p: '/api/azubis/:id/profil',
    wer: ['ausbilder'],
    h: (c) => {
      const { db } = c.k;
      const id = idAus(c.p.id);
      if (!darfAzubiVerwalten(db, c.b, id)) throw new Fehler(404, 'Nicht gefunden');
      const azubi = holeBenutzer(db, id)!;
      const body = koerper(c);

      const berufId = idOderNull(body.berufId);
      const beruf = berufId ? (db.prepare('SELECT * FROM beruf WHERE id = ?').get(berufId) as Beruf | undefined) : undefined;
      if (berufId && !beruf) throw new Fehler(400, 'Diesen Beruf gibt es nicht');
      const schuleId = idOderNull(body.berufsschuleId);
      if (schuleId && !db.prepare('SELECT 1 FROM berufsschule WHERE id = ?').get(schuleId)) throw new Fehler(400, 'Diese Berufsschule gibt es nicht');
      const ausbilderId = idOderNull(body.ausbilderId);
      if (ausbilderId && holeBenutzer(db, ausbilderId)?.rolle !== 'ausbilder') throw new Fehler(400, 'Zuständig sein kann nur ein Konto mit der Rolle Ausbilder');

      const beginn = datumOderLeer(body.ausbildungsbeginn, 'Ausbildungsbeginn');
      const ende = datumOderLeer(body.vertragsende, 'Vertragsende');
      if (ende && !beginn) throw new Fehler(400, 'Ein Vertragsende braucht einen Ausbildungsbeginn');
      if (ende && ende <= beginn) throw new Fehler(400, 'Das Vertragsende muss nach dem Ausbildungsbeginn liegen');
      // Schutz vor Tippfehlern wie 2062
      if (ende && ende > plusTage(beginn, 366 * 6)) throw new Fehler(400, 'Das Vertragsende liegt mehr als sechs Jahre nach dem Beginn – bitte prüfen');

      const hoechstens = hoechsteVerkuerzung(beruf?.regeldauer_monate ?? STANDARD_REGELDAUER);
      const verkuerzung = ganzzahl(body.verkuerzungMonate ?? 0, 0, 48, 'Verkürzung in Monaten');
      if (verkuerzung > hoechstens) throw new Fehler(400, `Bei diesem Beruf sind höchstens ${hoechstens} Monate Verkürzung möglich`);
      if (body.verkuerzungArt !== undefined && body.verkuerzungArt !== 'ende' && body.verkuerzungArt !== 'anfang') throw new Fehler(400, 'Unbekannte Art der Verkürzung');
      const art = body.verkuerzungArt === 'anfang' ? 'anfang' : 'ende';
      const grund = text(body.verkuerzungGrund, 200, 'Grund der Verkürzung', false);
      const stunden = Number(body.wochenstunden ?? 40);
      if (!Number.isFinite(stunden) || stunden < 1 || stunden > 60) throw new Fehler(400, 'Wochenstunden müssen zwischen 1 und 60 liegen');

      const roh = body.pruefungen ?? [];
      if (!Array.isArray(roh) || roh.length > 8) throw new Fehler(400, 'Höchstens acht Prüfungstermine');
      const pruefungen: Pruefung[] = roh
        .map((x) => {
          if (!istObjekt(x)) throw new Fehler(400, 'Ungültiger Prüfungstermin');
          const datum = datumOderLeer(x.datum, 'Prüfungstermin');
          const bezeichnung = text(x.bezeichnung, 80, 'Bezeichnung der Prüfung', !!datum);
          if (bezeichnung && !datum) throw new Fehler(400, `Für „${bezeichnung}“ fehlt das Datum`);
          return { bezeichnung, datum };
        })
        .filter((x) => x.datum)
        .sort((a, b) => a.datum.localeCompare(b.datum));

      db.prepare(
        `INSERT INTO azubi_profil (benutzer_id, beruf_id, berufsschule_id, ausbilder_id, ausbildungsbeginn, vertragsende, verkuerzung_monate,
                                   verkuerzung_art, verkuerzung_grund, vorzeitige_zulassung, wochenstunden, pruefungen, geaendert, geaendert_von)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(benutzer_id) DO UPDATE SET
           beruf_id = excluded.beruf_id, berufsschule_id = excluded.berufsschule_id, ausbilder_id = excluded.ausbilder_id,
           ausbildungsbeginn = excluded.ausbildungsbeginn, vertragsende = excluded.vertragsende,
           verkuerzung_monate = excluded.verkuerzung_monate, verkuerzung_art = excluded.verkuerzung_art,
           verkuerzung_grund = excluded.verkuerzung_grund, vorzeitige_zulassung = excluded.vorzeitige_zulassung,
           wochenstunden = excluded.wochenstunden, pruefungen = excluded.pruefungen, geaendert = excluded.geaendert, geaendert_von = excluded.geaendert_von`,
      ).run(id, berufId, schuleId, ausbilderId, beginn, ende, verkuerzung, art, grund, body.vorzeitigeZulassung === true ? 1 : 0, Math.round(stunden * 100) / 100, JSON.stringify(pruefungen), c.k.jetzt().toISOString(), c.b.id);
      protokolliere(db, c.k.jetzt(), 'fach', 'profil_geaendert', c.b, azubi);
      const profil = leseProfil(db, id);
      return { status: 200, body: { profil, stand: standAus(db, profil, heute(c.k.jetzt())).stand } };
    },
  },

  {
    m: 'GET',
    p: '/api/kalender',
    wer: FACH,
    h: (c) => {
      const land = c.a.query.get('bundesland') ?? '';
      const von = c.a.query.get('von') ?? '';
      const bis = c.a.query.get('bis') ?? '';
      if (!istBundesland(land)) throw new Fehler(400, 'Unbekanntes Bundesland');
      if (!gueltigesDatum(von) || !gueltigesDatum(bis) || bis < von) throw new Fehler(400, 'Zeitraum fehlt oder ist ungültig');
      if (bis > plusTage(von, 366 * 6)) throw new Fehler(400, 'Der Zeitraum darf höchstens sechs Jahre umfassen');
      const ferien = ladeFerien(c.k.cfg.contentDir, land, c.k.log);
      return {
        status: 200,
        body: {
          bundesland: land,
          feiertage: feiertageZwischen(land, von, bis),
          ferien: { vorhanden: ferien.vorhanden, quelle: ferien.quelle, stand: ferien.stand, hinweis: ferien.hinweis, zeiten: ferienZwischen(ferien, von, bis) },
        },
      };
    },
  },
];
