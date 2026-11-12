import { Fehler, koerper } from './api-basis';
import type { Route } from './api-basis';
import type { DB } from './db';
import { heute } from './datum';
import { sichtbareAzubis } from './rechte';
import type { BenutzerZeile } from './typen';
import { stelleEin } from './benachrichtigung';

/**
 * Aktivitäten für die Glocke in der Kopfzeile.
 * Gemerkt wird nur „wer hat was für welchen Azubi in welcher Woche getan“ – nie der Inhalt eines Berichts.
 * Wer eine Aktivität sieht, entscheidet allein sichtbareAzubis (rechte.ts); die eigenen Handlungen sieht niemand.
 */
export type AktivitaetArt =
  | 'plan_neu'
  | 'bericht_eingereicht'
  | 'bericht_abgezeichnet'
  | 'bericht_zurueck'
  | 'bericht_geoeffnet'
  | 'urlaub_beantragt'
  | 'urlaub_bestaetigt'
  | 'urlaub_genehmigt'
  | 'urlaub_abgelehnt'
  | 'urlaub_zurueckgezogen'
  | 'urlaub_storniert';

const AUFBEWAHRUNG_TAGE = 60;
/** so viele Aktivitäten werden höchstens gelesen und zusammengefasst */
const MAX_GELESEN = 300;
/** so viele Zeilen zeigt die Glocke höchstens */
const MAX_GRUPPEN = 30;
const MAX_TITEL = 3;

export function merkeAktivitaet(
  db: DB,
  jetzt: Date,
  art: AktivitaetArt,
  azubiId: number,
  wer: Pick<BenutzerZeile, 'id' | 'anzeigename'>,
  montag: string | null,
  titel = '',
  anzahl = 1,
  /** Lauf der Sammelplanung, zu dem die Aktivität gehört – wird mit ihm zurückgenommen */
  sammelId: number | null = null,
): void {
  if (anzahl < 1) return;
  const grenze = new Date(jetzt.getTime() - AUFBEWAHRUNG_TAGE * 86_400_000).toISOString();
  db.prepare('DELETE FROM aktivitaet WHERE zeit < ?').run(grenze);
  const r = db.prepare('INSERT INTO aktivitaet (zeit, azubi_id, akteur_id, akteur_name, art, montag, titel, anzahl, sammel_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    jetzt.toISOString(),
    azubiId,
    wer.id,
    wer.anzeigename,
    art,
    montag,
    titel.slice(0, 200),
    anzahl,
    sammelId,
  );
  // wer dafür eine Nachricht per Teams oder E-Mail gewählt hat, bekommt sie etwas später gebündelt
  stelleEin(db, jetzt, Number(r.lastInsertRowid), art, azubiId, wer.id);
}

interface Zeile {
  id: number;
  zeit: string;
  azubi_id: number;
  azubi_name: string;
  akteur_id: number | null;
  akteur_name: string;
  art: AktivitaetArt;
  montag: string | null;
  titel: string;
  anzahl: number;
}

export interface AktivitaetGruppe {
  /** höchste ID der Gruppe – dient als Schlüssel */
  id: number;
  art: AktivitaetArt;
  /** Zeit der jüngsten Aktivität der Gruppe */
  zeit: string;
  azubiId: number;
  azubiName: string;
  akteurName: string;
  /** zusammengefasste Aktivitäten (eine übernommene Vorlage zählt mit all ihren Einträgen) */
  anzahl: number;
  /** bis zu drei Titel neuer Plan-Einträge, die jüngsten zuerst */
  titel: string[];
  /** betroffene Wochen (Montage), aufsteigend */
  wochen: string[];
  neu: boolean;
}

function sichtbar(db: DB, wer: BenutzerZeile, tag: string): Zeile[] {
  const ids = sichtbareAzubis(db, wer, tag);
  if (ids.length === 0) return [];
  return db
    .prepare(
      `SELECT a.*, b.anzeigename AS azubi_name FROM aktivitaet a JOIN benutzer b ON b.id = a.azubi_id
        WHERE a.azubi_id IN (${ids.map(() => '?').join(',')}) AND (a.akteur_id IS NULL OR a.akteur_id <> ?)
        ORDER BY a.id DESC LIMIT ?`,
    )
    .all(...ids, wer.id, MAX_GELESEN) as unknown as Zeile[];
}

/**
 * Fasst zusammen, was zusammengehört: gleiche Person, gleicher Azubi, gleiche Art, gleicher Tag –
 * neue und schon gesehene Aktivitäten bleiben getrennt.
 */
export function leseAktivitaeten(db: DB, wer: BenutzerZeile, jetzt: Date): { neu: number; bis: number; gruppen: AktivitaetGruppe[] } {
  const gesehen = (db.prepare('SELECT aktivitaet_gesehen AS g FROM benutzer WHERE id = ?').get(wer.id) as { g: number }).g;
  const zeilen = sichtbar(db, wer, heute(jetzt));
  const gruppen = new Map<string, AktivitaetGruppe & { alleWochen: Set<string> }>();
  for (const z of zeilen) {
    const neu = z.id > gesehen;
    const schluessel = [z.art, z.azubi_id, z.akteur_id ?? z.akteur_name, heute(new Date(z.zeit)), neu ? 1 : 0].join('|');
    let g = gruppen.get(schluessel);
    if (!g) {
      g = { id: z.id, art: z.art, zeit: z.zeit, azubiId: z.azubi_id, azubiName: z.azubi_name, akteurName: z.akteur_name, anzahl: 0, titel: [], wochen: [], neu, alleWochen: new Set() };
      gruppen.set(schluessel, g);
    }
    g.anzahl += z.anzahl;
    if (z.titel && g.titel.length < MAX_TITEL && !g.titel.includes(z.titel)) g.titel.push(z.titel);
    if (z.montag) g.alleWochen.add(z.montag);
  }
  const liste = [...gruppen.values()].slice(0, MAX_GRUPPEN).map(({ alleWochen, ...g }) => ({ ...g, wochen: [...alleWochen].sort() }));
  return {
    neu: zeilen.filter((z) => z.id > gesehen).reduce((n, z) => n + z.anzahl, 0),
    bis: zeilen[0]?.id ?? gesehen,
    gruppen: liste,
  };
}

const FACHROLLEN: Route['wer'] = ['ausbilder', 'beauftragter', 'azubi'];

export const AKTIVITAET_ROUTEN: Route[] = [
  { m: 'GET', p: '/api/aktivitaeten', wer: FACHROLLEN, h: (c) => ({ status: 200, body: leseAktivitaeten(c.k.db, c.b, c.k.jetzt()) }) },
  {
    // „bis“ kommt aus der letzten Abfrage – was danach passiert ist, bleibt neu
    m: 'POST',
    p: '/api/aktivitaeten/gesehen',
    wer: FACHROLLEN,
    h: (c) => {
      const bis = koerper(c).bis;
      if (typeof bis !== 'number' || !Number.isInteger(bis) || bis < 0) throw new Fehler(400, 'Ungültige Angabe');
      const hoechste = (c.k.db.prepare('SELECT COALESCE(MAX(id), 0) AS m FROM aktivitaet').get() as { m: number }).m;
      c.k.db.prepare('UPDATE benutzer SET aktivitaet_gesehen = MAX(aktivitaet_gesehen, ?) WHERE id = ?').run(Math.min(bis, hoechste), c.b.id);
      return { status: 200, body: leseAktivitaeten(c.k.db, c.b, c.k.jetzt()) };
    },
  },
];
