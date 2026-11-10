import { Fehler, holeBenutzer, idAus, istObjekt, koerper, text } from './api-basis';
import type { Ctx, Route } from './api-basis';
import type { DB } from './db';
import { transaktion } from './db';
import { heute } from './datum';
import { feiertageZwischen, istBundesland } from './feiertage';
import { ferienZwischen, ladeFerien } from './ferien';
import { ausbildungsjahrAm, gueltigesDatum, kalenderwoche, montagVon, plusTage } from './kalender';
import { protokolliere } from './protokoll';
import { darfAzubiVerwalten, darfPlanBearbeiten, darfPlanEintragAendern, sichtbareAzubis } from './rechte';
import { dauerVon, FACH, leseBetrieb, leseProfil, sichtbarerAzubi, standAus } from './stammdaten';
import type { BenutzerZeile } from './typen';

/**
 * Ausbildungsplan: Einträge je Azubi über ganze Kalenderwochen.
 * Arten: Schulblock, Einsatz (Abteilung/Einsatzort mit zuständiger Person), Aufgabe (mit Unteraufgaben), Notiz.
 * Ausbilder planen alles; Beauftragte legen während ihrer Zuweisung Aufgaben und Notizen an;
 * Azubis legen eigene Aufgaben und Notizen an und haken ab.
 */
export const ARTEN = ['schule', 'einsatz', 'aufgabe', 'notiz'] as const;
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
  erledigt: number;
  unteraufgaben: string;
  erstellt_von: number | null;
  geaendert: string;
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
  erledigt: boolean;
  unteraufgaben: Unteraufgabe[];
}

function eingabeAus(db: DB, roh: Record<string, unknown>): Eingabe {
  const art = artAus(roh.art);
  if (!gueltigesDatum(roh.von)) throw new Fehler(400, 'Beginn fehlt oder ist kein gültiges Datum');
  const von = montagVon(roh.von);
  const bisRoh = roh.bis === undefined || roh.bis === null || roh.bis === '' ? roh.von : roh.bis;
  if (!gueltigesDatum(bisRoh)) throw new Fehler(400, 'Ende ist kein gültiges Datum');
  const bis = montagVon(bisRoh);
  if (bis < von) throw new Fehler(400, 'Das Ende liegt vor dem Beginn');
  if (bis > plusTage(von, 7 * (MAX_WOCHEN - 1))) throw new Fehler(400, `Ein Eintrag darf höchstens ${MAX_WOCHEN} Wochen umfassen`);
  const unteraufgaben = unteraufgabenAus(roh.unteraufgaben, art);
  return {
    art,
    von,
    bis,
    titel: text(roh.titel, 120, 'Titel'),
    text: freitext(roh.text, 2000, 'Beschreibung'),
    zustaendig: zustaendigAus(db, roh.zustaendigId, art),
    erledigt: art === 'aufgabe' && roh.erledigt === true,
    unteraufgaben,
  };
}

function vorlageEintraegeAus(x: unknown): VorlageEintrag[] {
  if (!Array.isArray(x) || x.length > 100) throw new Fehler(400, 'Einträge der Vorlage fehlen (höchstens 100)');
  return x.map((e) => {
    if (!istObjekt(e)) throw new Fehler(400, 'Ungültiger Eintrag in der Vorlage');
    const art = artAus(e.art);
    return {
      art,
      abWoche: ganzzahl(e.abWoche, 1, 260, 'Woche'),
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
    erledigt: z.erledigt === 1,
    unteraufgaben: json<Unteraufgabe[]>(z.unteraufgaben, []),
    // vom Azubi selbst angelegt (im Unterschied zu dem, was Ausbilder und Beauftragte geplant haben)
    vomAzubi: z.erstellt_von === z.azubi_id,
    bearbeitbar: darfPlanEintragAendern(db, c.b, z, heute(c.k.jetzt())),
  };
}

function holeEintrag(c: Ctx, azubiId: number): EintragZeile {
  const z = c.k.db.prepare('SELECT * FROM plan_eintrag WHERE id = ? AND azubi_id = ?').get(idAus(c.p.eid), azubiId) as EintragZeile | undefined;
  if (!z) throw new Fehler(404, 'Nicht gefunden');
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
export function planDerWoche(db: DB, azubiId: number, montag: string): { art: Art; titel: string }[] {
  const zeilen = db
    .prepare("SELECT art, titel FROM plan_eintrag WHERE azubi_id = ? AND von <= ? AND bis >= ? AND art != 'notiz' ORDER BY CASE art WHEN 'schule' THEN 1 WHEN 'einsatz' THEN 2 ELSE 3 END, von, id")
    .all(azubiId, montag, montag) as unknown as { art: Art; titel: string }[];
  return zeilen.map((z) => ({ art: z.art, titel: z.titel }));
}

/** Legt für einen Einsatz die passende Zuweisung an, wenn noch keine den Zeitraum abdeckt. */
function weiseZu(db: DB, jetzt: Date, wer: BenutzerZeile, azubi: BenutzerZeile, e: Eingabe): boolean {
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
      const zeilen = db.prepare('SELECT * FROM plan_eintrag WHERE azubi_id = ? ORDER BY von, bis, id').all(azubi.id) as unknown as EintragZeile[];

      // Wochen der Ausbildung; Einträge außerhalb (z. B. nach geändertem Beginn) bleiben sichtbar
      let erste = dauer ? montagVon(dauer.beginn) : null;
      let letzte = dauer ? montagVon(dauer.ende) : null;
      for (const z of zeilen) {
        if (!erste || z.von < erste) erste = z.von;
        if (!letzte || z.bis > letzte) letzte = z.bis;
      }
      // Prüfungen nach dem Vertragsende (z. B. mündliche Prüfung) bleiben sichtbar
      for (const p of profil.pruefungen) {
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
          pruefungen: profil.pruefungen,
          feiertage: erste && istBundesland(betriebLand) ? feiertageZwischen(betriebLand, erste, ende).filter((f) => !f.teilweise) : [],
          ferien: ferien ? ferienZwischen(ferien, erste!, ende) : [],
          ferienVorhanden: ferien?.vorhanden ?? false,
          rechte: { arten: darfAlles ? ARTEN : darfAufgaben ? ['aufgabe', 'notiz'] : [], zuweisen: c.b.rolle === 'ausbilder' },
          // Auswahl für „zuständig“ und Vorlagen nur für die, die planen
          personen: darfAufgaben && c.b.rolle !== 'azubi'
            ? (db.prepare("SELECT id, anzeigename, rolle FROM benutzer WHERE rolle IN ('ausbilder', 'beauftragter') AND status = 'aktiv' ORDER BY anzeigename COLLATE NOCASE").all() as unknown[])
            : [],
          vorlagen:
            c.b.rolle === 'ausbilder'
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
      if (!darfPlanBearbeiten(db, c.b, azubi.id, e.art, heute(c.k.jetzt()))) throw new Fehler(403, 'Diese Art von Eintrag darfst du hier nicht anlegen', 'rolle');
      const anzahl = (db.prepare('SELECT COUNT(*) AS n FROM plan_eintrag WHERE azubi_id = ?').get(azubi.id) as { n: number }).n;
      if (anzahl >= MAX_EINTRAEGE) throw new Fehler(409, `Der Plan hat schon ${MAX_EINTRAEGE} Einträge`);
      const jetzt = c.k.jetzt();
      let zugewiesen = false;
      const id = transaktion(db, () => {
        const r = db
          .prepare(
            `INSERT INTO plan_eintrag (azubi_id, art, von, bis, titel, text, zustaendig_id, erledigt, unteraufgaben, erstellt_von, geaendert_von, geaendert)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(azubi.id, e.art, e.von, e.bis, e.titel, e.text, e.zustaendig?.id ?? null, e.erledigt ? 1 : 0, JSON.stringify(e.unteraufgaben), c.b.id, c.b.id, jetzt.toISOString());
        if (roh.zuweisen === true && c.b.rolle === 'ausbilder') zugewiesen = weiseZu(db, jetzt, c.b, azubi, e);
        return Number(r.lastInsertRowid);
      });
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
        db.prepare('UPDATE plan_eintrag SET art = ?, von = ?, bis = ?, titel = ?, text = ?, zustaendig_id = ?, erledigt = ?, unteraufgaben = ?, geaendert_von = ?, geaendert = ? WHERE id = ?').run(
          e.art,
          e.von,
          e.bis,
          e.titel,
          e.text,
          e.zustaendig?.id ?? null,
          e.erledigt ? 1 : 0,
          JSON.stringify(e.unteraufgaben),
          c.b.id,
          jetzt.toISOString(),
          alt.id,
        );
        if (roh.zuweisen === true && c.b.rolle === 'ausbilder') zugewiesen = weiseZu(db, jetzt, c.b, azubi, e);
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
    // Vorlage in den Plan übernehmen: Wochen zählen ab der Woche des Ausbildungsbeginns
    m: 'POST',
    p: '/api/azubis/:id/plan/vorlage',
    wer: ['ausbilder'],
    h: (c) => {
      const { db } = c.k;
      const id = idAus(c.p.id);
      if (!darfAzubiVerwalten(db, c.b, id)) throw new Fehler(404, 'Nicht gefunden');
      const azubi = holeBenutzer(db, id)!;
      const v = db.prepare('SELECT * FROM planvorlage WHERE id = ?').get(Number(koerper(c).vorlageId)) as VorlageZeile | undefined;
      if (!v) throw new Fehler(400, 'Unbekannte Vorlage');
      const dauer = dauerVon(db, leseProfil(db, id));
      if (!dauer) throw new Fehler(409, 'Für diesen Azubi ist noch kein Ausbildungsbeginn eingetragen');
      const start = montagVon(dauer.beginn);
      // was erst nach dem Ende der Ausbildung beginnen würde, entfällt; was hineinragt, wird gekürzt
      const letzte = montagVon(dauer.ende);
      const neu = json<VorlageEintrag[]>(v.eintraege, [])
        .map((e) => ({ e, von: plusTage(start, 7 * (e.abWoche - 1)) }))
        .filter((x) => x.von <= letzte)
        .map(({ e, von }) => {
          const bis = plusTage(von, 7 * (e.wochen - 1));
          return { e, von, bis: bis > letzte ? letzte : bis };
        });
      const anzahl = (db.prepare('SELECT COUNT(*) AS n FROM plan_eintrag WHERE azubi_id = ?').get(id) as { n: number }).n;
      if (anzahl + neu.length > MAX_EINTRAEGE) throw new Fehler(409, `Der Plan hätte danach mehr als ${MAX_EINTRAEGE} Einträge`);
      const jetzt = c.k.jetzt();
      transaktion(db, () => {
        const einfuegen = db.prepare(
          `INSERT INTO plan_eintrag (azubi_id, art, von, bis, titel, text, unteraufgaben, erstellt_von, geaendert_von, geaendert) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        );
        for (const { e, von, bis } of neu) {
          einfuegen.run(id, e.art, von, bis, e.titel, e.text, JSON.stringify(e.unteraufgaben.map((t) => ({ text: t, erledigt: false }))), c.b.id, c.b.id, jetzt.toISOString());
        }
        protokolliere(db, jetzt, 'fach', 'planvorlage_uebernommen', c.b, azubi, `${v.titel}: ${neu.length} Einträge`);
      });
      return { status: 200, body: { uebernommen: neu.length } };
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

  // ---------- Übersicht über alle Azubis ----------
  {
    m: 'GET',
    p: '/api/uebersicht',
    wer: ['ausbilder', 'beauftragter'],
    h: (c) => {
      const { db } = c.k;
      const tag = heute(c.k.jetzt());
      const vonRoh = c.a.query.get('von') || tag;
      if (!gueltigesDatum(vonRoh)) throw new Fehler(400, 'Beginn ist kein gültiges Datum');
      const anzahl = ganzzahl(c.a.query.get('wochen') ?? '26', 1, 53, 'Anzahl der Wochen');
      const start = montagVon(vonRoh);
      const wochen = Array.from({ length: anzahl }, (_, i) => {
        const montag = plusTage(start, 7 * i);
        return { montag, ...kalenderwoche(montag) };
      });
      const letzte = wochen[wochen.length - 1].montag;
      const azubis = sichtbareAzubis(db, c.b, tag).map((id) => {
        const b = holeBenutzer(db, id)!;
        const profil = leseProfil(db, id);
        const dauer = dauerVon(db, profil);
        const { beruf } = standAus(db, profil, tag);
        const eintraege = db.prepare("SELECT art, von, bis, titel FROM plan_eintrag WHERE azubi_id = ? AND art IN ('schule', 'einsatz') AND von <= ? AND bis >= ? ORDER BY von, id").all(id, letzte, start) as unknown as { art: Art; von: string; bis: string; titel: string }[];
        // Urlaub steht nicht im Plan, sondern in den Berichten (Abwesenheit mit Grund „Urlaub“)
        const urlaub = new Map<string, number>();
        for (const z of db.prepare('SELECT montag, inhalt FROM bericht WHERE azubi_id = ? AND montag >= ? AND montag <= ?').all(id, start, letzte) as unknown as { montag: string; inhalt: string }[]) {
          const tage = new Set(json<{ abwesenheit?: { tag: string; grund: string }[] }>(z.inhalt, {}).abwesenheit?.filter((a) => a.grund === 'urlaub').map((a) => a.tag) ?? []);
          if (tage.size) urlaub.set(z.montag, tage.size);
        }
        return {
          id,
          anzeigename: b.anzeigename,
          beruf: beruf?.bezeichnung ?? '',
          wochen: wochen.map((w) => ({
            inAusbildung: !!dauer && w.montag >= montagVon(dauer.beginn) && w.montag <= dauer.ende,
            schule: eintraege.some((e) => e.art === 'schule' && e.von <= w.montag && e.bis >= w.montag),
            einsatz: eintraege.filter((e) => e.art === 'einsatz' && e.von <= w.montag && e.bis >= w.montag).map((e) => e.titel),
            urlaubstage: urlaub.get(w.montag) ?? 0,
          })),
        };
      });
      return { status: 200, body: { heute: tag, wochen, azubis } };
    },
  },
];
