import { createHash } from 'node:crypto';
import { Fehler, holeBenutzer, idAus, koerper } from './api-basis';
import type { Route } from './api-basis';
import type { DB } from './db';
import { heute } from './datum';
import type { EntraIdentitaet } from './entra';
import { protokolliere } from './protokoll';
import { darfAzubiSehen } from './rechte';
import type { BenutzerZeile } from './typen';

/**
 * Profilbild aus Microsoft Entra.
 * - Nur wenn der Betreiber es einschaltet (ENTRA_PROFILBILD=true); dann holt die Anmeldung das Bild über Microsoft Graph.
 * - Gespeichert wird nur die kleine Fassung (96 × 96). Jede Person kann ihr Bild unter „Konto“ abschalten – dann wird es gelöscht.
 * - Sichtbar ist ein Bild für die Person selbst und für Ausbilder und Beauftragte, die diesen Azubi sehen dürfen.
 */

/** Übernimmt nach der Anmeldung, was Entra zum Bild gesagt hat: neues Bild speichern, entferntes löschen. */
export function merkeBild(db: DB, b: BenutzerZeile, wer: EntraIdentitaet, jetzt: Date): void {
  if (wer.bild === undefined || b.bild_zeigen !== 1) return; // nicht abgefragt, Abruf fehlgeschlagen oder abgeschaltet: nichts ändern
  if (wer.bild === null) {
    db.prepare('DELETE FROM benutzer_bild WHERE benutzer_id = ?').run(b.id);
    db.prepare('UPDATE benutzer SET bild_stand = NULL WHERE id = ?').run(b.id);
    return;
  }
  const stand = createHash('sha256').update(wer.bild.daten).digest('hex').slice(0, 12);
  if (stand === b.bild_stand) return;
  db.prepare('INSERT INTO benutzer_bild (benutzer_id, typ, daten, geaendert) VALUES (?, ?, ?, ?) ON CONFLICT(benutzer_id) DO UPDATE SET typ = excluded.typ, daten = excluded.daten, geaendert = excluded.geaendert').run(b.id, wer.bild.typ, wer.bild.daten, jetzt.toISOString());
  db.prepare('UPDATE benutzer SET bild_stand = ? WHERE id = ?').run(stand, b.id);
}

export const BILD_ROUTEN: Route[] = [
  {
    m: 'GET',
    p: '/api/benutzer/:id/bild',
    wer: 'alle',
    h: (c) => {
      const z = holeBenutzer(c.k.db, idAus(c.p.id));
      const darf = !!z && (z.id === c.b.id || ((c.b.rolle === 'ausbilder' || c.b.rolle === 'beauftragter') && z.rolle === 'azubi' && darfAzubiSehen(c.k.db, c.b, z.id, heute(c.k.jetzt()))));
      const bild = darf && z.bild_zeigen === 1 ? (c.k.db.prepare('SELECT typ, daten FROM benutzer_bild WHERE benutzer_id = ?').get(z.id) as { typ: string; daten: Uint8Array } | undefined) : undefined;
      if (!bild) throw new Fehler(404, 'Nicht gefunden');
      return { status: 200, bild: { typ: bild.typ, inhalt: Buffer.from(bild.daten) } };
    },
  },
  {
    // Eigenes Profilbild an- oder abschalten. Abschalten löscht das gespeicherte Bild sofort.
    m: 'PUT',
    p: '/api/ich/bild',
    wer: 'alle',
    h: (c) => {
      const zeigen = koerper(c).zeigen;
      if (typeof zeigen !== 'boolean') throw new Fehler(400, 'zeigen muss wahr oder falsch sein');
      if (c.b.anmeldung !== 'entra') throw new Fehler(400, 'Ein Profilbild gibt es nur für Konten, die sich über Microsoft anmelden');
      if (!zeigen) {
        c.k.db.prepare('DELETE FROM benutzer_bild WHERE benutzer_id = ?').run(c.b.id);
        c.k.db.prepare('UPDATE benutzer SET bild_zeigen = 0, bild_stand = NULL WHERE id = ?').run(c.b.id);
      } else c.k.db.prepare('UPDATE benutzer SET bild_zeigen = 1 WHERE id = ?').run(c.b.id);
      protokolliere(c.k.db, c.k.jetzt(), 'konto', 'konto_geaendert', c.b, c.b, zeigen ? 'Profilbild eingeschaltet' : 'Profilbild abgeschaltet und gelöscht');
      return { status: 200, body: { zeigen } };
    },
  },
];
