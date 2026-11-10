import { useEffect, useState } from 'react';
import { api, berichtsheftPfad, h, STATUS_FARBE, STATUS_TEXT, wocheText } from '../api';
import type { BerichtListe, BerichtStatus, OffenerBericht } from '../api';
import { Link } from '../router';
import { BerichtBlatt } from './Bericht';

const FILTER: { wert: BerichtStatus | 'alle'; text: string }[] = [
  { wert: 'alle', text: 'Alle' },
  { wert: 'fehlt', text: 'Fehlt' },
  { wert: 'entwurf', text: 'Entwurf' },
  { wert: 'zurueck', text: 'Zurückgegeben' },
  { wert: 'eingereicht', text: 'Eingereicht' },
  { wert: 'abgezeichnet', text: 'Abgezeichnet' },
];

/** Liste aller Wochen der Ausbildung mit dem Stand des jeweiligen Berichts. */
export function Berichtsheft({ azubiId }: { azubiId: number }) {
  const [daten, setDaten] = useState<BerichtListe | null>(null);
  const [fehler, setFehler] = useState('');
  const [filter, setFilter] = useState<BerichtStatus | 'alle'>('alle');

  useEffect(() => {
    api<BerichtListe>('GET', `/api/azubis/${azubiId}/berichte`).then(setDaten, (e: Error) => setFehler(e.message));
  }, [azubiId]);

  if (fehler) {
    return (
      <>
        <h1>Berichtsheft nicht gefunden</h1>
        <p className="leise">{fehler}</p>
      </>
    );
  }
  if (!daten) return <p className="leise">Lädt …</p>;

  const basis = berichtsheftPfad(azubiId, daten.eigenes);
  const anzahl = (s: BerichtStatus | 'alle') => (s === 'alle' ? daten.wochen.length : daten.wochen.filter((w) => w.status === s).length);
  const sichtbar = daten.wochen.filter((w) => filter === 'alle' || w.status === filter);

  return (
    <>
      {!daten.eigenes && (
        <p className="klein">
          <Link zu={`/azubis/${azubiId}`}>← {daten.azubi.anzeigename}</Link>
        </p>
      )}
      <h1>Berichtsheft{daten.eigenes ? '' : ` von ${daten.azubi.anzeigename}`}</h1>
      <p className="leise">
        Ein Bericht (Ausbildungsnachweis) je Kalenderwoche. {daten.eigenes ? 'Du schreibst und reichst ein; dein Ausbilder oder deine Ausbildungsbeauftragten zeichnen ab.' : 'Nur der Azubi selbst kann die Berichte bearbeiten.'}
      </p>

      {daten.beginnFehlt ? (
        <p className="hinweis">
          {daten.eigenes ? 'Für dich ist noch kein Ausbildungsbeginn eingetragen. Bitte wende dich an deinen Ausbilder – erst dann lassen sich Berichte schreiben.' : 'Für diesen Azubi ist noch kein Ausbildungsbeginn eingetragen. Er steht im Profil.'}
        </p>
      ) : (
        <>
          <div className="filter" role="group" aria-label="Nach Stand filtern">
            {FILTER.filter((f) => f.wert === 'alle' || anzahl(f.wert) > 0).map((f) => (
              <button key={f.wert} type="button" className="knopf schlicht" aria-pressed={filter === f.wert} onClick={() => setFilter(f.wert)}>
                {f.text} ({anzahl(f.wert)})
              </button>
            ))}
            {anzahl('alle') > anzahl('fehlt') && (
              <Link zu={`${basis}/druck`} className="knopf schlicht rechts">
                Alle Berichte drucken
              </Link>
            )}
          </div>
          <div className="karte tabelle-rahmen">
            <table className="stapel">
              <thead>
                <tr>
                  <th>Woche</th>
                  <th>Zeitraum</th>
                  <th>Stand</th>
                  <th className="zahl">Stunden</th>
                </tr>
              </thead>
              <tbody>
                {sichtbar.map((w) => (
                  <tr key={w.montag}>
                    <td className="eng kopf">
                      <Link zu={`${basis}/${w.montag}`}>
                        <strong>
                          KW {w.kw}/{w.jahr}
                        </strong>
                      </Link>
                    </td>
                    <td className="eng" data-label="Zeitraum">
                      <span>
                        {wocheText(w.montag, w.sonntag)}
                        {w.ausbildungsjahr ? <span className="leise"> · {w.ausbildungsjahr}. Jahr</span> : null}
                      </span>
                    </td>
                    <td data-label="Stand">
                      <span className={`pille ${STATUS_FARBE[w.status]}`}>{STATUS_TEXT[w.status]}</span>
                    </td>
                    <td className="zahl" data-label="Stunden">{w.status === 'fehlt' ? '–' : `${h(w.stunden)} / ${h(daten.soll)}`}</td>
                  </tr>
                ))}
                {sichtbar.length === 0 && (
                  <tr>
                    <td colSpan={4} className="leise">
                      Keine Wochen mit diesem Stand.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

/** Alle vorhandenen Berichte untereinander – jede Woche auf einer eigenen Druckseite. */
export function BerichteDruck({ azubiId }: { azubiId: number }) {
  const [daten, setDaten] = useState<BerichtListe | null>(null);
  const [fehler, setFehler] = useState('');
  const [nur, setNur] = useState<'alle' | 'abgezeichnet'>('alle');

  useEffect(() => {
    api<BerichtListe>('GET', `/api/azubis/${azubiId}/berichte?voll=1`).then(setDaten, (e: Error) => setFehler(e.message));
  }, [azubiId]);

  if (fehler) return <p className="hinweis fehler">{fehler}</p>;
  if (!daten) return <p className="leise">Lädt …</p>;
  const berichte = (daten.berichte ?? []).filter((b) => nur === 'alle' || b.status === 'abgezeichnet');

  return (
    <>
      <div className="nicht-drucken">
        <p className="klein">
          <Link zu={berichtsheftPfad(azubiId, daten.eigenes)}>← Berichtsheft</Link>
        </p>
        <h1>Berichte drucken</h1>
        <p className="leise">
          {daten.azubi.anzeigename} · {berichte.length} Berichte, jeder auf einer eigenen Seite. Über „Drucken“ lässt sich im Druckdialog auch „Als PDF speichern“ wählen.
        </p>
        <div className="filter">
          <button type="button" className="knopf schlicht" aria-pressed={nur === 'alle'} onClick={() => setNur('alle')}>
            Alle vorhandenen
          </button>
          <button type="button" className="knopf schlicht" aria-pressed={nur === 'abgezeichnet'} onClick={() => setNur('abgezeichnet')}>
            Nur abgezeichnete
          </button>
          <button type="button" className="knopf rechts" onClick={() => window.print()} disabled={berichte.length === 0}>
            Drucken
          </button>
        </div>
      </div>
      {berichte.map((b) => (
        <section className="karte druckseite" key={b.montag}>
          <BerichtBlatt b={b} />
        </section>
      ))}
      {berichte.length === 0 && <p className="karte leise">Keine Berichte vorhanden.</p>}
    </>
  );
}

/** Warteliste: eingereichte Berichte, die das angemeldete Konto abzeichnen darf. */
export function Abzeichnen() {
  const [offen, setOffen] = useState<OffenerBericht[] | null>(null);
  const [hatUnterschrift, setHatUnterschrift] = useState(true);
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);
  const schluessel = (o: OffenerBericht) => `${o.azubiId}|${o.montag}`;

  const lade = async () => {
    const r = await api<{ offen: OffenerBericht[]; hatUnterschrift: boolean }>('GET', '/api/abzeichnen');
    setOffen(r.offen);
    setHatUnterschrift(r.hatUnterschrift);
    setGewaehlt(new Set());
  };
  useEffect(() => {
    lade().catch((e: Error) => setMeldung({ text: e.message, fehler: true }));
  }, []);

  const zeichneAb = async () => {
    const berichte = (offen ?? []).filter((o) => gewaehlt.has(schluessel(o))).map((o) => ({ azubiId: o.azubiId, montag: o.montag }));
    try {
      const r = await api<{ abgezeichnet: number }>('POST', '/api/berichte/abzeichnen', { berichte });
      await lade();
      setMeldung({ text: `${r.abgezeichnet} ${r.abgezeichnet === 1 ? 'Bericht' : 'Berichte'} abgezeichnet.`, fehler: false });
    } catch (e) {
      setMeldung({ text: e instanceof Error ? e.message : 'Fehler', fehler: true });
    }
  };
  const schalte = (k: string) => {
    const neu = new Set(gewaehlt);
    if (neu.has(k)) neu.delete(k);
    else neu.add(k);
    setGewaehlt(neu);
  };

  return (
    <>
      <h1>Abzeichnen</h1>
      <p className="leise">Eingereichte Berichte, die auf deine Unterschrift warten. Zum Lesen die Woche öffnen; mehrere lassen sich gemeinsam abzeichnen.</p>
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
      ) : offen.length === 0 ? (
        <p className="karte leise">Es wartet kein Bericht auf dich.</p>
      ) : (
        <>
          <div className="karte tabelle-rahmen">
            <table className="stapel">
              <thead>
                <tr>
                  <th>
                    <label className="haken nur-haken">
                      <input
                        type="checkbox"
                        aria-label="Alle auswählen"
                        checked={gewaehlt.size === offen.length}
                        onChange={(e) => setGewaehlt(e.target.checked ? new Set(offen.map(schluessel)) : new Set())}
                      />
                    </label>
                  </th>
                  <th>Azubi</th>
                  <th>Woche</th>
                  <th className="zahl">Stunden</th>
                </tr>
              </thead>
              <tbody>
                {offen.map((o) => (
                  <tr key={schluessel(o)}>
                    <td data-label="Auswählen">
                      <label className="haken nur-haken">
                        <input type="checkbox" aria-label={`${o.azubi}, KW ${o.kw} auswählen`} checked={gewaehlt.has(schluessel(o))} onChange={() => schalte(schluessel(o))} />
                      </label>
                    </td>
                    <td data-label="Azubi">{o.azubi}</td>
                    <td data-label="Woche">
                      <span>
                        <Link zu={`/azubis/${o.azubiId}/berichtsheft/${o.montag}`}>
                          <strong>
                            KW {o.kw}/{o.jahr}
                          </strong>
                        </Link>{' '}
                        <span className="leise">{wocheText(o.montag, o.sonntag)}</span>
                      </span>
                    </td>
                    <td className="zahl" data-label="Stunden">{h(o.stunden)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="knopf" disabled={gewaehlt.size === 0 || !hatUnterschrift} onClick={() => void zeichneAb()}>
            {gewaehlt.size === 0 ? 'Ausgewählte abzeichnen' : `${gewaehlt.size} ${gewaehlt.size === 1 ? 'Bericht' : 'Berichte'} abzeichnen`}
          </button>
        </>
      )}
    </>
  );
}
