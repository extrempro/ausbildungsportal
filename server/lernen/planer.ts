// Planer für das Prüfungsvorhaben eines Berufs (Abschlussprojekt, Gesellenstück, Fachaufgabe …).
// Die Datei planer.md liegt im Inhaltspaket neben themenfelder.json. Anders als die Themen-Dateien stammt dieses
// Format nicht aus dem FISI-Lernkompass – der Lernkompass liest die Datei nicht und stört sich nicht an ihr.
import { frontmatter, ID_MUSTER } from './parse';
import type { Link, Meldung } from './typen';

export interface PlanerTermin {
  id: string;
  label: string;
  hinweis: string;
}

export interface PlanerPunkt {
  id: string;
  text: string;
  hilfe: string;
}

export interface PlanerCheckliste {
  art: 'checkliste';
  id: string;
  titel: string;
  gruppen: { titel: string; punkte: PlanerPunkt[] }[];
}

export interface PlanerZeitplanung {
  art: 'zeitplanung';
  titel: string;
  /** null = keine Obergrenze */
  hoechststunden: number | null;
  hinweis: string;
  /** Vorschlag für den Anfang – danach gehört die Planung dem Azubi */
  phasen: { name: string; stunden: number }[];
}

export interface PlanerFragen {
  art: 'fragen';
  id: string;
  titel: string;
  einleitung: string;
  /** Uhr zum Üben eines Vortrags, in Minuten; null = keine Uhr */
  timerMinuten: number | null;
  fragen: { id: string; text: string }[];
}

export type PlanerAbschnitt = PlanerCheckliste | PlanerZeitplanung | PlanerFragen;

export interface Planer {
  titel: string;
  untertitel: string;
  einleitung: string;
  /** Beschriftung und Beispiel für das Namensfeld im Kopf (z. B. „Projekttitel“) */
  nameFeld: string;
  nameBeispiel: string;
  /** leer = das Feld gibt es nicht */
  auftraggeberFeld: string;
  auftraggeberBeispiel: string;
  termineEinleitung: string;
  termine: PlanerTermin[];
  /** Checklisten, Zeitplanung und Fragen in der Reihenfolge der Datei */
  abschnitte: PlanerAbschnitt[];
  links: Link[];
  /** alte → neue Kennung, z. B. „antrag.thema“ → „antrag.bezeichnung“ oder „termine.doku“ → „termine.abgabe“ */
  umbenennungen: Record<string, string>;
}

export const PLANER_DATEI = 'planer.md';
const MAX = { termine: 12, abschnitte: 12, punkte: 60, phasen: 20, fragen: 40, text: 300 };
const PUNKT_MIT_ID = /^(.*?)\s*\{#([^}]*)\}\s*(?:[–-]\s+(.*))?$/;

interface Zeile {
  text: string;
  nr: number;
}

function kuerze(s: string): string {
  return s.trim().slice(0, MAX.text);
}

/** Listenpunkte („- “), eingerückte Folgezeilen gehören zum Punkt davor. */
function punkte(zeilen: Zeile[]): Zeile[] {
  const out: Zeile[] = [];
  for (const z of zeilen) {
    const m = /^\s*[-*]\s+(.*)$/.exec(z.text);
    if (m) out.push({ text: m[1].trim(), nr: z.nr });
    else if (out.length && /^\s{2,}\S/.test(z.text)) out[out.length - 1].text += ' ' + z.text.trim();
  }
  return out;
}

/** Fließtext eines Abschnitts: alles, was weder Listenpunkt noch Überschrift noch „schluessel: wert“ ist. */
function fliesstext(zeilen: Zeile[], schluessel: string[] = []): string {
  return zeilen
    .map((z) => z.text.trim())
    .filter((t) => t && !/^[-*]\s/.test(t) && !t.startsWith('#') && !t.startsWith('<!--') && !schluessel.some((s) => t.toLowerCase().startsWith(`${s}:`)))
    .join(' ')
    .slice(0, 600);
}

function wert(zeilen: Zeile[], schluessel: string): { text: string; nr: number } | null {
  for (const z of zeilen) {
    const m = new RegExp(`^${schluessel}\\s*:\\s*(.*)$`, 'i').exec(z.text.trim());
    if (m) return { text: m[1].trim(), nr: z.nr };
  }
  return null;
}

/** Liest planer.md. Mit Fehlern (level „fehler“) wird der Planer nicht verwendet. */
export function parsePlaner(raw: string): { planer: Planer | null; meldungen: Meldung[] } {
  const meldungen: Meldung[] = [];
  const fehler = (text: string, zeile?: number) => meldungen.push({ level: 'fehler', datei: PLANER_DATEI, zeile, text });
  const warnung = (text: string, zeile?: number) => meldungen.push({ level: 'warnung', datei: PLANER_DATEI, zeile, text });

  let fm: { data: Record<string, unknown>; content: string };
  try {
    fm = frontmatter(raw);
  } catch (e) {
    fehler(`Kopf nicht lesbar: ${(e as Error).message}`, 1);
    return { planer: null, meldungen };
  }
  const kopf = (name: string) => (typeof fm.data[name] === 'string' ? kuerze(fm.data[name] as string) : '');
  const offset = raw.slice(0, raw.length - fm.content.length).split('\n').length - 1;
  const zeilen: Zeile[] = fm.content.split(/\r?\n/).map((text, i) => ({ text, nr: i + 1 + offset }));

  const planer: Planer = {
    titel: kopf('titel'),
    untertitel: kopf('untertitel'),
    einleitung: '',
    nameFeld: kopf('name-feld') || 'Titel',
    nameBeispiel: kopf('name-beispiel'),
    auftraggeberFeld: kopf('auftraggeber-feld'),
    auftraggeberBeispiel: kopf('auftraggeber-beispiel'),
    termineEinleitung: '',
    termine: [],
    abschnitte: [],
    links: [],
    umbenennungen: {},
  };
  if (!planer.titel) fehler('Im Kopf fehlt „titel“ (z. B. „titel: Abschlussprojekt“)', 1);
  if (planer.titel.length > 40) fehler('Der Titel darf höchstens 40 Zeichen haben – er steht im Menü', 1);
  const bekannt = ['titel', 'untertitel', 'name-feld', 'name-beispiel', 'auftraggeber-feld', 'auftraggeber-beispiel'];
  for (const k of Object.keys(fm.data)) if (!bekannt.includes(k)) warnung(`Unbekannte Angabe „${k}“ im Kopf – erlaubt: ${bekannt.join(', ')}`, 1);

  // an „## “ zerlegen
  const vorher: Zeile[] = [];
  const teile: { ueberschrift: string; nr: number; zeilen: Zeile[] }[] = [];
  for (const z of zeilen) {
    if (z.text.startsWith('## ')) teile.push({ ueberschrift: z.text.slice(3).trim(), nr: z.nr, zeilen: [] });
    else if (teile.length) teile[teile.length - 1].zeilen.push(z);
    else vorher.push(z);
  }
  planer.einleitung = fliesstext(vorher);

  /** Kennungen von Checklisten und Fragen-Abschnitten – je Datei eindeutig; „termine“ ist vergeben */
  const abschnittIds = new Map<string, number>([['termine', 0]]);
  const pruefeId = (id: string, was: string, nr: number, schon: Map<string, number>): boolean => {
    if (!id) return (fehler(`${was} hat keine Kennung ({#…})`, nr), false);
    if (!ID_MUSTER.test(id)) return (fehler(`Kennung „${id}“ enthält ungültige Zeichen (erlaubt: a–z, 0–9, -)`, nr), false);
    if (schon.has(id)) return (fehler(schon.get(id) === 0 ? `Die Kennung „${id}“ ist vergeben` : `Kennung „${id}“ kommt doppelt vor (zuerst in Zeile ${schon.get(id)})`, nr), false);
    schon.set(id, nr);
    return true;
  };
  /** „Text {#kennung} – Hinweis“ */
  const punktMitId = (z: Zeile, was: string, schon: Map<string, number>): { id: string; text: string; rest: string } | null => {
    const m = PUNKT_MIT_ID.exec(z.text);
    if (!m) return (fehler(`${was} „${z.text.slice(0, 40)}“ hat keine Kennung – Form: „Text {#kennung} – Hinweis“`, z.nr), null);
    const text = kuerze(m[1]);
    if (!text) return (fehler(`${was} ohne Text`, z.nr), null);
    if (!pruefeId(m[2].trim(), `${was} „${text.slice(0, 40)}“`, z.nr, schon)) return null;
    return { id: m[2].trim(), text, rest: kuerze(m[3] ?? '') };
  };
  const kopfMitId = (ueberschrift: string, vorsatz: string, nr: number): { id: string; titel: string } | null => {
    const m = /^(.*?)\s*\{#([^}]*)\}\s*$/.exec(ueberschrift.slice(vorsatz.length));
    const titel = kuerze(m ? m[1] : ueberschrift.slice(vorsatz.length));
    if (!titel) return (fehler(`„${vorsatz.trim()}“ braucht einen Titel`, nr), null);
    if (!pruefeId(m ? m[2].trim() : '', `„${vorsatz}${titel}“`, nr, abschnittIds)) return null;
    return { id: m![2].trim(), titel };
  };

  let hatTermine = false;
  let hatZeit = false;
  let hatLinks = false;
  for (const t of teile) {
    const name = t.ueberschrift;
    if (name === 'Termine') {
      if (hatTermine) fehler('„## Termine“ gibt es doppelt', t.nr);
      hatTermine = true;
      planer.termineEinleitung = fliesstext(t.zeilen);
      const ids = new Map<string, number>();
      for (const z of punkte(t.zeilen)) {
        const p = punktMitId(z, 'Termin', ids);
        if (p) planer.termine.push({ id: p.id, label: p.text, hinweis: p.rest });
      }
      if (planer.termine.length === 0) fehler('„## Termine“ enthält keinen Termin', t.nr);
      if (planer.termine.length > MAX.termine) fehler(`Höchstens ${MAX.termine} Termine`, t.nr);
    } else if (name.startsWith('Checkliste:')) {
      const k = kopfMitId(name, 'Checkliste:', t.nr);
      const liste: PlanerCheckliste = { art: 'checkliste', id: k?.id ?? '', titel: k?.titel ?? '', gruppen: [] };
      const ids = new Map<string, number>();
      let gruppe: PlanerCheckliste['gruppen'][number] | null = null;
      let puffer: Zeile[] = [];
      const leere = () => {
        const ps = punkte(puffer)
          .map((z) => punktMitId(z, 'Punkt', ids))
          .filter((p) => p !== null)
          .map((p) => ({ id: p.id, text: p.text, hilfe: p.rest }));
        if (ps.length) {
          gruppe ??= { titel: '', punkte: [] };
          gruppe.punkte.push(...ps);
        }
        if (gruppe && gruppe.punkte.length) liste.gruppen.push(gruppe);
        puffer = [];
      };
      for (const z of t.zeilen) {
        if (z.text.startsWith('### ')) {
          leere();
          gruppe = { titel: kuerze(z.text.slice(4)), punkte: [] };
        } else puffer.push(z);
      }
      leere();
      const anzahl = liste.gruppen.reduce((n, g) => n + g.punkte.length, 0);
      if (anzahl === 0) fehler(`Die Checkliste „${liste.titel}“ enthält keinen Punkt`, t.nr);
      if (anzahl > MAX.punkte) fehler(`Höchstens ${MAX.punkte} Punkte je Checkliste`, t.nr);
      if (k) planer.abschnitte.push(liste);
    } else if (name === 'Zeitplanung') {
      if (hatZeit) fehler('„## Zeitplanung“ gibt es doppelt', t.nr);
      hatZeit = true;
      const h = wert(t.zeilen, 'hoechststunden');
      let hoechst: number | null = null;
      if (h) {
        hoechst = Number(h.text.replace(',', '.'));
        if (!Number.isFinite(hoechst) || hoechst <= 0 || hoechst > 2000) {
          fehler('„hoechststunden“ muss eine Zahl zwischen 1 und 2000 sein', h.nr);
          hoechst = null;
        }
      }
      const phasen: PlanerZeitplanung['phasen'] = [];
      for (const z of punkte(t.zeilen)) {
        const m = /^(.*?)\s*:\s*(\d+(?:[.,]\d+)?)\s*(?:h|Std\.?|Stunden)?$/.exec(z.text);
        if (!m || !m[1].trim()) {
          fehler(`Phase „${z.text.slice(0, 40)}“ nicht in der Form „Name: Stunden“ (z. B. „Planung: 8“)`, z.nr);
          continue;
        }
        phasen.push({ name: m[1].trim().slice(0, 120), stunden: Number(m[2].replace(',', '.')) });
      }
      if (phasen.length > MAX.phasen) fehler(`Höchstens ${MAX.phasen} Phasen`, t.nr);
      const summe = phasen.reduce((n, p) => n + p.stunden, 0);
      if (hoechst !== null && summe > hoechst) warnung(`Die vorgeschlagenen Phasen ergeben ${summe} Stunden – mehr als die Höchststunden (${hoechst})`, t.nr);
      planer.abschnitte.push({ art: 'zeitplanung', titel: 'Zeitplanung', hoechststunden: hoechst, hinweis: fliesstext(t.zeilen, ['hoechststunden']), phasen });
    } else if (name.startsWith('Fragen:')) {
      const k = kopfMitId(name, 'Fragen:', t.nr);
      const tm = wert(t.zeilen, 'timer');
      let timer: number | null = null;
      if (tm) {
        timer = Number(tm.text);
        if (!Number.isInteger(timer) || timer < 1 || timer > 180) {
          fehler('„timer“ muss eine ganze Zahl von Minuten zwischen 1 und 180 sein', tm.nr);
          timer = null;
        }
      }
      const ids = new Map<string, number>();
      const fragen = punkte(t.zeilen)
        .map((z) => punktMitId(z, 'Frage', ids))
        .filter((p) => p !== null)
        .map((p) => ({ id: p.id, text: p.text }));
      if (fragen.length === 0 && timer === null) fehler(`„${name}“ enthält weder Fragen noch eine Uhr (timer)`, t.nr);
      if (fragen.length > MAX.fragen) fehler(`Höchstens ${MAX.fragen} Fragen je Abschnitt`, t.nr);
      if (k) planer.abschnitte.push({ art: 'fragen', id: k.id, titel: k.titel, einleitung: fliesstext(t.zeilen, ['timer']), timerMinuten: timer, fragen });
    } else if (name === 'Links') {
      if (hatLinks) fehler('„## Links“ gibt es doppelt', t.nr);
      hatLinks = true;
      for (const z of punkte(t.zeilen)) {
        const m = /^\[([^\]]+)\]\(([^)\s]+)\)\s*(?:[–-]\s*(.*))?$/.exec(z.text);
        if (!m) {
          fehler('Link nicht in der Form „[Titel](https://…) – Beschreibung“', z.nr);
          continue;
        }
        if (!m[2].startsWith('https://')) {
          fehler(`Link „${m[1]}“ muss mit https:// beginnen`, z.nr);
          continue;
        }
        planer.links.push({ titel: kuerze(m[1]), url: m[2], info: kuerze(m[3] ?? '') });
      }
    } else if (name === 'Umbenennungen') {
      for (const z of punkte(t.zeilen)) {
        const m = /^([a-z0-9-]+\.[a-z0-9-]+)\s*(?:→|->|=>)\s*([a-z0-9-]+\.[a-z0-9-]+)$/.exec(z.text);
        if (!m) {
          fehler('Umbenennung nicht in der Form „alt.kennung → neu.kennung“ (z. B. „antrag.thema → antrag.bezeichnung“)', z.nr);
          continue;
        }
        planer.umbenennungen[m[1]] = m[2];
      }
    } else {
      fehler(`Unbekannter Abschnitt „## ${name}“ – erlaubt: Termine, Checkliste: …, Zeitplanung, Fragen: …, Links, Umbenennungen`, t.nr);
    }
  }
  if (planer.abschnitte.length > MAX.abschnitte) fehler(`Höchstens ${MAX.abschnitte} Abschnitte (Checklisten, Zeitplanung, Fragen)`);
  if (planer.termine.length === 0 && planer.abschnitte.length === 0) fehler('Der Planer ist leer – er braucht mindestens Termine, eine Checkliste, die Zeitplanung oder Fragen');

  // Umbenennungen: Das Ziel muss es geben, die alte Kennung darf es nicht mehr geben
  const vorhanden = planerKennungen(planer);
  for (const [alt, neu] of Object.entries(planer.umbenennungen)) {
    if (!vorhanden.has(neu)) fehler(`Umbenennung: Die neue Kennung „${neu}“ gibt es nicht`);
    if (vorhanden.has(alt)) fehler(`Umbenennung: Die alte Kennung „${alt}“ gibt es noch`);
    if (neu in planer.umbenennungen) fehler(`Umbenennung: Kette „${alt}“ → „${neu}“ → „${planer.umbenennungen[neu]}“ – bitte direkt auf die letzte Kennung zeigen`);
  }

  return { planer: meldungen.some((m) => m.level === 'fehler') ? null : planer, meldungen };
}

/** Alle Kennungen, an denen Eintragungen der Azubis hängen: „termine.<id>“, „<checkliste>.<punkt>“, „<fragen>.<frage>“. */
export function planerKennungen(p: Planer): Set<string> {
  const s = new Set<string>();
  for (const t of p.termine) s.add(`termine.${t.id}`);
  for (const a of p.abschnitte) {
    if (a.art === 'checkliste') for (const g of a.gruppen) for (const x of g.punkte) s.add(`${a.id}.${x.id}`);
    if (a.art === 'fragen') for (const f of a.fragen) s.add(`${a.id}.${f.id}`);
  }
  return s;
}
