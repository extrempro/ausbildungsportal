import { Fehler, koerper } from './api-basis';
import type { Ctx, Route } from './api-basis';
import { paketVon } from './lernen';
import type { Paket } from './lernen';
import { kartenVon, mische, zufall } from './lernen/ueben';

/**
 * Lernspiele im Game Vault: Begriffe-Memory und Zeit-Sprint mit den Kernbegriffen aus dem Lernpaket.
 *
 * - Eine zweite Art zu üben, kein Ersatz: nichts zählt für Lernstand, Quiz oder Abzeichen.
 * - Es wird kein Ergebnis gespeichert. Hat der Azubi ein Pflanzenregal, bringt die erste geschaffte Runde je Spiel und
 *   Themenfeld einmal Tropfen; dafür merkt sich das Regal nur die Kombination (z. B. "memory:netzwerke"), ohne Datum.
 * - Die Bestmarke im Zeit-Sprint merkt sich nur der Browser.
 */

export const SPIELE = ['memory', 'sprint'] as const;
export type Spiel = (typeof SPIELE)[number];
export const SPIEL_TROPFEN = 2;
const PAARE = 6;
const SPRINT_FRAGEN = 40;

function meinPaket(c: Ctx): Paket {
  const p = paketVon(c.k, c.b);
  if (!p) throw new Fehler(404, 'Für deinen Ausbildungsberuf ist kein Lernmodul eingeschaltet');
  return p;
}

function spielAus(c: Ctx): Spiel {
  const s = c.p.id;
  if (!(SPIELE as readonly string[]).includes(s)) throw new Fehler(404, 'Dieses Spiel gibt es nicht');
  return s as Spiel;
}

/** „alle“, „heute“ (Karteikarten, die dran sind) oder ein Themenfeld */
function auswahl(c: Ctx, p: Paket, feld: string) {
  const begriffe = kartenVon(p.inhalte).filter((k) => k.art === 'begriff');
  if (feld === 'alle') return { titel: 'Alle Themenfelder', karten: begriffe };
  if (feld === 'heute') {
    const heute = c.k.jetzt().toISOString().slice(0, 10);
    const stand = new Map((c.k.db.prepare('SELECT karte_id, faellig FROM lern_karte WHERE azubi_id = ? AND paket = ?').all(c.b.id, p.id) as unknown as { karte_id: string; faellig: string }[]).map((z) => [z.karte_id, z.faellig]));
    return { titel: 'Heute dran', karten: begriffe.filter((k) => (stand.get(k.id) ?? '') <= heute) };
  }
  const f = p.inhalte.themenfelder.find((x) => x.id === feld);
  if (!f) throw new Fehler(404, 'Dieses Themenfeld gibt es nicht');
  return { titel: f.titel, karten: begriffe.filter((k) => k.feld === feld) };
}

function regalAn(c: Ctx): { spiele: string } | null {
  return (c.k.db.prepare("SELECT spiele FROM regal WHERE azubi_id = ? AND an = 1 AND EXISTS (SELECT 1 FROM einstellungen WHERE schluessel = 'vault_an' AND wert = '1')").get(c.b.id) as { spiele: string } | undefined) ?? null;
}

export const LERNSPIEL_ROUTEN: Route[] = [
  {
    // Eine Runde: Memory – Paare aus Begriff und Erklärung; Sprint – Erklärungen mit vier Begriffen zur Wahl
    m: 'GET',
    p: '/api/lernen/spiele/:id',
    wer: ['azubi'],
    h: (c) => {
      const spiel = spielAus(c);
      const p = meinPaket(c);
      const feld = c.a.query.get('feld') || 'alle';
      const { titel, karten } = auswahl(c, p, feld);
      const r = zufall(c.k.jetzt().getTime());
      // ein Begriff nur einmal, Erklärung nicht leer
      const eindeutig = mische(karten, r).filter((k, i, l) => k.hinten[0] && l.findIndex((x) => x.vorne.toLowerCase() === k.vorne.toLowerCase()) === i);
      const regal = regalAn(c);
      const zaehlt = !!regal && !regal.spiele.split(',').includes(`${spiel}:${feld}`);
      const felder = p.inhalte.themenfelder.map((f) => ({ id: f.id, titel: f.titel }));
      if (spiel === 'memory') {
        const paare = eindeutig.slice(0, PAARE).map((k) => ({ id: k.id, begriff: k.vorne, erklaerung: k.hinten[0] }));
        return { status: 200, body: { spiel, feld, titel, felder, zaehlt, tropfen: SPIEL_TROPFEN, paare } };
      }
      const alleBegriffe = kartenVon(p.inhalte).filter((k) => k.art === 'begriff').map((k) => k.vorne);
      const fragen = eindeutig.slice(0, SPRINT_FRAGEN).map((k) => {
        const falsch = mische([...new Set(alleBegriffe.filter((b) => b.toLowerCase() !== k.vorne.toLowerCase()))], r).slice(0, 3);
        return { id: k.id, erklaerung: k.hinten[0], optionen: mische([k.vorne, ...falsch], r), richtig: k.vorne };
      });
      return { status: 200, body: { spiel, feld, titel, felder, zaehlt, tropfen: SPIEL_TROPFEN, fragen } };
    },
  },
  {
    // Runde geschafft: bringt fürs Pflanzenregal einmal je Spiel und Themenfeld Tropfen. Kein Ergebnis wird gespeichert.
    m: 'POST',
    p: '/api/lernen/spiele/:id',
    wer: ['azubi'],
    h: (c) => {
      const spiel = spielAus(c);
      const p = meinPaket(c);
      const feld = koerper(c).feld;
      if (typeof feld !== 'string') throw new Fehler(400, 'Angabe „feld“ fehlt');
      auswahl(c, p, feld);
      const regal = regalAn(c);
      const schluessel = `${spiel}:${feld}`;
      if (!regal || regal.spiele.split(',').includes(schluessel)) return { status: 200, body: { regalTropfen: 0 } };
      const neu = regal.spiele.split(',').filter(Boolean).concat(schluessel).join(',');
      c.k.db.prepare('UPDATE regal SET spiele = ? WHERE azubi_id = ?').run(neu, c.b.id);
      return { status: 200, body: { regalTropfen: SPIEL_TROPFEN } };
    },
  },
];
