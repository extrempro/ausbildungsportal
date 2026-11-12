import type { Inhalt } from './berichte';
import { A4, GRAU, PdfDokument, textBreite, umbruch } from './pdf';
import type { PdfSeite } from './pdf';

/** Was das PDF von einem Bericht braucht – dieselben Angaben wie die Ansicht am Bildschirm. */
export interface BerichtFuerPdf {
  montag: string;
  sonntag: string;
  kw: number;
  jahr: number;
  ausbildungsjahr: number | null;
  status: string;
  inhalt: Inhalt;
  summe: { gesamt: number };
  soll: number;
  signaturen: { art: string; name: string; pfad: string; zeit: string }[];
  kopf: { azubi: string; beruf: string; betrieb: string; ausbilder: string };
}

export interface HeftAngaben {
  azubi: string;
  berichte: BerichtFuerPdf[];
  deckblatt: boolean;
  /** nur ein Ausbildungsjahr gewählt (für das Deckblatt) */
  ausbildungsjahr: number | null;
  nurAbgezeichnete: boolean;
  /** Logo des Betriebs (PNG oder JPEG) – fürs Deckblatt und blass hinter den Unterschriften */
  logo: Buffer | null;
  jetzt: Date;
}

const RAND = 48;
const BREITE = A4.breite - 2 * RAND;
const UNTEN = A4.hoehe - 56;
const GRUND_TEXT: Record<string, string> = { urlaub: 'Urlaub', krank: 'Krank', feiertag: 'Feiertag', sonstiges: 'Sonstiges' };
const ABSCHNITTE = [
  { schluessel: 'betrieb', titel: 'Betriebliche Tätigkeiten' },
  { schluessel: 'unterweisung', titel: 'Unterweisungen und Schulungen' },
  { schluessel: 'schule', titel: 'Berufsschule' },
] as const;
/** Zeichenfläche, in der Unterschriften gespeichert sind (src/unterschrift.tsx) */
const UNTERSCHRIFT = { breite: 600, hoehe: 200 };

const datum = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '–');
const stunden = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');
const woche = (b: BerichtFuerPdf) => `Woche ${b.kw}/${b.jahr} · ${b.montag.slice(8, 10)}.${b.montag.slice(5, 7)}.–${datum(b.sonntag)}`;

/** Das Berichtsheft als PDF: wahlweise ein Deckblatt, dann jeder Bericht auf einer eigenen Seite (lange Berichte laufen auf die nächste). */
export function berichtsheftPdf(a: HeftAngaben): Buffer {
  const erster = a.berichte[0];
  const letzter = a.berichte[a.berichte.length - 1];
  const zeitraum = erster ? `${datum(erster.montag)} bis ${datum(letzter.sonntag)}` : '';
  const dok = new PdfDokument({ titel: a.berichte.length === 1 && !a.deckblatt ? `Ausbildungsnachweis ${a.azubi}, ${woche(erster)}` : `Berichtsheft ${a.azubi}${zeitraum ? `, ${zeitraum}` : ''}`, verfasser: a.azubi, erstellt: a.jetzt });
  const logo = a.logo ? dok.bild(a.logo) : null;
  const abgezeichnet = a.berichte.filter((b) => b.status === 'abgezeichnet').length;

  if (a.deckblatt && erster) {
    const s = dok.seite();
    const mitte = A4.breite / 2;
    let y = 150;
    if (logo !== null) {
      s.bild(logo, { x: mitte - 110, y, breite: 220, hoehe: 80 });
      y += 110;
    }
    s.text(mitte, y, 'AUSBILDUNGSNACHWEIS', { groesse: 11, fett: true, farbe: GRAU, mitte: true });
    s.text(mitte, y + 40, 'Berichtsheft', { groesse: 30, fett: true, mitte: true });
    s.text(mitte, y + 76, erster.kopf.azubi || a.azubi, { groesse: 18, fett: true, mitte: true });
    y += 130;
    const zeilen: [string, string][] = [];
    if (erster.kopf.beruf) zeilen.push(['Ausbildungsberuf', erster.kopf.beruf]);
    if (erster.kopf.betrieb) zeilen.push(['Ausbildungsbetrieb', erster.kopf.betrieb]);
    if (letzter.kopf.ausbilder) zeilen.push(['Ausbilder/in', letzter.kopf.ausbilder]);
    zeilen.push(['Zeitraum', `${zeitraum}${a.ausbildungsjahr ? ` (${a.ausbildungsjahr}. Ausbildungsjahr)` : ''}`]);
    const offen = a.berichte.length - abgezeichnet;
    const anzahl = a.berichte.length === 1 ? '1 Wochenbericht' : `${a.berichte.length} Wochenberichte`;
    zeilen.push(['Inhalt', offen === 0 ? `${anzahl}, ${a.berichte.length === 1 ? 'abgezeichnet' : 'alle abgezeichnet'}` : `${anzahl}: ${abgezeichnet} abgezeichnet, ${offen} nicht abgezeichnet (als solche gekennzeichnet)`]);
    const links = 110;
    const spalte = 135;
    for (const [name, wert] of zeilen) {
      s.text(links, y, name, { groesse: 11, farbe: GRAU });
      const teile = umbruch(wert, A4.breite - 2 * links - spalte, 11, true);
      teile.forEach((t, i) => s.text(links + spalte, y + i * 15, t, { groesse: 11, fett: true }));
      y += teile.length * 15 + 8;
      s.linie(links, y - 12, A4.breite - links, y - 12, { dicke: 0.4, farbe: [0.7, 0.72, 0.76] });
      y += 10;
    }
    s.text(mitte, y + 20, `Erstellt am ${datum(a.jetzt.toISOString())} im Ausbildungsportal`, { groesse: 9, farbe: GRAU, mitte: true });
  }

  for (const b of a.berichte) zeichneBericht(dok, b, logo);

  // Fußzeile erst jetzt – die Gesamtzahl der Seiten steht fest
  dok.seiten.forEach((s, i) => {
    if (a.deckblatt && i === 0) return;
    s.text(RAND, A4.hoehe - 30, `Berichtsheft ${a.azubi}`, { groesse: 8, farbe: GRAU });
    s.text(A4.breite - RAND, A4.hoehe - 30, `Seite ${i + 1} von ${dok.seiten.length}`, { groesse: 8, farbe: GRAU, rechts: true });
  });
  return dok.ausgabe();
}

const WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const ART_KURZ: Record<(typeof ABSCHNITTE)[number]['schluessel'], string> = { betrieb: 'Betrieb', unterweisung: 'Unterweisung', schule: 'Berufsschule' };

/** Tagesform: Montag bis Freitag immer, Samstag und Sonntag nur, wenn dort etwas steht. */
function tageVon(b: BerichtFuerPdf): { tag: string; name: string; summe: number; zeilen: { text: string; stunden: number }[] }[] {
  const tage: ReturnType<typeof tageVon> = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(`${b.montag}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const tag = d.toISOString().slice(0, 10);
    const zeilen = [
      ...ABSCHNITTE.flatMap((a) => b.inhalt[a.schluessel].filter((e) => e.tag === tag).map((e) => ({ text: `${ART_KURZ[a.schluessel]}: ${e.text}`, stunden: e.stunden }))),
      ...b.inhalt.abwesenheit.filter((e) => e.tag === tag).map((e) => ({ text: `Abwesenheit: ${GRUND_TEXT[e.grund] ?? e.grund}${e.text ? ` (${e.text})` : ''}`, stunden: e.stunden })),
    ];
    if (i < 5 || zeilen.length > 0) tage.push({ tag, name: WOCHENTAGE[i], summe: zeilen.reduce((n, z) => n + z.stunden, 0), zeilen });
  }
  return tage;
}

function zeichneBericht(dok: PdfDokument, b: BerichtFuerPdf, logo: number | null): void {
  let s: PdfSeite = dok.seite();
  let y = 0;

  /** Kopf einer Seite; auf Folgeseiten kürzer */
  const vermerk = b.status === 'abgezeichnet' ? '' : b.status === 'eingereicht' ? 'NICHT ABGEZEICHNET' : 'ENTWURF';
  const kopf = (fortsetzung: boolean) => {
    // nicht abgezeichnete Berichte sind auf jeder Seite unübersehbar gekennzeichnet
    if (vermerk) s.wasserzeichen(vermerk, vermerk.length > 10 ? 50 : 84);
    y = 56;
    s.text(RAND, y, 'Ausbildungsnachweis', { groesse: 12, fett: true });
    const rest = ` · ${woche(b)}${fortsetzung ? ' · Fortsetzung' : b.ausbildungsjahr ? ` · ${b.ausbildungsjahr}. Ausbildungsjahr` : ''}`;
    s.text(RAND + textBreite('Ausbildungsnachweis', 12, true), y, rest, { groesse: 12 });
    y += 15;
    const wer = `${[b.kopf.azubi, b.kopf.beruf, b.kopf.betrieb].filter(Boolean).join(' · ')}${b.kopf.ausbilder ? ` · Ausbilder: ${b.kopf.ausbilder}` : ''}`;
    for (const t of umbruch(wer, BREITE, 9)) {
      s.text(RAND, y, t, { groesse: 9, farbe: GRAU });
      y += 12;
    }
    // ein Ausdruck vor dem Einreichen ist als solcher zu erkennen
    if (!fortsetzung && (b.status === 'fehlt' || b.status === 'entwurf' || b.status === 'zurueck')) {
      y += 3;
      s.text(RAND, y, 'Entwurf – noch nicht eingereicht und nicht unterschrieben', { groesse: 9, fett: true });
      y += 12;
    } else if (!fortsetzung && b.status === 'eingereicht') {
      y += 3;
      s.text(RAND, y, 'Eingereicht – noch nicht abgezeichnet', { groesse: 9, fett: true });
      y += 12;
    }
    s.linie(RAND, y - 4, A4.breite - RAND, y - 4, { dicke: 1.2 });
    y += 16;
  };
  /** Sorgt dafür, dass `hoehe` noch auf die Seite passt – sonst geht es auf einer neuen weiter. */
  const platz = (hoehe: number) => {
    if (y + hoehe <= UNTEN) return;
    s = dok.seite();
    kopf(true);
  };
  const titel = (text: string) => {
    platz(34);
    s.text(RAND, y, text, { groesse: 10.5, fett: true });
    y += 17;
  };
  /** Eine Zeile aus Text (umbrochen) und Stunden rechts */
  const zeile = (text: string, std: number) => {
    const teile = umbruch(text, BREITE - 70, 10);
    teile.forEach((t, i) => {
      platz(14);
      s.text(RAND, y, t, { groesse: 10 });
      if (i === 0) s.text(A4.breite - RAND, y, `${stunden(std)} h`, { groesse: 10, rechts: true });
      y += 13.5;
    });
    s.linie(RAND, y - 8, A4.breite - RAND, y - 8, { dicke: 0.3, farbe: [0.8, 0.82, 0.85] });
    y += 5;
  };
  const leer = () => {
    s.text(RAND, y, '–', { groesse: 10, farbe: GRAU });
    y += 16;
  };

  kopf(false);
  if (b.inhalt.form === 'tag') {
    // Tagesform: je Tag eine Überschrift mit Tagessumme, darunter die Einträge mit ihrer Art und die Abwesenheit
    for (const t of tageVon(b)) {
      titel(`${t.name}, ${datum(t.tag)}${t.summe > 0 ? ` · ${stunden(t.summe)} h` : ''}`);
      if (t.zeilen.length === 0) leer();
      for (const z of t.zeilen) zeile(z.text, z.stunden);
      y += 6;
    }
    y += 4;
  } else {
    for (const a of ABSCHNITTE) {
      titel(a.titel);
      const liste = b.inhalt[a.schluessel];
      if (liste.length === 0) leer();
      for (const e of liste) zeile(e.text, e.stunden);
      y += 8;
    }
    titel('Abwesenheit');
    if (b.inhalt.abwesenheit.length === 0) leer();
    for (const e of b.inhalt.abwesenheit) zeile(`${datum(e.tag)} · ${GRUND_TEXT[e.grund] ?? e.grund}${e.text ? ` (${e.text})` : ''}`, e.stunden);
    y += 10;
  }

  platz(24);
  const summe = `Summe: ${stunden(b.summe.gesamt)} Stunden`;
  s.text(RAND, y, summe, { groesse: 11, fett: true });
  s.text(RAND + textBreite(`${summe} `, 11, true), y, `(Soll ${stunden(b.soll)})`, { groesse: 11, farbe: GRAU });
  y += 26;

  // Unterschriften: zwei Felder nebeneinander, bleiben zusammen auf einer Seite
  platz(112);
  const feldBreite = (BREITE - 30) / 2;
  const felder = [
    { titel: 'Auszubildende/r', sig: b.signaturen.find((x) => x.art === 'azubi') },
    { titel: 'Ausbilder/in bzw. Ausbildungsbeauftragte/r', sig: b.signaturen.find((x) => x.art === 'abzeichnung') },
  ];
  felder.forEach((f, i) => {
    const x = RAND + i * (feldBreite + 30);
    const feld = { x, y, breite: feldBreite, hoehe: 62 };
    // das Logo des Betriebs blass dahinter, wie ein Stempel
    if (logo !== null) s.bild(logo, { x: x + 20, y: y + 4, breite: feldBreite - 40, hoehe: 54 }, 0.14);
    if (f.sig) s.strichzug(f.sig.pfad, UNTERSCHRIFT, feld, 1.1);
    s.linie(x, y + 64, x + feldBreite, y + 64, { dicke: 0.7 });
    if (f.sig) s.text(x, y + 77, `${f.sig.name}, ${datum(f.sig.zeit)}`, { groesse: 9 });
    s.text(x, y + 89, f.titel, { groesse: 8, farbe: GRAU });
  });
  y += 100;
}
