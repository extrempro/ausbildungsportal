import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Fehler, istObjekt, koerper } from './api-basis';
import type { Ctx, Kontext, Route } from './api-basis';
import { MAX_ANHANG } from './bericht-anhang';
import { BERICHT_FORMEN, eigenerAzubi, holeBericht, pruefeInhalt, pruefeWochenende, reicheEin, summe, vermerke, vorbelegung } from './berichte';
import type { BerichtForm, Eintrag, Inhalt } from './berichte';
import type { DB } from './db';
import { transaktion } from './db';
import { heute } from './datum';
import { dienstBereit, eigeneAuftraege, holeAuftrag, loescheAuftrag, montagDerKw, neuerAuftrag, pruefePdf, raeumeAuf, standDes, stehtImText, zweistellig } from './import-dienst';
import type { Auftrag, Quelle } from './import-dienst';
import { gueltigesDatum, istMontag, kalenderwoche, montagVon, plusTage } from './kalender';
import { dauerVon, leseProfil } from './stammdaten';

/**
 * Alte Berichte einlesen (Berichtsheft → „Alte Berichte einlesen“): Ein Azubi, der sein Berichtsheft bisher auf Papier
 * oder in einer Datei geführt hat, lädt es als PDF hoch (auch eingescannt) oder fügt den Text ein.
 *
 * - Das Portal sucht selbst nach Wochen (Zeitraum, „Woche vom …“, KW), nach den drei Teilen (Betrieb, Unterweisung,
 *   Berufsschule), nach Tagen und nach Stunden (Muster). Das Sprachmodell des Dienstes „import“ ergänzt nur – was allein
 *   von ihm stammt, ist markiert und nicht angehakt.
 * - Übernommen wird, was der Azubi in der Vorschau anhakt – als Entwurf, nur für Wochen ohne Bericht. Im Verlauf steht
 *   „eingelesen“; bei einer PDF hängen die Originalseiten am Bericht. Danach reicht der Azubi die Berichte ein (auch alle
 *   auf einmal), und der Ausbilder zeichnet sie wie gewohnt ab – er sieht, dass sie eingelesen sind.
 * - Alles bleibt bis zum Einreichen privat: Aufträge sieht nur der Azubi selbst, sie werden nach dem Übernehmen gelöscht,
 *   sonst nach 24 Stunden.
 * - Zeilen, die nach Krankheit klingen, kommen nicht in den Bericht (kein Gesundheitsbezug im Ausbildungsnachweis).
 */

const MAX_TEXT = 60_000;
const MAX_WOCHEN = 60;
/** so viele Originalseiten hängen höchstens an einem Bericht */
const MAX_SEITEN_JE_WOCHE = 4;

type Teil = 'betrieb' | 'unterweisung' | 'schule';
const TEILE: Teil[] = ['betrieb', 'unterweisung', 'schule'];

export interface RohWoche {
  montag: string;
  form: BerichtForm;
  betrieb: Eintrag[];
  unterweisung: Eintrag[];
  schule: Eintrag[];
  /** Seiten der PDF (ab 1), auf denen die Woche steht */
  seiten: number[];
  hinweise: string[];
  /** nur das Sprachmodell hat diese Woche gefunden */
  nurModell?: boolean;
}

// ---------- Muster ----------

const DATUM = String.raw`(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4}|\d{2})?(?!\d)`;
const ZEITRAUM = new RegExp(`${DATUM}\\s*(?:-|–|—|bis)\\s*${DATUM}`);
const WOCHE_VOM = new RegExp(`woche\\W{1,3}vom\\s*:?\\s*${DATUM}`, 'i');
const KW = /\b(?:KW|Kalenderwoche)\s*:?\s*(\d{1,2})(?:\s*(?:\/|,|\s)\s*(?:Jahr\s*:?\s*)?(\d{4}))?/i;
const TAGE = ['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag'];
const WOCHENTAG = /^(montag|dienstag|mittwoch|donnerstag|freitag|samstag)\b[,:.]?\s*(?:den\s+)?(?:\d{1,2}\.\s?\d{1,2}\.(?:\s?\d{2,4})?)?\s*[:-]?\s*(.*)$/i;
/** Überschriften der drei Teile – „Unterweisung“ vor „Betrieb“, weil „Betriebliche Unterweisung“ beides enthält */
const KOPF: [Teil, RegExp][] = [
  ['unterweisung', /^(?:betriebliche\s+)?(?:unterweisung(?:en)?|schulung(?:en)?|lehrg(?:ä|ae)ng(?:e)?|betrieblicher\s+unterricht)\b[^:]{0,70}?(?::\s*(.*))?$/i],
  ['schule', /^(?:themen\s+des\s+)?(?:berufsschul(?:unterrichts?|e)?|unterrichtsthemen|schule)\b[^:]{0,40}?(?::\s*(.*))?$/i],
  ['betrieb', /^(?:betriebliche\s+|ausgef(?:ü|ue)hrte\s+)?(?:t(?:ä|ae)tigkeit(?:en)?|arbeiten)(?:\s+im\s+betrieb)?\b[^:]{0,30}?(?::\s*(.*))?$/i],
];
const KOPF_REST_ERLAUBT = /^[\s,()/&-]*(?:betrieblicher unterricht|sonstige schulungen|unterrichtsthemen|stunden|std\.?|dauer|[\s,()/&-])*$/i;
const RAHMEN = /^(?:ausbildungsnachweis|nachweis\s*nr|name\b|vorname|ausbildungsjahr|ausbildungsabteilung|abteilung|datum\b|unterschrift|auszubildende|ausbilde(?:r|nde|rin)|gesetzliche|gesamt|summe|stunden\s*(?:gesamt|insgesamt|summe)|wochenstunden|seite\s*\d|für die richtigkeit|kalenderwoche|kw\b|woche\s+vom|zeitraum|von\b.*\bbis\b|ausbildungsbetrieb|beruf\b|fachrichtung)/i;
const GESUNDHEIT = /\b(?:krank\w*|arbeitsunf(?:ä|ae)hig\w*|arzt|(?:ä|ae)rztin|arzttermin|au-bescheinigung)\b/i;
const STUNDEN_ENDE = /^(.*?\S)\s+(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:h|std\.?|stunden)?\s*$/i;
const NUR_STUNDEN = /^(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:h|std\.?|stunden)?$/i;
const PUNKT = /^\s*(?:[-–•*·▪►]|\d{1,2}[.)])\s+/;

const sauber = (s: string) => s.replace(PUNKT, '').replace(/\s{2,}/g, ' ').trim();
const zahl = (s: string) => Math.round(Number(s.replace(',', '.')) * 20) / 20;

function gueltig(t: string, m: string, j: string | undefined, kontextJahr: number): string | null {
  const jahr = j ? Number(zweistellig(j)) : kontextJahr;
  const iso = `${jahr}-${m.padStart(2, '0')}-${t.padStart(2, '0')}`;
  return gueltigesDatum(iso) ? iso : null;
}

/** Montag der Woche, die diese Zeile ankündigt – oder null. */
function wocheAus(zeile: string, kontextJahr: number): string | null {
  const z = ZEITRAUM.exec(zeile);
  if (z) {
    const bis = gueltig(z[4], z[5], z[6] ?? z[3], kontextJahr);
    const von = gueltig(z[1], z[2], z[3] ?? z[6], kontextJahr);
    // ein Zeitraum innerhalb einer Woche (z. B. Mo–Fr): das ist die Berichtswoche
    if (von && bis && bis >= von && montagVon(von) === montagVon(bis)) return montagVon(von);
  }
  const w = WOCHE_VOM.exec(zeile);
  if (w) {
    const von = gueltig(w[1], w[2], w[3], kontextJahr);
    if (von) return montagVon(von);
  }
  const k = KW.exec(zeile);
  if (k) {
    const kw = Number(k[1]);
    if (kw >= 1 && kw <= 53) return montagDerKw(k[2] ? Number(k[2]) : kontextJahr, kw);
  }
  return null;
}

function kopfVon(zeile: string): { teil: Teil; rest: string } | null {
  const z = zeile.replace(/\s+/g, ' ').trim();
  if (z.length > 90) return null;
  for (const [teil, re] of KOPF) {
    const m = re.exec(z);
    if (!m) continue;
    const vorDoppelpunkt = z.split(':')[0];
    // nur echte Überschriften: nach dem Begriff höchstens Spaltenköpfe wie „Stunden“
    const nach = vorDoppelpunkt.replace(/^(?:betriebliche\s+|ausgef(?:ü|ue)hrte\s+|themen\s+des\s+)?\S+/i, '');
    if (!KOPF_REST_ERLAUBT.test(nach) && !/^\s*(?:im betrieb|des berufsschulunterrichts?)?\s*(?:stunden|std\.?)?\s*$/i.test(nach)) continue;
    return { teil, rest: (m[1] ?? '').trim() };
  }
  return null;
}

/**
 * Sucht im Text alter Berichte nach Wochen und ihren Einträgen. Seiten sind durch einen Seitenvorschub (\f) getrennt.
 * Vor der ersten erkannten Woche steht meist nur das Deckblatt – das zählt nicht.
 */
export function erkenneWochen(text: string, heuteIso: string): RohWoche[] {
  const wochen = new Map<string, RohWoche & { offen: string[]; teil: Teil; tag: string | null; tage: boolean; offenTag: string | null }>();
  let aktuell: (RohWoche & { offen: string[]; teil: Teil; tag: string | null; tage: boolean; offenTag: string | null }) | null = null;
  let kontextJahr = Number(heuteIso.slice(0, 4));

  const schliesse = (stunden = 0) => {
    if (!aktuell || aktuell.offen.length === 0) return;
    const text = aktuell.offen.join('\n').slice(0, 2000);
    aktuell[aktuell.teil].push({ text, stunden, ...(aktuell.offenTag ? { tag: aktuell.offenTag } : {}) });
    aktuell.offen = [];
  };

  const seiten = text.replace(/\r/g, '').split('\f');
  seiten.forEach((seite, s) => {
    for (const roh of seite.split('\n')) {
      const zeile = roh.trim();
      if (!zeile) continue;
      const jahr = /\b(20\d{2})\b/.exec(zeile);
      if (jahr) kontextJahr = Number(jahr[1]);
      const montag = wocheAus(zeile, kontextJahr);
      if (montag && (!aktuell || aktuell.montag !== montag)) {
        schliesse();
        const vorhanden = wochen.get(montag);
        aktuell = vorhanden ?? { montag, form: 'woche', betrieb: [], unterweisung: [], schule: [], seiten: [], hinweise: [], offen: [], teil: 'betrieb', tag: null, tage: false, offenTag: null };
        wochen.set(montag, aktuell);
      }
      if (!aktuell) continue;
      const w = aktuell;
      const merkeSeite = () => {
        if (!w.seiten.includes(s + 1)) w.seiten.push(s + 1);
      };
      if (montag) merkeSeite();
      if (montag || RAHMEN.test(zeile)) continue;
      merkeSeite();
      if (GESUNDHEIT.test(zeile)) {
        if (!w.hinweise.includes('Eine Zeile zu einer Abwesenheit ist weggelassen – trag den Tag im Bericht als „abwesend“ ein.')) w.hinweise.push('Eine Zeile zu einer Abwesenheit ist weggelassen – trag den Tag im Bericht als „abwesend“ ein.');
        continue;
      }
      let inhalt = zeile;
      const tag = WOCHENTAG.exec(inhalt);
      if (tag) {
        schliesse();
        w.tage = true;
        w.tag = plusTage(w.montag, TAGE.indexOf(tag[1].toLowerCase()));
        // ein neuer Tag beginnt wieder mit dem Betrieb
        w.teil = 'betrieb';
        inhalt = tag[2].trim();
        if (!inhalt) continue;
      }
      const kopf = kopfVon(inhalt);
      let zurueck: Teil | null = null;
      if (kopf) {
        schliesse();
        // Überschrift allein: ab hier gilt dieser Teil. Mit Text dahinter („Unterweisung: Arbeitsschutz 2“): nur diese Zeile.
        if (kopf.rest) zurueck = w.teil;
        w.teil = kopf.teil;
        inhalt = kopf.rest;
        if (!inhalt) continue;
      }
      const nur = NUR_STUNDEN.exec(inhalt);
      if (nur) {
        // Stunden in einer eigenen Zeile: gehören zum Eintrag davor
        if (w.offen.length) schliesse(zahl(nur[1]));
        else {
          const letzter = w[w.teil][w[w.teil].length - 1];
          if (letzter && letzter.stunden === 0) letzter.stunden = zahl(nur[1]);
        }
        continue;
      }
      if (PUNKT.test(inhalt) && w.offen.length) schliesse();
      w.offenTag = w.tag;
      const st = STUNDEN_ENDE.exec(inhalt);
      if (st && zahl(st[2]) > 0 && zahl(st[2]) <= 12) {
        w.offen.push(sauber(st[1]));
        schliesse(zahl(st[2]));
      } else {
        const t = sauber(inhalt);
        if (t) w.offen.push(t);
      }
      if (zurueck) {
        schliesse();
        w.teil = zurueck;
      }
    }
  });
  schliesse();
  return [...wochen.values()]
    .map(({ offen: _o, teil: _t, tag: _g, offenTag: _ot, tage, ...w }): RohWoche => {
      const form: BerichtForm = tage ? 'tag' : 'woche';
      const mitTag = (l: Eintrag[]) => (form === 'tag' ? l.map((e) => ({ ...e, tag: e.tag ?? w.montag })) : l.map(({ tag: _x, ...e }) => e));
      return { ...w, form, betrieb: mitTag(w.betrieb), unterweisung: mitTag(w.unterweisung), schule: mitTag(w.schule) };
    })
    .sort((a, b) => a.montag.localeCompare(b.montag));
}

/** Antwort des Sprachmodells: nur, was in die feste Form passt */
export function ausModell(json: unknown): RohWoche[] {
  const liste = (json as { wochen?: unknown })?.wochen;
  if (!Array.isArray(liste)) return [];
  const eintraege = (x: unknown): Eintrag[] =>
    Array.isArray(x)
      ? x.slice(0, 30).flatMap((e): Eintrag[] => {
          if (!istObjekt(e) || typeof e.text !== 'string' || !e.text.trim()) return [];
          const st = typeof e.stunden === 'number' && e.stunden > 0 && e.stunden <= 12 ? Math.round(e.stunden * 20) / 20 : 0;
          return [{ text: e.text.trim().slice(0, 2000), stunden: st }];
        })
      : [];
  return liste.slice(0, MAX_WOCHEN).flatMap((w): RohWoche[] => {
    if (!istObjekt(w) || !gueltigesDatum(w.von)) return [];
    return [{ montag: montagVon(w.von), form: 'woche', betrieb: eintraege(w.betrieb), unterweisung: eintraege(w.unterweisung), schule: eintraege(w.schule), seiten: [], hinweise: [] }];
  });
}

const kurz = (s: string) => s.toLowerCase().replace(/[^a-z0-9äöüß]/g, '');
const leer = (w: RohWoche) => TEILE.every((t) => w[t].length === 0);

/**
 * Muster zuerst, das Sprachmodell ergänzt: Fand das Portal eine Woche, aber keine Einträge, nimmt es die des Modells –
 * nur solche, die (ungefähr) so im Text stehen. Eine Woche, die nur das Modell gefunden hat, kommt markiert dazu, wenn
 * ihr Datum im Text steht.
 */
export function zusammenfuehren(muster: RohWoche[], modell: RohWoche[], text: string): RohWoche[] {
  const ergebnis = muster.map((w) => ({ ...w }));
  const imText = kurz(text);
  const echt = (l: Eintrag[]) => l.filter((e) => imText.includes(kurz(e.text).slice(0, 24)) && !GESUNDHEIT.test(e.text));
  const seiten = text.split('\f');
  for (const m of modell) {
    const gleich = ergebnis.find((w) => w.montag === m.montag);
    if (gleich) {
      if (leer(gleich)) {
        const neu = { betrieb: echt(m.betrieb), unterweisung: echt(m.unterweisung), schule: echt(m.schule) };
        if (TEILE.some((t) => neu[t].length)) {
          Object.assign(gleich, gleich.form === 'tag' ? Object.fromEntries(TEILE.map((t) => [t, neu[t].map((e) => ({ ...e, tag: gleich.montag }))])) : neu);
          gleich.hinweise = [...gleich.hinweise, 'Die Einträge hat das Sprachmodell geordnet – bitte genau prüfen.'];
        }
      }
      continue;
    }
    if (!stehtImText(text, m.montag) && !stehtImText(text, plusTage(m.montag, 4))) continue;
    const neu = { ...m, betrieb: echt(m.betrieb), unterweisung: echt(m.unterweisung), schule: echt(m.schule) };
    if (leer(neu)) continue;
    const seite = seiten.findIndex((s) => stehtImText(s, m.montag) || stehtImText(s, plusTage(m.montag, 4)));
    ergebnis.push({ ...neu, seiten: seite >= 0 ? [seite + 1] : [], nurModell: true, hinweise: ['Nur das Sprachmodell hat diese Woche gefunden – bitte genau prüfen.'] });
  }
  return ergebnis.sort((a, b) => a.montag.localeCompare(b.montag));
}

// ---------- Vorschau ----------

export interface Woche extends RohWoche {
  kw: number;
  jahr: number;
  stunden: number;
  /** neu: lässt sich übernehmen; sonst der Grund, warum nicht */
  /** neu: lässt sich übernehmen; leer: auch – ersetzt einen leeren Entwurf; sonst der Grund, warum nicht */
  stand: 'neu' | 'leer' | 'vorhanden' | 'ausserhalb' | 'zukunft';
  vorgewaehlt: boolean;
  unsicher: boolean;
}

/**
 * Ein leerer Entwurf: noch nichts in den drei Teilen, keine eigene Abwesenheit (vorbelegte Feiertage und Urlaub zählen
 * nicht) und keine Anhänge. Ihn darf das Einlesen ersetzen – alles andere bleibt, wie es ist.
 */
function leererEntwurf(db: DB, azubiId: number, montag: string): boolean {
  const z = holeBericht(db, azubiId, montag);
  if (!z || z.status !== 'entwurf') return false;
  let i: Partial<Inhalt>;
  try {
    i = JSON.parse(z.inhalt) as Partial<Inhalt>;
  } catch {
    return false;
  }
  if (TEILE.some((t) => (i[t] ?? []).some((e) => e.text.trim() || e.stunden > 0))) return false;
  if ((i.abwesenheit ?? []).some((a) => a.grund === 'abwesend' || a.text.trim())) return false;
  return !db.prepare('SELECT 1 FROM bericht_anhang WHERE azubi_id = ? AND montag = ?').get(azubiId, montag);
}

function vorschau(k: Kontext, azubiId: number, roh: RohWoche[], quelle: Quelle): Woche[] {
  const profil = leseProfil(k.db, azubiId);
  const dauer = dauerVon(k.db, profil);
  const dieseWoche = montagVon(heute(k.jetzt()));
  return roh.slice(0, MAX_WOCHEN).map((w) => {
    const stand: Woche['stand'] = holeBericht(k.db, azubiId, w.montag) ? (leererEntwurf(k.db, azubiId, w.montag) ? 'leer' : 'vorhanden') : !dauer || w.montag < montagVon(dauer.beginn) || w.montag > dauer.ende ? 'ausserhalb' : w.montag > dieseWoche ? 'zukunft' : 'neu';
    const hinweise = [...w.hinweise];
    if (stand === 'vorhanden') hinweise.unshift('Für diese Woche gibt es schon einen Bericht – er bleibt, wie er ist.');
    if (stand === 'ausserhalb') hinweise.unshift(dauer ? 'Die Woche liegt außerhalb deiner Ausbildungszeit.' : 'Für dich ist noch kein Ausbildungsbeginn eingetragen.');
    if (stand === 'zukunft') hinweise.unshift('Die Woche liegt in der Zukunft.');
    if (stand === 'leer') hinweise.unshift('Ersetzt deinen leeren Entwurf dieser Woche.');
    const stunden = TEILE.reduce((n, t) => n + w[t].reduce((m, e) => m + e.stunden, 0), 0);
    const frei = stand === 'neu' || stand === 'leer';
    if (frei && !leer(w) && stunden === 0) hinweise.push('Es sind keine Stunden erkannt – trag sie vor dem Einreichen im Bericht ein.');
    if (frei && leer(w)) hinweise.push('In dieser Woche wurden keine Einträge erkannt.');
    // Einträge am Samstag oder Sonntag gehen nur mit Freischaltung im Profil
    const amWochenende = w.form === 'tag' && !profil.wochenende && TEILE.some((t) => w[t].some((e) => e.tag === plusTage(w.montag, 5) || e.tag === plusTage(w.montag, 6)));
    if (frei && amWochenende) hinweise.push('Hier stehen Einträge am Samstag oder Sonntag. Die sind in deinem Berichtsheft nicht freigeschaltet – frag deinen Ausbilder.');
    const unsicher = quelle === 'texterkennung' || !!w.nurModell || hinweise.length > 0;
    return { ...w, ...kalenderwoche(w.montag), stunden, stand, hinweise, unsicher, vorgewaehlt: frei && !leer(w) && !w.nurModell && !amWochenende };
  });
}

function stand(c: Ctx, azubiId: number, a: Auftrag) {
  const st = standDes(c.k, a);
  if (st.status !== 'fertig') return { id: a.id, ...st };
  const text = st.text.slice(0, MAX_TEXT);
  const roh = zusammenfuehren(erkenneWochen(text, heute(c.k.jetzt())), st.modell ? ausModell(st.modell) : [], text);
  // Seiten gibt es nur bei einer PDF – der Dienst legt sie einzeln ab
  const mitSeiten = st.quelle !== 'text';
  return { id: a.id, status: 'fertig' as const, quelle: st.quelle, modell: !!st.modell, seitenDabei: mitSeiten, wochen: vorschau(c.k, azubiId, mitSeiten ? roh : roh.map((w) => ({ ...w, seiten: [] })), st.quelle) };
}

/** Eine Originalseite aus dem Auftrag – nur echte PDFs bis zur Größe eines Anhangs. */
function seiteAus(a: Auftrag, n: number): Buffer | null {
  if (!Number.isInteger(n) || n < 1 || n > 200) return null;
  const pfad = join(a.ordner, `seite-${n}.pdf`);
  if (!existsSync(pfad) || statSync(pfad).size > MAX_ANHANG) return null;
  const daten = readFileSync(pfad);
  return daten.subarray(0, 5).toString('latin1') === '%PDF-' ? daten : null;
}

const AZUBI: Route['wer'] = ['azubi'];
const OHNE_DIENST = 'PDFs liest der Dienst „import“ – er läuft gerade nicht. Kopiere den Text aus der Datei und füge ihn ein, oder frag deinen Ausbilder.';

export const BERICHTSHEFT_IMPORT_ROUTEN: Route[] = [
  {
    m: 'GET',
    p: '/api/azubis/:id/einlesen',
    wer: AZUBI,
    h: (c) => {
      const azubi = eigenerAzubi(c);
      raeumeAuf(c.k);
      return { status: 200, body: { dienst: dienstBereit(c.k), auftraege: eigeneAuftraege(c.k, azubi.id, 'berichtsheft').map((a) => stand(c, azubi.id, a)) } };
    },
  },
  {
    // PDF (application/pdf) oder JSON { text }
    m: 'POST',
    p: '/api/azubis/:id/einlesen',
    wer: AZUBI,
    h: (c) => {
      const azubi = eigenerAzubi(c);
      raeumeAuf(c.k);
      const pdf = Buffer.isBuffer(c.a.body) ? c.a.body : null;
      let text = '';
      if (pdf) pruefePdf(c.k, pdf, OHNE_DIENST);
      else {
        const roh = koerper(c).text;
        text = typeof roh === 'string' ? roh.replace(/\r\n?/g, '\n').trim() : '';
        if (!text) throw new Fehler(400, 'Bitte den Text deiner alten Berichte einfügen');
        if (text.length > MAX_TEXT) throw new Fehler(400, `Der Text ist zu lang (höchstens ${MAX_TEXT.toLocaleString('de-DE')} Zeichen) – füge ihn in Teilen ein`);
        // ohne Dienst: gleich selbst nach Mustern suchen
        if (!dienstBereit(c.k)) {
          return { status: 200, body: { status: 'fertig', quelle: 'text', modell: false, seitenDabei: false, wochen: vorschau(c.k, azubi.id, erkenneWochen(text, heute(c.k.jetzt())).map((w) => ({ ...w, seiten: [] })), 'text') } };
        }
      }
      const id = neuerAuftrag(c.k, azubi.id, 'berichtsheft', pdf ? { pdf } : { text });
      return { status: 202, body: { id, status: 'laeuft', fortschritt: 0 } };
    },
  },
  {
    m: 'GET',
    p: '/api/azubis/:id/einlesen/:auftrag',
    wer: AZUBI,
    h: (c) => {
      const azubi = eigenerAzubi(c);
      return { status: 200, body: stand(c, azubi.id, holeAuftrag(c.k, azubi.id, 'berichtsheft', c.p.auftrag)) };
    },
  },
  {
    m: 'DELETE',
    p: '/api/azubis/:id/einlesen/:auftrag',
    wer: AZUBI,
    h: (c) => {
      const azubi = eigenerAzubi(c);
      loescheAuftrag(c.k, azubi.id, 'berichtsheft', holeAuftrag(c.k, azubi.id, 'berichtsheft', c.p.auftrag).id);
      return { status: 200, body: { ok: true } };
    },
  },
  {
    // Übernehmen, was der Azubi angehakt hat: je Woche ein Entwurf (nur Wochen ohne Bericht), mit den Originalseiten
    m: 'POST',
    p: '/api/azubis/:id/einlesen/uebernehmen',
    wer: AZUBI,
    h: (c) => {
      const { db } = c.k;
      const azubi = eigenerAzubi(c);
      const body = koerper(c);
      const profil = leseProfil(db, azubi.id);
      const dauer = dauerVon(db, profil);
      if (!dauer) throw new Fehler(409, 'Für dich ist noch kein Ausbildungsbeginn eingetragen – bitte an den Ausbilder wenden');
      const liste = body.wochen;
      if (!Array.isArray(liste) || liste.length === 0 || liste.length > MAX_WOCHEN) throw new Fehler(400, 'Keine Wochen zum Übernehmen gewählt');
      const auftrag = typeof body.auftrag === 'string' && body.auftrag ? holeAuftrag(c.k, azubi.id, 'berichtsheft', body.auftrag) : null;
      const dieseWoche = montagVon(heute(c.k.jetzt()));
      const gesehen = new Set<string>();
      const neu = liste.map((x) => {
        if (!istObjekt(x) || !istMontag(x.montag)) throw new Fehler(400, 'Ungültige Woche');
        const montag = x.montag;
        const kw = kalenderwoche(montag);
        const name = `KW ${kw.kw}/${kw.jahr}`;
        if (gesehen.has(montag)) throw new Fehler(400, `${name} ist doppelt gewählt`);
        gesehen.add(montag);
        if (montag < montagVon(dauer.beginn) || montag > dauer.ende) throw new Fehler(400, `${name} liegt außerhalb deiner Ausbildungszeit`);
        if (montag > dieseWoche) throw new Fehler(400, `${name} liegt in der Zukunft`);
        // ein leerer Entwurf wird ersetzt; jeder andere Bericht bleibt
        const ersetzt = holeBericht(db, azubi.id, montag) ? leererEntwurf(db, azubi.id, montag) : false;
        if (holeBericht(db, azubi.id, montag) && !ersetzt) throw new Fehler(409, `Für ${name} gibt es schon einen Bericht`);
        const form = BERICHT_FORMEN.includes(x.form as BerichtForm) ? (x.form as BerichtForm) : 'woche';
        const abwesenheit = vorbelegung(db, azubi.id, montag, profil.wochenstunden).abwesenheit;
        const inhalt: Inhalt = pruefeInhalt({ betrieb: x.betrieb, unterweisung: x.unterweisung, schule: x.schule, abwesenheit }, montag, form);
        if (TEILE.every((t) => inhalt[t].length === 0)) throw new Fehler(400, `${name} hat keine Einträge`);
        try {
          pruefeWochenende(inhalt, montag, profil.wochenende, null);
        } catch (e) {
          throw e instanceof Fehler ? new Fehler(400, `${name}: ${e.message}`) : e;
        }
        const seitenRoh = Array.isArray(x.seiten) ? x.seiten.slice(0, MAX_SEITEN_JE_WOCHE) : [];
        const seiten = auftrag ? seitenRoh.flatMap((n) => {
          const daten = seiteAus(auftrag, Number(n));
          return daten ? [{ n: Number(n), daten }] : [];
        }) : [];
        return { montag, inhalt, seiten, ersetzt };
      });
      const jetzt = c.k.jetzt();
      transaktion(db, () => {
        for (const w of neu) {
          if (w.ersetzt) db.prepare("DELETE FROM bericht WHERE azubi_id = ? AND montag = ? AND status = 'entwurf'").run(azubi.id, w.montag);
          db.prepare("INSERT INTO bericht (azubi_id, montag, status, inhalt, geaendert) VALUES (?, ?, 'entwurf', ?, ?)").run(azubi.id, w.montag, JSON.stringify(w.inhalt), jetzt.toISOString());
          vermerke(db, jetzt, azubi.id, w.montag, 'eingelesen', azubi);
          for (const s of w.seiten) {
            db.prepare('INSERT INTO bericht_anhang (azubi_id, montag, tag, name, typ, groesse, erstellt, daten) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
              azubi.id,
              w.montag,
              w.inhalt.form === 'tag' ? w.montag : null,
              `Original Seite ${s.n}.pdf`,
              'application/pdf',
              s.daten.length,
              jetzt.toISOString(),
              s.daten,
            );
          }
        }
      });
      if (auftrag) loescheAuftrag(c.k, azubi.id, 'berichtsheft', auftrag.id);
      return { status: 200, body: { angelegt: neu.length, ohneStunden: neu.filter((w) => summe(w.inhalt).gesamt <= 0).length } };
    },
  },
  {
    // eingelesene Entwürfe auf einmal einreichen – mit der Unterschrift des Azubis
    m: 'POST',
    p: '/api/azubis/:id/einlesen/einreichen',
    wer: AZUBI,
    h: (c) => {
      const azubi = eigenerAzubi(c);
      const montage = koerper(c).montage;
      if (!Array.isArray(montage) || montage.length === 0 || montage.length > 100) throw new Fehler(400, 'Bitte 1 bis 100 Berichte auswählen');
      if (!montage.every(istMontag) || new Set(montage).size !== montage.length) throw new Fehler(400, 'Ungültige Auswahl');
      reicheEin(c.k.db, c.k.jetzt(), azubi, montage as string[]);
      return { status: 200, body: { eingereicht: montage.length } };
    },
  },
  {
    // die eingelesenen Entwürfe des Azubis – zum Einreichen auf einmal
    m: 'GET',
    p: '/api/azubis/:id/einlesen-entwuerfe',
    wer: AZUBI,
    h: (c) => {
      const azubi = eigenerAzubi(c);
      const zeilen = c.k.db
        .prepare("SELECT b.montag, b.inhalt FROM bericht b WHERE b.azubi_id = ? AND b.status IN ('entwurf', 'zurueck') AND EXISTS (SELECT 1 FROM bericht_verlauf v WHERE v.azubi_id = b.azubi_id AND v.montag = b.montag AND v.aktion = 'eingelesen') ORDER BY b.montag")
        .all(azubi.id) as { montag: string; inhalt: string }[];
      const wochen = zeilen.map((z) => {
        let stunden = 0;
        try {
          stunden = summe(pruefeInhalt(JSON.parse(z.inhalt), z.montag, (JSON.parse(z.inhalt) as { form?: BerichtForm }).form === 'tag' ? 'tag' : 'woche')).gesamt;
        } catch {
          stunden = 0;
        }
        return { montag: z.montag, ...kalenderwoche(z.montag), stunden };
      });
      return { status: 200, body: { wochen } };
    },
  },
];
