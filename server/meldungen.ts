import { merkeAktivitaet } from './aktivitaet';
import { Fehler, idAus, koerper } from './api-basis';
import type { Ctx, Kontext, Route } from './api-basis';
import { bildTyp } from './branding';
import type { DB } from './db';
import { allgemeinesPaket, lernpakete, paketVon } from './lernen';
import type { Paket } from './lernen';

/**
 * Rückmeldungen in drei Arten – jede geht an die, die damit etwas anfangen können:
 * - „fehler“: Jedes Konto kann ein Problem melden; lesen und bearbeiten kann es nur der Super-Admin (er betreibt das Portal).
 *   Technische Angaben kommen automatisch dazu – der Text selbst stammt vom Menschen und sollte keine Inhalte aus
 *   Berichten enthalten (darauf weist das Formular hin).
 * - „idee“: Wunsch fürs Portal, von jedem Konto. Mit Name und Seite, ohne Technik und Bild. Der Super-Admin bearbeitet,
 *   die Ausbilder lesen mit.
 * - „inhalt“: Ein Azubi möchte etwas aus dem Lernmodul besser erklärt haben. Das lesen nur die Ausbilder (sie schreiben
 *   die Inhalte) – und es wird OHNE Person gespeichert: kein Konto, kein Name, keine Technik, als Zeit nur der Tag.
 *   Wo jemand beim Lernen hängt, gehört wie der Lernstand dem Azubi; der Super-Admin sieht diese Art gar nicht.
 */
export type MeldungArt = 'fehler' | 'idee' | 'inhalt';
const MAX_TEXT = 2000;
/** so viele Nachrichten hat ein Gespräch zu einer Meldung höchstens */
const MAX_NACHRICHTEN = 100;
const MIN_TEXT = 10;
const JE_TAG = 10;
const MAX_LISTE = 300;
export const MAX_BILD = 150 * 1024;

/** Bildschirmfoto als Data-URL prüfen – nur Rasterbilder, geprüft wird der Dateianfang. */
function bildAus(x: unknown): string | null {
  if (x === undefined || x === null || x === '') return null;
  const m = typeof x === 'string' ? /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(x) : null;
  if (!m) throw new Fehler(400, 'Das Bild muss ein PNG-, JPEG- oder WebP-Bild sein');
  const bild = Buffer.from(m[1], 'base64');
  if (bild.length > MAX_BILD) throw new Fehler(400, `Das Bild ist zu groß (höchstens ${MAX_BILD / 1024} KB)`);
  const typ = bildTyp(bild);
  if (!typ) throw new Fehler(400, 'Die Datei ist kein gültiges PNG-, JPEG- oder WebP-Bild');
  return `data:${typ};base64,${bild.toString('base64')}`;
}

const ROLLEN_TEXT: Record<string, string> = { admin: 'Super-Admin', ausbilder: 'Ausbilder', beauftragter: 'Ausbildungsbeauftragte', azubi: 'Azubi' };

/**
 * Karte für einen Teams-Workflow („Beim Empfang einer Teams-Webhookanforderung“).
 * Ohne Namen und ohne Bild; der Text der Meldung nur, wenn der Betreiber das eingeschaltet hat –
 * in einem Teams-Kanal lesen oft mehr Personen mit als im Portal.
 */
export function teamsKarte(k: Kontext, m: { id: number; rolle: string; seite: string; text: string; mitBild: boolean; art?: MeldungArt; /** die meldende Person hat auf eine Rückfrage geantwortet */ antwort?: boolean } | null) {
  const titel = !m
    ? 'Test: Das Ausbildungsportal kann diesen Kanal benachrichtigen'
    : m.antwort
      ? `Neue Antwort zu ${m.art === 'idee' ? 'Idee' : 'Fehlermeldung'} Nr. ${m.id} im Ausbildungsportal`
      : `${m.art === 'idee' ? 'Neue Idee fürs Ausbildungsportal' : 'Neue Fehlermeldung im Ausbildungsportal'} (Nr. ${m.id})`;
  const body: unknown[] = [{ type: 'TextBlock', size: 'Medium', weight: 'Bolder', wrap: true, text: titel }];
  if (m?.antwort) {
    body.push({ type: 'FactSet', facts: [{ title: 'Geantwortet von', value: ROLLEN_TEXT[m.rolle] ?? m.rolle }] });
    if (k.cfg.fehlerWebhookMitText) body.push({ type: 'TextBlock', wrap: true, text: m.text.length > 600 ? `${m.text.slice(0, 600)} …` : m.text });
  } else if (m) {
    body.push({
      type: 'FactSet',
      facts: [
        { title: 'Gemeldet von', value: ROLLEN_TEXT[m.rolle] ?? m.rolle },
        { title: 'Seite', value: m.seite || '–' },
        { title: 'Version', value: k.version },
        ...(m.art === 'idee' ? [] : [{ title: 'Bildschirmfoto', value: m.mitBild ? 'ja' : 'nein' }]),
      ],
    });
    if (k.cfg.fehlerWebhookMitText) body.push({ type: 'TextBlock', wrap: true, text: m.text.length > 600 ? `${m.text.slice(0, 600)} …` : m.text });
  } else {
    body.push({ type: 'TextBlock', wrap: true, text: 'Ab jetzt erscheint hier ein Hinweis, sobald jemand im Portal einen Fehler meldet oder eine Idee fürs Portal schickt.' });
  }
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body,
          actions: [{ type: 'Action.OpenUrl', title: 'Im Portal öffnen', url: `${k.cfg.appUrl}/verwaltung/meldungen` }],
        },
      },
    ],
  };
}

/** Karte für den Teams-Kanal: Ein Ausbilder hat Lerninhalte eingereicht. Ohne Namen – wer eingereicht hat, steht im Portal. */
export function teamsKarteEinreichung(k: Kontext, e: { kennung: string; titel: string; themenfelder: number; unterthemen: number }) {
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            { type: 'TextBlock', size: 'Medium', weight: 'Bolder', wrap: true, text: 'Lerninhalte im Ausbildungsportal eingereicht' },
            {
              type: 'FactSet',
              facts: [
                { title: 'Lernmodul', value: e.titel ? `${e.titel} (${e.kennung})` : e.kennung },
                { title: 'Umfang', value: `${e.themenfelder} Themenfelder, ${e.unterthemen} Unterthemen` },
                { title: 'Version', value: k.version },
              ],
            },
            { type: 'TextBlock', wrap: true, text: 'Die Einreichung wartet auf die Prüfung durch den Super-Admin.' },
          ],
          actions: [{ type: 'Action.OpenUrl', title: 'Im Portal öffnen', url: `${k.cfg.appUrl}/verwaltung/lerninhalte` }],
        },
      },
    ],
  };
}

/** Schickt die Karte; ein Fehler steht im Log (ohne die Adresse – sie ist ein Geheimnis) und stört die Meldung nicht. */
export async function benachrichtige(k: Kontext, karte: unknown): Promise<string | null> {
  if (!k.cfg.fehlerWebhook) return 'nicht eingerichtet';
  try {
    const r = await k.sende(k.cfg.fehlerWebhook, karte);
    if (r.ok) return null;
    k.log(`Teams-Benachrichtigung fehlgeschlagen: die Gegenstelle antwortet mit Status ${r.status}`);
    return `Die Gegenstelle antwortet mit Status ${r.status}`;
  } catch (e) {
    const grund = e instanceof Error && e.name === 'TimeoutError' ? 'keine Antwort innerhalb von acht Sekunden' : 'die Adresse ist nicht erreichbar';
    k.log(`Teams-Benachrichtigung fehlgeschlagen: ${grund}`);
    return grund;
  }
}

interface Zeile {
  id: number;
  zeit: string;
  benutzer_name: string;
  rolle: string;
  text: string;
  seite: string;
  version: string;
  browser: string;
  fenster: string;
  technik: string;
  status: 'offen' | 'erledigt';
  erledigt_am: string | null;
  hat_bild: number;
  art: MeldungArt;
  paket: string;
  thema: string;
  ziel: string;
  benutzer_id: number | null;
  antwort_neu: number;
  person_gesehen: number;
}

export interface Nachricht {
  id: number;
  zeit: string;
  name: string;
  rolle: string;
  /** von der meldenden Person selbst (sonst von Super-Admin oder Ausbilder) */
  vonPerson: boolean;
  text: string;
}

/** Das Gespräch zu jeder der Meldungen, älteste Nachricht zuerst. */
function nachrichtenVon(db: DB, meldungen: Pick<Zeile, 'id' | 'benutzer_id'>[]): Map<number, Nachricht[]> {
  const aus = new Map<number, Nachricht[]>(meldungen.map((m) => [m.id, []]));
  if (meldungen.length === 0) return aus;
  const person = new Map(meldungen.map((m) => [m.id, m.benutzer_id]));
  const zeilen = db
    .prepare(`SELECT id, meldung_id, zeit, von_id, von_name, von_rolle, text FROM fehlermeldung_nachricht WHERE meldung_id IN (${meldungen.map(() => '?').join(',')}) ORDER BY id`)
    .all(...meldungen.map((m) => m.id)) as unknown as { id: number; meldung_id: number; zeit: string; von_id: number | null; von_name: string; von_rolle: string; text: string }[];
  for (const n of zeilen) aus.get(n.meldung_id)?.push({ id: n.id, zeit: n.zeit, name: n.von_name, rolle: n.von_rolle, vonPerson: n.von_id !== null && n.von_id === person.get(n.meldung_id), text: n.text });
  return aus;
}

/** Meldung in Kurzform für die Glocke – ohne Inhalt */
const kurz = (z: Pick<Zeile, 'id' | 'art'>) => `${z.art === 'idee' ? 'Idee' : 'Fehlermeldung'} Nr. ${z.id}`;

/** die meldende Person, wenn es sie noch gibt und sie nicht selbst die schreibende ist */
function personVon(c: Ctx, z: Pick<Zeile, 'benutzer_id'>): number | null {
  if (z.benutzer_id === null || z.benutzer_id === c.b.id) return null;
  const da = c.k.db.prepare("SELECT 1 FROM benutzer WHERE id = ? AND status = 'aktiv'").get(z.benutzer_id);
  return da ? z.benutzer_id : null;
}

/** Text einer Nachricht prüfen und speichern; gibt die neue Nachricht zurück. */
function speichereNachricht(c: Ctx, z: Zeile): string {
  const roh = koerper(c).text;
  if (typeof roh === 'string' && roh.trim().length > MAX_TEXT) throw new Fehler(400, `Der Text ist zu lang (höchstens ${MAX_TEXT} Zeichen)`);
  const text = sauber(roh, MAX_TEXT);
  if (text.length < 2) throw new Fehler(400, 'Bitte schreib eine Nachricht');
  const anzahl = (c.k.db.prepare('SELECT COUNT(*) AS n FROM fehlermeldung_nachricht WHERE meldung_id = ?').get(z.id) as { n: number }).n;
  if (anzahl >= MAX_NACHRICHTEN) throw new Fehler(409, 'Zu dieser Meldung gibt es schon sehr viele Nachrichten. Bitte sprecht direkt miteinander.');
  c.k.db.prepare('INSERT INTO fehlermeldung_nachricht (meldung_id, zeit, von_id, von_name, von_rolle, text) VALUES (?, ?, ?, ?, ?, ?)').run(z.id, c.k.jetzt().toISOString(), c.b.id, c.b.anzeigename, c.b.rolle, text);
  return text;
}

/** Super-Admin oder Ausbilder schreibt der meldenden Person: Glocke (und auf Wunsch Teams/E-Mail) für sie. */
function schreibeRueckfrage(c: Ctx, z: Zeile): void {
  if (z.art === 'inhalt') throw new Fehler(404, 'Meldung nicht gefunden');
  if (z.benutzer_id === null) throw new Fehler(409, 'Die Person, die das gemeldet hat, gibt es im Portal nicht mehr.');
  speichereNachricht(c, z);
  c.k.db.prepare('UPDATE fehlermeldung SET antwort_neu = 0 WHERE id = ?').run(z.id);
  const person = personVon(c, z);
  if (person !== null) merkeAktivitaet(c.k.db, c.k.jetzt(), 'meldung_rueckfrage', person, c.b, null, kurz(z));
}

/** mehrzeiliger Text ohne andere Steuerzeichen, auf die Höchstlänge gekürzt */
function sauber(x: unknown, max: number, einzeilig = false): string {
  let s = typeof x === 'string' ? x.replace(/\r\n?/g, '\n') : '';
  s = s.replace(einzeilig ? /[\u0000-\u001f\u007f]/g : /[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim();
  return s.slice(0, max);
}

function ansicht(z: Zeile, nachrichten: Nachricht[]) {
  return { id: z.id, art: z.art, zeit: z.zeit, name: z.benutzer_name, rolle: z.rolle, text: z.text, seite: z.seite, version: z.version, browser: z.browser, fenster: z.fenster, technik: z.technik, status: z.status, erledigtAm: z.erledigt_am, hatBild: z.hat_bild === 1, nachrichten, antwortNeu: z.antwort_neu === 1, personDa: z.benutzer_id !== null };
}

const SPALTEN = 'id, zeit, benutzer_name, rolle, text, seite, version, browser, fenster, technik, status, erledigt_am, bild IS NOT NULL AS hat_bild, art, paket, thema, ziel, benutzer_id, antwort_neu, person_gesehen';

/** Liste des Super-Admins: Fehler und Ideen – Wünsche zu Lerninhalten sieht er nicht. */
function liste(c: Ctx) {
  // die Bilder selbst gehören nicht in die Liste – sie werden einzeln geholt
  const zeilen = c.k.db.prepare(`SELECT ${SPALTEN} FROM fehlermeldung WHERE art <> 'inhalt' ORDER BY status = 'erledigt', id DESC LIMIT ?`).all(MAX_LISTE) as unknown as Zeile[];
  const gespraeche = nachrichtenVon(c.k.db, zeilen);
  return { meldungen: zeilen.map((z) => ansicht(z, gespraeche.get(z.id) ?? [])), offen: zeilen.filter((z) => z.status === 'offen').length, webhook: !!c.k.cfg.fehlerWebhook, webhookMitText: c.k.cfg.fehlerWebhookMitText };
}

/** Liste der Ausbilder: Wünsche zu Lerninhalten (bearbeiten) und Ideen fürs Portal (nur lesen, ohne technische Angaben). */
function listeAusbilder(c: Ctx) {
  const hole = (art: MeldungArt) => c.k.db.prepare(`SELECT ${SPALTEN} FROM fehlermeldung WHERE art = ? ORDER BY status = 'erledigt', id DESC LIMIT ?`).all(art, MAX_LISTE) as unknown as Zeile[];
  const pakete = lernpakete(c.k);
  const inhalte = hole('inhalt');
  const ideen = hole('idee');
  const gespraeche = nachrichtenVon(c.k.db, ideen);
  /** Wohin der Knopf „Zum Thema“ springt: gespeicherte Kennungen, bei älteren Wünschen über die Titel gesucht – und nur, wenn es die Stelle im Paket noch gibt. */
  const stelle = (z: Zeile): { feld: string; unterthema: string } | null => {
    const p = pakete.get(z.paket);
    if (!p) return null;
    let [feldId, unterId] = z.ziel.split('|');
    if (!feldId && z.thema) {
      const [ft, ut] = z.thema.split(' › ');
      const f = p.inhalte.themenfelder.find((x) => x.titel === ft);
      feldId = f?.id ?? '';
      unterId = (ut && f?.unterthemen.find((x) => x.titel === ut)?.id) || '';
    }
    const feld = p.inhalte.themenfelder.find((x) => x.id === feldId);
    if (!feld) return null;
    return { feld: feld.id, unterthema: unterId && feld.unterthemen.some((x) => x.id === unterId) ? unterId : '' };
  };
  return {
    inhalte: inhalte.map((z) => ({ id: z.id, tag: z.zeit.slice(0, 10), paket: z.paket, paketTitel: pakete.get(z.paket)?.titel ?? z.paket, thema: z.thema, stelle: stelle(z), text: z.text, status: z.status, erledigtAm: z.erledigt_am })),
    ideen: ideen.map((z) => ({ id: z.id, zeit: z.zeit, name: z.benutzer_name, rolle: z.rolle, text: z.text, seite: z.seite, status: z.status, erledigtAm: z.erledigt_am, nachrichten: gespraeche.get(z.id) ?? [], antwortNeu: z.antwort_neu === 1, personDa: z.benutzer_id !== null })),
    offen: inhalte.filter((z) => z.status === 'offen').length,
  };
}

/** Meldung aus der Adresse – nur aus den Arten, die diese Rolle bearbeiten darf; alles andere gibt es für sie nicht (404). */
function holeMeldung(c: Ctx, arten: MeldungArt[] = ['fehler', 'idee']): Zeile {
  const id = idAus(c.p.id);
  const z = Number.isInteger(id) ? (c.k.db.prepare(`SELECT ${SPALTEN} FROM fehlermeldung WHERE id = ?`).get(id) as unknown as Zeile | undefined) : undefined;
  if (!z || !arten.includes(z.art)) throw new Fehler(404, 'Meldung nicht gefunden');
  return z;
}

/** Eigene Fehlermeldungen und Ideen mit Gespräch – ohne Technik und Bild (die hat die Person selbst geschickt). */
function meine(c: Ctx) {
  const zeilen = c.k.db.prepare(`SELECT ${SPALTEN} FROM fehlermeldung WHERE benutzer_id = ? AND art <> 'inhalt' ORDER BY id DESC LIMIT ?`).all(c.b.id, MAX_LISTE) as unknown as Zeile[];
  const gespraeche = nachrichtenVon(c.k.db, zeilen);
  const meldungen = zeilen.map((z) => {
    const nachrichten = gespraeche.get(z.id) ?? [];
    return { id: z.id, art: z.art, zeit: z.zeit, text: z.text, seite: z.seite, status: z.status, erledigtAm: z.erledigt_am, nachrichten, neu: nachrichten.filter((n) => !n.vonPerson && n.id > z.person_gesehen).length };
  });
  return { meldungen, neu: meldungen.reduce((s, m) => s + m.neu, 0) };
}

/** eigene Meldung aus der Adresse – fremde gibt es für die Person nicht (404) */
function eigeneMeldung(c: Ctx): Zeile {
  const id = idAus(c.p.id);
  const z = Number.isInteger(id) ? (c.k.db.prepare(`SELECT ${SPALTEN} FROM fehlermeldung WHERE id = ? AND benutzer_id = ? AND art <> 'inhalt'`).get(id, c.b.id) as unknown as Zeile | undefined) : undefined;
  if (!z) throw new Fehler(404, 'Meldung nicht gefunden');
  return z;
}

/** Die Lernmodule, zu denen ein Azubi etwas wünschen kann: das seines Berufs und das für alle Berufe. */
function lernBereiche(c: Ctx): { bereich: 'lernen' | 'anleitungen'; p: Paket }[] {
  const beruf = paketVon(c.k, c.b);
  const alle = allgemeinesPaket(c.k);
  return [...(beruf ? [{ bereich: 'lernen' as const, p: beruf }] : []), ...(alle && alle.id !== beruf?.id ? [{ bereich: 'anleitungen' as const, p: alle }] : [])];
}

/** „bereich|themenfeld|unterthema“ aus dem Formular → Lernmodul und lesbares Thema. Leer heißt: nichts Bestimmtes. */
function themaAus(c: Ctx, x: unknown): { paket: string; thema: string; ziel: string } {
  const bereiche = lernBereiche(c);
  if (bereiche.length === 0) throw new Fehler(409, 'Für dich sind im Portal keine Lerninhalte eingerichtet');
  const [bereich, feldId, unterId] = (typeof x === 'string' ? x : '').split('|');
  const b = bereiche.find((y) => y.bereich === bereich) ?? (bereich ? null : bereiche[0]);
  if (!b) throw new Fehler(400, 'Dieses Thema gibt es nicht');
  if (!feldId) return { paket: b.p.id, thema: '', ziel: '' };
  const feld = b.p.inhalte.themenfelder.find((f) => f.id === feldId);
  const unter = unterId ? feld?.unterthemen.find((u) => u.id === unterId) : undefined;
  if (!feld || (unterId && !unter)) throw new Fehler(400, 'Dieses Thema gibt es nicht');
  return { paket: b.p.id, thema: unter ? `${feld.titel} › ${unter.titel}` : feld.titel, ziel: unter ? `${feld.id}|${unter.id}` : feld.id };
}

/**
 * Wünsche zu Lerninhalten werden ohne Person gespeichert – die Grenze je Tag lässt sich deshalb nicht aus der Datenbank zählen.
 * Sie steht nur im Arbeitsspeicher (je Datenbank) und beginnt nach einem Neustart von vorn.
 */
const inhaltZaehler = new WeakMap<DB, Map<number, number[]>>();
function zaehleInhalt(db: DB, benutzerId: number, jetzt: number): boolean {
  let m = inhaltZaehler.get(db);
  if (!m) inhaltZaehler.set(db, (m = new Map()));
  const zeiten = (m.get(benutzerId) ?? []).filter((t) => t > jetzt - 86_400_000);
  if (zeiten.length >= JE_TAG) return false;
  m.set(benutzerId, [...zeiten, jetzt]);
  return true;
}

export const MELDUNG_ROUTEN: Route[] = [
  {
    m: 'POST',
    p: '/api/fehlermeldungen',
    wer: 'alle',
    h: (c) => {
      const roh = koerper(c);
      const art: unknown = roh.art ?? 'fehler';
      if (art !== 'fehler' && art !== 'idee' && art !== 'inhalt') throw new Fehler(400, 'Unbekannte Art der Rückmeldung');
      if (art === 'inhalt' && c.b.rolle !== 'azubi') throw new Fehler(403, 'Wünsche zu Lerninhalten können nur Azubis schicken');
      if (typeof roh.text === 'string' && roh.text.trim().length > MAX_TEXT) throw new Fehler(400, `Der Text ist zu lang (höchstens ${MAX_TEXT} Zeichen)`);
      const text = sauber(roh.text, MAX_TEXT);
      if (text.length < MIN_TEXT) throw new Fehler(400, art === 'fehler' ? 'Bitte beschreibe kurz, was passiert ist (mindestens 10 Zeichen)' : 'Bitte schreib etwas mehr (mindestens 10 Zeichen)');
      const jetzt = c.k.jetzt();
      const zuViel = new Fehler(429, `Du hast heute schon ${JE_TAG} Meldungen geschickt. Bitte sprich deinen Ausbilder oder den Betreiber des Portals direkt an.`);
      if (art === 'inhalt') {
        const { paket, thema, ziel } = themaAus(c, roh.thema);
        if (!zaehleInhalt(c.k.db, c.b.id, jetzt.getTime())) throw zuViel;
        // ohne Person: kein Konto, kein Name, keine Seite, keine Technik – und nur der Tag
        c.k.db.prepare("INSERT INTO fehlermeldung (zeit, benutzer_id, benutzer_name, rolle, text, art, paket, thema, ziel) VALUES (?, NULL, '', 'azubi', ?, 'inhalt', ?, ?, ?)").run(jetzt.toISOString().slice(0, 10), text, paket, thema, ziel);
        return { status: 201, body: { ok: true } };
      }
      const seit = new Date(jetzt.getTime() - 86_400_000).toISOString();
      const heute = (c.k.db.prepare('SELECT COUNT(*) AS n FROM fehlermeldung WHERE benutzer_id = ? AND zeit > ?').get(c.b.id, seit) as { n: number }).n;
      if (heute >= JE_TAG) throw zuViel;
      // eine Idee braucht weder Bild noch Technik – was mitkommt, wird nicht gespeichert
      const fehler = art === 'fehler';
      const bild = fehler ? bildAus(roh.bild) : null;
      const seite = sauber(roh.seite, 200, true);
      const r = c.k.db
        .prepare('INSERT INTO fehlermeldung (zeit, benutzer_id, benutzer_name, rolle, text, seite, version, browser, fenster, technik, bild, art) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(jetzt.toISOString(), c.b.id, c.b.anzeigename, c.b.rolle, text, seite, c.k.version, fehler ? sauber(c.a.headers['user-agent'], 300, true) : '', fehler ? sauber(roh.fenster, 40, true) : '', fehler ? sauber(roh.technik, 1500) : '', bild, art);
      // nicht abwarten: Die Meldung ist gespeichert, auch wenn Teams gerade nicht antwortet
      if (c.k.cfg.fehlerWebhook) void benachrichtige(c.k, teamsKarte(c.k, { id: Number(r.lastInsertRowid), rolle: c.b.rolle, seite, text, mitBild: bild !== null, art }));
      return { status: 201, body: { ok: true } };
    },
  },
  { m: 'GET', p: '/api/fehlermeldungen', wer: ['admin'], h: (c) => ({ status: 200, body: liste(c) }) },
  {
    m: 'GET',
    p: '/api/fehlermeldungen/:id/bild',
    wer: ['admin'],
    h: (c) => {
      const bild = (c.k.db.prepare('SELECT bild FROM fehlermeldung WHERE id = ?').get(holeMeldung(c).id) as { bild: string | null }).bild;
      if (!bild) throw new Fehler(404, 'Zu dieser Meldung gibt es kein Bild');
      return { status: 200, body: { bild } };
    },
  },
  {
    // Rückfrage des Super-Admins an die meldende Person (Fehler und Ideen)
    m: 'POST',
    p: '/api/fehlermeldungen/:id/nachricht',
    wer: ['admin'],
    h: (c) => {
      schreibeRueckfrage(c, holeMeldung(c));
      return { status: 201, body: liste(c) };
    },
  },
  {
    // schickt eine Testkarte, damit sich die Einrichtung prüfen lässt, ohne eine Meldung zu erfinden
    m: 'POST',
    p: '/api/fehlermeldungen/webhook-test',
    wer: ['admin'],
    h: async (c) => {
      if (!c.k.cfg.fehlerWebhook) throw new Fehler(409, 'Die Benachrichtigung ist nicht eingerichtet (FEHLER_WEBHOOK_URL fehlt in der .env)');
      const fehler = await benachrichtige(c.k, teamsKarte(c.k, null));
      if (fehler) throw new Fehler(502, `Die Testnachricht kam nicht an: ${fehler}`);
      return { status: 200, body: { ok: true } };
    },
  },
  {
    m: 'PATCH',
    p: '/api/fehlermeldungen/:id',
    wer: ['admin'],
    h: (c) => {
      const z = holeMeldung(c);
      const status = koerper(c).status;
      if (status !== 'offen' && status !== 'erledigt') throw new Fehler(400, 'Unbekannter Status');
      c.k.db.prepare('UPDATE fehlermeldung SET status = ?, erledigt_am = ?, antwort_neu = 0 WHERE id = ?').run(status, status === 'erledigt' ? c.k.jetzt().toISOString() : null, z.id);
      // erledigt: Die meldende Person erfährt es (Glocke, auf Wunsch Teams/E-Mail)
      const person = status === 'erledigt' && z.status !== 'erledigt' ? personVon(c, z) : null;
      if (person !== null) merkeAktivitaet(c.k.db, c.k.jetzt(), 'meldung_erledigt', person, c.b, null, kurz(z));
      return { status: 200, body: liste(c) };
    },
  },
  {
    m: 'DELETE',
    p: '/api/fehlermeldungen/:id',
    wer: ['admin'],
    h: (c) => {
      c.k.db.prepare('DELETE FROM fehlermeldung WHERE id = ?').run(holeMeldung(c).id);
      return { status: 200, body: liste(c) };
    },
  },
  {
    // Themen für das Formular des Azubis: das Lernmodul seines Berufs und das für alle Berufe – nur Titel, kein Lernstand
    m: 'GET',
    p: '/api/rueckmeldungen/themen',
    wer: ['azubi'],
    h: (c) => ({
      status: 200,
      body: { bereiche: lernBereiche(c).map((b) => ({ bereich: b.bereich, titel: b.p.titel, felder: b.p.inhalte.themenfelder.map((f) => ({ id: f.id, titel: f.titel, themen: f.unterthemen.map((u) => ({ id: u.id, titel: u.titel })) })) })) },
    }),
  },
  { m: 'GET', p: '/api/rueckmeldungen', wer: ['ausbilder'], h: (c) => ({ status: 200, body: listeAusbilder(c) }) },
  {
    // Ausbilder haken Wünsche zu Lerninhalten ab; Ideen fürs Portal lesen sie nur (für sie gibt es die Meldung hier nicht)
    m: 'PATCH',
    p: '/api/rueckmeldungen/:id',
    wer: ['ausbilder'],
    h: (c) => {
      const z = holeMeldung(c, ['inhalt']);
      const status = koerper(c).status;
      if (status !== 'offen' && status !== 'erledigt') throw new Fehler(400, 'Unbekannter Status');
      c.k.db.prepare('UPDATE fehlermeldung SET status = ?, erledigt_am = ? WHERE id = ?').run(status, status === 'erledigt' ? c.k.jetzt().toISOString() : null, z.id);
      return { status: 200, body: listeAusbilder(c) };
    },
  },
  {
    // Ausbilder schreiben bei Ideen fürs Portal mit – bei Fehlern und Wünschen zu Lerninhalten nicht
    m: 'POST',
    p: '/api/rueckmeldungen/:id/nachricht',
    wer: ['ausbilder'],
    h: (c) => {
      schreibeRueckfrage(c, holeMeldung(c, ['idee']));
      return { status: 201, body: listeAusbilder(c) };
    },
  },
  {
    m: 'DELETE',
    p: '/api/rueckmeldungen/:id',
    wer: ['ausbilder'],
    h: (c) => {
      c.k.db.prepare('DELETE FROM fehlermeldung WHERE id = ?').run(holeMeldung(c, ['inhalt']).id);
      return { status: 200, body: listeAusbilder(c) };
    },
  },
  // ---------- „Meine Meldungen“: die eigenen Fehlermeldungen und Ideen mit dem Gespräch dazu ----------
  { m: 'GET', p: '/api/meine-meldungen', wer: 'alle', h: (c) => ({ status: 200, body: meine(c) }) },
  {
    // Antwort der meldenden Person; eine erledigte Meldung ist damit wieder offen
    m: 'POST',
    p: '/api/meine-meldungen/:id/antwort',
    wer: 'alle',
    h: (c) => {
      const z = eigeneMeldung(c);
      const text = speichereNachricht(c, z);
      c.k.db.prepare("UPDATE fehlermeldung SET antwort_neu = 1, status = 'offen', erledigt_am = NULL, person_gesehen = (SELECT MAX(id) FROM fehlermeldung_nachricht WHERE meldung_id = ?) WHERE id = ?").run(z.id, z.id);
      // der Super-Admin hat keine Glocke: Hinweis an denselben Teams-Kanal wie bei neuen Meldungen – ohne Namen, Text nur auf Wunsch
      if (c.k.cfg.fehlerWebhook) void benachrichtige(c.k, teamsKarte(c.k, { id: z.id, rolle: c.b.rolle, seite: '', text, mitBild: false, art: z.art, antwort: true }));
      return { status: 201, body: meine(c) };
    },
  },
  {
    // „gelesen“: alles bis zur jüngsten Nachricht – getrennt vom Abruf, damit ein Abruf nie etwas ändert
    m: 'POST',
    p: '/api/meine-meldungen/gesehen',
    wer: 'alle',
    h: (c) => {
      c.k.db
        .prepare("UPDATE fehlermeldung SET person_gesehen = COALESCE((SELECT MAX(n.id) FROM fehlermeldung_nachricht n WHERE n.meldung_id = fehlermeldung.id), 0) WHERE benutzer_id = ? AND art <> 'inhalt'")
        .run(c.b.id);
      return { status: 200, body: meine(c) };
    },
  },
];

/** Erledigte Rückmeldungen (alle drei Arten) werden so viele Tage nach „erledigt“ gelöscht – samt Gespräch und Bildschirmfoto. */
export const MELDUNG_TAGE = 30;

/** löscht erledigte Rückmeldungen nach MELDUNG_TAGE; offene bleiben, bis jemand sie erledigt. Gibt die Anzahl zurück. */
export function loescheErledigteMeldungen(db: DB, jetzt: Date): number {
  const grenze = new Date(jetzt.getTime() - MELDUNG_TAGE * 24 * 60 * 60 * 1000).toISOString();
  return Number(db.prepare("DELETE FROM fehlermeldung WHERE status = 'erledigt' AND erledigt_am IS NOT NULL AND erledigt_am < ?").run(grenze).changes);
}
