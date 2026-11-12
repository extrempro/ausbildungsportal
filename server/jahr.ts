import { genehmigteTage, urlaubsZeitraeume } from './urlaub';
import { Fehler, holeBenutzer, idAus } from './api-basis';
import type { Ctx, Route } from './api-basis';
import { heute } from './datum';
import { feiertageZwischen, istBundesland } from './feiertage';
import { ferienZwischen, ladeFerien } from './ferien';
import { firmentermineZwischen } from './firmentermin';
import { plusTage } from './kalender';
import { darfAzubiSehen, sichtbareAzubis } from './rechte';
import { mitPlanerTerminen } from './planer';
import { dauerVon, leseBetrieb, leseProfil, standAus } from './stammdaten';

/**
 * Jahreskalender: ein Kalenderjahr auf einen Blick – für den Azubi der eigene Plan, für Ausbilder und Beauftragte
 * alle Azubis, die sie sehen dürfen. Nur lesen. Enthalten sind Berufsschule, Einsätze, Prüfungstermine und Urlaub
 * (aus den Berichten; Krankheit erscheint nicht). Private Termine eines Azubis stehen nur in seinem eigenen Kalender.
 */
function kalenderVon(c: Ctx, azubiId: number, jahr: number, tag: string) {
  const { db } = c.k;
  const b = holeBenutzer(db, azubiId)!;
  const von = `${jahr}-01-01`;
  const bis = `${jahr}-12-31`;
  const profil = leseProfil(db, azubiId);
  const dauer = dauerVon(db, profil);
  const { beruf, stand } = standAus(db, profil, tag);
  // „bis“ ist im Plan der Montag der letzten Woche – hier reicht der Eintrag bis zum Sonntag dieser Woche
  const eintraege = (
    db.prepare("SELECT art, von, bis, titel FROM plan_eintrag WHERE azubi_id = ? AND art IN ('schule', 'einsatz') AND von <= ? AND bis >= ? ORDER BY von, id").all(azubiId, bis, plusTage(von, -6)) as unknown as { art: 'schule' | 'einsatz'; von: string; bis: string; titel: string }[]
  ).map((e) => ({ art: e.art, von: e.von, bis: plusTage(e.bis, 6), titel: e.titel }));
  const urlaub = new Set<string>();
  const eigener = c.b.id === azubiId;
  // Urlaub steht in den Berichten. Entwürfe sieht nur der Azubi selbst – andere erfahren den Urlaub erst mit dem Einreichen.
  for (const z of db.prepare(`SELECT inhalt FROM bericht WHERE azubi_id = ? AND montag >= ? AND montag <= ?${eigener ? '' : " AND status != 'entwurf'"}`).all(azubiId, plusTage(von, -6), bis) as unknown as { inhalt: string }[]) {
    try {
      for (const a of (JSON.parse(z.inhalt) as { abwesenheit?: { tag: string; grund: string }[] }).abwesenheit ?? []) if (a.grund === 'urlaub' && a.tag >= von && a.tag <= bis) urlaub.add(a.tag);
    } catch {
      // unlesbarer Bericht: kein Urlaub daraus
    }
  }
  const termine = eigener
    ? (db.prepare("SELECT tag, zeit_von AS zeitVon, titel FROM plan_eintrag WHERE azubi_id = ? AND art = 'termin' AND tag >= ? AND tag <= ? ORDER BY tag, zeit_von, id").all(azubiId, von, bis) as unknown as { tag: string; zeitVon: string; titel: string }[]).map((t) => ({ tag: t.tag, zeitVon: t.zeitVon, titel: t.titel }))
    : [];
  const schule = profil.berufsschuleId ? (db.prepare('SELECT bundesland FROM berufsschule WHERE id = ?').get(profil.berufsschuleId) as { bundesland: string } | undefined) : undefined;
  const ferienLand = schule?.bundesland || leseBetrieb(db).bundesland;
  const ferien = istBundesland(ferienLand) ? ferienZwischen(ladeFerien(c.k.cfg.contentDir, ferienLand, c.k.log), von, bis) : [];
  return {
    id: azubiId,
    anzeigename: b.anzeigename,
    beruf: beruf ? [beruf.bezeichnung, beruf.fachrichtung].filter(Boolean).join(' – ') : '',
    ausbildungsjahr: stand.phase === 'laufend' ? stand.ausbildungsjahr : null,
    beginn: dauer?.beginn ?? null,
    ende: dauer?.ende ?? null,
    eintraege,
    urlaub: [...new Set([...urlaub, ...genehmigteTage(db, azubiId, von, bis)])].sort(),
    // offene Urlaubsanträge: noch nicht entschieden, aber niemand soll in den Zeitraum hineinplanen
    beantragt: urlaubsZeitraeume(db, azubiId, 'offen', von, bis).map((u) => ({ von: u.von, bis: u.bis })),
    pruefungen: mitPlanerTerminen(c.k, azubiId, profil.pruefungen).filter((p) => p.datum >= von && p.datum <= bis).map((p) => ({ tag: p.datum, bezeichnung: p.bezeichnung })),
    termine,
    ferien,
  };
}

export const JAHR_ROUTEN: Route[] = [
  {
    m: 'GET',
    p: '/api/jahreskalender',
    wer: ['azubi', 'ausbilder', 'beauftragter'],
    h: (c) => {
      const { db } = c.k;
      const tag = heute(c.k.jetzt());
      const roh = c.a.query.get('jahr') ?? tag.slice(0, 4);
      const jahr = Number(roh);
      if (!/^\d{4}$/.test(roh) || jahr < 2000 || jahr > 2100) throw new Fehler(400, 'Das Jahr ist ungültig');
      const nur = c.a.query.get('azubi');
      let ids: number[];
      if (c.b.rolle === 'azubi') {
        // ein Azubi sieht nur den eigenen Kalender
        if (nur !== null && idAus(nur) !== c.b.id) throw new Fehler(404, 'Nicht gefunden');
        ids = [c.b.id];
      } else if (nur !== null) {
        const id = idAus(nur);
        if (!darfAzubiSehen(db, c.b, id, tag)) throw new Fehler(404, 'Nicht gefunden');
        ids = [id];
      } else ids = sichtbareAzubis(db, c.b, tag);
      const land = leseBetrieb(db).bundesland;
      return {
        status: 200,
        body: {
          jahr,
          heute: tag,
          eigenes: c.b.rolle === 'azubi',
          einzeln: c.b.rolle === 'azubi' || nur !== null,
          feiertage: istBundesland(land) ? feiertageZwischen(land, `${jahr}-01-01`, `${jahr}-12-31`).filter((f) => !f.teilweise).map((f) => ({ tag: f.datum, name: f.name })) : [],
          // Termine des Betriebs für alle – gelten für jeden Azubi gleich
          firmentermine: firmentermineZwischen(db, `${jahr}-01-01`, `${jahr}-12-31`),
          azubis: ids.map((id) => kalenderVon(c, id, jahr, tag)),
        },
      };
    },
  },
];
