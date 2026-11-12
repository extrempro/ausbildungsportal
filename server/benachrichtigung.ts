import type { AktivitaetArt } from './aktivitaet';
import { Fehler, koerper } from './api-basis';
import type { Kontext, Route } from './api-basis';
import type { DB } from './db';
import { heute } from './datum';
import { sichtbareAzubis } from './rechte';
import { istMailAdresse, MailFehler } from './smtp';
import type { BenutzerZeile } from './typen';

/**
 * Benachrichtigungen per Teams und E-Mail – zusätzlich zur Glocke.
 *
 * - Jede Person schaltet sie unter „Konto“ selbst ein, je Bereich und je Weg. Anfangs ist alles aus.
 * - Verschickt wird nur, was die Person auch in der Glocke sieht (dieselbe Prüfung über sichtbareAzubis), nie die eigene Handlung.
 * - Die Nachricht nennt keine Namen und keine Inhalte – nur, was passiert ist, und einen Link ins Portal.
 * - Was kurz nacheinander passiert, geht als eine Nachricht hinaus. Einen Verlauf verschickter Nachrichten gibt es nicht.
 */
export const BEREICHE = ['berichtsheft', 'urlaub', 'plan'] as const;
export type Bereich = (typeof BEREICHE)[number];

/** So lange wird gesammelt, bevor eine Nachricht hinausgeht. */
export const SAMMEL_MS = 3 * 60_000;

const bereichVon = (art: AktivitaetArt): Bereich => (art === 'plan_neu' ? 'plan' : art.startsWith('urlaub_') ? 'urlaub' : 'berichtsheft');

/**
 * Stellt eine Aktivität für alle ein, die sie in der Glocke sehen und für den Bereich eine Benachrichtigung gewählt haben.
 * Läuft in derselben Transaktion wie die Aktivität – nach außen geht hier noch nichts.
 */
export function stelleEin(db: DB, jetzt: Date, aktivitaetId: number, art: AktivitaetArt, azubiId: number, akteurId: number | null): void {
  const waehler = db
    .prepare(
      `SELECT b.*, w.teams AS w_teams, w.mail AS w_mail FROM benachrichtigung_wahl w JOIN benutzer b ON b.id = w.benutzer_id
        WHERE w.bereich = ? AND (w.teams = 1 OR w.mail = 1) AND b.status = 'aktiv' AND b.anmeldung = 'entra'`,
    )
    .all(bereichVon(art)) as unknown as (BenutzerZeile & { w_teams: number; w_mail: number })[];
  const tag = heute(jetzt);
  for (const w of waehler) {
    if (w.id === akteurId) continue;
    if (!sichtbareAzubis(db, w, tag).includes(azubiId)) continue;
    db.prepare('INSERT INTO benachrichtigung_warte (benutzer_id, aktivitaet_id, teams, mail, zeit) VALUES (?, ?, ?, ?, ?)').run(w.id, aktivitaetId, w.w_teams, w.w_mail, jetzt.toISOString());
  }
}

/** Kalenderwoche nach ISO 8601 zu einem Montag (JJJJ-MM-TT) */
function kw(montag: string): number {
  const d = new Date(`${montag}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 3);
  return Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86_400_000 / 7) + 1;
}

interface Ereignis {
  art: AktivitaetArt;
  /** betrifft die Empfängerin selbst (sie ist der Azubi) */
  eigenes: boolean;
  montag: string | null;
  anzahl: number;
}

/** Texte je Art: [für den Azubi selbst – eins, mehrere; für Betreuende – eins, mehrere]. Ohne Namen. */
const TEXT: Record<AktivitaetArt, [string, string, string, string]> = {
  plan_neu: ['In deinem Ausbildungsplan gibt es einen neuen Eintrag.', 'In deinem Ausbildungsplan gibt es {n} neue Einträge.', 'Im Ausbildungsplan eines Azubis gibt es einen neuen Eintrag.', 'In Ausbildungsplänen deiner Azubis gibt es {n} neue Einträge.'],
  bericht_eingereicht: ['Dein Bericht{kw} wurde eingereicht.', '{n} deiner Berichte wurden eingereicht.', 'Ein Bericht{kw} wurde eingereicht und wartet auf das Abzeichnen.', '{n} Berichte wurden eingereicht und warten auf das Abzeichnen.'],
  bericht_abgezeichnet: ['Dein Bericht{kw} wurde abgezeichnet.', '{n} deiner Berichte wurden abgezeichnet.', 'Ein Bericht{kw} wurde abgezeichnet.', '{n} Berichte wurden abgezeichnet.'],
  bericht_zurueck: ['Dein Bericht{kw} wurde zurückgegeben. Bitte sieh ihn dir noch einmal an.', '{n} deiner Berichte wurden zurückgegeben. Bitte sieh sie dir noch einmal an.', 'Ein Bericht{kw} wurde zurückgegeben.', '{n} Berichte wurden zurückgegeben.'],
  bericht_geoeffnet: ['Dein Bericht{kw} wurde wieder geöffnet – die Abzeichnung ist aufgehoben.', '{n} deiner Berichte wurden wieder geöffnet.', 'Ein Bericht{kw} wurde wieder geöffnet.', '{n} Berichte wurden wieder geöffnet.'],
  urlaub_beantragt: ['Dein Urlaubsantrag ist eingegangen.', '{n} Urlaubsanträge von dir sind eingegangen.', 'Ein Urlaubsantrag wartet auf dich.', '{n} Urlaubsanträge warten auf dich.'],
  urlaub_bestaetigt: ['Dein Urlaubsantrag wurde von einer Abteilung bestätigt.', '{n} Bestätigungen zu deinen Urlaubsanträgen sind da.', 'Ein Urlaubsantrag wurde von einer Abteilung bestätigt.', '{n} Urlaubsanträge wurden von einer Abteilung bestätigt.'],
  urlaub_genehmigt: ['Dein Urlaub wurde genehmigt.', '{n} deiner Urlaubsanträge wurden genehmigt.', 'Ein Urlaubsantrag wurde genehmigt.', '{n} Urlaubsanträge wurden genehmigt.'],
  urlaub_abgelehnt: ['Dein Urlaubsantrag wurde abgelehnt. Den Grund findest du im Portal.', '{n} deiner Urlaubsanträge wurden abgelehnt.', 'Ein Urlaubsantrag wurde abgelehnt.', '{n} Urlaubsanträge wurden abgelehnt.'],
  urlaub_zurueckgezogen: ['Dein Urlaubsantrag wurde zurückgezogen.', '{n} deiner Urlaubsanträge wurden zurückgezogen.', 'Ein Urlaubsantrag wurde zurückgezogen.', '{n} Urlaubsanträge wurden zurückgezogen.'],
  urlaub_storniert: ['Dein genehmigter Urlaub wurde storniert.', '{n} deiner genehmigten Urlaube wurden storniert.', 'Ein genehmigter Urlaub wurde storniert.', '{n} genehmigte Urlaube wurden storniert.'],
};

/** Fasst zusammen: je Art (und eigen/fremd) eine Zeile. Plan-Einträge zählen mit ihrer Anzahl, alles andere je Vorgang. */
export function zeilenAus(ereignisse: Ereignis[]): string[] {
  const gruppen = new Map<string, { art: AktivitaetArt; eigenes: boolean; n: number; wochen: Set<string> }>();
  for (const e of ereignisse) {
    const s = `${e.art}|${e.eigenes ? 1 : 0}`;
    const g = gruppen.get(s) ?? { art: e.art, eigenes: e.eigenes, n: 0, wochen: new Set<string>() };
    g.n += e.art === 'plan_neu' ? e.anzahl : 1;
    if (e.montag) g.wochen.add(e.montag);
    gruppen.set(s, g);
  }
  return [...gruppen.values()].map((g) => {
    const vorlage = TEXT[g.art][(g.eigenes ? 0 : 2) + (g.n > 1 ? 1 : 0)];
    const woche = g.wochen.size === 1 ? ` für KW ${kw([...g.wochen][0])}` : '';
    return vorlage.replace('{n}', String(g.n)).replace('{kw}', woche);
  });
}

export function teamsKarte(k: Kontext, empfaenger: string, zeilen: string[]): unknown {
  return {
    empfaenger,
    karte: {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        { type: 'TextBlock', text: 'Ausbildungsportal', weight: 'Bolder', size: 'Medium', color: 'Accent' },
        ...zeilen.map((text) => ({ type: 'TextBlock', text, wrap: true })),
        { type: 'TextBlock', text: 'Welche Nachrichten du bekommst, stellst du im Portal unter „Konto“ ein.', wrap: true, isSubtle: true, size: 'Small' },
      ],
      actions: [{ type: 'Action.OpenUrl', title: 'Im Portal öffnen', url: k.cfg.appUrl }],
    },
  };
}

export function mailAus(k: Kontext, zeilen: string[]): { betreff: string; text: string } {
  const betreff = zeilen.length === 1 ? `Ausbildungsportal: ${zeilen[0].replace(/\.( .*)?$/, '')}` : `Ausbildungsportal: ${zeilen.length} Neuigkeiten`;
  const text = [
    'Hallo,',
    '',
    'im Ausbildungsportal gibt es Neues für dich:',
    '',
    ...zeilen.map((z) => `- ${z}`),
    '',
    `Zum Portal: ${k.cfg.appUrl}`,
    '',
    'Du bekommst diese Mail, weil du im Portal unter „Konto“ Benachrichtigungen per E-Mail eingeschaltet hast. Dort kannst du sie auch wieder abstellen.',
  ].join('\n');
  return { betreff: betreff.slice(0, 150), text };
}

/** Warum ein Weg gerade nicht geht – oder null. */
function hindernis(k: Kontext, weg: 'teams' | 'mail', b: Pick<BenutzerZeile, 'anmeldename'>): string | null {
  if (weg === 'teams') return k.cfg.teamsChatWebhook ? null : 'Nachrichten per Teams sind in diesem Portal nicht eingerichtet. Das macht der Betreiber des Portals.';
  if (!k.cfg.smtp) return 'Der Mailversand ist in diesem Portal nicht eingerichtet. Das macht der Betreiber des Portals.';
  return istMailAdresse(b.anmeldename) ? null : 'Dein Anmeldename ist keine Mail-Adresse – dorthin kann das Portal nichts schicken.';
}

/** Schickt über einen Weg; gibt bei einem Fehler den Grund zurück. Im Log steht nie die Adresse des Workflows und nie der Empfänger. */
async function schicke(k: Kontext, weg: 'teams' | 'mail', b: Pick<BenutzerZeile, 'anmeldename'>, zeilen: string[]): Promise<string | null> {
  const grund = hindernis(k, weg, b);
  if (grund) return grund;
  try {
    if (weg === 'teams') {
      const r = await k.sende(k.cfg.teamsChatWebhook as string, teamsKarte(k, b.anmeldename, zeilen));
      if (r.ok) return null;
      k.log(`Benachrichtigung per Teams fehlgeschlagen: die Gegenstelle antwortet mit Status ${r.status}`);
      return `Teams antwortet mit einem Fehler (Status ${r.status}).`;
    }
    await k.mail({ an: b.anmeldename, ...mailAus(k, zeilen) });
    return null;
  } catch (e) {
    const text = weg === 'mail' ? (e instanceof MailFehler ? e.message : 'Die Mail konnte nicht gesendet werden.') : e instanceof Error && e.name === 'TimeoutError' ? 'Teams antwortet nicht.' : 'Teams ist nicht erreichbar.';
    k.log(`Benachrichtigung per ${weg === 'teams' ? 'Teams' : 'E-Mail'} fehlgeschlagen: ${text}`);
    return text;
  }
}

interface WarteZeile {
  id: number;
  benutzer_id: number;
  teams: number;
  mail: number;
  zeit: string;
  art: AktivitaetArt;
  azubi_id: number;
  montag: string | null;
  anzahl: number;
}

let laeuft = false;

/**
 * Verschickt, was lange genug gewartet hat: je Person eine Nachricht je Weg.
 * Die Einträge werden vor dem Senden gelöscht – scheitert der Versand, steht es im Log und die Glocke zeigt es weiterhin.
 */
export async function verschickeFaellige(k: Kontext): Promise<number> {
  if (laeuft) return 0;
  laeuft = true;
  try {
    const grenze = new Date(k.jetzt().getTime() - SAMMEL_MS).toISOString();
    const faellig = (k.db.prepare('SELECT benutzer_id AS id FROM benachrichtigung_warte GROUP BY benutzer_id HAVING MIN(zeit) <= ?').all(grenze) as unknown as { id: number }[]).map((z) => z.id);
    let gesendet = 0;
    for (const id of faellig) {
      const zeilen = k.db
        .prepare('SELECT w.*, a.art, a.azubi_id, a.montag, a.anzahl FROM benachrichtigung_warte w JOIN aktivitaet a ON a.id = w.aktivitaet_id WHERE w.benutzer_id = ? ORDER BY w.id')
        .all(id) as unknown as WarteZeile[];
      k.db.prepare('DELETE FROM benachrichtigung_warte WHERE benutzer_id = ?').run(id);
      const b = k.db.prepare("SELECT * FROM benutzer WHERE id = ? AND status = 'aktiv'").get(id) as unknown as BenutzerZeile | undefined;
      if (!b) continue;
      // es gilt die Wahl von jetzt: was inzwischen abgewählt wurde, geht nicht mehr hinaus
      const wahl = new Map((k.db.prepare('SELECT bereich, teams, mail FROM benachrichtigung_wahl WHERE benutzer_id = ?').all(id) as unknown as WahlZeile[]).map((z) => [z.bereich, z]));
      for (const weg of ['teams', 'mail'] as const) {
        const eigene = zeilen.filter((z) => wahl.get(bereichVon(z.art))?.[weg] === 1);
        if (eigene.length === 0) continue;
        const text = zeilenAus(eigene.map((z) => ({ art: z.art, eigenes: z.azubi_id === id, montag: z.montag, anzahl: z.anzahl })));
        if ((await schicke(k, weg, b, text)) === null) gesendet++;
      }
    }
    return gesendet;
  } finally {
    laeuft = false;
  }
}

interface WahlZeile {
  bereich: Bereich;
  teams: number;
  mail: number;
}

function ansicht(k: Kontext, b: BenutzerZeile) {
  const gewaehlt = new Map((k.db.prepare('SELECT bereich, teams, mail FROM benachrichtigung_wahl WHERE benutzer_id = ?').all(b.id) as unknown as WahlZeile[]).map((z) => [z.bereich, z]));
  return {
    teams: { grund: hindernis(k, 'teams', b) },
    mail: { grund: hindernis(k, 'mail', b), adresse: istMailAdresse(b.anmeldename) ? b.anmeldename : null },
    wahl: BEREICHE.map((bereich) => ({ bereich, teams: gewaehlt.get(bereich)?.teams === 1, mail: gewaehlt.get(bereich)?.mail === 1 })),
  };
}

const FACHROLLEN: Route['wer'] = ['ausbilder', 'beauftragter', 'azubi'];

export const BENACHRICHTIGUNG_ROUTEN: Route[] = [
  { m: 'GET', p: '/api/ich/benachrichtigungen', wer: FACHROLLEN, h: (c) => ({ status: 200, body: ansicht(c.k, c.b) }) },
  {
    m: 'PUT',
    p: '/api/ich/benachrichtigungen',
    wer: FACHROLLEN,
    h: (c) => {
      const wahl = koerper(c).wahl;
      if (!Array.isArray(wahl) || wahl.length > BEREICHE.length) throw new Fehler(400, 'Ungültige Angabe');
      const neu = new Map<Bereich, { teams: boolean; mail: boolean }>();
      for (const w of wahl as unknown[]) {
        const z = (w ?? {}) as Record<string, unknown>;
        if (!BEREICHE.includes(z.bereich as Bereich) || typeof z.teams !== 'boolean' || typeof z.mail !== 'boolean') throw new Fehler(400, 'Ungültige Angabe');
        neu.set(z.bereich as Bereich, { teams: z.teams, mail: z.mail });
      }
      // Einschalten geht nur, wenn der Weg eingerichtet ist – Ausschalten immer
      const vorher = new Map(ansicht(c.k, c.b).wahl.map((z) => [z.bereich, z]));
      for (const weg of ['teams', 'mail'] as const) {
        const grund = hindernis(c.k, weg, c.b);
        if (grund && [...neu].some(([bereich, z]) => z[weg] && !vorher.get(bereich)?.[weg])) throw new Fehler(409, grund);
      }
      for (const [bereich, z] of neu) {
        if (!z.teams && !z.mail) c.k.db.prepare('DELETE FROM benachrichtigung_wahl WHERE benutzer_id = ? AND bereich = ?').run(c.b.id, bereich);
        else
          c.k.db
            .prepare('INSERT INTO benachrichtigung_wahl (benutzer_id, bereich, teams, mail) VALUES (?, ?, ?, ?) ON CONFLICT(benutzer_id, bereich) DO UPDATE SET teams = excluded.teams, mail = excluded.mail')
            .run(c.b.id, bereich, z.teams ? 1 : 0, z.mail ? 1 : 0);
      }
      return { status: 200, body: ansicht(c.k, c.b) };
    },
  },
  {
    // Probe an sich selbst – damit man sieht, ob und wie die Nachricht ankommt
    m: 'POST',
    p: '/api/ich/benachrichtigungen/test',
    wer: FACHROLLEN,
    h: async (c) => {
      const weg = koerper(c).weg;
      if (weg !== 'teams' && weg !== 'mail') throw new Fehler(400, 'Ungültige Angabe');
      const fehler = await schicke(c.k, weg, c.b, ['Das ist eine Testnachricht. So sehen Benachrichtigungen aus dem Ausbildungsportal aus.']);
      if (fehler) throw new Fehler(502, fehler);
      return { status: 200, body: { ok: true } };
    },
  },
];
