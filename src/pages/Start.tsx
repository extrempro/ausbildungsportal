import { useEffect, useState } from 'react';
import { api, ROLLE_TEXT, standText } from '../api';
import type { AzubiKurz, Konto, OffenerBericht } from '../api';
import { Link } from '../router';

export function Start({ konto }: { konto: Konto }) {
  const [azubis, setAzubis] = useState<AzubiKurz[] | null>(null);
  const [wartend, setWartend] = useState<number | null>(null);
  const betreut = konto.rolle === 'ausbilder' || konto.rolle === 'beauftragter';

  useEffect(() => {
    if (betreut) api<{ azubis: AzubiKurz[] }>('GET', '/api/azubis').then((r) => setAzubis(r.azubis), () => setAzubis([]));
    if (betreut) api<{ offen: OffenerBericht[] }>('GET', '/api/abzeichnen').then((r) => setWartend(r.offen.length), () => {});
  }, [betreut, konto.rolle, konto.id]);

  return (
    <>
      <h1>Hallo {konto.anzeigename}</h1>
      <p className="leise">Angemeldet als {ROLLE_TEXT[konto.rolle]}.</p>
      {betreut && (
        <div className="kacheln">
          <Link zu="/abzeichnen" className={`kachel${wartend ? ' warnung' : ''}`}>
            <span className="kachel-wert">{wartend ?? '–'}</span>
            <span className="kachel-text">{wartend === 1 ? 'Bericht wartet' : 'Berichte warten'}</span>
            <span className="kachel-zusatz">auf deine Unterschrift</span>
          </Link>
          <Link zu="/azubis" className="kachel">
            <span className="kachel-wert">{azubis?.length ?? '–'}</span>
            <span className="kachel-text">{azubis?.length === 1 ? 'Azubi' : 'Azubis'}</span>
            <span className="kachel-zusatz">{konto.rolle === 'ausbilder' ? 'im Betrieb' : 'dir zugewiesen'}</span>
          </Link>
          <Link zu="/uebersicht" className="kachel">
            <span className="kachel-wert">26</span>
            <span className="kachel-text">Wochen im Blick</span>
            <span className="kachel-zusatz">Schule, Einsätze, Urlaub</span>
          </Link>
        </div>
      )}

      {betreut && (
        <section className="karte">
          <h2>{konto.rolle === 'ausbilder' ? 'Alle Azubis' : 'Mir zugewiesene Azubis'}</h2>
          {azubis === null ? (
            <p className="leise">Lädt …</p>
          ) : azubis.length === 0 ? (
            <p className="leise">
              {konto.rolle === 'ausbilder' ? (
                <>
                  Noch keine Azubis. Unter <Link zu="/verwaltung/konten">Konten</Link> lassen sich welche anlegen.
                </>
              ) : (
                'Dir ist noch kein Azubi zugewiesen.'
              )}
            </p>
          ) : (
            <ul className="liste mit-kurzwegen">
              {azubis.map((a) => (
                <li key={a.id}>
                  <div>
                    <Link zu={`/azubis/${a.id}`}>
                      <strong>{a.anzeigename}</strong>
                    </Link>{' '}
                    <span className="leise">
                      {a.beruf ? `${a.beruf} · ` : ''}
                      {standText(a)}
                    </span>
                    {a.status === 'gesperrt' && <span className="pille grau">gesperrt</span>}
                  </div>
                  <div className="kurzwege">
                    <Link zu={`/azubis/${a.id}/plan`} className="knopf schlicht klein">
                      Ausbildungsplan
                    </Link>
                    <Link zu={`/azubis/${a.id}/berichtsheft`} className="knopf schlicht klein">
                      Berichtsheft
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
