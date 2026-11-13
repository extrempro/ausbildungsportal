import { useCallback, useEffect, useState } from 'react';
import { api, datum, zeit } from '../api';
import { Ladefehler } from '../dialoge';
import { HandbuchLink } from '../handbuchLink';
import { useLern } from '../lernen/basis';
import { EinreichenFormular, EinreichungTeil, EinreichungVerlauf } from '../lernen/einreichung';
import type { Einreichung } from '../lernen/einreichung';
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
export function LerninhalteListe({ ausbilder }: { ausbilder: boolean }) {
  const [pakete, setPakete] = useState<PaketZeile[] | null>(null);
  const [fehler, setFehler] = useState('');
  const [einr, setEinr] = useState<{ maxMb: number; einreichungen: Einreichung[] } | null>(null);
  const lade = useCallback(async () => {
    try {
      setPakete((await api<{ pakete: PaketZeile[] }>('GET', '/api/lerninhalte')).pakete);
      if (ausbilder) setEinr(await api('GET', '/api/lernpakete/einreichungen'));
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Fehler');
    }
  }, [ausbilder]);
  useEffect(() => void lade(), [lade]);
  if (fehler) return <Ladefehler titel="Lerninhalte" text={fehler} />;
  if (!pakete) return <p className="leise">Lädt …</p>;
  return (
    <>
      <h1>Lerninhalte</h1>
      <p className="leise">
        Hier liest du, was die Azubis im Lernmodul lernen: Themenfelder, Cheatsheets, Zusatzwissen und das Kompendium. Den Lernstand einzelner Azubis siehst du nicht – der gehört ihnen allein.{' '}
        <HandbuchLink kapitel="lernansicht">Lerninhalte ansehen</HandbuchLink>
      </p>
      {ausbilder && einr ? (
        <>
          {karten(pakete, einr.einreichungen).length === 0 ? (
            <p className="karte leise">Im Portal liegen noch keine Lerninhalte. Reiche unten das erste Lernmodul ein.</p>
          ) : (
            <ul className="antrag-liste lern-paket-liste">
              {karten(pakete, einr.einreichungen).map((k) => (
                <PaketKarte key={k.kennung} k={k} maxMb={einr.maxMb} onGeaendert={lade} />
              ))}
            </ul>
          )}
          <details className="karte">
            <summary>Neues Lernmodul einreichen</summary>
            <EinreichenFormular maxMb={einr.maxMb} onEingereicht={lade} />
          </details>
          <EinreichungVerlauf einreichungen={einr.einreichungen} />
        </>
      ) : pakete.length === 0 ? (
        <p className="karte leise">Auf dem Server liegen noch keine Lerninhalte. Der Betreiber des Portals bindet sie als Ordner ein.</p>
      ) : (
        <ul className="lern-pakete">
          {pakete.map((p) => (
            <li key={p.id}>
              <Link zu={`/lerninhalte/${p.id}`} className="karte lern-kachel">
                <strong>{p.titel}</strong>
                <span className="leise klein">{umfang(p)}</span>
                <span className="klein">{fuerWen(p)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!ausbilder && (
        <p className="hinweis" role="note">
          <strong>Du möchtest Inhalte ergänzen oder hast einen Fehler gefunden?</strong> Wende dich an den zuständigen Ausbilder. Ausbilder können Lerninhalte im Portal einreichen.
        </p>
      )}
    </>
  );
}

const umfang = (p: PaketZeile) => `${p.themenfelder} Themenfelder · ${p.unterthemen} Unterthemen${p.stand ? ` · Stand ${datum(p.stand)}` : ''}`;
const fuerWen = (p: PaketZeile) => (p.berufe.length ? `Eingeschaltet für: ${p.berufe.join(', ')}` : 'Für noch keinen Beruf eingeschaltet – Azubis sehen dieses Lernmodul nicht.');

/** Eine Karte je Lernmodul: das Paket im Portal (wenn es schon eins gibt) und die jüngste Einreichung dazu. */
interface Karte {
  kennung: string;
  paket: PaketZeile | null;
  letzte: Einreichung | null;
}
function karten(pakete: PaketZeile[], einreichungen: Einreichung[]): Karte[] {
  // die Liste kommt so vom Server: wartende zuerst, dann die neuesten – der erste Treffer je Kennung ist der, der zählt
  const letzte = (kennung: string) => einreichungen.find((e) => e.kennung === kennung) ?? null;
  const out: Karte[] = pakete.map((p) => ({ kennung: p.id, paket: p, letzte: letzte(p.id) }));
  // noch nicht im Portal: neue Lernmodule, die auf die Prüfung warten oder zurückgegeben wurden
  for (const e of einreichungen) {
    if (out.some((k) => k.kennung === e.kennung)) continue;
    const l = letzte(e.kennung)!;
    if (l.status === 'eingereicht' || l.status === 'zurueck') out.push({ kennung: e.kennung, paket: null, letzte: l });
  }
  return out;
}

function PaketKarte({ k, maxMb, onGeaendert }: { k: Karte; maxMb: number; onGeaendert: () => Promise<void> | void }) {
  const [neu, setNeu] = useState(false);
  const { paket: p, letzte: e } = k;
  const wartet = e?.status === 'eingereicht';
  const zurueck = e?.status === 'zurueck';
  const pille = wartet
    ? { farbe: 'gelb', text: p ? 'Neue Fassung wartet auf Prüfung' : 'Wartet auf Prüfung – noch nicht im Portal' }
    : zurueck
      ? { farbe: 'rot', text: p ? 'Neue Fassung zurückgegeben' : 'Zurückgegeben – noch nicht im Portal' }
      : { farbe: 'gruen', text: 'Im Portal' };
  return (
    <li className="karte antrag">
      <div className="antrag-kopf">
        <h2>
          {p?.titel ?? e?.titel ?? k.kennung} <code>{k.kennung}</code>
        </h2>
        <span className={`pille ${pille.farbe}`}>{pille.text}</span>
      </div>
      {p && (
        <p className="antrag-zeile">
          <span className="leise">{umfang(p)}</span>
          <br />
          <span className="klein">{fuerWen(p)}</span>
        </p>
      )}
      {e?.status === 'hochgeladen' && (
        <p className="leise klein">
          Zuletzt hochgeladen von {e.geprueftVon} am {zeit(e.geprueftAm)}
          {e.rueckmeldung ? ` – „${e.rueckmeldung}“` : '.'}
        </p>
      )}
      {e && (wartet || zurueck) && (
        <div className="lern-paket-einr">
          <h3>{wartet ? 'Eingereichte Fassung' : 'Zurückgegebene Fassung'}</h3>
          <EinreichungTeil e={e} onGeaendert={onGeaendert} />
        </div>
      )}
      {neu ? (
        <div className="lern-paket-einr">
          <h3>Lerninhalte aktualisieren</h3>
          <EinreichenFormular
            maxMb={maxMb}
            fest={k.kennung}
            onAbbrechen={() => setNeu(false)}
            onEingereicht={async () => {
              setNeu(false);
              await onGeaendert();
            }}
          />
        </div>
      ) : (
        <p className="aktionen links">
          {p && (
            <Link zu={`/lerninhalte/${p.id}`} className="knopf schlicht">
              Lerninhalte ansehen
            </Link>
          )}
          {wartet ? (
            <span className="leise klein">Aktualisieren geht wieder, sobald über die eingereichte Fassung entschieden ist.</span>
          ) : (
            <button type="button" className={`knopf${p && !zurueck ? ' schlicht' : ''}`} onClick={() => setNeu(true)}>
              {p ? 'Lerninhalte aktualisieren' : 'Neue Fassung einreichen'}
            </button>
          )}
        </p>
      )}
    </li>
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
  const { basis, api: quelle, anleitungen } = useLern();
  const [daten, setDaten] = useState<{ paket: LernPaket; themenfelder: Feld[] } | null>(null);
  const [fehler, setFehler] = useState('');
  useEffect(() => {
    api<{ paket: LernPaket; themenfelder: Feld[] }>('GET', quelle).then(setDaten, (e: Error) => setFehler(e.message));
  }, [quelle]);
  if (fehler) return <Ladefehler titel={anleitungen ? 'Anleitungen' : 'Lerninhalte'} text={fehler} />;
  if (!daten) return <p className="leise">Lädt …</p>;
  return (
    <>
      {!anleitungen && (
        <p className="klein">
          <Link zu="/lerninhalte">← Alle Lernmodule</Link>
        </p>
      )}
      <h1>{daten.paket.titel}</h1>
      <LernReiter />
      {anleitungen ? (
        <p className="leise">
          Anleitungen für alle Berufe – zum Lesen und Nachschlagen. Hier gibt es keine Ampel und keine Abzeichen. <HandbuchLink kapitel="anleitungen">Anleitungen lesen</HandbuchLink>
        </p>
      ) : (
        <p className="leise">
          So sehen die Azubis ihr Lernmodul – hier nur zum Lesen, ohne Ampel, Notizen und Abzeichen. <HandbuchLink kapitel="lernansicht">Lerninhalte ansehen</HandbuchLink>
        </p>
      )}
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
                {f.unterthemen.length} {anleitungen ? 'Abschnitte' : 'Unterthemen'}
                {f.zusatz.length > 0 && (anleitungen ? ` · ${f.zusatz.length}× zum Vertiefen` : ` · ${f.zusatz.length}× Zusatzwissen`)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <PaketFuss p={daten.paket} />
    </>
  );
}
