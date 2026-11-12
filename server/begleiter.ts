import { Fehler, koerper, text } from './api-basis';
import type { Ctx, Route } from './api-basis';
import { heute } from './datum';
import type { DB } from './db';
import { plusTage } from './kalender';
import { protokolliere } from './protokoll';
import { dauerVon, leseProfil } from './stammdaten';

/**
 * Begleiter: eine kleine Figur, die Azubis durch das Portal begleitet – ein freiwilliges, lustiges Beiwerk.
 *
 * - Nur für Azubis. Alle Routen hier (außer dem Schalter des Super-Admins) sind nur für die Rolle Azubi und liefern nur
 *   die eigenen Angaben. Ausbilder, Beauftragte und Super-Admin sehen weder Figur noch Namen noch Stufe.
 * - Der Begleiter bekommt über die Ausbildungszeit verteilt neun Teile Zubehör und behält sie. Die Teile hängen nur
 *   an der Zeit (Beginn und Ende der Ausbildung im Profil) – nie an Leistung, Lernstand oder Berichten. Es gibt keine
 *   Punkte, keine Serien und keinen Vergleich mit anderen.
 * - Der Super-Admin kann den Begleiter für das ganze Portal ausschalten (Einstellung „begleiter_an“).
 * - Was der Begleiter sagt (Begrüßung, Lob), entsteht in der Oberfläche aus dem, was der Azubi ohnehin sieht.
 */

export const FIGUREN = ['eule', 'fuchs', 'roboter', 'biber', 'pinguin'] as const;
/** Zahl der Zubehör-Teile; das letzte (Abschlusshut) kommt am Ende der Ausbildung. */
export const STUFEN = 9;

interface Zeile {
  figur: string;
  name: string;
  an: number;
  gefragt: number;
  stufe_gezeigt: number;
}

const tageZwischen = (von: string, bis: string) => Math.round((Date.parse(bis) - Date.parse(von)) / 86_400_000);

/**
 * Stufe (0 bis 9) an einem Tag: Die Teile 1 bis 8 kommen in gleichen Abständen über die Ausbildungszeit,
 * das neunte am letzten Tag. Bei drei Jahren ist das alle vier Monate. Ohne Ausbildungsbeginn bleibt es bei 0.
 */
export function stufeAm(beginn: string | null, ende: string | null, tag: string): number {
  if (!beginn || !ende || ende <= beginn || tag < beginn) return 0;
  if (tag >= ende) return STUFEN;
  return Math.min(STUFEN - 1, Math.floor((STUFEN * tageZwischen(beginn, tag)) / tageZwischen(beginn, ende)));
}

/** Der Tag, an dem das nächste Teil kommt – null, wenn alle da sind oder die Ausbildungszeit fehlt. */
export function naechstesTeilAm(beginn: string | null, ende: string | null, tag: string): string | null {
  const stufe = stufeAm(beginn, ende, tag);
  if (!beginn || !ende || ende <= beginn || stufe >= STUFEN) return null;
  if (stufe === STUFEN - 1) return ende;
  // kleinster Tag, an dem die nächste Stufe erreicht ist
  let t = plusTage(beginn, Math.ceil(((stufe + 1) * tageZwischen(beginn, ende)) / STUFEN));
  while (stufeAm(beginn, ende, t) <= stufe) t = plusTage(t, 1);
  return t < beginn ? beginn : t;
}

export function begleiterErlaubt(db: DB): boolean {
  return (db.prepare("SELECT wert FROM einstellungen WHERE schluessel = 'begleiter_an'").get() as { wert: string } | undefined)?.wert !== '0';
}

function ansicht(c: Ctx) {
  const { db } = c.k;
  const z = db.prepare('SELECT figur, name, an, gefragt, stufe_gezeigt FROM begleiter WHERE azubi_id = ?').get(c.b.id) as Zeile | undefined;
  const dauer = dauerVon(db, leseProfil(db, c.b.id));
  const tag = heute(c.k.jetzt());
  const stufe = stufeAm(dauer?.beginn ?? null, dauer?.ende ?? null, tag);
  return {
    // vom Super-Admin für das ganze Portal ausgeschaltet → die Oberfläche zeigt nichts
    erlaubt: begleiterErlaubt(db),
    gefragt: z?.gefragt === 1,
    an: z?.an === 1,
    figur: z?.figur ?? '',
    name: z?.name ?? '',
    stufe,
    // bis zu welcher Stufe die Animation „neues Teil“ schon gezeigt wurde
    gezeigt: Math.min(z?.stufe_gezeigt ?? 0, stufe),
    naechstesAm: naechstesTeilAm(dauer?.beginn ?? null, dauer?.ende ?? null, tag),
    // ohne Ausbildungsbeginn im Profil kann der Begleiter nichts dazubekommen
    ohneZeit: dauer === null,
  };
}

export const BEGLEITER_ROUTEN: Route[] = [
  { m: 'GET', p: '/api/begleiter', wer: ['azubi'], h: (c) => ({ status: 200, body: ansicht(c) }) },

  {
    // Auswahl, Namen, an/aus – und damit auch die Antwort auf „Willst du einen Begleiter?“
    m: 'PUT',
    p: '/api/begleiter',
    wer: ['azubi'],
    h: (c) => {
      const b = koerper(c);
      if (typeof b.an !== 'boolean') throw new Fehler(400, 'Angabe „an“ fehlt');
      const alt = c.k.db.prepare('SELECT figur, name, an, gefragt, stufe_gezeigt FROM begleiter WHERE azubi_id = ?').get(c.b.id) as Zeile | undefined;
      let figur = alt?.figur ?? '';
      let name = alt?.name ?? '';
      if (b.figur !== undefined) {
        if (typeof b.figur !== 'string' || !(FIGUREN as readonly string[]).includes(b.figur)) throw new Fehler(400, 'Diese Figur gibt es nicht');
        figur = b.figur;
      }
      if (b.name !== undefined) name = text(b.name, 20, 'Der Name', false);
      if (b.an) {
        if (!begleiterErlaubt(c.k.db)) throw new Fehler(409, 'Der Begleiter ist für dieses Portal ausgeschaltet');
        if (!figur) throw new Fehler(400, 'Bitte such dir eine Figur aus');
        if (!name) throw new Fehler(400, 'Bitte gib deinem Begleiter einen Namen');
      }
      c.k.db
        .prepare(
          `INSERT INTO begleiter (azubi_id, figur, name, an, gefragt, stufe_gezeigt, geaendert) VALUES (?, ?, ?, ?, 1, ?, ?)
           ON CONFLICT(azubi_id) DO UPDATE SET figur = excluded.figur, name = excluded.name, an = excluded.an, gefragt = 1, geaendert = excluded.geaendert`,
        )
        .run(c.b.id, figur, name, b.an ? 1 : 0, alt?.stufe_gezeigt ?? 0, c.k.jetzt().toISOString());
      return { status: 200, body: ansicht(c) };
    },
  },

  {
    // Die Animation „neues Teil“ wurde gezeigt (oder übersprungen) – sie kommt für diese Stufe nicht noch einmal
    m: 'POST',
    p: '/api/begleiter/gefeiert',
    wer: ['azubi'],
    h: (c) => {
      const stufe = Number(koerper(c).stufe);
      if (!Number.isInteger(stufe) || stufe < 0 || stufe > STUFEN) throw new Fehler(400, 'Ungültige Stufe');
      const r = c.k.db.prepare('UPDATE begleiter SET stufe_gezeigt = MAX(stufe_gezeigt, ?) WHERE azubi_id = ?').run(Math.min(stufe, ansicht(c).stufe), c.b.id);
      if (r.changes === 0) throw new Fehler(404, 'Du hast noch keinen Begleiter');
      return { status: 200, body: ansicht(c) };
    },
  },

  // Schalter für das ganze Portal – nur der Super-Admin. Er sieht dabei nichts über einzelne Azubis.
  { m: 'GET', p: '/api/begleiter/einstellung', wer: ['admin'], h: (c) => ({ status: 200, body: { an: begleiterErlaubt(c.k.db) } }) },
  {
    m: 'PUT',
    p: '/api/begleiter/einstellung',
    wer: ['admin'],
    h: (c) => {
      const an = koerper(c).an;
      if (typeof an !== 'boolean') throw new Fehler(400, 'Angabe „an“ fehlt');
      c.k.db.prepare("INSERT INTO einstellungen (schluessel, wert) VALUES ('begleiter_an', ?) ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert").run(an ? '1' : '0');
      protokolliere(c.k.db, c.k.jetzt(), 'konto', an ? 'begleiter_eingeschaltet' : 'begleiter_ausgeschaltet', c.b, null);
      return { status: 200, body: { an } };
    },
  },
];
