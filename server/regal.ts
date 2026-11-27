import { randomInt } from 'node:crypto';
import { Fehler, idAus, koerper } from './api-basis';
import type { Ctx, Kontext, Route } from './api-basis';
import { heute } from './datum';
import type { DB } from './db';
import { montagVon, plusMonate, plusTage } from './kalender';
import { protokolliere } from './protokoll';
import { dauerVon, leseProfil } from './stammdaten';
import { arbeitstage, genehmigteTage } from './urlaub';

/**
 * Game Vault – das Pflanzenregal: ein freiwilliges Spiel für Azubis.
 *
 * - Privat: Alle Routen (außer dem Schalter des Super-Admins) sind nur für die Rolle Azubi und liefern nur das eigene
 *   Regal. Ausbilder, Beauftragte und Super-Admin sehen nichts davon. Keine Rangliste, kein Vergleich.
 * - Keine Leistungs- und Verhaltenskontrolle: Tropfen und Funken werden nicht mitgeschrieben, sondern bei jedem Aufruf
 *   aus dem errechnet, was ohnehin gespeichert ist (eingereichte Berichte, Lernstand, Quiz, Zusatzwissen, Abzeichen).
 *   Es gibt keine Fristen – ein Bericht zählt, egal wann er kommt. Gespeichert werden nur Ausgaben, ein Zähler für
 *   wiederholte Karteikarten und Höchststände (alle ohne Datum) sowie je Pflanze der Tag, an dem sie gegossen wurde.
 * - Meilensteine hängen an der Ausbildungszeit (Probezeit, Ausbildungsjahre, Halbzeit, Abschluss), nie an Leistung.
 *   Die Seltenheit einer Pflanze kauft man mit gesparten Tropfen.
 * - Pflanzen trocknen nur an Arbeitstagen im Betrieb aus – nicht am Wochenende, an Feiertagen, im Urlaub, in
 *   Berufsschulwochen und an Tagen, die im Bericht als abwesend stehen. Sie lassen höchstens die Blätter hängen.
 * - Der Super-Admin schaltet das Spiel für das ganze Portal ein (Einstellung „vault_an“, anfangs aus).
 */

// ---------- Regeln (in Zahlen) ----------

export const TROPFEN = { bericht: 5, gelb: 2, gruen: 5, quiz: 3, karte: 1, spiel: 2 } as const;
export const FUNKEN = { zusatz: 1, abzeichen: 3 } as const;
export const PREIS = { giessen: 2, seltenesPaket: 150, extraPaket: 300, gadget: 200 } as const;
/** Gießen geht erst, wenn die Erde unter diesen Wert getrocknet ist – etwa einmal in der Woche. */
export const GIESSEN_AB = 70;
/** So viel trocknet die Erde an einem Arbeitstag im Betrieb. */
export const VERLUST_JE_TAG = 7;
const WUCHS = { normal: 25, lampe: 35, duenger: 20 } as const;
const BOOSTER_TAGE = 14;

export const BOOSTER = {
  lampe: { name: 'Pflanzenlampe', preis: 2, text: 'Mehr Licht: Jedes Gießen bringt mehr Wachstum. Hält 2 Wochen.' },
  nebel: { name: 'Luftbefeuchter', preis: 2, text: 'Feuchte Luft: Die Erde trocknet langsamer. Hält 2 Wochen.' },
  duenger: { name: 'Dünger', preis: 1, text: 'Sofort ein Schub Wachstum.' },
} as const;
export type Booster = keyof typeof BOOSTER;

export const GADGETS = {
  docht: { name: 'Bewässerungsdocht', text: 'Die Erde trocknet nur noch halb so schnell.', meilenstein: 'probezeit' },
  kalender: { name: 'Pflanzenkalender', text: 'Dein Begleiter sagt dir, wenn eine Pflanze Durst hat.', meilenstein: 'jahr1' },
  brett: { name: 'Viertes Regalbrett', text: 'Drei Plätze mehr für neue Pflanzen.', meilenstein: 'halbzeit' },
} as const;
export type Gadget = keyof typeof GADGETS;

export const SORTEN = { gruen: 'Grünpflanzen', bluete: 'Blühpflanzen', haenge: 'Hängepflanzen' } as const;
type Sorte = keyof typeof SORTEN;
type Seltenheit = 'gewoehnlich' | 'selten' | 'besonders' | 'legendaer';

/** Die Pflanzen – selbst ausgedacht und selbst gezeichnet (Zeichnung in src/vault/pflanzen.tsx). */
export const ARTEN: Record<string, { name: string; sorte: Sorte | null; seltenheit: Seltenheit }> = {
  efeutute: { name: 'Efeutute', sorte: 'gruen', seltenheit: 'gewoehnlich' },
  bogenhanf: { name: 'Bogenhanf', sorte: 'gruen', seltenheit: 'gewoehnlich' },
  gluecksfeder: { name: 'Glücksfeder', sorte: 'gruen', seltenheit: 'gewoehnlich' },
  gummibaum: { name: 'Gummibaum', sorte: 'gruen', seltenheit: 'gewoehnlich' },
  usambara: { name: 'Usambaraveilchen', sorte: 'bluete', seltenheit: 'gewoehnlich' },
  flamingo: { name: 'Flamingoblume', sorte: 'bluete', seltenheit: 'gewoehnlich' },
  friedenslilie: { name: 'Friedenslilie', sorte: 'bluete', seltenheit: 'gewoehnlich' },
  efeuranke: { name: 'Efeuranke', sorte: 'haenge', seltenheit: 'gewoehnlich' },
  erbsenranke: { name: 'Erbsenranke', sorte: 'haenge', seltenheit: 'gewoehnlich' },
  tradeskantie: { name: 'Tradeskantie', sorte: 'haenge', seltenheit: 'gewoehnlich' },
  orchidee: { name: 'Orchidee', sorte: null, seltenheit: 'selten' },
  maranta: { name: 'Silberstreifen-Maranta', sorte: null, seltenheit: 'selten' },
  schildfarn: { name: 'Schildfarn', sorte: null, seltenheit: 'selten' },
  mondfarn: { name: 'Mondfarn', sorte: null, seltenheit: 'besonders' },
  silberranke: { name: 'Silberranke', sorte: null, seltenheit: 'besonders' },
  glutfarn: { name: 'Glutfarn', sorte: null, seltenheit: 'legendaer' },
  sternorchidee: { name: 'Sternorchidee', sorte: null, seltenheit: 'legendaer' },
};

// ---------- Hilfen ----------

export function vaultErlaubt(db: DB): boolean {
  return (db.prepare("SELECT wert FROM einstellungen WHERE schluessel = 'vault_an'").get() as { wert: string } | undefined)?.wert === '1';
}

interface RegalZeile {
  an: number;
  tropfen_aus: number;
  funken_aus: number;
  karten: number;
  lern_max: number;
  funken_max: number;
  pakete: number;
  gadgets: string;
  vorrat: string;
  spiele: string;
}
interface PflanzenZeile {
  id: number;
  platz: number;
  art: string;
  stufe: number;
  wuchs: number;
  gegossen: string;
  booster: string;
  booster_bis: string | null;
}

const holeRegal = (db: DB, azubi: number) => db.prepare('SELECT an, tropfen_aus, funken_aus, karten, lern_max, funken_max, pakete, gadgets, vorrat, spiele FROM regal WHERE azubi_id = ?').get(azubi) as RegalZeile | undefined;
const pflanzenVon = (db: DB, azubi: number) => db.prepare('SELECT id, platz, art, stufe, wuchs, gegossen, booster, booster_bis FROM regal_pflanze WHERE azubi_id = ? ORDER BY platz').all(azubi) as unknown as PflanzenZeile[];

function vorratVon(z: RegalZeile): Record<Booster, number> {
  let roh: Record<string, unknown> = {};
  try {
    roh = JSON.parse(z.vorrat) as Record<string, unknown>;
  } catch {
    roh = {};
  }
  const n = (x: unknown) => (typeof x === 'number' && Number.isInteger(x) && x > 0 ? x : 0);
  return { lampe: n(roh.lampe), nebel: n(roh.nebel), duenger: n(roh.duenger) };
}

/** Meilensteine aus der Ausbildungszeit: Start, Probezeit (4 Monate), jedes Ausbildungsjahr, Halbzeit, Abschluss. */
export function meilensteine(beginn: string | null, ende: string | null): { id: string; name: string; am: string | null }[] {
  const liste: { id: string; name: string; am: string | null }[] = [{ id: 'start', name: 'Start', am: null }];
  if (!beginn || !ende || ende <= beginn) return liste;
  liste.push({ id: 'probezeit', name: 'Probezeit geschafft', am: plusMonate(beginn, 4) });
  for (let n = 1; n < 6; n++) {
    const am = plusMonate(beginn, 12 * n);
    if (am >= ende) break;
    liste.push({ id: `jahr${n}`, name: `${n}. Ausbildungsjahr geschafft`, am });
  }
  const mitte = plusTage(beginn, Math.round((Date.parse(ende) - Date.parse(beginn)) / 86_400_000 / 2));
  liste.push({ id: 'halbzeit', name: 'Halbzeit der Ausbildung', am: mitte });
  liste.push({ id: 'ende', name: 'Ausbildung geschafft', am: ende });
  return liste.sort((a, b) => (a.am ?? '').localeCompare(b.am ?? ''));
}

/** Tage, an denen die Erde austrocknet: Arbeitstage im Betrieb zwischen „gegossen“ (ausschließlich) und heute. */
function trockenTage(db: DB, azubi: number, von: string, bis: string): string[] {
  if (von >= bis) return [];
  const start = plusTage(von, 1);
  // höchstens acht Wochen zurück – danach ist die Erde ohnehin trocken
  const ab = start < plusTage(bis, -56) ? plusTage(bis, -56) : start;
  const ruhe = new Set(genehmigteTage(db, azubi, ab, bis));
  // Berufsschule steht im Plan wochenweise: von und bis sind Montage
  const schule = db.prepare("SELECT von, bis FROM plan_eintrag WHERE azubi_id = ? AND art = 'schule' AND von <= ? AND bis >= ?").all(azubi, montagVon(bis), montagVon(ab)) as unknown as { von: string; bis: string }[];
  for (const b of db.prepare('SELECT inhalt FROM bericht WHERE azubi_id = ? AND montag >= ? AND montag <= ?').all(azubi, montagVon(ab), bis) as unknown as { inhalt: string }[]) {
    try {
      const i = JSON.parse(b.inhalt) as { abwesenheit?: { tag?: unknown }[] };
      for (const a of i.abwesenheit ?? []) if (typeof a.tag === 'string') ruhe.add(a.tag);
    } catch {
      // ein kaputter Bericht hält die Pflanzen nicht auf
    }
  }
  return arbeitstage(db, ab, bis).filter((t) => !ruhe.has(t) && !schule.some((s) => s.von <= montagVon(t) && s.bis >= montagVon(t)));
}

function feuchteVon(db: DB, azubi: number, p: PflanzenZeile, tag: string, docht: boolean): number {
  let verlust = 0;
  for (const t of trockenTage(db, azubi, p.gegossen, tag)) {
    let v = VERLUST_JE_TAG * (docht ? 0.5 : 1);
    if (p.booster === 'nebel' && p.booster_bis && t <= p.booster_bis) v *= 0.7;
    verlust += v;
  }
  return Math.max(0, Math.round(100 - verlust));
}

/** Wie viele Tropfen und Funken – aus dem errechnet, was ohnehin gespeichert ist. */
function guthaben(db: DB, azubi: number, r: RegalZeile) {
  const berichte = (db.prepare("SELECT COUNT(*) AS n FROM bericht WHERE azubi_id = ? AND status IN ('eingereicht', 'abgezeichnet')").get(azubi) as { n: number }).n;
  const ampel = db.prepare("SELECT SUM(CASE status WHEN 'gelb' THEN ? WHEN 'gruen' THEN ? ELSE 0 END) AS n FROM lern_status WHERE azubi_id = ?").get(TROPFEN.gelb, TROPFEN.gelb + TROPFEN.gruen, azubi) as { n: number | null };
  const quiz = (db.prepare('SELECT COUNT(*) AS n FROM lern_quiz WHERE azubi_id = ? AND bestanden_am IS NOT NULL').get(azubi) as { n: number }).n;
  // Höchststand je Quelle, die zurückgehen kann: eine Ampel, die wieder auf Rot steht, nimmt keine Tropfen weg
  const ausAmpel = Math.max(r.lern_max, ampel.n ?? 0);
  const lern = ausAmpel + quiz * TROPFEN.quiz;
  const zusatz = (db.prepare('SELECT COUNT(*) AS n FROM lern_zusatz WHERE azubi_id = ?').get(azubi) as { n: number }).n;
  const stufen = (db.prepare('SELECT SUM(stufe) AS n FROM lern_abzeichen WHERE azubi_id = ?').get(azubi) as { n: number | null }).n ?? 0;
  const ausZusatz = Math.max(r.funken_max, zusatz * FUNKEN.zusatz);
  const funken = ausZusatz + stufen * FUNKEN.abzeichen;
  if (ausAmpel > r.lern_max || ausZusatz > r.funken_max) db.prepare('UPDATE regal SET lern_max = ?, funken_max = ? WHERE azubi_id = ?').run(ausAmpel, ausZusatz, azubi);
  const ausBerichten = berichte * TROPFEN.bericht;
  const ausKarten = r.karten * TROPFEN.karte;
  // Lernspiele: einmal je Spiel und Themenfeld
  const ausSpielen = r.spiele.split(',').filter(Boolean).length * TROPFEN.spiel;
  return {
    tropfen: Math.max(0, ausBerichten + lern + ausKarten + ausSpielen - r.tropfen_aus),
    funken: Math.max(0, funken - r.funken_aus),
    herkunft: { berichte: ausBerichten, lernen: lern, karten: ausKarten, spiele: ausSpielen, funken },
  };
}

/** Ein Berichtsheft-Gewächs je Ausbildungsjahr: ein Blatt je eingereichtem Bericht, Lücken sind vergangene Wochen ohne. */
function gewaechse(db: DB, azubi: number, beginn: string, ende: string, tag: string) {
  const status = new Map((db.prepare('SELECT montag, status FROM bericht WHERE azubi_id = ?').all(azubi) as unknown as { montag: string; status: string }[]).map((z) => [z.montag, z.status]));
  const diese = montagVon(tag);
  const liste: { jahr: number; blaetter: number; luecken: number }[] = [];
  for (let n = 0; n < 6; n++) {
    const von = plusMonate(beginn, 12 * n);
    if (von >= ende || von > tag) break;
    const bis = plusTage(plusMonate(beginn, 12 * (n + 1)), -1);
    let blaetter = 0;
    let luecken = 0;
    for (let m = montagVon(von); m <= (bis < ende ? bis : ende) && m <= diese; m = plusTage(m, 7)) {
      const s = status.get(m);
      if (s === 'eingereicht' || s === 'abgezeichnet') blaetter++;
      else if (m < diese) luecken++;
    }
    liste.push({ jahr: n + 1, blaetter, luecken });
  }
  return liste;
}

function ansicht(k: Kontext, azubi: number) {
  const erlaubt = vaultErlaubt(k.db);
  const r = holeRegal(k.db, azubi);
  if (!erlaubt || !r) return { erlaubt, angelegt: !!r, an: r?.an === 1 };
  return voll(k, azubi, r);
}

/** Das ganze Regal – nur wenn es angelegt ist. */
function voll(k: Kontext, azubi: number, r: RegalZeile) {
  const { db } = k;
  const tag = heute(k.jetzt());
  const erlaubt = true;
  const dauer = dauerVon(db, leseProfil(db, azubi));
  const ms = meilensteine(dauer?.beginn ?? null, dauer?.ende ?? null);
  const erreicht = ms.filter((m) => m.am === null || m.am <= tag);
  const gekauft = r.gadgets.split(',').filter((g) => g in GADGETS) as Gadget[];
  const hat = (g: Gadget) => gekauft.includes(g) || erreicht.some((m) => m.id === GADGETS[g].meilenstein);
  const g = guthaben(db, azubi, r);
  const plaetze = hat('brett') ? 12 : 9;
  const pflanzen = pflanzenVon(db, azubi).map((p) => {
    const feuchte = feuchteVon(db, azubi, p, tag, hat('docht'));
    const booster = p.booster && p.booster_bis && p.booster_bis >= tag ? { art: p.booster, bis: p.booster_bis } : null;
    return { id: p.id, platz: p.platz, art: p.art, name: ARTEN[p.art]?.name ?? p.art, seltenheit: ARTEN[p.art]?.seltenheit ?? 'gewoehnlich', stufe: p.stufe, wuchs: p.stufe === 4 ? 100 : p.wuchs, feuchte, giessbar: feuchte < GIESSEN_AB, booster };
  });
  const naechster = ms.find((m) => m.am !== null && m.am > tag) ?? null;
  return {
    erlaubt,
    angelegt: true,
    an: r.an === 1,
    tropfen: g.tropfen,
    funken: g.funken,
    herkunft: g.herkunft,
    plaetze,
    pflanzen,
    gewaechse: dauer ? gewaechse(db, azubi, dauer.beginn, dauer.ende, tag) : [],
    vorrat: vorratVon(r),
    gadgets: (Object.keys(GADGETS) as Gadget[]).map((id) => ({ id, ...GADGETS[id], meilensteinName: ms.find((m) => m.id === GADGETS[id].meilenstein)?.name ?? null, hat: hat(id) })),
    booster: (Object.keys(BOOSTER) as Booster[]).map((id) => ({ id, ...BOOSTER[id] })),
    pakete: erreicht.length - r.pakete,
    meilensteine: ms.map((m) => ({ ...m, erreicht: m.am === null || m.am <= tag })),
    naechster,
    ohneZeit: dauer === null,
    regeln: { tropfen: TROPFEN, funken: FUNKEN, preis: PREIS, giessenAb: GIESSEN_AB },
  };
}

function meinRegal(c: Ctx): RegalZeile {
  if (!vaultErlaubt(c.k.db)) throw new Fehler(409, 'Der Game Vault ist für dieses Portal ausgeschaltet');
  const r = holeRegal(c.k.db, c.b.id);
  if (!r || r.an !== 1) throw new Fehler(409, 'Leg zuerst dein Regal an');
  return r;
}

function meinePflanze(c: Ctx): PflanzenZeile {
  const id = idAus(c.p.id);
  const p = c.k.db.prepare('SELECT id, platz, art, stufe, wuchs, gegossen, booster, booster_bis FROM regal_pflanze WHERE id = ? AND azubi_id = ?').get(id, c.b.id) as PflanzenZeile | undefined;
  // eine fremde Pflanze gibt es für dich nicht
  if (!p) throw new Fehler(404, 'Diese Pflanze gibt es nicht');
  return p;
}

/** Stufe und Wuchs nach einem Schub Wachstum. */
function wachse(p: { stufe: number; wuchs: number }, plus: number) {
  let { stufe, wuchs } = p;
  if (stufe >= 4) return { stufe: 4, wuchs: 0, gewachsen: false };
  wuchs += plus;
  let gewachsen = false;
  while (wuchs >= 100 && stufe < 4) {
    stufe++;
    wuchs -= 100;
    gewachsen = true;
  }
  return { stufe, wuchs: stufe === 4 ? 0 : wuchs, gewachsen };
}

function freierPlatz(db: DB, azubi: number, plaetze: number): number {
  const belegt = new Set(pflanzenVon(db, azubi).map((p) => p.platz));
  for (let i = 0; i < plaetze; i++) if (!belegt.has(i)) return i;
  throw new Fehler(409, 'Im Regal ist kein Platz frei');
}

function zieheArt(db: DB, azubi: number, auswahl: string[]): string {
  const da = new Set(pflanzenVon(db, azubi).map((p) => p.art));
  const neu = auswahl.filter((a) => !da.has(a));
  const pool = neu.length ? neu : auswahl;
  return pool[randomInt(pool.length)];
}

/** Fällige Karteikarte wiederholt: zählt fürs Regal – nur die Zahl, ohne Datum, und nur bei angelegtem Regal.
 * (Dieselbe Abfrage steht in PATCH /api/lernen/karte – dort ohne Import, damit kein Kreis entsteht.) */
export function karteWiederholt(db: DB, azubi: number): void {
  db.prepare('UPDATE regal SET karten = karten + 1 WHERE azubi_id = ? AND an = 1').run(azubi);
}

/** Für den Begleiter (mit Pflanzenkalender): Haben Pflanzen Durst? */
export function durstigePflanzen(k: Kontext, azubi: number): number {
  if (!vaultErlaubt(k.db)) return 0;
  const r = holeRegal(k.db, azubi);
  if (!r || r.an !== 1) return 0;
  const v = voll(k, azubi, r);
  if (!v.gadgets.find((g) => g.id === 'kalender')?.hat) return 0;
  return v.pflanzen.filter((p) => p.feuchte < 50).length;
}

export const REGAL_ROUTEN: Route[] = [
  { m: 'GET', p: '/api/regal', wer: ['azubi'], h: (c) => ({ status: 200, body: ansicht(c.k, c.b.id) }) },

  {
    // Regal anlegen: mit dem ersten Samenpaket (Start) und dem Berichtsheft-Gewächs, das von selbst da ist
    m: 'POST',
    p: '/api/regal',
    wer: ['azubi'],
    h: (c) => {
      if (!vaultErlaubt(c.k.db)) throw new Fehler(409, 'Der Game Vault ist für dieses Portal ausgeschaltet');
      c.k.db.prepare('INSERT INTO regal (azubi_id, an) VALUES (?, 1) ON CONFLICT(azubi_id) DO UPDATE SET an = 1').run(c.b.id);
      return { status: 200, body: ansicht(c.k, c.b.id) };
    },
  },

  {
    // ausblenden (bleibt gespeichert) oder wieder zeigen
    m: 'PUT',
    p: '/api/regal',
    wer: ['azubi'],
    h: (c) => {
      const an = koerper(c).an;
      if (typeof an !== 'boolean') throw new Fehler(400, 'Angabe „an“ fehlt');
      const r = c.k.db.prepare('UPDATE regal SET an = ? WHERE azubi_id = ?').run(an ? 1 : 0, c.b.id);
      if (r.changes === 0) throw new Fehler(404, 'Du hast noch kein Regal');
      return { status: 200, body: ansicht(c.k, c.b.id) };
    },
  },

  {
    // alles löschen: Regal, Pflanzen, Vorrat
    m: 'DELETE',
    p: '/api/regal',
    wer: ['azubi'],
    h: (c) => {
      c.k.db.prepare('DELETE FROM regal_pflanze WHERE azubi_id = ?').run(c.b.id);
      c.k.db.prepare('DELETE FROM regal WHERE azubi_id = ?').run(c.b.id);
      return { status: 200, body: ansicht(c.k, c.b.id) };
    },
  },

  {
    m: 'POST',
    p: '/api/regal/pflanzen/:id/giessen',
    wer: ['azubi'],
    h: (c) => {
      const r = meinRegal(c);
      const p = meinePflanze(c);
      const tag = heute(c.k.jetzt());
      const v = voll(c.k, c.b.id, r);
      const jetzt = v.pflanzen.find((x) => x.id === p.id);
      if (!jetzt?.giessbar) throw new Fehler(409, `Die Erde ist noch feucht genug – gießen geht ab ${GIESSEN_AB} % und weniger`);
      if (v.tropfen < PREIS.giessen) throw new Fehler(409, 'Dafür hast du zu wenig Tropfen');
      const lampe = p.booster === 'lampe' && !!p.booster_bis && p.booster_bis >= tag;
      const n = wachse(p, lampe ? WUCHS.lampe : WUCHS.normal);
      c.k.db.prepare('UPDATE regal_pflanze SET gegossen = ?, stufe = ?, wuchs = ? WHERE id = ?').run(tag, n.stufe, n.wuchs, p.id);
      c.k.db.prepare('UPDATE regal SET tropfen_aus = tropfen_aus + ? WHERE azubi_id = ?').run(PREIS.giessen, c.b.id);
      return { status: 200, body: { ...ansicht(c.k, c.b.id), gewachsen: n.gewachsen } };
    },
  },

  {
    // einen Booster aus dem Vorrat geben
    m: 'POST',
    p: '/api/regal/pflanzen/:id/booster',
    wer: ['azubi'],
    h: (c) => {
      const r = meinRegal(c);
      const p = meinePflanze(c);
      const art = koerper(c).art;
      if (typeof art !== 'string' || !(art in BOOSTER)) throw new Fehler(400, 'Diesen Booster gibt es nicht');
      const vorrat = vorratVon(r);
      if (vorrat[art as Booster] < 1) throw new Fehler(409, 'Diesen Booster hast du nicht im Vorrat');
      const tag = heute(c.k.jetzt());
      vorrat[art as Booster]--;
      let gewachsen = false;
      if (art === 'duenger') {
        const n = wachse(p, WUCHS.duenger);
        gewachsen = n.gewachsen;
        c.k.db.prepare('UPDATE regal_pflanze SET stufe = ?, wuchs = ? WHERE id = ?').run(n.stufe, n.wuchs, p.id);
      } else {
        if (p.booster && p.booster_bis && p.booster_bis >= tag) throw new Fehler(409, 'Diese Pflanze hat schon einen Booster');
        c.k.db.prepare('UPDATE regal_pflanze SET booster = ?, booster_bis = ? WHERE id = ?').run(art, plusTage(tag, BOOSTER_TAGE - 1), p.id);
      }
      c.k.db.prepare('UPDATE regal SET vorrat = ? WHERE azubi_id = ?').run(JSON.stringify(vorrat), c.b.id);
      return { status: 200, body: { ...ansicht(c.k, c.b.id), gewachsen } };
    },
  },

  {
    // Pflanze weggeben – der Platz wird frei
    m: 'DELETE',
    p: '/api/regal/pflanzen/:id',
    wer: ['azubi'],
    h: (c) => {
      meinRegal(c);
      const p = meinePflanze(c);
      c.k.db.prepare('DELETE FROM regal_pflanze WHERE id = ?').run(p.id);
      return { status: 200, body: ansicht(c.k, c.b.id) };
    },
  },

  {
    // in der Gärtnerei: Booster mit Funken, Gadgets mit Tropfen
    m: 'POST',
    p: '/api/regal/kaufen',
    wer: ['azubi'],
    h: (c) => {
      const r = meinRegal(c);
      const was = koerper(c).was;
      const v = voll(c.k, c.b.id, r);
      if (typeof was === 'string' && was in BOOSTER) {
        const b = BOOSTER[was as Booster];
        if (v.funken < b.preis) throw new Fehler(409, 'Dafür hast du zu wenig Funken');
        const vorrat = vorratVon(r);
        vorrat[was as Booster]++;
        c.k.db.prepare('UPDATE regal SET funken_aus = funken_aus + ?, vorrat = ? WHERE azubi_id = ?').run(b.preis, JSON.stringify(vorrat), c.b.id);
      } else if (typeof was === 'string' && was in GADGETS) {
        if (v.gadgets.find((g) => g.id === was)?.hat) throw new Fehler(409, 'Das hast du schon');
        if (v.tropfen < PREIS.gadget) throw new Fehler(409, 'Dafür hast du zu wenig Tropfen');
        const liste = r.gadgets.split(',').filter(Boolean).concat(was).join(',');
        c.k.db.prepare('UPDATE regal SET tropfen_aus = tropfen_aus + ?, gadgets = ? WHERE azubi_id = ?').run(PREIS.gadget, liste, c.b.id);
      } else throw new Fehler(400, 'Das gibt es in der Gärtnerei nicht');
      return { status: 200, body: ansicht(c.k, c.b.id) };
    },
  },

  {
    // Samenpaket öffnen: aus einem Meilenstein (oder für Tropfen gekauft); seltene Pakete gegen gesparte Tropfen
    m: 'POST',
    p: '/api/regal/paket',
    wer: ['azubi'],
    h: (c) => {
      const r = meinRegal(c);
      const b = koerper(c);
      const selten = b.selten === true;
      const kauf = b.kauf === true;
      const sorte = b.sorte;
      if (!selten && (typeof sorte !== 'string' || !(sorte in SORTEN))) throw new Fehler(400, 'Such dir eine Sorte aus');
      const v = voll(c.k, c.b.id, r);
      if (!kauf && v.pakete < 1) throw new Fehler(409, 'Gerade wartet kein Samenpaket – das nächste gibt es beim nächsten Meilenstein');
      const preis = (kauf ? PREIS.extraPaket : 0) + (selten ? PREIS.seltenesPaket : 0);
      if (v.tropfen < preis) throw new Fehler(409, 'Dafür hast du zu wenig Tropfen');
      const platz = freierPlatz(c.k.db, c.b.id, v.plaetze);
      let auswahl: string[];
      if (selten) {
        const w = randomInt(100);
        const s: Seltenheit = w < 5 ? 'legendaer' : w < 40 ? 'besonders' : 'selten';
        auswahl = Object.keys(ARTEN).filter((a) => ARTEN[a].seltenheit === s);
      } else auswahl = Object.keys(ARTEN).filter((a) => ARTEN[a].sorte === sorte);
      const art = zieheArt(c.k.db, c.b.id, auswahl);
      const tag = heute(c.k.jetzt());
      const neu = c.k.db.prepare('INSERT INTO regal_pflanze (azubi_id, platz, art, gegossen) VALUES (?, ?, ?, ?)').run(c.b.id, platz, art, tag);
      c.k.db.prepare('UPDATE regal SET tropfen_aus = tropfen_aus + ?, pakete = pakete + ? WHERE azubi_id = ?').run(preis, kauf ? 0 : 1, c.b.id);
      return { status: 200, body: { ...ansicht(c.k, c.b.id), neu: { id: Number(neu.lastInsertRowid), art, name: ARTEN[art].name, seltenheit: ARTEN[art].seltenheit } } };
    },
  },

  // Schalter für das ganze Portal – nur der Super-Admin. Er sieht dabei nichts über einzelne Azubis.
  { m: 'GET', p: '/api/regal/einstellung', wer: ['admin'], h: (c) => ({ status: 200, body: { an: vaultErlaubt(c.k.db) } }) },
  {
    m: 'PUT',
    p: '/api/regal/einstellung',
    wer: ['admin'],
    h: (c) => {
      const an = koerper(c).an;
      if (typeof an !== 'boolean') throw new Fehler(400, 'Angabe „an“ fehlt');
      c.k.db.prepare("INSERT INTO einstellungen (schluessel, wert) VALUES ('vault_an', ?) ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert").run(an ? '1' : '0');
      protokolliere(c.k.db, c.k.jetzt(), 'konto', an ? 'vault_eingeschaltet' : 'vault_ausgeschaltet', c.b, null);
      return { status: 200, body: { an } };
    },
  },
];
