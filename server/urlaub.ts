import { merkeAktivitaet } from './aktivitaet';
import type { AktivitaetArt } from './aktivitaet';
import { Fehler, holeBenutzer, idAus, koerper, text } from './api-basis';
import type { Ctx, Route } from './api-basis';
import type { DB } from './db';
import { transaktion } from './db';
import { heute } from './datum';
import { feiertageZwischen, istBundesland } from './feiertage';
import { gueltigesDatum, montagVon, plusTage } from './kalender';
import { darfAzubiSehen, darfAzubiVerwalten, sichtbareAzubis, zustaendiger } from './rechte';
import { dauerVon, FACH, leseBetrieb, leseProfil, sichtbarerAzubi } from './stammdaten';
import { informierePersonal, mailHindernis, versende, personalAnrede } from './urlaub-mail';
import { gestalteMail } from './mail-gestalt';

/**
 * Urlaub beantragen.
 * Ablauf: Der Azubi stellt den Antrag → alle, denen er im Zeitraum zugewiesen ist (Ausbildungsbeauftragte oder ein Ausbilder
 * als Vertretung), bestätigen → der zuständige Ausbilder genehmigt endgültig → Mail an die Personalstelle (server/urlaub-mail.ts).
 * - Ist im Zeitraum niemand zugewiesen, geht der Antrag direkt an den Ausbilder.
 * - Der Ausbilder kann auch entscheiden, solange eine Bestätigung aussteht (er muss es ausdrücklich wollen) – sonst
 *   bliebe ein Antrag liegen, wenn ein Beauftragter fehlt.
 * - Sichtbar ist ein Antrag für den Azubi und für alle, die den Azubi sehen dürfen (rechte.ts) – nie für den Super-Admin.
 * Gezählt werden Arbeitstage: Montag bis Freitag ohne die gesetzlichen Feiertage des Betriebs.
 */
export type UrlaubStatus = 'offen' | 'genehmigt' | 'abgelehnt' | 'zurueckgezogen' | 'storniert';

interface AntragZeile {
  id: number;
  azubi_id: number;
  von: string;
  bis: string;
  tage: number;
  bemerkung: string;
  status: UrlaubStatus;
  erstellt: string;
  geaendert: string;
  mail_stand: string;
  mail_fehler: string;
}

const MAX_TAGE_ZEITRAUM = 92;

/** Arbeitstage im Zeitraum: Montag bis Freitag, ohne gesetzliche Feiertage des Betriebs. */
export function arbeitstage(db: DB, von: string, bis: string): string[] {
  const land = leseBetrieb(db).bundesland;
  const frei = new Set(istBundesland(land) ? feiertageZwischen(land, von, bis).filter((f) => !f.teilweise).map((f) => f.datum) : []);
  const tage: string[] = [];
  for (let t = von, n = 0; t <= bis && n < 400; t = plusTage(t, 1), n++) {
    const wt = new Date(`${t}T00:00:00Z`).getUTCDay();
    if (wt !== 0 && wt !== 6 && !frei.has(t)) tage.push(t);
  }
  return tage;
}

/** Genehmigte Urlaubstage (Arbeitstage) eines Azubis im Zeitraum – für Jahreskalender, Bericht und Kalender-Abo. */
export function genehmigteTage(db: DB, azubiId: number, von: string, bis: string): string[] {
  const antraege = db.prepare("SELECT von, bis FROM urlaub_antrag WHERE azubi_id = ? AND status = 'genehmigt' AND von <= ? AND bis >= ?").all(azubiId, bis, von) as unknown as { von: string; bis: string }[];
  const tage = new Set<string>();
  for (const a of antraege) for (const t of arbeitstage(db, a.von < von ? von : a.von, a.bis > bis ? bis : a.bis)) tage.add(t);
  return [...tage].sort();
}

/** Zeiträume von Anträgen eines Status im Zeitraum (genehmigt: fürs Kalender-Abo; offen: „beantragt“ im Jahreskalender). */
export function urlaubsZeitraeume(db: DB, azubiId: number, status: UrlaubStatus, von: string, bis: string): { id: number; von: string; bis: string; geaendert: string }[] {
  return (db.prepare('SELECT id, von, bis, geaendert FROM urlaub_antrag WHERE azubi_id = ? AND status = ? AND von <= ? AND bis >= ? ORDER BY von').all(azubiId, status, bis, von) as unknown as { id: number; von: string; bis: string; geaendert: string }[]).map((z) => ({
    id: z.id,
    von: z.von,
    bis: z.bis,
    geaendert: z.geaendert,
  }));
}

/**
 * Wer bestätigen muss: alle aktiven Konten, denen der Azubi im Zeitraum (auch nur teilweise) zugewiesen ist.
 * - Zuweisung von Hand: Jede dieser Personen muss bestätigen (gruppe = '').
 * - Zuweisung über eine Abteilung: Beauftragte und Stellvertretung bilden eine Gruppe (gruppe = Name der Abteilung) –
 *   eine Bestätigung aus der Gruppe genügt.
 * - Der zuständige Ausbilder bestätigt nicht: Er entscheidet ohnehin.
 */
function bestaetiger(db: DB, azubiId: number, von: string, bis: string): { id: number; name: string; gruppe: string }[] {
  const zeilen = db
    .prepare(
      `SELECT b.id, b.anzeigename AS name, z.einsatz_id AS einsatz, COALESCE(a.name, '') AS abteilung
         FROM zuweisung z JOIN benutzer b ON b.id = z.beauftragter_id
         LEFT JOIN plan_eintrag e ON e.id = z.einsatz_id LEFT JOIN abteilung a ON a.id = e.abteilung_id
        WHERE z.azubi_id = ? AND b.status = 'aktiv' AND b.rolle IN ('beauftragter', 'ausbilder')
          AND (z.von IS NULL OR z.von = '' OR z.von <= ?) AND (z.bis IS NULL OR z.bis = '' OR z.bis >= ?)
        ORDER BY b.anzeigename COLLATE NOCASE`,
    )
    .all(azubiId, bis, von) as unknown as { id: number; name: string; einsatz: number | null; abteilung: string }[];
  const chef = zustaendiger(db, azubiId);
  const m = new Map<number, { id: number; name: string; gruppe: string }>();
  for (const z of zeilen) {
    if (z.id === chef) continue;
    const gruppe = z.einsatz === null ? '' : z.abteilung || 'Abteilung';
    const alt = m.get(z.id);
    // wer auch von Hand zugewiesen ist, bestätigt selbst
    if (!alt || gruppe === '') m.set(z.id, { id: z.id, name: z.name, gruppe });
  }
  return [...m.values()];
}

/** Urlaubskonto eines Kalenderjahrs: Anspruch, genehmigte und beantragte Arbeitstage. */
function konto(db: DB, azubiId: number, jahr: number, ohneAntrag = 0) {
  const von = `${jahr}-01-01`;
  const bis = `${jahr}-12-31`;
  const anspruch = (db.prepare('SELECT urlaubstage AS u FROM azubi_profil WHERE benutzer_id = ?').get(azubiId) as { u: number | null } | undefined)?.u ?? null;
  const zaehle = (status: UrlaubStatus) => {
    const antraege = db.prepare('SELECT id, von, bis FROM urlaub_antrag WHERE azubi_id = ? AND status = ? AND von <= ? AND bis >= ?').all(azubiId, status, bis, von) as unknown as { id: number; von: string; bis: string }[];
    return antraege.filter((a) => a.id !== ohneAntrag).reduce((n, a) => n + arbeitstage(db, a.von < von ? von : a.von, a.bis > bis ? bis : a.bis).length, 0);
  };
  const genehmigt = zaehle('genehmigt');
  const offen = zaehle('offen');
  return { jahr, anspruch, genehmigt, beantragt: offen, frei: anspruch === null ? null : anspruch - genehmigt - offen };
}

/** Was vor dem Antrag auffallen sollte – Hinweise, keine Sperren. */
function hinweise(db: DB, azubiId: number, von: string, bis: string, tage: string[], ohneAntrag = 0): string[] {
  const out: string[] = [];
  const schule = db.prepare("SELECT von, bis, titel FROM plan_eintrag WHERE azubi_id = ? AND art = 'schule' AND von <= ? AND bis >= ? ORDER BY von").all(azubiId, bis, plusTage(montagVon(von), 0)) as unknown as { von: string; bis: string; titel: string }[];
  const inSchule = schule.filter((s) => tage.some((t) => t >= s.von && t <= plusTage(s.bis, 4)));
  if (inSchule.length) out.push(`In diesem Zeitraum ist Berufsschule (${inSchule.map((s) => s.titel).join(', ')}). Urlaub in der Schulzeit ist in der Regel nicht möglich – bitte vorher klären.`);
  const pruefungen = leseProfil(db, azubiId).pruefungen.filter((p) => p.datum >= von && p.datum <= bis);
  if (pruefungen.length) out.push(`In diesem Zeitraum liegt ein Prüfungstermin: ${pruefungen.map((p) => `${p.bezeichnung} am ${p.datum.slice(8, 10)}.${p.datum.slice(5, 7)}.`).join(', ')}.`);
  for (const jahr of new Set([Number(von.slice(0, 4)), Number(bis.slice(0, 4))])) {
    const k = konto(db, azubiId, jahr, ohneAntrag);
    const neu = tage.filter((t) => t.startsWith(String(jahr))).length;
    if (k.anspruch === null) {
      if (!out.some((h) => h.startsWith('Der Urlaubsanspruch'))) out.push('Der Urlaubsanspruch ist im Portal noch nicht eingetragen – ob die Tage reichen, lässt sich hier nicht prüfen.');
    } else if (k.frei !== null && neu > k.frei) out.push(`Für ${jahr} sind das ${neu} Tage, frei sind laut Portal noch ${Math.max(0, k.frei)} von ${k.anspruch}.`);
  }
  return out;
}

/** Für die Anzeige vor dem Antrag: Einzelpersonen mit Namen, Abteilungen als „Bea Auft oder Bodo Zweit (IT-Betrieb)“. */
function bestaetigerText(liste: { name: string; gruppe: string }[]): string[] {
  const einzeln = liste.filter((b) => !b.gruppe).map((b) => b.name);
  const gruppen = [...new Set(liste.filter((b) => b.gruppe).map((b) => b.gruppe))].map((g) => `${liste.filter((b) => b.gruppe === g).map((b) => b.name).join(' oder ')} (${g})`);
  return [...einzeln, ...gruppen];
}

function hole(db: DB, id: number): AntragZeile | undefined {
  return Number.isInteger(id) ? (db.prepare('SELECT * FROM urlaub_antrag WHERE id = ?').get(id) as AntragZeile | undefined) : undefined;
}

function ausstehend(db: DB, antragId: number): { benutzer_id: number; name: string }[] {
  return (db.prepare('SELECT benutzer_id, name FROM urlaub_bestaetigung WHERE antrag_id = ? AND zeit IS NULL ORDER BY name COLLATE NOCASE').all(antragId) as unknown as { benutzer_id: number; name: string }[]).map((z) => ({ benutzer_id: z.benutzer_id, name: z.name }));
}

function ansicht(c: Ctx, z: AntragZeile) {
  const { db } = c.k;
  const azubi = holeBenutzer(db, z.azubi_id)!;
  const bestaetigungen = (db.prepare('SELECT benutzer_id, name, zeit, gruppe FROM urlaub_bestaetigung WHERE antrag_id = ? ORDER BY gruppe, name COLLATE NOCASE').all(z.id) as unknown as { benutzer_id: number; name: string; zeit: string | null; gruppe: string }[]).map((b) => ({
    name: b.name,
    zeit: b.zeit,
    ich: b.benutzer_id === c.b.id,
    /** Abteilung: Aus ihr genügt eine Bestätigung. Leer = diese Person muss selbst bestätigen. */
    gruppe: b.gruppe,
  }));
  const offen = z.status === 'offen';
  const wartetAufMich = offen && bestaetigungen.some((b) => b.ich && b.zeit === null);
  const verwaltet = darfAzubiVerwalten(db, c.b, z.azubi_id);
  const fehlt = bestaetigungen.filter((b) => b.zeit === null).map((b) => b.name);
  return {
    id: z.id,
    azubi: { id: azubi.id, anzeigename: azubi.anzeigename },
    von: z.von,
    bis: z.bis,
    tage: z.tage,
    bemerkung: z.bemerkung,
    status: z.status,
    // was beim Entscheiden auffallen sollte (Berufsschule, Prüfung, Resturlaub) – nur solange der Antrag offen ist
    hinweise: offen ? hinweise(db, z.azubi_id, z.von, z.bis, arbeitstage(db, z.von, z.bis), z.id) : [],
    // wo der offene Antrag gerade liegt
    stufe: !offen ? null : fehlt.length ? 'beauftragte' : 'ausbilder',
    bestaetigungen,
    erstellt: z.erstellt,
    verlauf: (db.prepare('SELECT zeit, aktion, name, rolle, kommentar FROM urlaub_verlauf WHERE antrag_id = ? ORDER BY id').all(z.id) as unknown as Record<string, string>[]).map((v) => ({ zeit: v.zeit, aktion: v.aktion, name: v.name, rolle: v.rolle, kommentar: v.kommentar })),
    // den Stand der Mail sieht, wer genehmigt
    mail: verwaltet && (z.status === 'genehmigt' || z.status === 'storniert') ? { stand: z.mail_stand || 'offen', fehler: z.mail_fehler } : null,
    rechte: {
      zurueckziehen: offen && c.b.id === z.azubi_id,
      bestaetigen: wartetAufMich,
      ablehnen: offen && (wartetAufMich || verwaltet || bestaetigungen.some((b) => b.ich)),
      genehmigen: offen && verwaltet,
      stornieren: z.status === 'genehmigt' && verwaltet,
      mailErneut: verwaltet && (z.status === 'genehmigt' || z.status === 'storniert') && z.mail_stand !== 'gesendet',
    },
    // für die Rückfrage beim Genehmigen ohne Bestätigung
    bestaetigungFehlt: fehlt,
  };
}

function schreibeVerlauf(c: Ctx, antragId: number, aktion: string, kommentar = ''): void {
  c.k.db.prepare('INSERT INTO urlaub_verlauf (antrag_id, zeit, aktion, name, rolle, kommentar) VALUES (?, ?, ?, ?, ?, ?)').run(antragId, c.k.jetzt().toISOString(), aktion, c.b.anzeigename, c.b.rolle, kommentar);
}

const zeitraumText = (von: string, bis: string) => {
  const d = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}`;
  return von === bis ? d(von) : `${d(von).slice(0, 6)}–${d(bis)}`;
};

function melde(c: Ctx, z: AntragZeile, art: AktivitaetArt): void {
  merkeAktivitaet(c.k.db, c.k.jetzt(), art, z.azubi_id, c.b, montagVon(z.von), zeitraumText(z.von, z.bis));
}

/** Antrag für eine Aktion holen: Es gibt ihn nur für die, die den Azubi sehen dürfen. */
function antragFuer(c: Ctx): AntragZeile {
  const z = hole(c.k.db, idAus(c.p.id));
  if (!z || !(c.b.id === z.azubi_id || darfAzubiSehen(c.k.db, c.b, z.azubi_id, heute(c.k.jetzt())))) throw new Fehler(404, 'Nicht gefunden');
  return z;
}

function zeitraumAus(c: Ctx, von: unknown, bis: unknown): { von: string; bis: string } {
  if (typeof von !== 'string' || !gueltigesDatum(von)) throw new Fehler(400, 'Der erste Urlaubstag fehlt oder ist kein gültiges Datum');
  if (typeof bis !== 'string' || !gueltigesDatum(bis)) throw new Fehler(400, 'Der letzte Urlaubstag fehlt oder ist kein gültiges Datum');
  if (bis < von) throw new Fehler(400, 'Der letzte Urlaubstag liegt vor dem ersten');
  if (bis > plusTage(von, MAX_TAGE_ZEITRAUM)) throw new Fehler(400, 'Der Zeitraum ist zu lang – bitte mehrere Anträge stellen');
  return { von, bis };
}

export const URLAUB_ROUTEN: Route[] = [
  {
    // Anträge und Urlaubskonto eines Azubis
    m: 'GET',
    p: '/api/azubis/:id/urlaub',
    wer: FACH,
    h: (c) => {
      const azubi = sichtbarerAzubi(c);
      const tag = heute(c.k.jetzt());
      const roh = c.a.query.get('jahr') ?? tag.slice(0, 4);
      if (!/^\d{4}$/.test(roh) || Number(roh) < 2000 || Number(roh) > 2100) throw new Fehler(400, 'Das Jahr ist ungültig');
      const antraege = c.k.db.prepare('SELECT * FROM urlaub_antrag WHERE azubi_id = ? ORDER BY von DESC, id DESC LIMIT 200').all(azubi.id) as unknown as AntragZeile[];
      const dauer = dauerVon(c.k.db, leseProfil(c.k.db, azubi.id));
      return {
        status: 200,
        body: {
          azubi: { id: azubi.id, anzeigename: azubi.anzeigename },
          eigenes: c.b.id === azubi.id,
          heute: tag,
          beginn: dauer?.beginn ?? null,
          ende: dauer?.ende ?? null,
          konto: konto(c.k.db, azubi.id, Number(roh)),
          antraege: antraege.map((z) => ansicht(c, z)),
        },
      };
    },
  },

  {
    // Vor dem Antrag: Wie viele Arbeitstage sind es, wer muss bestätigen, was fällt auf?
    m: 'GET',
    p: '/api/azubis/:id/urlaub/pruefen',
    wer: ['azubi'],
    h: (c) => {
      const azubi = sichtbarerAzubi(c);
      const { von, bis } = zeitraumAus(c, c.a.query.get('von'), c.a.query.get('bis'));
      const tage = arbeitstage(c.k.db, von, bis);
      return { status: 200, body: { tage: tage.length, hinweise: hinweise(c.k.db, azubi.id, von, bis, tage), bestaetiger: bestaetigerText(bestaetiger(c.k.db, azubi.id, von, bis)) } };
    },
  },

  {
    m: 'POST',
    p: '/api/azubis/:id/urlaub',
    wer: ['azubi'],
    h: (c) => {
      const { db } = c.k;
      const azubi = sichtbarerAzubi(c);
      const body = koerper(c);
      const { von, bis } = zeitraumAus(c, body.von, body.bis);
      const tag = heute(c.k.jetzt());
      if (von < tag) throw new Fehler(400, 'Urlaub lässt sich nur für heute oder später beantragen');
      const dauer = dauerVon(db, leseProfil(db, azubi.id));
      if (!dauer) throw new Fehler(409, 'In deinem Profil fehlt der Ausbildungsbeginn – bitte an deinen Ausbilder wenden');
      if (von < dauer.beginn || bis > dauer.ende) throw new Fehler(409, 'Der Zeitraum liegt außerhalb deiner Ausbildungszeit');
      const tage = arbeitstage(db, von, bis);
      if (tage.length === 0) throw new Fehler(400, 'In diesem Zeitraum liegt kein Arbeitstag – dafür brauchst du keinen Urlaub');
      const doppelt = db.prepare("SELECT von, bis FROM urlaub_antrag WHERE azubi_id = ? AND status IN ('offen', 'genehmigt') AND von <= ? AND bis >= ?").get(azubi.id, bis, von) as { von: string; bis: string } | undefined;
      if (doppelt) throw new Fehler(409, `Für diesen Zeitraum gibt es schon einen Antrag (${zeitraumText(doppelt.von, doppelt.bis)})`);
      const bemerkung = text(body.bemerkung, 300, 'Die Bemerkung', false);
      const jetzt = c.k.jetzt().toISOString();
      const id = transaktion(db, () => {
        const r = db.prepare('INSERT INTO urlaub_antrag (azubi_id, von, bis, tage, bemerkung, erstellt, geaendert) VALUES (?, ?, ?, ?, ?, ?, ?)').run(azubi.id, von, bis, tage.length, bemerkung, jetzt, jetzt);
        const neu = Number(r.lastInsertRowid);
        for (const b of bestaetiger(db, azubi.id, von, bis)) db.prepare('INSERT INTO urlaub_bestaetigung (antrag_id, benutzer_id, name, gruppe) VALUES (?, ?, ?, ?)').run(neu, b.id, b.name, b.gruppe);
        schreibeVerlauf(c, neu, 'beantragt');
        return neu;
      });
      const z = hole(db, id)!;
      melde(c, z, 'urlaub_beantragt');
      return { status: 201, body: { antrag: ansicht(c, z) } };
    },
  },

  {
    // Anträge aller Azubis, die ich sehe – für Ausbilder und Beauftragte
    m: 'GET',
    p: '/api/urlaub',
    wer: ['ausbilder', 'beauftragter'],
    h: (c) => {
      const { db } = c.k;
      const tag = heute(c.k.jetzt());
      const ids = sichtbareAzubis(db, c.b, tag);
      if (ids.length === 0) return { status: 200, body: { heute: tag, zuTun: 0, antraege: [] } };
      // offene immer, entschiedene der letzten zwölf Monate
      const zeilen = db
        .prepare(`SELECT * FROM urlaub_antrag WHERE azubi_id IN (${ids.map(() => '?').join(',')}) AND (status = 'offen' OR bis >= ?) ORDER BY von, id LIMIT 500`)
        .all(...ids, plusTage(tag, -366)) as unknown as AntragZeile[];
      const antraege = zeilen.map((z) => ansicht(c, z));
      return { status: 200, body: { heute: tag, zuTun: antraege.filter((a) => a.rechte.bestaetigen || (a.rechte.genehmigen && a.stufe === 'ausbilder')).length, antraege } };
    },
  },

  {
    m: 'POST',
    p: '/api/urlaub/:id/zurueckziehen',
    wer: ['azubi'],
    h: (c) => {
      const z = antragFuer(c);
      if (z.azubi_id !== c.b.id) throw new Fehler(404, 'Nicht gefunden');
      if (z.status !== 'offen') throw new Fehler(409, 'Der Antrag ist schon entschieden – zurückziehen geht nicht mehr');
      c.k.db.prepare("UPDATE urlaub_antrag SET status = 'zurueckgezogen', geaendert = ? WHERE id = ?").run(c.k.jetzt().toISOString(), z.id);
      schreibeVerlauf(c, z.id, 'zurueckgezogen');
      melde(c, z, 'urlaub_zurueckgezogen');
      return { status: 200, body: { antrag: ansicht(c, hole(c.k.db, z.id)!) } };
    },
  },

  {
    m: 'POST',
    p: '/api/urlaub/:id/bestaetigen',
    wer: ['ausbilder', 'beauftragter'],
    h: (c) => {
      const z = antragFuer(c);
      if (z.status !== 'offen') throw new Fehler(409, 'Der Antrag ist nicht mehr offen');
      const r = c.k.db.prepare('UPDATE urlaub_bestaetigung SET zeit = ? WHERE antrag_id = ? AND benutzer_id = ? AND zeit IS NULL').run(c.k.jetzt().toISOString(), z.id, c.b.id);
      if (Number(r.changes) === 0) throw new Fehler(409, 'Für diesen Antrag steht von dir keine Bestätigung aus');
      // aus einer Abteilung genügt eine Bestätigung: Die übrigen der Gruppe müssen nicht mehr
      const gruppe = (c.k.db.prepare('SELECT gruppe FROM urlaub_bestaetigung WHERE antrag_id = ? AND benutzer_id = ?').get(z.id, c.b.id) as { gruppe: string }).gruppe;
      if (gruppe) c.k.db.prepare('DELETE FROM urlaub_bestaetigung WHERE antrag_id = ? AND gruppe = ? AND zeit IS NULL').run(z.id, gruppe);
      schreibeVerlauf(c, z.id, 'bestaetigt');
      melde(c, z, 'urlaub_bestaetigt');
      return { status: 200, body: { antrag: ansicht(c, hole(c.k.db, z.id)!) } };
    },
  },

  {
    // Ablehnen: wer bestätigen muss oder musste, und der Ausbilder – immer mit Begründung
    m: 'POST',
    p: '/api/urlaub/:id/ablehnen',
    wer: ['ausbilder', 'beauftragter'],
    h: (c) => {
      const z = antragFuer(c);
      if (z.status !== 'offen') throw new Fehler(409, 'Der Antrag ist nicht mehr offen');
      const beteiligt = !!c.k.db.prepare('SELECT 1 FROM urlaub_bestaetigung WHERE antrag_id = ? AND benutzer_id = ?').get(z.id, c.b.id);
      if (!beteiligt && !darfAzubiVerwalten(c.k.db, c.b, z.azubi_id)) throw new Fehler(403, 'Diesen Antrag kannst du nicht ablehnen');
      const kommentar = text(koerper(c).kommentar, 500, 'Die Begründung');
      c.k.db.prepare("UPDATE urlaub_antrag SET status = 'abgelehnt', geaendert = ? WHERE id = ?").run(c.k.jetzt().toISOString(), z.id);
      schreibeVerlauf(c, z.id, 'abgelehnt', kommentar);
      melde(c, z, 'urlaub_abgelehnt');
      return { status: 200, body: { antrag: ansicht(c, hole(c.k.db, z.id)!) } };
    },
  },

  {
    // Endgültige Genehmigung durch den zuständigen Ausbilder
    m: 'POST',
    p: '/api/urlaub/:id/genehmigen',
    wer: ['ausbilder'],
    h: async (c) => {
      const { db } = c.k;
      const z = antragFuer(c);
      if (!darfAzubiVerwalten(db, c.b, z.azubi_id)) throw new Fehler(403, 'Genehmigen kann nur der zuständige Ausbilder');
      if (z.status !== 'offen') throw new Fehler(409, 'Der Antrag ist nicht mehr offen');
      const fehlt = ausstehend(db, z.id);
      const ohne = (c.a.body as { ohneBestaetigung?: unknown } | null)?.ohneBestaetigung === true;
      if (fehlt.length && !ohne) throw new Fehler(409, `Die Bestätigung von ${fehlt.map((f) => f.name).join(', ')} steht noch aus`, 'bestaetigung_fehlt');
      db.prepare("UPDATE urlaub_antrag SET status = 'genehmigt', geaendert = ?, mail_stand = 'offen', mail_fehler = '' WHERE id = ?").run(c.k.jetzt().toISOString(), z.id);
      schreibeVerlauf(c, z.id, 'genehmigt', fehlt.length ? `ohne Bestätigung von ${fehlt.map((f) => f.name).join(', ')}` : '');
      melde(c, z, 'urlaub_genehmigt');
      // die Genehmigung gilt, auch wenn die Mail nicht ankommt – der Stand steht dann am Antrag
      await informierePersonal(c.k, z.id);
      return { status: 200, body: { antrag: ansicht(c, hole(db, z.id)!) } };
    },
  },

  {
    // Genehmigten Urlaub wieder aufheben – mit Begründung; die Personalstelle erfährt es
    m: 'POST',
    p: '/api/urlaub/:id/stornieren',
    wer: ['ausbilder'],
    h: async (c) => {
      const { db } = c.k;
      const z = antragFuer(c);
      if (!darfAzubiVerwalten(db, c.b, z.azubi_id)) throw new Fehler(403, 'Stornieren kann nur der zuständige Ausbilder');
      if (z.status !== 'genehmigt') throw new Fehler(409, 'Nur genehmigter Urlaub lässt sich stornieren');
      const kommentar = text(koerper(c).kommentar, 500, 'Die Begründung');
      db.prepare("UPDATE urlaub_antrag SET status = 'storniert', geaendert = ?, mail_stand = 'offen', mail_fehler = '' WHERE id = ?").run(c.k.jetzt().toISOString(), z.id);
      schreibeVerlauf(c, z.id, 'storniert', kommentar);
      melde(c, z, 'urlaub_storniert');
      await informierePersonal(c.k, z.id);
      return { status: 200, body: { antrag: ansicht(c, hole(db, z.id)!) } };
    },
  },

  {
    // Testmail an die Personalstelle – damit sich die Einrichtung prüfen lässt, bevor der erste Urlaub genehmigt wird
    m: 'POST',
    p: '/api/urlaub/mail-test',
    wer: ['ausbilder'],
    h: async (c) => {
      const hindernis = mailHindernis(c.k);
      if (hindernis) throw new Fehler(409, hindernis);
      const betrieb = leseBetrieb(c.k.db);
      const absaetze = [
        personalAnrede(c.k),
        `dies ist eine Testmail aus dem Ausbildungsportal${betrieb.name ? ` (${betrieb.name})` : ''}, ausgelöst von ${c.b.anzeigename}.`,
        'An diese Adresse schickt das Portal künftig eine kurze Mail, wenn für Auszubildende Urlaub genehmigt oder ein genehmigter Urlaub storniert wurde.',
      ];
      const fuss = 'Bitte nicht auf diese Mail antworten.';
      const fehler = await versende(
        c.k,
        betrieb.personalMail,
        'Test: Mails aus dem Ausbildungsportal',
        [...absaetze, fuss].join('\n\n'),
        gestalteMail(c.k, { teile: [{ art: 'marke', text: 'Testmail', farbe: 'blau' }, ...absaetze.map((text) => ({ art: 'absatz' as const, text }))], fuss }),
      );
      if (fehler) throw new Fehler(502, `Die Testmail wurde nicht gesendet: ${fehler}`);
      return { status: 200, body: { ok: true, an: betrieb.personalMail } };
    },
  },
  {
    // Mail an die Personalstelle noch einmal senden – wenn sie nicht ankam oder der Versand erst später eingerichtet wurde
    m: 'POST',
    p: '/api/urlaub/:id/mail',
    wer: ['ausbilder'],
    h: async (c) => {
      const z = antragFuer(c);
      if (!darfAzubiVerwalten(c.k.db, c.b, z.azubi_id)) throw new Fehler(403, 'Das kann nur der zuständige Ausbilder');
      if (z.status !== 'genehmigt' && z.status !== 'storniert') throw new Fehler(409, 'Eine Mail gibt es nur für genehmigten oder stornierten Urlaub');
      if (z.mail_stand === 'gesendet') throw new Fehler(409, 'Die Personalstelle ist schon informiert');
      await informierePersonal(c.k, z.id);
      schreibeVerlauf(c, z.id, 'mail', hole(c.k.db, z.id)!.mail_stand === 'gesendet' ? 'Mail an die Personalstelle gesendet' : 'Mail an die Personalstelle nicht gesendet');
      return { status: 200, body: { antrag: ansicht(c, hole(c.k.db, z.id)!) } };
    },
  },
];
