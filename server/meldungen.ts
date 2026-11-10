import { Fehler, idAus, koerper } from './api-basis';
import type { Ctx, Kontext, Route } from './api-basis';
import { bildTyp } from './branding';

/**
 * Fehlermeldungen: Jedes angemeldete Konto kann ein Problem melden; lesen und bearbeiten kann sie nur der Super-Admin
 * (er betreibt das Portal). Technische Angaben kommen automatisch dazu – der Text selbst stammt vom Menschen
 * und sollte keine Inhalte aus Berichten enthalten (darauf weist das Formular hin).
 */
const MAX_TEXT = 2000;
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
export function teamsKarte(k: Kontext, m: { id: number; rolle: string; seite: string; text: string; mitBild: boolean } | null) {
  const body: unknown[] = [{ type: 'TextBlock', size: 'Medium', weight: 'Bolder', wrap: true, text: m ? `Neue Fehlermeldung im Ausbildungsportal (Nr. ${m.id})` : 'Test: Das Ausbildungsportal kann diesen Kanal benachrichtigen' }];
  if (m) {
    body.push({
      type: 'FactSet',
      facts: [
        { title: 'Gemeldet von', value: ROLLEN_TEXT[m.rolle] ?? m.rolle },
        { title: 'Seite', value: m.seite || '–' },
        { title: 'Version', value: k.version },
        { title: 'Bildschirmfoto', value: m.mitBild ? 'ja' : 'nein' },
      ],
    });
    if (k.cfg.fehlerWebhookMitText) body.push({ type: 'TextBlock', wrap: true, text: m.text.length > 600 ? `${m.text.slice(0, 600)} …` : m.text });
  } else {
    body.push({ type: 'TextBlock', wrap: true, text: 'Ab jetzt erscheint hier ein Hinweis, sobald jemand im Portal einen Fehler meldet.' });
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

/** Schickt die Karte; ein Fehler steht im Log (ohne die Adresse – sie ist ein Geheimnis) und stört die Meldung nicht. */
async function benachrichtige(k: Kontext, karte: unknown): Promise<string | null> {
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
}

/** mehrzeiliger Text ohne andere Steuerzeichen, auf die Höchstlänge gekürzt */
function sauber(x: unknown, max: number, einzeilig = false): string {
  let s = typeof x === 'string' ? x.replace(/\r\n?/g, '\n') : '';
  s = s.replace(einzeilig ? /[\u0000-\u001f\u007f]/g : /[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim();
  return s.slice(0, max);
}

function ansicht(z: Zeile) {
  return { id: z.id, zeit: z.zeit, name: z.benutzer_name, rolle: z.rolle, text: z.text, seite: z.seite, version: z.version, browser: z.browser, fenster: z.fenster, technik: z.technik, status: z.status, erledigtAm: z.erledigt_am, hatBild: z.hat_bild === 1 };
}

const SPALTEN = 'id, zeit, benutzer_name, rolle, text, seite, version, browser, fenster, technik, status, erledigt_am, bild IS NOT NULL AS hat_bild';

function liste(c: Ctx) {
  // die Bilder selbst gehören nicht in die Liste – sie werden einzeln geholt
  const zeilen = c.k.db.prepare(`SELECT ${SPALTEN} FROM fehlermeldung ORDER BY status = 'erledigt', id DESC LIMIT ?`).all(MAX_LISTE) as unknown as Zeile[];
  return { meldungen: zeilen.map(ansicht), offen: zeilen.filter((z) => z.status === 'offen').length, webhook: !!c.k.cfg.fehlerWebhook, webhookMitText: c.k.cfg.fehlerWebhookMitText };
}

function holeMeldung(c: Ctx): Zeile {
  const id = idAus(c.p.id);
  const z = Number.isInteger(id) ? (c.k.db.prepare(`SELECT ${SPALTEN} FROM fehlermeldung WHERE id = ?`).get(id) as unknown as Zeile | undefined) : undefined;
  if (!z) throw new Fehler(404, 'Meldung nicht gefunden');
  return z;
}

export const MELDUNG_ROUTEN: Route[] = [
  {
    m: 'POST',
    p: '/api/fehlermeldungen',
    wer: 'alle',
    h: (c) => {
      const roh = koerper(c);
      if (typeof roh.text === 'string' && roh.text.trim().length > MAX_TEXT) throw new Fehler(400, `Der Text ist zu lang (höchstens ${MAX_TEXT} Zeichen)`);
      const text = sauber(roh.text, MAX_TEXT);
      if (text.length < MIN_TEXT) throw new Fehler(400, 'Bitte beschreibe kurz, was passiert ist (mindestens 10 Zeichen)');
      const jetzt = c.k.jetzt();
      const seit = new Date(jetzt.getTime() - 86_400_000).toISOString();
      const heute = (c.k.db.prepare('SELECT COUNT(*) AS n FROM fehlermeldung WHERE benutzer_id = ? AND zeit > ?').get(c.b.id, seit) as { n: number }).n;
      if (heute >= JE_TAG) throw new Fehler(429, `Du hast heute schon ${JE_TAG} Meldungen geschickt. Bitte sprich deinen Ausbilder oder den Betreiber des Portals direkt an.`);
      const bild = bildAus(roh.bild);
      const seite = sauber(roh.seite, 200, true);
      const r = c.k.db
        .prepare('INSERT INTO fehlermeldung (zeit, benutzer_id, benutzer_name, rolle, text, seite, version, browser, fenster, technik, bild) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(jetzt.toISOString(), c.b.id, c.b.anzeigename, c.b.rolle, text, seite, c.k.version, sauber(c.a.headers['user-agent'], 300, true), sauber(roh.fenster, 40, true), sauber(roh.technik, 1500), bild);
      // nicht abwarten: Die Meldung ist gespeichert, auch wenn Teams gerade nicht antwortet
      if (c.k.cfg.fehlerWebhook) void benachrichtige(c.k, teamsKarte(c.k, { id: Number(r.lastInsertRowid), rolle: c.b.rolle, seite, text, mitBild: bild !== null }));
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
      c.k.db.prepare('UPDATE fehlermeldung SET status = ?, erledigt_am = ? WHERE id = ?').run(status, status === 'erledigt' ? c.k.jetzt().toISOString() : null, z.id);
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
];
