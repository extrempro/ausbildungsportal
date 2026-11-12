import { genehmigteTage } from './urlaub';
import { berichtsheftPdf } from './bericht-pdf';
import type { BerichtFuerPdf } from './bericht-pdf';
import { leseLogo } from './branding';
import { merkeAktivitaet } from './aktivitaet';
import { Fehler, holeBenutzer, idAus, istObjekt, koerper } from './api-basis';
import type { Ctx, Route } from './api-basis';
import type { DB } from './db';
import { transaktion } from './db';
import { heute } from './datum';
import { feiertageZwischen, istBundesland } from './feiertage';
import { ausbildungsjahrAm, gueltigesDatum, istMontag, kalenderwoche, montagVon, plusTage } from './kalender';
import { planDerWoche } from './plan';
import { darfAbzeichnen, darfAzubiVerwalten, sichtbareAzubis } from './rechte';
import { dauerVon, FACH, leseBetrieb, leseProfil, sichtbarerAzubi, standAus } from './stammdaten';
import { bildPfad } from './typen';
import type { BenutzerZeile } from './typen';

/**
 * Berichtsheft: ein Ausbildungsnachweis je Azubi und Kalenderwoche.
 * Ablauf: Entwurf → eingereicht → abgezeichnet; oder mit Kommentar zurück an den Azubi.
 * Nur der Azubi schreibt; abzeichnen dürfen Ausbilder und – im Zeitraum ihrer Zuweisung – Beauftragte.
 * Jeder Schritt steht im Verlauf des Berichts (bericht_verlauf), den nur die Beteiligten sehen –
 * bewusst nicht im Protokoll des Super-Admins.
 *
 * Zwei Formen, wählbar in den Stammdaten des Betriebs:
 * - „woche“: Tätigkeiten der ganzen Woche in drei Teilen (Betrieb, Unterweisung, Berufsschule).
 * - „tag“: dieselben Teile, aber jeder Eintrag gehört zu einem Tag – geschrieben, angezeigt und gedruckt wird nach Tagen.
 * Die Form steht im Bericht selbst. Ein einmal gespeicherter Bericht behält seine Form, auch wenn der Betrieb später umstellt.
 */
export type BerichtStatus = 'entwurf' | 'eingereicht' | 'zurueck' | 'abgezeichnet';
const GRUENDE = ['urlaub', 'krank', 'feiertag', 'sonstiges'] as const;
type Grund = (typeof GRUENDE)[number];

export const BERICHT_FORMEN = ['woche', 'tag'] as const;
export type BerichtForm = (typeof BERICHT_FORMEN)[number];

export interface Eintrag {
  text: string;
  stunden: number;
  /** nur in der Tagesform: der Tag (JJJJ-MM-TT) innerhalb der Berichtswoche */
  tag?: string;
}
export interface Abwesenheit {
  tag: string;
  grund: Grund;
  stunden: number;
  text: string;
}
export interface Inhalt {
  form: BerichtForm;
  betrieb: Eintrag[];
  unterweisung: Eintrag[];
  schule: Eintrag[];
  abwesenheit: Abwesenheit[];
}

interface BerichtZeile {
  azubi_id: number;
  montag: string;
  status: BerichtStatus;
  inhalt: string;
  kommentar: string;
  eingereicht_am: string | null;
  abgezeichnet_am: string | null;
  abgezeichnet_von: number | null;
  geaendert: string;
}

const MAX_EINTRAEGE = 30;
const MAX_TEXT = 2000;
export const MAX_PFAD = 60_000;
// Unterschrift: nur „Bewegen“ und „Linie“ mit Zahlen – kein Platz für Skripte oder fremde SVG-Befehle
const PFAD = /^[ML0-9 .-]+$/;

// ---------- Inhalt prüfen und rechnen ----------

function leererInhalt(form: BerichtForm = 'woche'): Inhalt {
  return { form, betrieb: [], unterweisung: [], schule: [], abwesenheit: [] };
}

function stunden(x: unknown, feld: string): number {
  const n = typeof x === 'number' ? x : typeof x === 'string' && x.trim() !== '' ? Number(x.replace(',', '.')) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 60) throw new Fehler(400, `${feld}: Stunden müssen zwischen 0 und 60 liegen`);
  return Math.round(n * 4) / 4; // Viertelstunden
}

function freitext(x: unknown, max: number, feld: string): string {
  const s = typeof x === 'string' ? x.replace(/\r\n?/g, '\n').trim() : '';
  if (s.length > max) throw new Fehler(400, `${feld} ist zu lang (höchstens ${max} Zeichen)`);
  // Zeilenumbrüche sind erlaubt, andere Steuerzeichen nicht
  if (/[\u0000-\u0009\u000b-\u001f\u007f]/.test(s)) throw new Fehler(400, `${feld} enthält unzulässige Zeichen`);
  return s;
}

function pruefeEintraege(x: unknown, feld: string, woche: { montag: string; sonntag: string } | null): Eintrag[] {
  if (x === undefined || x === null) return [];
  if (!Array.isArray(x) || x.length > MAX_EINTRAEGE) throw new Fehler(400, `${feld}: höchstens ${MAX_EINTRAEGE} Einträge`);
  const liste = x
    .map((e): Eintrag => {
      if (!istObjekt(e)) throw new Fehler(400, `${feld}: ungültiger Eintrag`);
      const eintrag: Eintrag = { text: freitext(e.text, MAX_TEXT, feld), stunden: stunden(e.stunden ?? 0, feld) };
      if (!woche) return eintrag;
      // Tagesform: jeder Eintrag gehört zu einem Tag der Berichtswoche
      if (!gueltigesDatum(e.tag) || e.tag < woche.montag || e.tag > woche.sonntag) throw new Fehler(400, `${feld}: Der Tag muss in der Berichtswoche liegen`);
      return { ...eintrag, tag: e.tag };
    })
    .filter((e) => e.text || e.stunden > 0);
  // Reihenfolge innerhalb eines Tages bleibt, wie sie geschrieben wurde
  return woche ? liste.map((e, i) => ({ e, i })).sort((a, b) => (a.e.tag as string).localeCompare(b.e.tag as string) || a.i - b.i).map((x) => x.e) : liste;
}

/** Prüft den Inhalt. Die Form gibt der Server vor (gespeicherter Bericht oder Einstellung des Betriebs) – nicht die Anfrage. */
export function pruefeInhalt(roh: unknown, montag: string, form: BerichtForm = 'woche'): Inhalt {
  if (!istObjekt(roh)) throw new Fehler(400, 'Inhalt des Berichts fehlt');
  const sonntag = plusTage(montag, 6);
  const woche = form === 'tag' ? { montag, sonntag } : null;
  const liste = roh.abwesenheit ?? [];
  if (!Array.isArray(liste) || liste.length > 14) throw new Fehler(400, 'Abwesenheit: zu viele Einträge');
  const abwesenheit = liste.map((a): Abwesenheit => {
    if (!istObjekt(a)) throw new Fehler(400, 'Abwesenheit: ungültiger Eintrag');
    if (!gueltigesDatum(a.tag) || a.tag < montag || a.tag > sonntag) throw new Fehler(400, 'Abwesenheit: Der Tag muss in der Berichtswoche liegen');
    if (!GRUENDE.includes(a.grund as Grund)) throw new Fehler(400, 'Abwesenheit: unbekannter Grund');
    return { tag: a.tag, grund: a.grund as Grund, stunden: stunden(a.stunden ?? 0, 'Abwesenheit'), text: freitext(a.text, 200, 'Abwesenheit') };
  });
  abwesenheit.sort((a, b) => a.tag.localeCompare(b.tag));
  return {
    form,
    betrieb: pruefeEintraege(roh.betrieb, 'Betriebliche Tätigkeiten', woche),
    unterweisung: pruefeEintraege(roh.unterweisung, 'Unterweisungen', woche),
    schule: pruefeEintraege(roh.schule, 'Berufsschule', woche),
    abwesenheit,
  };
}

export function summe(i: Inhalt) {
  const s = (l: { stunden: number }[]) => l.reduce((n, x) => n + x.stunden, 0);
  const teile = { betrieb: s(i.betrieb), unterweisung: s(i.unterweisung), schule: s(i.schule), abwesenheit: s(i.abwesenheit) };
  return { ...teile, gesamt: teile.betrieb + teile.unterweisung + teile.schule + teile.abwesenheit };
}

function inhaltAus(z: BerichtZeile): Inhalt {
  try {
    const i = JSON.parse(z.inhalt) as Partial<Inhalt>;
    // Berichte aus der Zeit vor der Tagesform tragen keine Form – sie sind Wochenberichte
    return { form: i.form === 'tag' ? 'tag' : 'woche', betrieb: i.betrieb ?? [], unterweisung: i.unterweisung ?? [], schule: i.schule ?? [], abwesenheit: i.abwesenheit ?? [] };
  } catch {
    return leererInhalt();
  }
}

/** Startwerte für einen neuen Bericht: landesweite Feiertage an Werktagen als Abwesenheit. */
function vorbelegung(db: DB, azubiId: number, montag: string, wochenstunden: number): Inhalt {
  const inhalt = leererInhalt(leseBetrieb(db).berichtForm);
  const tagSoll = Math.round((wochenstunden / 5) * 4) / 4;
  // genehmigter Urlaub der Woche ist schon als Abwesenheit vorgetragen
  const urlaub: Abwesenheit[] = genehmigteTage(db, azubiId, montag, plusTage(montag, 4)).map((tag) => ({ tag, grund: 'urlaub', stunden: tagSoll, text: '' }));
  const land = leseBetrieb(db).bundesland;
  const feiertage: Abwesenheit[] = istBundesland(land)
    ? feiertageZwischen(land, montag, plusTage(montag, 4))
        .filter((f) => !f.teilweise)
        .map((f) => ({ tag: f.datum, grund: 'feiertag', stunden: tagSoll, text: f.name }))
    : [];
  inhalt.abwesenheit = [...feiertage, ...urlaub].sort((a, b) => a.tag.localeCompare(b.tag));
  return inhalt;
}

// ---------- Lesen ----------

/**
 * Was jemand von einem Bericht sehen darf: Ein Entwurf gehört dem Azubi allein. Erst mit dem Einreichen sehen ihn
 * Ausbilder und Beauftragte; ein zurückgegebener Bericht bleibt für sie sichtbar (sie haben ihn schon gelesen).
 */
function sichtbar<T extends { status: string }>(z: T | undefined, eigener: boolean): T | undefined {
  return z && (eigener || z.status !== 'entwurf') ? z : undefined;
}

function holeBericht(db: DB, azubiId: number, montag: string): BerichtZeile | undefined {
  return db.prepare('SELECT * FROM bericht WHERE azubi_id = ? AND montag = ?').get(azubiId, montag) as BerichtZeile | undefined;
}

function montagAus(c: Ctx): string {
  if (!istMontag(c.p.montag)) throw new Fehler(404, 'Nicht gefunden');
  return c.p.montag;
}

/** Der Azubi selbst – nur er schreibt und reicht ein. Fremde IDs sehen aus wie unbekannte. */
function eigenerAzubi(c: Ctx): BenutzerZeile {
  if (c.b.rolle !== 'azubi' || idAus(c.p.id) !== c.b.id) throw new Fehler(404, 'Nicht gefunden');
  return c.b;
}

function vermerke(db: DB, jetzt: Date, azubiId: number, montag: string, aktion: string, wer: BenutzerZeile, kommentar = ''): void {
  db.prepare('INSERT INTO bericht_verlauf (azubi_id, montag, zeit, aktion, name, rolle, kommentar) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    azubiId,
    montag,
    jetzt.toISOString(),
    aktion,
    wer.anzeigename,
    wer.rolle,
    kommentar,
  );
}

function unterschriftVon(db: DB, benutzerId: number): string | null {
  return (db.prepare('SELECT pfad FROM unterschrift WHERE benutzer_id = ?').get(benutzerId) as { pfad: string } | undefined)?.pfad ?? null;
}

function unterzeichne(db: DB, jetzt: Date, azubiId: number, montag: string, art: 'azubi' | 'abzeichnung', wer: BenutzerZeile, pfad: string): void {
  db.prepare('DELETE FROM bericht_signatur WHERE azubi_id = ? AND montag = ? AND art = ?').run(azubiId, montag, art);
  db.prepare('INSERT INTO bericht_signatur (azubi_id, montag, art, name, rolle, pfad, zeit) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    azubiId,
    montag,
    art,
    wer.anzeigename,
    wer.rolle,
    pfad,
    jetzt.toISOString(),
  );
}

function wocheText(montag: string): string {
  const { kw, jahr } = kalenderwoche(montag);
  return `KW ${kw}/${jahr}`;
}

/** Alle Angaben zu einem Bericht, wie Einzelansicht und Druck sie brauchen. */
function berichtAnsicht(c: Ctx, azubi: BenutzerZeile, montag: string) {
  const { db } = c.k;
  const tag = heute(c.k.jetzt());
  const profil = leseProfil(db, azubi.id);
  const dauer = dauerVon(db, profil);
  const eigener = c.b.rolle === 'azubi' && c.b.id === azubi.id;
  // Entwürfe sieht nur der Azubi selbst – für alle anderen gibt es die Woche noch nicht
  const z = sichtbar(holeBericht(db, azubi.id, montag), eigener);
  const status = z?.status ?? null;
  const inhalt = z ? inhaltAus(z) : vorbelegung(db, azubi.id, montag, profil.wochenstunden);
  const zeichnet = darfAbzeichnen(db, c.b, azubi.id, montag);
  const { beruf } = standAus(db, profil, tag);
  const ausbilder = profil.ausbilderId ? holeBenutzer(db, profil.ausbilderId) : undefined;
  return {
    montag,
    sonntag: plusTage(montag, 6),
    ...kalenderwoche(montag),
    ausbildungsjahr: dauer ? ausbildungsjahrAm(dauer, montag) : null,
    status: status ?? 'fehlt',
    inhalt,
    summe: summe(inhalt),
    soll: profil.wochenstunden,
    kommentar: z?.kommentar ?? '',
    // was laut Ausbildungsplan in dieser Woche ansteht – als Gedankenstütze beim Schreiben
    plan: planDerWoche(db, azubi.id, montag, eigener),
    eingereichtAm: z?.eingereicht_am ?? null,
    abgezeichnetAm: z?.abgezeichnet_am ?? null,
    signaturen: z ? db.prepare('SELECT art, name, rolle, pfad, zeit FROM bericht_signatur WHERE azubi_id = ? AND montag = ? ORDER BY id').all(azubi.id, montag) : [],
    verlauf: z || eigener ? db.prepare('SELECT zeit, aktion, name, rolle, kommentar FROM bericht_verlauf WHERE azubi_id = ? AND montag = ? ORDER BY id').all(azubi.id, montag) : [],
    kopf: {
      azubi: azubi.anzeigename,
      beruf: beruf ? [beruf.bezeichnung, beruf.fachrichtung].filter(Boolean).join(' – ') : '',
      betrieb: leseBetrieb(db).name,
      ausbilder: ausbilder?.anzeigename ?? '',
    },
    rechte: {
      schreiben: eigener && !!dauer && (status === null || status === 'entwurf' || status === 'zurueck'),
      einreichen: eigener && (status === 'entwurf' || status === 'zurueck'),
      zurueckziehen: eigener && status === 'eingereicht',
      loeschen: eigener && status === 'entwurf',
      abzeichnen: zeichnet && status === 'eingereicht',
      oeffnen: status === 'abgezeichnet' && darfAzubiVerwalten(db, c.b, azubi.id),
    },
  };
}

/** Montage der Ausbildung bis zur laufenden Woche. */
function ausbildungswochen(beginn: string, ende: string, tag: string): string[] {
  const letzter = montagVon(ende < tag ? ende : tag);
  const wochen: string[] = [];
  for (let m = montagVon(beginn); m <= letzter && wochen.length < 400; m = plusTage(m, 7)) wochen.push(m);
  return wochen;
}

function pruefePfad(x: unknown): string {
  const pfad = typeof x === 'string' ? x.trim() : '';
  if (!pfad || pfad.length > MAX_PFAD || !PFAD.test(pfad) || !pfad.startsWith('M')) throw new Fehler(400, 'Die Unterschrift ist leer oder ungültig');
  // eine echte Unterschrift hat mehrere Punkte
  if ((pfad.match(/L/g) ?? []).length < 5) throw new Fehler(400, 'Die Unterschrift ist zu kurz – bitte im Feld unterschreiben');
  return pfad;
}

// ---------- Routen ----------

export const BERICHT_ROUTEN: Route[] = [
  {
    m: 'GET',
    p: '/api/ich/unterschrift',
    wer: FACH,
    h: (c) => ({ status: 200, body: { pfad: unterschriftVon(c.k.db, c.b.id) } }),
  },
  {
    m: 'PUT',
    p: '/api/ich/unterschrift',
    wer: FACH,
    h: (c) => {
      const pfad = pruefePfad(koerper(c).pfad);
      c.k.db
        .prepare('INSERT INTO unterschrift (benutzer_id, pfad, geaendert) VALUES (?, ?, ?) ON CONFLICT(benutzer_id) DO UPDATE SET pfad = excluded.pfad, geaendert = excluded.geaendert')
        .run(c.b.id, pfad, c.k.jetzt().toISOString());
      return { status: 200, body: { pfad } };
    },
  },
  {
    m: 'DELETE',
    p: '/api/ich/unterschrift',
    wer: FACH,
    h: (c) => {
      // schon geleistete Unterschriften auf Nachweisen bleiben als Kopie erhalten
      c.k.db.prepare('DELETE FROM unterschrift WHERE benutzer_id = ?').run(c.b.id);
      return { status: 200, body: { ok: true } };
    },
  },

  {
    // Berichtsheft als PDF: dieselben Berichte und Rechte wie die Liste mit „voll=1“, nur fertig als Datei
    m: 'GET',
    p: '/api/azubis/:id/berichtsheft.pdf',
    wer: FACH,
    h: (c) => {
      const { db } = c.k;
      const azubi = sichtbarerAzubi(c);
      const q = c.a.query;
      const woche = q.get('woche');
      if (woche !== null && (!gueltigesDatum(woche) || montagVon(woche) !== woche)) throw new Fehler(400, 'Die Woche ist ungültig');
      const jahrRoh = q.get('jahr');
      if (jahrRoh !== null && !/^[1-9]$/.test(jahrRoh)) throw new Fehler(400, 'Das Ausbildungsjahr ist ungültig');
      const jahr = jahrRoh === null ? null : Number(jahrRoh);
      const nurAbgezeichnete = q.get('nur') === 'abgezeichnet';
      const eigener = c.b.rolle === 'azubi' && c.b.id === azubi.id;
      const montage = (db.prepare('SELECT montag, status FROM bericht WHERE azubi_id = ? ORDER BY montag').all(azubi.id) as { montag: string; status: string }[]).filter((z) => sichtbar(z, eigener)).map((z) => z.montag);
      const berichte = montage
        .filter((m) => woche === null || m === woche)
        .map((m) => berichtAnsicht(c, azubi, m))
        .filter((b) => (!nurAbgezeichnete || b.status === 'abgezeichnet') && (jahr === null || b.ausbildungsjahr === jahr));
      if (berichte.length === 0) throw new Fehler(404, woche ? 'Für diese Woche gibt es keinen Bericht' : 'In dieser Auswahl gibt es keine Berichte');
      if (berichte.length > 400) throw new Fehler(400, 'Zu viele Berichte für ein Dokument – bitte ein Ausbildungsjahr wählen');
      // das Logo ist als Data-URL gespeichert; WebP kann das PDF nicht aufnehmen – dann entsteht es ohne Logo
      const logoUrl = leseLogo(db, 'hell');
      const logo = logoUrl ? Buffer.from(logoUrl.slice(logoUrl.indexOf(',') + 1), 'base64') : null;
      const einzeln = woche !== null;
      const inhalt = berichtsheftPdf({
        azubi: azubi.anzeigename,
        berichte: berichte as unknown as BerichtFuerPdf[],
        deckblatt: !einzeln && q.get('deckblatt') !== '0',
        ausbildungsjahr: jahr,
        nurAbgezeichnete,
        logo,
        jetzt: c.k.jetzt(),
      });
      const erster = berichte[0];
      const letzter = berichte[berichte.length - 1];
      const dateiname = einzeln ? `Ausbildungsnachweis ${azubi.anzeigename} KW ${erster.kw}-${erster.jahr}.pdf` : `Berichtsheft ${azubi.anzeigename} ${erster.montag} bis ${letzter.sonntag}.pdf`;
      return { status: 200, datei: { typ: 'application/pdf', inhalt, dateiname: dateiname.replace(/[\\/:*?"<>|]/g, '-') } };
    },
  },

  {
    m: 'GET',
    p: '/api/azubis/:id/berichte',
    wer: FACH,
    h: (c) => {
      const { db } = c.k;
      const azubi = sichtbarerAzubi(c);
      const tag = heute(c.k.jetzt());
      const profil = leseProfil(db, azubi.id);
      const dauer = dauerVon(db, profil);
      const eigener = c.b.rolle === 'azubi' && c.b.id === azubi.id;
      const vorhanden = new Map((db.prepare('SELECT * FROM bericht WHERE azubi_id = ?').all(azubi.id) as unknown as BerichtZeile[]).filter((z) => sichtbar(z, eigener)).map((z) => [z.montag, z]));
      // Wochen der Ausbildung bis heute, dazu alle vorhandenen Berichte (falls der Beginn später geändert wurde)
      const montage = new Set([...(dauer ? ausbildungswochen(dauer.beginn, dauer.ende, tag) : []), ...vorhanden.keys()]);
      const wochen = [...montage]
        .sort()
        .reverse()
        .map((montag) => {
          const z = vorhanden.get(montag);
          return {
            montag,
            sonntag: plusTage(montag, 6),
            ...kalenderwoche(montag),
            ausbildungsjahr: dauer ? ausbildungsjahrAm(dauer, montag) : null,
            status: z?.status ?? 'fehlt',
            stunden: z ? summe(inhaltAus(z)).gesamt : 0,
          };
        });
      // für den Druck aller Nachweise: vollständige Berichte, älteste zuerst
      const voll = c.a.query.get('voll') === '1' ? [...vorhanden.keys()].sort().map((montag) => berichtAnsicht(c, azubi, montag)) : undefined;
      return {
        status: 200,
        body: {
          azubi: { id: azubi.id, anzeigename: azubi.anzeigename },
          eigenes: c.b.id === azubi.id,
          beginnFehlt: !dauer,
          soll: profil.wochenstunden,
          wochen,
          ...(voll ? { berichte: voll } : {}),
        },
      };
    },
  },

  {
    m: 'GET',
    p: '/api/azubis/:id/berichte/:montag',
    wer: FACH,
    h: (c) => ({ status: 200, body: berichtAnsicht(c, sichtbarerAzubi(c), montagAus(c)) }),
  },

  {
    m: 'PUT',
    p: '/api/azubis/:id/berichte/:montag',
    wer: ['azubi'],
    h: (c) => {
      const { db } = c.k;
      const azubi = eigenerAzubi(c);
      const montag = montagAus(c);
      const dauer = dauerVon(db, leseProfil(db, azubi.id));
      if (!dauer) throw new Fehler(409, 'Für dich ist noch kein Ausbildungsbeginn eingetragen – bitte an den Ausbilder wenden');
      if (montag < montagVon(dauer.beginn) || montag > dauer.ende) throw new Fehler(400, 'Die Woche liegt außerhalb deiner Ausbildungszeit');
      if (montag > montagVon(heute(c.k.jetzt()))) throw new Fehler(400, 'Berichte lassen sich nicht für kommende Wochen schreiben');
      const z = holeBericht(db, azubi.id, montag);
      if (z && z.status !== 'entwurf' && z.status !== 'zurueck') {
        throw new Fehler(409, z.status === 'abgezeichnet' ? 'Der Bericht ist abgezeichnet und gesperrt' : 'Der Bericht ist eingereicht – zum Ändern zuerst zurückziehen');
      }
      // ein gespeicherter Bericht behält seine Form; ein neuer bekommt die, die der Betrieb eingestellt hat
      const inhalt = JSON.stringify(pruefeInhalt(koerper(c).inhalt, montag, z ? inhaltAus(z).form : leseBetrieb(db).berichtForm));
      const jetzt = c.k.jetzt().toISOString();
      if (z) db.prepare('UPDATE bericht SET inhalt = ?, geaendert = ? WHERE azubi_id = ? AND montag = ?').run(inhalt, jetzt, azubi.id, montag);
      else db.prepare("INSERT INTO bericht (azubi_id, montag, status, inhalt, geaendert) VALUES (?, ?, 'entwurf', ?, ?)").run(azubi.id, montag, inhalt, jetzt);
      return { status: 200, body: berichtAnsicht(c, azubi, montag) };
    },
  },

  {
    m: 'DELETE',
    p: '/api/azubis/:id/berichte/:montag',
    wer: ['azubi'],
    h: (c) => {
      const azubi = eigenerAzubi(c);
      const montag = montagAus(c);
      const z = holeBericht(c.k.db, azubi.id, montag);
      if (!z) throw new Fehler(404, 'Nicht gefunden');
      if (z.status !== 'entwurf') throw new Fehler(409, 'Nur Entwürfe lassen sich löschen');
      c.k.db.prepare('DELETE FROM bericht WHERE azubi_id = ? AND montag = ?').run(azubi.id, montag);
      return { status: 200, body: { ok: true } };
    },
  },

  {
    m: 'POST',
    p: '/api/azubis/:id/berichte/:montag/einreichen',
    wer: ['azubi'],
    h: (c) => {
      const { db } = c.k;
      const azubi = eigenerAzubi(c);
      const montag = montagAus(c);
      const z = holeBericht(db, azubi.id, montag);
      if (!z) throw new Fehler(404, 'Nicht gefunden');
      if (z.status !== 'entwurf' && z.status !== 'zurueck') throw new Fehler(409, 'Der Bericht ist schon eingereicht');
      if (summe(inhaltAus(z)).gesamt <= 0) throw new Fehler(400, 'Der Bericht enthält noch keine Stunden');
      const pfad = unterschriftVon(db, azubi.id);
      if (!pfad) throw new Fehler(409, 'Zum Einreichen fehlt deine Unterschrift – bitte zuerst unter „Konto“ hinterlegen', 'unterschrift');
      const jetzt = c.k.jetzt();
      transaktion(db, () => {
        db.prepare("UPDATE bericht SET status = 'eingereicht', eingereicht_am = ?, geaendert = ? WHERE azubi_id = ? AND montag = ?").run(jetzt.toISOString(), jetzt.toISOString(), azubi.id, montag);
        unterzeichne(db, jetzt, azubi.id, montag, 'azubi', azubi, pfad);
        vermerke(db, jetzt, azubi.id, montag, 'eingereicht', azubi);
        merkeAktivitaet(db, jetzt, 'bericht_eingereicht', azubi.id, azubi, montag);
      });
      return { status: 200, body: berichtAnsicht(c, azubi, montag) };
    },
  },

  {
    m: 'POST',
    p: '/api/azubis/:id/berichte/:montag/zurueckziehen',
    wer: ['azubi'],
    h: (c) => {
      const { db } = c.k;
      const azubi = eigenerAzubi(c);
      const montag = montagAus(c);
      const z = holeBericht(db, azubi.id, montag);
      if (!z) throw new Fehler(404, 'Nicht gefunden');
      if (z.status !== 'eingereicht') throw new Fehler(409, z.status === 'abgezeichnet' ? 'Der Bericht ist schon abgezeichnet' : 'Der Bericht ist nicht eingereicht');
      const jetzt = c.k.jetzt();
      transaktion(db, () => {
        db.prepare("UPDATE bericht SET status = 'entwurf', eingereicht_am = NULL, geaendert = ? WHERE azubi_id = ? AND montag = ?").run(jetzt.toISOString(), azubi.id, montag);
        db.prepare("DELETE FROM bericht_signatur WHERE azubi_id = ? AND montag = ? AND art = 'azubi'").run(azubi.id, montag);
        vermerke(db, jetzt, azubi.id, montag, 'zurueckgezogen', azubi);
      });
      return { status: 200, body: berichtAnsicht(c, azubi, montag) };
    },
  },

  {
    m: 'GET',
    p: '/api/abzeichnen',
    wer: ['ausbilder', 'beauftragter'],
    h: (c) => {
      const { db } = c.k;
      const offen: unknown[] = [];
      for (const id of sichtbareAzubis(db, c.b, heute(c.k.jetzt()))) {
        const azubi = holeBenutzer(db, id)!;
        const zeilen = db.prepare("SELECT * FROM bericht WHERE azubi_id = ? AND status = 'eingereicht' ORDER BY montag").all(id) as unknown as BerichtZeile[];
        const soll = leseProfil(db, id).wochenstunden;
        for (const z of zeilen) {
          // Beauftragte sehen hier nur Wochen, die sie abzeichnen dürfen
          if (!darfAbzeichnen(db, c.b, id, z.montag)) continue;
          offen.push({ azubiId: id, azubi: azubi.anzeigename, bild: bildPfad(azubi), montag: z.montag, sonntag: plusTage(z.montag, 6), ...kalenderwoche(z.montag), eingereichtAm: z.eingereicht_am, stunden: summe(inhaltAus(z)).gesamt, soll });
        }
      }
      return { status: 200, body: { offen, hatUnterschrift: unterschriftVon(db, c.b.id) !== null } };
    },
  },

  {
    m: 'POST',
    p: '/api/berichte/abzeichnen',
    wer: ['ausbilder', 'beauftragter'],
    h: (c) => {
      const { db } = c.k;
      const liste = koerper(c).berichte;
      if (!Array.isArray(liste) || liste.length === 0 || liste.length > 100) throw new Fehler(400, 'Bitte 1 bis 100 Berichte auswählen');
      const pfad = unterschriftVon(db, c.b.id);
      if (!pfad) throw new Fehler(409, 'Zum Abzeichnen fehlt deine Unterschrift – bitte zuerst unter „Konto“ hinterlegen', 'unterschrift');
      const gesehen = new Set<string>();
      const ziele = liste.map((x) => {
        if (!istObjekt(x) || !istMontag(x.montag)) throw new Fehler(400, 'Ungültige Auswahl');
        const azubiId = Number(x.azubiId);
        if (gesehen.has(`${azubiId}|${x.montag}`)) throw new Fehler(400, 'Ein Bericht ist doppelt ausgewählt');
        gesehen.add(`${azubiId}|${x.montag}`);
        // nicht erlaubt und nicht vorhanden sehen gleich aus
        if (!darfAbzeichnen(db, c.b, azubiId, x.montag)) throw new Fehler(404, 'Mindestens ein Bericht wurde nicht gefunden');
        const z = holeBericht(db, azubiId, x.montag);
        if (!z) throw new Fehler(404, 'Mindestens ein Bericht wurde nicht gefunden');
        if (z.status !== 'eingereicht') throw new Fehler(409, `Der Bericht ${wocheText(x.montag)} ist nicht (mehr) eingereicht`);
        return { azubi: holeBenutzer(db, azubiId)!, montag: x.montag };
      });
      const jetzt = c.k.jetzt();
      // alles oder nichts
      transaktion(db, () => {
        for (const z of ziele) {
          db.prepare("UPDATE bericht SET status = 'abgezeichnet', abgezeichnet_am = ?, abgezeichnet_von = ?, kommentar = '', geaendert = ? WHERE azubi_id = ? AND montag = ?").run(
            jetzt.toISOString(),
            c.b.id,
            jetzt.toISOString(),
            z.azubi.id,
            z.montag,
          );
          unterzeichne(db, jetzt, z.azubi.id, z.montag, 'abzeichnung', c.b, pfad);
          vermerke(db, jetzt, z.azubi.id, z.montag, 'abgezeichnet', c.b);
          merkeAktivitaet(db, jetzt, 'bericht_abgezeichnet', z.azubi.id, c.b, z.montag);
        }
      });
      return { status: 200, body: { abgezeichnet: ziele.length } };
    },
  },

  {
    m: 'POST',
    p: '/api/azubis/:id/berichte/:montag/zurueckgeben',
    wer: ['ausbilder', 'beauftragter'],
    h: (c) => {
      const { db } = c.k;
      const montag = montagAus(c);
      const id = idAus(c.p.id);
      if (!darfAbzeichnen(db, c.b, id, montag)) throw new Fehler(404, 'Nicht gefunden');
      const azubi = holeBenutzer(db, id)!;
      const z = holeBericht(db, id, montag);
      if (!z) throw new Fehler(404, 'Nicht gefunden');
      if (z.status !== 'eingereicht') throw new Fehler(409, 'Nur eingereichte Berichte lassen sich zurückgeben');
      const kommentar = freitext(koerper(c).kommentar, 1000, 'Kommentar');
      if (!kommentar) throw new Fehler(400, 'Bitte kurz begründen, was zu ändern ist');
      const jetzt = c.k.jetzt();
      transaktion(db, () => {
        db.prepare("UPDATE bericht SET status = 'zurueck', kommentar = ?, eingereicht_am = NULL, geaendert = ? WHERE azubi_id = ? AND montag = ?").run(kommentar, jetzt.toISOString(), id, montag);
        // der Azubi unterschreibt die überarbeitete Fassung neu
        db.prepare("DELETE FROM bericht_signatur WHERE azubi_id = ? AND montag = ? AND art = 'azubi'").run(id, montag);
        vermerke(db, jetzt, id, montag, 'zurueckgegeben', c.b, kommentar);
        merkeAktivitaet(db, jetzt, 'bericht_zurueck', id, c.b, montag);
      });
      return { status: 200, body: berichtAnsicht(c, azubi, montag) };
    },
  },

  {
    // Abzeichnung aufheben: nur Ausbilder mit vollen Rechten (nicht die Vertretung); der Bericht geht mit Begründung zurück an den Azubi
    m: 'POST',
    p: '/api/azubis/:id/berichte/:montag/oeffnen',
    wer: ['ausbilder'],
    h: (c) => {
      const { db } = c.k;
      const montag = montagAus(c);
      const id = idAus(c.p.id);
      if (!darfAzubiVerwalten(db, c.b, id)) throw new Fehler(404, 'Nicht gefunden');
      const azubi = holeBenutzer(db, id)!;
      const z = holeBericht(db, id, montag);
      if (!z) throw new Fehler(404, 'Nicht gefunden');
      if (z.status !== 'abgezeichnet') throw new Fehler(409, 'Der Bericht ist nicht abgezeichnet');
      const kommentar = freitext(koerper(c).kommentar, 1000, 'Begründung');
      if (!kommentar) throw new Fehler(400, 'Bitte kurz begründen, warum die Abzeichnung aufgehoben wird');
      const jetzt = c.k.jetzt();
      transaktion(db, () => {
        db.prepare("UPDATE bericht SET status = 'zurueck', kommentar = ?, eingereicht_am = NULL, abgezeichnet_am = NULL, abgezeichnet_von = NULL, geaendert = ? WHERE azubi_id = ? AND montag = ?").run(
          kommentar,
          jetzt.toISOString(),
          id,
          montag,
        );
        db.prepare('DELETE FROM bericht_signatur WHERE azubi_id = ? AND montag = ?').run(id, montag);
        vermerke(db, jetzt, id, montag, 'abzeichnung_aufgehoben', c.b, kommentar);
        merkeAktivitaet(db, jetzt, 'bericht_geoeffnet', id, c.b, montag);
      });
      return { status: 200, body: berichtAnsicht(c, azubi, montag) };
    },
  },
];
