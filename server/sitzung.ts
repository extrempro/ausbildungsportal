import { createHash, randomBytes } from 'node:crypto';
import type { DB } from './db';
import type { BenutzerZeile } from './typen';

/** Ohne Aktivität endet die Sitzung nach 8 Stunden, spätestens aber nach 24 Stunden. */
export const LEERLAUF_MS = 8 * 60 * 60 * 1000;
export const HOECHST_MS = 24 * 60 * 60 * 1000;

export function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Kurzer Text zum Gerät für „Angemeldete Geräte“ – nur Browser und System, grob aus der Browserkennung gelesen.
 * Mehr wird bewusst nicht gespeichert (keine Version, keine IP-Adresse, keine Gerätekennung).
 */
export function geraetAus(kennung: string | undefined): string {
  const k = kennung ?? '';
  const browser = /Edg(?:e|A|iOS)?\//.test(k)
    ? 'Edge'
    : /OPR\/|Opera/.test(k)
      ? 'Opera'
      : /Firefox\/|FxiOS\//.test(k)
        ? 'Firefox'
        : /Chrome\/|CriOS\//.test(k)
          ? 'Chrome'
          : /Safari\//.test(k)
            ? 'Safari'
            : '';
  const system = /iPhone/.test(k)
    ? 'iPhone'
    : /iPad/.test(k)
      ? 'iPad'
      : /Android/.test(k)
        ? 'Android'
        : /Windows/.test(k)
          ? 'Windows'
          : /CrOS/.test(k)
            ? 'ChromeOS'
            : /Macintosh|Mac OS X/.test(k)
              ? 'Mac'
              : /Linux/.test(k)
                ? 'Linux'
                : '';
  return [browser, system].filter(Boolean).join(' · ');
}

/** Legt eine Sitzung an und gibt das Token zurück – in der Datenbank steht nur dessen Hash. */
export function beginneSitzung(db: DB, benutzerId: number, jetzt: Date, geraet = ''): string {
  const token = randomBytes(32).toString('base64url');
  const iso = jetzt.toISOString();
  db.prepare('INSERT INTO sitzung (token_hash, benutzer_id, erstellt, zuletzt, laeuft_ab, geraet) VALUES (?, ?, ?, ?, ?, ?)').run(
    tokenHash(token),
    benutzerId,
    iso,
    iso,
    new Date(jetzt.getTime() + HOECHST_MS).toISOString(),
    geraet.slice(0, 60),
  );
  return token;
}

/** Kennung einer Sitzung für „Angemeldete Geräte“: der Anfang ihres Hashs – verrät nichts über das Token. */
const kennungVon = (hash: string) => hash.slice(0, 16);

export interface EigeneSitzung {
  id: string;
  geraet: string;
  erstellt: string;
  zuletzt: string;
  /** die Sitzung, mit der gerade gefragt wird */
  diese: boolean;
}

/** Die noch gültigen Sitzungen eines Kontos, die aktuelle zuerst, dann die zuletzt aktiven. */
export function eigeneSitzungen(db: DB, benutzerId: number, token: string | undefined, jetzt: Date): EigeneSitzung[] {
  const eigene = token ? tokenHash(token) : '';
  const iso = jetzt.toISOString();
  const leerlauf = new Date(jetzt.getTime() - LEERLAUF_MS).toISOString();
  const zeilen = db
    .prepare('SELECT token_hash, geraet, erstellt, zuletzt FROM sitzung WHERE benutzer_id = ? AND laeuft_ab >= ? AND zuletzt >= ? ORDER BY zuletzt DESC')
    .all(benutzerId, iso, leerlauf) as { token_hash: string; geraet: string; erstellt: string; zuletzt: string }[];
  return zeilen
    .map((z) => ({ id: kennungVon(z.token_hash), geraet: z.geraet, erstellt: z.erstellt, zuletzt: z.zuletzt, diese: z.token_hash === eigene }))
    .sort((a, b) => Number(b.diese) - Number(a.diese));
}

/** Beendet eine andere Sitzung desselben Kontos. false, wenn es sie nicht gibt, sie fremd ist oder die aktuelle ist. */
export function beendeEigeneSitzung(db: DB, benutzerId: number, id: string, token: string | undefined): boolean {
  if (!/^[0-9a-f]{16}$/.test(id)) return false;
  const eigene = token ? tokenHash(token) : '';
  return db.prepare('DELETE FROM sitzung WHERE benutzer_id = ? AND substr(token_hash, 1, 16) = ? AND token_hash <> ?').run(benutzerId, id, eigene).changes > 0;
}

/** Liefert das aktive Konto zur Sitzung oder null; abgelaufene Sitzungen werden dabei gelöscht. */
export function pruefeSitzung(db: DB, token: string | undefined, jetzt: Date): BenutzerZeile | null {
  if (!token || token.length > 200) return null;
  const hash = tokenHash(token);
  const s = db.prepare('SELECT benutzer_id, zuletzt, laeuft_ab FROM sitzung WHERE token_hash = ?').get(hash) as
    | { benutzer_id: number; zuletzt: string; laeuft_ab: string }
    | undefined;
  if (!s) return null;
  const iso = jetzt.toISOString();
  const leerlaufEnde = new Date(new Date(s.zuletzt).getTime() + LEERLAUF_MS).toISOString();
  if (iso > s.laeuft_ab || iso > leerlaufEnde) {
    db.prepare('DELETE FROM sitzung WHERE token_hash = ?').run(hash);
    return null;
  }
  const b = db.prepare('SELECT * FROM benutzer WHERE id = ?').get(s.benutzer_id) as BenutzerZeile | undefined;
  if (!b || b.status !== 'aktiv') {
    db.prepare('DELETE FROM sitzung WHERE token_hash = ?').run(hash);
    return null;
  }
  // nicht bei jeder Anfrage schreiben
  if (jetzt.getTime() - new Date(s.zuletzt).getTime() > 60_000) {
    db.prepare('UPDATE sitzung SET zuletzt = ? WHERE token_hash = ?').run(iso, hash);
  }
  return b;
}

/**
 * Wann die Sitzung endet, wenn nichts mehr passiert: nach 8 Stunden ohne Anfrage, spätestens zur festen Grenze (24 Stunden).
 * Die Oberfläche warnt damit vorher (WCAG 2.2.1). `fest`: Die feste Grenze kommt zuerst – verlängern hilft dann nicht.
 */
export function sitzungsEnde(db: DB, token: string | undefined): { ende: string; fest: boolean } | null {
  if (!token) return null;
  const s = db.prepare('SELECT zuletzt, laeuft_ab FROM sitzung WHERE token_hash = ?').get(tokenHash(token)) as { zuletzt: string; laeuft_ab: string } | undefined;
  if (!s) return null;
  const leerlauf = new Date(new Date(s.zuletzt).getTime() + LEERLAUF_MS).toISOString();
  return leerlauf < s.laeuft_ab ? { ende: leerlauf, fest: false } : { ende: s.laeuft_ab, fest: true };
}

export function beendeSitzung(db: DB, token: string | undefined): void {
  if (token) db.prepare('DELETE FROM sitzung WHERE token_hash = ?').run(tokenHash(token));
}

/** Beendet alle Sitzungen eines Kontos, optional außer der aktuellen. */
export function beendeAlleSitzungen(db: DB, benutzerId: number, ausserToken?: string): void {
  if (ausserToken) {
    db.prepare('DELETE FROM sitzung WHERE benutzer_id = ? AND token_hash <> ?').run(benutzerId, tokenHash(ausserToken));
  } else {
    db.prepare('DELETE FROM sitzung WHERE benutzer_id = ?').run(benutzerId);
  }
}

export function raeumeAuf(db: DB, jetzt: Date): void {
  const iso = jetzt.toISOString();
  db.prepare('DELETE FROM sitzung WHERE laeuft_ab < ? OR zuletzt < ?').run(iso, new Date(jetzt.getTime() - LEERLAUF_MS).toISOString());
  db.prepare('DELETE FROM anmeldevorgang WHERE erstellt < ?').run(new Date(jetzt.getTime() - 15 * 60 * 1000).toISOString());
}
