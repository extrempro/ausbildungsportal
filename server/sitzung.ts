import { createHash, randomBytes } from 'node:crypto';
import type { DB } from './db';
import type { BenutzerZeile } from './typen';

/** Ohne Aktivität endet die Sitzung nach 8 Stunden, spätestens aber nach 24 Stunden. */
export const LEERLAUF_MS = 8 * 60 * 60 * 1000;
export const HOECHST_MS = 24 * 60 * 60 * 1000;

export function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Legt eine Sitzung an und gibt das Token zurück – in der Datenbank steht nur dessen Hash. */
export function beginneSitzung(db: DB, benutzerId: number, jetzt: Date): string {
  const token = randomBytes(32).toString('base64url');
  const iso = jetzt.toISOString();
  db.prepare('INSERT INTO sitzung (token_hash, benutzer_id, erstellt, zuletzt, laeuft_ab) VALUES (?, ?, ?, ?, ?)').run(
    tokenHash(token),
    benutzerId,
    iso,
    iso,
    new Date(jetzt.getTime() + HOECHST_MS).toISOString(),
  );
  return token;
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
