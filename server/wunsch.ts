import { abteilungAus } from './abteilung';
import { merkeAktivitaet } from './aktivitaet';
import type { AktivitaetArt } from './aktivitaet';
import { Fehler, holeBenutzer, idAus, koerper, text } from './api-basis';
import type { Ctx, Route } from './api-basis';
import type { DB } from './db';
import { heute } from './datum';
import { gueltigesDatum, kalenderwoche, montagVon, plusTage } from './kalender';
import { eingabeAus, legeEintragAn } from './plan';
import { darfAzubiSehen, darfAzubiVerwalten, sichtbareAzubis } from './rechte';
import { dauerVon, leseProfil, sichtbarerAzubi } from './stammdaten';

/**
 * Einsatzwünsche: Ein Azubi wünscht sich einen Einsatz in einer Abteilung (nur Abteilungen aus den Stammdaten) für einige Wochen.
 * - Entscheiden kann allein der Ausbilder, der den Azubi verwaltet (rechte.ts: darfAzubiVerwalten) – er kann den Zeitraum dabei anpassen.
 * - Genehmigt: Es entsteht ein Einsatz im Ausbildungsplan, die Beauftragten der Abteilung sind dann wie bei jedem Einsatz zugewiesen.
 * - Abgelehnt: mit Begründung, die der Azubi sieht.
 * - Sichtbar sind Wünsche nur für den Azubi selbst und für Ausbilder, die ihn sehen – nicht für Ausbildungsbeauftragte (auch nicht in der Glocke).
 * Zeiträume sind ganze Wochen, gespeichert über ihren Montag (wie im Ausbildungsplan).
 */
type Status = 'offen' | 'genehmigt' | 'abgelehnt' | 'zurueckgezogen';

interface WunschZeile {
  id: number;
  azubi_id: number;
  abteilung_id: number | null;
  abteilung_name: string;
  von: string;
  bis: string;
  grund: string;
  status: Status;
  erstellt: string;
  entschieden: string | null;
  entschieden_name: string;
  begruendung: string;
  einsatz_id: number | null;
}

/** so viele Wochen darf ein gewünschter Einsatz höchstens dauern */
const MAX_WOCHEN = 26;
/** so viele offene Wünsche darf ein Azubi gleichzeitig haben */
const MAX_OFFEN = 10;

const datumText = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}`;

/** „KW 3–5/2027“ bzw. „KW 52/2026–KW 2/2027“ */
export function wochenText(von: string, bis: string): string {
  const a = kalenderwoche(von);
  const b = kalenderwoche(bis);
  if (von === bis) return `KW ${a.kw}/${a.jahr}`;
  return a.jahr === b.jahr ? `KW ${a.kw}–${b.kw}/${a.jahr}` : `KW ${a.kw}/${a.jahr}–KW ${b.kw}/${b.jahr}`;
}

function hole(db: DB, id: number): WunschZeile | undefined {
  return Number.isInteger(id) ? (db.prepare('SELECT * FROM planungswunsch WHERE id = ?').get(id) as WunschZeile | undefined) : undefined;
}

/** Was beim Entscheiden auffallen sollte: Überschneidungen mit Schulblöcken, Einsätzen und Urlaub. */
function hinweise(db: DB, azubiId: number, von: string, bis: string): string[] {
  const liste: string[] = [];
  const eintraege = db
    .prepare("SELECT art, titel, von, bis FROM plan_eintrag WHERE azubi_id = ? AND art IN ('schule', 'einsatz') AND von <= ? AND bis >= ? ORDER BY von")
    .all(azubiId, bis, von) as unknown as { art: string; titel: string; von: string; bis: string }[];
  for (const e of eintraege) liste.push(`Überschneidet sich mit ${e.art === 'schule' ? 'dem Schulblock' : 'dem Einsatz'} „${e.titel}“ (${wochenText(e.von, e.bis)}).`);
  const urlaub = db
    .prepare("SELECT von, bis, status FROM urlaub_antrag WHERE azubi_id = ? AND status IN ('offen', 'genehmigt') AND von <= ? AND bis >= ? ORDER BY von")
    .all(azubiId, plusTage(bis, 6), von) as unknown as { von: string; bis: string; status: string }[];
  for (const u of urlaub) liste.push(`${u.status === 'genehmigt' ? 'Genehmigter' : 'Beantragter'} Urlaub vom ${datumText(u.von)} bis ${datumText(u.bis)}.`);
  return liste;
}

function ansicht(c: Ctx, z: WunschZeile) {
  const { db } = c.k;
  const azubi = holeBenutzer(db, z.azubi_id)!;
  const offen = z.status === 'offen';
  const verwaltet = c.b.rolle === 'ausbilder' && darfAzubiVerwalten(db, c.b, z.azubi_id);
  return {
    id: z.id,
    azubi: { id: azubi.id, anzeigename: azubi.anzeigename },
    abteilung: { id: z.abteilung_id, name: z.abteilung_name },
    von: z.von,
    bis: z.bis,
    zeitraum: wochenText(z.von, z.bis),
    grund: z.grund,
    status: z.status,
    erstellt: z.erstellt,
    entschieden: z.entschieden,
    entschiedenVon: z.entschieden_name,
    begruendung: z.begruendung,
    // steht der Einsatz noch im Plan?
    imPlan: z.einsatz_id !== null,
    hinweise: offen && c.b.rolle === 'ausbilder' ? hinweise(db, z.azubi_id, z.von, z.bis) : [],
    rechte: {
      zurueckziehen: offen && c.b.id === z.azubi_id,
      entscheiden: offen && verwaltet,
    },
  };
}

/** Wochen aus der Eingabe: Montag der Woche von `von` bis Montag der Woche von `bis` (leer = eine Woche). */
function zeitraumAus(von: unknown, bis: unknown): { von: string; bis: string } {
  if (!gueltigesDatum(von)) throw new Fehler(400, 'Der Beginn fehlt oder ist kein gültiges Datum');
  const bisRoh = bis === undefined || bis === null || bis === '' ? von : bis;
  if (!gueltigesDatum(bisRoh)) throw new Fehler(400, 'Das Ende ist kein gültiges Datum');
  const a = montagVon(von);
  const b = montagVon(bisRoh);
  if (b < a) throw new Fehler(400, 'Das Ende liegt vor dem Beginn');
  if (b > plusTage(a, 7 * (MAX_WOCHEN - 1))) throw new Fehler(400, `Ein Wunsch darf höchstens ${MAX_WOCHEN} Wochen umfassen`);
  return { von: a, bis: b };
}

/** Der Zeitraum muss in der Ausbildungszeit liegen. */
function pruefeAusbildungszeit(db: DB, azubiId: number, von: string, bis: string, du: boolean): void {
  const dauer = dauerVon(db, leseProfil(db, azubiId));
  if (!dauer) throw new Fehler(409, du ? 'In deinem Profil fehlt der Ausbildungsbeginn – bitte an deinen Ausbilder wenden' : 'Für diesen Azubi ist noch kein Ausbildungsbeginn eingetragen');
  if (von < montagVon(dauer.beginn) || bis > montagVon(dauer.ende)) throw new Fehler(409, du ? 'Der Zeitraum liegt außerhalb deiner Ausbildungszeit' : 'Der Zeitraum liegt außerhalb der Ausbildungszeit');
}

/** Wunsch für eine Aktion: Es gibt ihn nur für den Azubi selbst und für Ausbilder, die ihn sehen. */
function wunschFuer(c: Ctx): WunschZeile {
  const z = hole(c.k.db, idAus(c.p.id));
  const sieht = z && (c.b.id === z.azubi_id || (c.b.rolle === 'ausbilder' && darfAzubiSehen(c.k.db, c.b, z.azubi_id, heute(c.k.jetzt()))));
  if (!z || !sieht) throw new Fehler(404, 'Nicht gefunden');
  return z;
}

function melde(c: Ctx, z: WunschZeile, art: AktivitaetArt): void {
  merkeAktivitaet(c.k.db, c.k.jetzt(), art, z.azubi_id, c.b, z.von, `${z.abteilung_name} (${wochenText(z.von, z.bis)})`);
}

/** Zahl der offenen Wünsche, über die dieses Ausbilder-Konto entscheiden kann – für die Zahl im Menü. */
function offeneFuer(c: Ctx): WunschZeile[] {
  const { db } = c.k;
  const ids = sichtbareAzubis(db, c.b, heute(c.k.jetzt())).filter((id) => darfAzubiVerwalten(db, c.b, id));
  if (ids.length === 0) return [];
  return db.prepare(`SELECT * FROM planungswunsch WHERE status = 'offen' AND azubi_id IN (${ids.map(() => '?').join(',')}) ORDER BY von, id`).all(...ids) as unknown as WunschZeile[];
}

export const WUNSCH_ROUTEN: Route[] = [
  {
    // Wünsche eines Azubis – für ihn selbst und für Ausbilder; dazu die Abteilungen zur Auswahl
    m: 'GET',
    p: '/api/azubis/:id/wuensche',
    wer: ['azubi', 'ausbilder'],
    h: (c) => {
      const { db } = c.k;
      const azubi = sichtbarerAzubi(c);
      const dauer = dauerVon(db, leseProfil(db, azubi.id));
      const zeilen = db.prepare('SELECT * FROM planungswunsch WHERE azubi_id = ? ORDER BY erstellt DESC, id DESC LIMIT 200').all(azubi.id) as unknown as WunschZeile[];
      return {
        status: 200,
        body: {
          azubi: { id: azubi.id, anzeigename: azubi.anzeigename },
          heute: heute(c.k.jetzt()),
          beginn: dauer?.beginn ?? null,
          ende: dauer?.ende ?? null,
          abteilungen: db.prepare('SELECT id, name FROM abteilung ORDER BY name COLLATE NOCASE').all() as unknown as { id: number; name: string }[],
          wuensche: zeilen.map((z) => ansicht(c, z)),
        },
      };
    },
  },

  {
    m: 'POST',
    p: '/api/azubis/:id/wuensche',
    wer: ['azubi'],
    h: (c) => {
      const { db } = c.k;
      const azubi = sichtbarerAzubi(c);
      const body = koerper(c);
      const abteilung = abteilungAus(db, body.abteilungId);
      if (!abteilung) throw new Fehler(400, 'Bitte eine Abteilung wählen');
      const { von, bis } = zeitraumAus(body.von, body.bis);
      if (plusTage(bis, 6) < heute(c.k.jetzt())) throw new Fehler(400, 'Der Zeitraum liegt in der Vergangenheit');
      pruefeAusbildungszeit(db, azubi.id, von, bis, true);
      const offen = (db.prepare("SELECT COUNT(*) AS n FROM planungswunsch WHERE azubi_id = ? AND status = 'offen'").get(azubi.id) as { n: number }).n;
      if (offen >= MAX_OFFEN) throw new Fehler(409, `Du hast schon ${MAX_OFFEN} offene Wünsche – warte bitte erst eine Entscheidung ab`);
      const grund = text(body.grund, 500, 'Der Grund', false);
      const r = db
        .prepare('INSERT INTO planungswunsch (azubi_id, abteilung_id, abteilung_name, von, bis, grund, erstellt) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(azubi.id, abteilung.id, abteilung.name, von, bis, grund, c.k.jetzt().toISOString());
      const z = hole(db, Number(r.lastInsertRowid))!;
      melde(c, z, 'wunsch_neu');
      return { status: 201, body: { wunsch: ansicht(c, z) } };
    },
  },

  {
    m: 'POST',
    p: '/api/wuensche/:id/zurueckziehen',
    wer: ['azubi'],
    h: (c) => {
      const { db } = c.k;
      const z = wunschFuer(c);
      if (z.azubi_id !== c.b.id) throw new Fehler(404, 'Nicht gefunden');
      if (z.status !== 'offen') throw new Fehler(409, 'Der Wunsch ist nicht mehr offen');
      db.prepare("UPDATE planungswunsch SET status = 'zurueckgezogen', entschieden = ? WHERE id = ?").run(c.k.jetzt().toISOString(), z.id);
      return { status: 200, body: { wunsch: ansicht(c, hole(db, z.id)!) } };
    },
  },

  {
    // Für Ausbilder: offene Wünsche, über die sie entscheiden, und die Entscheidungen der letzten 90 Tage
    m: 'GET',
    p: '/api/wuensche',
    wer: ['ausbilder'],
    h: (c) => {
      const { db } = c.k;
      const tag = heute(c.k.jetzt());
      const ids = sichtbareAzubis(db, c.b, tag);
      const offen = offeneFuer(c);
      const entschieden = ids.length
        ? (db
            .prepare(`SELECT * FROM planungswunsch WHERE status != 'offen' AND entschieden >= ? AND azubi_id IN (${ids.map(() => '?').join(',')}) ORDER BY entschieden DESC LIMIT 100`)
            .all(plusTage(tag, -90), ...ids) as unknown as WunschZeile[])
        : [];
      return { status: 200, body: { offen: offen.length, wuensche: offen.map((z) => ansicht(c, z)), entschieden: entschieden.map((z) => ansicht(c, z)) } };
    },
  },

  {
    // Genehmigen: Der Einsatz kommt in den Plan – auf Wunsch mit angepasstem Zeitraum
    m: 'POST',
    p: '/api/wuensche/:id/genehmigen',
    wer: ['ausbilder'],
    h: (c) => {
      const { db } = c.k;
      const z = wunschFuer(c);
      if (!darfAzubiVerwalten(db, c.b, z.azubi_id)) throw new Fehler(403, 'Entscheiden kann nur der zuständige Ausbilder');
      if (z.status !== 'offen') throw new Fehler(409, 'Der Wunsch ist nicht mehr offen');
      const body = (c.a.body ?? {}) as Record<string, unknown>;
      const { von, bis } = body.von === undefined && body.bis === undefined ? { von: z.von, bis: z.bis } : zeitraumAus(body.von, body.bis);
      pruefeAusbildungszeit(db, z.azubi_id, von, bis, false);
      if (z.abteilung_id === null) throw new Fehler(409, 'Die Abteilung gibt es nicht mehr – bitte den Wunsch ablehnen');
      const azubi = holeBenutzer(db, z.azubi_id)!;
      // der Grund bleibt beim Wunsch – den sehen nur Azubi und Ausbilder, den Plan auch die Beauftragten
      const e = eingabeAus(db, { art: 'einsatz', von, bis, abteilungId: z.abteilung_id });
      // legeEintragAn hat eine eigene Transaktion (Einsatz und automatische Zuweisungen)
      const { id } = legeEintragAn(c, azubi, e, false);
      db.prepare("UPDATE planungswunsch SET status = 'genehmigt', von = ?, bis = ?, entschieden = ?, entschieden_von = ?, entschieden_name = ?, einsatz_id = ? WHERE id = ?").run(
        von,
        bis,
        c.k.jetzt().toISOString(),
        c.b.id,
        c.b.anzeigename,
        id,
        z.id,
      );
      const neu = hole(db, z.id)!;
      melde(c, neu, 'wunsch_genehmigt');
      return { status: 200, body: { wunsch: ansicht(c, neu) } };
    },
  },

  {
    m: 'POST',
    p: '/api/wuensche/:id/ablehnen',
    wer: ['ausbilder'],
    h: (c) => {
      const { db } = c.k;
      const z = wunschFuer(c);
      if (!darfAzubiVerwalten(db, c.b, z.azubi_id)) throw new Fehler(403, 'Entscheiden kann nur der zuständige Ausbilder');
      if (z.status !== 'offen') throw new Fehler(409, 'Der Wunsch ist nicht mehr offen');
      const begruendung = text(koerper(c).begruendung, 500, 'Die Begründung');
      db.prepare("UPDATE planungswunsch SET status = 'abgelehnt', entschieden = ?, entschieden_von = ?, entschieden_name = ?, begruendung = ? WHERE id = ?").run(
        c.k.jetzt().toISOString(),
        c.b.id,
        c.b.anzeigename,
        begruendung,
        z.id,
      );
      const neu = hole(db, z.id)!;
      melde(c, neu, 'wunsch_abgelehnt');
      return { status: 200, body: { wunsch: ansicht(c, neu) } };
    },
  },
];
