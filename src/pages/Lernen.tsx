import { useEffect, useState } from 'react';
import { api, datum } from '../api';
import { Ladefehler } from '../dialoge';
import { HandbuchLink } from '../handbuchLink';
import { AMPEL_REIHE, AMPEL_TEXT, ampelVon, prozent, summe, zaehle, zusammenfassung } from '../lernen/ampel';
import type { LernStatus } from '../lernen/ampel';
import { StapelBalken, StatusPille } from '../lernen/teile';
import { Link } from '../router';

export interface LernPaket {
  id: string;
  titel: string;
  stand: string;
  quelle: string;
  lizenz: string;
}

interface Feld {
  id: string;
  titel: string;
  lernfelder: string[];
  pruefung: string[];
  unterthemen: { id: string; titel: string; status: LernStatus; lernpunkt: boolean; inhaltAktualisiert: boolean }[];
}

/** Woher die Inhalte kommen – steht unter jeder Lernseite. */
export function PaketFuss({ p }: { p: LernPaket }) {
  return (
    <p className="leise klein lern-fuss">
      Inhalte: {p.titel}
      {p.quelle && ` · Quelle: ${p.quelle}`}
      {p.lizenz && ` · Lizenz: ${p.lizenz}`}
      {p.stand && ` · Stand ${datum(p.stand)}`}
    </p>
  );
}

/** Lernen – Übersicht: alle Themenfelder mit der eigenen Ampel. */
export function Lernen() {
  const [daten, setDaten] = useState<{ paket: LernPaket; themenfelder: Feld[] } | null>(null);
  const [fehler, setFehler] = useState('');
  const [filter, setFilter] = useState<LernStatus | 'alle'>('alle');

  useEffect(() => {
    api<{ paket: LernPaket; themenfelder: Feld[] }>('GET', '/api/lernen').then(setDaten, (e: Error) => setFehler(e.message));
  }, []);

  if (fehler) return <Ladefehler titel="Lernen" text={fehler} />;
  if (!daten) return <p className="leise">Lädt …</p>;

  const felder = daten.themenfelder;
  const gesamt = summe(felder);
  const mitAmpel = felder.map((f) => ({ f, z: zaehle(f.unterthemen), ampel: ampelVon(zaehle(f.unterthemen)) }));
  const anzahl = (s: LernStatus) => mitAmpel.filter((x) => x.ampel === s).length;
  const gezeigt = mitAmpel.filter((x) => filter === 'alle' || x.ampel === filter);

  return (
    <>
      <h1>Lernen</h1>
      <p className="leise">
        Lernstoff für deinen Beruf, sortiert nach Themen. Zu jedem Thema gibt es ein Cheatsheet – das Wichtigste auf einen Blick. Mit der Ampel hältst du fest, was schon sitzt. <strong>Deinen Lernstand siehst nur du.</strong>{' '}
        <HandbuchLink kapitel="lernen">Lernen mit Cheatsheets und Ampel</HandbuchLink>
      </p>

      <section className="karte lern-gesamt" aria-label="Mein Lernstand insgesamt">
        <div className="lern-gesamt-zahl">
          <strong>{prozent(gesamt)} %</strong>
          <span className="leise">Lernstand</span>
        </div>
        <div className="lern-gesamt-balken">
          <StapelBalken z={gesamt} />
          <p className="leise klein">
            {gesamt.n} Unterthemen: {zusammenfassung(gesamt)}
          </p>
        </div>
      </section>

      <div className="filter" role="group" aria-label="Themenfelder filtern">
        <button type="button" className="knopf schlicht" aria-pressed={filter === 'alle'} onClick={() => setFilter('alle')}>
          Alle ({felder.length})
        </button>
        {AMPEL_REIHE.map((s) => (
          <button key={s} type="button" className="knopf schlicht" aria-pressed={filter === s} onClick={() => setFilter(s)}>
            {AMPEL_TEXT[s]} ({anzahl(s)})
          </button>
        ))}
      </div>

      {gezeigt.length === 0 && <p className="leise">Kein Themenfeld mit diesem Stand.</p>}
      <ul className="lern-kacheln">
        {gezeigt.map(({ f, z, ampel }) => {
          const punkte = f.unterthemen.filter((u) => u.lernpunkt).length;
          const neu = f.unterthemen.filter((u) => u.inhaltAktualisiert).length;
          return (
            <li key={f.id}>
              <Link zu={`/lernen/${f.id}`} className="karte lern-kachel">
                <span className="lern-kachel-kopf">
                  <strong>{f.titel}</strong>
                  <StatusPille status={ampel} />
                </span>
                <span className="lern-marken">
                  {f.lernfelder.map((l) => (
                    <span key={l} className="pille grau">
                      {l}
                    </span>
                  ))}
                  {f.pruefung.map((p) => (
                    <span key={p} className="pille blau">
                      {p}
                    </span>
                  ))}
                </span>
                <span className="lern-kachel-stand">
                  <StapelBalken z={z} />
                  <span>{prozent(z)} %</span>
                </span>
                <span className="leise klein">
                  {z.n} Unterthemen
                  {punkte > 0 && ` · ${punkte} ${punkte === 1 ? 'Lernpunkt' : 'Lernpunkte'} notiert`}
                  {neu > 0 && ' · Inhalt aktualisiert'}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <PaketFuss p={daten.paket} />
    </>
  );
}
