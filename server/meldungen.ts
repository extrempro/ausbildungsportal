import { Fehler, idAus, koerper } from './api-basis';
import type { Ctx, Route } from './api-basis';

/**
 * Fehlermeldungen: Jedes angemeldete Konto kann ein Problem melden; lesen und bearbeiten kann sie nur der Super-Admin
 * (er betreibt das Portal). Technische Angaben kommen automatisch dazu – der Text selbst stammt vom Menschen
 * und sollte keine Inhalte aus Berichten enthalten (darauf weist das Formular hin).
 */
const MAX_TEXT = 2000;
const MIN_TEXT = 10;
const JE_TAG = 10;
const MAX_LISTE = 300;

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
}

/** mehrzeiliger Text ohne andere Steuerzeichen, auf die Höchstlänge gekürzt */
function sauber(x: unknown, max: number, einzeilig = false): string {
  let s = typeof x === 'string' ? x.replace(/\r\n?/g, '\n') : '';
  s = s.replace(einzeilig ? /[\u0000-\u001f\u007f]/g : /[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim();
  return s.slice(0, max);
}

function ansicht(z: Zeile) {
  return { id: z.id, zeit: z.zeit, name: z.benutzer_name, rolle: z.rolle, text: z.text, seite: z.seite, version: z.version, browser: z.browser, fenster: z.fenster, technik: z.technik, status: z.status, erledigtAm: z.erledigt_am };
}

function liste(c: Ctx) {
  const zeilen = c.k.db.prepare("SELECT * FROM fehlermeldung ORDER BY status = 'erledigt', id DESC LIMIT ?").all(MAX_LISTE) as unknown as Zeile[];
  return { meldungen: zeilen.map(ansicht), offen: zeilen.filter((z) => z.status === 'offen').length };
}

function holeMeldung(c: Ctx): Zeile {
  const id = idAus(c.p.id);
  const z = Number.isInteger(id) ? (c.k.db.prepare('SELECT * FROM fehlermeldung WHERE id = ?').get(id) as unknown as Zeile | undefined) : undefined;
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
      c.k.db
        .prepare('INSERT INTO fehlermeldung (zeit, benutzer_id, benutzer_name, rolle, text, seite, version, browser, fenster, technik) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(jetzt.toISOString(), c.b.id, c.b.anzeigename, c.b.rolle, text, sauber(roh.seite, 200, true), c.k.version, sauber(c.a.headers['user-agent'], 300, true), sauber(roh.fenster, 40, true), sauber(roh.technik, 1500));
      return { status: 201, body: { ok: true } };
    },
  },
  { m: 'GET', p: '/api/fehlermeldungen', wer: ['admin'], h: (c) => ({ status: 200, body: liste(c) }) },
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
