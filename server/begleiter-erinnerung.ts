import type { Kontext } from './api';
import { ausbildungswochen } from './berichte';
import { firmentermineZwischen } from './firmentermin';
import { kalenderwoche, montagVon, plusTage, tageZwischen } from './kalender';
import { mitPlanerTerminen } from './planer';
import { dauerVon, leseProfil } from './stammdaten';
import { arbeitstage, urlaubsZeitraeume } from './urlaub';

/**
 * Erinnerungen des Begleiters: kurze Hinweise auf das, was für den Azubi ansteht.
 *
 * - Sie entstehen bei jeder Abfrage neu aus dem, was der Azubi im Portal ohnehin sieht (Berichtsheft, Plan, Urlaub,
 *   Firmentermine, Prüfungstermine). Es wird nichts dazu gespeichert und niemand anderes erfährt davon.
 * - Jede Art lässt sich vom Azubi einzeln abschalten (Spalte begleiter.erinnern_aus).
 * - Die Oberfläche zeigt höchstens eine am Tag und jede nur einmal; dazu dient der „schluessel“.
 * - Erinnert wird nur an Pflichten und Termine – nie ans Lernen.
 */
export const ERINNERUNGEN = ['bericht_woche', 'bericht_alt', 'bericht_zurueck', 'unterschrift', 'schule', 'firmentermin', 'pruefung', 'urlaub'] as const;
export type ErinnerungArt = (typeof ERINNERUNGEN)[number];

export interface Erinnerung {
  art: ErinnerungArt;
  /** gleich = dieselbe Erinnerung; die Oberfläche zeigt jeden Schlüssel nur einmal */
  schluessel: string;
  text: string;
  /** wohin der Knopf an der Erinnerung führt */
  zu: string;
  knopf: string;
}

const WOCHENTAG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const wochentag = (tag: string) => tageZwischen(montagVon(tag), tag);
/** „morgen“, „übermorgen“ oder „am Montag“ */
const wann = (heute: string, tag: string) => {
  const n = tageZwischen(heute, tag);
  return n === 1 ? 'morgen' : n === 2 ? 'übermorgen' : `am ${WOCHENTAG[wochentag(tag)]}`;
};
const gross = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Alle Erinnerungen, die für den Azubi an diesem Tag anstehen – die wichtigste zuerst. Abgeschaltete Arten fehlen. */
export function erinnerungenAm(k: Kontext, azubiId: number, tag: string, aus: readonly string[] = []): Erinnerung[] {
  const { db } = k;
  const profil = leseProfil(db, azubiId);
  const dauer = dauerVon(db, profil);
  const montag = montagVon(tag);
  const wt = wochentag(tag);
  const liste: Erinnerung[] = [];
  const dazu = (e: Erinnerung) => {
    if (!aus.includes(e.art)) liste.push(e);
  };

  // --- Termine für Prüfung und Planer: einen Tag und eine Woche vorher ---
  const termine = mitPlanerTerminen(k, azubiId, profil.pruefungen);
  for (const t of termine.filter((x) => x.datum === plusTage(tag, 1))) {
    dazu({ art: 'pruefung', schluessel: `pruefung:${t.datum}:1:${t.bezeichnung}`, text: `Morgen steht an: ${t.bezeichnung}. Du schaffst das!`, zu: '/', knopf: 'Plan ansehen' });
  }

  // --- Berichtsheft ---
  const wochen = dauer ? ausbildungswochen(dauer.beginn, dauer.ende, tag) : [];
  if (wochen.length) {
    const status = new Map((db.prepare('SELECT montag, status FROM bericht WHERE azubi_id = ?').all(azubiId) as unknown as { montag: string; status: string }[]).map((z) => [z.montag, z.status]));
    const offen = (m: string) => !status.has(m) || status.get(m) === 'entwurf';
    const zurueck = [...status].filter(([, s]) => s === 'zurueck').map(([m]) => m).sort();
    if (zurueck.length) {
      const kw = kalenderwoche(zurueck[0]).kw;
      dazu({
        art: 'bericht_zurueck',
        // einmal je Woche, solange der Bericht nicht wieder eingereicht ist
        schluessel: `bericht_zurueck:${montag}:${zurueck[0]}`,
        text: zurueck.length === 1 ? `Dein Bericht für KW ${kw} kam zurück. Schau dir den Kommentar an und reiche ihn noch einmal ein.` : `${zurueck.length} Berichte kamen zurück. Schau dir die Kommentare an und reiche sie noch einmal ein.`,
        zu: zurueck.length === 1 ? `/berichtsheft/${zurueck[0]}` : '/berichtsheft',
        knopf: zurueck.length === 1 ? 'Bericht öffnen' : 'Berichtsheft öffnen',
      });
    }
    // laufende Woche: ab Donnerstag, jeden Tag einmal, bis der Bericht eingereicht ist
    if (wt >= 3 && wochen.includes(montag) && offen(montag)) {
      dazu({ art: 'bericht_woche', schluessel: `bericht_woche:${tag}`, text: `Der Bericht für diese Woche (KW ${kalenderwoche(montag).kw}) ist noch nicht eingereicht.`, zu: `/berichtsheft/${montag}`, knopf: 'Bericht schreiben' });
    }
    // vergangene Wochen: einmal je Woche
    const alt = wochen.filter((m) => m < montag && offen(m));
    if (alt.length) {
      const letzte = alt[alt.length - 1];
      dazu({
        art: 'bericht_alt',
        schluessel: `bericht_alt:${montag}`,
        text: alt.length === 1 ? `Der Bericht für KW ${kalenderwoche(letzte).kw} fehlt noch.` : `Dir fehlen noch ${alt.length} Berichte aus vergangenen Wochen.`,
        zu: alt.length === 1 ? `/berichtsheft/${letzte}` : '/berichtsheft',
        knopf: alt.length === 1 ? 'Bericht schreiben' : 'Berichtsheft öffnen',
      });
    }
  }
  // ohne Unterschrift lässt sich kein Bericht einreichen – einmal je Woche
  if (!db.prepare('SELECT 1 FROM unterschrift WHERE benutzer_id = ?').get(azubiId)) {
    dazu({ art: 'unterschrift', schluessel: `unterschrift:${montag}`, text: 'Deine Unterschrift fehlt noch. Ohne sie kannst du keinen Bericht einreichen.', zu: '/konto', knopf: 'Unterschrift hinterlegen' });
  }

  for (const t of termine.filter((x) => x.datum === plusTage(tag, 7))) {
    dazu({ art: 'pruefung', schluessel: `pruefung:${t.datum}:7:${t.bezeichnung}`, text: `In einer Woche: ${t.bezeichnung}.`, zu: '/', knopf: 'Plan ansehen' });
  }

  // --- Firmentermin: zwei Tage vorher (oder am Tag davor, falls du vorgestern nicht hier warst) ---
  for (const f of firmentermineZwischen(db, plusTage(tag, 1), plusTage(tag, 2)).filter((x) => x.von > tag)) {
    dazu({ art: 'firmentermin', schluessel: `firmentermin:${f.id}:${f.von}`, text: `${gross(wann(tag, f.von))}: ${f.titel}.`, zu: '/', knopf: 'Plan ansehen' });
  }

  // --- Berufsschule: ab Freitag, wenn sie nächste Woche beginnt (der Plan kennt Wochen, keine einzelnen Schultage) ---
  const naechste = plusTage(montag, 7);
  if (wt >= 4) {
    const schule = (m: string) => !!db.prepare("SELECT 1 FROM plan_eintrag WHERE azubi_id = ? AND art = 'schule' AND von <= ? AND bis >= ?").get(azubiId, m, m);
    if (schule(naechste) && !schule(montag)) {
      dazu({ art: 'schule', schluessel: `schule:${naechste}`, text: 'Nächste Woche ist Berufsschule. Denk an deine Sachen.', zu: '/', knopf: 'Plan ansehen' });
    }
  }

  // --- Urlaub: am letzten Arbeitstag davor ---
  for (const u of urlaubsZeitraeume(db, azubiId, 'genehmigt', plusTage(tag, 1), plusTage(tag, 5)).filter((x) => x.von > tag)) {
    // liegt zwischen heute und dem ersten Urlaubstag noch ein Arbeitstag, ist es zu früh
    if (arbeitstage(db, plusTage(tag, 1), plusTage(u.von, -1)).length === 0) {
      dazu({ art: 'urlaub', schluessel: `urlaub:${u.id}:${u.von}`, text: `${gross(wann(tag, u.von)).replace(/^Am /, 'Ab ').replace(/^Morgen$/, 'Ab morgen').replace(/^Übermorgen$/, 'Ab übermorgen')} hast du Urlaub. Erhol dich gut!`, zu: '/urlaub', knopf: 'Urlaub ansehen' });
    }
  }
  return liste;
}
