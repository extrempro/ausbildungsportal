import { urlaubsZeitraeume } from './urlaub';
import { randomBytes } from 'node:crypto';
import { Fehler } from './api-basis';
import type { Ctx, Kontext, Route } from './api-basis';
import type { DB } from './db';
import { plusTage } from './kalender';
import { protokolliere } from './protokoll';
import { darfAzubiSehen, sichtbareAzubis } from './rechte';
import { mitPlanerTerminen } from './planer';
import { leseProfil } from './stammdaten';
import type { BenutzerZeile } from './typen';

/**
 * Kalender-Abo (ICS): Schulblöcke, Einsätze und Prüfungstermine als ganztägige Termine zum Abonnieren.
 *
 * Kalenderprogramme können sich nicht über Microsoft anmelden. Deshalb gibt es je Konto einen Link mit einem langen,
 * zufälligen Geheimnis. Er gibt nur Lesezugriff, und bei jedem Abruf gelten die Rechte des Kontos von diesem Moment
 * (rechte.ts) – ein gesperrtes Konto oder eine beendete Zuweisung liefert sofort nichts mehr.
 * Im eigenen Kalender eines Azubis stehen dazu seine eigenen Termine – in keinem anderen. Bewusst nicht enthalten: Aufgaben, Notizen, Freitexte, Berichte, Ferien und Feiertage.
 */

const ROLLEN: Route['wer'] = ['ausbilder', 'beauftragter', 'azubi'];
/** Abrufe je IP in 15 Minuten: Kalenderdienste rufen selten ab, teilen sich aber Adressen; Raten ist bei 256 Bit ohnehin aussichtslos */
const ABRUFE_JE_IP = 300;

interface AboZeile {
  benutzer_id: number;
  geheimnis: string;
  erstellt: string;
  letzter_abruf: string | null;
}

function heute(jetzt: Date): string {
  return jetzt.toISOString().slice(0, 10);
}

function ansicht(c: Ctx, z: AboZeile | undefined) {
  if (!z) return { aktiv: false as const };
  return {
    aktiv: true as const,
    url: `${c.k.cfg.appUrl.replace(/\/+$/, '')}/api/abo/${z.geheimnis}.ics`,
    erstellt: z.erstellt,
    letzterAbruf: z.letzter_abruf,
    // wer mehrere Azubis betreut, kann den Kalender auf einen davon beschränken (?azubi=ID)
    azubis:
      c.b.rolle === 'azubi'
        ? []
        : sichtbareAzubis(c.k.db, c.b, heute(c.k.jetzt())).map((id) => ({ id, anzeigename: (c.k.db.prepare('SELECT anzeigename FROM benutzer WHERE id = ?').get(id) as { anzeigename: string }).anzeigename })),
  };
}

function hole(db: DB, id: number): AboZeile | undefined {
  return db.prepare('SELECT * FROM kalender_abo WHERE benutzer_id = ?').get(id) as AboZeile | undefined;
}

// ---------- ICS (RFC 5545) ----------

function text(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Zeilen dürfen höchstens 75 Bytes lang sein; längere werden mit Zeilenumbruch + Leerzeichen fortgesetzt. */
function falte(zeile: string): string {
  const teile: string[] = [];
  let aktuell = '';
  let bytes = 0;
  for (const zeichen of zeile) {
    const n = Buffer.byteLength(zeichen);
    if (bytes + n > (teile.length === 0 ? 75 : 74)) {
      teile.push(aktuell);
      aktuell = '';
      bytes = 0;
    }
    aktuell += zeichen;
    bytes += n;
  }
  teile.push(aktuell);
  return teile.join('\r\n ');
}

const tag = (iso: string) => iso.replace(/-/g, '');
const stempel = (iso: string) => {
  const d = new Date(iso);
  return (Number.isNaN(d.getTime()) ? new Date(0) : d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
};

/** Ganztägig (das Ende zählt in ICS nicht mehr mit) oder mit Uhrzeit – dann als Ortszeit ohne Zeitzone, also so, wie eingetragen. */
function zeitraum(t: Termin): string[] {
  if (!t.zeitVon) return [`DTSTART;VALUE=DATE:${tag(t.von)}`, `DTEND;VALUE=DATE:${tag(plusTage(t.bis, 1))}`];
  const uhr = (z: string) => `${tag(t.von)}T${z.replace(':', '')}00`;
  let ende = t.zeitBis;
  if (!ende) {
    const h = Number(t.zeitVon.slice(0, 2)) + 1;
    ende = h > 23 ? '23:59' : `${String(h).padStart(2, '0')}${t.zeitVon.slice(2)}`;
  }
  return [`DTSTART:${uhr(t.zeitVon)}`, `DTEND:${uhr(ende)}`];
}

interface Termin {
  uid: string;
  von: string;
  /** letzter Tag (einschließlich) */
  bis: string;
  /** HH:MM – dann ist es kein ganztägiger Termin; ohne Ende dauert er eine Stunde */
  zeitVon?: string;
  zeitBis?: string;
  titel: string;
  art: string;
  geaendert: string;
  beschreibung: string;
}

function termineVon(k: Kontext, db: DB, azubi: BenutzerZeile, mitName: boolean, host: string, eigener: boolean): Termin[] {
  const vorn = mitName ? `${azubi.anzeigename}: ` : '';
  const zeilen = db
    .prepare(
      `SELECT p.id, p.art, p.von, p.bis, p.titel, p.geaendert, z.anzeigename AS zustaendig
         FROM plan_eintrag p LEFT JOIN benutzer z ON z.id = p.zustaendig_id
        WHERE p.azubi_id = ? AND p.art IN ('schule', 'einsatz') ORDER BY p.von, p.id`,
    )
    .all(azubi.id) as unknown as { id: number; art: 'schule' | 'einsatz'; von: string; bis: string; titel: string; geaendert: string; zustaendig: string | null }[];
  const termine: Termin[] = zeilen.map((z) => ({
    uid: `plan-${z.id}@${host}`,
    von: z.von,
    bis: plusTage(z.bis, 6), // „bis“ ist der Montag der letzten Woche; angezeigt wird bis Sonntag
    titel: vorn + z.titel,
    art: z.art === 'schule' ? 'Berufsschule' : 'Einsatz',
    geaendert: z.geaendert,
    beschreibung: [z.art === 'schule' ? 'Berufsschule' : 'Einsatz', z.zustaendig ? `Zuständig: ${z.zustaendig}` : ''].filter(Boolean).join('\n'),
  }));
  // Termine, die der Azubi selbst eingetragen hat (z. B. JAV-Sitzung) – nur in seinem eigenen Kalender, ohne den Freitext
  const eigene = !eigener
    ? []
    : db
        .prepare("SELECT id, tag, zeit_von, zeit_bis, titel, geaendert FROM plan_eintrag WHERE azubi_id = ? AND art = 'termin' ORDER BY tag, zeit_von, id")
        .all(azubi.id) as unknown as { id: number; tag: string; zeit_von: string; zeit_bis: string; titel: string; geaendert: string }[];
  for (const z of eigene) {
    termine.push({ uid: `plan-${z.id}@${host}`, von: z.tag, bis: z.tag, zeitVon: z.zeit_von || undefined, zeitBis: z.zeit_bis || undefined, titel: vorn + z.titel, art: 'Termin', geaendert: z.geaendert, beschreibung: 'Termin' });
  }
  // genehmigter Urlaub – als ganztägiger Termin über den ganzen Zeitraum
  for (const u of urlaubsZeitraeume(db, azubi.id, 'genehmigt', '2000-01-01', '2100-12-31')) {
    termine.push({ uid: `urlaub-${u.id}@${host}`, von: u.von, bis: u.bis, titel: `${vorn}Urlaub`, art: 'Urlaub', geaendert: u.geaendert, beschreibung: 'Genehmigter Urlaub' });
  }
  const profil = leseProfil(db, azubi.id);
  const profilZeit = (db.prepare('SELECT geaendert FROM azubi_profil WHERE benutzer_id = ?').get(azubi.id) as { geaendert: string } | undefined)?.geaendert ?? '';
  mitPlanerTerminen(k, azubi.id, profil.pruefungen).forEach((p, i) => {
    if (!p.datum) return;
    termine.push({ uid: `pruefung-${azubi.id}-${p.datum}-${i}@${host}`, von: p.datum, bis: p.datum, titel: `${vorn}Prüfung: ${p.bezeichnung}`, art: 'Prüfung', geaendert: profilZeit, beschreibung: 'Prüfungstermin' });
  });
  return termine;
}

export function alsIcs(name: string, termine: Termin[], jetzt: Date): string {
  const z: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ausbildungsportal//Ausbildungsplan//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${text(name)}`,
    `NAME:${text(name)}`,
    // Wunsch an das Kalenderprogramm; wie oft es wirklich abruft, bestimmt es selbst
    'REFRESH-INTERVAL;VALUE=DURATION:PT4H',
    'X-PUBLISHED-TTL:PT4H',
  ];
  for (const t of termine) {
    z.push(
      'BEGIN:VEVENT',
      `UID:${t.uid}`,
      `DTSTAMP:${stempel(jetzt.toISOString())}`,
      `LAST-MODIFIED:${stempel(t.geaendert)}`,
      ...zeitraum(t),
      `SUMMARY:${text(t.titel)}`,
      `DESCRIPTION:${text(t.beschreibung)}`,
      `CATEGORIES:${text(t.art)}`,
      'TRANSP:TRANSPARENT', // blockt den Tag nicht als „beschäftigt“
      'END:VEVENT',
    );
  }
  z.push('END:VCALENDAR');
  return z.map(falte).join('\r\n') + '\r\n';
}

// ---------- Routen ----------

export const ABO_ROUTEN: Route[] = [
  {
    m: 'GET',
    p: '/api/ich/kalender',
    wer: ROLLEN,
    h: (c) => ({ status: 200, body: ansicht(c, hole(c.k.db, c.b.id)) }),
  },

  {
    // Link erstellen oder erneuern – ein alter Link gilt ab sofort nicht mehr
    m: 'POST',
    p: '/api/ich/kalender',
    wer: ROLLEN,
    h: (c) => {
      const { db } = c.k;
      const gab = !!hole(db, c.b.id);
      db.prepare(
        `INSERT INTO kalender_abo (benutzer_id, geheimnis, erstellt) VALUES (?, ?, ?)
         ON CONFLICT(benutzer_id) DO UPDATE SET geheimnis = excluded.geheimnis, erstellt = excluded.erstellt, letzter_abruf = NULL`,
      ).run(c.b.id, randomBytes(32).toString('base64url'), c.k.jetzt().toISOString());
      protokolliere(db, c.k.jetzt(), 'konto', gab ? 'kalender_link_erneuert' : 'kalender_link_erstellt', c.b);
      return { status: 200, body: ansicht(c, hole(db, c.b.id)) };
    },
  },

  {
    m: 'DELETE',
    p: '/api/ich/kalender',
    wer: ROLLEN,
    h: (c) => {
      if (c.k.db.prepare('DELETE FROM kalender_abo WHERE benutzer_id = ?').run(c.b.id).changes) protokolliere(c.k.db, c.k.jetzt(), 'konto', 'kalender_link_geloescht', c.b);
      return { status: 200, body: { aktiv: false } };
    },
  },

  {
    // Der Abruf durch das Kalenderprogramm: ohne Anmeldung, nur mit dem Geheimnis im Link.
    // Unbekannt, gesperrt, falsche Rolle, fremder Azubi – alles sieht gleich aus (404).
    m: 'GET',
    p: '/api/abo/:datei',
    wer: 'offen',
    begrenzt: ABRUFE_JE_IP,
    h: (c) => {
      const { db } = c.k;
      const m = /^([A-Za-z0-9_-]{43})\.ics$/.exec(c.p.datei);
      const abo = m ? (db.prepare('SELECT * FROM kalender_abo WHERE geheimnis = ?').get(m[1]) as AboZeile | undefined) : undefined;
      const wer = abo ? (db.prepare('SELECT * FROM benutzer WHERE id = ?').get(abo.benutzer_id) as BenutzerZeile | undefined) : undefined;
      if (!abo || !wer || wer.status !== 'aktiv' || wer.rolle === 'admin') throw new Fehler(404, 'Nicht gefunden');
      const jetzt = c.k.jetzt();
      const tagHeute = heute(jetzt);
      const host = new URL(c.k.cfg.appUrl).hostname;

      let ids = sichtbareAzubis(db, wer, tagHeute);
      const nur = c.a.query.get('azubi');
      if (nur !== null) {
        const id = Number(nur);
        if (!darfAzubiSehen(db, wer, id, tagHeute)) throw new Fehler(404, 'Nicht gefunden');
        ids = [id];
      }
      const azubis = ids.map((id) => db.prepare('SELECT * FROM benutzer WHERE id = ?').get(id) as unknown as BenutzerZeile);
      const mitName = wer.rolle !== 'azubi' && nur === null;
      const termine = azubis.flatMap((a) => termineVon(c.k, db, a, mitName, host, a.id === wer.id));
      const name = wer.rolle === 'azubi' ? 'Ausbildungsplan' : nur !== null && azubis[0] ? `Ausbildungsplan ${azubis[0].anzeigename}` : 'Ausbildungsplan Azubis';

      db.prepare('UPDATE kalender_abo SET letzter_abruf = ? WHERE benutzer_id = ?').run(jetzt.toISOString(), wer.id);
      return { status: 200, text: { typ: 'text/calendar; charset=utf-8', inhalt: alsIcs(name, termine, jetzt), dateiname: 'ausbildungsplan.ics' } };
    },
  },
];
