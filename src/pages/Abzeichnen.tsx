import { melde } from '../dialoge';
import { useCallback, useEffect, useState } from 'react';
import { api, h, wocheText, zeit } from '../api';
import type { Bericht, OffenerBericht } from '../api';
import { Link } from '../router';
import { BerichtBlatt } from './Bericht';

const schluessel = (o: Pick<OffenerBericht, 'azubiId' | 'montag'>) => `${o.azubiId}|${o.montag}`;
const initialen = (name: string) =>
  name
    .split(/\s+/)
    .map((t) => t[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

/** Ein wartender Bericht: Zeile mit Haken, Woche und Stunden; aufgeklappt der ganze Bericht zum Lesen und Entscheiden. */
function Zeile({ o, gewaehlt, hatUnterschrift, onWahl, onErledigt, onFehler }: { o: OffenerBericht; gewaehlt: boolean; hatUnterschrift: boolean; onWahl: () => void; onErledigt: (text: string) => Promise<void>; onFehler: (text: string) => void }) {
  const [offen, setOffen] = useState(false);
  const [bericht, setBericht] = useState<Bericht | null>(null);
  const [zurueck, setZurueck] = useState(false);
  const [kommentar, setKommentar] = useState('');
  const pfad = `/api/azubis/${o.azubiId}/berichte/${o.montag}`;
  const kw = `KW ${o.kw}/${o.jahr}`;
  const abweichung = Math.abs(o.stunden - o.soll) > 0.01;

  const schalte = () => {
    setOffen(!offen);
    if (!bericht) api<Bericht>('GET', pfad).then(setBericht, (e: Error) => onFehler(e.message));
  };
  const tue = async (was: () => Promise<unknown>, text: string) => {
    try {
      await was();
      await onErledigt(text);
    } catch (e) {
      onFehler(e instanceof Error ? e.message : 'Fehler');
    }
  };

  return (
    <li className={`abz-zeile${offen ? ' offen' : ''}`}>
      <div className="abz-kopf">
        <label className="haken nur-haken">
          <input type="checkbox" aria-label={`${o.azubi}, ${kw} auswählen`} checked={gewaehlt} onChange={onWahl} />
        </label>
        <div className="abz-woche">
          <strong>{kw}</strong>
          <span className="leise klein">{wocheText(o.montag, o.sonntag)}</span>
        </div>
        <div className="abz-angaben">
          <span className={abweichung ? 'pille gelb' : 'pille gruen'} title="Eingetragene Stunden von den Wochenstunden">
            {h(o.stunden)} von {h(o.soll)} Std.
          </span>
          <span className="leise klein">eingereicht {zeit(o.eingereichtAm)}</span>
        </div>
        <button type="button" className="knopf schlicht klein" aria-expanded={offen} aria-controls={`abz-${schluessel(o)}`} onClick={schalte}>
          {offen ? 'Zuklappen' : 'Lesen'}
        </button>
      </div>
      {offen && (
        <div className="abz-inhalt" id={`abz-${schluessel(o)}`}>
          {bericht ? <BerichtBlatt b={bericht} /> : <p className="leise">Lädt …</p>}
          {zurueck ? (
            <div className="abz-zurueck">
              <label>
                Was soll der Azubi ändern? Er sieht diesen Text oben im Bericht.
                <textarea rows={3} maxLength={1000} value={kommentar} autoFocus onChange={(e) => setKommentar(e.target.value)} placeholder="z. B. Bitte dazuschreiben, womit du gearbeitet hast." />
              </label>
              <div className="aktionen links">
                <button type="button" className="knopf" disabled={!kommentar.trim()} onClick={() => void tue(() => api('POST', `${pfad}/zurueckgeben`, { kommentar }), `${kw} von ${o.azubi} zurückgegeben.`)}>
                  Zurückgeben
                </button>
                <button type="button" className="knopf schlicht" onClick={() => setZurueck(false)}>
                  Abbrechen
                </button>
              </div>
            </div>
          ) : (
            <div className="aktionen links nicht-drucken">
              <button type="button" className="knopf" disabled={!hatUnterschrift} onClick={() => void tue(() => api('POST', '/api/berichte/abzeichnen', { berichte: [{ azubiId: o.azubiId, montag: o.montag }] }), `${kw} von ${o.azubi} abgezeichnet.`)}>
                Abzeichnen
              </button>
              <button type="button" className="knopf schlicht" onClick={() => setZurueck(true)}>
                Zurückgeben …
              </button>
              <Link zu={`/azubis/${o.azubiId}/berichtsheft/${o.montag}`} className="klein">
                Als eigene Seite öffnen
              </Link>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/** Warteliste: eingereichte Berichte, die das angemeldete Konto abzeichnen darf – nach Azubi gegliedert. */
export function Abzeichnen() {
  const [offen, setOffen] = useState<OffenerBericht[] | null>(null);
  const [hatUnterschrift, setHatUnterschrift] = useState(true);
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);

  const lade = useCallback(async () => {
    const r = await api<{ offen: OffenerBericht[]; hatUnterschrift: boolean }>('GET', '/api/abzeichnen');
    setOffen(r.offen);
    setHatUnterschrift(r.hatUnterschrift);
    // Auswahl nur für Berichte behalten, die noch warten
    setGewaehlt((alt) => new Set(r.offen.map(schluessel).filter((k) => alt.has(k))));
  }, []);
  useEffect(() => {
    lade().catch((e: Error) => setMeldung({ text: e.message, fehler: true }));
  }, [lade]);

  const erledigt = async (text: string) => {
    await lade();
    setMeldung(null);
    melde(text);
  };
  const zeichneAb = async () => {
    const berichte = (offen ?? []).filter((o) => gewaehlt.has(schluessel(o))).map((o) => ({ azubiId: o.azubiId, montag: o.montag }));
    try {
      const r = await api<{ abgezeichnet: number }>('POST', '/api/berichte/abzeichnen', { berichte });
      await erledigt(`${r.abgezeichnet} ${r.abgezeichnet === 1 ? 'Bericht' : 'Berichte'} abgezeichnet.`);
    } catch (e) {
      setMeldung({ text: e instanceof Error ? e.message : 'Fehler', fehler: true });
    }
  };
  const setze = (schluesselListe: string[], an: boolean) => {
    const neu = new Set(gewaehlt);
    for (const k of schluesselListe) {
      if (an) neu.add(k);
      else neu.delete(k);
    }
    setGewaehlt(neu);
  };

  // nach Azubi gliedern, Reihenfolge wie vom Server (Name, dann älteste Woche zuerst)
  const gruppen: { azubiId: number; azubi: string; berichte: OffenerBericht[] }[] = [];
  for (const o of offen ?? []) {
    const g = gruppen.find((x) => x.azubiId === o.azubiId);
    if (g) g.berichte.push(o);
    else gruppen.push({ azubiId: o.azubiId, azubi: o.azubi, berichte: [o] });
  }
  const anzahl = offen?.length ?? 0;

  return (
    <>
      <h1>Abzeichnen</h1>
      <p className="leise">Eingereichte Berichte, die auf deine Unterschrift warten – nach Azubi geordnet, die älteste Woche zuerst.</p>
      {!hatUnterschrift && (
        <p className="hinweis">
          Zum Abzeichnen fehlt noch deine Unterschrift. <Link zu="/konto">Unter „Konto“ hinterlegen</Link>
        </p>
      )}
      {meldung && (
        <p className={`hinweis ${meldung.fehler ? 'fehler' : 'gut'}`} role={meldung.fehler ? 'alert' : 'status'}>
          {meldung.text}
        </p>
      )}
      {offen === null ? (
        <p className="leise">Lädt …</p>
      ) : anzahl === 0 ? (
        <p className="karte leise">Es wartet kein Bericht auf dich. Alles erledigt.</p>
      ) : (
        <>
          <ol className="ablauf-liste abz-hilfe">
            <li>
              <span className="ablauf-nr">1</span>
              <div>
                <strong>Lesen</strong>
                <div className="leise klein">„Lesen“ klappt den Bericht hier auf.</div>
              </div>
            </li>
            <li>
              <span className="ablauf-nr">2</span>
              <div>
                <strong>Abzeichnen oder zurückgeben</strong>
                <div className="leise klein">Direkt unter dem Bericht. Zurückgeben braucht einen Kommentar.</div>
              </div>
            </li>
            <li>
              <span className="ablauf-nr">3</span>
              <div>
                <strong>Mehrere auf einmal</strong>
                <div className="leise klein">Haken setzen und unten gemeinsam abzeichnen.</div>
              </div>
            </li>
          </ol>

          <div className="abz-zusammenfassung">
            <strong>
              {anzahl} {anzahl === 1 ? 'Bericht wartet' : 'Berichte warten'}
            </strong>
            <span className="leise">
              von {gruppen.length} {gruppen.length === 1 ? 'Azubi' : 'Azubis'}
            </span>
            <label className="haken rechts">
              <input type="checkbox" checked={gewaehlt.size === anzahl} onChange={(e) => setze((offen ?? []).map(schluessel), e.target.checked)} />
              Alle auswählen
            </label>
          </div>

          {gruppen.map((g) => {
            const schluesselListe = g.berichte.map(schluessel);
            const alle = schluesselListe.every((k) => gewaehlt.has(k));
            return (
              <section className="karte abz-gruppe" key={g.azubiId} aria-label={`Berichte von ${g.azubi}`}>
                <div className="abz-gruppe-kopf">
                  <span className="avatar" aria-hidden="true">
                    {initialen(g.azubi)}
                  </span>
                  <div className="azubi-name">
                    <h2>{g.azubi}</h2>
                    <span className="leise klein">
                      {g.berichte.length} {g.berichte.length === 1 ? 'Bericht wartet' : 'Berichte warten'} · <Link zu={`/azubis/${g.azubiId}/berichtsheft`}>ganzes Berichtsheft</Link>
                    </span>
                  </div>
                  {g.berichte.length > 1 && (
                    <label className="haken">
                      <input type="checkbox" checked={alle} onChange={(e) => setze(schluesselListe, e.target.checked)} aria-label={`Alle Berichte von ${g.azubi} auswählen`} />
                      Alle
                    </label>
                  )}
                </div>
                <ul className="abz-liste">
                  {g.berichte.map((o) => (
                    <Zeile
                      key={schluessel(o)}
                      o={o}
                      gewaehlt={gewaehlt.has(schluessel(o))}
                      hatUnterschrift={hatUnterschrift}
                      onWahl={() => setze([schluessel(o)], !gewaehlt.has(schluessel(o)))}
                      onErledigt={erledigt}
                      onFehler={(text) => setMeldung({ text, fehler: true })}
                    />
                  ))}
                </ul>
              </section>
            );
          })}

          {/* bleibt am unteren Rand stehen, sobald etwas ausgewählt ist */}
          <div className={`abz-leiste${gewaehlt.size ? ' aktiv' : ''}`}>
            <span>{gewaehlt.size === 0 ? 'Nichts ausgewählt' : `${gewaehlt.size} ${gewaehlt.size === 1 ? 'Bericht' : 'Berichte'} ausgewählt`}</span>
            <button type="button" className="knopf" disabled={gewaehlt.size === 0 || !hatUnterschrift} onClick={() => void zeichneAb()}>
              {gewaehlt.size === 0 ? 'Ausgewählte abzeichnen' : `${gewaehlt.size} ${gewaehlt.size === 1 ? 'Bericht' : 'Berichte'} abzeichnen`}
            </button>
          </div>
        </>
      )}
    </>
  );
}
