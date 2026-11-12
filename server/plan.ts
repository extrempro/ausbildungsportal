import { abteilungAus, gleicheZuweisungenAb } from './abteilung';
import { merkeAktivitaet } from './aktivitaet';
import { Fehler, holeBenutzer, idAus, istObjekt, koerper, text } from './api-basis';
import type { Ctx, Route } from './api-basis';
import type { DB } from './db';
import { transaktion } from './db';
import { heute } from './datum';
import { feiertageZwischen, istBundesland } from './feiertage';
import { ferienZwischen, ladeFerien } from './ferien';
import { firmentermineZwischen } from './firmentermin';
import { ausbildungsjahrAm, gueltigesDatum, kalenderwoche, montagVon, plusTage } from './kalender';
import { protokolliere } from './protokoll';
import { darfAzubiVerwalten, darfPlanBearbeiten, darfPlanEintragAendern, hatGesamtsicht, sichtbareAzubis } from './rechte';
import { mitPlanerTerminen } from './planer';
import { dauerVon, FACH, leseBetrieb, leseProfil, sichtbarerAzubi, standAus } from './stammdaten';
import type { BenutzerZeile } from './typen';

/**
 * Ausbildungsplan: Einträge je Azubi über ganze Kalenderwochen.
 * Arten: Schulblock, Einsatz (Abteilung/Einsatzort mit zuständiger Person), Aufgabe (mit Unteraufgaben), Notiz
 * und Termin – ein einzelner Tag mit freiwilliger Uhrzeit, den nur der Azubi selbst einträgt (z. B. JAV-Sitzung).
 * Termine sind privat: Nur der Azubi selbst sieht sie. Für alle anderen gibt es sie nicht – weder im Plan noch in
 * Jahreskalender, Glocke, Bericht-Hinweis oder Kalender-Abo. Jede Abfrage, die nicht vom Azubi selbst kommt, lässt sie aus.
 * Ausbilder planen alles; Beauftragte legen während ihrer Zuweisung Aufgaben und Notizen an;
 * Azubis legen eigene Aufgaben und Notizen an und haken ab.
 */
export const ARTEN = ['schule', 'einsatz', 'aufgabe', 'notiz', 'termin'] as const;
/** was Ausbilder planen – in Bausteinen und der Sammelplanung gibt es keine Termine */
const PLANBAR: readonly Art[] = ['schule', 'einsatz', 'aufgabe', 'notiz'];
export type Art = (typeof ARTEN)[number];

interface Unteraufgabe {
  text: string;
  erledigt: boolean;
}

interface EintragZeile {
  id: number;
  azubi_id: number;
  art: Art;
  von: string;
  bis: string;
  titel: string;
  text: string;
  zustaendig_id: number | null;
  abteilung_id: number | null;
  erledigt: number;
  unteraufgaben: string;
  erstellt_von: number | null;
  geaendert: string;
  tag: string | null;
  zeit_von: string;
  zeit_bis: string;
}

interface VorlageEintrag {
  art: Art;
  /** erste Woche, gezählt ab Ausbildungsbeginn (1 = erste Woche) */
  abWoche: number;
  wochen: number;
  titel: string;
  text: string;
  unteraufgaben: string[];
}

interface VorlageZeile {
  id: number;
  beruf_id: number | null;
  titel: string;
  eintraege: string;
  geaendert: string;
}

const MAX_EINTRAEGE = 500;
const MAX_WOCHEN = 160;
const MAX_UNTERAUFGABEN = 30;

// ---------- Prüfen ----------

function freitext(x: unknown, max: number, feld: string): string {
  const s = typeof x === 'string' ? x.replace(/\r\n?/g, '\n').trim() : '';
  if (s.length > max) throw new Fehler(400, `${feld} ist zu lang (höchstens ${max} Zeichen)`);
  if (/[\u0000-\u0009\u000b-\u001f\u007f]/.test(s)) throw new Fehler(400, `${feld} enthält unzulässige Zeichen`);
  return s;
}

function artAus(x: unknown): Art {
  if (!ARTEN.includes(x as Art)) throw new Fehler(400, 'Unbekannte Art des Eintrags');
  return x as Art;
}

function ganzzahl(x: unknown, min: number, max: number, feld: string): number {
  const n = typeof x === 'number' ? x : typeof x === 'string' && /^\d+$/.test(x.trim()) ? Number(x) : NaN;
  if (!Number.isInteger(n) || n < min || n > max) throw new Fehler(400, `${feld} muss zwischen ${min} und ${max} liegen`);
  return n;
}

function unteraufgabenAus(x: unknown, art: Art): Unteraufgabe[] {
  if (art !== 'aufgabe' || x === undefined || x === null) return [];
  if (!Array.isArray(x) || x.length > MAX_UNTERAUFGABEN) throw new Fehler(400, `Höchstens ${MAX_UNTERAUFGABEN} Unteraufgaben`);
  return x
    .map((u) => {
      if (typeof u === 'string') return { text: text(u, 200, 'Unteraufgabe', false), erledigt: false };
      if (!istObjekt(u)) throw new Fehler(400, 'Ungültige Unteraufgabe');
      return { text: text(u.text, 200, 'Unteraufgabe', false), erledigt: u.erledigt === true };
    })
    .filter((u) => u.text);
}

/** Zuständig sein können Ausbilder und Ausbildungsbeauftragte – nur bei Einsätzen und Aufgaben. */
function zustaendigAus(db: DB, x: unknown, art: Art): BenutzerZeile | null {
  if (x === null || x === undefined || x === '' || (art !== 'einsatz' && art !== 'aufgabe')) return null;
  const b = holeBenutzer(db, Number(x));
  if (!b || (b.rolle !== 'ausbilder' && b.rolle !== 'beauftragter')) throw new Fehler(400, 'Zuständig können nur Ausbilder und Ausbildungsbeauftragte sein');
  return b;
}

interface Eingabe {
  art: Art;
  von: string;
  bis: string;
  titel: string;
  text: string;
  zustaendig: BenutzerZeile | null;
  /** nur Einsätze: die Abteilung, deren Beauftragte für die Dauer automatisch zugewiesen sind */
  abteilung: { id: number; name: string } | null;
  erledigt: boolean;
  unteraufgaben: Unteraufgabe[];
  /** nur Termine */
  tag: string | null;
  zeitVon: string;
  zeitBis: string;
}

function uhrzeit(x: unknown, feld: string): string {
  if (x === undefined || x === null || x === '') return '';
  if (typeof x !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(x)) throw new Fehler(400, `${feld} ist keine gültige Uhrzeit`);
  return x;
}

/** Ein Termin: ein Tag, freiwillig mit Beginn und Ende. Er steht in der Woche dieses Tages. */
function terminAus(roh: Record<string, unknown>): Eingabe {
  if (!gueltigesDatum(roh.tag)) throw new Fehler(400, 'Datum fehlt oder ist kein gültiges Datum');
  const zeitVon = uhrzeit(roh.zeitVon, 'Beginn');
  const zeitBis = uhrzeit(roh.zeitBis, 'Ende');
  if (zeitBis && !zeitVon) throw new Fehler(400, 'Ein Ende braucht auch einen Beginn');
  if (zeitBis && zeitBis <= zeitVon) throw new Fehler(400, 'Das Ende liegt nicht nach dem Beginn');
  const montag = montagVon(roh.tag);
  return { art: 'termin', von: montag, bis: montag, titel: text(roh.titel, 120, 'Titel'), text: freitext(roh.text, 2000, 'Ort oder Anmerkung'), zustaendig: null, abteilung: null, erledigt: false, unteraufgaben: [], tag: roh.tag, zeitVon, zeitBis };
}

function eingabeAus(db: DB, roh: Record<string, unknown>): Eingabe {
  const art = artAus(roh.art);
  if (art === 'termin') return terminAus(roh);
  if (!gueltigesDatum(roh.von)) throw new Fehler(400, 'Beginn fehlt oder ist kein gültiges Datum');
  const von = montagVon(roh.von);
  const bisRoh = roh.bis === undefined || roh.bis === null || roh.bis === '' ? roh.von : roh.bis;
  if (!gueltigesDatum(bisRoh)) throw new Fehler(400, 'Ende ist kein gültiges Datum');
  const bis = montagVon(bisRoh);
  if (bis < von) throw new Fehler(400, 'Das Ende liegt vor dem Beginn');
  if (bis > plusTage(von, 7 * (MAX_WOCHEN - 1))) throw new Fehler(400, `Ein Eintrag darf höchstens ${MAX_WOCHEN} Wochen umfassen`);
  const unteraufgaben = unteraufgabenAus(roh.unteraufgaben, art);
  const abteilung = art === 'einsatz' ? abteilungAus(db, roh.abteilungId) : null;
  return {
    art,
    von,
    bis,
    // ein Einsatz in einer Abteilung darf ohne eigenen Titel kommen – dann heißt er wie die Abteilung
    titel: abteilung && (roh.titel === undefined || roh.titel === null || String(roh.titel).trim() === '') ? abteilung.name : text(roh.titel, 120, 'Titel'),
    abteilung,
    text: freitext(roh.text, 2000, 'Beschreibung'),
    zustaendig: zustaendigAus(db, roh.zustaendigId, art),
    erledigt: art === 'aufgabe' && roh.erledigt === true,
    unteraufgaben,
    tag: null,
    zeitVon: '',
    zeitBis: '',
  };
}

function vorlageEintraegeAus(x: unknown): VorlageEintrag[] {
  if (!Array.isArray(x) || x.length > 100) throw new Fehler(400, 'Einträge der Vorlage fehlen (höchstens 100)');
  return x.map((e) => {
    if (!istObjekt(e)) throw new Fehler(400, 'Ungültiger Eintrag in der Vorlage');
    const art = artAus(e.art);
    if (!PLANBAR.includes(art)) throw new Fehler(400, 'Termine gibt es in Bausteinen nicht');
    return {
      art,
      // fehlt die Angabe, beginnt der Eintrag gleich in der Startwoche – so wie das Formular es bei einfachen Bausteinen annimmt
      abWoche: ganzzahl(e.abWoche ?? 1, 1, 260, 'Woche'),
      wochen: ganzzahl(e.wochen ?? 1, 1, MAX_WOCHEN, 'Dauer in Wochen'),
      titel: text(e.titel, 120, 'Titel'),
      text: freitext(e.text, 2000, 'Beschreibung'),
      unteraufgaben: unteraufgabenAus(e.unteraufgaben, art).map((u) => u.text),
    };
  });
}

// ---------- Lesen ----------

function json<T>(s: string, leer: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return leer;
  }
}

function ansicht(c: Ctx, z: EintragZeile) {
  const { db } = c.k;
  const zustaendig = z.zustaendig_id ? holeBenutzer(db, z.zustaendig_id) : undefined;
  return {
    id: z.id,
    art: z.art,
    von: z.von,
    bis: z.bis,
    titel: z.titel,
    text: z.text,
    zustaendigId: zustaendig?.id ?? null,
    zustaendig: zustaendig?.anzeigename ?? '',
    abteilungId: z.abteilung_id,
    // wer in der Abteilung für Azubis da ist – für die Anzeige im Plan (nur aktive Konten)
    abteilungLeute: z.abteilung_id ? abteilungLeute(db, z.abteilung_id) : null,
    abteilung: z.abteilung_id ? ((db.prepare('SELECT name FROM abteilung WHERE id = ?').get(z.abteilung_id) as { name: string } | undefined)?.name ?? '') : '',
    erledigt: z.erledigt === 1,
    unteraufgaben: json<Unteraufgabe[]>(z.unteraufgaben, []),
    tag: z.tag,
    zeitVon: z.zeit_von,
    zeitBis: z.zeit_bis,
    // vom Azubi selbst angelegt (im Unterschied zu dem, was Ausbilder und Beauftragte geplant haben)
    vomAzubi: z.erstellt_von === z.azubi_id,
    bearbeitbar: darfPlanEintragAendern(db, c.b, z, heute(c.k.jetzt())),
  };
}

function abteilungLeute(db: DB, abteilungId: number): { beauftragte: string[]; stellvertretung: string[] } {
  const zeilen = db.prepare("SELECT b.anzeigename AS name, p.art FROM abteilung_person p JOIN benutzer b ON b.id = p.benutzer_id AND b.status = 'aktiv' WHERE p.abteilung_id = ? ORDER BY b.anzeigename COLLATE NOCASE").all(abteilungId) as unknown as { name: string; art: string }[];
  return { beauftragte: zeilen.filter((z) => z.art === 'beauftragt').map((z) => z.name), stellvertretung: zeilen.filter((z) => z.art === 'stellvertretung').map((z) => z.name) };
}

function holeEintrag(c: Ctx, azubiId: number): EintragZeile {
  const z = c.k.db.prepare('SELECT * FROM plan_eintrag WHERE id = ? AND azubi_id = ?').get(idAus(c.p.eid), azubiId) as EintragZeile | undefined;
  // fremde Termine sehen aus wie unbekannte Einträge
  if (!z || (z.art === 'termin' && c.b.id !== azubiId)) throw new Fehler(404, 'Nicht gefunden');
  return z;
}

function vorlageAnsicht(z: VorlageZeile) {
  return { id: z.id, berufId: z.beruf_id, titel: z.titel, eintraege: json<VorlageEintrag[]>(z.eintraege, []) };
}

function berufOderNull(db: DB, x: unknown): number | null {
  if (x === null || x === undefined || x === '') return null;
  const id = Number(x);
  if (!Number.isInteger(id) || !db.prepare('SELECT 1 FROM beruf WHERE id = ?').get(id)) throw new Fehler(400, 'Unbekannter Beruf');
  return id;
}

/** Plan-Einträge, die eine Woche berühren – als Hinweis beim Schreiben des Berichts. */
export function planDerWoche(db: DB, azubiId: number, montag: string, mitTerminen: boolean): { art: Art; titel: string }[] {
  const zeilen = db
    .prepare("SELECT art, titel FROM plan_eintrag WHERE azubi_id = ? AND von <= ? AND bis >= ? AND art != 'notiz' AND (art != 'termin' OR ?) ORDER BY CASE art WHEN 'schule' THEN 1 WHEN 'einsatz' THEN 2 WHEN 'termin' THEN 3 ELSE 4 END, von, tag, zeit_von, id")
    .all(azubiId, montag, montag, mitTerminen ? 1 : 0) as unknown as { art: Art; titel: string }[];
  return zeilen.map((z) => ({ art: z.art, titel: z.titel }));
}

/** Legt für einen Einsatz die passende Zuweisung an, wenn noch keine den Zeitraum abdeckt. */
function weiseZu(db: DB, jetzt: Date, wer: BenutzerZeile, azubi: BenutzerZeile, e: Eingabe): boolean {
  // nur Ausbildungsbeauftragte; eine Vertretung durch einen anderen Ausbilder wird bewusst bei den Zuweisungen eingetragen
  if (e.art !== 'einsatz' || e.zustaendig?.rolle !== 'beauftragter') return false;
  const von = e.von;
  const bis = plusTage(e.bis, 6);
  const gedeckt = db
    .prepare('SELECT 1 FROM zuweisung WHERE azubi_id = ? AND beauftragter_id = ? AND (von IS NULL OR von <= ?) AND (bis IS NULL OR bis >= ?)')
    .get(azubi.id, e.zustaendig.id, von, bis);
  if (gedeckt) return false;
  db.prepare('INSERT INTO zuweisung (azubi_id, beauftragter_id, von, bis) VALUES (?, ?, ?, ?)').run(azubi.id, e.zustaendig.id, von, bis);
  protokolliere(db, jetzt, 'fach', 'zuweisung_geaendert', wer, azubi, `aus Einsatz „${e.titel}“: ${e.zustaendig.anzeigename} ${von}–${bis}`);
  return true;
}

/** Legt einen geprüften Eintrag im Plan eines Azubis an (Rechte, Höchstzahl, Zuweisung, Aktivität). */
/** Ein Lauf der Sammelplanung: Nummer und ein einziger Zeitstempel für alles, was er anlegt. */
interface Lauf {
  id: number;
  zeit: Date;
}

const SAMMEL_TAGE = 30;
const SAMMEL_LISTE = 5;

/**
 * Die letzten Läufe der Sammelplanung mit dem, was von ihnen noch im Plan steht.
 * „unveraendert“ sind Einträge, die seit dem Lauf niemand bearbeitet oder abgehakt hat – nur diese nimmt „Zurücknehmen“ weg.
 */
function letzteLaeufe(db: DB, wer: BenutzerZeile) {
  const zeilen = db
    .prepare(
      `SELECT s.id, s.zeit, s.benutzer_name AS name, s.titel, s.azubis, s.eintraege,
              COUNT(p.id) AS vorhanden, COALESCE(SUM(p.geaendert = s.zeit), 0) AS unveraendert
         FROM sammelplanung s LEFT JOIN plan_eintrag p ON p.sammel_id = s.id
        WHERE ? = 1 OR s.benutzer_id = ?
        GROUP BY s.id HAVING COUNT(p.id) > 0 ORDER BY s.id DESC LIMIT ?`,
    )
    .all(hatGesamtsicht(db, wer) ? 1 : 0, wer.id, SAMMEL_LISTE) as unknown as { id: number; zeit: string; name: string; titel: string; azubis: number; eintraege: number; vorhanden: number; unveraendert: number }[];
  return zeilen.map((z) => ({ ...z }));
}

function legeEintragAn(c: Ctx, azubi: BenutzerZeile, e: Eingabe, zuweisen: boolean, lauf: Lauf | null = null): { id: number; zugewiesen: boolean } {
  const { db } = c.k;
  if (!darfPlanBearbeiten(db, c.b, azubi.id, e.art, heute(c.k.jetzt()))) throw new Fehler(403, 'Diese Art von Eintrag darfst du hier nicht anlegen', 'rolle');
  // private Termine zählen für sich – sie sollen weder den Plan der Ausbilder füllen noch sich dort bemerkbar machen
  const anzahl = (db.prepare("SELECT COUNT(*) AS n FROM plan_eintrag WHERE azubi_id = ? AND (art = 'termin') = ?").get(azubi.id, e.art === 'termin' ? 1 : 0) as { n: number }).n;
  if (anzahl >= MAX_EINTRAEGE) throw new Fehler(409, `Der Plan hat schon ${MAX_EINTRAEGE} Einträge`);
  const jetzt = lauf?.zeit ?? c.k.jetzt();
  let zugewiesen = false;
  const id = transaktion(db, () => {
    const r = db
      .prepare(
        `INSERT INTO plan_eintrag (azubi_id, art, von, bis, titel, text, zustaendig_id, erledigt, unteraufgaben, erstellt_von, geaendert_von, geaendert, sammel_id, tag, zeit_von, zeit_bis)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(azubi.id, e.art, e.von, e.bis, e.titel, e.text, e.zustaendig?.id ?? null, e.erledigt ? 1 : 0, JSON.stringify(e.unteraufgaben), c.b.id, c.b.id, jetzt.toISOString(), lauf?.id ?? null, e.tag, e.zeitVon, e.zeitBis);
    // Termine sind privat – sie erscheinen nicht in der Glocke der Betreuenden
    if (e.art !== 'termin') merkeAktivitaet(db, jetzt, 'plan_neu', azubi.id, c.b, e.von, e.titel, 1, lauf?.id ?? null);
    if (zuweisen && darfAzubiVerwalten(db, c.b, azubi.id)) zugewiesen = weiseZu(db, jetzt, c.b, azubi, e);
    const neu = Number(r.lastInsertRowid);
    // Abteilung: nur wer den Azubi verwaltet, löst damit Zuweisungen aus
    if (e.abteilung && darfAzubiVerwalten(db, c.b, azubi.id)) {
      db.prepare('UPDATE plan_eintrag SET abteilung_id = ? WHERE id = ?').run(e.abteilung.id, neu);
      gleicheZuweisungenAb(db, { einsatzId: neu });
    }
    return neu;
  });
  return { id, zugewiesen };
}

/**
 * Fügt einen Baustein (Planvorlage) in den Plan ein. Woche 1 des Bausteins ist die Startwoche:
 * die gewählte Woche oder, ohne Angabe, die Woche des Ausbildungsbeginns.
 * Was erst nach dem Ende der Ausbildung beginnen würde, entfällt; was hineinragt, wird gekürzt.
 */
function fuegeBausteinEin(c: Ctx, azubi: BenutzerZeile, v: VorlageZeile, ab: string | null, lauf: Lauf | null = null): number {
  const { db } = c.k;
  const dauer = dauerVon(db, leseProfil(db, azubi.id));
  if (!dauer) throw new Fehler(409, 'Für diesen Azubi ist noch kein Ausbildungsbeginn eingetragen');
  const erste = montagVon(dauer.beginn);
  const letzte = montagVon(dauer.ende);
  const start = ab ?? erste;
  if (start < erste || start > letzte) throw new Fehler(409, 'Die Startwoche liegt außerhalb der Ausbildungszeit');
  const neu = json<VorlageEintrag[]>(v.eintraege, [])
    .map((e) => ({ e, von: plusTage(start, 7 * (e.abWoche - 1)) }))
    .filter((x) => x.von <= letzte)
    .map(({ e, von }) => {
      const bis = plusTage(von, 7 * (e.wochen - 1));
      return { e, von, bis: bis > letzte ? letzte : bis };
    });
  const anzahl = (db.prepare("SELECT COUNT(*) AS n FROM plan_eintrag WHERE azubi_id = ? AND art != 'termin'").get(azubi.id) as { n: number }).n;
  if (anzahl + neu.length > MAX_EINTRAEGE) throw new Fehler(409, `Der Plan hätte danach mehr als ${MAX_EINTRAEGE} Einträge`);
  const jetzt = lauf?.zeit ?? c.k.jetzt();
  transaktion(db, () => {
    const einfuegen = db.prepare(
      `INSERT INTO plan_eintrag (azubi_id, art, von, bis, titel, text, unteraufgaben, erstellt_von, geaendert_von, geaendert, sammel_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const { e, von, bis } of neu) {
      einfuegen.run(azubi.id, e.art, von, bis, e.titel, e.text, JSON.stringify(e.unteraufgaben.map((t) => ({ text: t, erledigt: false }))), c.b.id, c.b.id, jetzt.toISOString(), lauf?.id ?? null);
    }
    protokolliere(db, jetzt, 'fach', 'planvorlage_uebernommen', c.b, azubi, `${v.titel}: ${neu.length} Einträge`);
    merkeAktivitaet(db, jetzt, 'plan_neu', azubi.id, c.b, neu[0]?.von ?? null, `Baustein „${v.titel}“`, neu.length, lauf?.id ?? null);
  });
  return neu.length;
}

function holeBaustein(db: DB, x: unknown): VorlageZeile {
  const v = db.prepare('SELECT * FROM planvorlage WHERE id = ?').get(Number(x)) as VorlageZeile | undefined;
  if (!v) throw new Fehler(400, 'Unbekannter Baustein');
  return v;
}

/** Startwoche aus der Anfrage: leer = Ausbildungsbeginn, sonst der Montag der genannten Woche. */
function startwocheAus(x: unknown): string | null {
  if (x === undefined || x === null || x === '') return null;
  if (!gueltigesDatum(x)) throw new Fehler(400, 'Die Startwoche ist kein gültiges Datum');
  return montagVon(x);
}

// ---------- Routen ----------

export const PLAN_ROUTEN: Route[] = [
  {
    m: 'GET',
    p: '/api/azubis/:id/plan',
    wer: FACH,
    h: (c) => {
      const { db } = c.k;
      const azubi = sichtbarerAzubi(c);
      const tag = heute(c.k.jetzt());
      const profil = leseProfil(db, azubi.id);
      const dauer = dauerVon(db, profil);
      // Termine aus dem Planer des Azubis (z. B. Abgabe des Projektantrags) stehen wie Prüfungstermine im Plan
      const pruefungen = mitPlanerTerminen(c.k, azubi.id, profil.pruefungen);
      const zeilen = db.prepare("SELECT * FROM plan_eintrag WHERE azubi_id = ? AND (art != 'termin' OR ?) ORDER BY von, bis, tag, zeit_von, id").all(azubi.id, c.b.id === azubi.id ? 1 : 0) as unknown as EintragZeile[];

      // Wochen der Ausbildung; Einträge außerhalb (z. B. nach geändertem Beginn) bleiben sichtbar
      let erste = dauer ? montagVon(dauer.beginn) : null;
      let letzte = dauer ? montagVon(dauer.ende) : null;
      for (const z of zeilen) {
        if (!erste || z.von < erste) erste = z.von;
        if (!letzte || z.bis > letzte) letzte = z.bis;
      }
      // Prüfungen nach dem Vertragsende (z. B. mündliche Prüfung) bleiben sichtbar
      for (const p of pruefungen) {
        if (erste && letzte && montagVon(p.datum) > letzte) letzte = montagVon(p.datum);
      }
      const wochen: { montag: string; kw: number; jahr: number; ausbildungsjahr: number | null }[] = [];
      if (erste && letzte) {
        for (let m = erste; m <= letzte && wochen.length < 400; m = plusTage(m, 7)) {
          const drin = dauer && m >= montagVon(dauer.beginn) && m <= dauer.ende;
          wochen.push({ montag: m, ...kalenderwoche(m), ausbildungsjahr: drin ? ausbildungsjahrAm(dauer, m < dauer.beginn ? dauer.beginn : m) : null });
        }
      }

      const betriebLand = leseBetrieb(db).bundesland;
      const schule = profil.berufsschuleId ? (db.prepare('SELECT bundesland FROM berufsschule WHERE id = ?').get(profil.berufsschuleId) as { bundesland: string } | undefined) : undefined;
      const ferienLand = schule?.bundesland || betriebLand;
      const ende = letzte ? plusTage(letzte, 6) : '';
      const ferien = erste && istBundesland(ferienLand) ? ladeFerien(c.k.cfg.contentDir, ferienLand, c.k.log) : null;

      const darfAlles = darfPlanBearbeiten(db, c.b, azubi.id, 'einsatz', tag);
      const darfAufgaben = darfPlanBearbeiten(db, c.b, azubi.id, 'aufgabe', tag);
      const { beruf } = standAus(db, profil, tag);
      return {
        status: 200,
        body: {
          azubi: { id: azubi.id, anzeigename: azubi.anzeigename },
          eigenes: c.b.id === azubi.id,
          heute: tag,
          beginnFehlt: !dauer,
          beginn: dauer?.beginn ?? null,
          ende: dauer?.ende ?? null,
          beruf: beruf ? [beruf.bezeichnung, beruf.fachrichtung].filter(Boolean).join(' – ') : '',
          wochen,
          eintraege: zeilen.map((z) => ansicht(c, z)),
          pruefungen,
          feiertage: erste && istBundesland(betriebLand) ? feiertageZwischen(betriebLand, erste, ende).filter((f) => !f.teilweise) : [],
          ferien: ferien ? ferienZwischen(ferien, erste!, ende) : [],
          ferienVorhanden: ferien?.vorhanden ?? false,
          // Termine des Betriebs für alle (z. B. Betriebsschließung) – reine Übersicht
          firmentermine: erste ? firmentermineZwischen(db, erste, ende) : [],
          rechte: { arten: [...(darfAlles ? PLANBAR : darfAufgaben ? ['aufgabe', 'notiz'] : []), ...(darfPlanBearbeiten(db, c.b, azubi.id, 'termin', tag) ? ['termin'] : [])], zuweisen: darfAzubiVerwalten(db, c.b, azubi.id) },
          // Auswahl für „zuständig“ und Vorlagen nur für die, die planen
          personen: darfAufgaben && c.b.rolle !== 'azubi'
            ? (db.prepare("SELECT id, anzeigename, rolle FROM benutzer WHERE rolle IN ('ausbilder', 'beauftragter') AND status = 'aktiv' ORDER BY anzeigename COLLATE NOCASE").all() as unknown[])
            : [],
          vorlagen:
            darfAlles && c.b.rolle === 'ausbilder'
              ? (db.prepare('SELECT * FROM planvorlage ORDER BY titel COLLATE NOCASE').all() as unknown as VorlageZeile[]).map((v) => ({ id: v.id, titel: v.titel, berufId: v.beruf_id, passt: v.beruf_id === null || v.beruf_id === profil.berufId }))
              : [],
        },
      };
    },
  },

  {
    m: 'POST',
    p: '/api/azubis/:id/plan',
    wer: FACH,
    h: (c) => {
      const { db } = c.k;
      const azubi = sichtbarerAzubi(c);
      const roh = koerper(c);
      const e = eingabeAus(db, c.b.rolle === 'azubi' ? { ...roh, zustaendigId: null } : roh);
      const { id, zugewiesen } = legeEintragAn(c, azubi, e, roh.zuweisen === true);
      return { status: 201, body: { eintrag: ansicht(c, db.prepare('SELECT * FROM plan_eintrag WHERE id = ?').get(id) as unknown as EintragZeile), zugewiesen } };
    },
  },

  {
    m: 'PUT',
    p: '/api/azubis/:id/plan/:eid',
    wer: FACH,
    h: (c) => {
      const { db } = c.k;
      const azubi = sichtbarerAzubi(c);
      const alt = holeEintrag(c, azubi.id);
      const roh = koerper(c);
      const e = eingabeAus(db, c.b.rolle === 'azubi' ? { ...roh, zustaendigId: null } : roh);
      const tag = heute(c.k.jetzt());
      // der vorhandene Eintrag muss änderbar und die neue Art erlaubt sein
      if (!darfPlanEintragAendern(db, c.b, alt, tag) || !darfPlanBearbeiten(db, c.b, azubi.id, e.art, tag)) {
        throw new Fehler(403, 'Diesen Eintrag darfst du nicht ändern', 'rolle');
      }
      const jetzt = c.k.jetzt();
      let zugewiesen = false;
      transaktion(db, () => {
        db.prepare('UPDATE plan_eintrag SET art = ?, von = ?, bis = ?, titel = ?, text = ?, zustaendig_id = ?, erledigt = ?, unteraufgaben = ?, tag = ?, zeit_von = ?, zeit_bis = ?, geaendert_von = ?, geaendert = ? WHERE id = ?').run(
          e.art,
          e.von,
          e.bis,
          e.titel,
          e.text,
          e.zustaendig?.id ?? null,
          e.erledigt ? 1 : 0,
          JSON.stringify(e.unteraufgaben),
          e.tag,
          e.zeitVon,
          e.zeitBis,
          c.b.id,
          jetzt.toISOString(),
          alt.id,
        );
        if (roh.zuweisen === true && darfAzubiVerwalten(db, c.b, azubi.id)) zugewiesen = weiseZu(db, jetzt, c.b, azubi, e);
        // Abteilung ändern darf nur, wer den Azubi verwaltet; sonst bleibt sie, wie sie ist (außer der Eintrag ist kein Einsatz mehr)
        if (darfAzubiVerwalten(db, c.b, azubi.id)) db.prepare('UPDATE plan_eintrag SET abteilung_id = ? WHERE id = ?').run(e.abteilung?.id ?? null, alt.id);
        else if (e.art !== 'einsatz') db.prepare('UPDATE plan_eintrag SET abteilung_id = NULL WHERE id = ?').run(alt.id);
        gleicheZuweisungenAb(db, { einsatzId: alt.id });
      });
      return { status: 200, body: { eintrag: ansicht(c, db.prepare('SELECT * FROM plan_eintrag WHERE id = ?').get(alt.id) as unknown as EintragZeile), zugewiesen } };
    },
  },

  {
    m: 'DELETE',
    p: '/api/azubis/:id/plan/:eid',
    wer: FACH,
    h: (c) => {
      const { db } = c.k;
      const azubi = sichtbarerAzubi(c);
      const alt = holeEintrag(c, azubi.id);
      if (!darfPlanEintragAendern(db, c.b, alt, heute(c.k.jetzt()))) throw new Fehler(403, 'Diesen Eintrag darfst du nicht löschen', 'rolle');
      db.prepare('DELETE FROM plan_eintrag WHERE id = ?').run(alt.id);
      return { status: 200, body: { ok: true } };
    },
  },

  {
    // Abhaken einer Aufgabe oder ihrer Unteraufgaben – das Einzige, was Azubis im Plan ändern
    m: 'POST',
    p: '/api/azubis/:id/plan/:eid/haken',
    wer: FACH,
    h: (c) => {
      const { db } = c.k;
      const azubi = sichtbarerAzubi(c);
      const alt = holeEintrag(c, azubi.id);
      if (alt.art !== 'aufgabe') throw new Fehler(400, 'Abhaken lassen sich nur Aufgaben');
      const roh = koerper(c);
      const unter = json<Unteraufgabe[]>(alt.unteraufgaben, []);
      let erledigt = alt.erledigt === 1;
      if (roh.unteraufgabe !== undefined) {
        const i = Number(roh.unteraufgabe);
        if (!Number.isInteger(i) || i < 0 || i >= unter.length) throw new Fehler(400, 'Unbekannte Unteraufgabe');
        unter[i].erledigt = roh.erledigt === true;
      } else {
        erledigt = roh.erledigt === true;
      }
      db.prepare('UPDATE plan_eintrag SET erledigt = ?, unteraufgaben = ?, geaendert_von = ?, geaendert = ? WHERE id = ?').run(erledigt ? 1 : 0, JSON.stringify(unter), c.b.id, c.k.jetzt().toISOString(), alt.id);
      return { status: 200, body: { eintrag: ansicht(c, db.prepare('SELECT * FROM plan_eintrag WHERE id = ?').get(alt.id) as unknown as EintragZeile) } };
    },
  },

  {
    // Baustein in den Plan einfügen: Woche 1 ist die gewählte Startwoche (ohne Angabe die Woche des Ausbildungsbeginns)
    m: 'POST',
    p: '/api/azubis/:id/plan/vorlage',
    wer: ['ausbilder'],
    h: (c) => {
      const { db } = c.k;
      const id = idAus(c.p.id);
      if (!darfAzubiVerwalten(db, c.b, id)) throw new Fehler(404, 'Nicht gefunden');
      const roh = koerper(c);
      return { status: 200, body: { uebernommen: fuegeBausteinEin(c, holeBenutzer(db, id)!, holeBaustein(db, roh.vorlageId), startwocheAus(roh.ab)) } };
    },
  },

  // ---------- Für mehrere Azubis auf einmal planen ----------
  {
    m: 'GET',
    p: '/api/plan/sammel',
    wer: ['ausbilder'],
    h: (c) => {
      const { db } = c.k;
      const tag = heute(c.k.jetzt());
      return {
        status: 200,
        body: {
          heute: tag,
          // nur Azubis mit vollen Rechten – bei einer Vertretung plant der zuständige Ausbilder
          azubis: sichtbareAzubis(db, c.b, tag).filter((id) => darfAzubiVerwalten(db, c.b, id)).map((id) => {
            const b = holeBenutzer(db, id)!;
            const profil = leseProfil(db, id);
            const dauer = dauerVon(db, profil);
            const { beruf, stand } = standAus(db, profil, tag);
            const schule = profil.berufsschuleId ? (db.prepare('SELECT name FROM berufsschule WHERE id = ?').get(profil.berufsschuleId) as { name: string } | undefined) : undefined;
            return {
              id,
              anzeigename: b.anzeigename,
              beruf: beruf ? [beruf.bezeichnung, beruf.fachrichtung].filter(Boolean).join(' – ') : '',
              berufsschule: schule?.name ?? '',
              ausbildungsjahr: stand.phase === 'laufend' ? stand.ausbildungsjahr : null,
              phase: stand.phase,
              beginn: dauer?.beginn ?? null,
              ende: dauer?.ende ?? null,
            };
          }),
          bausteine: (db.prepare('SELECT * FROM planvorlage ORDER BY titel COLLATE NOCASE').all() as unknown as VorlageZeile[]).map(vorlageAnsicht),
          personen: db.prepare("SELECT id, anzeigename, rolle FROM benutzer WHERE rolle IN ('ausbilder', 'beauftragter') AND status = 'aktiv' ORDER BY anzeigename COLLATE NOCASE").all() as unknown[],
          letzte: letzteLaeufe(db, c.b),
        },
      };
    },
  },
  {
    // Ein Eintrag oder ein Baustein für mehrere Azubis. Jeder Azubi wird einzeln behandelt:
    // Wo es nicht passt (Woche außerhalb der Ausbildung, Plan voll), wird er ausgelassen und der Grund gemeldet.
    m: 'POST',
    p: '/api/plan/sammel',
    wer: ['ausbilder'],
    h: (c) => {
      const { db } = c.k;
      const roh = koerper(c);
      const ids = Array.isArray(roh.azubiIds) ? [...new Set(roh.azubiIds.map(Number))] : [];
      if (ids.length === 0 || ids.length > 200 || ids.some((id) => !darfAzubiVerwalten(db, c.b, id))) throw new Fehler(400, 'Bitte mindestens einen Azubi auswählen');
      const baustein = roh.vorlageId !== undefined && roh.vorlageId !== null && roh.vorlageId !== '' ? holeBaustein(db, roh.vorlageId) : null;
      let ab: string | null = null;
      let eintrag: Eingabe | null = null;
      if (baustein) {
        ab = startwocheAus(roh.ab);
      } else {
        if (!istObjekt(roh.eintrag)) throw new Fehler(400, 'Eintrag oder Baustein fehlt');
        eintrag = eingabeAus(db, roh.eintrag);
        if (!PLANBAR.includes(eintrag.art)) throw new Fehler(400, 'Termine tragen Azubis selbst ein – in der Sammelplanung gibt es sie nicht');
      }
      // ein Lauf mit einem Zeitstempel für alles – daran erkennt „Zurücknehmen“ später, was unverändert ist
      const zeit = c.k.jetzt();
      db.prepare('DELETE FROM sammelplanung WHERE zeit < ?').run(new Date(zeit.getTime() - SAMMEL_TAGE * 86_400_000).toISOString());
      const titel = baustein ? `Baustein „${baustein.titel}“` : eintrag!.titel;
      const lauf: Lauf = { id: Number(db.prepare('INSERT INTO sammelplanung (zeit, benutzer_id, benutzer_name, titel) VALUES (?, ?, ?, ?)').run(zeit.toISOString(), c.b.id, c.b.anzeigename, titel).lastInsertRowid), zeit };
      const ergebnis = ids.map((id) => {
        const azubi = holeBenutzer(db, id)!;
        try {
          if (baustein) {
            const anzahl = fuegeBausteinEin(c, azubi, baustein, ab, lauf);
            if (anzahl === 0) return { id, anzeigename: azubi.anzeigename, ok: false, anzahl: 0, grund: 'Der Baustein hat keine Einträge, die in die Ausbildungszeit fallen' };
            return { id, anzeigename: azubi.anzeigename, ok: true, anzahl, grund: '' };
          }
          const dauer = dauerVon(db, leseProfil(db, id));
          if (!dauer) throw new Fehler(409, 'Für diesen Azubi ist noch kein Ausbildungsbeginn eingetragen');
          if (eintrag!.bis < montagVon(dauer.beginn) || eintrag!.von > montagVon(dauer.ende)) throw new Fehler(409, 'Der Zeitraum liegt außerhalb der Ausbildungszeit');
          legeEintragAn(c, azubi, eintrag!, false, lauf);
          return { id, anzeigename: azubi.anzeigename, ok: true, anzahl: 1, grund: '' };
        } catch (e) {
          if (!(e instanceof Fehler)) throw e;
          return { id, anzeigename: azubi.anzeigename, ok: false, anzahl: 0, grund: e.message };
        }
      });
      const eingetragen = ergebnis.filter((x) => x.ok).length;
      // ein Lauf, der nichts angelegt hat, braucht kein „Zurücknehmen“
      if (eingetragen === 0) db.prepare('DELETE FROM sammelplanung WHERE id = ?').run(lauf.id);
      else db.prepare('UPDATE sammelplanung SET azubis = ?, eintraege = ? WHERE id = ?').run(eingetragen, ergebnis.reduce((n, x) => n + x.anzahl, 0), lauf.id);
      return { status: 200, body: { ergebnis, eingetragen, laufId: eingetragen > 0 ? lauf.id : null, letzte: letzteLaeufe(db, c.b) } };
    },
  },
  {
    // Einen Lauf zurücknehmen: entfernt, was seitdem niemand geändert oder abgehakt hat. Alles andere bleibt und wird genannt.
    m: 'DELETE',
    p: '/api/plan/sammel/:id',
    wer: ['ausbilder'],
    h: (c) => {
      const { db } = c.k;
      const lauf = db.prepare('SELECT * FROM sammelplanung WHERE id = ?').get(idAus(c.p.id)) as { id: number; zeit: string; titel: string; benutzer_id: number | null } | undefined;
      // zurücknehmen darf, wer den Lauf gemacht hat – oder wer die Gesamtsicht hat
      if (!lauf || (lauf.benutzer_id !== c.b.id && !hatGesamtsicht(db, c.b))) throw new Fehler(404, 'Diese Sammelplanung gibt es nicht mehr');
      const geblieben = db
        .prepare(
          `SELECT b.anzeigename, p.titel FROM plan_eintrag p JOIN benutzer b ON b.id = p.azubi_id
            WHERE p.sammel_id = ? AND p.geaendert <> ? ORDER BY b.anzeigename COLLATE NOCASE, p.von`,
        )
        .all(lauf.id, lauf.zeit) as unknown as { anzeigename: string; titel: string }[];
      const entfernt = transaktion(db, () => {
        const n = Number(db.prepare('DELETE FROM plan_eintrag WHERE sammel_id = ? AND geaendert = ?').run(lauf.id, lauf.zeit).changes);
        // die Hinweise in den Glocken der Azubis verschwinden mit – außer bei denen, deren Einträge bleiben
        db.prepare('DELETE FROM aktivitaet WHERE sammel_id = ? AND azubi_id NOT IN (SELECT azubi_id FROM plan_eintrag WHERE sammel_id = ?)').run(lauf.id, lauf.id);
        db.prepare('DELETE FROM sammelplanung WHERE id = ?').run(lauf.id);
        protokolliere(db, c.k.jetzt(), 'fach', 'sammelplanung_zurueckgenommen', c.b, null, `${lauf.titel}: ${n} Einträge entfernt${geblieben.length ? `, ${geblieben.length} geänderte bleiben` : ''}`);
        return n;
      });
      return { status: 200, body: { entfernt, geblieben: geblieben.map((g) => ({ azubi: g.anzeigename, titel: g.titel })), letzte: letzteLaeufe(db, c.b) } };
    },
  },

  // ---------- Vorlagen ----------
  {
    m: 'GET',
    p: '/api/planvorlagen',
    wer: ['ausbilder'],
    h: (c) => ({
      status: 200,
      body: {
        vorlagen: (c.k.db.prepare('SELECT * FROM planvorlage ORDER BY titel COLLATE NOCASE').all() as unknown as VorlageZeile[]).map(vorlageAnsicht),
        berufe: c.k.db.prepare('SELECT id, bezeichnung, fachrichtung FROM beruf ORDER BY bezeichnung COLLATE NOCASE').all(),
      },
    }),
  },
  {
    m: 'POST',
    p: '/api/planvorlagen',
    wer: ['ausbilder'],
    h: (c) => {
      const { db } = c.k;
      const roh = koerper(c);
      const titel = text(roh.titel, 120, 'Titel');
      const eintraege = vorlageEintraegeAus(roh.eintraege ?? []);
      const r = db.prepare('INSERT INTO planvorlage (beruf_id, titel, eintraege, geaendert_von, geaendert) VALUES (?, ?, ?, ?, ?)').run(berufOderNull(db, roh.berufId), titel, JSON.stringify(eintraege), c.b.id, c.k.jetzt().toISOString());
      return { status: 201, body: { vorlage: vorlageAnsicht(db.prepare('SELECT * FROM planvorlage WHERE id = ?').get(Number(r.lastInsertRowid)) as unknown as VorlageZeile) } };
    },
  },
  {
    m: 'PUT',
    p: '/api/planvorlagen/:id',
    wer: ['ausbilder'],
    h: (c) => {
      const { db } = c.k;
      const id = idAus(c.p.id);
      if (!db.prepare('SELECT 1 FROM planvorlage WHERE id = ?').get(id)) throw new Fehler(404, 'Nicht gefunden');
      const roh = koerper(c);
      const titel = text(roh.titel, 120, 'Titel');
      const eintraege = vorlageEintraegeAus(roh.eintraege ?? []);
      db.prepare('UPDATE planvorlage SET beruf_id = ?, titel = ?, eintraege = ?, geaendert_von = ?, geaendert = ? WHERE id = ?').run(berufOderNull(db, roh.berufId), titel, JSON.stringify(eintraege), c.b.id, c.k.jetzt().toISOString(), id);
      return { status: 200, body: { vorlage: vorlageAnsicht(db.prepare('SELECT * FROM planvorlage WHERE id = ?').get(id) as unknown as VorlageZeile) } };
    },
  },
  {
    m: 'DELETE',
    p: '/api/planvorlagen/:id',
    wer: ['ausbilder'],
    h: (c) => {
      const id = idAus(c.p.id);
      // schon übernommene Einträge in Plänen bleiben – sie hängen nicht an der Vorlage
      const r = c.k.db.prepare('DELETE FROM planvorlage WHERE id = ?').run(id);
      if (Number(r.changes) === 0) throw new Fehler(404, 'Nicht gefunden');
      return { status: 200, body: { ok: true } };
    },
  },

];
