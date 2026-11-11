import { createHash } from 'node:crypto';
import type { Inhalte } from './store';

/**
 * Üben im Lernmodul: Karteikarten und Quiz entstehen aus dem, was schon in den Cheatsheets steht –
 * den Kernbegriffen und der Prüfungsfrage je Unterthema. Neue Inhalte braucht es dafür nicht.
 * Die Logik stammt aus dem FISI-Lernkompass (src/lib/training.ts).
 */
export interface Karte {
  id: string;
  art: 'begriff' | 'frage';
  feld: string;
  feldTitel: string;
  unterthema: string;
  unterthemaTitel: string;
  vorne: string;
  /** Begriff: Erklärung; Frage: Lösungsschritte */
  hinten: string[];
}

const kurz = (text: string) => createHash('sha1').update(text).digest('hex').slice(0, 10);

const KARTEN = new WeakMap<Inhalte, Karte[]>();
export function kartenVon(inhalte: Inhalte): Karte[] {
  let k = KARTEN.get(inhalte);
  if (k) return k;
  k = [];
  for (const f of inhalte.themenfelder) {
    for (const u of f.unterthemen) {
      const basis = { feld: f.id, feldTitel: f.titel, unterthema: u.id, unterthemaTitel: u.titel };
      for (const b of u.begriffe) k.push({ ...basis, id: `b:${f.id}.${u.id}:${kurz(b.begriff)}`, art: 'begriff', vorne: b.begriff, hinten: [b.erklaerung] });
      if (u.frage) k.push({ ...basis, id: `f:${f.id}.${u.id}`, art: 'frage', vorne: u.frage.frage, hinten: u.frage.loesung });
    }
  }
  KARTEN.set(inhalte, k);
  return k;
}

/** Lernkartei: Nach „gewusst“ wandert die Karte ein Fach weiter und kommt später wieder; nach „nicht gewusst“ zurück in Fach 1. */
export const FAECHER = 5;
const PAUSE_TAGE = [0, 1, 3, 7, 14, 30];
export function naechstesFach(fach: number, gewusst: boolean): { fach: number; tage: number } {
  const neu = gewusst ? Math.min(FAECHER, fach + 1) : 1;
  return { fach: neu, tage: gewusst ? PAUSE_TAGE[neu] : 0 };
}

/** Zufall mit Startwert – damit sich eine Runde wiederholen lässt. */
export function zufall(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function mische<T>(l: T[], r: () => number): T[] {
  const x = [...l];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

/** Ersetzt den gesuchten Begriff (und seine Teile in Klammern) in der Erklärung durch „…“, damit die Frage ihn nicht verrät. */
export function maskiere(text: string, begriff: string): string {
  const teile = [begriff, ...begriff.split(/[()/,]/)].map((t) => t.trim()).filter((t) => t.length >= 3);
  let s = text;
  for (const t of teile.sort((a, b) => b.length - a.length)) {
    // nur ganze Wörter ausblenden: „RAM“ soll nicht mitten in „Programme“ treffen. Längere Begriffe dürfen eine Endung tragen („Routers“).
    const ende = t.length <= 4 ? '(?![\\p{L}\\p{N}])' : '';
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{N}])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${ende}`, 'giu'), '…');
  }
  return s;
}

export interface QuizFrage {
  id: string;
  /** die Erklärung, der gesuchte Begriff ist ausgeblendet */
  text: string;
  begriff: string;
}
/** Ein Quiz gibt es für ein Unterthema erst ab so vielen brauchbaren Fragen. */
export const QUIZ_MIN = 3;
/** bestanden ab diesem Anteil richtiger Antworten */
export const QUIZ_BESTANDEN = 0.8;
/** „Meister“: fehlerfrei, frühestens so viele Tage nach dem Bestehen */
export const MEISTER_TAGE = 7;

const QUIZ = new WeakMap<Inhalte, Map<string, QuizFrage[]>>();
/**
 * Quizfragen je Unterthema ('themenfeld.unterthema'): zu einer Erklärung den passenden Begriff finden.
 * Unterthemen mit weniger als QUIZ_MIN brauchbaren Fragen haben kein Quiz – ebenso Themenfelder, die zu wenige
 * Begriffe für falsche Antworten hergeben.
 */
export function quizFragen(inhalte: Inhalte): Map<string, QuizFrage[]> {
  let m = QUIZ.get(inhalte);
  if (m) return m;
  m = new Map();
  const alle = kartenVon(inhalte).filter((k) => k.art === 'begriff');
  const namen = new Set(alle.map((k) => k.vorne.toLowerCase()));
  for (const f of inhalte.themenfelder) {
    for (const u of f.unterthemen) {
      const fragen: QuizFrage[] = [];
      const gesehen = new Set<string>();
      for (const k of alle.filter((x) => x.feld === f.id && x.unterthema === u.id)) {
        const text = maskiere(k.hinten[0], k.vorne);
        // nach dem Ausblenden zu wenig übrig, oder derselbe Begriff steht doppelt im Unterthema
        if (text.replace(/[…\s]/g, '').length < 12 || gesehen.has(k.vorne.toLowerCase())) continue;
        gesehen.add(k.vorne.toLowerCase());
        fragen.push({ id: k.id, text, begriff: k.vorne });
      }
      // es braucht drei falsche Antworten je Frage
      if (fragen.length >= QUIZ_MIN && namen.size >= 4) m.set(`${f.id}.${u.id}`, fragen);
    }
  }
  QUIZ.set(inhalte, m);
  return m;
}

/** Antwortmöglichkeiten einer Frage: der richtige Begriff und drei falsche – bevorzugt aus demselben Unterthema und Themenfeld. */
export function optionenFuer(inhalte: Inhalte, feld: string, unterthema: string, frage: QuizFrage, r: () => number): string[] {
  const alle = kartenVon(inhalte).filter((k) => k.art === 'begriff' && k.vorne.toLowerCase() !== frage.begriff.toLowerCase());
  const nah = mische(alle.filter((x) => x.feld === feld && x.unterthema === unterthema), r);
  const imFeld = mische(alle.filter((x) => x.feld === feld && x.unterthema !== unterthema), r);
  const rest = mische(alle.filter((x) => x.feld !== feld), r);
  const falsch: string[] = [];
  for (const x of [...nah.slice(0, 2), ...imFeld, ...rest]) {
    if (falsch.length >= 3) break;
    if (!falsch.some((y) => y.toLowerCase() === x.vorne.toLowerCase())) falsch.push(x.vorne);
  }
  return mische([frage.begriff, ...falsch], r);
}
