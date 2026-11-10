import { timingSafeEqual } from 'node:crypto';
import { datumOderNull, Fehler, holeBenutzer, idAus, istObjekt, koerper, text } from './api-basis';
import type { Anfrage, Antwort, Ctx, Kontext, Route } from './api-basis';
import type { Config } from './config';
import type { DB } from './db';
import { transaktion } from './db';
import { heute } from './datum';
import { fehlerText, pkceChallenge, zufall } from './entra';
import { hashePasswort, pruefePasswort, pruefeRegeln, zufallsPasswort } from './passwort';
import { leseProtokoll, protokolliere } from './protokoll';
import {
  darfAzubiSehen,
  darfAzubiVerwalten,
  darfKontoLoeschen,
  darfKontoSehen,
  darfKontoVerwalten,
  darfRolleVergeben,
  sichtbareAzubis,
} from './rechte';
import { beendeAlleSitzungen, beendeSitzung, beginneSitzung, HOECHST_MS, pruefeSitzung, raeumeAuf } from './sitzung';
import { azubiUebersicht, STAMMDATEN_ROUTEN } from './stammdaten';
import { alsKonto, ROLLEN } from './typen';
import type { BenutzerZeile, Rolle, Zuweisung } from './typen';


const MAX_FEHLVERSUCHE = 5;
const WARTEZEIT_MS = 15 * 60 * 1000;
const PASSWORT_JE_IP = 30;
const ENTRA_JE_IP = 600;
const ANMELDEVORGANG_MS = 10 * 60 * 1000;
const FALSCH = 'Anmeldung nicht möglich: Benutzername oder Passwort falsch, oder zu viele Fehlversuche (dann in 15 Minuten erneut versuchen).';

// ---------- Hilfen ----------

export { Fehler } from './api-basis';
export type { Anfrage, Antwort, Kontext, Route } from './api-basis';


function gleich(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}


function nachAnmeldename(db: DB, name: string): BenutzerZeile | undefined {
  return db.prepare('SELECT * FROM benutzer WHERE anmeldename = ?').get(name) as BenutzerZeile | undefined;
}

// ---------- Cookies ----------

/** Mit HTTPS das Präfix __Host-: Der Browser nimmt das Cookie dann nur mit Secure, Path=/ und ohne Domain an. */
export function cookieName(cfg: Config, art: 'sitzung' | 'anmeldung'): string {
  return `${cfg.sicher ? '__Host-' : ''}ap_${art}`;
}

function setzeCookie(cfg: Config, art: 'sitzung' | 'anmeldung', wert: string, maxAlterS: number): string {
  return `${cookieName(cfg, art)}=${wert}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAlterS}${cfg.sicher ? '; Secure' : ''}`;
}

function sitzungsAntwort(k: Kontext, b: BenutzerZeile, antwort: Antwort): Antwort {
  const jetzt = k.jetzt();
  raeumeAuf(k.db, jetzt);
  const token = beginneSitzung(k.db, b.id, jetzt);
  k.db.prepare('UPDATE benutzer SET letzte_anmeldung = ?, fehlversuche = 0, gesperrt_bis = NULL WHERE id = ?').run(jetzt.toISOString(), b.id);
  return { ...antwort, cookies: [...(antwort.cookies ?? []), setzeCookie(k.cfg, 'sitzung', token, Math.floor(HOECHST_MS / 1000))] };
}

// ---------- Konten ----------

function pruefeEntraName(x: unknown): string {
  const name = text(x, 200, 'Anmeldename').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(name)) {
    throw new Fehler(400, 'Der Anmeldename muss der Entra-Anmeldename sein, z. B. vorname.nachname@firma.de');
  }
  return name;
}

function pruefeLokalName(x: unknown): string {
  const name = text(x, 60, 'Benutzername').toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,}$/.test(name)) {
    throw new Fehler(400, 'Der Benutzername braucht mindestens 3 Zeichen: Buchstaben, Ziffern, Punkt, Binde- oder Unterstrich');
  }
  return name;
}

function pruefeRolle(x: unknown): Rolle {
  if (typeof x !== 'string' || !ROLLEN.includes(x as Rolle)) throw new Fehler(400, 'Unbekannte Rolle');
  return x as Rolle;
}

/** Konto, das der Aufrufer verwalten darf – sonst 404 (nicht sichtbar) bzw. 403 (sichtbar, aber nicht verwaltbar). */
function verwaltbaresKonto(c: Ctx): BenutzerZeile {
  const ziel = holeBenutzer(c.k.db, idAus(c.p.id));
  if (!ziel || !darfKontoSehen(c.b, ziel)) throw new Fehler(404, 'Konto nicht gefunden');
  if (!darfKontoVerwalten(c.b, ziel)) throw new Fehler(403, 'Dieses Konto darf nur der Super-Admin ändern');
  return ziel;
}

/** Legt beim ersten Start den Super-Admin an; ein erzeugtes Startpasswort steht einmalig im Log. */
export async function ersterStart(k: Kontext): Promise<void> {
  const anzahl = (k.db.prepare('SELECT COUNT(*) AS n FROM benutzer').get() as { n: number }).n;
  if (anzahl > 0) return;
  const name = k.cfg.adminBenutzer || 'admin';
  let passwort = k.cfg.adminPasswort;
  const erzeugt = !passwort;
  if (erzeugt) passwort = zufallsPasswort();
  const jetzt = k.jetzt();
  k.db.prepare(
    `INSERT INTO benutzer (anmeldung, anmeldename, anzeigename, rolle, passwort_hash, passwort_wechsel, erstellt)
     VALUES ('lokal', ?, 'Super-Admin', 'admin', ?, 1, ?)`,
  ).run(name, await hashePasswort(passwort), jetzt.toISOString());
  protokolliere(k.db, jetzt, 'konto', 'konto_angelegt', null, null, `Super-Admin „${name}“ beim ersten Start`);
  k.log(`Super-Admin „${name}“ angelegt.`);
  if (erzeugt) {
    k.log(`Startpasswort (wird nur dieses eine Mal angezeigt): ${passwort}`);
  }
  k.log('Bei der ersten Anmeldung muss das Passwort geändert werden.');
}

// ---------- Routen ----------

export const ROUTEN: Route[] = [
  { m: 'GET', p: '/api/health', wer: 'offen', h: () => ({ status: 200, body: { ok: true } }) },

  {
    m: 'GET',
    p: '/api/auth/status',
    wer: 'offen',
    h: (c) => ({ status: 200, body: { entra: !!c.k.entra, dev: c.k.cfg.devAnmeldung } }),
  },

  {
    m: 'POST',
    p: '/api/auth/lokal',
    wer: 'offen',
    begrenzt: PASSWORT_JE_IP,
    h: async (c) => {
      const body = koerper(c);
      const name = typeof body.benutzername === 'string' ? body.benutzername.trim().toLowerCase().slice(0, 200) : '';
      const passwort = typeof body.passwort === 'string' ? body.passwort : '';
      const jetzt = c.k.jetzt();
      const b = name ? nachAnmeldename(c.k.db, name) : undefined;
      const lokal = b && b.anmeldung === 'lokal' && b.passwort_hash ? b : null;
      // immer rechnen, damit die Antwortzeit nicht verrät, ob es das Konto gibt
      const stimmt = await pruefePasswort(lokal?.passwort_hash ?? c.k.dummyHash, passwort);
      const wartet = !!lokal?.gesperrt_bis && lokal.gesperrt_bis > jetzt.toISOString();
      if (!lokal || !stimmt || wartet || lokal.status !== 'aktiv') {
        if (lokal && !wartet && !stimmt) {
          const n = lokal.fehlversuche + 1;
          if (n >= MAX_FEHLVERSUCHE) {
            c.k.db.prepare('UPDATE benutzer SET fehlversuche = 0, gesperrt_bis = ? WHERE id = ?').run(new Date(jetzt.getTime() + WARTEZEIT_MS).toISOString(), lokal.id);
          } else {
            c.k.db.prepare('UPDATE benutzer SET fehlversuche = ? WHERE id = ?').run(n, lokal.id);
          }
        }
        protokolliere(c.k.db, jetzt, 'konto', 'anmeldung_fehlgeschlagen', null, lokal, `lokal, IP ${c.a.ip}`);
        throw new Fehler(401, FALSCH);
      }
      protokolliere(c.k.db, jetzt, 'konto', 'anmeldung', lokal, null, 'lokal');
      return sitzungsAntwort(c.k, lokal, { status: 200, body: { ok: true } });
    },
  },

  {
    m: 'GET',
    p: '/api/auth/entra/login',
    wer: 'offen',
    begrenzt: ENTRA_JE_IP,
    h: async (c) => {
      if (!c.k.entra) return { status: 302, redirect: '/anmelden?fehler=entra_aus' };
      const state = zufall();
      const nonce = zufall();
      const verifier = zufall(48);
      let url: string;
      try {
        url = await c.k.entra.anmeldeUrl({ state, nonce, challenge: pkceChallenge(verifier) });
      } catch (e) {
        c.k.log(`Entra-Anmeldung nicht möglich: ${fehlerText(e)}`);
        return { status: 302, redirect: '/anmelden?fehler=entra_fehler' };
      }
      c.k.db.prepare('INSERT INTO anmeldevorgang (state, nonce, code_verifier, erstellt) VALUES (?, ?, ?, ?)').run(state, nonce, verifier, c.k.jetzt().toISOString());
      // state zusätzlich an den Browser binden: Der Rückruf zählt nur in dem Browser, der die Anmeldung begonnen hat
      return { status: 302, redirect: url, cookies: [setzeCookie(c.k.cfg, 'anmeldung', state, ANMELDEVORGANG_MS / 1000)] };
    },
  },

  {
    m: 'GET',
    p: '/api/auth/entra/callback',
    wer: 'offen',
    begrenzt: ENTRA_JE_IP,
    h: async (c) => {
      const { db, cfg } = c.k;
      const jetzt = c.k.jetzt();
      const zurueck = (fehler: string): Antwort => ({
        status: 302,
        redirect: `/anmelden?fehler=${fehler}`,
        cookies: [setzeCookie(cfg, 'anmeldung', '', 0)],
      });
      if (!c.k.entra) return zurueck('entra_aus');
      const state = c.a.query.get('state') ?? '';
      const imBrowser = c.a.cookies[cookieName(cfg, 'anmeldung')] ?? '';
      if (!state || !imBrowser || !gleich(state, imBrowser)) return zurueck('abgelaufen');
      const v = db.prepare('SELECT nonce, code_verifier, erstellt FROM anmeldevorgang WHERE state = ?').get(state) as
        | { nonce: string; code_verifier: string; erstellt: string }
        | undefined;
      db.prepare('DELETE FROM anmeldevorgang WHERE state = ?').run(state); // einmalig verwendbar
      if (!v || new Date(v.erstellt).getTime() < jetzt.getTime() - ANMELDEVORGANG_MS) return zurueck('abgelaufen');
      const code = c.a.query.get('code') ?? '';
      if (c.a.query.get('error') || !code) {
        c.k.log(`Entra meldet: ${(c.a.query.get('error') ?? 'kein Code').slice(0, 80)}`);
        return zurueck('abgebrochen');
      }
      let wer;
      try {
        wer = await c.k.entra.loeseEin({ code, state, verifier: v.code_verifier, nonce: v.nonce });
      } catch (e) {
        c.k.log(`Entra-Anmeldung abgelehnt: ${fehlerText(e)}`);
        return zurueck('entra_fehler');
      }

      let b = db.prepare("SELECT * FROM benutzer WHERE anmeldung = 'entra' AND entra_oid = ?").get(wer.oid) as BenutzerZeile | undefined;
      if (!b) {
        // erste Anmeldung: vorab angelegtes Konto über den Anmeldenamen finden und fest an die Objekt-ID binden
        const neu = db.prepare("SELECT * FROM benutzer WHERE anmeldung = 'entra' AND entra_oid IS NULL AND anmeldename = ?").get(wer.anmeldename) as
          | BenutzerZeile
          | undefined;
        if (neu) {
          db.prepare('UPDATE benutzer SET entra_oid = ? WHERE id = ?').run(wer.oid, neu.id);
          protokolliere(db, jetzt, 'konto', 'entra_verknuepft', neu, null);
          b = neu;
        }
      } else if (b.anmeldename !== wer.anmeldename && !nachAnmeldename(db, wer.anmeldename)) {
        // Anmeldename in Entra geändert (z. B. Namenswechsel): nachziehen, der Zugang hängt an der Objekt-ID
        db.prepare('UPDATE benutzer SET anmeldename = ? WHERE id = ?').run(wer.anmeldename, b.id);
        protokolliere(db, jetzt, 'konto', 'konto_geaendert', b, b, `Anmeldename laut Entra jetzt ${wer.anmeldename}`);
      }
      if (!b) {
        protokolliere(db, jetzt, 'konto', 'anmeldung_fehlgeschlagen', null, null, `Entra-Konto ${wer.anmeldename.slice(0, 120)} ohne Konto in der App`);
        return zurueck('kein_zugang');
      }
      if (b.status !== 'aktiv') {
        protokolliere(db, jetzt, 'konto', 'anmeldung_fehlgeschlagen', null, b, 'Konto gesperrt');
        return zurueck('gesperrt');
      }
      protokolliere(db, jetzt, 'konto', 'anmeldung', b, null, 'Entra');
      return sitzungsAntwort(c.k, b, { status: 302, redirect: '/', cookies: [setzeCookie(cfg, 'anmeldung', '', 0)] });
    },
  },

  {
    // nur für die Entwicklung: als vorhandenes Entra-Konto anmelden, ohne Entra zu fragen
    m: 'POST',
    p: '/api/auth/dev',
    wer: 'offen',
    begrenzt: PASSWORT_JE_IP,
    h: (c) => {
      if (!c.k.cfg.devAnmeldung || c.k.cfg.production) throw new Fehler(404, 'Nicht gefunden');
      const name = text(koerper(c).anmeldename, 200, 'Anmeldename').toLowerCase();
      const b = nachAnmeldename(c.k.db, name);
      if (!b || b.anmeldung !== 'entra' || b.status !== 'aktiv') throw new Fehler(401, 'Kein aktives Entra-Konto mit diesem Anmeldenamen');
      protokolliere(c.k.db, c.k.jetzt(), 'konto', 'anmeldung', b, null, 'Entwicklungsanmeldung');
      return sitzungsAntwort(c.k, b, { status: 200, body: { ok: true } });
    },
  },

  {
    m: 'POST',
    p: '/api/auth/abmelden',
    wer: 'alle',
    trotzWechsel: true,
    h: (c) => {
      beendeSitzung(c.k.db, c.token);
      protokolliere(c.k.db, c.k.jetzt(), 'konto', 'abmeldung', c.b);
      return { status: 200, body: { ok: true }, cookies: [setzeCookie(c.k.cfg, 'sitzung', '', 0)] };
    },
  },

  { m: 'GET', p: '/api/ich', wer: 'alle', trotzWechsel: true, h: (c) => ({ status: 200, body: { konto: alsKonto(c.b), version: c.k.version } }) },

  {
    m: 'PUT',
    p: '/api/ich/passwort',
    wer: ['admin'],
    trotzWechsel: true,
    h: async (c) => {
      const body = koerper(c);
      if (c.b.anmeldung !== 'lokal' || !c.b.passwort_hash) throw new Fehler(400, 'Dieses Konto meldet sich über Microsoft an');
      if (!(await pruefePasswort(c.b.passwort_hash, typeof body.alt === 'string' ? body.alt : ''))) {
        throw new Fehler(400, 'Das bisherige Passwort stimmt nicht');
      }
      const fehler = pruefeRegeln(body.neu, c.b.anmeldename);
      if (fehler) throw new Fehler(400, fehler);
      if (body.neu === body.alt) throw new Fehler(400, 'Das neue Passwort muss sich vom bisherigen unterscheiden');
      c.k.db.prepare('UPDATE benutzer SET passwort_hash = ?, passwort_wechsel = 0 WHERE id = ?').run(await hashePasswort(body.neu as string), c.b.id);
      beendeAlleSitzungen(c.k.db, c.b.id, c.token); // andere Geräte abmelden
      protokolliere(c.k.db, c.k.jetzt(), 'konto', 'passwort_geaendert', c.b);
      return { status: 200, body: { ok: true } };
    },
  },

  {
    m: 'PUT',
    p: '/api/ich/theme',
    wer: 'alle',
    h: (c) => {
      const theme = koerper(c).theme;
      if (theme !== 'auto' && theme !== 'light' && theme !== 'dark') throw new Fehler(400, 'Unbekanntes Farbschema');
      c.k.db.prepare('UPDATE benutzer SET theme = ? WHERE id = ?').run(theme, c.b.id);
      return { status: 200, body: { ok: true } };
    },
  },

  {
    m: 'GET',
    p: '/api/konten',
    wer: ['admin', 'ausbilder'],
    h: (c) => {
      const alle = c.k.db.prepare('SELECT * FROM benutzer ORDER BY anzeigename COLLATE NOCASE').all() as unknown as BenutzerZeile[];
      return {
        status: 200,
        body: {
          konten: alle
            .filter((z) => darfKontoSehen(c.b, z))
            .map((z) => ({ ...alsKonto(z), verwaltbar: darfKontoVerwalten(c.b, z) && z.id !== c.b.id, loeschbar: darfKontoLoeschen(c.b, z) && z.id !== c.b.id })),
          rollen: ROLLEN.filter((r) => darfRolleVergeben(c.b, r)),
        },
      };
    },
  },

  {
    m: 'POST',
    p: '/api/konten',
    wer: ['admin', 'ausbilder'],
    h: async (c) => {
      const body = koerper(c);
      const rolle = pruefeRolle(body.rolle);
      if (!darfRolleVergeben(c.b, rolle)) throw new Fehler(403, 'Konten mit dieser Rolle legt nur der Super-Admin an');
      const lokal = rolle === 'admin';
      const anmeldename = lokal ? pruefeLokalName(body.anmeldename) : pruefeEntraName(body.anmeldename);
      const anzeigename = text(body.anzeigename, 120, 'Anzeigename');
      if (nachAnmeldename(c.k.db, anmeldename)) throw new Fehler(409, 'Es gibt schon ein Konto mit diesem Anmeldenamen');
      // weitere Super-Admins bekommen ein Startpasswort, das genau einmal zurückgegeben wird
      const startpasswort = lokal ? zufallsPasswort() : null;
      const hash = startpasswort ? await hashePasswort(startpasswort) : null;
      const jetzt = c.k.jetzt();
      const r = c.k.db
        .prepare(
          `INSERT INTO benutzer (anmeldung, anmeldename, anzeigename, rolle, passwort_hash, passwort_wechsel, erstellt, erstellt_von)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(lokal ? 'lokal' : 'entra', anmeldename, anzeigename, rolle, hash, lokal ? 1 : 0, jetzt.toISOString(), c.b.id);
      const neu = holeBenutzer(c.k.db, Number(r.lastInsertRowid))!;
      protokolliere(c.k.db, jetzt, 'konto', 'konto_angelegt', c.b, neu, `Rolle ${rolle}`);
      return { status: 201, body: { konto: alsKonto(neu), ...(startpasswort ? { startpasswort } : {}) } };
    },
  },

  {
    m: 'PATCH',
    p: '/api/konten/:id',
    wer: ['admin', 'ausbilder'],
    h: (c) => {
      const ziel = verwaltbaresKonto(c);
      const body = koerper(c);
      const { db } = c.k;
      const jetzt = c.k.jetzt();
      const selbst = ziel.id === c.b.id;
      transaktion(db, () => {
        if (body.anzeigename !== undefined) {
          const name = text(body.anzeigename, 120, 'Anzeigename');
          if (name !== ziel.anzeigename) {
            db.prepare('UPDATE benutzer SET anzeigename = ? WHERE id = ?').run(name, ziel.id);
            protokolliere(db, jetzt, 'konto', 'konto_geaendert', c.b, ziel, `Anzeigename jetzt ${name}`);
          }
        }
        if (body.anmeldename !== undefined) {
          const name = ziel.anmeldung === 'lokal' ? pruefeLokalName(body.anmeldename) : pruefeEntraName(body.anmeldename);
          if (name !== ziel.anmeldename) {
            // nach der ersten Anmeldung kommt der Name aus Entra; vorher darf ein Tippfehler korrigiert werden
            if (ziel.anmeldung === 'entra' && ziel.entra_oid) throw new Fehler(400, 'Der Anmeldename kommt aus Entra und wird bei der Anmeldung übernommen');
            if (nachAnmeldename(db, name)) throw new Fehler(409, 'Es gibt schon ein Konto mit diesem Anmeldenamen');
            db.prepare('UPDATE benutzer SET anmeldename = ? WHERE id = ?').run(name, ziel.id);
            protokolliere(db, jetzt, 'konto', 'konto_geaendert', c.b, ziel, `Anmeldename jetzt ${name}`);
          }
        }
        if (body.rolle !== undefined) {
          const rolle = pruefeRolle(body.rolle);
          if (rolle !== ziel.rolle) {
            if (selbst) throw new Fehler(400, 'Die eigene Rolle lässt sich nicht ändern');
            if (rolle === 'admin' || ziel.rolle === 'admin') throw new Fehler(400, 'Super-Admin-Konten sind lokal; ein Wechsel von oder zu dieser Rolle ist nicht möglich');
            if (!darfRolleVergeben(c.b, rolle)) throw new Fehler(403, 'Diese Rolle vergibt nur der Super-Admin');
            db.prepare('UPDATE benutzer SET rolle = ? WHERE id = ?').run(rolle, ziel.id);
            // Zuweisungen passen nur zur alten Rolle
            db.prepare('DELETE FROM zuweisung WHERE azubi_id = ? OR beauftragter_id = ?').run(ziel.id, ziel.id);
            beendeAlleSitzungen(db, ziel.id);
            protokolliere(db, jetzt, 'konto', 'rolle_geaendert', c.b, ziel, `${ziel.rolle} → ${rolle}`);
          }
        }
        if (body.status !== undefined) {
          if (body.status !== 'aktiv' && body.status !== 'gesperrt') throw new Fehler(400, 'Unbekannter Status');
          if (body.status !== ziel.status) {
            if (selbst) throw new Fehler(400, 'Das eigene Konto lässt sich nicht sperren');
            db.prepare('UPDATE benutzer SET status = ?, fehlversuche = 0, gesperrt_bis = NULL WHERE id = ?').run(body.status, ziel.id);
            if (body.status === 'gesperrt') beendeAlleSitzungen(db, ziel.id); // wirkt sofort
            protokolliere(db, jetzt, 'konto', body.status === 'gesperrt' ? 'konto_gesperrt' : 'konto_entsperrt', c.b, ziel);
          }
        }
      });
      return { status: 200, body: { konto: alsKonto(holeBenutzer(db, ziel.id)!) } };
    },
  },

  {
    // falls sich beim ersten Mal die falsche Person angemeldet hat oder das Entra-Konto neu angelegt wurde
    m: 'POST',
    p: '/api/konten/:id/entra-loesen',
    wer: ['admin', 'ausbilder'],
    h: (c) => {
      const ziel = verwaltbaresKonto(c);
      if (ziel.anmeldung !== 'entra') throw new Fehler(400, 'Lokale Konten haben keine Entra-Verknüpfung');
      c.k.db.prepare('UPDATE benutzer SET entra_oid = NULL WHERE id = ?').run(ziel.id);
      beendeAlleSitzungen(c.k.db, ziel.id);
      protokolliere(c.k.db, c.k.jetzt(), 'konto', 'entra_geloest', c.b, ziel);
      return { status: 200, body: { konto: alsKonto(holeBenutzer(c.k.db, ziel.id)!) } };
    },
  },

  {
    m: 'POST',
    p: '/api/konten/:id/passwort-zuruecksetzen',
    wer: ['admin'],
    h: async (c) => {
      const ziel = verwaltbaresKonto(c);
      if (ziel.anmeldung !== 'lokal') throw new Fehler(400, 'Passwörter von Entra-Konten verwaltet Microsoft');
      if (ziel.id === c.b.id) throw new Fehler(400, 'Das eigene Passwort bitte unter „Konto“ ändern');
      const startpasswort = zufallsPasswort();
      c.k.db.prepare('UPDATE benutzer SET passwort_hash = ?, passwort_wechsel = 1, fehlversuche = 0, gesperrt_bis = NULL WHERE id = ?').run(await hashePasswort(startpasswort), ziel.id);
      beendeAlleSitzungen(c.k.db, ziel.id);
      protokolliere(c.k.db, c.k.jetzt(), 'konto', 'passwort_zurueckgesetzt', c.b, ziel);
      return { status: 200, body: { startpasswort } };
    },
  },

  {
    m: 'DELETE',
    p: '/api/konten/:id',
    wer: ['admin', 'ausbilder'],
    h: (c) => {
      const ziel = verwaltbaresKonto(c);
      if (!darfKontoLoeschen(c.b, ziel)) throw new Fehler(403, 'Dieses Konto darf nur der Super-Admin löschen');
      if (ziel.id === c.b.id) throw new Fehler(400, 'Das eigene Konto lässt sich nicht löschen');
      // Sitzungen und Zuweisungen fallen über ON DELETE CASCADE weg; das Protokoll behält die Namen
      c.k.db.prepare('DELETE FROM benutzer WHERE id = ?').run(ziel.id);
      protokolliere(c.k.db, c.k.jetzt(), 'konto', 'konto_geloescht', c.b, ziel, `Rolle ${ziel.rolle}, ${ziel.anmeldename}`);
      return { status: 200, body: { ok: true } };
    },
  },

  {
    m: 'GET',
    p: '/api/azubis',
    wer: ['ausbilder', 'beauftragter'],
    h: (c) => {
      const ids = sichtbareAzubis(c.k.db, c.b, heute(c.k.jetzt()));
      const tag = heute(c.k.jetzt());
      const azubis = ids.map((id) => azubiUebersicht(c.k.db, holeBenutzer(c.k.db, id)!, tag));
      return { status: 200, body: { azubis } };
    },
  },

  {
    m: 'GET',
    p: '/api/azubis/:id/zuweisungen',
    wer: ['ausbilder', 'beauftragter', 'azubi'],
    h: (c) => {
      const id = idAus(c.p.id);
      // fremde und unbekannte IDs sehen gleich aus
      if (!darfAzubiSehen(c.k.db, c.b, id, heute(c.k.jetzt()))) throw new Fehler(404, 'Nicht gefunden');
      const zeilen = c.k.db
        .prepare(
          `SELECT z.id, z.azubi_id, z.beauftragter_id, z.von, z.bis, b.anzeigename AS beauftragter
             FROM zuweisung z JOIN benutzer b ON b.id = z.beauftragter_id WHERE z.azubi_id = ? ORDER BY z.von IS NOT NULL, z.von`,
        )
        .all(id) as unknown as (Zuweisung & { beauftragter: string })[];
      // Beauftragte sehen nur ihre eigene Zuweisung
      return { status: 200, body: { zuweisungen: c.b.rolle === 'beauftragter' ? zeilen.filter((z) => z.beauftragter_id === c.b.id) : zeilen } };
    },
  },

  {
    m: 'PUT',
    p: '/api/azubis/:id/zuweisungen',
    wer: ['ausbilder'],
    h: (c) => {
      const { db } = c.k;
      const id = idAus(c.p.id);
      if (!darfAzubiVerwalten(db, c.b, id)) throw new Fehler(404, 'Nicht gefunden');
      const liste = koerper(c).zuweisungen;
      if (!Array.isArray(liste) || liste.length > 50) throw new Fehler(400, 'Liste der Zuweisungen fehlt');
      const neu = liste.map((x) => {
        if (!istObjekt(x)) throw new Fehler(400, 'Ungültige Zuweisung');
        const b = holeBenutzer(db, Number(x.beauftragterId));
        if (!b || b.rolle !== 'beauftragter') throw new Fehler(400, 'Zuweisen lassen sich nur Konten mit der Rolle Ausbildungsbeauftragte');
        const von = datumOderNull(x.von, 'Beginn');
        const bis = datumOderNull(x.bis, 'Ende');
        if (von && bis && bis < von) throw new Fehler(400, 'Das Ende einer Zuweisung liegt vor dem Beginn');
        return { b, von, bis };
      });
      const azubi = holeBenutzer(db, id)!;
      transaktion(db, () => {
        db.prepare('DELETE FROM zuweisung WHERE azubi_id = ?').run(id);
        const einfuegen = db.prepare('INSERT INTO zuweisung (azubi_id, beauftragter_id, von, bis) VALUES (?, ?, ?, ?)');
        for (const z of neu) einfuegen.run(id, z.b.id, z.von, z.bis);
        protokolliere(db, c.k.jetzt(), 'fach', 'zuweisung_geaendert', c.b, azubi, neu.map((z) => `${z.b.anzeigename} ${z.von ?? '…'}–${z.bis ?? '…'}`).join('; '));
      });
      return { status: 200, body: { ok: true } };
    },
  },

  {
    m: 'GET',
    p: '/api/protokoll',
    wer: ['admin', 'ausbilder'],
    // der Super-Admin sieht nur Konto-Ereignisse
    h: (c) => ({ status: 200, body: { eintraege: leseProtokoll(c.k.db, c.b.rolle === 'admin', Number(c.a.query.get('limit')) || 200) } }),
  },

  ...STAMMDATEN_ROUTEN,
];

// ---------- Verteiler ----------

function finde(methode: string, pfad: string): { route: Route; p: Record<string, string> } | 'methode' | null {
  const teile = pfad.split('/');
  let andereMethode = false;
  for (const route of ROUTEN) {
    const muster = route.p.split('/');
    if (muster.length !== teile.length) continue;
    const p: Record<string, string> = {};
    if (!muster.every((m, i) => (m.startsWith(':') ? ((p[m.slice(1)] = teile[i]), teile[i] !== '') : m === teile[i]))) continue;
    if (route.m === methode) return { route, p };
    andereMethode = true;
  }
  return andereMethode ? 'methode' : null;
}

function zuVieleVersuche(k: Kontext, ip: string, grenze: number): boolean {
  const jetzt = k.jetzt().getTime();
  if (k.versuche.size > 10_000) for (const [key, v] of k.versuche) if (v.bis < jetzt) k.versuche.delete(key);
  const schluessel = `${grenze}|${ip}`;
  const v = k.versuche.get(schluessel);
  if (!v || v.bis < jetzt) {
    k.versuche.set(schluessel, { anzahl: 1, bis: jetzt + WARTEZEIT_MS });
    return false;
  }
  v.anzahl++;
  return v.anzahl > grenze;
}

/** Einziger Einstieg: prüft Herkunft, Sitzung, Rolle und ausstehenden Passwortwechsel und ruft dann die Route auf. */
export async function behandle(k: Kontext, a: Anfrage): Promise<Antwort> {
  try {
    const treffer = finde(a.methode, a.pfad);
    if (treffer === 'methode') throw new Fehler(405, 'Methode nicht erlaubt');
    if (!treffer) throw new Fehler(404, 'Nicht gefunden');
    const { route, p } = treffer;

    // Schutz vor fremden Seiten, die im Namen des angemeldeten Nutzers schreiben wollen (CSRF)
    if (a.methode !== 'GET' && a.headers.origin !== new URL(k.cfg.appUrl).origin) {
      // Häufigste Ursache ist keine fremde Seite, sondern eine APP_URL, die nicht zur Adresse im Browser passt
      // (z. B. eigener Port oder eigene IP in docker-compose.override.yml). Deshalb beide Adressen nennen.
      const von = a.headers.origin ?? '';
      const lesbar = /^https?:\/\/[A-Za-z0-9.\-:[\]]{1,200}$/.test(von) ? von : '';
      if (lesbar && !k.gemeldeteHerkunft.has(lesbar) && k.gemeldeteHerkunft.size < 20) {
        k.gemeldeteHerkunft.add(lesbar);
        k.log(`Anfrage von ${lesbar} abgelehnt: Die App ist für ${k.cfg.appUrl} eingerichtet. Wird sie unter ${lesbar} aufgerufen, muss APP_URL=${lesbar} in der .env stehen.`);
      }
      throw new Fehler(
        403,
        lesbar
          ? `Die App ist für die Adresse ${k.cfg.appUrl} eingerichtet, aufgerufen wurde sie über ${lesbar}. Bitte APP_URL in der .env auf die Adresse im Browser setzen und die App neu starten.`
          : 'Anfrage von fremder Herkunft abgelehnt',
        'herkunft',
      );
    }
    if (route.begrenzt && zuVieleVersuche(k, a.ip, route.begrenzt)) throw new Fehler(429, 'Zu viele Anmeldeversuche – bitte später erneut versuchen');

    const token = a.cookies[cookieName(k.cfg, 'sitzung')];
    let b: BenutzerZeile | null = null;
    if (route.wer !== 'offen') {
      b = pruefeSitzung(k.db, token, k.jetzt());
      if (!b) throw new Fehler(401, 'Nicht angemeldet', 'anmeldung');
      if (route.wer !== 'alle' && !route.wer.includes(b.rolle)) throw new Fehler(403, 'Dafür fehlt die Berechtigung', 'rolle');
      if (b.passwort_wechsel === 1 && !route.trotzWechsel) throw new Fehler(403, 'Bitte zuerst das Passwort ändern', 'passwort_wechsel');
    }
    return await route.h({ k, a, b: b as BenutzerZeile, token, p });
  } catch (e) {
    if (e instanceof Fehler) return { status: e.status, body: { fehler: e.message, ...(e.code ? { code: e.code } : {}) } };
    k.log(`Fehler bei ${a.methode} ${a.pfad}: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
    return { status: 500, body: { fehler: 'Interner Fehler' } };
  }
}
