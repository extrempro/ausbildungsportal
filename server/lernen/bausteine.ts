import { createHash } from 'node:crypto';
import type { UnterthemaInhalt } from './typen';

/**
 * Bausteine eines Unterthemas mit Prüfsumme – damit lässt sich zeigen, was sich seit dem letzten Blick geändert hat.
 * Schlüssel: Kernbegriff, Tabelle (Titel und Kopf), Tabellenzeile (Tabelle und erste Zelle), Befehl, Merksatz, Prüfungsfrage, Abbildung.
 * Die Reihenfolge zählt nicht: Wird nur umsortiert, ist nichts markiert.
 */
export type Bausteine = Record<string, string>;
export type Markierung = 'neu' | 'geaendert' | null;

export interface Aenderungen {
  begriffe: Markierung[];
  tabellen: { titel: Markierung; zeilen: Markierung[] }[];
  befehle: Markierung[];
  merksatz: Markierung;
  frage: Markierung;
  abbildungen: Markierung[];
  /** so viele Bausteine gibt es nicht mehr */
  entfernt: number;
  /** so viele Bausteine sind markiert */
  markiert: number;
}

const pruef = (...teile: string[]) =>
  createHash('sha1')
    .update(teile.map((t) => t.replace(/\s+/g, ' ').trim()).join('\u0001'))
    .digest('hex')
    .slice(0, 12);

/** Schlüssel eindeutig machen, falls zwei Bausteine gleich heißen (z. B. zwei Zeilen mit derselben ersten Zelle). */
function eindeutig(gesehen: Map<string, number>, schluessel: string): string {
  const n = gesehen.get(schluessel) ?? 0;
  gesehen.set(schluessel, n + 1);
  return n === 0 ? schluessel : `${schluessel}#${n + 1}`;
}

interface Liste {
  begriffe: string[];
  tabellen: { titel: string; zeilen: string[] }[];
  befehle: string[];
  abbildungen: string[];
}

/** Schlüssel in der Reihenfolge der Anzeige – und die Prüfsummen dazu. */
function zerlege(u: UnterthemaInhalt): { liste: Liste; bausteine: Bausteine } {
  const b: Bausteine = {};
  const g = new Map<string, number>();
  const liste: Liste = { begriffe: [], tabellen: [], befehle: [], abbildungen: [] };
  for (const x of u.begriffe) {
    const k = eindeutig(g, `begriff:${x.begriff}`);
    b[k] = pruef(x.begriff, x.erklaerung);
    liste.begriffe.push(k);
  }
  for (const t of u.tabellen) {
    const k = eindeutig(g, `tabelle:${t.titel}`);
    b[k] = pruef(...t.kopf);
    const zeilen = t.zeilen.map((z) => {
      const kz = eindeutig(g, `${k}|${z[0] ?? ''}`);
      b[kz] = pruef(...z);
      return kz;
    });
    liste.tabellen.push({ titel: k, zeilen });
  }
  for (const x of u.befehle) {
    const k = eindeutig(g, `befehl:${x.befehl}`);
    b[k] = pruef(x.befehl, x.info);
    liste.befehle.push(k);
  }
  if (u.merksatz) b.merksatz = pruef(u.merksatz);
  if (u.frage) b.frage = pruef(u.frage.frage, ...u.frage.loesung);
  for (const a of u.abbildungen) {
    const k = eindeutig(g, `abbildung:${a.titel}`);
    b[k] = pruef(a.titel, ...a.bilder.flatMap((x) => [x.datei, x.alt]));
    liste.abbildungen.push(k);
  }
  return { liste, bausteine: b };
}

export const bausteine = (u: UnterthemaInhalt): Bausteine => zerlege(u).bausteine;

/** Vergleicht den aktuellen Inhalt mit einem früheren Stand. Eine neue Tabelle ist als Ganzes markiert, ihre Zeilen nicht einzeln. */
export function vergleiche(u: UnterthemaInhalt, vorher: Bausteine): Aenderungen {
  const { liste, bausteine: jetzt } = zerlege(u);
  let markiert = 0;
  const m = (k: string): Markierung => {
    const r: Markierung = !(k in vorher) ? 'neu' : vorher[k] !== jetzt[k] ? 'geaendert' : null;
    if (r) markiert++;
    return r;
  };
  return {
    begriffe: liste.begriffe.map(m),
    tabellen: liste.tabellen.map((t) => {
      const titel = m(t.titel);
      return { titel, zeilen: titel === 'neu' ? t.zeilen.map(() => null) : t.zeilen.map(m) };
    }),
    befehle: liste.befehle.map(m),
    merksatz: u.merksatz ? m('merksatz') : null,
    frage: u.frage ? m('frage') : null,
    abbildungen: liste.abbildungen.map(m),
    // Zeilen einer weggefallenen Tabelle zählen nicht einzeln
    entfernt: Object.keys(vorher).filter((k) => !(k in jetzt) && !(k.includes('|') && !(k.split('|')[0] in jetzt))).length,
    markiert,
  };
}
