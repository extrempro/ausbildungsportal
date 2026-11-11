import { useEffect, useState } from 'react';
import { api, datum } from '../api';
import { Ladefehler } from '../dialoge';
import { HandbuchLink } from '../handbuchLink';
import { useLern } from '../lernen/basis';
import { LernReiter } from '../lernen/teile';
import { Link } from '../router';
import { PaketFuss } from './Lernen';
import type { LernPaket } from './Lernen';

/**
 * Lerninhalte ansehen – für Ausbilder und Ausbildungsbeauftragte.
 * Dieselben Inhalte, die Azubis unter „Lernen“ sehen, nur zum Lesen: keine Ampel, keine Notizen, keine Abzeichen –
 * und kein Lernstand einzelner Azubis. Der bleibt privat.
 */
interface PaketZeile extends LernPaket {
  themenfelder: number;
  unterthemen: number;
  berufe: string[];
}

/** Alle Lernmodule, die auf dem Server liegen. */
export function LerninhalteListe() {
  const [pakete, setPakete] = useState<PaketZeile[] | null>(null);
  const [fehler, setFehler] = useState('');
  useEffect(() => {
    api<{ pakete: PaketZeile[] }>('GET', '/api/lerninhalte').then((r) => setPakete(r.pakete), (e: Error) => setFehler(e.message));
  }, []);
  if (fehler) return <Ladefehler titel="Lerninhalte" text={fehler} />;
  if (!pakete) return <p className="leise">Lädt …</p>;
  return (
    <>
      <h1>Lerninhalte</h1>
      <p className="leise">
        Hier liest du, was die Azubis im Lernmodul lernen: Themenfelder, Cheatsheets, Zusatzwissen und das Kompendium. Den Lernstand einzelner Azubis siehst du nicht – der gehört ihnen allein.{' '}
        <HandbuchLink kapitel="lernansicht">Lerninhalte ansehen</HandbuchLink>
      </p>
      {pakete.length === 0 ? (
        <p className="karte leise">Auf dem Server liegen noch keine Lerninhalte. Der Betreiber des Portals bindet sie als Ordner ein.</p>
      ) : (
        <ul className="lern-pakete">
          {pakete.map((p) => (
            <li key={p.id}>
              <Link zu={`/lerninhalte/${p.id}`} className="karte lern-kachel">
                <strong>{p.titel}</strong>
                <span className="leise klein">
                  {p.themenfelder} Themenfelder · {p.unterthemen} Unterthemen{p.stand ? ` · Stand ${datum(p.stand)}` : ''}
                </span>
                <span className="klein">{p.berufe.length ? `Eingeschaltet für: ${p.berufe.join(', ')}` : 'Für noch keinen Beruf eingeschaltet – Azubis sehen dieses Lernmodul nicht.'}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

interface Feld {
  id: string;
  titel: string;
  lernfelder: string[];
  pruefung: string[];
  unterthemen: { id: string }[];
  zusatz: { id: string }[];
}

/** Die Themenfelder eines Lernmoduls – ohne Ampel. Läuft innerhalb von <Leseansicht>. */
export function LerninhalteUebersicht() {
  const { basis, api: quelle } = useLern();
  const [daten, setDaten] = useState<{ paket: LernPaket; themenfelder: Feld[] } | null>(null);
  const [fehler, setFehler] = useState('');
  useEffect(() => {
    api<{ paket: LernPaket; themenfelder: Feld[] }>('GET', quelle).then(setDaten, (e: Error) => setFehler(e.message));
  }, [quelle]);
  if (fehler) return <Ladefehler titel="Lerninhalte" text={fehler} />;
  if (!daten) return <p className="leise">Lädt …</p>;
  return (
    <>
      <p className="klein">
        <Link zu="/lerninhalte">← Alle Lernmodule</Link>
      </p>
      <h1>{daten.paket.titel}</h1>
      <LernReiter />
      <p className="leise">
        So sehen die Azubis ihr Lernmodul – hier nur zum Lesen, ohne Ampel, Notizen und Abzeichen. <HandbuchLink kapitel="lernansicht">Lerninhalte ansehen</HandbuchLink>
      </p>
      <ul className="lern-kacheln">
        {daten.themenfelder.map((f) => (
          <li key={f.id}>
            <Link zu={`${basis}/${f.id}`} className="karte lern-kachel">
              <span className="lern-kachel-kopf">
                <strong>{f.titel}</strong>
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
              <span className="leise klein">
                {f.unterthemen.length} Unterthemen
                {f.zusatz.length > 0 && ` · ${f.zusatz.length}× Zusatzwissen`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <PaketFuss p={daten.paket} />
    </>
  );
}
